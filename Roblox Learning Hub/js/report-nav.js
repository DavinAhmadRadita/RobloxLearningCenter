(() => {
  const nav = document.querySelector(".navigation");
  if (!nav || nav.querySelector("[data-report-logs-link]")) return;

  const activeUser = sessionStorage.getItem("rlc_current_user");
  if (!activeUser) return;

  fetch("/api/auth/me", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      return response.json().catch(() => null);
    })
    .then((data) => {
      const user = data?.user;
      const role = String(user?.role || "").toLowerCase();
      if (
        !user ||
        String(user.username).toLowerCase() !== activeUser.toLowerCase() ||
        !["admin", "moderator"].includes(role)
      )
        return;

      const link = document.createElement("a");
      link.href = "report-logs.html";
      link.className =
        "nav-item" +
        (document.body.dataset.page === "Report Logs" ? " active" : "");
      link.dataset.reportLogsLink = "true";
      link.innerHTML =
        '<span class="nav-icon"><i data-lucide="file-warning" aria-hidden="true"></i></span><span>REPORT LOGS</span>';

      const challenges = [...nav.querySelectorAll("[data-page]")].find(
        (item) =>
          String(item.dataset.page || "").toLowerCase() === "challenges",
      );
      if (challenges) challenges.insertAdjacentElement("afterend", link);
      else nav.appendChild(link);

      if (window.lucide) window.lucide.createIcons();
    })
    .catch((error) => console.error("Report Logs navigation:", error));
})();
