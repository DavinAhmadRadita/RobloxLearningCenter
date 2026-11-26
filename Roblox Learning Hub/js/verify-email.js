(() => {
  const digits = Array.from(document.querySelectorAll(".otp-digit"));
  const form = document.getElementById("otp-form");
  const feedback = document.getElementById("otp-feedback");
  const resend = document.getElementById("resend-button");
  const emailLabel = document.getElementById("masked-email");
  let pending = null;
  try {
    pending = JSON.parse(
      sessionStorage.getItem("rlc_pending_registration") || "null",
    );
  } catch {}
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
  emailLabel.textContent = pending?.email
    ? maskEmail(pending.email)
    : "your email address";
  const readCode = () => digits.map((input) => input.value).join("");
  const setFeedback = (message, success = false) => {
    feedback.textContent = message;
    feedback.style.color = success ? "#86efac" : "#fca5a5";
  };
  const post = async (url, data) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
    return result;
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
      if (event.key === "Backspace" && !input.value && index > 0)
        digits[index - 1].focus();
      else if (event.key === "ArrowLeft" && index > 0)
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
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = readCode();
    if (!/^\d{6}$/.test(code)) {
      setFeedback("Please enter all 6 digits.");
      digits.find((input) => !input.value)?.focus();
      return;
    }
    try {
      const result = await post("/api/auth/verify-email", { code });
      sessionStorage.removeItem("rlc_pending_registration");
      setFeedback(
        result.message || "Email verified! Redirecting to login…",
        true,
      );
      setTimeout(() => (window.location.href = "login.html?created=1"), 900);
    } catch (err) {
      setFeedback(err.message);
      if (
        err.message.includes("daftar ulang") ||
        err.message.includes("kedaluwarsa")
      ) {
        sessionStorage.removeItem("rlc_pending_registration");
      }
    }
  });
  resend.addEventListener("click", async () => {
    digits.forEach((input) => (input.value = ""));
    digits[0].focus();
    try {
      const result = await post("/api/auth/resend-otp", {});
      setFeedback(result.message || "Kode OTP baru telah dikirim ke email kamu.", true);
    } catch (err) {
      setFeedback(err.message);
    }
  });
  digits[0]?.focus();
})();
