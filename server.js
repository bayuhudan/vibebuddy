const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
  logActivity,
  addXpToUser
} = require('./database');
const { COMPANIONS, generateCompanionReply } = require('./botEngine');

// Initialize SQL database tables
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Server start time for uptime metric
const SERVER_START_TIME = Date.now();

// --- Auth Helper & Middlewares ---
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getAuthUser(req) {
  const token = req.cookies.auth_token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;

  const session = db.prepare(`
    SELECT s.*, u.id as user_id, u.username, u.full_name, u.role, u.avatar, u.persona, u.bio, u.friendship_level, u.friendship_xp, u.status, u.vibes_received
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, Date.now());

  return session || null;
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesi login tidak valid atau telah berakhir. Silakan login kembali.' });
  }
  if (user.status === 'banned') {
    return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan (Banned) oleh administrator.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak! Halaman ini hanya untuk Administrator Server.' });
  }
  req.user = user;
  next();
}

// Check maintenance mode middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth') || req.path.startsWith('/admin') || req.path.startsWith('/css') || req.path.startsWith('/js')) {
    return next();
  }

  const maintenance = db.prepare('SELECT value FROM server_settings WHERE key = ?').get('maintenance_mode');
  if (maintenance && maintenance.value === 'true') {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') {
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({ error: 'Server sedang dalam pemeliharaan (Maintenance Mode). Harap coba beberapa saat lagi.' });
      }
    }
  }
  next();
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const allowReg = db.prepare('SELECT value FROM server_settings WHERE key = ?').get('allow_registration');
    if (allowReg && allowReg.value === 'false') {
      return res.status(403).json({ error: 'Registrasi pengguna baru sedang ditutup oleh Administrator.' });
    }

    const { username, password, full_name, avatar, persona, bio } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, Nama Lengkap, dan Password wajib diisi!' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return res.status(400).json({ error: 'Username harus memiliki panjang 3-20 karakter!' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter!' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'Username sudah digunakan oleh orang lain. Pilih yang lain ya!' });
    }

    const auth = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, role, avatar, persona, bio, friendship_level, friendship_xp, status)
      VALUES (?, ?, ?, ?, 'user', ?, ?, ?, 1, 10, 'active')
    `).run(
      cleanUsername,
      auth.hash,
      auth.salt,
      full_name.trim(),
      avatar || '🦊',
      persona || 'Si Santai',
      bio || 'Halo! Saya baru gabung di sini.'
    );

    const userId = result.lastInsertRowid;
    const token = generateToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
    logActivity(userId, 'REGISTER', `Pengguna baru mendaftar: ${cleanUsername}`, req.ip);

    res.cookie('auth_token', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    res.json({
      message: 'Pendaftaran berhasil! Akun Anda kini aktif dan tampil di beranda server.',
      user: {
        id: userId,
        username: cleanUsername,
        full_name: full_name.trim(),
        role: 'user',
        avatar: avatar || '🦊',
        persona: persona || 'Si Santai',
        bio: bio || 'Halo! Saya baru gabung di sini.',
        friendship_level: 1,
        friendship_xp: 10,
        status: 'active'
      },
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat registrasi.' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password wajib diisi!' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Username atau Password salah!' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Username atau Password salah!' });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan (Banned) oleh Administrator. Silakan hubungi admin.' });
    }

    const token = generateToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
    db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    logActivity(user.id, 'LOGIN', `Pengguna login: ${user.username}`, req.ip);

    res.cookie('auth_token', token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    res.json({
      message: 'Login berhasil!',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        avatar: user.avatar,
        persona: user.persona || 'Si Santai',
        bio: user.bio,
        friendship_level: user.friendship_level,
        friendship_xp: user.friendship_xp,
        status: user.status
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server saat login.' });
  }
});

// Me (Check Current User Profile)
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ user: null });
  }
  res.json({ user });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('auth_token');
  res.json({ message: 'Logout berhasil.' });
});

