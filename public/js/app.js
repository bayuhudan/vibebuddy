// App Client Logic for Virtual Teman Web
let currentUser = null;
let currentChatTarget = null; // Can be a bot object or a user object
let chatMode = 'user'; // 'user' or 'bot'
let selectedMood = 'senang';
let soundEnabled = true;

// Level titles
const LEVEL_TITLES = {
  1: 'Kenalan Baru',
  2: 'Teman Sapa',
  3: 'Teman Nongkrong',
  4: 'Sahabat Dekat',
  5: 'Bestie Sejati',
  6: 'Soulmate Server'
};

// Simple synthesized web audio chimes
function playChime(type = 'receive') {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'send') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'receive') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'levelup' || type === 'vibe') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.1, ctx.currentTime + (i * 0.08));
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i * 0.08) + 0.15);
        o.start(ctx.currentTime + (i * 0.08));
        o.stop(ctx.currentTime + (i * 0.08) + 0.15);
      });
    }
  } catch (e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundToggleBtn');
  if (btn) {
    btn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark text-slate-500"></i>';
  }
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadServerUsers();
  await loadCompanions();
  await loadAnnouncement();
  loadMoodLogs();
  loadHangoutPosts();
});

// Check current login state
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (res.ok && data.user) {
      currentUser = data.user;
      renderLoggedInUI();
    } else {
      currentUser = null;
      renderLoggedOutUI();
    }
  } catch (err) {
    currentUser = null;
    renderLoggedOutUI();
  }
}

function renderLoggedInUI() {
  document.getElementById('authArea').classList.add('hidden');
  document.getElementById('userDropdown').classList.remove('hidden');
  document.getElementById('userLevelPill').classList.remove('hidden');
  document.getElementById('userLevelPill').classList.add('flex');

  document.getElementById('navUserAvatar').innerText = currentUser.avatar || '🦊';
  document.getElementById('navUserName').innerText = currentUser.full_name || currentUser.username;
  document.getElementById('dropdownFullName').innerText = currentUser.full_name || currentUser.username;
  document.getElementById('dropdownRole').innerText = currentUser.role === 'admin' ? '🛡️ Administrator' : 'Member Server';

  const adminLink = document.getElementById('adminDashboardLink');
  if (adminLink) {
    if (currentUser.role === 'admin') {
      adminLink.classList.remove('hidden');
    } else {
      adminLink.classList.add('hidden');
    }
  }

  updateLevelUI(currentUser.friendship_level, currentUser.friendship_xp);
}

function renderLoggedOutUI() {
  document.getElementById('authArea').classList.remove('hidden');
  document.getElementById('userDropdown').classList.add('hidden');
  document.getElementById('userLevelPill').classList.add('hidden');
  document.getElementById('userLevelPill').classList.remove('flex');
}

function updateLevelUI(level, xp) {
  const lvlBadge = document.getElementById('levelBadge');
  const xpBar = document.getElementById('xpBar');
  const xpText = document.getElementById('xpText');

  if (lvlBadge) lvlBadge.innerText = `Lv. ${level}`;
  if (xpText) xpText.innerText = `${xp} XP`;

  const thresholds = [0, 50, 150, 350, 700, 1200];
  const curMin = thresholds[Math.min(level - 1, thresholds.length - 1)];
  const curMax = thresholds[Math.min(level, thresholds.length - 1)] || 1500;
  const pct = Math.min(100, Math.max(10, Math.round(((xp - curMin) / (curMax - curMin)) * 100)));

  if (xpBar) xpBar.style.width = `${pct}%`;
}

// Announcements
async function loadAnnouncement() {
  try {
    const res = await fetch('/api/system/announcement');
    const data = await res.json();
    if (data.broadcast) {
      document.getElementById('broadcastText').innerText = data.broadcast;
      document.getElementById('broadcastBanner').classList.remove('hidden');
    }
  } catch (e) {}
}

function dismissBanner() {
  document.getElementById('broadcastBanner').classList.add('hidden');
}

// ==========================================
// 1. REAL SERVER USERS (BERANDA UTAMA)
// ==========================================

