(() => {
  const shell = document.getElementById("dashboard-view");
  if (!shell) return;

  const sessionUser = sessionStorage.getItem("rlc_current_user");
  const rememberedUser = localStorage.getItem("rlc_remembered_user");
  if (!sessionUser && rememberedUser) {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();
        const user = data.user;
        sessionStorage.setItem("rlc_current_user", user.username);
        sessionStorage.setItem("rlc_user_role", user.role);
        sessionStorage.setItem("rlc_user_email", user.email);
        sessionStorage.setItem(
          "rlc_display_name",
          user.displayName || user.username,
        );
        window.location.reload();
      })
      .catch(() => {
        localStorage.removeItem("rlc_remembered_user");
        sessionStorage.removeItem("rlc_current_user");
        window.location.reload();
      });
    return;
  }

  const currentUser = sessionUser || "";
  if (currentUser) sessionStorage.setItem("rlc_current_user", currentUser);
  const userKey = (currentUser || "guest").toLowerCase();
  const getStored = (key, fallback = "") => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  };
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch],
    );
  const youtubeThumb = (url) => {
    try {
      const u = new URL(url);
      let id = "";
      if (u.hostname.includes("youtu.be"))
        id = u.pathname.split("/").filter(Boolean)[0] || "";
      else if (u.hostname.includes("youtube.com"))
        id =
          u.searchParams.get("v") ||
          (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : "");
      return id
        ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`
        : "";
    } catch (_) {
      return "";
    }
  };
  const displayName = currentUser
    ? getStored(`rlc_display_name_${userKey}`, currentUser) || currentUser
    : "USERNAME";
  const avatarValue = currentUser
    ? getStored(`rlc_avatar_${userKey}`, "avatar-01")
    : "";
  const authButton = document.getElementById("dashboard-auth-button");
  const setAvatar = (node, value, fallbackText) => {
    if (!node) return;
    node.style.backgroundImage = "";
    node.style.backgroundSize = "cover";
    node.style.backgroundPosition = "center";
    node.style.backgroundRepeat = "no-repeat";
    if (value && value.startsWith("data:")) {
      node.style.backgroundImage = `url("${value}")`;
      node.textContent = "";
    } else if (value && /^avatar-\d{2}$/.test(value)) {
      node.style.backgroundImage = `url("assets/avatars/${value}.png")`;
      node.textContent = "";
    } else node.textContent = fallbackText || "U";
  };
  shell.classList.toggle("logged-in", Boolean(currentUser));
  shell.classList.toggle("logged-out", !currentUser);
  const welcome = document.getElementById("welcome-name");
  const greeting = document.getElementById("dashboard-greeting");
  if (welcome) welcome.textContent = displayName.toUpperCase();
  if (greeting && !currentUser) {
    greeting.innerHTML = 'Selamat Datang! <span class="wave">👋</span>';
  }
  const profileName = document.getElementById("profile-name");
  if (profileName) profileName.textContent = displayName;
  const profileHandle = document.getElementById("profile-handle");
  if (profileHandle)
    profileHandle.textContent = currentUser ? `@${currentUser}` : "@username";
  setAvatar(
    document.getElementById("avatar"),
    avatarValue,
    displayName.charAt(0).toUpperCase(),
  );
  if (authButton)
    authButton.textContent = currentUser ? "LOGOUT" : "MASUK/DAFTAR";

  const destinations = {
    Dashboard: "dashboard.html",
    Modul: "module.html",
    Leaderboard: "leaderboard.html",
    Forum: "forum.html",
    Challenges: "challenges.html",
    Profile: "profile.html",
  };
  const activePage = document.body.dataset.page || "Dashboard";
  const profileLink = document.getElementById("profile");
  if (profileLink)
    profileLink.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  shell.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === activePage);
    const target = destinations[button.dataset.page];
    button.addEventListener("click", () => {
      if (target) window.location.href = target;
    });
  });
  if (authButton)
    authButton.addEventListener("click", async () => {
      if (sessionStorage.getItem("rlc_current_user")) {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
        } catch (_) {}
        [
          "rlc_current_user",
          "rlc_user_role",
          "rlc_user_email",
          "rlc_display_name",
        ].forEach((key) => sessionStorage.removeItem(key));
        ["rlc_remembered_user", "rlc_user_role"].forEach((key) =>
          localStorage.removeItem(key),
        );
        window.location.href = "dashboard.html";
      } else {
        window.location.href = "login.html";
      }
    });

  async function updateModuleDashboard() {
    let modules = [],
      progressRows = [];
    try {
      const response = await fetch("/api/modules", {
        credentials: "same-origin",
      });
      const data = await response.json();
      if (response.ok) modules = data.modules || [];
    } catch (_) {}
    if (sessionStorage.getItem("rlc_current_user")) {
      try {
        const response = await fetch("/api/modules/progress", {
          credentials: "same-origin",
        });
        const data = await response.json();
        if (response.ok) progressRows = data.progress || [];
      } catch (_) {}
    }
    const progressByModule = Object.fromEntries(
      progressRows.map((row) => [String(row.moduleId), row]),
    );
    const moduleStats = modules.map((raw, index) => {
      const mod = {
        ...raw,
        id: String(raw.id ?? `module-${index + 1}`),
        name: String(raw.title || raw.name || "Modul"),
        title: String(raw.title || raw.name || "Modul"),
        category: String(raw.level || raw.category || "Pemula"),
        level: String(raw.level || "Pemula"),
        description: String(raw.description || ""),
        videoUrl: String(raw.videoUrl || raw.video_url || raw.url || ""),
      };
      const saved = progressByModule[String(mod.id)] || {};
      const done = saved.status === "completed";
      const watched = Math.max(0, Number(saved.watchedSeconds || 0));
      const duration = Math.max(0, Number(saved.videoDurationSeconds || 0));
      const startedCount = watched > 0 || done ? 1 : 0;
      const progress = Number(saved.progressPercentage ?? (done ? 100 : 0));
      const status = done
        ? "Selesai"
        : watched > 0
          ? "Sedang dipelajari"
          : "Belum dimulai";
      return {
        ...mod,
        done: done ? 1 : 0,
        total: 1,
        watched,
        duration,
        progress,
        startedCount,
        status,
      };
    });
    const completedModules = moduleStats.filter(
      (mod) => mod.progress === 100,
    ).length;
    const activeModules = moduleStats.filter(
      (mod) => mod.progress > 0 && mod.progress < 100,
    ).length;
    const lessonTotal = modules.length;
    const overall = lessonTotal
      ? Math.round(
          (moduleStats.filter((mod) => mod.progress === 100).length /
            lessonTotal) *
            100,
        )
      : 0;
    const ring = document.getElementById("dashboard-progress-ring");
    const percent = document.getElementById("dashboard-progress-percent");
    if (percent) percent.textContent = `${overall}%`;
    if (ring) {
      const progressAngle = Math.max(0, Math.min(100, overall)) * 3.6;
      ring.style.background = `radial-gradient(circle at center,#071a2d 58%,transparent 60%),conic-gradient(#1685ff 0deg ${progressAngle}deg,#102d4c ${progressAngle}deg 360deg)`;
      ring.setAttribute("aria-label", `Progress belajar ${overall} persen`);
    }
    const completedLabel = document.getElementById("dashboard-completed-count");
    if (completedLabel)
      completedLabel.textContent = `${completedModules} Modul Selesai`;
    const activeLabel = document.getElementById("dashboard-active-count");
    if (activeLabel)
      activeLabel.textContent = `${activeModules} Sedang Dipelajari`;
    const notStartedLabel = document.getElementById(
      "dashboard-not-started-count",
    );
    if (notStartedLabel)
      notStartedLabel.textContent = `${modules.length - completedModules - activeModules} Belum Dimulai`;

    let last = null;
    try {
      last = JSON.parse(getStored(`rlc_last_lesson_${userKey}`, "null"));
    } catch (_) {
      last = null;
    }
    const hasProgress = moduleStats.some(
      (mod) => mod.progress > 0 || mod.watched > 0,
    );
    const continueSection = document.querySelector(
      '.learning-section[aria-labelledby="continue-title"]',
    );
    const otherSection = document.querySelector(
      ".learning-section.other-modules",
    );
    const otherTitle = document.getElementById("other-modules-title");
    let continueModule = null;
    if (hasProgress) {
      continueModule =
        last &&
        moduleStats.find(
          (mod) =>
            mod.id === String(last.moduleId) &&
            mod.progress > 0 &&
            mod.progress < 100,
        );
      if (!continueModule)
        continueModule = moduleStats.find(
          (mod) => mod.status === "Sedang dipelajari",
        );
      if (!continueModule)
        continueModule = moduleStats.find((mod) => mod.progress < 100);
    }
    if (continueSection) continueSection.hidden = !continueModule;
    if (continueModule) {
      const el = (id) => document.getElementById(id);
      const continueNumber = el("continue-number");
      if (continueNumber) {
        const thumb = youtubeThumb(continueModule.videoUrl);
        continueNumber.innerHTML = thumb
          ? `<img src="${thumb}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i data-lucide=&quot;book-open&quot; aria-hidden=&quot;true&quot;></i>'">`
          : `<i data-lucide="book-open" aria-hidden="true"></i>`;
        continueNumber.setAttribute("aria-hidden", "true");
      }
      if (el("continue-category"))
        el("continue-category").textContent = continueModule.level;
      if (el("continue-module-title"))
        el("continue-module-title").textContent = continueModule.name;
      if (el("continue-module-description"))
        el("continue-module-description").textContent =
          continueModule.description;
      if (el("continue-progress-fill"))
        el("continue-progress-fill").style.width =
          `${continueModule.progress}%`;
      if (el("continue-progress-label"))
        el("continue-progress-label").textContent =
          `${continueModule.progress}%`;
      const button = el("continue-button");
      if (button) {
        button.href = `module.html?module=${encodeURIComponent(continueModule.id)}${last && String(last.moduleId) === String(continueModule.id) && last.lessonId ? `&lesson=${encodeURIComponent(last.lessonId)}` : ""}`;
        button.innerHTML = `<i data-lucide="play" aria-hidden="true"></i> ${continueModule.progress > 0 ? "Lanjutkan" : "Mulai Belajar"}`;
      }
    }
    if (otherTitle)
      otherTitle.textContent = continueModule
        ? "Modul Lainnya"
        : "Daftar Modul";
    const shortlist = document.getElementById("module-shortlist");
    if (shortlist) {
      const availableModules = moduleStats;
      shortlist.innerHTML = availableModules.length
        ? availableModules
            .map(
              (mod) =>
                `<a class="module-row" href="module.html?module=${encodeURIComponent(mod.id)}"><span class="dashboard-module-thumb"><img src="${youtubeThumb(mod.videoUrl)}" alt=""></span><span class="module-row-info"><span class="module-category">${escapeHtml(mod.level)}</span><strong>${escapeHtml(mod.name)}</strong><small>${escapeHtml(mod.description)}</small></span><span class="mini-progress"><span style="width:${mod.progress}%;background:#087cff"></span></span><span class="module-percent">${mod.progress}%</span><span class="module-status">${mod.status}</span><i data-lucide="chevron-right" aria-hidden="true"></i></a>`,
            )
            .join("")
        : '<p class="leaderboard-empty">Belum ada modul. Modul akan muncul setelah admin menambahkannya.</p>';
    }
  }
  updateModuleDashboard();
  let ranks = [];
  try {
    const parsed = JSON.parse(getStored("rlc_admin_leaderboard_data", "[]"));
    if (Array.isArray(parsed)) ranks = parsed;
  } catch (_) {
    ranks = [];
  }
  ranks = ranks
    .filter(
      (row) =>
        row &&
        (row.name || row.username) &&
        Number.isFinite(Number(row.xp ?? row.points)),
    )
    .map((row) => ({
      ...row,
      name: String(row.name || row.username),
      xp: Number(row.xp ?? row.points ?? 0),
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5);
  const rankList = document.getElementById("dashboard-rank-list");
  if (rankList) {
    rankList.innerHTML = ranks.length
      ? ranks
          .map((row, index) => {
            const rank = index + 1;
            const isCurrent =
              String(row.userKey || row.username || row.name).toLowerCase() ===
                userKey || row.name === displayName;
            const avatar = row.avatar || (isCurrent ? avatarValue : "");
            const safeName = row.name.replace(
              /[&<>\"']/g,
              (ch) =>
                ({
                  "&": "&amp;",
                  "<": "&lt;",
                  ">": "&gt;",
                  '\"': "&quot;",
                  "'": "&#39;",
                })[ch],
            );
            const avatarStyle = avatar
              ? `style=\"background-image:url('${avatar.startsWith("data:") ? avatar : `assets/avatars/${String(avatar).replace(/[^a-zA-Z0-9_-]/g, "")}.png`}');background-size:cover;background-position:center\"`
              : "";
            return `<div class=\"rank-row ${isCurrent ? "current-user-row" : ""}\"><span class=\"rank-medal ${rank === 1 ? "gold" : rank === 3 ? "bronze" : ""}\">${rank === 1 ? '<i data-lucide=\"crown\" aria-label=\"Peringkat pertama\"></i>' : rank}</span><span class=\"rank-avatar\" ${avatarStyle}>${avatar ? "" : safeName.charAt(0).toUpperCase()}</span><span class=\"rank-name\">${safeName}</span><strong>${row.xp.toLocaleString("id-ID")} XP</strong></div>`;
          })
          .join("")
      : '<p class=\"leaderboard-empty\">Leaderboard belum tersedia. Data peringkat akan muncul setelah tersedia.</p>';
  }
  const streakCount = Number(getStored(`rlc_streak_${userKey}`, "0")) || 0;
  const streak = document.getElementById("dashboard-streak-count");
  if (streak) streak.textContent = `${streakCount} Hari`;
  if (window.lucide) window.lucide.createIcons();
})();