// Update Profile
app.put('/api/auth/profile', requireAuth, (req, res) => {
  try {
    const { full_name, avatar, persona, bio } = req.body;
    db.prepare('UPDATE users SET full_name = ?, avatar = ?, persona = ?, bio = ? WHERE id = ?')
      .run(
        full_name || req.user.full_name,
        avatar || req.user.avatar,
        persona || req.user.persona || 'Si Santai',
        bio || req.user.bio,
        req.user.user_id
      );

    logActivity(req.user.user_id, 'PROFILE_UPDATE', 'Pengguna memperbarui profilnya', req.ip);
    res.json({ message: 'Profil berhasil diperbarui!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui profil.' });
  }
});

// ==========================================
// 2. REAL USERS IN SERVER (FOR BERANDA UTAMA)
// ==========================================

// Get real users in the server (excluding the current user, or all registered regular users)
app.get('/api/users', (req, res) => {
  try {
    // Only return users with active status (or not banned)
    // We exclude role='admin' from the regular friends list if needed, or include them with admin badge
    const users = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role, u.avatar, u.persona, u.bio,
             u.friendship_level, u.friendship_xp, u.status, u.vibes_received,
             u.created_at, u.last_login,
             (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) as total_messages
      FROM users u
      WHERE u.status != 'banned'
      ORDER BY u.id DESC
    `).all();

    res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Gagal memuat daftar pengguna server.' });
  }
});

// Send Virtual Vibe (Sapaan / High-Five) to another user
app.post('/api/users/:id/vibe', requireAuth, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    if (targetUserId === req.user.user_id) {
      return res.status(400).json({ error: 'Tidak dapat mengirim vibe ke diri sendiri!' });
    }

    const targetUser = db.prepare('SELECT id, username, full_name, vibes_received FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    // Increment vibes
    db.prepare('UPDATE users SET vibes_received = vibes_received + 1 WHERE id = ?').run(targetUserId);

    // Reward XP to sender (+5 XP) and receiver (+5 XP)
    const senderXp = addXpToUser(req.user.user_id, 5);
    addXpToUser(targetUserId, 5);

    logActivity(req.user.user_id, 'SEND_VIBE', `Mengirim sapaan virtual ke @${targetUser.username}`, req.ip);

    res.json({
      message: `Berhasil mengirim Sapaan Virtual ke ${targetUser.full_name || targetUser.username}! ✨ (+5 XP)`,
      newVibes: (targetUser.vibes_received || 0) + 1,
      xp: senderXp
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengirim vibe.' });
  }
});

// Chat with a registered user / their virtual persona
app.get('/api/chat/user/:targetId', requireAuth, (req, res) => {
  try {
    const targetId = parseInt(req.params.targetId);
    const myId = req.user.user_id;

    const messages = db.prepare(`
      SELECT id, user_id, target_user_id, sender, text, created_at
      FROM messages
      WHERE (user_id = ? AND target_user_id = ?) OR (user_id = ? AND target_user_id = ?)
      ORDER BY id ASC
      LIMIT 100
    `).all(myId, targetId, targetId, myId);

    const targetUser = db.prepare('SELECT id, username, full_name, avatar, persona, bio, status FROM users WHERE id = ?').get(targetId);

    res.json({ messages, targetUser });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat pesan dengan pengguna.' });
  }
});

app.post('/api/chat/user/:targetId', requireAuth, (req, res) => {
  try {
    const targetId = parseInt(req.params.targetId);
    const { message } = req.body;
    const myId = req.user.user_id;

    if (req.user.status === 'muted') {
      return res.status(403).json({ error: 'Akun Anda sedang dibisukan (muted) oleh Admin.' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong!' });
    }

    const targetUser = db.prepare('SELECT id, username, full_name, persona FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Pengguna tujuan tidak ditemukan atau sudah dihapus.' });
    }

    // Insert sender's message
    const cleanMsg = message.trim();
    const userMsgRes = db.prepare(`
      INSERT INTO messages (user_id, target_user_id, sender, text)
      VALUES (?, ?, 'user', ?)
    `).run(myId, targetId, cleanMsg);

    // Auto persona virtual reply from the friend
    const personaMap = {
      'Si Roaster': 'roaster',
      'Si Ambis': 'hustle',
      'Si Pendengar Melow': 'melow',
      'Si Wibu': 'kawaii',
      'Si Pelawak Receh': 'bapack',
      'Si Mistik': 'mistik',
      'Si Santai': 'bapack'
    };
    const personaKey = personaMap[targetUser.persona] || 'roaster';
    const personaReply = generateCompanionReply(personaKey, cleanMsg, req.user.full_name || req.user.username);

    // Insert persona reply as bot message representing the friend
    const botMsgRes = db.prepare(`
      INSERT INTO messages (user_id, target_user_id, sender, text)
      VALUES (?, ?, 'bot', ?)
    `).run(targetId, myId, personaReply);

    const xpResult = addXpToUser(myId, 5);
    logActivity(myId, 'CHAT_USER', `Mengobrol dengan @${targetUser.username}`, req.ip);

    res.json({
      userMessage: {
        id: userMsgRes.lastInsertRowid,
        user_id: myId,
        target_user_id: targetId,
        sender: 'user',
        text: cleanMsg,
        created_at: new Date().toISOString()
      },
      botReply: {
        id: botMsgRes.lastInsertRowid,
        user_id: targetId,
        target_user_id: myId,
        sender: 'bot',
        text: personaReply,
        created_at: new Date().toISOString()
      },
      xp: xpResult
    });
  } catch (err) {
    console.error('User chat error:', err);
    res.status(500).json({ error: 'Gagal mengirim pesan ke pengguna.' });
  }
});

// ==========================================
// 3. AI COMPANION BOTS (SEPARATE DEDICATED FEATURE)
// ==========================================

// List Companions
app.get('/api/companions', (req, res) => {
  res.json({ companions: Object.values(COMPANIONS) });
});

// Get Chat History with an AI Companion
app.get('/api/chat/:characterId', requireAuth, (req, res) => {
  try {
    const { characterId } = req.params;
    const messages = db.prepare(`
      SELECT id, sender, text, sentiment, created_at
      FROM messages
      WHERE user_id = ? AND character_id = ? AND target_user_id IS NULL
      ORDER BY id ASC
      LIMIT 100
    `).all(req.user.user_id, characterId);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat riwayat obrolan AI.' });
  }
});

// Send Message to AI Companion
app.post('/api/chat/:characterId', requireAuth, (req, res) => {
  try {
    const { characterId } = req.params;
    const { message } = req.body;

    if (req.user.status === 'muted') {
      return res.status(403).json({ error: 'Akun Anda sedang dibisukan (muted) oleh Admin. Anda tidak dapat mengirim pesan.' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong!' });
    }

    const cleanMsg = message.trim();

    // 1. Insert user message to SQL
    const userMsgRes = db.prepare(`
      INSERT INTO messages (user_id, character_id, sender, text)
      VALUES (?, ?, 'user', ?)
    `).run(req.user.user_id, characterId, cleanMsg);

    // 2. Generate personality reply
    const botReplyText = generateCompanionReply(characterId, cleanMsg, req.user.full_name || req.user.username);

    // 3. Insert bot reply to SQL
    const botMsgRes = db.prepare(`
      INSERT INTO messages (user_id, character_id, sender, text)
      VALUES (?, ?, 'bot', ?)
    `).run(req.user.user_id, characterId, botReplyText);

    // 4. Reward Friendship XP (+5 XP)
    const xpResult = addXpToUser(req.user.user_id, 5);

    logActivity(req.user.user_id, 'CHAT_AI', `Mengobrol dengan AI bot: ${characterId}`, req.ip);

    res.json({
      userMessage: {
        id: userMsgRes.lastInsertRowid,
        sender: 'user',
        text: cleanMsg,
        created_at: new Date().toISOString()
      },
      botReply: {
        id: botMsgRes.lastInsertRowid,
        sender: 'bot',
        text: botReplyText,
        created_at: new Date().toISOString()
      },
      xp: xpResult
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Gagal memproses pesan AI.' });
  }
});

// Clear Personal Chat History with AI Companion
app.delete('/api/chat/:characterId', requireAuth, (req, res) => {
  try {
    const { characterId } = req.params;
    db.prepare('DELETE FROM messages WHERE user_id = ? AND character_id = ? AND target_user_id IS NULL').run(req.user.user_id, characterId);
    res.json({ message: 'Riwayat obrolan berhasil dibersihkan.' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus obrolan.' });
  }
});

// ==========================================
// 4. MOOD TRACKER & CURHAT JOURNAL
// ==========================================

app.get('/api/mood', requireAuth, (req, res) => {
  try {
    const moods = db.prepare(`
      SELECT id, mood_type, note, created_at
      FROM mood_logs
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 30
    `).all(req.user.user_id);
    res.json({ moods });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat catatan mood.' });
  }
});

app.post('/api/mood', requireAuth, (req, res) => {
  try {
    const { mood_type, note } = req.body;
    if (!mood_type) {
      return res.status(400).json({ error: 'Pilih jenis suasana hatimu!' });
    }

    db.prepare('INSERT INTO mood_logs (user_id, mood_type, note) VALUES (?, ?, ?)').run(
      req.user.user_id,
      mood_type,
      note || ''
    );

    // Reward XP (+15 XP for self-care mood logging)
    const xpResult = addXpToUser(req.user.user_id, 15);
    logActivity(req.user.user_id, 'MOOD_LOG', `Mencatat mood: ${mood_type}`, req.ip);

    const quotes = {
      senang: 'Senyumanmu membawa energi positif ke seluruh server! Terus sebarkan kebahagiaan ya! ☀️✨',
      sedih: 'Hujan selalu reda pada waktunya. Tetap kuat ya, kamu tidak sendirian 🌸🌧️',
      galau: 'Terkadang jeda sejenak adalah cara terbaik menemukan arah baru. Tarik nafas dan tersenyumlah 🍃',
      ambis: 'Fokus dan disiplinmu akan membawamu ke puncak impian! Gaspol terus! ⚡🚀',
      lelah: 'Istirahatlah malam ini, besok kita mulai lembaran baru yang lebih cerah 🌙🛌',
      marah: 'Minum segelas air dingin dan dengarkan lagu santai. Hatimu terlalu berharga untuk amarah 🧊💙'
    };

    res.json({
      message: 'Mood kamu berhasil dicatat!',
      affirmation: quotes[mood_type] || 'Semangat selalu menjalani harimu!',
      xp: xpResult
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mencatat mood.' });
  }
});

// ==========================================
// 5. COMMUNITY HANGOUT LOUNGE
// ==========================================

app.get('/api/hangout', (req, res) => {
  try {
    const user = getAuthUser(req);
    const userId = user ? user.user_id : 0;

    const posts = db.prepare(`
      SELECT p.id, p.content, p.likes_count, p.tag, p.created_at,
             u.username, u.full_name, u.avatar, u.friendship_level,
             (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) as user_has_liked
      FROM community_posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
      LIMIT 50
    `).all(userId);

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat postingan lounge.' });
  }
});

app.post('/api/hangout', requireAuth, (req, res) => {
  try {
    if (req.user.status === 'muted') {
      return res.status(403).json({ error: 'Akun Anda sedang dibisukan (muted) oleh Admin. Tidak dapat memposting.' });
    }

    const { content, tag } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Konten postingan tidak boleh kosong!' });
    }

    const result = db.prepare(`
      INSERT INTO community_posts (user_id, content, tag)
      VALUES (?, ?, ?)
    `).run(req.user.user_id, content.trim(), tag || 'Santai');

    const xpResult = addXpToUser(req.user.user_id, 10);
    logActivity(req.user.user_id, 'COMMUNITY_POST', `Membuat postingan lounge: ${tag}`, req.ip);

    res.json({
      message: 'Postingan lounge berhasil dikirim!',
      postId: result.lastInsertRowid,
      xp: xpResult
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal membuat postingan lounge.' });
  }
});

app.post('/api/hangout/:id/like', requireAuth, (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.user_id;

    const existing = db.prepare('SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ?').get(userId, postId);

    if (existing) {
      db.prepare('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
      db.prepare('UPDATE community_posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(postId);
      res.json({ liked: false });
    } else {
      db.prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
      db.prepare('UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui like.' });
  }
});

// ==========================================
// 6. PUBLIC SYSTEM ANNOUNCEMENT
// ==========================================

app.get('/api/system/announcement', (req, res) => {
  try {
    const active = db.prepare("SELECT value FROM server_settings WHERE key = 'broadcast_active'").get();
    const msg = db.prepare("SELECT value FROM server_settings WHERE key = 'broadcast_message'").get();
    const serverName = db.prepare("SELECT value FROM server_settings WHERE key = 'server_name'").get();

    res.json({
      serverName: serverName?.value || 'TemanVirtual Universe',
      broadcast: active && active.value === 'true' ? (msg?.value || '') : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat status sistem.' });
  }
});

// ==========================================
// 7. ADMIN DASHBOARD & PROTECTED ADMIN APIS
// ==========================================

// Verify Secret Passcode to unlock admin dashboard actions
app.post('/api/admin/verify-passcode', requireAdmin, (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'Password rahasia admin wajib dimasukkan!' });
    }

    const keyRow = db.prepare('SELECT secret_passcode FROM admin_keys ORDER BY id DESC LIMIT 1').get();
    if (!keyRow || keyRow.secret_passcode !== passcode.trim()) {
      logActivity(req.user.user_id, 'ADMIN_ACCESS_FAILED', 'Percobaan memasukkan password admin salah', req.ip);
      return res.status(401).json({ error: 'Password Rahasia Admin SALAH! Akses ditolak.' });
    }

    const adminToken = crypto.randomBytes(24).toString('hex');
    res.cookie('admin_secret_token', adminToken, { maxAge: 2 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });

    logActivity(req.user.user_id, 'ADMIN_UNLOCKED', 'Dashboard Admin berhasil dibuka dengan password khusus', req.ip);

    res.json({
      success: true,
      message: 'Otorisasi Admin Berhasil! Selamat datang di Ruang Kendali.',
      adminToken
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memverifikasi password admin.' });
  }
});

// Check if admin is unlocked
app.get('/api/admin/check-unlock', requireAdmin, (req, res) => {
  const token = req.cookies.admin_secret_token || req.headers['x-admin-secret'];
  if (token) {
    return res.json({ unlocked: true });
  }
  res.json({ unlocked: false });
});

function requireAdminUnlocked(req, res, next) {
  const token = req.cookies.admin_secret_token || req.headers['x-admin-secret'];
  if (!token) {
    return res.status(403).json({ error: 'Dashboard Admin terkunci. Masukkan Password Rahasia Admin terlebih dahulu.' });
  }
  next();
}

// 7.1 Admin: Stats
app.get('/api/admin/stats', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`).get().count;
    const bannedUsers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE status = 'banned'`).get().count;
    const mutedUsers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE status = 'muted'`).get().count;
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const totalMoodLogs = db.prepare('SELECT COUNT(*) as count FROM mood_logs').get().count;
    const totalPosts = db.prepare('SELECT COUNT(*) as count FROM community_posts').get().count;

    const avgStats = db.prepare('SELECT AVG(friendship_level) as avg_level, AVG(friendship_xp) as avg_xp FROM users').get();

    const moodBreakdown = db.prepare(`
      SELECT mood_type, COUNT(*) as count
      FROM mood_logs
      GROUP BY mood_type
      ORDER BY count DESC
    `).all();

    const companionPopularity = db.prepare(`
      SELECT character_id, COUNT(*) as count
      FROM messages
      WHERE sender = 'user' AND character_id IS NOT NULL
      GROUP BY character_id
      ORDER BY count DESC
    `).all();

    const topChatters = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.avatar, u.friendship_level, u.friendship_xp, COUNT(m.id) as message_count
      FROM users u
      LEFT JOIN messages m ON (u.id = m.user_id AND m.sender = 'user')
      GROUP BY u.id
      ORDER BY message_count DESC, u.friendship_xp DESC
      LIMIT 5
    `).all();

    const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        bannedUsers,
        mutedUsers,
        totalMessages,
        totalMoodLogs,
        totalPosts,
        avgLevel: Number((avgStats.avg_level || 1).toFixed(1)),
        avgXp: Math.round(avgStats.avg_xp || 0),
        uptimeSeconds
      },
      moodBreakdown,
      companionPopularity,
      topChatters
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Gagal memuat statistik server.' });
  }
});

// 7.2 Admin: List All Users
app.get('/api/admin/users', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const { search, status, role } = req.query;
    let query = `
      SELECT u.id, u.username, u.full_name, u.role, u.avatar, u.persona, u.bio, u.friendship_level, u.friendship_xp,
             u.status, u.vibes_received, u.created_at, u.last_login,
             (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id AND m.sender = 'user') as total_chats,
             (SELECT COUNT(*) FROM mood_logs ml WHERE ml.user_id = u.id) as total_moods
      FROM users u
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (u.username LIKE ? OR u.full_name LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (status && status !== 'all') {
      query += ` AND u.status = ?`;
      params.push(status);
    }

    if (role && role !== 'all') {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    query += ` ORDER BY u.id DESC`;

    const users = db.prepare(query).all(...params);
    res.json({ users });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar pengguna server.' });
  }
});

