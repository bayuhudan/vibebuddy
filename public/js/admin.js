// Admin Dashboard Client Logic
let moodChartInstance = null;
let companionChartInstance = null;
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await verifyAdminSession();
});

// Verify if user is logged in as admin
async function verifyAdminSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (!res.ok || !data.user || data.user.role !== 'admin') {
      showLockError('Akses Ditolak: Anda belum login sebagai Admin. Silakan login dengan akun admin terlebih dahulu.');
      document.getElementById('passcodeForm').classList.add('hidden');
      return;
    }

    // Check if unlocked already
    const unlockRes = await fetch('/api/admin/check-unlock');
    const unlockData = await unlockRes.json();

    if (unlockData.unlocked) {
      unlockDashboardView();
      initDashboard();
    } else {
      document.getElementById('adminLockScreen').classList.remove('hidden');
    }
  } catch (err) {
    showLockError('Gagal memverifikasi status admin.');
  }
}

function showLockError(msg) {
  const alertEl = document.getElementById('lockScreenAuthAlert');
  alertEl.innerText = msg;
  alertEl.classList.remove('hidden');
}

function togglePassVisibility() {
  const input = document.getElementById('adminSecretInput');
  const icon = document.getElementById('passVisibilityIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// Handle Admin Master Passcode Verification
async function handleVerifyPasscode(e) {
  e.preventDefault();
  const passcode = document.getElementById('adminSecretInput').value;
  const alertEl = document.getElementById('lockScreenAuthAlert');
  alertEl.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/verify-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    const data = await res.json();

    if (!res.ok) {
      alertEl.innerText = data.error || 'Password Khusus Admin Salah!';
      alertEl.classList.remove('hidden');
      return;
    }

    unlockDashboardView();
    initDashboard();
  } catch (err) {
    alertEl.innerText = 'Gagal menghubungi server.';
    alertEl.classList.remove('hidden');
  }
}

function unlockDashboardView() {
  document.getElementById('adminLockScreen').classList.add('hidden');
}

function lockAdminDashboard() {
  document.cookie = 'admin_secret_token=; Max-Age=0; path=/;';
  location.reload();
}

async function adminLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function forceAdminLoginModal() {
  window.location.href = '/';
}

// ==========================================
// DASHBOARD INITIALIZATION
// ==========================================

async function initDashboard() {
  await Promise.all([
    loadStats(),
    loadUsersTable(),
    loadServerSettings(),
    loadAuditLogs()
  ]);
}

async function refreshDashboardData() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.classList.add('fa-spin');

  await initDashboard();

  setTimeout(() => {
    if (icon) icon.classList.remove('fa-spin');
  }, 500);
}

// 1. LOAD STATISTICS & CHARTS
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();

    if (!res.ok) return;

    const { overview, moodBreakdown, companionPopularity, topChatters } = data;

    // Update KPI cards
    document.getElementById('statTotalUsers').innerText = overview.totalUsers;
    document.getElementById('statActiveRatio').innerText = `${overview.activeUsers} Aktif`;
    document.getElementById('statBannedUsers').innerText = `${overview.bannedUsers} Banned`;
    document.getElementById('statMutedUsers').innerText = `${overview.mutedUsers} Muted`;

    document.getElementById('statTotalMessages').innerText = overview.totalMessages.toLocaleString();
    document.getElementById('statTotalMoods').innerText = overview.totalMoodLogs;
    document.getElementById('statTotalPosts').innerText = `${overview.totalPosts} Postingan di Lounge`;

    document.getElementById('statAvgLevel').innerText = `Lv. ${overview.avgLevel}`;
    document.getElementById('statAvgXp').innerText = `${overview.avgXp} XP Rata-rata`;

    // Format uptime
    const hours = Math.floor(overview.uptimeSeconds / 3600);
    const mins = Math.floor((overview.uptimeSeconds % 3600) / 60);
    const secs = overview.uptimeSeconds % 60;
    document.getElementById('statServerUptime').innerText = `Uptime: ${hours}j ${mins}m ${secs}d`;

    // Render Charts
    renderMoodChart(moodBreakdown);
    renderCompanionChart(companionPopularity);
    renderTopChatters(topChatters);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Render Mood Distribution Doughnut Chart
