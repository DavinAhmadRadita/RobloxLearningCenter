(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const workspace = $('#forum-workspace'), listEl = $('#topic-list'), threadPanel = $('#thread-panel');
  const tabs = $$('#category-tabs .category-tab'), searchInput = $('#topic-search'), sortSelect = $('#topic-sort');
  const modal = $('#create-modal'), form = $('#create-form'), toast = $('#forum-toast');
  const currentUser = sessionStorage.getItem('rlc_current_user') || localStorage.getItem('rlc_remembered_user') || '';
  const userKey = (currentUser || 'guest').toLowerCase();
  const read = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } };
  const displayName = currentUser ? read(`rlc_display_name_${userKey}`, currentUser) : 'Viinnz';
  const avatarSrc = (value) => value && value.startsWith('data:') ? value : `assets/avatars/${/^avatar-\d{2}$/.test(value || '') ? value : 'avatar-01'}.png`;
  const myAvatar = avatarSrc(currentUser ? read(`rlc_avatar_${userKey}`, 'avatar-01') : 'avatar-01');
  const categoryClass = c => c === 'Diskusi' ? 'tag-diskusi' : c === 'Tips & Tutorial' ? 'tag-tips' : c === 'Showcase' ? 'tag-showcase' : 'tag-help';
  const categoryIcon = c => c === 'Diskusi' ? 'message-circle' : c === 'Tips & Tutorial' ? 'lightbulb' : c === 'Showcase' ? 'image' : 'circle-help';
  const ago = mins => mins < 60 ? `${mins} menit lalu` : mins < 1440 ? `${Math.floor(mins / 60)} jam lalu` : `${Math.floor(mins / 1440)} hari lalu`;
  let activeCategory = 'Semua Topik', selectedId = null, selectedCategory = 'Diskusi', imageData = '', nextId = 100;
  let topics = [
    { id: 1, category: 'Diskusi', title: 'Game RPG atau Obby, mana lebih menarik?', body: 'Menurut kalian, genre game apa yang lebih banyak dimainkan di Roblox saat ini? Yuk diskusi! Aku tertarik mengembangkan game baru dan masih bingung memilih antara RPG dengan sistem level dan quest, atau obby yang sederhana tapi menantang.', author: 'Rafa', avatar: 'avatar-05', minutes: 120, likes: 56, views: 320, image: 'assets/banners/sky-islands.webp', comments: [{ author: 'Lynx', avatar: 'avatar-02', minutes: 90, text: 'Menurutku obby lebih mudah menarik pemain baru, tapi RPG punya potensi jangka panjang.', likes: 12 }, { author: 'KuroDev', avatar: 'avatar-03', minutes: 60, text: 'Setuju, obby lebih cepat viral. Tapi kalau RPG bagus, player retention-nya bisa lebih tinggi.', likes: 8 }] },
    { id: 2, category: 'Tips & Tutorial', title: 'Cara membuat sistem save data sederhana', body: 'Di sini aku share cara membuat sistem save data menggunakan DataStore di Roblox Studio. Jangan lupa aktifkan API Services saat testing.', author: 'Lynx', avatar: 'avatar-02', minutes: 300, likes: 42, views: 410, image: 'assets/banners/dark-aesthetic.webp', comments: [{ author: 'Rafa', avatar: 'avatar-05', minutes: 240, text: 'Tutorialnya membantu banget, terutama bagian DataStoreService.', likes: 4 }] },
    { id: 3, category: 'Showcase', title: 'Hasil game obby pertama ku!', body: 'Ini dia hasil game obby pertama yang aku buat. Masih sederhana tapi semoga kalian suka! Aku terbuka untuk kritik dan saran.', author: 'Zenith', avatar: 'avatar-03', minutes: 720, likes: 80, views: 520, image: 'assets/banners/nature-realm.webp', comments: [{ author: 'Viinnz', avatar: 'avatar-01', minutes: 600, text: 'Keren! Coba tambahkan checkpoint di bagian yang sulit.', likes: 5 }] },
    { id: 4, category: 'Pertanyaan / Bantuan & Error', title: 'Script NPC tidak berjalan, ada yang tahu penyebabnya?', body: 'NPC yang aku buat tidak mau jalan, padahal tidak ada error di output. Apa yang perlu aku cek di script atau pengaturan NPC-nya?', author: 'KuroDev', avatar: 'avatar-04', minutes: 1440, likes: 28, views: 190, comments: [{ author: 'Lynx', avatar: 'avatar-02', minutes: 1300, text: 'Coba pastikan script ada di ServerScriptService atau di dalam model NPC sesuai kebutuhan, lalu cek Humanoid dan HumanoidRootPart.', likes: 3 }] },
    { id: 5, category: 'Diskusi', title: 'Rekomendasi plugin Roblox Studio', body: 'Kalian biasanya pakai plugin apa saja? Share dong plugin yang menurut kalian wajib.', author: 'GlitchMasterFZ', avatar: 'avatar-06', minutes: 1500, likes: 66, views: 450, comments: [{ author: 'Rafa', avatar: 'avatar-05', minutes: 1400, text: 'Building Tools dan plugin untuk terrain cukup membantu.', likes: 7 }] },
    { id: 6, category: 'Tips & Tutorial', title: 'Tips optimasi game agar tidak lag', body: 'Ini beberapa tips yang bisa membantu mengurangi lag di game Roblox, terutama ketika map mulai besar.', author: 'Rafa', avatar: 'avatar-05', minutes: 2880, likes: 75, views: 600, image: 'assets/banners/sky-islands.webp', comments: [] },
    { id: 7, category: 'Pertanyaan / Bantuan & Error', title: 'Kenapa RemoteEvent tidak terpanggil?', body: 'Aku sudah membuat RemoteEvent tapi event dari client tidak terdeteksi di server. Ada yang bisa bantu cek alur yang benar?', author: 'Davin', avatar: 'avatar-07', minutes: 3300, likes: 13, views: 110, comments: [] }
  ];
  function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2300); }
  function visibleTopics() {
    let arr = topics.filter(t => (activeCategory === 'Semua Topik' || t.category === activeCategory));
    const q = searchInput.value.trim().toLowerCase();
    if (q) arr = arr.filter(t => [t.title, t.body, t.author, t.category].join(' ').toLowerCase().includes(q));
    if (sortSelect.value === 'popular') arr.sort((a, b) => b.likes - a.likes);
    else if (sortSelect.value === 'comments') arr.sort((a, b) => b.comments.length - a.comments.length);
    else arr.sort((a, b) => a.minutes - b.minutes);
    return arr;
  }
  function renderList() {
    const arr = visibleTopics();
    listEl.innerHTML = arr.map(t => `<article class="topic-card ${t.id === selectedId ? 'selected' : ''}" data-id="${t.id}" tabindex="0" role="button" aria-label="Buka topik ${esc(t.title)}">
      ${t.image ? `<img class="topic-thumb" src="${t.image}" alt="" onerror="this.style.display='none'">` : `<div class="topic-thumb placeholder"><i data-lucide="${categoryIcon(t.category)}"></i></div>`}
      <div class="topic-copy"><span class="topic-tag ${categoryClass(t.category)}"><i data-lucide="${categoryIcon(t.category)}"></i>${esc(t.category)}</span><h3 class="topic-title">${esc(t.title)}</h3><p class="topic-excerpt">${esc(t.body)}</p><div class="topic-meta"><span><i data-lucide="message-circle"></i>${t.comments.length}</span><span><i data-lucide="heart"></i>${t.likes}</span></div></div>
      <div class="topic-author"><img src="${avatarSrc(t.avatar)}" alt=""><div><span>${esc(t.author)}</span><small>${ago(t.minutes)}</small></div></div><button class="topic-more" type="button" aria-label="Opsi topik" aria-haspopup="menu" aria-expanded="false"><i data-lucide="ellipsis-vertical"></i></button>
    </article>`).join('');
    $('#empty-results').classList.toggle('hidden', arr.length > 0);
    if (window.lucide) lucide.createIcons();
  }
  function renderThread() {
    const t = topics.find(x => x.id === selectedId);
    if (!t) { threadPanel.classList.add('hidden'); workspace.classList.remove('has-selection'); return; }
    workspace.classList.add('has-selection'); threadPanel.classList.remove('hidden');
    threadPanel.innerHTML = `<div class="thread-topbar"><button class="thread-close" id="close-thread" aria-label="Tutup diskusi"><i data-lucide="x"></i></button><h2>${esc(t.title)}</h2><button class="icon-button" id="thread-options" aria-label="Opsi"><i data-lucide="ellipsis"></i></button></div>
      <div class="thread-content"><div class="thread-author"><img src="${avatarSrc(t.avatar)}" alt=""><div><strong>${esc(t.author)}</strong><small>${esc(t.category)} · ${ago(t.minutes)}</small></div></div>
      <p class="thread-body">${esc(t.body)}</p>${t.image ? `<img class="thread-attachment" src="${t.image}" alt="Lampiran topik">` : ''}
      <div class="thread-actions"><button class="thread-action ${t.liked ? 'liked' : ''}" id="like-topic"><i data-lucide="heart"></i>${t.likes} Suka</button><button class="thread-action"><i data-lucide="message-circle"></i>${t.comments.length} Komentar</button><button class="thread-action" id="copy-topic"><i data-lucide="link"></i>Salin tautan</button></div>
      <div class="comments-heading">Komentar <span>${t.comments.length} balasan</span></div><div class="comments-list">${t.comments.length ? t.comments.map((c, i) => `<div class="comment"><img class="comment-avatar" src="${avatarSrc(c.avatar)}" alt=""><div class="comment-content"><span class="comment-name">${esc(c.author)}</span><span class="comment-time">${ago(c.minutes)}</span><p class="comment-text">${esc(c.text)}</p><div class="comment-reply"><button data-comment-like="${i}">♡ ${c.likes || 0}</button><button data-reply="${i}">Balas</button></div></div></div>`).join('') : '<p class="no-comments">Belum ada komentar. Jadilah yang pertama membalas topik ini!</p>'}</div></div>
      <form class="comment-composer" id="comment-form"><img class="composer-avatar" src="${myAvatar}" alt=""><textarea id="comment-input" rows="1" maxlength="1000" placeholder="Tulis komentar..." required></textarea><button class="send-comment" type="submit" aria-label="Kirim komentar"><i data-lucide="send"></i></button></form>`;
    if (window.lucide) lucide.createIcons();
    $('#close-thread').addEventListener('click', closeSelectedTopic);
    $('#like-topic').addEventListener('click', () => { if (!t.liked) { t.likes++; t.liked = true; } else { t.likes--; t.liked = false; } renderList(); renderThread(); });
    $('#copy-topic').addEventListener('click', () => { const url = location.href.split('#')[0] + `#topic-${t.id}`; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => showToast('Tautan topik disalin.')).catch(() => showToast(url)); else showToast('Topik dipilih: ' + t.title); });
    $('#comment-form').addEventListener('submit', e => { e.preventDefault(); const input = $('#comment-input'); const text = input.value.trim(); if (!text) return; t.comments.push({ author: displayName, avatar: currentUser ? read(`rlc_avatar_${userKey}`, 'avatar-01') : 'avatar-01', minutes: 0, text, likes: 0 }); renderList(); renderThread(); showToast('Komentar ditambahkan.'); });
    $$('[data-comment-like]').forEach(btn => btn.addEventListener('click', () => { const c = t.comments[+btn.dataset.commentLike]; c.likes = (c.likes || 0) + 1; renderThread(); }));
    $$('[data-reply]').forEach(btn => btn.addEventListener('click', () => { const c = t.comments[+btn.dataset.reply]; const input = $('#comment-input'); input.value = `@${c.author} `; input.focus(); }));
    const options = $('#thread-options'); options.addEventListener('click', () => {
      const existing = $('#thread-options-menu'); if (existing) { existing.remove(); return; }
      const own = t.ownerKey === userKey; const menu = document.createElement('div'); menu.className = 'topic-menu thread-options-menu'; menu.id = 'thread-options-menu'; menu.innerHTML = `<button type="button" data-thread-action="report"><i data-lucide="flag"></i>Laporkan topik</button>${own ? '<button type="button" class="danger" data-thread-action="delete"><i data-lucide="trash-2"></i>Hapus topik</button>' : ''}`;
      options.parentElement.style.position = 'relative'; options.parentElement.appendChild(menu); if (window.lucide) lucide.createIcons();
      menu.addEventListener('click', ev => { const action = ev.target.closest('[data-thread-action]')?.dataset.threadAction; if (action === 'report') { menu.remove(); showToast('Laporan dicatat (demo frontend).'); } if (action === 'delete') { topics = topics.filter(x => x.id !== t.id); selectedId = null; renderList(); renderThread(); showToast('Topik berhasil dihapus (data demo).'); } });
    });
  }
  function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function closeSelectedTopic() { selectedId = null; renderList(); renderThread(); $('.topic-list-panel').classList.remove('mobile-hidden'); threadPanel.classList.add('mobile-hidden'); }
  function selectTopic(id) { const nextId = Number(id); if (selectedId === nextId) { closeSelectedTopic(); return; } selectedId = nextId; renderList(); renderThread(); if (window.innerWidth <= 850) { $('.topic-list-panel').classList.add('mobile-hidden'); threadPanel.classList.remove('mobile-hidden'); } else { threadPanel.classList.remove('mobile-hidden'); } }
  function closeTopicMenus(except = null) { $$('.topic-menu', listEl).forEach(menu => { if (menu !== except) menu.remove(); }); $$('.topic-more', listEl).forEach(btn => { if (!except || btn.closest('.topic-card') !== except.closest('.topic-card')) btn.setAttribute('aria-expanded', 'false'); }); }
  function openTopicMenu(card) {
    closeTopicMenus();
    const topic = topics.find(t => t.id === Number(card.dataset.id)); if (!topic) return;
    const own = topic.ownerKey === userKey;
    const menu = document.createElement('div'); menu.className = 'topic-menu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = `<button type="button" role="menuitem" data-menu-action="report"><i data-lucide="flag"></i>Laporkan topik</button>${own ? '<button type="button" role="menuitem" class="danger" data-menu-action="delete"><i data-lucide="trash-2"></i>Hapus topik</button>' : ''}`;
    card.appendChild(menu); const toggle = card.querySelector('.topic-more'); if (toggle) toggle.setAttribute('aria-expanded', 'true'); if (window.lucide) lucide.createIcons();
    menu.addEventListener('click', ev => {
      const action = ev.target.closest('[data-menu-action]')?.dataset.menuAction; if (!action) return; ev.stopPropagation();
      if (action === 'report') { menu.remove(); if (toggle) toggle.setAttribute('aria-expanded', 'false'); showToast('Laporan dicatat (demo frontend).'); }
      if (action === 'delete') {
        topics = topics.filter(t => t.id !== topic.id); if (selectedId === topic.id) { selectedId = null; renderThread(); }
        renderList(); showToast('Topik berhasil dihapus (data demo).');
      }
    });
  }
  listEl.addEventListener('click', e => {
    if (e.target.closest('.topic-menu')) { e.stopPropagation(); return; }
    if (e.target.closest('.topic-more')) { e.stopPropagation(); const card = e.target.closest('.topic-card'); const existing = card.querySelector('.topic-menu'); if (existing) { existing.remove(); e.target.closest('.topic-more').setAttribute('aria-expanded', 'false'); } else openTopicMenu(card); return; }
    const card = e.target.closest('.topic-card'); if (card) selectTopic(card.dataset.id);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.topic-card')) closeTopicMenus(); });
  listEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.topic-card')) { e.preventDefault(); selectTopic(e.target.dataset.id); } });
  tabs.forEach(tab => tab.addEventListener('click', () => { activeCategory = tab.dataset.category; tabs.forEach(x => x.classList.toggle('active', x === tab)); selectedId = null; renderList(); renderThread(); if (window.innerWidth <= 850) $('.topic-list-panel').classList.remove('mobile-hidden'); }));
  searchInput.addEventListener('input', renderList); sortSelect.addEventListener('change', renderList);
  function openModal() { modal.classList.remove('hidden'); document.body.classList.add('modal-open'); $('#new-title').focus(); }
  function closeModal() { modal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
  $('#open-create').addEventListener('click', openModal); $('#close-create').addEventListener('click', closeModal); $('#cancel-create').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); }); document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });
  $$('#category-choices .choice-card').forEach(btn => btn.addEventListener('click', () => { $$('#category-choices .choice-card').forEach(b => b.classList.toggle('selected', b === btn)); selectedCategory = btn.dataset.choice; $('#selected-category').value = selectedCategory; }));
  $('#new-title').addEventListener('input', e => $('#title-counter').textContent = `${e.target.value.length}/100`);
  $('#new-body').addEventListener('input', e => $('#body-counter').textContent = `${e.target.value.length}/2000`);
  $('#new-image').addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { showToast('Ukuran gambar maksimal 5 MB.'); e.target.value = ''; return; } const reader = new FileReader(); reader.onload = () => { imageData = reader.result; $('#preview-img').src = imageData; $('#preview-name').textContent = file.name; $('#image-preview').classList.remove('hidden'); $('#upload-title').textContent = 'Gambar dipilih'; }; reader.readAsDataURL(file); });
  $('#remove-image').addEventListener('click', () => { imageData = ''; $('#new-image').value = ''; $('#image-preview').classList.add('hidden'); $('#upload-title').textContent = 'Klik untuk memilih gambar'; });
  form.addEventListener('submit', e => { e.preventDefault(); const title = $('#new-title').value.trim(), body = $('#new-body').value.trim(); if (!title || !body) { showToast('Judul dan isi topik wajib diisi.'); return; } const topic = { id: nextId++, category: selectedCategory, title, body, author: displayName, ownerKey: userKey, avatar: currentUser ? read(`rlc_avatar_${userKey}`, 'avatar-01') : 'avatar-01', minutes: 0, likes: 0, views: 0, comments: [], image: imageData || '' }; topics.unshift(topic); activeCategory = 'Semua Topik'; tabs.forEach(x => x.classList.toggle('active', x.dataset.category === activeCategory)); searchInput.value = ''; sortSelect.value = 'new'; selectedId = topic.id; renderList(); renderThread(); if (topic.image) { const img = $('.thread-attachment'); if (img) img.src = topic.image; } closeModal(); form.reset(); $('#selected-category').value = 'Diskusi'; selectedCategory = 'Diskusi'; $$('#category-choices .choice-card').forEach(b => b.classList.toggle('selected', b.dataset.choice === 'Diskusi')); $('#title-counter').textContent = '0/100'; $('#body-counter').textContent = '0/2000'; imageData = ''; $('#image-preview').classList.add('hidden'); $('#upload-title').textContent = 'Klik untuk memilih gambar'; showToast('Topik berhasil dibuat (data demo).'); });
  renderList();
})();