// 7.3 Admin: Update User Status (active, muted, banned)
app.put('/api/admin/users/:id/status', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const { status } = req.body;

    if (!['active', 'muted', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid.' });
    }

    if (targetUserId === req.user.user_id && status === 'banned') {
      return res.status(400).json({ error: 'Admin tidak dapat mem-ban akunnya sendiri!' });
    }

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, targetUserId);
    if (status === 'banned') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
    }

    logActivity(req.user.user_id, 'USER_STATUS_CHANGE', `Mengubah status user #${targetUserId} menjadi ${status}`, req.ip);
    res.json({ message: `Status pengguna berhasil diubah menjadi: ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui status user.' });
  }
});

// 7.4 Admin: Update User Role (admin / user)
app.put('/api/admin/users/:id/role', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid.' });
    }

    if (targetUserId === req.user.user_id && role === 'user') {
      return res.status(400).json({ error: 'Anda tidak dapat menurunkan hak admin Anda sendiri.' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetUserId);
    logActivity(req.user.user_id, 'USER_ROLE_CHANGE', `Mengubah role user #${targetUserId} menjadi ${role}`, req.ip);
    res.json({ message: `Role pengguna berhasil diubah menjadi: ${role}` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui role user.' });
  }
});

// 7.5 Admin: Reset User Password
app.post('/api/admin/users/:id/reset-password', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const { new_password } = req.body;

    const pass = (new_password || 'user123456').trim();
    if (pass.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
    }

    const auth = hashPassword(pass);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(auth.hash, auth.salt, targetUserId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);

    logActivity(req.user.user_id, 'USER_PASSWORD_RESET', `Mereset password user #${targetUserId}`, req.ip);
    res.json({ message: `Password berhasil direset menjadi: "${pass}"` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mereset password pengguna.' });
  }
});

// 7.6 Admin: Delete User (CLEANS ALL ASSOCIATED DATA THOROUGHLY)
app.delete('/api/admin/users/:id', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);

    if (targetUserId === req.user.user_id) {
      return res.status(400).json({ error: 'Admin tidak dapat menghapus akunnya sendiri!' });
    }

    // Clean up all tables referencing this user
    db.prepare('DELETE FROM messages WHERE user_id = ? OR target_user_id = ?').run(targetUserId, targetUserId);
    db.prepare('DELETE FROM mood_logs WHERE user_id = ?').run(targetUserId);
    db.prepare('DELETE FROM post_likes WHERE user_id = ?').run(targetUserId);
    db.prepare('DELETE FROM community_posts WHERE user_id = ?').run(targetUserId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);

    logActivity(req.user.user_id, 'USER_DELETE', `Menghapus user #${targetUserId} secara permanen`, req.ip);
    res.json({ message: 'Pengguna berhasil dihapus secara permanen dari server!' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Gagal menghapus pengguna.' });
  }
});