function renderMoodChart(moodData) {
  const ctx = document.getElementById('moodChart').getContext('2d');
  if (moodChartInstance) moodChartInstance.destroy();

  const labels = moodData.map(m => m.mood_type.toUpperCase());
  const counts = moodData.map(m => m.count);

  const colors = {
    SENANG: '#eab308', // yellow
    SEDIH: '#f43f5e',  // rose
    GALAU: '#818cf8',  // indigo
    AMBIS: '#10b981',  // emerald
    LELAH: '#a855f7',  // purple
    MARAH: '#ef4444'   // red
  };

  const bgColors = labels.map(l => colors[l] || '#64748b');

  moodChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Belum Ada Data'],
      datasets: [{
        data: counts.length ? counts : [1],
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      },
      cutout: '70%'
    }
  });
}

// Render Companion Popularity Bar Chart
function renderCompanionChart(companionData) {
  const ctx = document.getElementById('companionChart').getContext('2d');
  if (companionChartInstance) companionChartInstance.destroy();

  const names = {
    roaster: 'Rian (Roaster)',
    melow: 'Bella (Melow)',
    hustle: 'Devan (Ambis)',
    kawaii: 'Hana (Wibu)',
    bapack: 'Pak Budi (Bapack)',
    mistik: 'Ki Ageng (Mistik)'
  };

  const labels = companionData.map(c => names[c.character_id] || c.character_id);
  const counts = companionData.map(c => c.count);

  companionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Belum Ada Chat'],
      datasets: [{
        label: 'Jumlah Obrolan Pengguna',
        data: counts.length ? counts : [0],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 8,
        hoverBackgroundColor: '#818cf8'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8', font: { size: 10 }, stepSize: 1 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Render Top Chatters
function renderTopChatters(users) {
  const container = document.getElementById('topChattersContainer');
  if (!users || users.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400">Belum ada pengguna aktif.</div>';
    return;
  }

  container.innerHTML = users.map((u, i) => `
    <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
      <div class="flex items-center gap-3">
        <span class="w-6 h-6 rounded-full ${i === 0 ? 'bg-amber-500 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-400 font-bold'} flex items-center justify-center text-xs">
          ${i + 1}
        </span>
        <div class="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl">
          ${u.avatar || '🦊'}
        </div>
        <div>
          <p class="font-bold text-xs text-white">${escapeHTML(u.full_name || u.username)} <span class="text-[10px] text-slate-400 font-mono">@${escapeHTML(u.username)}</span></p>
          <p class="text-[10px] text-amber-400 font-semibold">Tingkat Lv. ${u.friendship_level} &bull; ${u.friendship_xp} XP</p>
        </div>
      </div>
      <div class="text-right">
        <span class="text-xs font-bold text-indigo-400 font-mono">${u.message_count || 0} Chat</span>
        <span class="text-[10px] text-slate-500 block">Terkirim</span>
      </div>
    </div>
  `).join('');
}

// ==========================================
// 2. USERS TABLE MANAGEMENT
// ==========================================

function debounceUserSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadUsersTable();
  }, 300);
}

