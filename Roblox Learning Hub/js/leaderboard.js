(() => {
  const list = document.getElementById('leaderboard-page-list');
  const podium = document.getElementById('leaderboard-podium');
  if (!list || !podium) return;

  const currentUser = sessionStorage.getItem('rlc_current_user') || localStorage.getItem('rlc_remembered_user') || '';
  const userKey = (currentUser || 'guest').toLowerCase();
  const displayName = currentUser ? (localStorage.getItem(`rlc_display_name_${userKey}`) || currentUser) : 'Pengunjung';
  const avatar = currentUser ? (localStorage.getItem(`rlc_avatar_${userKey}`) || 'avatar-01') : '';
  let rows = [];
  try {
    rows = JSON.parse(localStorage.getItem('rlc_leaderboard_data') || '[]');
    if (!Array.isArray(rows)) rows = [];
  } catch (_) { rows = []; }
  if (!rows.length) {
    rows = [
      { name: 'KuroDev', xp: 520, userKey: 'kurodev', avatar: 'avatar-02' },
      { name: 'Lynx', xp: 480, userKey: 'lynx', avatar: 'avatar-03' },
      { name: 'Zenith', xp: 410, userKey: 'zenith', avatar: 'avatar-04' },
      { name: displayName, xp: Number(localStorage.getItem(`rlc_xp_${userKey}`) || 150), avatar, userKey },
      { name: 'Rafa', xp: 120, userKey: 'rafa', avatar: 'avatar-05' },
      { name: 'Davin', xp: 110, userKey: 'davin', avatar: 'avatar-06' },
      { name: 'Nazriel', xp: 90, userKey: 'nazriel', avatar: 'avatar-07' },
      { name: 'Gevin', xp: 80, userKey: 'gevin', avatar: 'avatar-08' },
      { name: 'Putra', xp: 70, userKey: 'putra', avatar: 'avatar-09' },
      { name: 'Wafii', xp: 60, userKey: 'wafii', avatar: 'avatar-10' },
      { name: 'Raka', xp: 45, userKey: 'raka', avatar: 'avatar-11' },
      { name: 'Naya', xp: 30, userKey: 'naya', avatar: 'avatar-12' }
    ];
  }
  const fallbackAvatars = { kurodev: 'avatar-02', lynx: 'avatar-03', zenith: 'avatar-04', rafa: 'avatar-05', davin: 'avatar-06', nazriel: 'avatar-07', gevin: 'avatar-08', putra: 'avatar-09', wafii: 'avatar-10', raka: 'avatar-11', naya: 'avatar-12' };
  rows = rows.map(row => {
    const name = String(row.name || row.username || 'Pengguna');
    const key = String(row.userKey || row.username || name).toLowerCase();
    return { ...row, name, xp: Number(row.xp ?? row.points ?? 0), avatar: row.avatar || fallbackAvatars[key] || (key === userKey ? avatar : '') };
  }).sort((a, b) => b.xp - a.xp);
  localStorage.setItem('rlc_leaderboard_data', JSON.stringify(rows));

  const isCurrent = row => String(row.userKey || row.username || row.name).toLowerCase() === userKey || row.name === displayName;
  const avatarStyle = av => av ? `style="background-image:url('${String(av).startsWith('data:') ? av : `assets/avatars/${String(av).replace(/[^a-zA-Z0-9_-]/g, '')}.png`}');background-size:cover;background-position:center"` : '';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const playerAvatar = (row, extra = '') => {
    const av = row.avatar || (isCurrent(row) ? avatar : '');
    return `<span class="leaderboard-player-avatar ${extra}" ${avatarStyle(av)}>${av ? '' : safe(row.name.charAt(0).toUpperCase())}</span>`;
  };

  podium.innerHTML = [
    { row: rows[1], rank: 2, cls: 'silver' },
    { row: rows[0], rank: 1, cls: 'gold' },
    { row: rows[2], rank: 3, cls: 'bronze' }
  ].filter(item => item.row).map(item => `<article class="podium-card ${item.cls}"><div class="podium-crown"><i data-lucide="crown"></i></div><div class="podium-avatar-wrap">${playerAvatar(item.row, 'podium-avatar')}<div class="podium-rank">${item.rank}</div></div><h2 title="${safe(item.row.name)}">${safe(item.row.name)}</h2><strong class="podium-xp">${item.row.xp.toLocaleString('id-ID')} XP</strong></article>`).join('');

  const renderRow = (row, index, offset = 0) => {
    const rank = index + offset + 1;
    return `<article class="leaderboard-page-row ${isCurrent(row) ? 'is-current' : ''}"><span class="leaderboard-page-rank">${rank}</span>${playerAvatar(row)}<span class="leaderboard-page-name">${safe(row.name)}${isCurrent(row) ? '<small> (Kamu)</small>' : ''}</span><strong>${row.xp.toLocaleString('id-ID')} XP</strong></article>`;
  };
  list.innerHTML = rows.slice(3, 10).map((row, index) => renderRow(row, index, 3)).join('') || '<p class="leaderboard-empty">Belum ada data peringkat.</p>';

  const currentIndex = rows.findIndex(isCurrent);
  const currentRow = currentIndex >= 0 ? rows[currentIndex] : (currentUser ? { name: displayName, xp: Number(localStorage.getItem(`rlc_xp_${userKey}`) || 0), avatar } : null);
  const currentPanel = document.getElementById('leaderboard-current-user');
  if (currentRow) {
    currentPanel.innerHTML = `<span class="current-user-rank">${currentIndex >= 0 ? `#${currentIndex + 1}` : '—'}</span>${playerAvatar(currentRow, 'current-user-avatar')}<span class="current-user-name">${safe(currentRow.name)} <small>(Kamu)</small></span><strong>${currentRow.xp.toLocaleString('id-ID')} XP</strong>`;
  } else {
    currentPanel.hidden = true;
  }

  if (window.lucide) window.lucide.createIcons();
})();
