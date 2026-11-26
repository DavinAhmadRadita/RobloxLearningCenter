(() => {
  const showFeedback = (node, message, kind = "error") => {
    if (!node) return;
    node.textContent = message || "";
    node.className = `password-feedback ${message ? `is-${kind}` : ""}`;
  };
  const showError = (node, message) => {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("visible", Boolean(message));
  };
  const email = document.getElementById("forgot-email");
  const forgotForm = document.getElementById("forgot-password-form");
  if (forgotForm) {
    const submit = document.getElementById("forgot-submit");
    const error = document.getElementById("forgot-error");
    const feedback = document.getElementById("forgot-feedback");
    const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    const update = () => {
      submit.disabled = !validEmail();
      showError(error, ""); showFeedback(feedback, "");
    };
    email.addEventListener("input", update);
    forgotForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validEmail()) { showError(error, "Masukkan alamat email yang valid."); return; }
      submit.disabled = true;
      try {
        const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value.trim() }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
        showFeedback(feedback, data.message, "success");
      } catch (err) { showError(error, err.message || "Tidak dapat menghubungi server."); }
      finally { submit.disabled = !validEmail(); }
    });
    update();
  }
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target); if (!input) return;
      const show = input.type === "password"; input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(show));
      const icon = button.querySelector("[data-lucide]");
      if (icon) { icon.setAttribute("data-lucide", show ? "eye-off" : "eye"); if (window.lucide) window.lucide.createIcons(); }
    });
  });
  const resetForm = document.getElementById("reset-password-form");
  if (resetForm) {
    const password = document.getElementById("new-password");
    const confirm = document.getElementById("confirm-new-password");
    const submit = document.getElementById("reset-submit");
    const error = document.getElementById("reset-error");
    const feedback = document.getElementById("reset-feedback");
    const token = new URLSearchParams(window.location.search).get("token") || "";
    const update = () => {
      const lengthOK = password.value.length >= 8 && password.value.length <= 32;
      const match = password.value === confirm.value;
      submit.disabled = !(lengthOK && password.value && confirm.value && match && token);
      if (confirm.value && !match) showError(error, "Password do not match.");
      else if (password.value && !lengthOK) showError(error, "Password harus terdiri dari 8–32 karakter.");
      else showError(error, "");
      showFeedback(feedback, "");
    };
    [password, confirm].forEach((field) => field.addEventListener("input", update));
    if (!token) showError(error, "Token reset tidak ditemukan. Gunakan link dari email reset password.");
    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault(); update(); if (submit.disabled) return;
      submit.disabled = true;
      try {
        const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: password.value }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Reset password gagal.");
        showFeedback(feedback, data.message || "Password berhasil diubah. Mengalihkan ke halaman login...", "success");
        password.value = ""; confirm.value = "";
        window.setTimeout(() => {
          window.location.href = "login.html";
        }, 1200);
      } catch (err) { showError(error, err.message || "Tidak dapat menghubungi server."); }
      finally { update(); }
    });
    update();
  }
})();
