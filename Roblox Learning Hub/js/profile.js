(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const currentUser =
    sessionStorage.getItem("rlc_current_user") ||
    localStorage.getItem("rlc_remembered_user") ||
    "USERNAME";
  if (currentUser !== "USERNAME")
    sessionStorage.setItem("rlc_current_user", currentUser);
  const userKey = currentUser.toLowerCase();
  const displayNameKey = "rlc_display_name_" + userKey;
  const displayName = localStorage.getItem(displayNameKey) || currentUser;
  const heroUsername = $("#hero-username");
  if (heroUsername) heroUsername.textContent = displayName;
  const heroHandle = $("#hero-handle");
  if (heroHandle) heroHandle.textContent = "@" + currentUser;
  const sidebarName = $("#profile-name");
  if (sidebarName) sidebarName.textContent = displayName;
  const sidebarHandle = $("#profile-handle");
  if (sidebarHandle) sidebarHandle.textContent = "@" + currentUser;
  const displayNameInfo = $("#info-display-name");
  if (displayNameInfo) displayNameInfo.textContent = displayName;
  $("#info-username").textContent = "@" + currentUser;
  let savedEmail = localStorage.getItem("rlc_email_" + userKey) || "";
  try {
    const accounts = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
    const account =
      accounts[userKey] ||
      Object.values(accounts).find(
        (item) =>
          item &&
          typeof item.username === "string" &&
          item.username.toLowerCase() === userKey,
      );
    if (account && typeof account.email === "string" && account.email.trim()) {
      savedEmail = account.email.trim();
      localStorage.setItem("rlc_email_" + userKey, savedEmail);
    }
  } catch (_) { }
  const emailElement = $("#info-email");
  if (emailElement) emailElement.textContent = savedEmail || "Belum diatur";

  const avatarChoices = Array.from(
    { length: 23 },
    (_, i) => `avatar-${String(i + 1).padStart(2, "0")}`,
  );
  const avatarPath = (choice) => `assets/avatars/${choice}.png`;

  let badgeChoices = [];
  const badgeCatalogUrl = "assets/data/badges.json";
  async function loadBadgeCatalog() {
    const localBadges = [
      { id: "pemula", name: "Pemula", description: "Menyelesaikan video pembelajaran pertama.", owned: true, icon_url: "assets/badges/pemula.svg" },
      { id: "pembelajar-aktif", name: "Pembelajar Aktif", description: "Menyelesaikan 5 video pembelajaran.", owned: true, icon_url: "assets/badges/pembelajar-aktif.svg" },
      { id: "master-modul", name: "Master Modul", description: "Menyelesaikan seluruh video dalam modul.", owned: true, icon_url: "assets/badges/master-modul.svg" },
      { id: "penjelajah-materi", name: "Penjelajah Materi", description: "Menyelesaikan 10 video pembelajaran.", owned: false, icon_url: "assets/badges/penjelajah-materi.svg" },
      { id: "penakluk-challenge", name: "Penakluk Challenge", description: "Menyelesaikan 5 challenge.", owned: false, icon_url: "assets/badges/penakhluk-challenge.svg" },
      { id: "game-developer", name: "Game Developer", description: "Menyelesaikan challenge membuat game di Roblox Studio.", owned: false, icon_url: "assets/badges/game-developer.svg" },
      { id: "rajin-belajar", name: "Rajin Belajar", description: "Belajar 7 hari berturut-turut.", owned: true, icon_url: "assets/badges/rajin-belajar.svg" },
      { id: "kontributor", name: "Kontributor", description: "Membuat 5 postingan relevan di forum.", owned: true, icon_url: "assets/badges/kontributor.svg" },
      { id: "pembantu-komunitas", name: "Pembantu Komunitas", description: "Memberikan 10 jawaban yang membantu.", owned: false, icon_url: "assets/badges/comunity-helper.svg" },
      { id: "master-kreator", name: "Master Creator", description: "Menyelesaikan seluruh video wajib dan challenge.", owned: false, icon_url: "assets/badges/master-kreator.svg" }
    ];
    try {
      const response = await fetch(badgeCatalogUrl);
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload.badges) && payload.badges.length) {
          const localById = new Map(localBadges.map((badge) => [badge.id, badge]));
          return payload.badges.map((badge) => ({ ...(localById.get(badge.id) || {}), ...normalizeBadge(badge), icon_url: (localById.get(badge.id)?.icon_url || normalizeBadge(badge).icon_url) }));
        }
      }
    } catch (_) { }
    return localBadges.map(normalizeBadge);
  }
  function normalizeBadge(badge) {
    return { ...badge, id: badge.id || badge.badge_id || badge.name, name: badge.name || badge.title || "Badge", description: badge.description || "", icon_url: badge.icon_url || badge.iconUrl || "assets/badges/pemula.svg", owned: Boolean(badge.owned ?? badge.is_owned ?? false) };
  }
  const storedAvatar = localStorage.getItem("rlc_avatar_" + userKey) || "";
  let selectedAvatar = storedAvatar || avatarChoices[0];
  const badgeStorageKey = "rlc_profile_badges_" + userKey;
  let selectedBadges = [];
  function loadSavedBadgeSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(badgeStorageKey) || "null");
      selectedBadges = Array.isArray(saved)
        ? saved.filter((id) => badgeChoices.some((badge) => (badge.id === id || badge.name === id) && badge.owned)).map((id) => badgeChoices.find((badge) => badge.id === id || badge.name === id).id).slice(0, 5)
        : badgeChoices.filter((badge) => badge.owned).slice(0, 5).map((badge) => badge.id);
    } catch (_) { selectedBadges = []; }
  }
  const bannerChoices = [
    { id: "default", name: "Default" },
    { id: "night-blade", name: "Night Blade" },
    { id: "sunset-horizon", name: "Sunset Horizon" },
    { id: "sky-islands", name: "Sky Islands" },
    { id: "neon-city", name: "Neon City" },
    { id: "dark-aesthetic", name: "Dark Aesthetic" },
    { id: "nature-realm", name: "Nature Realm" },
    { id: "starry-night", name: "Starry Night" },
    { id: "blue-pulse", name: "Blue Pulse" },
    { id: "red-shadow", name: "Red Shadow" },
  ];
  const bannerStorageKey = "rlc_profile_banner_" + userKey;
  let selectedBanner = localStorage.getItem(bannerStorageKey) || "default";
  const bannerGrid = $("#banner-choice-grid");
  const bannerArt = $(".profile-banner-art");
  function bannerPath(id) { return "assets/banners/" + id + ".webp"; }
  function applyBanner(id) {
    if (!bannerArt) return;
    bannerArt.style.backgroundImage = "";
    bannerArt.style.backgroundSize = "cover";
    bannerArt.style.backgroundPosition = "center";
    bannerArt.style.backgroundRepeat = "no-repeat";
    bannerArt.classList.add("custom-banner");
    bannerArt.style.backgroundImage = `linear-gradient(90deg, rgba(5,13,29,.12), rgba(5,13,29,.04)), url("${bannerPath(id)}")`;
  }
  function renderBannerChoices() {
    if (!bannerGrid) return;
    bannerGrid.innerHTML = "";
    bannerChoices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "banner-choice" + (selectedBanner === choice.id ? " selected" : "");
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", selectedBanner === choice.id ? "true" : "false");
      button.innerHTML = `<img src="${bannerPath(choice.id)}" alt=""><span class="banner-choice-check" aria-hidden="true">✓</span><span class="banner-choice-name">${choice.name}</span>`;
      button.addEventListener("click", () => {
        selectedBanner = choice.id;
        renderBannerChoices();
      });
      bannerGrid.appendChild(button);
    });
  }
  const uploadedAvatarStorageKey = "rlc_uploaded_avatar_" + userKey;
  let uploadedAvatar =
    localStorage.getItem(uploadedAvatarStorageKey) ||
    (storedAvatar.startsWith("data:") ? storedAvatar : "");
  const avatarGrids = [$("#avatar-grid"), $("#edit-avatar-choice-grid")].filter(Boolean),
    editAvatarPreview = $("#edit-avatar-preview"),
    badgeGrid = $("#badge-grid"),
    uploadInput = $("#avatar-upload"),
    toast = $("#toast");
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function applyAvatar(el, choice) {
    if (!el) return;
    el.style.backgroundImage = "";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
    if (typeof choice === "string" && choice.startsWith("data:")) {
      el.style.backgroundImage = `url("${choice}")`;
      el.textContent = "";
    } else if (avatarChoices.includes(choice)) {
      el.style.backgroundImage = `url("${avatarPath(choice)}")`;
      el.textContent = "";
    } else {
      el.textContent = currentUser.charAt(0).toUpperCase() || "U";
    }
  }
  function renderAvatarChoices() {
    avatarGrids.forEach((avatarGrid) => {
      avatarGrid.innerHTML = "";
      const upload = document.createElement("button");
      upload.type = "button";
      upload.className = "choice-circle upload-choice";
      upload.setAttribute("aria-label", "Upload avatar");
      upload.innerHTML =
        '<svg aria-hidden="true" class="upload-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3"/><path d="m6 11 6-6 6 6"/><path d="M5 21h14"/></svg>';
      upload.title = "Upload avatar from your device";
      if (
        selectedAvatar === "upload" ||
        (selectedAvatar && selectedAvatar.startsWith("data:"))
      )
        upload.classList.add("selected");
      upload.addEventListener("click", () => uploadInput.click());
      avatarGrid.appendChild(upload);
      if (uploadedAvatar) {
        const custom = document.createElement("button");
        custom.type = "button";
        custom.className = "choice-circle avatar-choice custom-avatar-choice";
        custom.setAttribute("aria-label", "Avatar upload pribadi");
        custom.title = "Avatar upload pribadi";
        custom.style.backgroundImage = `url("${uploadedAvatar}")`;
        if (selectedAvatar === uploadedAvatar) custom.classList.add("selected");
        custom.addEventListener("click", () => {
          selectedAvatar = uploadedAvatar;
          renderAvatarChoices();
        });
        avatarGrid.appendChild(custom);
      }
      avatarChoices.forEach((choice, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice-circle avatar-choice";
        b.setAttribute("aria-label", "Default avatar " + (i + 1));
        b.title = "Avatar " + (i + 1);
        b.style.backgroundImage = `url("${avatarPath(choice)}")`;
        if (selectedAvatar === choice) b.classList.add("selected");
        b.addEventListener("click", () => {
          selectedAvatar = choice;
          renderAvatarChoices();
        });
        avatarGrid.appendChild(b);
      });
    });
    applyAvatar(editAvatarPreview, selectedAvatar);
  }
  function renderBadges() {
    badgeGrid.innerHTML = "";
    const count = $("#badge-selected-count");
    if (count) count.textContent = `${selectedBadges.length} / 5 dipilih`;
    const selectedPreview = $("#badge-selected-preview");
    if (selectedPreview) {
      selectedPreview.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const name = selectedBadges[i];
        const badge = badgeChoices.find((item) => item.id === name || item.name === name);
        const slot = document.createElement("span");
        slot.className = "badge-preview-slot" + (badge ? " filled" : "");
        if (badge) { slot.innerHTML = `<img src="${badge.icon_url}" alt="">`; } else { slot.textContent = "+"; }
        slot.title = badge ? badge.name : "Slot badge kosong";
        selectedPreview.appendChild(slot);
      }
    }
    badgeChoices.forEach((badge) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "badge-option" + (!badge.owned ? " locked" : "") + (selectedBadges.includes(badge.id) ? " selected" : "");
      b.setAttribute("aria-label", badge.name + (badge.owned ? "" : " (belum terbuka)"));
      b.title = badge.name + (badge.owned ? "" : " — belum diperoleh");
      b.innerHTML = `<span class="badge-option-check">${selectedBadges.includes(badge.id) ? "✓" : (badge.owned ? "" : "<i data-lucide=\"lock\" aria-hidden=\"true\"></i>")}</span><span class="badge-art"><img src="${badge.icon_url}" alt="${badge.name}" loading="eager"></span><strong>${badge.name}</strong><span class="badge-description">${badge.description}</span>`;
      const badgeImage = b.querySelector(".badge-art img");
      badgeImage.addEventListener("error", () => { b.remove(); badgeChoices = badgeChoices.filter((item) => item.id !== badge.id); });
      b.addEventListener("click", () => {
        if (!badge.owned) { notify("Badge ini belum terbuka."); return; }
        if (selectedBadges.includes(badge.id)) selectedBadges = selectedBadges.filter((n) => n !== badge.id);
        else {
          if (selectedBadges.length >= 5) { notify("Maksimal 5 badge untuk ditampilkan."); return; }
          selectedBadges.push(badge.id);
        }
        renderBadges();
      });
      badgeGrid.appendChild(b);
    });
    if (window.lucide) window.lucide.createIcons();
  }
  function renderProfileAvatar() {
    applyAvatar($("#hero-avatar"), selectedAvatar);
    applyAvatar($("#avatar"), selectedAvatar);
  }
  function renderBadgePreview() {
    const preview = $("#badge-preview");
    preview.innerHTML = "";
    const badgeCount = $("#badge-count");
    if (badgeCount) badgeCount.textContent = `${selectedBadges.length}/5`;
    selectedBadges.slice(0, 5).forEach((name) => {
      const badge = badgeChoices.find((x) => (x.id === name || x.name === name) && x.owned);
      if (!badge) return;
      const el = document.createElement("div");
      el.className = "badge-dot";
      el.innerHTML = `<img src="${badge.icon_url}" alt="">`;
      el.title = badge.name;
      preview.appendChild(el);
    });
    while (preview.children.length < 5) {
      const empty = document.createElement("div");
      empty.className = "badge-dot badge-empty";
      empty.setAttribute("aria-label", "Slot badge kosong");
      preview.appendChild(empty);
    }
  }
  renderAvatarChoices();
  renderBannerChoices();
  applyBanner(selectedBanner);
  renderProfileAvatar();
  loadBadgeCatalog().then((catalog) => { badgeChoices = catalog; loadSavedBadgeSelection(); renderBadges(); renderBadgePreview(); });
  $("#view-badges").addEventListener("click", () =>
    $("#badge-modal").classList.add("open"),
  );
  document
    .querySelectorAll("[data-close]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        $("#" + b.dataset.close).classList.remove("open"),
      ),
    );
  document.querySelectorAll(".modal-backdrop").forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll(".modal-backdrop.open")
        .forEach((m) => m.classList.remove("open"));
  });
  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Pilih file gambar ya.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("Ukuran gambar maksimal 5 MB.");
      uploadInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      uploadedAvatar = reader.result;
      selectedAvatar = reader.result;
      renderAvatarChoices();
    };
    reader.readAsDataURL(file);
  });
  $("#save-avatar").addEventListener("click", () => {
    if (uploadedAvatar) {
      try {
        localStorage.setItem(uploadedAvatarStorageKey, uploadedAvatar);
      } catch (e) {
        notify(
          "Gambar terlalu besar untuk disimpan browser. Coba gambar yang lebih kecil.",
        );
        return;
      }
    }
    localStorage.setItem("rlc_avatar_" + userKey, selectedAvatar);
    renderProfileAvatar();
    $("#avatar-modal").classList.remove("open");
    notify("Avatar berhasil diperbarui!");
  });
  $("#save-badge").addEventListener("click", () => {
    selectedBadges = selectedBadges
      .filter((n) => badgeChoices.some((b) => (b.id === n || b.name === n) && b.owned))
      .slice(0, 5);
    localStorage.setItem(badgeStorageKey, JSON.stringify(selectedBadges));
    renderBadgePreview();
    $("#badge-modal").classList.remove("open");
    notify("Badge profil berhasil disimpan!");
  });
  const openEditProfile = () => {
    selectedBanner = localStorage.getItem(bannerStorageKey) || selectedBanner || "default";
    renderBannerChoices();
    applyBanner(selectedBanner);
    $("#display-name-input").value = localStorage.getItem(displayNameKey) || currentUser;
    $("#username-readonly").value = "@" + currentUser;
    $("#edit-profile-modal").classList.add("open");
  };
  document.querySelectorAll('[data-setting="Edit Profile"]').forEach((button) => button.addEventListener("click", openEditProfile));
  document.querySelectorAll('[data-setting]:not([data-setting="Edit Profile"])').forEach((b) =>
    b.addEventListener("click", () => notify(b.dataset.setting + " akan dihubungkan ke backend nanti.")),
  );
  $("#save-profile").addEventListener("click", () => {
    const input = $("#display-name-input");
    const nextName = input.value.trim();
    if (!nextName) { notify("Display Name tidak boleh kosong."); input.focus(); return; }
    if (nextName.length > 32) { notify("Display Name maksimal 32 karakter."); return; }
    localStorage.setItem(displayNameKey, nextName);
    localStorage.setItem(bannerStorageKey, selectedBanner);
    if (uploadedAvatar && uploadedAvatar.startsWith("data:")) {
      try { localStorage.setItem(uploadedAvatarStorageKey, uploadedAvatar); } catch (_) { notify("Avatar terlalu besar untuk disimpan. Coba gambar yang lebih kecil."); return; }
    }
    localStorage.setItem("rlc_avatar_" + userKey, selectedAvatar);
    renderProfileAvatar();
    applyBanner(selectedBanner);
    if (heroUsername) heroUsername.textContent = nextName;
    if (sidebarName) sidebarName.textContent = nextName;
    if (displayNameInfo) displayNameInfo.textContent = nextName;
    if (heroHandle) heroHandle.textContent = "@" + currentUser;
    const welcome = document.getElementById("welcome-name");
    if (welcome) welcome.textContent = nextName.toUpperCase();
    $("#edit-profile-modal").classList.remove("open");
    notify("Profil berhasil diperbarui!");
  });
})();
