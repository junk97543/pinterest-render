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
    likeBtn.addEventListener("click", async () => {
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
    
    div.addEventListener("click", (e) => {
      if (!e.target.closest('.like-btn')) {
        openLightbox(i);
      }
    });
    
    gallery.appendChild(div);
  });
}