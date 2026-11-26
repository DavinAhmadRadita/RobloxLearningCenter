(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) =>
    String(v ?? "").replace(
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
  const roleName = (role) =>
    ({ admin: "Admin", moderator: "Moderator", learner: "Learner" })[role] ||
    role;
  const dateLabel = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };
  let users = [],
    selected = null,
    currentUser = null;
  const toast = (message) => {
    const el = $("#users-toast");
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2600);
  };
  const badge = (role) =>
    `<span class="role-badge ${esc(role)}">${roleName(role)}</span>`;
  const avatar = (user) =>
    `<div class="user-avatar">${esc((user.displayName || user.username || "?").slice(0, 1).toUpperCase())}</div>`;
  const isCurrentUser = (user) =>
    Boolean(currentUser && String(user.id) === String(currentUser.id));
  const roleAction = (user) =>
    isCurrentUser(user)
      ? ``
      : `<button class="action-button" type="button" data-edit-user="${user.id}"><i data-lucide="pencil"></i> Ubah Role</button>`;
  const row = (user, index) => `<tr>
    <td>${index + 1}</td><td><div class="user-identity">${avatar(user)}<div><div class="user-name">${esc(user.username)}</div><div class="user-sub">ID #${esc(user.id)}</div></div></div></td>
    <td>${esc(user.displayName || user.username)}</td><td>${esc(user.email)}</td><td>${esc(dateLabel(user.joinedAt))}</td>
    <td>${roleAction(user)}</td></tr>`;
  const renderTable = (selector, role, countSelector) => {
    const list = users.filter((u) => u.role === role);
    $(countSelector).textContent = `(${list.length})`;
    $(selector).innerHTML = list.length
      ? `<table class="users-table"><thead><tr><th>#</th><th>Username</th><th>Display Name</th><th>Email</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>${list.map(row).join("")}</tbody></table>`
      : `<div class="result-empty">Belum ada pengguna dengan role ${roleName(role)}.</div>`;
  };
  const render = (counts) => {
    $("#count-total").textContent = counts.total ?? users.length;
    $("#count-admin").textContent =
      counts.admins ?? users.filter((u) => u.role === "admin").length;
    $("#count-moderator").textContent =
      counts.moderators ?? users.filter((u) => u.role === "moderator").length;
    $("#count-learner").textContent =
      counts.learners ?? users.filter((u) => u.role === "learner").length;
    renderTable("#admin-list", "admin", "#admin-list-count");
    renderTable("#moderator-list", "moderator", "#moderator-list-count");
    if (window.lucide) window.lucide.createIcons();
  };
  async function loadUsers(search = "") {
    const url =
      "/api/admin/users" +
      (search ? `?username=${encodeURIComponent(search)}` : "");
    const response = await fetch(url, { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) location.href = "login.html";
      else if (response.status === 403) {
        alert("Halaman ini hanya dapat diakses oleh Admin.");
        location.href = "dashboard.html";
      }
      throw new Error(data.error || "Gagal memuat pengguna.");
    }
    users = data.users || [];
    render(data.counts || {});
    return data;
  }
  const modal = $("#role-modal");
  function openModal(user) {
    selected = user;
    $("#modal-user-summary").innerHTML =
      `<div class="user-identity">${avatar(user)}<div><div class="user-name">${esc(user.username)}</div><div class="user-sub">${esc(user.displayName || user.username)} · ${esc(user.email)}</div></div></div>`;
    $("#modal-current-role").innerHTML = badge(user.role);
    $("#new-role").value = user.role;
    updateRoleHelp();
    modal.hidden = false;
    if (window.lucide) window.lucide.createIcons();
  }
  function closeModal() {
    modal.hidden = true;
    selected = null;
  }
  function updateRoleHelp() {
    const descriptions = {
      learner: "Dapat belajar modul dan mengikuti challenge.",
      moderator: "Dapat membantu memoderasi forum dan mengelola konten.",
      admin: "Dapat mengelola fitur dan role pengguna.",
    };
    $("#role-help").textContent = descriptions[$("#new-role").value];
  }
  async function searchUsers(query) {
    const box = $("#search-results"),
      list = $("#search-user-list"),
      summary = $("#search-summary");
    if (!query.trim()) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    list.innerHTML = '<div class="result-empty">Mencari pengguna...</div>';
    try {
      const response = await fetch(
        "/api/admin/users?username=" + encodeURIComponent(query.trim()),
        { credentials: "same-origin" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Pencarian pengguna gagal.");
      const matches = data.users || [];
      summary.textContent = `${matches.length} pengguna ditemukan untuk username "${query.trim()}".`;
      list.innerHTML = matches.length
        ? matches
            .map(
              (user) =>
                `<article class="search-user-card"><div class="user-identity">${avatar(user)}<div><div class="user-name">${esc(user.username)}</div><div class="user-sub">${esc(user.displayName || user.username)} · ${esc(user.email)}</div></div></div><div class="search-user-meta"><div><strong>Role Saat Ini</strong>${badge(user.role)}</div><div><strong>Bergabung</strong>${esc(dateLabel(user.joinedAt))}</div></div>${roleAction(user)}</article>`,
            )
            .join("")
        : `<div class="result-empty"><i data-lucide="user-round-x"></i><strong>Pengguna tidak ditemukan</strong>Tidak ada username yang cocok. Coba periksa kembali ejaan username.</div>`;
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      list.innerHTML = `<div class="result-empty">${esc(err.message)}</div>`;
    }
  }
  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-edit-user]");
    if (button) {
      const user = users.find((u) => String(u.id) === button.dataset.editUser);
      if (user) openModal(user);
    }
  });
  $("#user-search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    searchUsers($("#user-search-input").value);
  });
  $("#clear-search").addEventListener("click", () => {
    $("#user-search-input").value = "";
    $("#search-results").hidden = true;
  });
  $("#new-role").addEventListener("change", updateRoleHelp);
  $("#role-modal-close").addEventListener("click", closeModal);
  $("#role-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
  $("#role-save").addEventListener("click", async () => {
    if (!selected) return;
    const role = $("#new-role").value,
      button = $("#role-save"),
      selectedUsername = selected.username;
    if (role === selected.role) {
      closeModal();
      return;
    }
    button.disabled = true;
    button.textContent = "Menyimpan...";
    try {
      const response = await fetch(`/api/admin/users/${selected.id}/role`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Role gagal diperbarui.");
      closeModal();
      await loadUsers();
      const query = $("#user-search-input").value.trim();
      if (query) await searchUsers(query);
      toast(
        `Role ${selectedUsername} berhasil diperbarui menjadi ${roleName(role)}.`,
      );
    } catch (err) {
      toast(err.message);
    } finally {
      button.disabled = false;
      button.innerHTML = '<i data-lucide="save"></i> Simpan Perubahan';
      if (window.lucide) window.lucide.createIcons();
    }
  });
  $("#users-logout").addEventListener("click", async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    sessionStorage.clear();
    localStorage.removeItem("rlc_remembered_user");
    location.href = "login.html";
  });
  $("#profile").addEventListener(
    "click",
    () => (location.href = "profile.html"),
  );
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then((r) => {
      if (!r.ok) throw new Error("Silakan login sebagai Admin.");
      return r.json();
    })
    .then((data) => {
      currentUser = data.user;
      if (String(currentUser.role).toLowerCase() !== "admin") {
        location.href = "dashboard.html";
        return;
      }

      const sidebarUsername = String(currentUser.username || "");
      const sidebarUserKey = sidebarUsername.toLowerCase();
      const readStored = (key, fallback = "") => {
        try {
          return localStorage.getItem(key) || fallback;
        } catch (_) {
          return fallback;
        }
      };
      const sidebarDisplayName =
        readStored(`rlc_display_name_${sidebarUserKey}`, sidebarUsername) ||
        sidebarUsername;
      const sidebarAvatar = readStored(
        `rlc_avatar_${sidebarUserKey}`,
        "avatar-01",
      );
      $("#profile-name").textContent = sidebarDisplayName;
      $("#profile-handle").textContent = sidebarUsername
        ? `@${sidebarUsername}`
        : "@username";

      const avatarNode = $("#avatar");
      avatarNode.style.backgroundImage = "";
      avatarNode.style.backgroundSize = "cover";
      avatarNode.style.backgroundPosition = "center";
      avatarNode.style.backgroundRepeat = "no-repeat";
      if (sidebarAvatar.startsWith("data:")) {
        avatarNode.style.backgroundImage = `url("${sidebarAvatar}")`;
        avatarNode.textContent = "";
      } else if (/^avatar-\d{2}$/.test(sidebarAvatar)) {
        avatarNode.style.backgroundImage = `url("assets/avatars/${sidebarAvatar}.png")`;
        avatarNode.textContent = "";
      } else {
        avatarNode.textContent = (sidebarDisplayName || sidebarUsername || "U")
          .charAt(0)
          .toUpperCase();
      }
      loadUsers().catch((err) => toast(err.message));
    })
    .catch(() => {
      location.href = "login.html";
    });
})();
