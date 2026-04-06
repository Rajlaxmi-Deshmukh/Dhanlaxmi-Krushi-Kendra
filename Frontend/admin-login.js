document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;
  const toggle = document.getElementById("toggle-admin-password");
  const passwordInput = document.getElementById("adminPass");
  const remember = document.getElementById("remember-admin");

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

    const username = document.getElementById("adminUser").value.trim();
    const password = document.getElementById("adminPass").value.trim();

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", "admin");
      if (remember && !remember.checked) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("role", "admin");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
      }

      window.location.href = "admin.html";
    } catch (err) {
      alert("Network error. Please try again.");
      console.error("Admin login failed:", err);
    }
  });
});
