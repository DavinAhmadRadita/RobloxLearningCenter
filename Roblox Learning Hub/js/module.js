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
  const videoModal = document.getElementById('lesson-video-modal');
  const videoTitle = document.getElementById('lesson-video-title');
  const videoFrame = document.getElementById('lesson-video-iframe');
  const videoPlaceholder = document.getElementById('lesson-video-placeholder');

  function openLessonVideo(lesson) {
    const title = lesson.querySelector('.lesson-copy strong')?.textContent.trim() || 'Video Pembelajaran';
    videoTitle.textContent = title;
    const videoUrl = lesson.dataset.videoUrl || '';
    if (videoUrl) {
      videoFrame.src = videoUrl;
      videoFrame.hidden = false;
      videoPlaceholder.hidden = true;
    } else {
      videoFrame.removeAttribute('src');
      videoFrame.hidden = true;
      videoPlaceholder.hidden = false;
    }
    videoModal.hidden = false;
    document.body.classList.add('lesson-video-open');
    if (window.lucide) window.lucide.createIcons();
    videoModal.querySelector('.lesson-video-close')?.focus();
  }

  function closeLessonVideo() {
    if (!videoModal) return;
    videoModal.hidden = true;
    videoFrame.removeAttribute('src');
    document.body.classList.remove('lesson-video-open');
  }
  videoModal?.querySelectorAll('[data-close-lesson]').forEach(button => button.addEventListener('click', closeLessonVideo));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && videoModal && !videoModal.hidden) closeLessonVideo(); });
  try { started = JSON.parse(localStorage.getItem(startedKey) || '[]'); if (!Array.isArray(started)) started = []; } catch (_) { started = []; }
  try {
    completed = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch (_) {
    completed = [];
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

  list.querySelectorAll("[data-lesson]").forEach((lesson) => {
    lesson.addEventListener("click", (event) => {
      event.preventDefault();
      const card = lesson.closest(".module-card");
      const index = lesson.querySelector(".lesson-index").textContent.trim();
      const key = `${card.dataset.module}-${index}`;
      const lastKey = `rlc_last_lesson_${userKey}`;
      localStorage.setItem(lastKey, JSON.stringify({ moduleId: Number(card.dataset.module), lessonId: index }));
      if (!started.includes(key)) { started.push(key); localStorage.setItem(startedKey, JSON.stringify(started)); }
      openLessonVideo(lesson);
    });
  });
  refreshProgress();

  const params = new URLSearchParams(window.location.search);
  const targetModule = params.get('module');
  const targetLesson = params.get('lesson');
  if (targetModule) {
    const card = list.querySelector(`.module-card[data-module="${CSS.escape(targetModule)}"]`);
    if (card) {
      const toggle = card.querySelector('.module-card-toggle');
      const panel = card.querySelector('.module-lessons');
      if (toggle && panel) { toggle.setAttribute('aria-expanded', 'true'); panel.hidden = false; card.classList.add('is-open'); }
      if (targetLesson) {
        const lesson = [...card.querySelectorAll('[data-lesson]')].find(item => item.querySelector('.lesson-index')?.textContent.trim() === targetLesson);
        if (lesson) { lesson.classList.add('is-current-lesson'); lesson.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  }
})();
