const form = document.getElementById("signupForm");
const toggle = document.getElementById("toggle-signup-password");
const passwordInput = document.getElementById("password");

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

  const name = document.getElementById("name").value;
  const mobile = document.getElementById("mobile").value;
  const password = document.getElementById("password").value;

  if (mobile.length !== 10) {
    return alert("Mobile number must be 10 digits");
  }

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mobile, password })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.message);

  alert("Signup successful. Please login.");
  window.location.href = "/user-login.html";
});
