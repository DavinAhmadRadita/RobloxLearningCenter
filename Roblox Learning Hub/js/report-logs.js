(() => {
  const $ = (selector) => document.querySelector(selector);
  const list = $("#report-list");
  const detail = $("#report-detail");
  const search = $("#report-search");
  const sort = $("#report-sort");
  let reports = [];
  let selectedKey = "";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const dateLabel = (value) => value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
  const logout = $("#report-logout");
  if (logout) logout.addEventListener("click", async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch (_) {}
    location.href = "login.html";
  });
  function emptyDetail() {
    detail.hidden = true;
    document.querySelector(".report-workspace")?.classList.remove("has-selection");
    detail.innerHTML = `<div class="report-detail-heading"><button type="button" class="report-back-button" id="report-back"><i data-lucide="arrow-left"></i><span>Kembali</span></button><span><i data-lucide="file-text"></i></span><h2>Detail Laporan</h2></div><div class="report-detail-empty"><i data-lucide="mouse-pointer-click"></i><strong>Pilih laporan untuk melihat detail</strong><p>Informasi konten, daftar pelapor, dan alasan laporan akan ditampilkan di sini.</p></div>`;
    if (window.lucide) lucide.createIcons();
  }
  function renderList() {
    const q = (search.value || "").trim().toLowerCase();
    let rows = reports.filter((r) => [r.topicTitle, r.contentAuthor, r.contentType].join(" ").toLowerCase().includes(q));
    if (sort.value === "many") rows.sort((a,b) => Number(b.reporterCount)-Number(a.reporterCount));
    else rows.sort((a,b) => new Date(b.latestReportAt)-new Date(a.latestReportAt));
    $("#report-total").textContent = reports.length;
    $("#reporters-total").textContent = reports.reduce((sum, r) => sum + Number(r.reporterCount || 0), 0);
    if (!rows.length) {
      list.innerHTML = `<div class="report-empty"><span><i data-lucide="inbox"></i></span><strong>${q ? "Laporan tidak ditemukan" : "Belum ada laporan"}</strong><p>${q ? "Coba kata kunci lain." : "Konten akan muncul di sini setelah menerima laporan dari minimal 5 pengguna berbeda."}</p></div>`;
    } else {
      list.innerHTML = rows.map((r) => `<button type="button" class="report-row ${selectedKey === r.contentKey ? "active" : ""}" data-report-key="${esc(r.contentKey)}"><span class="report-row-icon"><i data-lucide="${r.contentType === "comment" ? "message-circle" : "file-text"}"></i></span><span class="report-row-copy"><strong>${esc(r.topicTitle)}</strong><small>${r.contentType === "comment" ? "Komentar" : "Topik"} · oleh ${esc(r.contentAuthor)}</small></span><span class="report-count">${Number(r.reporterCount)} pelapor</span></button>`).join("");
    }
    if (window.lucide) lucide.createIcons();
    list.querySelectorAll("[data-report-key]").forEach((button) => button.addEventListener("click", () => loadDetail(button.dataset.reportKey)));
  }
  async function loadDetail(key) {
    selectedKey = key;
    renderList();
    detail.hidden = false;
    document.querySelector(".report-workspace")?.classList.add("has-selection");
    detail.innerHTML = `<div class="report-detail-heading"><button type="button" class="report-back-button" id="report-back"><i data-lucide="arrow-left"></i><span>Kembali</span></button><span><i data-lucide="file-text"></i></span><h2>Detail Laporan</h2></div><div class="report-detail-empty"><strong>Memuat detail laporan...</strong></div>`;
    try {
      const response = await fetch(`/api/forum/reports/${encodeURIComponent(key)}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal memuat detail.");
      const rows = data.reports || [];
      const first = rows[0] || {};
      detail.innerHTML = `<div class="report-detail-heading"><button type="button" class="report-back-button" id="report-back"><i data-lucide="arrow-left"></i><span>Kembali</span></button><span><i data-lucide="file-text"></i></span><h2>Detail Laporan</h2></div><div class="report-detail-content"><div class="report-content-summary"><span class="report-content-type">${first.contentType === "comment" ? "KOMENTAR" : "TOPIK"}</span><h3>${esc(first.topicTitle)}</h3><p><strong>Konten oleh:</strong> ${esc(first.contentAuthor)}</p><blockquote>${esc(first.contentText)}</blockquote><strong class="reporter-heading">Daftar Pelapor (${rows.length})</strong></div><div class="reporter-list">${rows.map((r) => `<article class="reporter-item"><div><strong>@${esc(r.reporterUsername)}</strong><small>${dateLabel(r.reportedAt)}</small></div><p>${esc(r.reason)}</p></article>`).join("")}</div></div>`;
      if (window.lucide) lucide.createIcons();
    } catch (error) {
      detail.innerHTML = `<div class="report-detail-heading"><button type="button" class="report-back-button" id="report-back"><i data-lucide="arrow-left"></i><span>Kembali</span></button><span><i data-lucide="file-text"></i></span><h2>Detail Laporan</h2></div><div class="report-detail-empty"><strong>Gagal memuat laporan</strong><p>${esc(error.message)}</p></div>`;
      if (window.lucide) lucide.createIcons();
    }
  }
  detail.addEventListener("click", (event) => {
    if (event.target.closest("#report-back")) {
      selectedKey = "";
      emptyDetail();
      renderList();
    }
  });
  search.addEventListener("input", renderList);
  sort.addEventListener("change", renderList);
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then(async (response) => {
      if (response.status === 401) { location.href = "login.html"; return null; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Tidak dapat memeriksa role.");
      return data;
    })
    .then(async (data) => {
      if (!data || !data.user) return;
      const role = String(data.user.role || "").toLowerCase();
      if (!["admin", "moderator"].includes(role)) { alert("Halaman ini hanya dapat diakses oleh Admin dan Moderator."); location.href = "dashboard.html"; return; }
      const nav = document.querySelector(".navigation");
      if (nav) {
        nav.querySelectorAll("[data-report-logs-link], [data-admin-users-link]").forEach((item) => item.remove());
        const report = document.createElement("a");
        report.className = "nav-item active"; report.href = "report-logs.html"; report.dataset.reportLogsLink = "true";
        report.innerHTML = '<span class="nav-icon"><i data-lucide="file-warning" aria-hidden="true"></i></span><span>REPORT LOGS</span>';
        const challenges = nav.querySelector('a[href="challenges.html"]');
        if (challenges) challenges.insertAdjacentElement("afterend", report); else nav.appendChild(report);
        if (role === "admin") {
          const users = document.createElement("a"); users.className = "nav-item"; users.href = "users.html"; users.dataset.adminUsersLink = "true";
          users.innerHTML = '<span class="nav-icon"><i data-lucide="users" aria-hidden="true"></i></span><span>KELOLA PENGGUNA</span>';
          report.insertAdjacentElement("afterend", users);
        }
      }
      const response = await fetch("/api/forum/reports", { credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Tidak dapat memuat laporan.");
      reports = result.reports || [];
      renderList(); emptyDetail();
      if (window.lucide) lucide.createIcons();
    })
    .catch((error) => {
      console.error("Report Logs:", error);
      list.innerHTML = `<div class="report-empty"><strong>Gagal memuat Report Logs</strong><p>${esc(error.message)}</p></div>`;
    });
})();
