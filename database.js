const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const DB_PATH = path.join(__dirname, 'virtual_teman.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Helper for hashing passwords
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === check;
}

// Initialize tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT DEFAULT '🦊',
      persona TEXT DEFAULT 'Si Santai',
      bio TEXT DEFAULT 'Halo! Saya baru gabung di sini.',
      friendship_level INTEGER DEFAULT 1,
      friendship_xp INTEGER DEFAULT 10,
      status TEXT DEFAULT 'active',
      vibes_received INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      secret_passcode TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_user_id INTEGER DEFAULT NULL,
      character_id TEXT DEFAULT 'roaster',
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      sentiment TEXT DEFAULT 'neutral',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mood_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood_type TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      tag TEXT DEFAULT 'Santai',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES community_posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT DEFAULT '127.0.0.1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Ensure persona column exists if table was created previously without it
  try {
    db.exec(`ALTER TABLE users ADD COLUMN persona TEXT DEFAULT 'Si Santai';`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN vibes_received INTEGER DEFAULT 0;`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN target_user_id INTEGER DEFAULT NULL;`);
  } catch (e) {
    // Column already exists
  }

  // Seed default Admin Secret Key if not exists
  const existingKey = db.prepare('SELECT * FROM admin_keys LIMIT 1').get();
  if (!existingKey) {
    db.prepare('INSERT INTO admin_keys (secret_passcode) VALUES (?)').run('SUPERADMIN2026');
  }

  // Seed default server settings
  const defaultSettings = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'allow_registration', value: 'true' },
    { key: 'broadcast_message', value: '🎉 Selamat datang di Teman Virtual Hub! Daftar akun sekarang untuk muncul di beranda server.' },
    { key: 'broadcast_active', value: 'true' },
    { key: 'server_name', value: 'TemanVirtual Universe' }
  ];

  for (const s of defaultSettings) {
    const exists = db.prepare('SELECT 1 FROM server_settings WHERE key = ?').get(s.key);
    if (!exists) {
      db.prepare('INSERT INTO server_settings (key, value) VALUES (?, ?)').run(s.key, s.value);
    }
  }

  // ONLY seed Admin account if no admin exists (ZERO dummy users seeded!)
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const adminAuth = hashPassword('admin123');
    db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, role, avatar, persona, bio, friendship_level, friendship_xp, status)
      VALUES (?, ?, ?, ?, 'admin', '👑', 'Admin Server', 'Server Administrator & Creator', 1, 10, 'active')
    `).run('admin', adminAuth.hash, adminAuth.salt, 'Chief Commander Admin');
    console.log('Admin account created: admin / admin123');
  }
}

// Log action utility
function logActivity(userId, action, details, ip = '127.0.0.1') {
  try {
    db.prepare('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)').run(userId, action, details, ip);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Level system calculation
function addXpToUser(userId, xpToAdd) {
  const user = db.prepare('SELECT friendship_level, friendship_xp FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  let newXp = (user.friendship_xp || 0) + xpToAdd;
  let newLevel = user.friendship_level || 1;

  const thresholds = [0, 50, 150, 350, 700, 1200];
  for (let lv = thresholds.length; lv >= 1; lv--) {
    if (newXp >= thresholds[lv - 1]) {
      newLevel = lv;
      break;
    }
  }

  db.prepare('UPDATE users SET friendship_xp = ?, friendship_level = ? WHERE id = ?').run(newXp, newLevel, userId);
  return { level: newLevel, xp: newXp, leveledUp: newLevel > user.friendship_level };
}

module.exports = {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
  logActivity,
  addXpToUser
};
