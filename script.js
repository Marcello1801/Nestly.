// Transisi antar halaman: exit 400ms (20% lebih singkat dari entrance 500ms)
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function navigate(url) {
  if (document.body.classList.contains("is-leaving")) return;
  document.body.classList.add("is-leaving");
  setTimeout(() => {
    window.location.href = url;
  }, reduceMotion ? 0 : 400);
}

// Semua link dengan atribut data-transition
document.querySelectorAll("a[data-transition]").forEach((link) => {
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(link.getAttribute("href"));
  });
});

// Tombol Get Started di hero
const getStarted = document.getElementById("get-started");
if (getStarted) {
  getStarted.addEventListener("click", () => navigate("signup.html"));
}

// Reset state saat user menekan tombol Back (bfcache)
window.addEventListener("pageshow", () => {
  document.body.classList.remove("is-leaving");
});
