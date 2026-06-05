const fileInput = document.getElementById("file-input");
const gallery = document.getElementById("gallery");
const deleteAllBtn = document.getElementById("delete-all-btn");
const themeToggle = document.getElementById("theme-toggle");
const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxVideo = document.getElementById("lightbox-video");

let items = [];
let zoom = 1, x = 0, y = 0, dragging = false, startX = 0, startY = 0;

// Theme
const theme = localStorage.getItem("theme") || "light";
document.body.className = theme;
updateThemeBtn(theme);
themeToggle.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
  document.body.className = newTheme;
  localStorage.setItem("theme", newTheme);
  updateThemeBtn(newTheme);
});
function updateThemeBtn(t) {
  themeToggle.textContent = t === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
}

// Load media on start
(async () => {
  await loadMedia();
})();

async function loadMedia() {
  const res = await fetch("/media");
  items = await res.json();
  render();
}

function render() {
  gallery.innerHTML = "";
  if (!items.length) {
    gallery.innerHTML = "<p>No images yet. Upload some photos or videos.</p>";
    return;
  }
  items.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "masonry-item";
    const url = item.url;
    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = url;
      div.appendChild(img);
    } else {
      const vid = document.createElement("video");
      vid.src = url;
      vid.controls = true;
      vid.loop = true;
      vid.muted = true;
      div.appendChild(vid);
    }
    div.addEventListener("click", () => openLightbox(i));
    gallery.appendChild(div);
  });
}

// Upload
fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));

  const btn = document.querySelector(".upload-btn");
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    const res = await fetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) await loadMedia();
    else alert("Upload failed");
  } catch (err) {
    alert("Upload error");
  } finally {
    btn.textContent = "Upload Photos & Videos";
    btn.disabled = false;
    fileInput.value = "";
  }
});

// Delete all
deleteAllBtn.addEventListener("click", async () => {
  if (!confirm("Delete ALL photos and videos from the cloud?")) return;
  try {
    await fetch("/delete-all", { method: "POST" });
    await loadMedia();
    closeLightbox();
  } catch (err) {
    alert("Error deleting all media");
  }
});

// Lightbox
function openLightbox(index) {
  const item = items[index];
  if (!item) return;
  const url = item.url;
  lightbox.classList.add("active");
  zoom = 1; x = 0; y = 0;
  updateTransform();

  if (item.type === "image") {
    lightboxImg.src = url;
    lightboxImg.style.display = "block";
    lightboxVideo.style.display = "none";
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
  } else {
    lightboxVideo.src = url;
    lightboxVideo.style.display = "block";
    lightboxImg.style.display = "none";
    lightboxImg.src = "";
    lightboxVideo.play();
  }
}

function closeLightbox() {
  lightbox.classList.remove("active");
  lightboxImg.src = "";
  lightboxVideo.src = "";
  lightboxVideo.pause();
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", e => {
  if (e.target === lightbox || e.target.classList.contains("lightbox-content")) {
    closeLightbox();
  }
});
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && lightbox.classList.contains("active")) {
    closeLightbox();
  }
});

// Zoom & drag for image
lightboxImg.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  dragging = true;
  startX = e.clientX - x;
  startY = e.clientY - y;
  lightboxImg.style.cursor = "grabbing";
});
window.addEventListener("mousemove", e => {
  if (!dragging) return;
  e.preventDefault();
  x = e.clientX - startX;
  y = e.clientY - startY;
  updateTransform();
});
window.addEventListener("mouseup", () => {
  dragging = false;
  lightboxImg.style.cursor = "zoom-in";
});

lightboxImg.addEventListener("wheel", e => {
  e.preventDefault();
  const delta = -e.deltaY;
  const oldZoom = zoom;
  if (delta > 0) zoom *= 1.1;
  else zoom /= 1.1;
  zoom = Math.max(1, Math.min(zoom, 5));
  const rect = lightboxImg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const ratio = zoom / oldZoom;
  x -= (mx - rect.width / 2) * (ratio - 1);
  y -= (my - rect.height / 2) * (ratio - 1);
  updateTransform();
});

function updateTransform() {
  lightboxImg.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
}