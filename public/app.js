const fileInput = document.getElementById("file-input");
const gallery = document.getElementById("gallery");
const deleteAllBtn = document.getElementById("delete-all-btn");
const loginBtn = document.getElementById("login-btn");
const themeToggle = document.getElementById("theme-toggle");
const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxVideo = document.getElementById("lightbox-video");

// Chat elements
const chatMessages = document.getElementById("chat-messages");
const chatName = document.getElementById("chat-name");
const chatMessage = document.getElementById("chat-message");
const sendChat = document.getElementById("send-chat");

let items = [];
let zoom = 1, x = 0, y = 0, dragging = false, startX = 0, startY = 0;
let isAdmin = false;

// Check admin status
checkAdmin();

async function checkAdmin() {
  const res = await fetch("/api/admin");
  const data = await res.json();
  isAdmin = data.isAdmin;
  updateAdminUI();
}

function updateAdminUI() {
  deleteAllBtn.style.display = isAdmin ? "inline-block" : "none";
  loginBtn.style.display = isAdmin ? "none" : "inline-block";
  loginBtn.textContent = isAdmin ? "Logged in as Admin" : "Login (Admin)";
}

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

// Admin login
loginBtn.addEventListener("click", async () => {
  if (isAdmin) {
    // Logout
    await fetch("/api/logout", { method: "POST" });
    isAdmin = false;
    updateAdminUI();
    return;
  }
  
  const password = prompt("Enter admin password:");
  if (!password) return;
  
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  
  const data = await res.json();
  if (data.success) {
    isAdmin = true;
    updateAdminUI();
    alert("Logged in as admin!");
  } else {
    alert("Wrong password!");
  }
});

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
    
    if (data.success) {
      await loadMedia();
      isAdmin = data.isAdmin || isAdmin;
      updateAdminUI();
    } else {
      alert(data.error || "Upload failed");
    }
  } catch (err) {
    alert("Upload error");
  } finally {
    btn.textContent = "Upload Photos & Videos";
    btn.disabled = false;
    fileInput.value = "";
  }
});

// Delete all (admin only)
deleteAllBtn.addEventListener("click", async () => {
  if (!isAdmin) {
    alert("Admin only!");
    return;
  }
  if (!confirm("Delete ALL photos and videos from the cloud?")) return;
  try {
    await fetch("/delete-all", { method: "POST" });
    await loadMedia();
    closeLightbox();
  } catch (err) {
    alert("Error deleting all media");
  }
});

// Chat
let chatPollInterval;

async function loadChat() {
  try {
    const res = await fetch("/api/chat");
    const messages = await res.json();
    renderChat(messages);
  } catch (err) {
    console.error("Chat load error:", err);
  }
}

function renderChat(messages) {
  chatMessages.innerHTML = "";
  messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "chat-message";
    const time = new Date(msg.timestamp).toLocaleTimeString();
    div.innerHTML = `<strong>${escapeHtml(msg.name)}</strong> <small>(${time})</small>: ${escapeHtml(msg.message)}`;
    chatMessages.appendChild(div);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendChat.addEventListener("click", async () => {
  const name = chatName.value.trim();
  const message = chatMessage.value.trim();
  if (!name || !message) {
    alert("Please enter your name and a message");
    return;
  }
  
  try {
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message })
    });
    chatMessage.value = "";
    loadChat();
  } catch (err) {
    alert("Error sending message");
  }
});

// Allow Enter key to send
chatMessage.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChat.click();
});

// Poll chat every 3 seconds
loadChat();
chatPollInterval = setInterval(loadChat, 3000);

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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