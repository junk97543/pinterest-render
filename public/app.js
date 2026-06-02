const fileInput = document.getElementById("file-input");
const gallery = document.getElementById("gallery");
const deleteAllBtn = document.getElementById("delete-all-btn");
const loginBtn = document.getElementById("login-btn");
const themeToggle = document.getElementById("theme-toggle");
const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxVideo = document.getElementById("lightbox-video");
const sortNewestBtn = document.getElementById("sort-newest");
const sortPopularBtn = document.getElementById("sort-popular");

// Chat elements
const chatMessages = document.getElementById("chat-messages");
const chatName = document.getElementById("chat-name");
const chatMessage = document.getElementById("chat-message");
const sendChat = document.getElementById("send-chat");
const chatToggleBtn = document.getElementById("chat-toggle-btn");
const chatCloseBtn = document.getElementById("chat-close-btn");
const chatSection = document.getElementById("chat-section");
const backToTopBtn = document.getElementById("back-to-top");

let items = [];
let zoom = 1, x = 0, y = 0, dragging = false, startX = 0, startY = 0;
let isAdmin = false;
let currentSort = 'newest';

// Check admin status
checkAdmin();

// Initialize
(async () => {
  await loadMedia();
  loadChat();
  setInterval(loadChat, 3000);
})();

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

// Sort buttons
sortNewestBtn.addEventListener("click", async () => {
  currentSort = 'newest';
  sortNewestBtn.classList.add('active');
  sortPopularBtn.classList.remove('active');
  await loadMedia();
});

sortPopularBtn.addEventListener("click", async () => {
  currentSort = 'popular';
  sortPopularBtn.classList.add('active');
  sortNewestBtn.classList.remove('active');
  await loadMedia();
});

// Load media
async function loadMedia() {
  const res = await fetch(`/media?sort=${currentSort}`);
  items = await res.json();
  render();
}

function render() {
  gallery.innerHTML = "";
  if (!items.length) {
    gallery.innerHTML = "<p>No images yet. Upload some photos or videos.</p>";
    return;
  }
  
  // Sort items left-to-right, row by row (for masonry)
  const sortedItems = rankByMasonryOrder(items);
  
  sortedItems.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "masonry-item";
    const url = item.url;
    
    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Uploaded image";
      div.appendChild(img);
    } else {
      const vid = document.createElement("video");
      vid.src = url;
      vid.controls = true;
      vid.loop = true;
      vid.muted = true;
      div.appendChild(vid);
    }
    
    // Like button
    const likeDiv = document.createElement("div");
    likeDiv.className = "like-container";
    likeDiv.innerHTML = `
      <button class="like-btn" data-public-id="${item.public_id}">
        ❤️ <span class="like-count">${item.likes || 0}</span>
      </button>
    `;
    div.appendChild(likeDiv);
    
    // Like button click
    const likeBtn = likeDiv.querySelector('.like-btn');
    likeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const countSpan = likeBtn.querySelector('.like-count');
      try {
        const res = await fetch("/api/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_id: item.public_id })
        });
        const data = await res.json();
        if (data.success) {
          countSpan.textContent = data.likes;
        }
      } catch (err) {
        console.error("Like error:", err);
      }
    });
    
    div.addEventListener("click", () => openLightbox(idx));
    gallery.appendChild(div);
  });
}

// Sort items to appear left-to-right, row by row
function rankByMasonryOrder(items) {
  const columns = 5;
  const indexed = items.map((item, i) => ({ item, index: i }));
  indexed.sort((a, b) => {
    const colA = a.index % columns;
    const colB = b.index % columns;
    if (colA !== colB) return colA - colB;
    return a.index - b.index;
  });
  return indexed.map(x => x.item);
}

// Chat toggle button
chatToggleBtn.addEventListener("click", () => {
  chatSection.style.display = "block";
  chatToggleBtn.style.display = "none";
  chatCloseBtn.style.display = "inline-block";
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
});

chatCloseBtn.addEventListener("click", () => {
  chatSection.style.display = "none";
  chatToggleBtn.style.display = "inline-block";
  chatCloseBtn.style.display = "none";
});

// Back to top button
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    backToTopBtn.style.display = "inline-block";
  } else {
    backToTopBtn.style.display = "none";
  }
});

// Chat
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

chatMessage.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChat.click();
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
  if (!confirm("Delete ALL photos and videos from Cloudinary (cloud)? This CANNOT be undone!")) return;
  
  try {
    const res = await fetch("/delete-all", { method: "POST" });
    const data = await res.json();
    
    if (data.success) {
      alert("All images deleted from Cloudinary!");
      await loadMedia();
      closeLightbox();
    } else {
      alert("Delete failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Error deleting all media: " + err.message);
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