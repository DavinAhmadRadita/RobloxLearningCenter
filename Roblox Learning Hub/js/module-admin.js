(() => {
  const STORE = "rlc_admin_modules";
  const list = document.getElementById("module-list");
  const addButton = document.getElementById("admin-add-module");
  const form = document.getElementById("admin-module-form");
  const modal = document.getElementById("admin-module-modal");
  const error = document.getElementById("admin-module-error");
  const deleteModal = document.getElementById("module-delete-modal");
  const deleteName = document.getElementById("module-delete-name");
  const confirmDeleteButton = document.getElementById("confirm-delete-module");
  let pendingDeleteId = null;
  if (!list || !addButton || !form || !modal) return;

  const currentUser = (
    sessionStorage.getItem("rlc_current_user") ||
    localStorage.getItem("rlc_remembered_user") ||
    ""
  ).toLowerCase();
  function role() {
    const override = (
      sessionStorage.getItem("rlc_user_role") ||
      localStorage.getItem("rlc_user_role") ||
      ""
    ).toLowerCase();
    if (override) return override;
    try {
      const accounts = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
      const values = Array.isArray(accounts)
        ? accounts
        : Object.values(accounts);
      const account = values.find(
        (a) =>
          a &&
          typeof a.username === "string" &&
          a.username.toLowerCase() === currentUser,
      );
      return String(
        account?.role || account?.userRole || account?.accountType || "",
      ).toLowerCase();
    } catch (_) {
      return "";
    }
  }
  const isAdmin = () => role() === "admin";
  const youtubeId = (url) => {
    try {
      const u = new URL(String(url || "").trim());
      const host = u.hostname.toLowerCase().replace(/^www\\./, "");
      let id = "";
      if (host === "youtu.be")
        id = u.pathname.split("/").filter(Boolean)[0] || "";
      else if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        id = u.searchParams.get("v") || "";
        if (!id) {
          const parts = u.pathname.split("/").filter(Boolean);
          if (["embed", "shorts", "live", "v"].includes(parts[0]))
            id = parts[1] || "";
        }
      }
      return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : "";
    } catch (_) {
      return "";
    }
  };
  const youtubeThumb = (url) => {
    const id = youtubeId(url);
    return id
      ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
      : "";
  };
  const esc = (value) =>
    String(value ?? "").replace(
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
  let modules = [],
    editingId = null;
  let completedModules = {},
    watchedSeconds = {},
    watchedSegments = {},
    videoDurations = {};
  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "Permintaan ke server gagal.");
    return data;
  };
  async function loadModules() {
    try {
      const result = await api("/api/modules");
      modules = Array.isArray(result.modules) ? result.modules : [];
    } catch (err) {
      modules = [];
      error.textContent = `Modul gagal dimuat: ${err.message}`;
      error.hidden = false;
    }
    try {
      const result = await api("/api/modules/progress");
      (result.progress || []).forEach((row) => {
        const id = String(row.moduleId);
        watchedSeconds[id] = Number(row.watchedSeconds || 0);
        try {
          watchedSegments[id] = JSON.parse(row.watchedSegments || "[]");
          if (!Array.isArray(watchedSegments[id])) watchedSegments[id] = [];
        } catch (_) {
          watchedSegments[id] = [];
        }
        if (!watchedSegments[id].length && watchedSeconds[id] > 0) {
          watchedSegments[id] = [[0, watchedSeconds[id]]];
        }
        videoDurations[id] = Number(row.videoDurationSeconds || 0);
        completedModules[id] = row.status === "completed";
      });
    } catch (_) {}
    render();
  }
  let activePlayer = null,
    watchTimer = null,
    lastVideoTime = null,
    activeModule = null,
    activeWatchSeconds = 0;
  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (!window.rlcYouTubeApiPromise)
      window.rlcYouTubeApiPromise = new Promise((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof previous === "function") previous();
          resolve(window.YT);
        };
        const existing = document.querySelector("script[data-rlc-youtube-api]");
        if (!existing) {
          const script = document.createElement("script");
          script.src = "https://www.youtube.com/iframe_api";
          script.dataset.rlcYoutubeApi = "1";
          document.head.appendChild(script);
        }
      });
    return window.rlcYouTubeApiPromise;
  }
  function mergeWatchedRanges(ranges) {
    const sorted = (Array.isArray(ranges) ? ranges : [])
      .filter((range) => Array.isArray(range) && range.length >= 2)
      .map(([start, end]) => [
        Math.max(0, Number(start) || 0),
        Math.max(0, Number(end) || 0),
      ])
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    sorted.forEach(([start, end]) => {
      const last = merged[merged.length - 1];
      if (last && start <= last[1] + 0.25) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    });
    return merged;
  }
  function watchedTotal(ranges) {
    return Math.floor(
      mergeWatchedRanges(ranges).reduce(
        (sum, [start, end]) => sum + end - start,
        0,
      ),
    );
  }
  function resumePosition(ranges) {
    const merged = mergeWatchedRanges(ranges);
    if (!merged.length || merged[0][0] > 1) return 0;
    let end = merged[0][1];
    for (let i = 1; i < merged.length && merged[i][0] <= end + 0.5; i++) {
      end = Math.max(end, merged[i][1]);
    }
    return Math.floor(end);
  }

  let lastProgressSaveAt = 0;
  async function saveWatchProgress(force = false) {
    if (!activeModule) return;
    watchedSegments[activeModule.id] = mergeWatchedRanges(
      watchedSegments[activeModule.id] || [],
    );
    activeWatchSeconds = watchedTotal(watchedSegments[activeModule.id]);
    watchedSeconds[activeModule.id] = activeWatchSeconds;
    const card = list.querySelector(
      `[data-module-id="${CSS.escape(String(activeModule.id))}"]`,
    );
    const label = card?.querySelector(".module-progress-label");
    const fill = card?.querySelector(".module-progress-line > span");
    const duration = Number(videoDurations[activeModule.id] || 0);
    const pct =
      duration > 0
        ? Math.min(99, Math.floor((activeWatchSeconds / duration) * 100))
        : 0;
    if (fill && !completedModules[activeModule.id])
      fill.style.width = `${pct}%`;
    if (label && !completedModules[activeModule.id])
      label.textContent = `Ditonton ${Math.floor(activeWatchSeconds)} detik${duration ? ` dari ${Math.floor(duration)} detik` : ""}`;
    const now = Date.now();
    if (!force && now - lastProgressSaveAt < 5000) return;
    lastProgressSaveAt = now;
    if (!sessionStorage.getItem("rlc_current_user")) return;
    try {
      await api(
        `/api/modules/${encodeURIComponent(activeModule.id)}/progress`,
        {
          method: "PUT",
          body: JSON.stringify({
            watchedSeconds: watchedSeconds[activeModule.id],
            watchedSegments: watchedSegments[activeModule.id],
            duration,
            completed: !!completedModules[activeModule.id],
          }),
        },
      );
    } catch (err) {
      console.warn("Progress modul belum tersimpan:", err.message);
    }
  }
  async function completeModule(module) {
    if (completedModules[module.id]) return;
    completedModules[module.id] = true;
    watchedSeconds[module.id] = Math.floor(
      activeWatchSeconds || watchedSeconds[module.id] || 0,
    );
    await saveWatchProgress(true);
    render();
    const label = document.querySelector(
      `[data-module-id="${CSS.escape(String(module.id))}"] .module-progress-label`,
    );
    if (label) label.textContent = "Video selesai ditonton";
  }
  function toEmbed(url) {
    const raw = String(url || "").trim();
    const id = youtubeId(raw);
    if (id)
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    try {
      const u = new URL(raw);
      if (
        u.hostname
          .toLowerCase()
          .replace(/^www\\./, "")
          .endsWith("vimeo.com")
      ) {
        const id = u.pathname.split("/").filter(Boolean).pop();
        if (id && /^\\d+$/.test(id))
          return `https://player.vimeo.com/video/${id}?autoplay=1`;
      }
      if (
        u.protocol === "https:" &&
        !["javascript:", "data:"].includes(u.protocol)
      )
        return u.href;
    } catch (_) {}
    return "";
  }
  function ensureLessonIframe() {
    const frameContainer = document.getElementById("lesson-video-frame");
    let frame = document.getElementById("lesson-video-iframe");
    if (!frame || !frame.isConnected) {
      if (!frameContainer) return null;
      frame = document.createElement("iframe");
      frame.id = "lesson-video-iframe";
      frame.title = "Video pembelajaran";
      frame.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      frame.hidden = true;
      frameContainer.appendChild(frame);
    }
    return frame;
  }

  function showVideo(module) {
    const videoModal = document.getElementById("lesson-video-modal");
    const title = document.getElementById("lesson-video-title");
    const frame = ensureLessonIframe();
    const placeholder = document.getElementById("lesson-video-placeholder");
    if (!videoModal || !title || !frame || !placeholder) return;
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
    if (activePlayer && typeof activePlayer.destroy === "function") {
      try {
        activePlayer.destroy();
      } catch (_) {}
      activePlayer = null;
    }
    activeModule = module;
    watchedSegments[module.id] = mergeWatchedRanges(
      watchedSegments[module.id] || [],
    );
    activeWatchSeconds = watchedTotal(watchedSegments[module.id]);
    lastVideoTime = null;
    title.textContent = module.title;
    const videoId = youtubeId(
      module.videoUrl ||
        module.video_url ||
        module.videoURL ||
        module.youtubeUrl ||
        module.youtube_url ||
        module.url ||
        "",
    );
    const embedUrl = toEmbed(
      module.videoUrl ||
        module.video_url ||
        module.videoURL ||
        module.youtubeUrl ||
        module.youtube_url ||
        module.url ||
        "",
    );
    if (embedUrl) {
      placeholder.hidden = true;
      frame.hidden = false;
      if (videoId) {
        frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}&rel=0`;
        loadYouTubeAPI()
          .then((YT) => {
            if (
              videoModal.hidden ||
              activeModule !== module ||
              !frame.isConnected
            )
              return;
            activePlayer = new YT.Player(frame, {
              events: {
                onReady: (event) => {
                  const duration = Number(event.target.getDuration() || 0);
                  if (duration > 0) {
                    videoDurations[module.id] = duration;
                    const resumeAt = resumePosition(watchedSegments[module.id]);
                    if (resumeAt > 0 && resumeAt < duration - 2) {
                      event.target.seekTo(resumeAt, true);
                    }
                  }
                  if (duration > 0 && activeWatchSeconds >= duration - 2)
                    completeModule(module);
                  watchTimer = setInterval(() => {
                    if (
                      !activePlayer ||
                      activeModule !== module ||
                      videoModal.hidden
                    )
                      return;
                    const state = activePlayer.getPlayerState();
                    const current = Number(activePlayer.getCurrentTime() || 0);
                    if (
                      state === YT.PlayerState.PLAYING &&
                      lastVideoTime !== null
                    ) {
                      const delta = current - lastVideoTime;
                      if (delta > 0 && delta <= 2.5) {
                        watchedSegments[module.id] = mergeWatchedRanges([
                          ...(watchedSegments[module.id] || []),
                          [lastVideoTime, current],
                        ]);
                        activeWatchSeconds = watchedTotal(
                          watchedSegments[module.id],
                        );
                        saveWatchProgress(true);
                      }
                    }
                    lastVideoTime =
                      state === YT.PlayerState.PLAYING ? current : null;
                    const total = Number(activePlayer.getDuration() || 0);
                    if (
                      total > 0 &&
                      Number(videoDurations[module.id] || 0) !== total
                    ) {
                      videoDurations[module.id] = total;
                    }
                    if (total > 0 && activeWatchSeconds >= total - 2) {
                      completeModule(module);
                      clearInterval(watchTimer);
                      watchTimer = null;
                    }
                  }, 1000);
                },
                onStateChange: (event) => {
                  if (event.data === YT.PlayerState.ENDED) {
                    const total = Number(activePlayer?.getDuration() || 0);
                    if (total > 0 && activeWatchSeconds >= total - 3)
                      completeModule(module);
                  }
                },
              },
            });
          })
          .catch(() => {});
      } else {
        frame.src = embedUrl;
        placeholder.hidden = false;
        placeholder.textContent =
          "Verifikasi durasi otomatis saat ini mendukung video YouTube. Video ini bisa ditonton, tetapi belum dapat ditandai selesai otomatis.";
      }
    } else {
      frame.removeAttribute("src");
      frame.hidden = true;
      placeholder.hidden = false;
    }
    videoModal.removeAttribute("hidden");
    videoModal.hidden = false;
    videoModal.removeAttribute("inert");
    videoModal.style.removeProperty("display");
    videoModal.style.removeProperty("visibility");
    videoModal.style.removeProperty("pointer-events");
    videoModal.style.removeProperty("z-index");
    videoModal.style.display = "grid";
    videoModal.style.pointerEvents = "auto";
    videoModal.style.zIndex = "2000";
    document.body.classList.add("lesson-video-open");
    if (window.lucide) window.lucide.createIcons();
  }
  function closeVideo() {
    const videoModal = document.getElementById("lesson-video-modal");
    const frame = ensureLessonIframe();
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
    saveWatchProgress(true);
    if (activePlayer && typeof activePlayer.destroy === "function") {
      try {
        activePlayer.destroy();
      } catch (_) {}
    }
    activePlayer = null;
    if (videoModal) {
      videoModal.setAttribute("hidden", "");
      videoModal.setAttribute("inert", "");
      videoModal.style.setProperty("display", "none", "important");
      videoModal.style.setProperty("visibility", "hidden", "important");
      videoModal.style.setProperty("pointer-events", "none", "important");
      videoModal.style.setProperty("z-index", "-1", "important");
    }
    let survivingFrame = document.getElementById("lesson-video-iframe");
    if (!survivingFrame || !survivingFrame.isConnected)
      survivingFrame = ensureLessonIframe();
    if (survivingFrame) {
      survivingFrame.removeAttribute("src");
      survivingFrame.hidden = true;
    }
    activeModule = null;
    lastVideoTime = null;
    document.body.classList.remove("lesson-video-open");
  }
  const initialVideoModal = document.getElementById("lesson-video-modal");
  if (initialVideoModal) {
    initialVideoModal.hidden = true;
    initialVideoModal.style.display = "none";
    initialVideoModal.style.visibility = "hidden";
    initialVideoModal.style.pointerEvents = "none";
    initialVideoModal.style.zIndex = "-1";
    initialVideoModal.setAttribute("inert", "");
  }
  document
    .querySelectorAll("[data-close-lesson]")
    .forEach((btn) => btn.addEventListener("click", closeVideo));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      closeVideo();
    }
  });

  function render() {
    const total = document.getElementById("total-module-count");
    const count = document.getElementById("module-list-count");
    const completed = document.getElementById("completed-module-count");
    const progress = document.getElementById("overall-module-progress");
    if (total) total.textContent = modules.length;
    if (count) count.textContent = `${modules.length} MODUL`;
    const completedCount = modules.filter((m) => completedModules[m.id]).length;
    if (completed) completed.textContent = String(completedCount);
    if (progress)
      progress.textContent = `${modules.length ? Math.round((completedCount / modules.length) * 100) : 0}%`;
    addButton.hidden = !isAdmin();
    list.innerHTML = "";
    if (!modules.length) {
      list.innerHTML = `<div class="empty-state module-empty-state"><i data-lucide="book-open" aria-hidden="true"></i><h3>Belum ada modul pembelajaran</h3><p>Modul akan muncul di sini setelah admin menambahkannya.</p></div>`;
    } else {
      modules.forEach((m, index) => {
        const card = document.createElement("article");
        card.className = "module-card";
        card.dataset.moduleId = m.id;
        card.innerHTML = `
          <div class="module-card-toggle" role="button" tabindex="0" aria-label="Putar video ${esc(m.title)}">
            <span class="module-video-thumb">
              ${youtubeThumb(m.videoUrl) ? `<img src="${youtubeThumb(m.videoUrl)}" alt="Thumbnail video ${esc(m.title)}" loading="lazy" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='https://img.youtube.com/vi/${youtubeId(m.videoUrl)}/mqdefault.jpg'}else{this.remove();this.closest('.module-video-thumb').classList.add('thumbnail-unavailable')}">` : ""}
              <i data-lucide="play-circle" aria-hidden="true"></i>
            </span>
            <span class="module-card-main">
              <span class="module-card-kicker">${esc(m.level || "Pemula")}</span>
              <strong>${esc(m.title)}</strong>
              <span class="module-description">${esc(m.description)}</span>
              <span class="module-progress-line"><span style="width:${completedModules[m.id] ? 100 : Math.min(99, Math.round((Number(watchedSeconds[m.id] || 0) / Math.max(1, Number(videoDurations[m.id] || 0))) * 100))}%"></span></span>
              <span class="module-progress-label">${completedModules[m.id] ? "Video selesai ditonton" : watchedSeconds[m.id] ? `Ditonton ${Math.floor(watchedSeconds[m.id])} detik${videoDurations[m.id] ? ` dari ${Math.floor(videoDurations[m.id])} detik` : ""}` : "Video pembelajaran"}</span>
            </span>
            <span class="module-status ${completedModules[m.id] ? "completed" : Number(watchedSeconds[m.id] || 0) > 0 ? "in-progress" : "not-started"}">${completedModules[m.id] ? "Selesai" : Number(watchedSeconds[m.id] || 0) > 0 ? "Sedang dipelajari" : "Belum dimulai"}</span>
            ${isAdmin() ? `<span class="admin-module-actions"><button type="button" data-module-action="edit" title="Edit Modul" aria-label="Edit Modul"><i data-lucide="pencil"></i></button><button type="button" class="delete-module" data-module-action="delete" title="Hapus Modul" aria-label="Hapus Modul"><i data-lucide="trash-2"></i></button></span>` : ""}
            <span class="module-chevron"><i data-lucide="play-circle"></i></span>
          </div>`;
        list.appendChild(card);
      });
    }
    if (window.lucide) window.lucide.createIcons();
  }

  const fieldIds = [
    "admin-module-title",
    "admin-module-level",
    "admin-module-video",
    "admin-module-description",
  ];
  function setFieldError(id, message = "") {
    const field = document.getElementById(id);
    const messageNode = form.querySelector(`[data-error-for="${id}"]`);
    if (!field || !messageNode) return;
    field.classList.toggle("is-invalid", Boolean(message));
    field.setAttribute("aria-invalid", message ? "true" : "false");
    messageNode.textContent = message;
    messageNode.hidden = !message;
  }
  function clearFieldErrors() {
    fieldIds.forEach((id) => setFieldError(id));
  }
  function validateFields() {
    const title = document.getElementById("admin-module-title");
    const level = document.getElementById("admin-module-level");
    const video = document.getElementById("admin-module-video");
    const description = document.getElementById("admin-module-description");
    const checks = [
      [title.id, title.value.trim() ? "" : "Judul modul wajib diisi."],
      [level.id, level.value ? "" : "Level wajib dipilih."],
      [
        video.id,
        !video.value.trim()
          ? "URL video wajib diisi."
          : !video.validity.valid
            ? "Masukkan URL video yang valid."
            : validateYouTubeAndDuplicate(video.value.trim()),
      ],
      [
        description.id,
        description.value.trim() ? "" : "Deskripsi modul wajib diisi.",
      ],
    ];
    checks.forEach(([id, message]) => setFieldError(id, message));
    const firstInvalid = checks.find(([, message]) => message);
    if (firstInvalid) document.getElementById(firstInvalid[0]).focus();
    return !firstInvalid;
  }
  function validateYouTubeAndDuplicate(url) {
    const id = youtubeId(url);
    if (!id) return "Masukkan link video YouTube yang valid.";
    const duplicate = modules.find((module) => {
      if (editingId && String(module.id) === String(editingId)) return false;
      const existingId = youtubeId(module.videoUrl || module.video_url || "");
      return existingId && existingId === id;
    });
    return duplicate ? `Video ini sudah digunakan pada modul ${duplicate.title || "lain"}.` : "";
  }
  function clearForm() {
    form.reset();
    editingId = null;
    error.hidden = true;
    error.textContent = "";
    clearFieldErrors();
    document.getElementById("admin-module-modal-title").textContent =
      "Tambah Modul";
    form.querySelector(".admin-save").innerHTML =
      '<i data-lucide="check"></i> Simpan Modul';
    updateCount();
  }
  fieldIds.forEach((id) => {
    const field = document.getElementById(id);
    field?.addEventListener("input", () => {
      if (!field.value.trim()) return;
      setFieldError(
        id,
        id === "admin-module-video"
          ? (!field.validity.valid ? "Masukkan URL video yang valid." : validateYouTubeAndDuplicate(field.value.trim()))
          : "",
      );
    });
    field?.addEventListener("change", () => {
      if (field.value.trim()) setFieldError(id);
    });
  });
  function updateCount() {
    const area = document.getElementById("admin-module-description");
    const counter = document.getElementById("admin-description-count");
    if (area && counter) counter.textContent = `${area.value.length}/300`;
  }
  function openModal(module = null) {
    if (!isAdmin()) return;
    clearForm();
    if (module) {
      editingId = module.id;
      document.getElementById("admin-module-modal-title").textContent =
        "Edit Modul";
      form.querySelector(".admin-save").innerHTML =
        '<i data-lucide="check"></i> Simpan Perubahan';
      document.getElementById("admin-module-title").value = module.title || "";
      document.getElementById("admin-module-level").value = module.level || "";
      document.getElementById("admin-module-description").value =
        module.description || "";
      document.getElementById("admin-module-video").value =
        module.videoUrl || "";
      updateCount();
    }
    modal.hidden = false;
    document.body.classList.add("admin-module-open");
    document.getElementById("admin-module-title").focus();
    if (window.lucide) window.lucide.createIcons();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("admin-module-open");
  }
  addButton.addEventListener("click", () => openModal());
  modal
    .querySelectorAll("[data-close-admin-module]")
    .forEach((btn) => btn.addEventListener("click", closeModal));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document
    .getElementById("admin-module-description")
    .addEventListener("input", updateCount);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin()) {
      error.textContent = "Akses ditolak. Fitur ini hanya untuk Admin.";
      error.hidden = false;
      return;
    }
    const data = {
      id: editingId || `module-${Date.now()}`,
      title: document.getElementById("admin-module-title").value.trim(),
      level: document.getElementById("admin-module-level").value,
      description: document
        .getElementById("admin-module-description")
        .value.trim(),
      videoUrl: document.getElementById("admin-module-video").value.trim(),
    };
    if (!validateFields()) return;
    error.hidden = true;
    error.textContent = "";
    try {
      const result = editingId
        ? await api(`/api/modules/${encodeURIComponent(editingId)}`, {
            method: "PUT",
            body: JSON.stringify(data),
          })
        : await api("/api/modules", {
            method: "POST",
            body: JSON.stringify(data),
          });
      if (editingId)
        modules = modules.map((item) =>
          String(item.id) === String(editingId) ? result.module : item,
        );
      else modules.unshift(result.module);
      render();
      closeModal();
    } catch (err) {
      const message = err.message || "Data modul gagal disimpan ke database.";
      if (/youtube|video ini sudah digunakan/i.test(message)) {
        setFieldError("admin-module-video", message);
        document.getElementById("admin-module-video").focus();
      } else {
        error.textContent = message;
        error.hidden = false;
      }
    }
  });

  function openDeleteModal(module) {
    if (!isAdmin() || !deleteModal) return;
    pendingDeleteId = module.id;
    if (deleteName) deleteName.textContent = `“${module.title}”`;
    deleteModal.hidden = false;
    document.body.classList.add("module-delete-open");
    if (window.lucide) window.lucide.createIcons();
    confirmDeleteButton?.focus();
  }
  function closeDeleteModal() {
    if (deleteModal) deleteModal.hidden = true;
    document.body.classList.remove("module-delete-open");
    pendingDeleteId = null;
  }
  deleteModal
    ?.querySelectorAll("[data-cancel-delete]")
    .forEach((button) => button.addEventListener("click", closeDeleteModal));
  deleteModal?.addEventListener("click", (event) => {
    if (event.target === deleteModal) closeDeleteModal();
  });
  confirmDeleteButton?.addEventListener("click", () => {
    if (!isAdmin() || !pendingDeleteId) return;
    api(`/api/modules/${encodeURIComponent(pendingDeleteId)}`, {
      method: "DELETE",
    })
      .then(() => {
        modules = modules.filter(
          (module) => String(module.id) !== String(pendingDeleteId),
        );
        delete completedModules[pendingDeleteId];
        delete watchedSeconds[pendingDeleteId];
        delete videoDurations[pendingDeleteId];
        render();
        closeDeleteModal();
      })
      .catch((err) => {
        error.textContent = err.message;
        error.hidden = false;
        closeDeleteModal();
      });
  });

  list.addEventListener("click", (e) => {
    const action = e.target.closest?.("[data-module-action]");
    if (action && list.contains(action)) {
      const card = action.closest(".module-card");
      const module = modules.find(
        (m) => String(m.id) === String(card?.dataset.moduleId),
      );
      if (!module) return;
      e.preventDefault();
      e.stopPropagation();
      if (!isAdmin()) return;
      if (action.dataset.moduleAction === "edit") openModal(module);
      if (action.dataset.moduleAction === "delete") openDeleteModal(module);
      return;
    }

    const toggle = e.target.closest?.(".module-card-toggle");
    if (toggle && list.contains(toggle)) {
      const card = toggle.closest(".module-card");
      const module = modules.find(
        (m) => String(m.id) === String(card?.dataset.moduleId),
      );
      if (module) {
        e.preventDefault();
        showVideo(module);
      }
      return;
    }
  });
  list.addEventListener("keydown", (e) => {
    const toggle = e.target.closest(".module-card-toggle");
    if (toggle && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle.click();
    }
  });
  loadModules();
})();