// 7.7 Admin: Broadcast Notification Tool
app.post('/api/admin/broadcast', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const { message, active } = req.body;

    db.prepare("UPDATE server_settings SET value = ? WHERE key = 'broadcast_message'").run(message || '');
    db.prepare("UPDATE server_settings SET value = ? WHERE key = 'broadcast_active'").run(active ? 'true' : 'false');

    logActivity(req.user.user_id, 'ADMIN_BROADCAST', `Memperbarui pengumuman server: "${message}" (Aktif: ${active})`, req.ip);
    res.json({ message: 'Pengumuman broadcast server berhasil diperbarui!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui broadcast.' });
  }
});

// 7.8 Admin: Server Settings
app.get('/api/admin/settings', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM server_settings').all();
    const map = {};
    for (const s of settings) map[s.key] = s.value;
    res.json({ settings: map });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat pengaturan server.' });
  }
});

app.put('/api/admin/settings', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const { maintenance_mode, allow_registration, server_name } = req.body;

    if (maintenance_mode !== undefined) {
      db.prepare("UPDATE server_settings SET value = ? WHERE key = 'maintenance_mode'").run(maintenance_mode ? 'true' : 'false');
    }
    if (allow_registration !== undefined) {
      db.prepare("UPDATE server_settings SET value = ? WHERE key = 'allow_registration'").run(allow_registration ? 'true' : 'false');
    }
    if (server_name) {
      db.prepare("UPDATE server_settings SET value = ? WHERE key = 'server_name'").run(server_name.trim());
    }

    logActivity(req.user.user_id, 'SETTINGS_UPDATE', 'Memperbarui konfigurasi sistem server', req.ip);
    res.json({ message: 'Pengaturan server berhasil disimpan!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan pengaturan.' });
  }
});

