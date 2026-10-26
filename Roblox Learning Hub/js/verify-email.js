(() => {
  const digits = Array.from(document.querySelectorAll(".otp-digit"));
  const form = document.getElementById("otp-form");
  const feedback = document.getElementById("otp-feedback");
  const resend = document.getElementById("resend-button");
  const emailLabel = document.getElementById("masked-email");
  const DEMO_OTP = "134145";
  let pending = null;
  try {
    pending = JSON.parse(
      sessionStorage.getItem("rlc_pending_registration") || "null",
    );
  } catch { }
  const maskEmail = (email) => {
    if (!email || !email.includes("@")) return "your email address";
    const [name, domain] = email.split("@");
    const visible =
      name.length <= 2
        ? name[0]
        : name.slice(0, 1) +
        "*".repeat(Math.max(3, name.length - 2)) +
        name.slice(-1);
    return visible + "@" + domain;
  };
  if (pending?.email) emailLabel.textContent = maskEmail(pending.email);
  else emailLabel.textContent = "your email address";

  const readCode = () => digits.map((input) => input.value).join("");
  const setFeedback = (message, success = false) => {
    feedback.textContent = message;
    feedback.style.color = success ? "#86efac" : "#fca5a5";
  };
  digits.forEach((input, index) => {
    input.addEventListener("input", () => {
      const clean = input.value.replace(/\D/g, "");
      if (clean.length > 1) {
        const chars = clean.slice(0, 6).split("");
        digits.forEach((box, i) => (box.value = chars[i] || ""));
        digits[Math.min(chars.length, 5)].focus();
      } else {
        input.value = clean;
        if (clean && index < digits.length - 1) digits[index + 1].focus();
      }
      setFeedback("");
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && index > 0) {
        digits[index - 1].focus();
      } else if (event.key === "ArrowLeft" && index > 0)
        digits[index - 1].focus();
      else if (event.key === "ArrowRight" && index < digits.length - 1)
        digits[index + 1].focus();
    });
    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const chars = (event.clipboardData.getData("text") || "")
        .replace(/\D/g, "")
        .slice(0, 6)
        .split("");
      digits.forEach((box, i) => (box.value = chars[i] || ""));
      digits[Math.min(chars.length, 5)].focus();
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = readCode();
    if (!/^\d{6}$/.test(code)) {
      setFeedback("Please enter all 6 digits.");
      digits.find((input) => !input.value)?.focus();
      return;
    }
    if (code !== DEMO_OTP) {
      setFeedback("Incorrect verification code. Please try again.");
      digits.forEach((input) => (input.value = ""));
      digits[0].focus();
      return;
    }
    if (!pending?.username || !pending?.email || !pending?.password) {
      setFeedback("Registration details not found. Please register again.");
      return;
    }
    let accounts = {};
    try {
      accounts = JSON.parse(localStorage.getItem("rlc_accounts") || "{}");
    } catch { }
    const exists = Object.values(accounts).some(
      (account) =>
        account.username.toLowerCase() === pending.username.toLowerCase() ||
        account.email.toLowerCase() === pending.email.toLowerCase(),
    );
    if (exists) {
      setFeedback(
        "Username or email is already registered. Please register again.",
      );
      return;
    }
    accounts[pending.username.toLowerCase()] = {
      username: pending.username,
      email: pending.email,
      password: pending.password,
      emailVerified: true,
    };
    localStorage.setItem("rlc_accounts", JSON.stringify(accounts));
    sessionStorage.removeItem("rlc_pending_registration");
    setFeedback("Email verified! Redirecting to login…", true);
    setTimeout(() => (window.location.href = "login.html?created=1"), 900);
  });
  resend.addEventListener("click", () => {
    digits.forEach((input) => (input.value = ""));
    digits[0].focus();
    setFeedback("Demo mode: use code 134145.", true);
  });
  digits[0].focus();
})();