async function loadUsersTable() {
  const search = document.getElementById('userSearchInput').value;
  const status = document.getElementById('userStatusFilter').value;
  const role = document.getElementById('userRoleFilter').value;
  const tbody = document.getElementById('usersTableBody');

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500 text-xs">Memuat data pengguna dari database SQL...</td></tr>';

  try {
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&status=${status}&role=${role}`);
    const data = await res.json();

    if (!res.ok) return;

    const users = data.users || [];
    document.getElementById('userCountSummary').innerText = `Menampilkan ${users.length} pengguna server terdaftar`;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500 text-xs">Tidak ada data pengguna yang cocok.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const statusBadge = {
        active: '<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">AKTIF</span>',
        muted: '<span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-[10px]">MUTED</span>',
        banned: '<span class="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold text-[10px]">BANNED</span>'
      }[u.status] || u.status;

      const roleBadge = u.role === 'admin'
        ? '<span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-[10px]">ADMIN</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px]">USER</span>';

      return `
        <tr class="hover:bg-slate-900/60 transition">
          <td class="p-3.5 font-mono text-slate-400">#${u.id}</td>
          <td class="p-3.5">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base">${u.avatar || '🦊'}</span>
              <div>
                <p class="font-bold text-white text-xs">${escapeHTML(u.full_name || u.username)}</p>
                <p class="text-[10px] text-slate-400 font-mono">@${escapeHTML(u.username)}</p>
              </div>
            </div>
          </td>
          <td class="p-3.5">${roleBadge}</td>
          <td class="p-3.5">
            <span class="font-semibold text-amber-400">Lv. ${u.friendship_level}</span>
            <span class="text-[10px] text-slate-500 font-mono block">${u.friendship_xp} XP</span>
          </td>
          <td class="p-3.5">
            <span class="text-indigo-400 font-semibold">${u.total_chats || 0} Chat</span>
            <span class="text-slate-500 text-[10px] block">${u.total_moods || 0} Mood</span>
          </td>
          <td class="p-3.5">${statusBadge}</td>
          <td class="p-3.5 text-slate-400 text-[10px]">
            ${new Date(u.created_at).toLocaleDateString('id-ID')}
          </td>
          <td class="p-3.5 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5">
              <!-- Mute/Unmute -->
              <button onclick="toggleUserMute(${u.id}, '${u.status}')" title="${u.status === 'muted' ? 'Buka Bisukan' : 'Bisukan (Mute)'}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs transition">
                <i class="fa-solid ${u.status === 'muted' ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>
              </button>

              <!-- Ban/Unban -->
              <button onclick="toggleUserBan(${u.id}, '${u.status}')" title="${u.status === 'banned' ? 'Batalkan Banned' : 'Ban Akun'}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs transition">
                <i class="fa-solid ${u.status === 'banned' ? 'fa-user-check' : 'fa-ban'}"></i>
              </button>

              <!-- Toggle Role -->
              <button onclick="toggleUserRole(${u.id}, '${u.role}')" title="Ubah Peran (Role)" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs transition">
                <i class="fa-solid fa-crown"></i>
              </button>

              <!-- Reset Password -->
              <button onclick="openResetPasswordModal(${u.id}, '${escapeHTML(u.username)}')" title="Reset Password" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition">
                <i class="fa-solid fa-key"></i>
              </button>

              <!-- Delete User -->
              <button onclick="deleteUser(${u.id}, '${escapeHTML(u.username)}')" title="Hapus Pengguna Permanen" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 text-xs transition">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-rose-400 text-xs">Gagal memuat pengguna.</td></tr>';
  }
}

// 2.1 User Actions
async function toggleUserMute(userId, currentStatus) {
  const newStatus = currentStatus === 'muted' ? 'active' : 'muted';
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      loadUsersTable();
      loadStats();
      loadAuditLogs();
    }
  } catch (err) {}
}

async function toggleUserBan(userId, currentStatus) {
  const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
  if (newStatus === 'banned' && !confirm('Yakin ingin mem-ban akun ini? Pengguna tidak akan bisa login ke server.')) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      loadUsersTable();
      loadStats();
      loadAuditLogs();
    }
  } catch (err) {}
}

async function toggleUserRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  if (!confirm(`Ubah peran user #${userId} menjadi "${newRole.toUpperCase()}"?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    if (res.ok) {
      loadUsersTable();
      loadAuditLogs();
    }
  } catch (err) {}
}

function openResetPasswordModal(userId, username) {
  document.getElementById('resetTargetUserId').value = userId;
  document.getElementById('resetModalSub').innerText = `Reset password untuk @${username}`;
  document.getElementById('resetNewPassInput').value = 'pass123456';
  document.getElementById('resetUserPassModal').classList.remove('hidden');
}

function closeResetUserPassModal() {
  document.getElementById('resetUserPassModal').classList.add('hidden');
}

async function handleExecuteResetPassword(e) {
  e.preventDefault();
  const userId = document.getElementById('resetTargetUserId').value;
  const new_password = document.getElementById('resetNewPassInput').value;

  try {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || 'Password berhasil direset!');
      closeResetUserPassModal();
      loadAuditLogs();
    } else {
      alert(data.error || 'Gagal reset password.');
    }
  } catch (err) {}
}

async function deleteUser(userId, username) {
  if (!confirm(`PERINGATAN: Apakah Anda yakin ingin MENGHAPUS PERMANEN akun @${username} beserta seluruh data riwayatnya?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      loadUsersTable();
      loadStats();
      loadAuditLogs();
    } else {
      alert(data.error || 'Gagal menghapus pengguna.');
    }
  } catch (err) {}
}

