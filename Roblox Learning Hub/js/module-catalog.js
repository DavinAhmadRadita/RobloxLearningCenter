(() => {
  const normalize = (items) =>
    items
      .filter(
        (m) =>
          m &&
          m.id !== undefined &&
          m.id !== null &&
          String(m.title || m.name || "").trim(),
      )
      .map((m) => ({
        ...m,
        id: String(m.id),
        title: String(m.title || m.name || "").trim(),
        name: String(m.title || m.name || "").trim(),
        level: String(m.level || "Pemula"),
        category: String(m.level || m.category || "Pemula"),
        description: String(m.description || ""),
        videoUrl: String(m.videoUrl || m.video_url || m.url || ""),
      }));
  try {
    const saved = JSON.parse(localStorage.getItem("rlc_admin_modules") || "[]");
    window.RLC_MODULES = Array.isArray(saved) ? normalize(saved) : [];
  } catch (_) {
    window.RLC_MODULES = [];
  }
})();
