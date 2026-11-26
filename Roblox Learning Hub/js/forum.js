(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const workspace = $("#forum-workspace"),
    listEl = $("#topic-list"),
    threadPanel = $("#thread-panel");
  const tabs = $$("#category-tabs .category-tab"),
    searchInput = $("#topic-search"),
    sortSelect = $("#topic-sort");
  const modal = $("#create-modal"),
    form = $("#create-form"),
    toast = $("#forum-toast");
  const currentUser =
    sessionStorage.getItem("rlc_current_user") ||
    localStorage.getItem("rlc_remembered_user") ||
    "";
  const userKey = (currentUser || "guest").toLowerCase();
  const currentRole = (
    sessionStorage.getItem("rlc_user_role") ||
    localStorage.getItem("rlc_user_role") ||
    "learner"
  ).toLowerCase();
  const isModerator = currentRole === "admin" || currentRole === "moderator";
  const read = (key, fallback = "") => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  };
  const displayName = currentUser
    ? read(`rlc_display_name_${userKey}`, currentUser)
    : "Pengunjung";
  const avatarSrc = (value) =>
    value && value.startsWith("data:")
      ? value
      : `assets/avatars/${/^avatar-\d{2}$/.test(value || "") ? value : "avatar-01"}.png`;
  const myAvatar = avatarSrc(
    currentUser ? read(`rlc_avatar_${userKey}`, "avatar-01") : "avatar-01",
  );
  const categoryClass = (c) =>
    c === "Diskusi"
      ? "tag-diskusi"
      : c === "Tips & Tutorial"
        ? "tag-tips"
        : c === "Showcase"
          ? "tag-showcase"
          : "tag-help";
  const categoryIcon = (c) =>
    c === "Diskusi"
      ? "message-circle"
      : c === "Tips & Tutorial"
        ? "lightbulb"
        : c === "Showcase"
          ? "image"
          : "circle-help";
  const ago = (mins) =>
    mins < 60
      ? `${mins} menit lalu`
      : mins < 1440
        ? `${Math.floor(mins / 60)} jam lalu`
        : `${Math.floor(mins / 1440)} hari lalu`;
  let activeCategory = "Semua Topik",
    selectedId = null,
    selectedCategory = "Diskusi",
    imageData = "",
    nextId = 100;
  const TOPICS_STORAGE_KEY = "rlc_forum_topics_v1";
  let topics = [];
  async function forumRequest(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Permintaan forum gagal.");
    return data;
  }
  async function loadTopicsFromDatabase() {
    const data = await forumRequest("/api/forum/topics");
    topics = Array.isArray(data.topics) ? data.topics : [];
    if (!topics.length && currentUser) {
      let legacy = [];
      try {
        legacy = JSON.parse(localStorage.getItem(TOPICS_STORAGE_KEY) || "[]");
      } catch (_) { legacy = []; }
      if (Array.isArray(legacy) && legacy.length) {
        await forumRequest("/api/forum/migrate-local", {
          method: "POST",
          body: JSON.stringify({ topics: legacy }),
        });
        const refreshed = await forumRequest("/api/forum/topics");
        topics = Array.isArray(refreshed.topics) ? refreshed.topics : [];
      }
    }
    topics.forEach(topic => {
      topic.ownerKey = String(topic.authorUsername || topic.ownerKey || "").toLowerCase();
      topic.comments = Array.isArray(topic.comments) ? topic.comments : [];
      topic.comments.forEach(comment => {
        comment.ownerKey = String(comment.authorUsername || comment.ownerKey || "").toLowerCase();
      });
    });
    nextId = topics.reduce((max, topic) => Math.max(max, Number(topic.id) || 0), 99) + 1;
  }
  function saveTopics() {
  }
  function openReportReasonModal({ type, topic, comment = null }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "forum-report-overlay";
      const modal = document.createElement("section");
      modal.className = "forum-report-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "forum-report-title");

      const heading = document.createElement("div");
      heading.className = "forum-report-heading";
      const titleWrap = document.createElement("div");
      const eyebrow = document.createElement("div");
      eyebrow.className = "forum-report-eyebrow";
      eyebrow.textContent = "MODERATION CENTER";
      const title = document.createElement("h2");
      title.id = "forum-report-title";
      title.textContent = "Laporkan " + (type === "comment" ? "Komentar" : "Topik");
      titleWrap.append(eyebrow, title);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "forum-report-close";
      close.setAttribute("aria-label", "Tutup");
      close.innerHTML = '<i data-lucide="x"></i>';
      heading.append(titleWrap, close);

      const intro = document.createElement("p");
      intro.className = "forum-report-intro";
      intro.textContent = "Bantu moderator memahami alasan konten ini perlu ditinjau.";

      const preview = document.createElement("div");
      preview.className = "forum-report-preview";
      const previewLabel = document.createElement("span");
      previewLabel.textContent = type === "comment" ? "KOMENTAR YANG DILAPORKAN" : "TOPIK YANG DILAPORKAN";
      const previewText = document.createElement("p");
      previewText.textContent = comment ? comment.text : (topic.title || topic.body || "Topik forum");
      preview.append(previewLabel, previewText);

      const label = document.createElement("label");
      label.className = "forum-report-label";
      label.textContent = "Alasan laporan";
      const textarea = document.createElement("textarea");
      textarea.className = "forum-report-textarea";
      textarea.placeholder = "Jelaskan alasan kamu melaporkan konten ini...";
      textarea.maxLength = 500;
      textarea.rows = 4;
      textarea.required = true;
      const hint = document.createElement("div");
      hint.className = "forum-report-hint";
      hint.textContent = "Maksimal 500 karakter.";

      const actions = document.createElement("div");
      actions.className = "forum-report-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "forum-report-cancel";
      cancel.textContent = "Batal";
      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "forum-report-submit";
      submit.innerHTML = '<i data-lucide="send"></i><span>Kirim Laporan</span>';
      actions.append(cancel, submit);
      modal.append(heading, intro, preview, label, textarea, hint, actions);
      overlay.append(modal);
      document.body.append(overlay);
      if (window.lucide) window.lucide.createIcons();
      textarea.focus();

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        document.removeEventListener("keydown", onKeyDown);
        resolve(value);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") finish(null);
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit.click();
      };
      close.addEventListener("click", () => finish(null));
      cancel.addEventListener("click", () => finish(null));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish(null);
      });
      submit.addEventListener("click", () => {
        const value = textarea.value.trim();
        if (!value) {
          textarea.classList.add("invalid");
          textarea.focus();
          hint.textContent = "Alasan laporan wajib diisi.";
          hint.classList.add("error");
          return;
        }
        finish(value);
      });
      textarea.addEventListener("input", () => {
        textarea.classList.remove("invalid");
        hint.textContent = "Maksimal 500 karakter.";
        hint.classList.remove("error");
      });
      document.addEventListener("keydown", onKeyDown);
    });
  }

  async function submitForumReport({ type, topic, comment = null, commentIndex = null }) {
    if (!currentUser) {
      showToast("Silakan login untuk melaporkan konten.");
      return;
    }
    const reason = await openReportReasonModal({ type, topic, comment });
    if (reason === null) return;
    const contentText = comment ? comment.text : `${topic.title}\n${topic.body}`;
    try {
      const response = await fetch("/api/forum/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          type,
          topicId: String(topic.id),
          topicTitle: topic.title,
          contentAuthor: comment ? comment.author : topic.author,
          contentText,
          commentIndex,
          reason: reason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Laporan gagal dikirim.");
      showToast(data.message || "Laporan berhasil dikirim.");
    } catch (error) {
      showToast(error.message || "Laporan gagal dikirim. Coba lagi.");
    }
  }
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function showDeleteConfirm(message, title = "Konfirmasi Hapus") {
    return new Promise((resolve) => {
      let overlay = document.getElementById("forum-confirm-modal");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "forum-confirm-modal";
        overlay.className = "forum-confirm-overlay";
        overlay.innerHTML = `
          <section class="forum-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="forum-confirm-title">
            <div class="forum-confirm-icon"><i data-lucide="trash-2"></i></div>
            <h2 id="forum-confirm-title"></h2>
            <p class="forum-confirm-message"></p>
            <div class="forum-confirm-actions">
              <button type="button" class="forum-confirm-cancel">Batal</button>
              <button type="button" class="forum-confirm-delete"><i data-lucide="trash-2"></i> Hapus</button>
            </div>
          </section>`;
        document.body.appendChild(overlay);
      }
      overlay.querySelector("#forum-confirm-title").textContent = title;
      overlay.querySelector(".forum-confirm-message").textContent = message;
      overlay.classList.add("show");
      if (window.lucide) lucide.createIcons();
      const cancel = overlay.querySelector(".forum-confirm-cancel");
      const confirm = overlay.querySelector(".forum-confirm-delete");
      const finish = (value) => {
        overlay.classList.remove("show");
        cancel.removeEventListener("click", onCancel);
        confirm.removeEventListener("click", onConfirm);
        overlay.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKey);
        resolve(value);
      };
      const onCancel = (event) => {
        event.stopPropagation();
        finish(false);
      };
      const onConfirm = (event) => {
        event.stopPropagation();
        finish(true);
      };
      const onBackdrop = (event) => {
        event.stopPropagation();
        if (event.target === overlay) finish(false);
      };
      const onKey = (event) => { if (event.key === "Escape") finish(false); };
      cancel.addEventListener("click", onCancel);
      confirm.addEventListener("click", onConfirm);
      overlay.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKey);
      cancel.focus();
    });
  }
  function visibleTopics() {
    let arr = topics.filter(
      (t) => activeCategory === "Semua Topik" || t.category === activeCategory,
    );
    const q = searchInput.value.trim().toLowerCase();
    if (q)
      arr = arr.filter((t) =>
        [t.title, t.body, t.author, t.category]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    if (sortSelect.value === "popular") arr.sort((a, b) => b.likes - a.likes);
    else if (sortSelect.value === "comments")
      arr.sort((a, b) => b.comments.length - a.comments.length);
    else arr.sort((a, b) => a.minutes - b.minutes);
    return arr;
  }
  function renderList() {
    const arr = visibleTopics();
    listEl.innerHTML = arr
      .map(
        (
          t,
        ) => `<article class="topic-card ${String(t.id) === String(selectedId) ? "selected" : ""}" data-id="${t.id}" tabindex="0" role="button" aria-label="Buka topik ${esc(t.title)}">
      ${t.image ? `<img class="topic-thumb" src="${t.image}" alt="" onerror="this.style.display='none'">` : `<div class="topic-thumb placeholder"><i data-lucide="${categoryIcon(t.category)}"></i></div>`}
      <div class="topic-copy"><span class="topic-tag ${categoryClass(t.category)}"><i data-lucide="${categoryIcon(t.category)}"></i>${esc(t.category)}</span><h3 class="topic-title">${esc(t.title)}</h3><p class="topic-excerpt">${esc(t.body)}</p><div class="topic-meta"><span><i data-lucide="message-circle"></i>${t.comments.length}</span><span><i data-lucide="heart"></i>${t.likes}</span></div></div>
      <div class="topic-author"><img src="${avatarSrc(t.avatar)}" alt=""><div><span>${esc(t.author)}</span><small>${ago(t.minutes)}</small></div></div><button class="topic-more" type="button" aria-label="Opsi topik" aria-haspopup="menu" aria-expanded="false"><i data-lucide="ellipsis-vertical"></i></button>
    </article>`,
      )
      .join("");

    $$(".topic-card", listEl).forEach((card) => {
      card.classList.toggle("selected", String(card.dataset.id) === String(selectedId));
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, .topic-menu, a, input, textarea, select")) return;
        selectTopic(card.dataset.id);
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectTopic(card.dataset.id);
        }
      });
    });

    const emptyState = $("#empty-results");
    emptyState.classList.toggle("hidden", arr.length > 0);
    if (emptyState) {
      const hasSearch =
        Boolean(searchInput.value.trim()) || activeCategory !== "Semua Topik";
      emptyState.querySelector("strong").textContent = hasSearch
        ? "Topik tidak ditemukan"
        : "Belum ada topik diskusi";
      emptyState.querySelector("span").textContent = hasSearch
        ? "Coba kata kunci atau kategori lain."
        : "Jadilah yang pertama membuat topik untuk memulai diskusi komunitas.";
    }
    if (window.lucide) lucide.createIcons();
  }
  function renderThread() {
    const t = topics.find((x) => String(x.id) === String(selectedId));
    if (!t) {
      threadPanel.classList.add("hidden");
      workspace.classList.remove("has-selection");
      return;
    }
    workspace.classList.add("has-selection");
    threadPanel.classList.remove("hidden");
    threadPanel.innerHTML = `<div class="thread-topbar"><button class="thread-close" id="close-thread" aria-label="Tutup diskusi"><i data-lucide="x"></i></button><h2>${esc(t.title)}</h2><button class="icon-button" id="thread-options" aria-label="Opsi"><i data-lucide="ellipsis"></i></button></div>
      <div class="thread-content"><div class="thread-author"><img src="${avatarSrc(t.avatar)}" alt=""><div><strong>${esc(t.author)}</strong><small>${esc(t.category)} · ${ago(t.minutes)}</small></div></div>
      <p class="thread-body">${esc(t.body)}</p>${t.image ? `<img class="thread-attachment" src="${t.image}" alt="Lampiran topik">` : ""}
      <div class="thread-actions"><button class="thread-action ${t.liked ? "liked" : ""}" id="like-topic"><i data-lucide="heart"></i>${t.likes} Suka</button><button class="thread-action"><i data-lucide="message-circle"></i>${t.comments.length} Komentar</button><button class="thread-action" id="copy-topic"><i data-lucide="link"></i>Salin tautan</button></div>
      <div class="comments-heading">Komentar <span>${t.comments.length} balasan</span></div><div class="comments-list">${t.comments.length ? t.comments.map((c, i) => `<div class="comment" data-comment-index="${i}"><img class="comment-avatar" src="${avatarSrc(c.avatar)}" alt=""><div class="comment-content"><div class="comment-heading"><span><span class="comment-name">${esc(c.author)}</span><span class="comment-time">${ago(c.minutes)}</span></span><button class="comment-more" type="button" data-comment-options="${i}" aria-label="Opsi komentar" aria-haspopup="menu" aria-expanded="false"><i data-lucide="ellipsis"></i></button></div><p class="comment-text">${esc(c.text)}</p><div class="comment-reply"><button data-comment-like="${i}">♡ ${c.likes || 0}</button><button data-reply="${i}">Balas</button></div></div></div>`).join("") : '<p class="no-comments">Belum ada komentar. Jadilah yang pertama membalas topik ini!</p>'}</div></div>
      <form class="comment-composer" id="comment-form"><img class="composer-avatar" src="${myAvatar}" alt=""><textarea id="comment-input" rows="1" maxlength="1000" placeholder="Tulis komentar..." required></textarea><button class="send-comment" type="submit" aria-label="Kirim komentar"><i data-lucide="send"></i></button></form>`;
    if (window.lucide) lucide.createIcons();
    $("#close-thread").addEventListener("click", closeSelectedTopic);
    $("#like-topic").addEventListener("click", async () => {
      if (!currentUser) return showToast("Silakan login untuk menyukai topik.");
      try {
        await forumRequest(`/api/forum/topics/${t.id}/like`, { method: "POST", body: "{}" });
        await loadTopicsFromDatabase();
        renderList(); renderThread();
      } catch (error) { showToast(error.message); }
    });
    $("#copy-topic").addEventListener("click", () => {
      const url = location.href.split("#")[0] + `#topic-${t.id}`;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard
          .writeText(url)
          .then(() => showToast("Tautan topik disalin."))
          .catch(() => showToast(url));
      else showToast("Topik dipilih: " + t.title);
    });
    $("#comment-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("#comment-input");
      const text = input.value.trim();
      if (!text) return;
      if (!currentUser) return showToast("Silakan login untuk berkomentar.");
      try {
        await forumRequest(`/api/forum/topics/${t.id}/comments`, {
          method: "POST",
          body: JSON.stringify({ text, authorName: displayName, avatar: read(`rlc_avatar_${userKey}`, "avatar-01") })
        });
        await loadTopicsFromDatabase();
        renderList(); renderThread();
        showToast("Komentar ditambahkan.");
      } catch (error) { showToast(error.message); }
    });
    $$("[data-comment-like]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const c = t.comments[+btn.dataset.commentLike];
        if (!currentUser) return showToast("Silakan login untuk menyukai komentar.");
        if (!c?.id) return;
        try {
          await forumRequest(`/api/forum/comments/${c.id}/like`, { method: "POST", body: "{}" });
          await loadTopicsFromDatabase();
          renderList(); renderThread();
        } catch (error) { showToast(error.message); }
      }),
    );
    $$("[data-reply]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const c = t.comments[+btn.dataset.reply];
        const input = $("#comment-input");
        input.value = `@${c.author} `;
        input.focus();
      }),
    );
    $$("[data-comment-options]").forEach((btn) =>
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const index = Number(btn.dataset.commentOptions);
        const comment = t.comments[index];
        if (!comment) return;
        const existing = btn.closest(".comment-content").querySelector(".comment-menu");
        if (existing) {
          existing.remove();
          btn.setAttribute("aria-expanded", "false");
          return;
        }
        closeTopicMenus();
        const ownComment = comment.ownerKey === userKey;
        const canDeleteComment = ownComment || isModerator;
        const menu = document.createElement("div");
        menu.className = "topic-menu comment-menu";
        menu.innerHTML = `${ownComment ? "" : '<button type="button" data-comment-action="report"><i data-lucide="flag"></i>Laporkan komentar</button>'}${canDeleteComment ? '<button type="button" class="danger" data-comment-action="delete"><i data-lucide="trash-2"></i>Hapus komentar</button>' : ""}`;
        btn.closest(".comment-content").appendChild(menu);
        btn.setAttribute("aria-expanded", "true");
        if (window.lucide) lucide.createIcons();
        menu.addEventListener("click", async (menuEvent) => {
          const action = menuEvent.target.closest("[data-comment-action]")?.dataset.commentAction;
          if (!action) return;
          menuEvent.stopPropagation();
          if (action === "report") {
            menu.remove();
            submitForumReport({ type: "comment", topic: t, comment, commentIndex: index });
          }
          if (action === "delete") {
            if (!canDeleteComment) return;
            if (!(await showDeleteConfirm("Komentar yang dihapus tidak dapat dikembalikan.", "Hapus komentar?"))) return;
            try {
              await forumRequest(`/api/forum/comments/${comment.id}`, { method: "DELETE" });
              await loadTopicsFromDatabase();
              renderList(); renderThread();
              showToast("Komentar berhasil dihapus.");
            } catch (error) { showToast(error.message); }
          }
        });
      }),
    );
    const options = $("#thread-options");
    options.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const existing = $("#thread-options-menu");
      if (existing) {
        existing.remove();
        options.setAttribute("aria-expanded", "false");
        return;
      }
      closeTopicMenus();
      const own = t.ownerKey === userKey;
      const canDelete = own || isModerator;
      const menu = document.createElement("div");
      menu.className = "topic-menu thread-options-menu";
      menu.id = "thread-options-menu";
      menu.innerHTML = `${own ? "" : '<button type="button" data-thread-action="report"><i data-lucide="flag"></i>Laporkan topik</button>'}${canDelete ? '<button type="button" class="danger" data-thread-action="delete"><i data-lucide="trash-2"></i>Hapus topik</button>' : ""}`;
      options.parentElement.style.position = "relative";
      options.setAttribute("aria-expanded", "true");
      options.parentElement.appendChild(menu);
      if (window.lucide) lucide.createIcons();
      menu.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const action = ev.target.closest("[data-thread-action]")?.dataset
          .threadAction;
        if (action === "report") {
          menu.remove();
          submitForumReport({ type: "topic", topic: t });
        }
        if (action === "delete") {
          if (!canDelete) return;
          if (!(await showDeleteConfirm("Topik beserta diskusi dan komentarnya akan dihapus permanen.", "Hapus topik?"))) return;
          try {
            await forumRequest(`/api/forum/topics/${t.id}`, { method: "DELETE" });
            await loadTopicsFromDatabase();
            selectedId = null;
            renderList(); renderThread();
            showToast("Topik berhasil dihapus.");
          } catch (error) { showToast(error.message); }
        }
      });
    });
  }
  function esc(v) {
    return String(v).replace(
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
  }
  function closeSelectedTopic() {
    selectedId = null;
    renderList();
    renderThread();
    $(".topic-list-panel").classList.remove("mobile-hidden");
    threadPanel.classList.add("mobile-hidden");
    threadPanel.classList.add("hidden");
    workspace.classList.remove("has-selection");
  }
  function selectTopic(id) {
    const nextId = String(id);
    const exists = topics.some((topic) => String(topic.id) === nextId);
    if (!exists) return;

    selectedId = nextId;
    closeTopicMenus();
    renderList();
    renderThread();

    if (window.innerWidth <= 850) {
      $(".topic-list-panel").classList.add("mobile-hidden");
      threadPanel.classList.remove("mobile-hidden");
    } else {
      $(".topic-list-panel").classList.remove("mobile-hidden");
      threadPanel.classList.remove("mobile-hidden");
    }
  }
  function closeTopicMenus(except = null) {
    $$(".topic-menu").forEach((menu) => {
      if (menu !== except) menu.remove();
    });
    $$(".topic-more, .comment-more, #thread-options").forEach((btn) => {
      if (!except || !btn.closest(".topic-card") || btn.closest(".topic-card") !== except.closest(".topic-card")) {
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }
  function openTopicMenu(card) {
    closeTopicMenus();
    const topic = topics.find((t) => String(t.id) === String(card.dataset.id));
    if (!topic) return;
    const own = topic.ownerKey === userKey;
    const canDelete = own || isModerator;
    const menu = document.createElement("div");
    menu.className = "topic-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `${own ? "" : '<button type="button" role="menuitem" data-menu-action="report"><i data-lucide="flag"></i>Laporkan topik</button>'}${canDelete ? '<button type="button" role="menuitem" class="danger" data-menu-action="delete"><i data-lucide="trash-2"></i>Hapus topik</button>' : ""}`;
    card.appendChild(menu);
    const toggle = card.querySelector(".topic-more");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (window.lucide) lucide.createIcons();
    menu.addEventListener("click", async (ev) => {
      const action =
        ev.target.closest("[data-menu-action]")?.dataset.menuAction;
      if (!action) return;
      ev.stopPropagation();
      if (action === "report") {
        menu.remove();
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        submitForumReport({ type: "topic", topic });
      }
      if (action === "delete") {
        if (!canDelete) return;
        if (!(await showDeleteConfirm("Topik beserta diskusi dan komentarnya akan dihapus permanen.", "Hapus topik?"))) return;
        forumRequest(`/api/forum/topics/${topic.id}`, { method: "DELETE" })
          .then(async () => {
            await loadTopicsFromDatabase();
            if (String(selectedId) === String(topic.id)) { selectedId = null; renderThread(); }
            renderList();
            showToast("Topik berhasil dihapus.");
          })
          .catch(error => showToast(error.message));
      }
    });
  }
  listEl.addEventListener("click", (e) => {
    if (e.target.closest(".topic-menu")) {
      e.stopPropagation();
      return;
    }
    if (e.target.closest(".topic-more")) {
      e.stopPropagation();
      const card = e.target.closest(".topic-card");
      const existing = card.querySelector(".topic-menu");
      if (existing) {
        existing.remove();
        e.target.closest(".topic-more").setAttribute("aria-expanded", "false");
      } else openTopicMenu(card);
      return;
    }
  });
  document.addEventListener("click", (e) => {
    const insideMenuOrTrigger = e.target.closest(
      ".topic-menu, .topic-more, .comment-more, #thread-options",
    );
    if (!insideMenuOrTrigger) closeTopicMenus();

    if (
      selectedId !== null &&
      !e.target.closest(".thread-panel, .topic-card")
    ) {
      closeSelectedTopic();
    }
  });
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      activeCategory = tab.dataset.category;
      tabs.forEach((x) => x.classList.toggle("active", x === tab));
      selectedId = null;
      renderList();
      renderThread();
      if (window.innerWidth <= 850)
        $(".topic-list-panel").classList.remove("mobile-hidden");
    }),
  );
  searchInput.addEventListener("input", renderList);
  sortSelect.addEventListener("change", renderList);
  function openModal() {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    $("#new-title").focus();
  }
  function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
  $("#open-create").addEventListener("click", openModal);
  $("#close-create").addEventListener("click", closeModal);
  $("#cancel-create").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });
  $$("#category-choices .choice-card").forEach((btn) =>
    btn.addEventListener("click", () => {
      $$("#category-choices .choice-card").forEach((b) =>
        b.classList.toggle("selected", b === btn),
      );
      selectedCategory = btn.dataset.choice;
      $("#selected-category").value = selectedCategory;
    }),
  );
  const titleInput = $("#new-title");
  const bodyInput = $("#new-body");
  const clearFieldError = (field) => {
    field.classList.remove("field-invalid");
    field.removeAttribute("aria-invalid");
    const errorEl = field.id === "new-title" ? $("#title-error") : $("#body-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("visible");
    }
  };
  const showFieldError = (field, message) => {
    field.classList.add("field-invalid");
    field.setAttribute("aria-invalid", "true");
    const errorEl = field.id === "new-title" ? $("#title-error") : $("#body-error");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("visible");
    }
  };
  titleInput.addEventListener("input", (e) => {
    $("#title-counter").textContent = `${e.target.value.length}/100`;
    if (e.target.value.trim()) clearFieldError(e.target);
  });
  bodyInput.addEventListener("input", (e) => {
    $("#body-counter").textContent = `${e.target.value.length}/2000`;
    if (e.target.value.trim()) clearFieldError(e.target);
  });
  $("#new-image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran gambar maksimal 5 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      imageData = reader.result;
      $("#preview-img").src = imageData;
      $("#preview-name").textContent = file.name;
      $("#image-preview").classList.remove("hidden");
      $("#upload-title").textContent = "Gambar dipilih";
    };
    reader.readAsDataURL(file);
  });
  $("#remove-image").addEventListener("click", () => {
    imageData = "";
    $("#new-image").value = "";
    $("#image-preview").classList.add("hidden");
    $("#upload-title").textContent = "Klik untuk memilih gambar";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#new-title").value.trim(),
      body = $("#new-body").value.trim();
    clearFieldError(titleInput);
    clearFieldError(bodyInput);
    const missingFields = [];
    if (!title) {
      showFieldError(titleInput, "Judul topik wajib diisi.");
      missingFields.push("Judul Topik");
    }
    if (!body) {
      showFieldError(bodyInput, "Isi topik wajib diisi.");
      missingFields.push("Isi Topik");
    }
    if (missingFields.length) {
      (missingFields.includes("Judul Topik") ? titleInput : bodyInput).focus();
      return;
    }
    if (!currentUser) return showToast("Silakan login untuk membuat topik.");
    let created;
    try {
      created = await forumRequest("/api/forum/topics", {
        method: "POST",
        body: JSON.stringify({
          category: selectedCategory, title, body, authorName: displayName,
          avatar: read(`rlc_avatar_${userKey}`, "avatar-01"), image: imageData || ""
        })
      });
      await loadTopicsFromDatabase();
    } catch (error) {
      showToast(error.message);
      return;
    }
    const topic = topics.find(item => String(item.id) === String(created.id));
    if (!topic) return showToast("Topik tersimpan, tetapi gagal ditampilkan. Muat ulang halaman.");

    activeCategory = "Semua Topik";
    tabs.forEach((x) =>
      x.classList.toggle("active", x.dataset.category === activeCategory),
    );
    searchInput.value = "";
    sortSelect.value = "new";
    selectedId = String(topic.id);
    renderList();
    renderThread();
    if (topic.image) {
      const img = $(".thread-attachment");
      if (img) img.src = topic.image;
    }
    closeModal();
    form.reset();
    $("#selected-category").value = "Diskusi";
    selectedCategory = "Diskusi";
    $$("#category-choices .choice-card").forEach((b) =>
      b.classList.toggle("selected", b.dataset.choice === "Diskusi"),
    );
    $("#title-counter").textContent = "0/100";
    $("#body-counter").textContent = "0/2000";
    imageData = "";
    $("#image-preview").classList.add("hidden");
    $("#upload-title").textContent = "Klik untuk memilih gambar";
    showToast("Topik berhasil disimpan ke database.");
  });
  loadTopicsFromDatabase()
    .then(() => { renderList(); renderThread(); })
    .catch(error => {
      renderList();
      showToast(error.message || "Forum gagal dimuat dari database.");
    });
})();