// ==========================================
// 3. SERVER SETTINGS & BROADCAST
// ==========================================

async function loadServerSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    if (res.ok && data.settings) {
      document.getElementById('toggleMaintenance').checked = data.settings.maintenance_mode === 'true';
      document.getElementById('toggleRegistration').checked = data.settings.allow_registration === 'true';
      document.getElementById('broadcastInput').value = data.settings.broadcast_message || '';
      document.getElementById('broadcastActiveCheckbox').checked = data.settings.broadcast_active === 'true';
    }
  } catch (err) {}
}

async function updateServerSettings() {
  const maintenance = document.getElementById('toggleMaintenance').checked;
  const allowReg = document.getElementById('toggleRegistration').checked;

  try {
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maintenance_mode: maintenance,
        allow_registration: allowReg
      })
    });
    loadAuditLogs();
  } catch (err) {}
}

function openBroadcastModal() {
  document.getElementById('broadcastModal').classList.remove('hidden');
}

function closeBroadcastModal() {
  document.getElementById('broadcastModal').classList.add('hidden');
}

async function handleSaveBroadcast(e) {
  e.preventDefault();
  const message = document.getElementById('broadcastInput').value.trim();
  const active = document.getElementById('broadcastActiveCheckbox').checked;

  try {
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, active })
    });
    if (res.ok) {
      alert('Broadcast pengumuman berhasil disimpan dan disebarkan ke web!');
      closeBroadcastModal();
      loadAuditLogs();
    }
  } catch (err) {}
}

function openChangePasscodeModal() {
  document.getElementById('newAdminPasscodeInput').value = '';
  document.getElementById('changePasscodeModal').classList.remove('hidden');
}

function closeChangePasscodeModal() {
  document.getElementById('changePasscodeModal').classList.add('hidden');
}

async function handleChangePasscode(e) {
  e.preventDefault();
  const new_passcode = document.getElementById('newAdminPasscodeInput').value.trim();

  try {
    const res = await fetch('/api/admin/change-passcode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_passcode })
    });
    const data = await res.json();

    if (res.ok) {
      alert('Password rahasia khusus admin berhasil diperbarui! Catat password baru ini baik-baik.');
      closeChangePasscodeModal();
      loadAuditLogs();
    } else {
      alert(data.error || 'Gagal mengubah password.');
    }
  } catch (err) {}
}

async function cleanServerChats() {
  if (!confirm('Apakah Anda ingin membersihkan obrolan lama di server? (Menyimpan 50 chat terbaru untuk penghematan memori)')) return;

  try {
    const res = await fetch('/api/admin/clean-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep_recent: true })
    });
    if (res.ok) {
      alert('Pembersihan obrolan berhasil dieksekusi.');
      loadStats();
      loadAuditLogs();
    }
  } catch (err) {}
}

// ==========================================
// 4. AUDIT LOGS
// ==========================================

async function loadAuditLogs() {
  const container = document.getElementById('auditLogsContainer');
  try {
    const res = await fetch('/api/admin/logs');
    const data = await res.json();

    if (!res.ok) return;

    const logs = data.logs || [];
    if (logs.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500">Belum ada riwayat aktivitas.</div>';
      return;
    }

    container.innerHTML = logs.map(l => {
      const actionColors = {
        LOGIN: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        REGISTER: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        CHAT: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        MOOD_LOG: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        ADMIN_UNLOCKED: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
        USER_STATUS_CHANGE: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        SETTINGS_UPDATE: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
      };
      const badgeClass = actionColors[l.action] || 'text-slate-400 bg-slate-800 border-slate-700';

      return `
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${l.action}</span>
            <span class="text-white font-medium">${escapeHTML(l.details || '')}</span>
            ${l.username ? `<span class="text-slate-400 text-[10px] font-mono">(@${escapeHTML(l.username)})</span>` : ''}
          </div>
          <div class="text-right shrink-0">
            <span class="text-[10px] text-slate-500 font-mono">${new Date(l.created_at).toLocaleTimeString()}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {}
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
