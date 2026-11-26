(() => {
  const toast = document.getElementById("toast");
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2400);
  };
  const showError = (element, message) => {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("visible", Boolean(message));
  };
  const api = async (url, data) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.error || "Permintaan gagal. Coba lagi.");
    return result;
  };

  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute(
        "aria-label",
        visible ? "Hide password" : "Show password",
      );
      button.setAttribute("aria-pressed", String(visible));
      const icon = button.querySelector("[data-lucide]");
      if (icon) {
        icon.setAttribute("data-lucide", visible ? "eye-off" : "eye");
        if (window.lucide) window.lucide.createIcons();
      }
    });
  });

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    if (localStorage.getItem("rlc_remembered_user")) {
      fetch("/api/auth/me", { credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) throw new Error("No active session");
          const data = await response.json();
          const user = data.user;
          sessionStorage.setItem("rlc_current_user", user.username);
          sessionStorage.setItem("rlc_user_role", user.role);
          sessionStorage.setItem("rlc_user_email", user.email);
          sessionStorage.setItem(
            "rlc_display_name",
            user.displayName || user.username,
          );
          window.location.replace("dashboard.html");
        })
        .catch(() => {
          localStorage.removeItem("rlc_remembered_user");
        });
    }
    const identity = document.getElementById("login-identity");
    const remember = document.getElementById("remember-me");
    const password = document.getElementById("login-password");
    const submit = document.getElementById("login-submit");
    const error = document.getElementById("login-error");
    const update = () => {
      submit.disabled = !(identity.value.trim() && password.value);
    };
    [identity, password].forEach((field) =>
      field.addEventListener("input", () => {
        update();
        showError(error, "");
      }),
    );
    document.getElementById("go-register")?.addEventListener("click", () => {
      window.location.href = "register.html";
    });
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = "Signing in...";
      try {
        const result = await api("/api/auth/login", {
          identity: identity.value.trim(),
          password: password.value,
          remember: Boolean(remember?.checked),
        });
        const user = result.user;
        sessionStorage.setItem("rlc_current_user", user.username);
        sessionStorage.setItem("rlc_user_role", user.role);
        sessionStorage.setItem("rlc_user_email", user.email);
        sessionStorage.setItem(
          "rlc_display_name",
          user.displayName || user.username,
        );
        localStorage.removeItem("rlc_user_role");
        if (remember?.checked)
          localStorage.setItem("rlc_remembered_user", user.username);
        else localStorage.removeItem("rlc_remembered_user");
        window.location.href = "dashboard.html";
      } catch (err) {
        showError(
          error,
          err.message.includes("Failed to fetch")
            ? "Backend belum berjalan. Jalankan Jalankan_Backend.bat terlebih dahulu."
            : err.message,
        );
      } finally {
        submit.textContent = original;
        update();
      }
    });
    update();
    if (new URLSearchParams(location.search).has("created"))
      showError(error, "Account created. Please sign in.");
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    const username = document.getElementById("register-username");
    const email = document.getElementById("register-email");
    const usernameFeedback = document.getElementById("username-feedback");
    const emailFeedback = document.getElementById("email-feedback");
    const password = document.getElementById("register-password");
    const confirm = document.getElementById("register-confirm");
    const terms = document.getElementById("terms-check");
    const submit = document.getElementById("register-submit");
    const error = document.getElementById("register-error");
    let usernameAvailable = false;
    let emailAvailable = false;
    let usernameCheckTimer;
    let emailCheckTimer;
    const usernameFormat = () =>
      /^[a-z0-9_]{3,50}$/.test(username.value.trim());
    const emailIsLowercase = () =>
      email.value.trim() === email.value.trim().toLowerCase();
    const emailFormat = () =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    const checkUsername = async () => {
      const value = username.value.trim();
      usernameAvailable = false;
      if (!value) {
        usernameFeedback.classList.remove("is-valid", "is-invalid");
        update();
        return;
      }
      if (!usernameFormat()) {
        usernameFeedback.textContent =
          "Gunakan 3–50 karakter: huruf, angka, atau underscore.";
        usernameFeedback.classList.add("is-invalid");
        usernameFeedback.classList.remove("is-valid");
        update();
        return;
      }
      usernameFeedback.textContent = "Memeriksa username...";
      try {
        const result = await api("/api/auth/check-username", {
          username: value,
        });
        if (username.value.trim() !== value) return;
        usernameAvailable = Boolean(result.available);
        usernameFeedback.textContent = result.message;
        usernameFeedback.classList.toggle("is-valid", usernameAvailable);
        usernameFeedback.classList.toggle("is-invalid", !usernameAvailable);
      } catch {
        usernameFeedback.textContent = "Backend belum berjalan.";
        usernameFeedback.classList.add("is-invalid");
      }
      update();
    };
    const checkEmail = async () => {
      const value = email.value.trim();
      emailAvailable = false;
      if (!value) {
        if (emailFeedback) {
          emailFeedback.textContent = "";
          emailFeedback.classList.remove("is-valid", "is-invalid");
        }
        update();
        return;
      }
      if (!emailIsLowercase()) {
        if (emailFeedback) {
          emailFeedback.textContent = "Email harus menggunakan huruf kecil.";
          emailFeedback.classList.add("is-invalid");
          emailFeedback.classList.remove("is-valid");
        }
        update();
        return;
      }
      if (!emailFormat()) {
        if (emailFeedback) {
          emailFeedback.textContent = "Format email tidak valid.";
          emailFeedback.classList.add("is-invalid");
          emailFeedback.classList.remove("is-valid");
        }
        update();
        return;
      }
      if (emailFeedback) {
        emailFeedback.textContent = "Memeriksa email...";
        emailFeedback.classList.remove("is-valid", "is-invalid");
      }
      try {
        const result = await api("/api/auth/check-email", { email: value });
        if (email.value.trim() !== value) return;
        emailAvailable = Boolean(result.available);
        if (emailFeedback) {
          emailFeedback.textContent =
            result.message ||
            (emailAvailable ? "Email tersedia!" : "Email sudah digunakan.");
          emailFeedback.classList.toggle("is-valid", emailAvailable);
          emailFeedback.classList.toggle("is-invalid", !emailAvailable);
        }
      } catch {
        emailAvailable = false;
        if (emailFeedback) {
          emailFeedback.textContent = "Tidak dapat memeriksa email. Coba lagi.";
          emailFeedback.classList.add("is-invalid");
          emailFeedback.classList.remove("is-valid");
        }
      }
      update();
    };
    const update = () => {
      submit.disabled = !(
        usernameAvailable &&
        emailAvailable &&
        emailIsLowercase() &&
        emailFormat() &&
        password.value.length >= 8 &&
        password.value === confirm.value &&
        terms.checked
      );
      if (confirm.value && password.value !== confirm.value)
        showError(error, "Passwords do not match.");
      else if (password.value && password.value.length < 8)
        showError(error, "Password must contain at least 8 characters.");
      else if (
        error.textContent === "Passwords do not match." ||
        error.textContent.startsWith("Password must")
      )
        showError(error, "");
    };
    username.addEventListener("input", () => {
      clearTimeout(usernameCheckTimer);
      usernameCheckTimer = setTimeout(checkUsername, 250);
      update();
    });
    email.addEventListener("input", () => {
      emailAvailable = false;
      clearTimeout(emailCheckTimer);
      if (email.value.trim() && !emailIsLowercase()) {
        emailFeedback.textContent = "Email harus menggunakan huruf kecil.";
        emailFeedback.classList.add("is-invalid");
        emailFeedback.classList.remove("is-valid");
      } else {
        emailFeedback.textContent = "";
        emailFeedback.classList.remove("is-valid", "is-invalid");
        emailCheckTimer = setTimeout(checkEmail, 300);
      }
      update();
    });
    email.addEventListener("blur", checkEmail);
    [password, confirm, terms].forEach((field) => {
      field.addEventListener("input", update);
      field.addEventListener("change", update);
    });
    document.getElementById("go-login")?.addEventListener("click", () => {
      window.location.href = "login.html";
    });
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = "Registering...";
      try {
        const result = await api("/api/auth/register", {
          username: username.value.trim(),
          email: email.value.trim(),
          password: password.value,
        });
        sessionStorage.setItem(
          "rlc_pending_registration",
          JSON.stringify({
            username: username.value.trim(),
            email: email.value.trim(),
          }),
        );
        showToast(result.message || "Registrasi berhasil disiapkan.");
        window.location.href = "verify-email.html";
      } catch (err) {
        showError(
          error,
          err.message.includes("Failed to fetch")
            ? "Backend belum berjalan. Jalankan Jalankan_Backend.bat terlebih dahulu."
            : err.message,
        );
      } finally {
        submit.textContent = original;
        update();
      }
    });
    document
      .getElementById("terms-link")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Terms & Privacy can be added here.");
      });
    update();
    checkUsername();
    if (email.value.trim()) checkEmail();
  }
})();
