(() => {
  const list = document.getElementById("module-list");
  if (!list) return;
  const userKey = (
    sessionStorage.getItem("rlc_current_user") ||
    localStorage.getItem("rlc_remembered_user") ||
    "guest"
  ).toLowerCase();
  const storageKey = `rlc_module_lessons_${userKey}`;
  let completed = [];
  const startedKey = `rlc_started_lessons_${userKey}`;
  let started = [];
  try {
    started = JSON.parse(localStorage.getItem(startedKey) || "[]");
    if (!Array.isArray(started)) started = [];
  } catch (_) {
    started = [];
  }
  try {
    completed = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch (_) {
    completed = [];
  }

  const modules = Array.isArray(window.RLC_MODULES) ? window.RLC_MODULES : [];
  const totalModuleCount = document.getElementById("total-module-count");
  const moduleListCount = document.getElementById("module-list-count");
  if (totalModuleCount) totalModuleCount.textContent = String(modules.length);
  if (moduleListCount) moduleListCount.textContent = `${modules.length} MODUL`;
  if (!list.querySelector(".module-card") && modules.length === 0) {
    list.innerHTML = `<div class="empty-state module-empty-state"><i data-lucide="book-open" aria-hidden="true"></i><h3>Belum ada modul pembelajaran</h3><p>Modul akan muncul di sini setelah admin menambahkannya.</p></div>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function refreshProgress() {
    let completedModules = 0;
    let completedTotal = 0;
    const allLessons = list.querySelectorAll("[data-lesson]");
    list.querySelectorAll(".module-card").forEach((card) => {
      const lessonLinks = [...card.querySelectorAll("[data-lesson]")];
      const done = lessonLinks.filter((lesson) =>
        completed.includes(
          `${card.dataset.module}-${lesson.querySelector(".lesson-index").textContent.trim()}`,
        ),
      ).length;
      completedTotal += done;
      if (done === lessonLinks.length) completedModules++;
      const pct = lessonLinks.length
        ? Math.round((done / lessonLinks.length) * 100)
        : 0;
      const fill = card.querySelector(".module-progress-line span");
      const label = card.querySelector(".module-progress-label");
      const status = card.querySelector(".module-status");
      if (fill) fill.style.width = `${pct}%`;
      if (label)
        label.textContent = `${done} dari ${lessonLinks.length} materi selesai`;
      if (status) {
        status.className =
          "module-status " +
          (pct === 100 ? "completed" : pct > 0 ? "in-progress" : "not-started");
        status.textContent =
          pct === 100
            ? "Selesai"
            : pct > 0
              ? "Sedang dipelajari"
              : "Belum dimulai";
      }
      lessonLinks.forEach((lesson) => {
        const key = `${card.dataset.module}-${lesson.querySelector(".lesson-index").textContent.trim()}`;
        const isDone = completed.includes(key);
        lesson.classList.toggle("is-complete", isDone);
        const icon = lesson.querySelector(".lesson-open");
        if (icon)
          icon.innerHTML = isDone
            ? '<i data-lucide="circle-check"></i>'
            : '<i data-lucide="play-circle"></i>';
      });
    });
    const total = allLessons.length;
    const overall = total ? Math.round((completedTotal / total) * 100) : 0;
    const count = document.getElementById("completed-module-count");
    const progress = document.getElementById("overall-module-progress");
    if (count) count.textContent = completedModules;
    if (progress) progress.textContent = `${overall}%`;
    if (window.lucide) window.lucide.createIcons();
  }

  list.querySelectorAll(".module-card-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".module-card");
      const panel = document.getElementById(
        button.getAttribute("aria-controls"),
      );
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
      card.classList.toggle("is-open", !open);
    });
  });

  refreshProgress();

  const params = new URLSearchParams(window.location.search);
  const targetModule = params.get("module");
  const targetLesson = params.get("lesson");
  if (targetModule) {
    const card = list.querySelector(
      `.module-card[data-module="${CSS.escape(targetModule)}"]`,
    );
    if (card) {
      const toggle = card.querySelector(".module-card-toggle");
      const panel = card.querySelector(".module-lessons");
      if (toggle && panel) {
        toggle.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        card.classList.add("is-open");
      }
      if (targetLesson) {
        const lesson = [...card.querySelectorAll("[data-lesson]")].find(
          (item) =>
            item.querySelector(".lesson-index")?.textContent.trim() ===
            targetLesson,
        );
        if (lesson) {
          lesson.classList.add("is-current-lesson");
          lesson.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }
})();