async function loadServerUsers() {
  const container = document.getElementById('serverUsersContainer');
  const counter = document.getElementById('usersCounterBadge');
  const refreshIcon = document.getElementById('refreshUsersIcon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const users = data.users || [];

    // Filter out users if needed, or show all registered users
    // If only admin exists, show regular members count
    const regularUsers = users.filter(u => u.role !== 'admin');
    if (counter) counter.innerText = regularUsers.length;

    if (regularUsers.length === 0) {
      // CLEAN EMPTY STATE (KOSONG!)
      container.innerHTML = `
        <div class="glass-panel p-8 sm:p-12 rounded-3xl border border-dashed border-slate-700/80 text-center max-w-xl mx-auto my-6">
          <div class="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-3xl flex items-center justify-center mx-auto mb-4 text-indigo-400">
            📭
          </div>
          <h3 class="text-xl font-bold font-heading text-white mb-2">Belum Ada Teman Terdaftar di Server</h3>
          <p class="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">
            Server ini masih bersih dan belum ada pengguna baru yang mendaftar. Begitu ada pengguna yang mendaftar, kartu teman virtual mereka akan otomatis tampil di beranda ini!
          </p>
          <button onclick="openAuthModal('register')" class="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition inline-flex items-center gap-2">
            <i class="fa-solid fa-user-plus"></i> Daftar Akun & Jadi Teman Pertama
          </button>
        </div>
      `;
    } else {
      // RENDER REAL REGISTERED USERS
      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${regularUsers.map(u => {
            const isMe = currentUser && currentUser.id === u.id;
            return `
              <div class="glass-panel glass-panel-hover rounded-3xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
                <div>
                  <div class="flex items-start justify-between mb-4">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition duration-300 shadow-md">
                      ${u.avatar || '🦊'}
                    </div>
                    <div class="flex flex-col items-end gap-1">
                      <span class="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                        ${escapeHTML(u.persona || 'Si Santai')}
                      </span>
                      ${isMe ? '<span class="text-[9px] px-2 py-0.2 rounded-full bg-indigo-600 text-white font-bold">AKUN SAYA</span>' : ''}
                    </div>
                  </div>

                  <div class="mb-4">
                    <div class="flex items-baseline gap-2">
                      <h3 class="text-lg font-bold font-heading text-white group-hover:text-indigo-300 transition">
                        ${escapeHTML(u.full_name || u.username)}
                      </h3>
                    </div>
                    <p class="text-xs text-indigo-400 font-mono mb-2">@${escapeHTML(u.username)}</p>
                    <p class="text-xs text-slate-300 line-clamp-2 italic mb-3">"${escapeHTML(u.bio || 'Halo! Saya ada di server ini.')}"</p>

                    <div class="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                      <div>
                        <span class="text-[10px] block text-slate-500 uppercase font-semibold">Level</span>
                        <span class="text-amber-400 font-bold">Lv. ${u.friendship_level}</span>
                      </div>
                      <div>
                        <span class="text-[10px] block text-slate-500 uppercase font-semibold">XP</span>
                        <span class="text-indigo-300 font-mono">${u.friendship_xp}</span>
                      </div>
                      <div>
                        <span class="text-[10px] block text-slate-500 uppercase font-semibold">Sapaan</span>
                        <span class="text-pink-300 font-mono">${u.vibes_received || 0} ✨</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                  <button onclick="openUserChatModal(${u.id})" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                    <i class="fa-solid fa-comment-dots"></i> Ajak Ngobrol
                  </button>
                  <button onclick="sendVibeToUser(${u.id})" title="Kirim Sapaan Virtual (+5 XP)" class="p-2.5 rounded-xl bg-slate-800 hover:bg-pink-900/40 text-pink-400 border border-slate-700 text-xs transition">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = '<div class="text-center text-xs text-rose-400 py-6">Gagal memuat pengguna server.</div>';
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('fa-spin'), 300);
    }
  }
}

// Send Virtual Vibe (Sapaan / High Five)
async function sendVibeToUser(userId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`/api/users/${userId}/vibe`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Gagal mengirim sapaan.');
      return;
    }

    playChime('vibe');
    alert(`✨ Sapaan Virtual Terkirim!\n${data.message}`);

    if (data.xp) {
      currentUser.friendship_level = data.xp.level;
      currentUser.friendship_xp = data.xp.xp;
      updateLevelUI(data.xp.level, data.xp.xp);
    }

    loadServerUsers();
  } catch (err) {}
}

// Open Chat with a Registered User
async function openUserChatModal(userId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  chatMode = 'user';

  try {
    const res = await fetch(`/api/chat/user/${userId}`);
    const data = await res.json();

    if (!res.ok || !data.targetUser) {
      alert(data.error || 'Pengguna tidak ditemukan.');
      return;
    }

    const friend = data.targetUser;
    currentChatTarget = friend;

    // Set modal header
    document.getElementById('modalCharAvatar').innerText = friend.avatar || '🦊';
    document.getElementById('modalCharName').innerText = friend.full_name || friend.username;
    document.getElementById('modalCharBadge').innerText = friend.persona || 'Teman Server';
    document.getElementById('modalCharStatus').innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Anggota Terdaftar (@${escapeHTML(friend.username)})`;
    document.getElementById('typingCharName').innerText = (friend.full_name || friend.username).split(' ')[0];

    // Quick prompts for friend
    const friendPrompts = [
      'Halo! Salam kenal ya 👋',
      'Lagi sibuk apa hari ini?',
      'Boleh curhat santai gak?',
      'Rekomendasi lagu santai dong!'
    ];
    document.getElementById('modalQuickPrompts').innerHTML = friendPrompts.map(p => `
      <button onclick="sendQuickPrompt('${encodeURIComponent(p)}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-200 hover:text-white border border-slate-700 text-xs transition">
        ${p}
      </button>
    `).join('');

    // Messages
    const container = document.getElementById('chatMessagesContainer');
    if (data.messages && data.messages.length > 0) {
      container.innerHTML = data.messages.map(m => renderUserMessageBubble(m, friend)).join('');
    } else {
      container.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-2">${friend.avatar || '🦊'}</div>
          <p class="text-sm font-semibold text-slate-200">Mulai percakapan dengan ${escapeHTML(friend.full_name || friend.username)}!</p>
          <p class="text-xs text-slate-400 mt-1">Sapa teman barumu di server ini dan pererat hubungan persahabatan kalian.</p>
        </div>
      `;
    }

    document.getElementById('chatModal').classList.remove('hidden');
    document.getElementById('chatMessageInput').focus();
    scrollChatToBottom();
  } catch (err) {
    alert('Gagal membuka obrolan dengan pengguna.');
  }
}

function renderUserMessageBubble(msg, friend) {
  const isMe = msg.user_id === currentUser.id && msg.sender === 'user';
  const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isMe) {
    return `
      <div class="flex justify-end gap-2 items-end">
        <div class="max-w-[80%] sm:max-w-[70%]">
          <div class="chat-bubble-user text-white p-3.5 text-sm shadow-md whitespace-pre-wrap leading-relaxed">
            ${escapeHTML(msg.text)}
          </div>
          <span class="text-[10px] text-slate-500 block text-right mt-1">${time}</span>
        </div>
        <div class="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-sm text-white shrink-0">
          ${currentUser.avatar || '🦊'}
        </div>
      </div>
    `;
  } else {
    return `
      <div class="flex justify-start gap-2 items-end">
        <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
          ${friend.avatar || '🦊'}
        </div>
        <div class="max-w-[80%] sm:max-w-[70%]">
          <div class="chat-bubble-bot text-slate-100 p-3.5 text-sm shadow-md whitespace-pre-wrap leading-relaxed">
            ${formatBotMarkdown(msg.text)}
          </div>
          <span class="text-[10px] text-slate-500 block text-left mt-1">${time}</span>
        </div>
      </div>
    `;
  }
}

// ==========================================
// 2. AI BOT COMPANIONS (TAB 2)
// ==========================================

let availableCompanions = [];

async function loadCompanions() {
  try {
    const res = await fetch('/api/companions');
    const data = await res.json();
    availableCompanions = data.companions;

    const grid = document.getElementById('companionsGrid');
    grid.innerHTML = availableCompanions.map(c => `
      <div class="glass-panel glass-panel-hover rounded-3xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
        <div>
          <div class="flex items-start justify-between mb-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition duration-300 shadow-md">
              ${c.avatar}
            </div>
            <span class="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              ${c.title}
            </span>
          </div>

          <div class="mb-4">
            <h3 class="text-xl font-bold font-heading text-white group-hover:text-indigo-300 transition mb-1">
              ${c.name}
            </h3>
            <p class="text-xs text-slate-400 italic mb-2">"${c.tagline}"</p>
            <div class="flex items-center gap-1.5 text-xs text-emerald-400">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${c.status}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <button onclick="openBotChatModal('${c.id}')" class="flex-1 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
            <i class="fa-solid fa-robot"></i> Ngobrol Bareng Bot
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed loading companions:', err);
  }
}

async function openBotChatModal(characterId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  chatMode = 'bot';
  const companion = availableCompanions.find(c => c.id === characterId) || availableCompanions[0];
  currentChatTarget = companion;

  // Set modal header
  document.getElementById('modalCharAvatar').innerText = companion.avatar;
  document.getElementById('modalCharName').innerText = companion.name;
  document.getElementById('modalCharBadge').innerText = 'Bot AI ' + companion.title;
  document.getElementById('modalCharStatus').innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ${companion.status}`;
  document.getElementById('typingCharName').innerText = companion.name.split(' ')[0];

  // Set quick prompt chips
  const promptsContainer = document.getElementById('modalQuickPrompts');
  promptsContainer.innerHTML = (companion.quickPrompts || []).map(p => `
    <button onclick="sendQuickPrompt('${encodeURIComponent(p)}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-200 hover:text-white border border-slate-700 text-xs transition">
      ${p}
    </button>
  `).join('');

  document.getElementById('chatModal').classList.remove('hidden');
  document.getElementById('chatMessageInput').focus();

  // Load chat messages
  await loadBotChatHistory(companion.id);
}

async function loadBotChatHistory(characterId) {
  const container = document.getElementById('chatMessagesContainer');
  container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4">Memuat obrolan bot...</div>';

  try {
    const res = await fetch(`/api/chat/${characterId}`);
    const data = await res.json();

    if (data.messages && data.messages.length > 0) {
      container.innerHTML = data.messages.map(m => renderBotMessageBubble(m)).join('');
    } else {
      container.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-2">${currentChatTarget.avatar}</div>
          <p class="text-sm font-semibold text-slate-200">Mulai percakapan dengan ${currentChatTarget.name}!</p>
          <p class="text-xs text-slate-400 mt-1">Sapa atau pilih tombol aksi cepat di atas untuk seru-seruan.</p>
        </div>
      `;
    }
    scrollChatToBottom();
  } catch (err) {
    container.innerHTML = '<div class="text-center text-xs text-rose-400">Gagal memuat pesan.</div>';
  }
}

function renderBotMessageBubble(msg) {
  const isUser = msg.sender === 'user';
  const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return `
      <div class="flex justify-end gap-2 items-end">
        <div class="max-w-[80%] sm:max-w-[70%]">
          <div class="chat-bubble-user text-white p-3.5 text-sm shadow-md whitespace-pre-wrap leading-relaxed">
            ${escapeHTML(msg.text)}
          </div>
          <span class="text-[10px] text-slate-500 block text-right mt-1">${time}</span>
        </div>
        <div class="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-sm text-white shrink-0">
          ${currentUser.avatar || '🦊'}
        </div>
      </div>
    `;
  } else {
    return `
      <div class="flex justify-start gap-2 items-end">
        <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
          ${currentChatTarget ? currentChatTarget.avatar : '🤖'}
        </div>
        <div class="max-w-[80%] sm:max-w-[70%]">
          <div class="chat-bubble-bot text-slate-100 p-3.5 text-sm shadow-md whitespace-pre-wrap leading-relaxed">
            ${formatBotMarkdown(msg.text)}
          </div>
          <span class="text-[10px] text-slate-500 block text-left mt-1">${time}</span>
        </div>
      </div>
    `;
  }
}

function closeChatModal() {
  document.getElementById('chatModal').classList.add('hidden');
  currentChatTarget = null;
}

function scrollChatToBottom() {
  const container = document.getElementById('chatMessagesContainer');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function sendQuickPrompt(encodedPrompt) {
  const prompt = decodeURIComponent(encodedPrompt);
  document.getElementById('chatMessageInput').value = prompt;
  handleSendMessage(new Event('submit'));
}

async function handleSendMessage(e) {
  if (e) e.preventDefault();
  if (!currentChatTarget) return;

  const input = document.getElementById('chatMessageInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  const container = document.getElementById('chatMessagesContainer');
  const tempUserMsg = { sender: 'user', text, created_at: new Date().toISOString() };
  
  if (chatMode === 'user') {
    tempUserMsg.user_id = currentUser.id;
    container.insertAdjacentHTML('beforeend', renderUserMessageBubble(tempUserMsg, currentChatTarget));
  } else {
    container.insertAdjacentHTML('beforeend', renderBotMessageBubble(tempUserMsg));
  }
  
  scrollChatToBottom();
  playChime('send');

  const typing = document.getElementById('typingIndicator');
  typing.classList.remove('hidden');

  try {
    let url = chatMode === 'user'
      ? `/api/chat/user/${currentChatTarget.id}`
      : `/api/chat/${currentChatTarget.id}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    typing.classList.add('hidden');

    if (!res.ok) {
      alert(data.error || 'Gagal mengirim pesan.');
      return;
    }

    if (chatMode === 'user') {
      container.insertAdjacentHTML('beforeend', renderUserMessageBubble(data.botReply, currentChatTarget));
    } else {
      container.insertAdjacentHTML('beforeend', renderBotMessageBubble(data.botReply));
    }
    
    scrollChatToBottom();
    playChime('receive');

    if (data.xp) {
      currentUser.friendship_level = data.xp.level;
      currentUser.friendship_xp = data.xp.xp;
      updateLevelUI(data.xp.level, data.xp.xp);

      if (data.xp.leveledUp) {
        playChime('levelup');
        showLevelUpNotification(data.xp.level);
      }
    }
  } catch (err) {
    typing.classList.add('hidden');
    console.error('Error sending message:', err);
  }
}

function showLevelUpNotification(newLevel) {
  const title = LEVEL_TITLES[newLevel] || 'Sahabat Sejati';
  const alertBox = document.createElement('div');
  alertBox.className = 'fixed top-20 right-6 z-50 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-5 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-bounce';
  alertBox.innerHTML = `
    <span class="text-2xl">🎉</span>
    <div>
      <p class="text-xs uppercase tracking-wider">Level Up Persahabatan!</p>
      <p class="text-sm">Kamu naik ke Level ${newLevel}: ${title}!</p>
    </div>
  `;
  document.body.appendChild(alertBox);
  setTimeout(() => alertBox.remove(), 4000);
}

async function clearCurrentChat() {
  if (!currentChatTarget) return;
  if (!confirm(`Yakin ingin membersihkan riwayat obrolan ini?`)) return;

  if (chatMode === 'bot') {
    try {
      const res = await fetch(`/api/chat/${currentChatTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadBotChatHistory(currentChatTarget.id);
      }
    } catch (err) {}
  } else {
    document.getElementById('chatMessagesContainer').innerHTML = '<div class="text-center text-xs text-slate-500 py-6">Riwayat obrolan dibersihkan.</div>';
  }
}

// ==========================================
// 3. MOOD TRACKER & JURNAL
// ==========================================

function selectMood(mood) {
  selectedMood = mood;
  document.querySelectorAll('.mood-choice').forEach(el => {
    el.classList.remove('border-yellow-500', 'border-indigo-500', 'border-rose-500', 'border-emerald-500', 'border-purple-500', 'border-red-500', 'bg-indigo-600/20');
  });
  const btn = document.getElementById(`moodBtn-${mood}`);
  if (btn) {
    btn.classList.add('border-indigo-500', 'bg-indigo-600/20');
  }
}

async function submitMoodLog() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const noteInput = document.getElementById('moodNoteInput');
  const note = noteInput.value.trim();

  try {
    const res = await fetch('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood_type: selectedMood, note })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Gagal menyimpan catatan mood.');
      return;
    }

    noteInput.value = '';
    alert(`💌 Afirmasi Sahabat Virtual:\n\n"${data.affirmation}"\n\n(+15 XP Persahabatan)`);

    if (data.xp) {
      currentUser.friendship_level = data.xp.level;
      currentUser.friendship_xp = data.xp.xp;
      updateLevelUI(data.xp.level, data.xp.xp);
    }

    loadMoodLogs();
  } catch (err) {
    console.error('Error submitting mood:', err);
  }
}

async function loadMoodLogs() {
  const container = document.getElementById('moodLogsList');
  if (!currentUser) {
    container.innerHTML = '<div class="text-sm text-slate-400 italic">Silakan masuk untuk melihat catatan mood pribadimu.</div>';
    return;
  }

  try {
    const res = await fetch('/api/mood');
    const data = await res.json();

    if (data.moods && data.moods.length > 0) {
      const moodEmojis = { senang: '☀️', sedih: '🌧️', galau: '🍂', ambis: '⚡', lelah: '🌙', marah: '🔥' };
      container.innerHTML = data.moods.map(m => `
        <div class="glass-panel p-4 rounded-2xl border border-slate-800 flex items-start gap-3">
          <span class="text-2xl">${moodEmojis[m.mood_type] || '✨'}</span>
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-bold uppercase tracking-wider text-indigo-400">${m.mood_type}</span>
              <span class="text-[10px] text-slate-500">${new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p class="text-xs text-slate-300">${escapeHTML(m.note || 'Tanpa catatan tambahan.')}</p>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="text-sm text-slate-400 italic">Belum ada catatan suasana hati. Simpan perasaanmu hari ini di atas!</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="text-xs text-rose-400">Gagal memuat riwayat mood.</div>';
  }
}

// ==========================================
// 4. HANGOUT LOUNGE
// ==========================================

async function loadHangoutPosts() {
  const container = document.getElementById('hangoutPostsFeed');
  try {
    const res = await fetch('/api/hangout');
    const data = await res.json();

    if (data.posts && data.posts.length > 0) {
      container.innerHTML = data.posts.map(p => `
        <div class="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-lg">
                ${p.avatar || '🦊'}
              </div>
              <div>
                <p class="font-bold text-xs text-white">${escapeHTML(p.full_name || p.username)} <span class="text-[10px] text-slate-400 font-mono">@${escapeHTML(p.username)}</span></p>
                <span class="text-[10px] text-amber-400 font-semibold">Lv. ${p.friendship_level}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">#${p.tag}</span>
              <span class="text-[10px] text-slate-500">${new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <p class="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">${escapeHTML(p.content)}</p>

          <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <button onclick="togglePostLike(${p.id})" class="flex items-center gap-1.5 ${p.user_has_liked ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-rose-400'} transition">
              <i class="fa-${p.user_has_liked ? 'solid' : 'regular'} fa-heart"></i>
              <span>${p.likes_count || 0}</span>
            </button>
            <span class="text-[10px] text-slate-500">Nongkrong di Server</span>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="text-sm text-slate-400 italic">Belum ada postingan di lounge. Jadilah yang pertama menyapa teman-teman server!</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="text-xs text-rose-400">Gagal memuat feed lounge.</div>';
  }
}

async function submitHangoutPost() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const input = document.getElementById('postContentInput');
  const tagSelect = document.getElementById('postTagSelect');
  const content = input.value.trim();
  const tag = tagSelect.value;

  if (!content) return;

  try {
    const res = await fetch('/api/hangout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tag })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Gagal memposting.');
      return;
    }

    input.value = '';
    loadHangoutPosts();

    if (data.xp) {
      currentUser.friendship_level = data.xp.level;
      currentUser.friendship_xp = data.xp.xp;
      updateLevelUI(data.xp.level, data.xp.xp);
    }
  } catch (err) {
    console.error('Error posting hangout:', err);
  }
}

async function togglePostLike(postId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  try {
    await fetch(`/api/hangout/${postId}/like`, { method: 'POST' });
    loadHangoutPosts();
  } catch (err) {}
}

// ==========================================
// TABS SWITCHER
// ==========================================

function switchTab(tab) {
  document.getElementById('tab-users').classList.add('hidden');
  document.getElementById('tab-bots').classList.add('hidden');
  document.getElementById('tab-mood').classList.add('hidden');
  document.getElementById('tab-hangout').classList.add('hidden');

  document.querySelectorAll('nav button').forEach(b => {
    b.classList.remove('bg-indigo-600', 'text-white', 'shadow');
    b.classList.add('text-slate-300');
  });

  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.remove('hidden');

  const activeBtn = document.getElementById(`nav-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow');
    activeBtn.classList.remove('text-slate-300');
  }

  if (tab === 'users') loadServerUsers();
  if (tab === 'mood') loadMoodLogs();
  if (tab === 'hangout') loadHangoutPosts();
}

// ==========================================
// AUTH MODAL & LOGIC
// ==========================================

function openAuthModal(tab = 'login') {
  document.getElementById('authModal').classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const btnLogin = document.getElementById('authTabLogin');
  const btnReg = document.getElementById('authTabRegister');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    btnLogin.classList.add('bg-indigo-600', 'text-white');
    btnLogin.classList.remove('text-slate-400');
    btnReg.classList.remove('bg-indigo-600', 'text-white');
    btnReg.classList.add('text-slate-400');
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    btnReg.classList.add('bg-indigo-600', 'text-white');
    btnReg.classList.remove('text-slate-400');
    btnLogin.classList.remove('bg-indigo-600', 'text-white');
    btnLogin.classList.add('text-slate-400');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');

  errBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.innerText = data.error || 'Login gagal.';
      errBox.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    closeAuthModal();
    renderLoggedInUI();
    loadServerUsers();
    loadMoodLogs();
    loadHangoutPosts();
  } catch (err) {
    errBox.innerText = 'Terjadi kesalahan jaringan.';
    errBox.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const avatar = document.querySelector('input[name="regAvatar"]:checked')?.value || '🦊';
  const persona = document.getElementById('regPersona').value;
  const bio = document.getElementById('regBio').value.trim();
  const errBox = document.getElementById('registerError');

  errBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, password, avatar, persona, bio })
    });
    const data = await res.json();

    if (!res.ok) {
      errBox.innerText = data.error || 'Pendaftaran gagal.';
      errBox.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    closeAuthModal();
    renderLoggedInUI();
    loadServerUsers(); // Refresh users on beranda so new user appears!
    alert('🎉 Pendaftaran berhasil! Akunmu sekarang sudah aktif dan tampil di beranda teman server!');
  } catch (err) {
    errBox.innerText = 'Terjadi kesalahan jaringan.';
    errBox.classList.remove('hidden');
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  toggleProfileDropdown(false);
  renderLoggedOutUI();
  location.reload();
}

function toggleProfileDropdown(force = null) {
  const menu = document.getElementById('dropdownMenu');
  if (force === false) {
    menu.classList.add('hidden');
  } else {
    menu.classList.toggle('hidden');
  }
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('#userDropdown')) {
    toggleProfileDropdown(false);
  }
});

// Profile Modal
function openProfileModal() {
  if (!currentUser) return;
  toggleProfileDropdown(false);

  document.getElementById('profileModalAvatar').innerText = currentUser.avatar || '🦊';
  document.getElementById('profileModalName').innerText = currentUser.full_name || currentUser.username;
  document.getElementById('profileModalUsername').innerText = `@${currentUser.username}`;
  document.getElementById('profileModalPersona').innerText = currentUser.persona || 'Si Santai';
  document.getElementById('profileModalStatus').innerText = currentUser.status;
  document.getElementById('profileModalLevel').innerText = `Level ${currentUser.friendship_level} (${LEVEL_TITLES[currentUser.friendship_level] || 'Sahabat'})`;
  document.getElementById('profileModalXp').innerText = `${currentUser.friendship_xp} XP`;
  document.getElementById('profileModalVibes').innerText = `${currentUser.vibes_received || 0} ✨`;

  document.getElementById('editFullName').value = currentUser.full_name || '';
  document.getElementById('editPersona').value = currentUser.persona || 'Si Santai';
  document.getElementById('editBio').value = currentUser.bio || '';

  document.getElementById('profileModal').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const full_name = document.getElementById('editFullName').value.trim();
  const persona = document.getElementById('editPersona').value;
  const bio = document.getElementById('editBio').value.trim();

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, persona, bio })
    });
    if (res.ok) {
      currentUser.full_name = full_name;
      currentUser.persona = persona;
      currentUser.bio = bio;
      renderLoggedInUI();
      loadServerUsers();
      closeProfileModal();
      alert('Profil berhasil diperbarui!');
    }
  } catch (err) {}
}

function formatBotMarkdown(text) {
  if (!text) return '';
  let str = escapeHTML(text);
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  str = str.replace(/\*(.*?)\*/g, '<strong class="text-white font-bold">$1</strong>');
  return str;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
