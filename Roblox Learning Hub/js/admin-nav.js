(() => {
  const nav = document.querySelector(".navigation");
  if (!nav || nav.querySelector("[data-admin-users-link]")) return;

  const activeUser = sessionStorage.getItem("rlc_current_user");
  if (!activeUser) return;

  fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (
        !data ||
        !data.user ||
        String(data.user.role).toLowerCase() !== "admin" ||
        String(data.user.username).toLowerCase() !== activeUser.toLowerCase()
      )
        return;

      const active = document.body.dataset.page === "Kelola Pengguna";
      const item = document.createElement("a");
      item.href = "users.html";
      item.className = "nav-item" + (active ? " active" : "");
      item.dataset.adminUsersLink = "true";
      item.innerHTML =
        '<span class="nav-icon"><i data-lucide="users" aria-hidden="true"></i></span><span>KELOLA PENGGUNA</span>';
      nav.appendChild(item);
      if (window.lucide) window.lucide.createIcons();
    })
    .catch(() => {});
})();
