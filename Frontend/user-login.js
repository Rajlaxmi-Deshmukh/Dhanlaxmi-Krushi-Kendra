
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("userLoginForm");
  if (!form) return;
  const toggle = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");
  const remember = document.getElementById("remember-user");

  if (toggle && passwordInput) {
    toggle.addEventListener("click", () => {
      const isText = passwordInput.type === "text";
      passwordInput.type = isText ? "password" : "text";
      const text = toggle.querySelector(".toggle-text");
      if (text) text.innerText = isText ? "Show" : "Hide";
      toggle.setAttribute("aria-label", isText ? "Show password" : "Hide password");
    });
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    console.log("login submit fired");

    const mobile = document.getElementById("mobile").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password })
      });

      const data = await res.json();

      if (data.newUser) {
        alert(data.message);
        window.location.href = "signup.html";
        return;
      }

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role || "user");
      localStorage.setItem("username", data.name);
      localStorage.setItem("mobile", mobile);
      if (remember && !remember.checked) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("role", data.role || "user");
        sessionStorage.setItem("username", data.name);
        sessionStorage.setItem("mobile", mobile);
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("username");
        localStorage.removeItem("mobile");
      }

      window.location.href = "home.html";
    } catch (err) {
      alert("Network error. Please try again.");
      console.error("Login request failed:", err);
    }
  });
});