// 7.9 Admin: Change Special Admin Password
app.put('/api/admin/change-passcode', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const { new_passcode } = req.body;
    if (!new_passcode || new_passcode.trim().length < 6) {
      return res.status(400).json({ error: 'Password rahasia baru minimal 6 karakter!' });
    }

    db.prepare('UPDATE admin_keys SET secret_passcode = ?, updated_at = CURRENT_TIMESTAMP').run(new_passcode.trim());
    logActivity(req.user.user_id, 'PASSCODE_CHANGE', 'Mengubah password rahasia khusus admin', req.ip);

    res.json({ message: 'Password rahasia khusus admin berhasil diubah!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengubah password admin.' });
  }
});

// 7.10 Admin: Audit Activity Logs
app.get('/api/admin/logs', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.id, l.action, l.details, l.ip_address, l.created_at,
             u.username, u.full_name, u.avatar
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.id DESC
      LIMIT 100
    `).all();

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat log aktivitas.' });
  }
});

// 7.11 Admin: Clean Messages
app.post('/api/admin/clean-chats', requireAdmin, requireAdminUnlocked, (req, res) => {
  try {
    const { keep_recent } = req.body;
    if (keep_recent) {
      db.exec(`
        DELETE FROM messages
        WHERE id NOT IN (
          SELECT id FROM messages ORDER BY id DESC LIMIT 50
        )
      `);
    } else {
      db.exec('DELETE FROM messages');
    }
    logActivity(req.user.user_id, 'CLEAN_CHATS', 'Membersihkan riwayat obrolan server', req.ip);
    res.json({ message: 'Pembersihan obrolan selesai!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal membersihkan obrolan.' });
  }
});

// Admin dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback to index.html for client navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Virtual Teman Server running on http://localhost:${PORT}`);
  console.log(`🛡️  Admin Dashboard accessible at http://localhost:${PORT}/admin`);
  console.log(`🔑 Default Admin Credentials:`);
  console.log(`   - Username: admin`);
  console.log(`   - Password: admin123`);
  console.log(`   - Secret Admin Passcode: SUPERADMIN2026`);
  console.log(`=======================================================`);
});
