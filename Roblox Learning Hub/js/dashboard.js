(() => {
  const shell = document.getElementById('dashboard-view');
  if (!shell) return;
  const currentUser = sessionStorage.getItem('rlc_current_user') || localStorage.getItem('rlc_remembered_user') || '';
  if (currentUser) sessionStorage.setItem('rlc_current_user', currentUser);
  const userKey = (currentUser || 'guest').toLowerCase();
  const getStored = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
  const displayName = currentUser ? (getStored(`rlc_display_name_${userKey}`, currentUser) || currentUser) : 'USERNAME';
  const avatarValue = currentUser ? getStored(`rlc_avatar_${userKey}`, 'avatar-01') : '';
  const authButton = document.getElementById('dashboard-auth-button');
  const setAvatar = (node, value, fallbackText) => {
    if (!node) return;
    node.style.backgroundImage = '';
    node.style.backgroundSize = 'cover';
    node.style.backgroundPosition = 'center';
    node.style.backgroundRepeat = 'no-repeat';
    if (value && value.startsWith('data:')) { node.style.backgroundImage = `url("${value}")`; node.textContent = ''; }
    else if (value && /^avatar-\d{2}$/.test(value)) { node.style.backgroundImage = `url("assets/avatars/${value}.png")`; node.textContent = ''; }
    else node.textContent = fallbackText || 'U';
  };
  shell.classList.toggle('logged-in', Boolean(currentUser));
  shell.classList.toggle('logged-out', !currentUser);
  const welcome = document.getElementById('welcome-name');
  const greeting = document.getElementById('dashboard-greeting');
  if (welcome) welcome.textContent = displayName.toUpperCase();
  if (greeting && !currentUser) {
    greeting.innerHTML = 'Selamat Datang! <span class="wave">👋</span>';
  }
  const profileName = document.getElementById('profile-name'); if (profileName) profileName.textContent = displayName;
  const profileHandle = document.getElementById('profile-handle'); if (profileHandle) profileHandle.textContent = currentUser ? `@${currentUser}` : '@username';
  setAvatar(document.getElementById('avatar'), avatarValue, displayName.charAt(0).toUpperCase());
  if (authButton) authButton.textContent = currentUser ? 'LOGOUT' : 'MASUK/DAFTAR';

  const destinations = { Dashboard: 'dashboard.html', Modul: 'module.html', Leaderboard: 'leaderboard.html', Forum: 'forum.html', Challenges: 'challenges.html', Profile: 'profile.html' };
  const activePage = document.body.dataset.page || 'Dashboard';
  const profileLink = document.getElementById('profile');
  if (profileLink) profileLink.addEventListener('click', () => { window.location.href = 'profile.html'; });
  shell.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.page === activePage);
    const target = destinations[button.dataset.page];
    button.addEventListener('click', () => { if (target) window.location.href = target; });
  });
  if (authButton) authButton.addEventListener('click', () => {
    if (sessionStorage.getItem('rlc_current_user')) { sessionStorage.removeItem('rlc_current_user'); localStorage.removeItem('rlc_remembered_user'); window.location.href = 'dashboard.html'; }
    else window.location.href = 'login.html';
  });

  // Shared module catalog mirrors the module page's existing six cards.
  const modules = [
    { id: 1, category: 'FUNDAMENTAL', name: 'Pengenalan Roblox', description: 'Mengenal platform Roblox dan dasar pengalaman bermain.' },
    { id: 2, category: 'ENVIRONMENT', name: 'Dasar Roblox Studio', description: 'Kenali tools, viewport, dan pengaturan workspace.' },
    { id: 3, category: 'BUILDING', name: 'Membangun Dunia Pertama', description: 'Susun part dan bentuk lingkungan game sederhana.' },
    { id: 4, category: 'SCRIPTING', name: 'Dasar Scripting', description: 'Belajar logika pemrograman Lua untuk membuat interaksi dalam game.' },
    { id: 5, category: 'GAMEPLAY', name: 'Membuat Sistem Gameplay', description: 'Menerapkan scripting untuk membuat mekanik gameplay sederhana.' },
    { id: 6, category: 'PUBLISHING', name: 'Mempublikasikan Game', description: 'Belajar cara mempublikasikan game ke Roblox.' }
  ];
  let completed = [];
  try { completed = JSON.parse(getStored(`rlc_module_lessons_${userKey}`, '[]')); if (!Array.isArray(completed)) completed = []; } catch (_) { completed = []; }
  const startedKey = `rlc_started_lessons_${userKey}`;
  let started = [];
  try { started = JSON.parse(getStored(startedKey, '[]')); if (!Array.isArray(started)) started = []; } catch (_) { started = []; }
  const moduleStats = modules.map(mod => {
    const lessonKeys = ['01', '02', '03'].map(lesson => `${mod.id}-${lesson}`);
    const done = lessonKeys.filter(key => completed.includes(key)).length;
    const startedCount = lessonKeys.filter(key => started.includes(key) || completed.includes(key)).length;
    // Keep Dashboard status identical to module.js: status follows completed lesson progress.
    // Opening a lesson alone must not make a 0% module appear as in progress.
    const progress = Math.round(done / 3 * 100);
    return { ...mod, done, total: 3, progress, startedCount, status: progress === 100 ? 'Selesai' : (progress > 0 ? 'Sedang dipelajari' : 'Belum dimulai') };
  });
  const completedModules = moduleStats.filter(mod => mod.progress === 100).length;
  const activeModules = moduleStats.filter(mod => mod.progress > 0 && mod.progress < 100).length;
  const overall = Math.round(completed.reduce((n, key) => n + (modules.some(mod => key.startsWith(`${mod.id}-`)) ? 1 : 0), 0) / (modules.length * 3) * 100);
  const ring = document.getElementById('dashboard-progress-ring');
  const percent = document.getElementById('dashboard-progress-percent');
  if (percent) percent.textContent = `${overall}%`;
  if (ring) {
    const progressAngle = Math.max(0, Math.min(100, overall)) * 3.6;
    ring.style.background = `radial-gradient(circle at center,#071a2d 58%,transparent 60%),conic-gradient(#1685ff 0deg ${progressAngle}deg,#102d4c ${progressAngle}deg 360deg)`;
    ring.setAttribute('aria-label', `Progress belajar ${overall} persen`);
  }
  const completedLabel = document.getElementById('dashboard-completed-count'); if (completedLabel) completedLabel.textContent = `${completedModules} Modul Selesai`;
  const activeLabel = document.getElementById('dashboard-active-count'); if (activeLabel) activeLabel.textContent = `${activeModules} Sedang Dipelajari`;
  const notStartedLabel = document.getElementById('dashboard-not-started-count'); if (notStartedLabel) notStartedLabel.textContent = `${modules.length - completedModules - activeModules} Belum Dimulai`;

  // Tampilkan bagian Lanjutkan Belajar hanya jika pengguna benar-benar sudah punya progres.
  let last = null;
  try { last = JSON.parse(getStored(`rlc_last_lesson_${userKey}`, 'null')); } catch (_) { last = null; }
  const hasProgress = moduleStats.some(mod => mod.progress > 0);
  const continueSection = document.querySelector('.learning-section[aria-labelledby="continue-title"]');
  const otherSection = document.querySelector('.learning-section.other-modules');
  const otherTitle = document.getElementById('other-modules-title');
  if (continueSection) continueSection.hidden = !hasProgress;

  // Jika sudah ada progres, prioritaskan modul yang sedang dipelajari; jika tidak, jangan tampilkan kartu kosong.
  let continueModule = null;
  if (hasProgress) {
    continueModule = last && moduleStats.find(mod => mod.id === Number(last.moduleId) && mod.progress > 0 && mod.progress < 100);
    if (!continueModule) continueModule = moduleStats.find(mod => mod.status === 'Sedang dipelajari');
    if (!continueModule && moduleStats.some(mod => mod.progress === 100)) continueModule = moduleStats.find(mod => mod.progress < 100);
  }
  if (continueModule) {
    const el = id => document.getElementById(id);
    if (el('continue-number')) el('continue-number').textContent = String(continueModule.id).padStart(2, '0');
    if (el('continue-category')) el('continue-category').textContent = continueModule.category;
    if (el('continue-module-title')) el('continue-module-title').textContent = continueModule.name;
    if (el('continue-module-description')) el('continue-module-description').textContent = continueModule.description;
    if (el('continue-progress-fill')) el('continue-progress-fill').style.width = `${continueModule.progress}%`;
    if (el('continue-progress-label')) el('continue-progress-label').textContent = `${continueModule.progress}%`;
    const button = el('continue-button'); if (button) { button.href = `module.html?module=${continueModule.id}${last && Number(last.moduleId) === continueModule.id && last.lessonId ? `&lesson=${encodeURIComponent(last.lessonId)}` : ''}`; button.innerHTML = `<i data-lucide="play" aria-hidden="true"></i> ${continueModule.progress > 0 ? 'Lanjutkan' : 'Mulai Belajar'}`; }
  }
  if (otherTitle) otherTitle.textContent = hasProgress ? 'Modul Lainnya' : 'Daftar Modul';
  const shortlist = document.getElementById('module-shortlist');
  if (shortlist) {
    const availableModules = hasProgress ? moduleStats.filter(mod => !continueModule || mod.id !== continueModule.id).slice(0, 3) : moduleStats;
    shortlist.innerHTML = availableModules.map(mod => `<a class="module-row" href="module.html?module=${mod.id}"><span class="module-number">${String(mod.id).padStart(2, '0')}</span><span class="module-row-info"><span class="module-category">${mod.category}</span><strong>${mod.name}</strong><small>${mod.description}</small></span><span class="mini-progress"><span style="width:${mod.progress}%;background:#087cff"></span></span><span class="module-percent">${mod.progress}%</span><span class="module-status">${mod.status}</span><i data-lucide="chevron-right" aria-hidden="true"></i></a>`).join('');
  }

  // The full leaderboard page can publish the same data to this shared localStorage key.
  let ranks = [];
  try { const parsed = JSON.parse(getStored('rlc_leaderboard_data', '[]')); if (Array.isArray(parsed)) ranks = parsed; } catch (_) { ranks = []; }
  if (!ranks.length) ranks = [
    { name: 'KuroDev', xp: 520, avatar: '', userKey: 'kurodev' },
    { name: 'Lynx', xp: 480, avatar: '', userKey: 'lynx' },
    { name: 'Zenith', xp: 410, avatar: '', userKey: 'zenith' },
    { name: displayName, xp: Number(getStored(`rlc_xp_${userKey}`, '150')) || 0, avatar: avatarValue, userKey },
    { name: 'Rafa', xp: 120, avatar: '', userKey: 'rafa' }
  ];
  ranks = ranks.map(row => ({ ...row, xp: Number(row.xp || row.points || 0) })).sort((a, b) => b.xp - a.xp).slice(0, 5);
  const rankList = document.getElementById('dashboard-rank-list');
  if (rankList) rankList.innerHTML = ranks.map((row, index) => {
    const rank = index + 1; const isCurrent = String(row.userKey || row.username || row.name).toLowerCase() === userKey || row.name === displayName;
    const avatar = row.avatar || (isCurrent ? avatarValue : '');
    const avatarStyle = avatar ? `style="background-image:url('${avatar.startsWith('data:') ? avatar : `assets/avatars/${avatar}.png`}');background-size:cover;background-position:center"` : '';
    return `<div class="rank-row ${isCurrent ? 'current-user-row' : ''}"><span class="rank-medal ${rank === 1 ? 'gold' : rank === 3 ? 'bronze' : ''}">${rank === 1 ? '<i data-lucide="crown" aria-label="Peringkat pertama"></i>' : rank}</span><span class="rank-avatar" ${avatarStyle}>${avatar ? '' : String(row.name || '?').charAt(0).toUpperCase()}</span><span class="rank-name">${String(row.name || 'Pengguna').replace(/[<>]/g, '')}</span><strong>${row.xp} XP</strong></div>`;
  }).join('');
  const streakCount = Number(getStored(`rlc_streak_${userKey}`, '0')) || 0;
  const streak = document.getElementById('dashboard-streak-count'); if (streak) streak.textContent = `${streakCount} Hari`;
  if (window.lucide) window.lucide.createIcons();
})();
