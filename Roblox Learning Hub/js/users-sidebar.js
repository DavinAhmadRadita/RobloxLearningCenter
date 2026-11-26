(() => {
  const get = (key, fallback = "") => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  };
  const currentUser = sessionStorage.getItem("rlc_current_user") || "";
  const userKey = currentUser.toLowerCase();
  const displayName = currentUser
    ? get(`rlc_display_name_${userKey}`, get("rlc_display_name", currentUser))
    : "USERNAME";
  const avatarValue = currentUser
    ? get(`rlc_avatar_${userKey}`, get("rlc_avatar", "avatar-01"))
    : "";
  const nameNode = document.getElementById("profile-name");
  const handleNode = document.getElementById("profile-handle");
  const avatarNode = document.getElementById("avatar");
  if (nameNode) nameNode.textContent = displayName;
  if (handleNode)
    handleNode.textContent = currentUser ? `@${currentUser}` : "@username";
  if (avatarNode) {
    avatarNode.style.backgroundImage = "";
    avatarNode.style.backgroundSize = "cover";
    avatarNode.style.backgroundPosition = "center";
    avatarNode.style.backgroundRepeat = "no-repeat";
    if (avatarValue.startsWith("data:")) {
      avatarNode.style.backgroundImage = `url("${avatarValue}")`;
      avatarNode.textContent = "";
    } else if (/^avatar-\d{2}$/.test(avatarValue)) {
      avatarNode.style.backgroundImage = `url("assets/avatars/${avatarValue}.png")`;
      avatarNode.textContent = "";
    } else {
      avatarNode.textContent = (displayName || currentUser || "U")
        .charAt(0)
        .toUpperCase();
    }
  }
  const profile = document.getElementById("profile");
  if (profile)
    profile.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
})();
