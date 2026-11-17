(() => {
  const form = document.getElementById("auth-form");
  if (!form) return;

  const mode = form.dataset.mode; // "login" | "signup"
  const submitBtn = form.querySelector('button[type="submit"]');
  const label = submitBtn.querySelector(".btn-label");
  const idleText = label.textContent;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Aturan validasi: return true kalau valid, atau string pesan error
  const rules = {
    name: (v) => v.trim().length >= 2 || "Please enter your name.",
    email: (v) => emailRe.test(v.trim()) || "Enter a valid email address.",
    password: (v) =>
      mode === "signup"
        ? v.length >= 8 || "Use at least 8 characters."
        : v.length > 0 || "Enter your password.",
  };

  function setError(input, message) {
    const field = input.closest(".field");
    const text = field.querySelector(".error span");
    if (message) {
      text.textContent = message;
      field.classList.add("has-error");
      input.setAttribute("aria-invalid", "true");
    } else {
      // teks sengaja tidak dihapus supaya animasi keluar tetap halus
      field.classList.remove("has-error");
      input.removeAttribute("aria-invalid");
    }
  }

  function validate(input) {
    const result = rules[input.name](input.value);
    setError(input, result === true ? null : result);
    return result === true;
  }

  const inputs = [...form.querySelectorAll("input")];

  inputs.forEach((input) => {
    input.addEventListener("blur", () => {
      if (input.value !== "") validate(input);
    });
    // Kalau sudah error, cek ulang langsung saat mengetik
    input.addEventListener("input", () => {
      if (input.closest(".field").classList.contains("has-error")) validate(input);
    });
  });

  // Show / hide password
  form.querySelectorAll(".toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-on", show);
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  function resetButton() {
    submitBtn.classList.remove("is-success");
    submitBtn.disabled = false;
    label.textContent = idleText;
  }

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const results = inputs.map(validate);
    const firstInvalid = inputs[results.indexOf(false)];
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    if (typeof supabaseClient === "undefined") {
      setError(form.elements.password, "Supabase isn't configured yet. Check supabase-config.js.");
      return;
    }

    submitBtn.disabled = true;
    label.textContent = mode === "login" ? "Logging in…" : "Creating account…";

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    let data, error;
    if (mode === "login") {
      ({ data, error } = await supabaseClient.auth.signInWithPassword({ email, password }));
    } else {
      const fullName = form.elements.name.value.trim();
      ({ data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      }));
    }

    if (error) {
      let target = form.elements.password;
      let message = error.message;

      if (mode === "login" && /invalid login credentials/i.test(error.message)) {
        message = "Incorrect email or password.";
      } else if (/already registered|already exists/i.test(error.message)) {
        target = form.elements.email;
        message = "This email is already registered. Try logging in.";
      } else if (/email not confirmed/i.test(error.message)) {
        target = form.elements.email;
        message = "Please confirm your email first. Check your inbox.";
      }

      setError(target, message);
      target.focus();
      resetButton();
      return;
    }

    // Kalau "Confirm email" aktif di Supabase, signUp belum mengembalikan session
    const needsConfirm = mode === "signup" && !data.session;
    label.textContent = needsConfirm
      ? "Check your email"
      : mode === "login"
        ? "Welcome back"
        : "You're in";
    submitBtn.classList.add("is-success");

    // Pulse untuk konfirmasi sukses
    submitBtn.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }],
      { duration: 400, easing: "ease-in-out" }
    );

    if (needsConfirm) {
      // Belum ada session: user harus konfirmasi email dulu
      setTimeout(resetButton, 2400);
    } else {
      setTimeout(() => navigate("home.html"), 700);
    }
  });
})();
