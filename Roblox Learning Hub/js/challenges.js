(() => {
    const $ = (id) => document.getElementById(id);
    const currentRole = String(
        sessionStorage.getItem("rlc_user_role") || "",
    ).toLowerCase();
    const currentUsername = String(
        sessionStorage.getItem("rlc_current_user") ||
        localStorage.getItem("rlc_remembered_user") ||
        "",
    ).toLowerCase();
    let accountRole = "";
    try {
        const accounts = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
        const account = Object.values(accounts).find(
            (a) => a && String(a.username || "").toLowerCase() === currentUsername,
        );
        accountRole = String(
            (account && (account.role || account.userRole || account.accountType)) ||
            "",
        ).toLowerCase();
    } catch (_) { }
    const isAdmin =
        currentRole === "admin" ||
        accountRole === "admin" ||
        currentUsername === "admin_demo";
    let challenges = [];
    try {
        const saved = JSON.parse(
            localStorage.getItem("rlc_admin_challenges") || "[]",
        );
        challenges = (Array.isArray(saved) ? saved : []).map((c) => ({
            ...c,
            tests: Array.isArray(c.tests)
                ? c.tests.map((t) => {
                    if (Array.isArray(t))
                        return [
                            t[0],
                            t[1] instanceof RegExp
                                ? t[1]
                                : new RegExp(String(t[1] || ""), "i"),
                        ];
                    return [
                        t.name || "Pemeriksaan kode",
                        new RegExp(String(t.pattern || ""), "i"),
                    ];
                })
                : [],
            requirements: Array.isArray(c.requirements) ? c.requirements : [],
            learn: Array.isArray(c.learn)
                ? c.learn
                : Array.isArray(c.requirements)
                    ? c.requirements
                    : [],
        }));
    } catch (_) {
        challenges = [];
    }
    let searchTerm = "",
        active = null,
        codeValue = "",
        selectedThumbnail = "",
        passed = new Set(
            JSON.parse(localStorage.getItem("rlc_demo_completed_challenges") || "[]"),
        ),
        started = new Set(
            JSON.parse(localStorage.getItem("rlc_demo_started_challenges") || "[]"),
        );
    challenges = challenges.filter((c) => c.status !== "draft");
    passed = new Set(
        [...passed].filter((id) => challenges.some((c) => c.id === id)),
    );
    started = new Set(
        [...started].filter((id) => challenges.some((c) => c.id === id)),
    );
    const esc = (s) =>
        String(s).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[c],
        );
    function icon(name) {
        return `<i data-lucide="${name}" aria-hidden="true"></i>`;
    }
    function refreshIcons() {
        if (window.lucide) window.lucide.createIcons();
    }
    function showToast(msg) {
        const t = $("challenge-toast");
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 2400);
    }
    function status(c) {
        return passed.has(c.id)
            ? "Selesai"
            : started.has(c.id)
                ? "Dilanjutkan"
                : "Mulai";
    }
    function updateStats() {
        $("total-count").textContent = challenges.length;
        $("done-count").textContent = passed.size;
        $("working-count").textContent = [...started].filter(
            (id) => !passed.has(id),
        ).length;
        $("todo-count").textContent = challenges.filter(
            (c) => !passed.has(c.id) && !started.has(c.id),
        ).length;
    }
    const adminActions = $("challenge-admin-actions");
    const modal = $("challenge-modal-backdrop");
    const criteriaList = $("admin-challenge-criteria-list");
    if (isAdmin && adminActions) adminActions.hidden = false;
    function addCriterionRow(name = "", pattern = "") {
        if (!criteriaList) return;
        const row = document.createElement("div");
        row.className = "challenge-criterion-row";
        row.innerHTML = `<label>Kriteria yang diperiksa<input class="criterion-name" required maxlength="140" placeholder="Contoh: Menggunakan event Touched" value="${esc(name)}"></label><label>Pola kode (RegExp)<input class="criterion-pattern" required maxlength="180" placeholder="Contoh: \.Touched" value="${esc(pattern)}"></label><button type="button" class="remove-criterion" aria-label="Hapus kriteria">${icon("trash-2")}</button>`;
        row
            .querySelector(".remove-criterion")
            .addEventListener("click", () => row.remove());
        criteriaList.appendChild(row);
        refreshIcons();
    }
    function openAdminModal() {
        if (!isAdmin) return;
        $("challenge-admin-form").reset();
        criteriaList.innerHTML = "";
        addCriterionRow("Menggunakan event Touched", "\\.Touched");
        addCriterionRow("Mencari Humanoid karakter", "Humanoid");
        addCriterionRow("Memberikan damage", "TakeDamage");
        $("admin-challenge-xp").value = "100";
        $("admin-challenge-attempts").value = "0";
        selectedThumbnail = "";
        $("admin-challenge-thumbnail").value = "";
        $("admin-challenge-thumbnail-preview").hidden = true;
        $("challenge-form-error").classList.remove("visible");
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        $("admin-challenge-title").focus();
        refreshIcons();
    }
    function closeAdminModal() {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }
    function saveAdminChallenge(event) {
        event.preventDefault();
        if (!isAdmin) return;
        const error = $("challenge-form-error");
        const criteria = [
            ...criteriaList.querySelectorAll(".challenge-criterion-row"),
        ].map((row) => ({
            name: row.querySelector(".criterion-name").value.trim(),
            pattern: row.querySelector(".criterion-pattern").value.trim(),
        }));
        if (!criteria.length) {
            error.textContent = "Tambahkan minimal satu kriteria pengujian.";
            error.classList.add("visible");
            return;
        }
        let tests = [];
        try {
            tests = criteria.map((item) => [
                item.name,
                new RegExp(item.pattern, "i"),
            ]);
        } catch (_) {
            error.textContent =
                "Pola RegExp tidak valid. Periksa kembali pola kode pada kriteria.";
            error.classList.add("visible");
            return;
        }
        const title = $("admin-challenge-title").value.trim();
        const desc = $("admin-challenge-desc").value.trim();
        if (!title || !desc) {
            error.textContent = "Judul dan deskripsi wajib diisi.";
            error.classList.add("visible");
            return;
        }
        const challenge = {
            id:
                "challenge-" +
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 6),
            title,
            level: $("admin-challenge-level").value,
            category: "Lainnya",
            thumbnail: selectedThumbnail,
            desc,
            instructions: $("admin-challenge-instructions").value.trim(),
            location: $("admin-challenge-location").value,
            starter:
                $("admin-challenge-starter").value || "-- Tulis kode Luau di sini\n",
            requirements: criteria.map((item) => item.name),
            learn: criteria.map((item) => item.name),
            tests,
            testNotes: $("admin-challenge-test-notes").value.trim(),
            xp: Number($("admin-challenge-xp").value) || 0,
            attempts: Number($("admin-challenge-attempts").value) || 0,
            icon: "code-2",
            status: $("admin-challenge-status").value,
            createdAt: new Date().toISOString(),
        };
        const serialized = (item) => ({
            ...item,
            tests: (item.tests || []).map((t) =>
                Array.isArray(t)
                    ? {
                        name: t[0],
                        pattern:
                            t[1] instanceof RegExp ? t[1].source : String(t[1] || ""),
                    }
                    : t,
            ),
        });
        if (challenge.status === "draft") {
            let drafts = [];
            try {
                drafts = JSON.parse(
                    localStorage.getItem("rlc_admin_challenge_drafts") || "[]",
                );
            } catch (_) { }
            drafts = Array.isArray(drafts) ? drafts : [];
            drafts.push(serialized(challenge));
            localStorage.setItem(
                "rlc_admin_challenge_drafts",
                JSON.stringify(drafts),
            );
            showToast("Draft challenge berhasil disimpan.");
        } else {
            const published = serialized(challenge);
            published.status = "published";
            let saved = [];
            try {
                saved = JSON.parse(
                    localStorage.getItem("rlc_admin_challenges") || "[]",
                );
            } catch (_) { }
            saved = Array.isArray(saved) ? saved : [];
            saved.push(published);
            localStorage.setItem("rlc_admin_challenges", JSON.stringify(saved));
            challenges.push({ ...challenge, status: "published" });
            showToast("Challenge berhasil dipublikasikan!");
            renderCards();
        }
        closeAdminModal();
    }
    if (isAdmin) {
        $("admin-challenge-thumbnail")?.addEventListener("change", (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) {
                showToast("Pilih file gambar untuk thumbnail.");
                event.target.value = "";
                return;
            }
            if (file.size > 1.5 * 1024 * 1024) {
                showToast("Ukuran thumbnail maksimal 1,5 MB.");
                event.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                selectedThumbnail = String(reader.result || "");
                $("admin-challenge-thumbnail-image").src = selectedThumbnail;
                $("admin-challenge-thumbnail-preview").hidden = !selectedThumbnail;
            };
            reader.readAsDataURL(file);
        });
        $("remove-challenge-thumbnail")?.addEventListener("click", () => {
            selectedThumbnail = "";
            $("admin-challenge-thumbnail").value = "";
            $("admin-challenge-thumbnail-preview").hidden = true;
            $("admin-challenge-thumbnail-image").removeAttribute("src");
        });
        $("add-challenge-button")?.addEventListener("click", openAdminModal);
        $("close-challenge-modal")?.addEventListener("click", closeAdminModal);
        $("cancel-challenge-modal")?.addEventListener("click", closeAdminModal);
        $("add-challenge-criterion")?.addEventListener("click", () =>
            addCriterionRow(),
        );
        $("challenge-admin-form")?.addEventListener("submit", saveAdminChallenge);
        modal?.addEventListener("click", (event) => {
            if (event.target === modal) closeAdminModal();
        });
        document.addEventListener("keydown", (event) => {
            if (
                event.key === "Escape" &&
                modal &&
                !modal.classList.contains("hidden")
            )
                closeAdminModal();
        });
    }
    function renderCards() {
        const list = challenges.filter((c) =>
            `${c.title} ${c.desc} ${c.category} ${c.level}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase()),
        );
        $("challenge-grid").innerHTML = list.length
            ? list
                .map(
                    (c) =>
                        `<article class="challenge-card"><div class="challenge-card-art ${c.category === "Trap" ? "art-trap" : c.category === "Checkpoint" ? "art-checkpoint" : c.category === "Game System" ? "art-door" : ""}">${c.thumbnail ? `<img class="challenge-card-thumbnail" src="${c.thumbnail}" alt="Thumbnail ${esc(c.title)}" loading="lazy">` : icon(c.icon || "code-2")}<span class="challenge-level">${esc(c.level)}</span></div><div class="challenge-card-body"><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p><div class="challenge-meta"><span class="xp-tag">${icon("star")} ${c.xp} XP</span><button class="challenge-action ${passed.has(c.id) ? "secondary" : ""}" data-open="${c.id}">${passed.has(c.id) ? "Lihat Lagi" : started.has(c.id) ? "Lanjutkan" : "Mulai"} ${icon("play")}</button></div></div></article>`,
                )
                .join("")
            : challenges.length
                ? '<div class="empty-state">Challenge tidak ditemukan. Coba kata kunci atau filter lain.</div>'
                : '<div class="empty-state challenge-empty-state"><i data-lucide="flag"></i><h3>Belum ada challenges</h3><p>Challenge akan muncul di sini setelah admin menambahkannya.</p></div>';
        updateStats();
        refreshIcons();
    }
    function setView(id) {
        [
            "challenge-list-view",
            "challenge-detail-view",
            "challenge-work-view",
            "challenge-result-view",
        ].forEach((v) => $(v).classList.toggle("hidden", v !== id));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function goList() {
        setView("challenge-list-view");
        renderCards();
    }
    function detail(c) {
        active = c;
        setView("challenge-detail-view");
        $("challenge-detail-view").innerHTML =
            `<button class="back-link" data-back>${icon("arrow-left")} Kembali ke Challenges</button><div class="detail-top"><div class="detail-art">${icon(c.icon)}</div><div><div class="detail-chips"><span class="detail-chip">${esc(c.level)}</span><span class="detail-chip">Roblox Luau</span></div><h2>${esc(c.title)}</h2><p>${esc(c.instructions || c.desc)}</p><div class="detail-chips"><span class="detail-chip">${icon("star")} ${c.xp} XP</span><span class="detail-chip">${icon("code-2")} Editor Luau</span></div></div></div><div class="detail-columns"><section class="detail-panel"><h3>Tujuan Challenge</h3><ul>${c.requirements.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section><section class="detail-panel"><h3>Yang Akan Kamu Pelajari</h3><div class="learning-list">${c.learn.map((x) => `<div>${icon("check-circle-2")}<span>${esc(x)}</span></div>`).join("")}</div></section></div><button class="primary-action detail-start" data-start>${passed.has(c.id) ? "Coba Lagi" : "Mulai Challenge"} ${icon("play")}</button>`;
        refreshIcons();
    }
    function workspace(c) {
        active = c;
        codeValue = c.starter;
        started.add(c.id);
        localStorage.setItem(
            "rlc_demo_started_challenges",
            JSON.stringify([...started]),
        );
        setView("challenge-work-view");
        $("challenge-work-view").innerHTML =
            `<button class="back-link" data-detail>${icon("arrow-left")} Kembali ke Detail Challenge</button><div class="workspace-head"><div><h2>${esc(c.title)}</h2><p>Tulis script Luau sesuai instruksi, lalu jalankan test case.</p></div><span class="step-progress">LANGKAH 1 DARI 2 · TULIS KODE</span></div><div class="workspace-grid"><section class="instructions-panel"><div class="panel-heading">${icon("book-open")} Instruksi <span class="detail-chip">Luau</span></div><div class="instruction-content"><h3>Tugas kamu</h3><p>${esc(c.instructions || c.desc)}</p><h3>Kriteria kelulusan</h3><ul>${c.requirements.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><div class="hint-box"><strong>Tips</strong><br>Lengkapi bagian TODO. Klik <b>Jalankan Test</b> untuk memeriksa apakah script mengandung struktur yang dibutuhkan. Demo ini memeriksa pola kode, bukan menjalankan Roblox Engine.</div></div></section><section class="editor-panel"><div class="panel-heading"><span>${icon("file-code-2")} Script (ServerScriptService / NPC)</span><span class="detail-chip">Luau</span></div><textarea id="luau-editor" class="code-editor" spellcheck="false" aria-label="Editor kode Luau"></textarea><div class="editor-actions"><button class="challenge-action secondary" id="reset-code">${icon("rotate-ccw")} Reset Kode</button><span class="spacer"></span><button class="primary-action" id="run-tests">${icon("play")} Jalankan Test</button></div><div class="test-results" id="test-results" aria-live="polite"></div></section></div>`;
        $("luau-editor").value = codeValue;
        refreshIcons();
    }
    function runTests() {
        const c = active;
        if (!c) return;
        codeValue = $("luau-editor").value;
        const results = c.tests.map(([name, regex]) => ({
            name,
            pass: regex.test(codeValue),
        }));
        const count = results.filter((r) => r.pass).length,
            all = count === results.length;
        const box = $("test-results");
        box.classList.add("visible");
        box.innerHTML = `<h4>${icon("list-checks")} Hasil Pengujian (${count}/${results.length})</h4>${results.map((r) => `<div class="test-line ${r.pass ? "pass" : "fail"}">${icon(r.pass ? "check-circle-2" : "x-circle")}<span>${esc(r.name)}</span><strong>${r.pass ? "Lolos" : "Belum lolos"}</strong></div>`).join("")}<div class="test-summary ${all ? "pass" : "fail"}">${all ? "Semua pemeriksaan pola kode lolos. Untuk kelulusan Roblox sebenarnya, script tetap perlu diuji di Roblox Engine." : "Masih ada kriteria yang belum ditemukan di kode. Perbaiki script lalu jalankan test lagi."}</div>${all ? '<button class="primary-action" id="finish-challenge" style="width:100%;margin-top:12px">Selesaikan Challenge ' + icon("play") + "</button>" : ""}`;
        refreshIcons();
        if (all) $("finish-challenge").addEventListener("click", finishChallenge);
    }
    function finishChallenge() {
        if (!active) return;
        passed.add(active.id);
        localStorage.setItem(
            "rlc_demo_completed_challenges",
            JSON.stringify([...passed]),
        );
        started.delete(active.id);
        localStorage.setItem(
            "rlc_demo_started_challenges",
            JSON.stringify([...started]),
        );
        setView("challenge-result-view");
        $("challenge-result-view").innerHTML =
            `<div class="completion-wrap"><div class="completion-icon">${icon("trophy")}</div><h2>Test Berhasil!</h2><p>Semua pemeriksaan pola kode untuk <strong>${esc(active.title)}</strong> sudah lolos di demo frontend ini.</p><div class="completion-reward"><div class="reward-box">${icon("star")} +${active.xp} XP</div><div class="reward-box">${icon("check-circle-2")} Challenge Selesai (Demo)</div></div><p style="font-size:12px">Status dan XP ini disimpan di browser untuk prototipe. Integrasi backend dan pengujian Luau di Roblox Engine masih diperlukan untuk kelulusan produksi.</p><div class="completion-buttons"><button class="challenge-action secondary" id="result-detail">Lihat Detail</button><button class="primary-action" id="result-list">Kembali ke Challenges ${icon("play")}</button></div></div>`;
        updateStats();
        refreshIcons();
        $("result-detail").addEventListener("click", () => detail(active));
        $("result-list").addEventListener("click", goList);
    }
    $("challenge-search").addEventListener("input", (e) => {
        searchTerm = e.target.value;
        renderCards();
    });
    $("challenge-grid").addEventListener("click", (e) => {
        const b = e.target.closest("[data-open]");
        if (b) {
            const c = challenges.find((x) => x.id === b.dataset.open);
            detail(c);
        }
    });
    document.addEventListener("click", (e) => {
        if (e.target.closest("[data-back]")) goList();
        if (e.target.closest("[data-start]")) workspace(active);
        if (e.target.closest("[data-detail]")) detail(active);
        if (e.target.closest("#run-tests")) runTests();
        if (e.target.closest("#reset-code") && active) {
            $("luau-editor").value = active.starter;
            $("test-results").classList.remove("visible");
        }
    });
    renderCards();
})();
