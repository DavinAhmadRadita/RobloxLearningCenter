(() => {
  const toast = document.getElementById("toast");
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2400);
  }
  function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("visible", Boolean(message));
  }
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

  let accounts = {};
  try {
    accounts = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
  } catch {
    accounts = {};
  }
  if (!Object.keys(accounts).length) {
    accounts.demo = {
      username: "demo",
      email: "demo@example.com",
      password: "demo123",
    };
    localStorage.setItem("rlc_accounts", JSON.stringify(accounts));
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const rememberedUser = localStorage.getItem("rlc_remembered_user");
    // A remembered username represents the active remembered session in this frontend prototype.
    if (rememberedUser) {
      sessionStorage.setItem("rlc_current_user", rememberedUser);
      window.location.replace("dashboard.html");
      return;
    }
    const identity = document.getElementById("login-identity");
    const rememberMe = document.getElementById("remember-me");
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
    const goRegister = document.getElementById("go-register");
    if (goRegister)
      goRegister.addEventListener("click", () => {
        window.location.href = "register.html";
      });
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const key = identity.value.trim().toLowerCase();
      let stored = {};
      try {
        stored = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
      } catch {
        stored = {};
      }
      const account = Object.values(stored).find(
        (item) => item.username.toLowerCase() === key,
      );
      if (!account || account.password !== password.value) {
        showError(error, "Invalid username or password.");
        return;
      }
      sessionStorage.setItem("rlc_current_user", account.username);
      if (rememberMe && rememberMe.checked) {
        localStorage.setItem("rlc_remembered_user", account.username);
      } else {
        localStorage.removeItem("rlc_remembered_user");
      }
      window.location.href = "dashboard.html";
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
    const password = document.getElementById("register-password");
    const confirm = document.getElementById("register-confirm");
    const terms = document.getElementById("terms-check");
    const submit = document.getElementById("register-submit");
    const error = document.getElementById("register-error");
    const usernameStatus = () => {
      const value = username.value.trim();
      if (!value) return { valid: false, message: "Username wajib diisi.", available: false };
      if (!/^[A-Za-z0-9_]+$/.test(value)) return { valid: false, message: "Gunakan huruf, angka, dan underscore (_), tanpa spasi.", available: false };
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem("rlc_accounts") || "{}"); } catch (_) { }
      const duplicate = Object.values(stored).some((item) => item && typeof item.username === "string" && item.username.toLowerCase() === value.toLowerCase());
      if (duplicate) return { valid: false, message: "Username tidak tersedia, sudah digunakan.", available: false };
      return { valid: true, message: "Username tersedia!", available: true };
    };
    const updateUsernameFeedback = () => {
      if (!usernameFeedback) return;
      const status = usernameStatus();
      usernameFeedback.textContent = username.value.trim() ? status.message : "Gunakan huruf, angka, dan underscore (_).";
      usernameFeedback.classList.toggle("is-valid", Boolean(username.value.trim()) && status.valid);
      usernameFeedback.classList.toggle("is-invalid", Boolean(username.value.trim()) && !status.valid);
    };
    const update = () => {
      const usernameStatusResult = usernameStatus();
      updateUsernameFeedback();
      const ready =
        usernameStatusResult.valid &&
        username.value.trim() &&
        email.value.trim() &&
        email.validity.valid &&
        password.value &&
        confirm.value &&
        password.value === confirm.value &&
        terms.checked;
      submit.disabled = !ready;
      if (confirm.value && password.value !== confirm.value)
        showError(error, "Passwords do not match.");
      else if (error.textContent === "Passwords do not match.")
        showError(error, "");
    };
    [username, email, password, confirm, terms].forEach((field) => {
      field.addEventListener("input", update);
      field.addEventListener("change", update);
    });
    const goLogin = document.getElementById("go-login");
    if (goLogin)
      goLogin.addEventListener("click", () => {
        window.location.href = "login.html";
      });
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const name = username.value.trim();
      const usernameCheck = usernameStatus();
      if (!usernameCheck.valid) { showError(error, usernameCheck.message); return; }
      const mail = email.value.trim().toLowerCase();
      if (password.value.length < 4) {
        showError(error, "Password must contain at least 4 characters.");
        return;
      }
      let stored = {};
      try {
        stored = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
      } catch {
        stored = {};
      }
      const exists = Object.values(stored).some(
        (item) =>
          item.username.toLowerCase() === name.toLowerCase() ||
          item.email.toLowerCase() === mail,
      );
      if (exists) {
        showError(error, "Username or email is already registered.");
        return;
      }
      sessionStorage.setItem(
        "rlc_pending_registration",
        JSON.stringify({
          username: name,
          email: mail,
          password: password.value,
        }),
      );
      window.location.href = "verify-email.html";
    });
    update();
    const termsLink = document.getElementById("terms-link");
    if (termsLink)
      termsLink.addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Terms & Privacy can be added here.");
      });
  }
})();
