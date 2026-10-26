(() => {
    const $ = id => document.getElementById(id);
    const challenges = [
        {
            id: 'npc', title: 'Membuat NPC Mengejar Player', level: 'Pemula', category: 'NPC', xp: 100, icon: 'bot', time: '20 menit', desc: 'Buat script agar NPC mendeteksi player di dekatnya dan mengejarnya menggunakan PathfindingService.', learn: ['Deteksi player di sekitar NPC', 'Menggunakan PathfindingService', 'Menggerakkan Humanoid NPC'], requirements: ['Menggunakan PathfindingService', 'NPC mencari karakter player terdekat', 'NPC bergerak menuju target dengan MoveTo'], starter: `local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")

local npc = script.Parent
local humanoid = npc:WaitForChild("Humanoid")
local root = npc:WaitForChild("HumanoidRootPart")

-- TODO: cari player terdekat
-- TODO: buat path menuju player
-- TODO: gerakkan NPC mengikuti waypoint
`, tests: [['PathfindingService digunakan', /PathfindingService/], ['NPC memiliki Humanoid', /WaitForChild\s*\(\s*["']Humanoid["']\s*\)/], ['NPC bergerak menggunakan MoveTo', /MoveTo\s*\(/], ['Path waypoint diproses', /GetWaypoints\s*\(/]]
        },
        {
            id: 'trap', title: 'Trap Aktif Saat Diinjak', level: 'Pemula', category: 'Trap', xp: 100, icon: 'zap', time: '15 menit', desc: 'Buat trap yang bereaksi saat karakter menyentuhnya dan memberikan damage.', learn: ['Event Touched', 'Mendeteksi karakter', 'Memberikan damage dengan aman'], requirements: ['Menggunakan event Touched', 'Mencari Humanoid karakter', 'Memberikan damage saat tersentuh'], starter: `local trap = script.Parent
local DAMAGE = 25

-- TODO: hubungkan event Touched
-- TODO: cari Humanoid pada karakter yang menyentuh trap
-- TODO: berikan damage
`, tests: [['Event Touched digunakan', /\.Touched\s*:/], ['Humanoid dicari', /FindFirstChildOfClass\s*\(\s*["']Humanoid["']\s*\)|FindFirstChild\s*\(\s*["']Humanoid["']\s*\)/], ['Damage diterapkan', /TakeDamage\s*\(/]]
        },
        {
            id: 'checkpoint', title: 'Sistem Checkpoint', level: 'Menengah', category: 'Checkpoint', xp: 150, icon: 'flag-triangle-right', time: '25 menit', desc: 'Simpan checkpoint terakhir yang disentuh pemain dan gunakan saat karakter respawn.', learn: ['Mendeteksi checkpoint', 'Menyimpan progres pemain', 'Mengatur respawn karakter'], requirements: ['Event Touched aktif', 'Posisi checkpoint disimpan', 'Karakter dipindahkan ke checkpoint saat respawn'], starter: `local checkpoint = script.Parent
local Players = game:GetService("Players")

-- TODO: simpan checkpoint pemain ketika disentuh
-- TODO: pindahkan karakter saat respawn
`, tests: [['Event Touched digunakan', /\.Touched\s*:/], ['Data checkpoint disimpan', /checkpoint|Checkpoint/], ['Respawn ditangani', /CharacterAdded|LoadCharacter/]]
        },
        {
            id: 'door', title: 'Pintu Otomatis', level: 'Pemula', category: 'Game System', xp: 100, icon: 'door-open', time: '15 menit', desc: 'Buat pintu yang terbuka ketika player mendekat atau menyentuh pemicu.', learn: ['Mengenal event Roblox', 'Mengubah posisi atau transparansi part', 'Membuat interaksi sederhana'], requirements: ['Event pemicu dibuat', 'Pintu berubah kondisi saat aktif', 'Script mengakses objek pintu'], starter: `local door = workspace:WaitForChild("Door")
local trigger = script.Parent

-- TODO: hubungkan event pemicu
-- TODO: buka pintu saat player menyentuh pemicu
`, tests: [['Event pemicu digunakan', /\.Touched\s*:/], ['Objek Door dirujuk', /Door/], ['Pintu diubah saat aktif', /CanCollide|Transparency|CFrame|PivotTo/]]
        },
        {
            id: 'laser', title: 'Trap Laser Berputar', level: 'Menengah', category: 'Trap', xp: 200, icon: 'rotate-cw', time: '30 menit', desc: 'Putar objek laser terus-menerus dan atur kecepatannya menggunakan RunService atau TweenService.', learn: ['Loop dan delta time', 'Rotasi CFrame', 'Menjalankan animasi objek'], requirements: ['Rotasi objek dilakukan', 'Ada loop atau update berulang', 'CFrame atau TweenService digunakan'], starter: `local RunService = game:GetService("RunService")
local laser = script.Parent
local speed = math.rad(60)

-- TODO: putar laser secara terus-menerus
`, tests: [['RunService atau TweenService digunakan', /RunService|TweenService/], ['Rotasi CFrame diterapkan', /CFrame|TweenService/], ['Update berulang dibuat', /Heartbeat|Stepped|RenderStepped|while\s+true|task\.wait/]]
        },
        {
            id: 'killzone', title: 'Kill Zone', level: 'Menengah', category: 'Game System', xp: 150, icon: 'flame', time: '20 menit', desc: 'Buat area berbahaya yang mengalahkan karakter ketika tersentuh.', learn: ['Event Touched', 'Mencari Humanoid', 'Validasi karakter'], requirements: ['Karakter terdeteksi saat menyentuh', 'Humanoid ditemukan', 'Health karakter dibuat nol atau diberi damage'], starter: `local zone = script.Parent

-- TODO: deteksi bagian karakter yang menyentuh zone
-- TODO: temukan Humanoid dan kalahkan karakter
`, tests: [['Event Touched digunakan', /\.Touched\s*:/], ['Humanoid ditemukan', /Humanoid/], ['Karakter diberi damage atau dikalahkan', /TakeDamage\s*\(|\.Health\s*=\s*0/]]
        }
    ];
    let selectedFilter = 'Semua', searchTerm = '', active = null, codeValue = '', passed = new Set(JSON.parse(localStorage.getItem('rlc_demo_completed_challenges') || '[]')), started = new Set(JSON.parse(localStorage.getItem('rlc_demo_started_challenges') || '[]'));
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function icon(name) { return `<i data-lucide="${name}" aria-hidden="true"></i>` }
    function refreshIcons() { if (window.lucide) window.lucide.createIcons() }
    function showToast(msg) { const t = $('challenge-toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400) }
    function status(c) { return passed.has(c.id) ? 'Selesai' : started.has(c.id) ? 'Dilanjutkan' : 'Mulai' }
    function updateStats() { $('total-count').textContent = challenges.length; $('done-count').textContent = passed.size; $('working-count').textContent = [...started].filter(id => !passed.has(id)).length; $('todo-count').textContent = challenges.filter(c => !passed.has(c.id) && !started.has(c.id)).length }
    function renderCards() {
        const list = challenges.filter(c => (selectedFilter === 'Semua' || c.level === selectedFilter || c.category === selectedFilter) && (`${c.title} ${c.desc} ${c.category}`.toLowerCase().includes(searchTerm.toLowerCase())));
        $('challenge-grid').innerHTML = list.length ? list.map(c => `<article class="challenge-card"><div class="challenge-card-art ${c.category === 'Trap' ? 'art-trap' : c.category === 'Checkpoint' ? 'art-checkpoint' : c.category === 'Game System' ? 'art-door' : ''}">${icon(c.icon)}<span class="challenge-level">${c.level}</span></div><div class="challenge-card-body"><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p><div class="challenge-meta"><span class="xp-tag">${icon('star')} ${c.xp} XP</span><button class="challenge-action ${passed.has(c.id) ? 'secondary' : ''}" data-open="${c.id}">${passed.has(c.id) ? 'Lihat Lagi' : started.has(c.id) ? 'Lanjutkan' : 'Mulai'} ${icon('play')}</button></div></div></article>`).join('') : '<div class="empty-state">Challenge tidak ditemukan. Coba kata kunci atau filter lain.</div>';
        updateStats(); refreshIcons();
    }
    function setView(id) { ['challenge-list-view', 'challenge-detail-view', 'challenge-work-view', 'challenge-result-view'].forEach(v => $(v).classList.toggle('hidden', v !== id)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function goList() { setView('challenge-list-view'); renderCards() }
    function detail(c) {
        active = c; setView('challenge-detail-view');
        $('challenge-detail-view').innerHTML = `<button class="back-link" data-back>${icon('arrow-left')} Kembali ke Challenges</button><div class="detail-top"><div class="detail-art">${icon(c.icon)}</div><div><div class="detail-chips"><span class="detail-chip">${esc(c.level)}</span><span class="detail-chip">Roblox Luau</span><span class="detail-chip">${esc(c.time)}</span></div><h2>${esc(c.title)}</h2><p>${esc(c.desc)}</p><div class="detail-chips"><span class="detail-chip">${icon('star')} ${c.xp} XP</span><span class="detail-chip">${icon('code-2')} Editor Luau</span></div></div></div><div class="detail-columns"><section class="detail-panel"><h3>Tujuan Challenge</h3><ul>${c.requirements.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section><section class="detail-panel"><h3>Yang Akan Kamu Pelajari</h3><div class="learning-list">${c.learn.map(x => `<div>${icon('check-circle-2')}<span>${esc(x)}</span></div>`).join('')}</div></section></div><button class="primary-action detail-start" data-start>${passed.has(c.id) ? 'Coba Lagi' : 'Mulai Challenge'} ${icon('play')}</button>`;
        refreshIcons();
    }
    function workspace(c) {
        active = c; codeValue = c.starter; started.add(c.id); localStorage.setItem('rlc_demo_started_challenges', JSON.stringify([...started])); setView('challenge-work-view');
        $('challenge-work-view').innerHTML = `<button class="back-link" data-detail>${icon('arrow-left')} Kembali ke Detail Challenge</button><div class="workspace-head"><div><h2>${esc(c.title)}</h2><p>Tulis script Luau sesuai instruksi, lalu jalankan test case.</p></div><span class="step-progress">LANGKAH 1 DARI 2 · TULIS KODE</span></div><div class="workspace-grid"><section class="instructions-panel"><div class="panel-heading">${icon('book-open')} Instruksi <span class="detail-chip">Luau</span></div><div class="instruction-content"><h3>Tugas kamu</h3><p>${esc(c.desc)}</p><h3>Kriteria kelulusan</h3><ul>${c.requirements.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="hint-box"><strong>Tips</strong><br>Lengkapi bagian TODO. Klik <b>Jalankan Test</b> untuk memeriksa apakah script mengandung struktur yang dibutuhkan. Demo ini memeriksa pola kode, bukan menjalankan Roblox Engine.</div></div></section><section class="editor-panel"><div class="panel-heading"><span>${icon('file-code-2')} Script (ServerScriptService / NPC)</span><span class="detail-chip">Luau</span></div><textarea id="luau-editor" class="code-editor" spellcheck="false" aria-label="Editor kode Luau"></textarea><div class="editor-actions"><button class="challenge-action secondary" id="reset-code">${icon('rotate-ccw')} Reset Kode</button><span class="spacer"></span><button class="primary-action" id="run-tests">${icon('play')} Jalankan Test</button></div><div class="test-results" id="test-results" aria-live="polite"></div></section></div>`;
        $('luau-editor').value = codeValue; refreshIcons();
    }
    function runTests() {
        const c = active; if (!c) return; codeValue = $('luau-editor').value;
        const results = c.tests.map(([name, regex]) => ({ name, pass: regex.test(codeValue) }));
        const count = results.filter(r => r.pass).length, all = count === results.length;
        const box = $('test-results'); box.classList.add('visible');
        box.innerHTML = `<h4>${icon('list-checks')} Hasil Pengujian (${count}/${results.length})</h4>${results.map(r => `<div class="test-line ${r.pass ? 'pass' : 'fail'}">${icon(r.pass ? 'check-circle-2' : 'x-circle')}<span>${esc(r.name)}</span><strong>${r.pass ? 'Lolos' : 'Belum lolos'}</strong></div>`).join('')}<div class="test-summary ${all ? 'pass' : 'fail'}">${all ? 'Semua pemeriksaan pola kode lolos. Untuk kelulusan Roblox sebenarnya, script tetap perlu diuji di Roblox Engine.' : 'Masih ada kriteria yang belum ditemukan di kode. Perbaiki script lalu jalankan test lagi.'}</div>${all ? '<button class="primary-action" id="finish-challenge" style="width:100%;margin-top:12px">Selesaikan Challenge ' + icon('play') + '</button>' : ''}`;
        refreshIcons(); if (all) $('finish-challenge').addEventListener('click', finishChallenge);
    }
    function finishChallenge() {
        if (!active) return; passed.add(active.id); localStorage.setItem('rlc_demo_completed_challenges', JSON.stringify([...passed])); started.delete(active.id); localStorage.setItem('rlc_demo_started_challenges', JSON.stringify([...started])); setView('challenge-result-view');
        $('challenge-result-view').innerHTML = `<div class="completion-wrap"><div class="completion-icon">${icon('trophy')}</div><h2>Test Berhasil!</h2><p>Semua pemeriksaan pola kode untuk <strong>${esc(active.title)}</strong> sudah lolos di demo frontend ini.</p><div class="completion-reward"><div class="reward-box">${icon('star')} +${active.xp} XP</div><div class="reward-box">${icon('check-circle-2')} Challenge Selesai (Demo)</div></div><p style="font-size:12px">Status dan XP ini disimpan di browser untuk prototipe. Integrasi backend dan pengujian Luau di Roblox Engine masih diperlukan untuk kelulusan produksi.</p><div class="completion-buttons"><button class="challenge-action secondary" id="result-detail">Lihat Detail</button><button class="primary-action" id="result-list">Kembali ke Challenges ${icon('play')}</button></div></div>`;
        updateStats(); refreshIcons(); $('result-detail').addEventListener('click', () => detail(active)); $('result-list').addEventListener('click', goList);
    }
    $('filter-row').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (!b) return; selectedFilter = b.dataset.filter; $('filter-row').querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b)); renderCards() });
    $('challenge-search').addEventListener('input', e => { searchTerm = e.target.value; renderCards() });
    $('challenge-grid').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) { const c = challenges.find(x => x.id === b.dataset.open); detail(c) } });
    document.addEventListener('click', e => {
        if (e.target.closest('[data-back]')) goList();
        if (e.target.closest('[data-start]')) workspace(active);
        if (e.target.closest('[data-detail]')) detail(active);
        if (e.target.closest('#run-tests')) runTests();
        if (e.target.closest('#reset-code') && active) { $('luau-editor').value = active.starter; $('test-results').classList.remove('visible') }
    });
    renderCards();
})();