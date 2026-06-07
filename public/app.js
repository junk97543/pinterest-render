// ======================== SELECTORS ========================
const gateScreen = document.getElementById("gate-screen");
const familyCodeInput = document.getElementById("family-code-input");
const familyCodeBtn = document.getElementById("family-code-btn");
const gateMessage = document.getElementById("gate-message");

const mainHeader = document.getElementById("main-header");
const adminBar = document.getElementById("admin-bar");
const sortButtons = document.getElementById("sort-buttons");

const fileInput = document.getElementById("file-input");
const gallery = document.getElementById("gallery");
const deleteAllBtn = document.getElementById("delete-all-btn");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const familyGalleryBtn = document.getElementById("family-gallery-btn");
const privateGalleryBtn = document.getElementById("private-gallery-btn");
const logoutFamilyBtn = document.getElementById("logout-family-btn");
const themeToggle = document.getElementById("theme-toggle");
const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxVideo = document.getElementById("lightbox-video");
const lightboxCaption = document.getElementById("lightbox-caption");

const sortNewestBtn = document.getElementById("sort-newest");
const sortRandomBtn = document.getElementById("sort-random");
const sortPopularBtn = document.getElementById("sort-popular");

const chatToggleBtn = document.getElementById("chat-toggle-btn");
const chatCloseBtn = document.getElementById("chat-close-btn");
const chatSection = document.getElementById("chat-section");

const backToTopBtn = document.getElementById("back-to-top");
const videoFeedBtn = document.getElementById("video-feed-btn");
const tagPanel = document.getElementById("tag-panel");
const tagList = document.getElementById("tag-list");
const closeTagPanel = document.getElementById("close-tag-panel");
const clearTagFilter = document.getElementById("clear-tag-filter");

const galleryTitle = document.getElementById("gallery-title");
const galleryBadge = document.getElementById("gallery-badge");
const mainRotatingLogo = document.getElementById("main-rotating-logo");
const siteFavicon = document.getElementById("site-favicon");

const phoneOverlay = document.getElementById("phone-overlay");
const phoneFeed = document.getElementById("phone-feed");
const phoneCloseBtn = document.getElementById("phone-close-btn");
const phoneBackBtn = document.getElementById("phone-back-btn");

let items = [];
let isAdmin = false;
let familyAccess = false;
let currentSort = "random";
let currentLayout = "masonry";
let currentGallery = "family";
let activeTagFilter = "";
let lightboxIndex = -1;
let phoneIndex = 0;
let phoneVideos = [];
let wheelLock = false;
let familyLogoTimer = null;

// ======================== INIT ========================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initHandlers();
  refreshStatus();
});

function initTheme() {
  const theme = localStorage.getItem("theme") || "light";
  document.body.className = theme;
  themeToggle.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  themeToggle.addEventListener("click", () => {
    const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
    document.body.className = newTheme;
    localStorage.setItem("theme", newTheme);
    themeToggle.textContent = newTheme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  });
}

function initHandlers() {
  // Family Code - FIXED
  if (familyCodeBtn) familyCodeBtn.addEventListener("click", unlockFamily);
  if (familyCodeInput) {
    familyCodeInput.addEventListener("keydown", e => {
      if (e.key === "Enter") unlockFamily();
    });
  }

  // Sort Buttons
  if (sortNewestBtn) sortNewestBtn.addEventListener("click", async () => {
    currentSort = "newest"; currentLayout = "grid"; setSortActive(sortNewestBtn); await loadMedia();
  });
  if (sortRandomBtn) sortRandomBtn.addEventListener("click", async () => {
    currentSort = "random"; currentLayout = "masonry"; setSortActive(sortRandomBtn); await loadMedia();
  });
  if (sortPopularBtn) sortPopularBtn.addEventListener("click", async () => {
    currentSort = "popular"; currentLayout = "grid"; setSortActive(sortPopularBtn); await loadMedia();
  });

  // Admin & Gallery
  if (adminLoginBtn) adminLoginBtn.addEventListener("click", adminLogin);
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", adminLogout);
  if (familyGalleryBtn) familyGalleryBtn.addEventListener("click", switchToFamily);
  if (privateGalleryBtn) privateGalleryBtn.addEventListener("click", switchToPrivate);
  if (logoutFamilyBtn) logoutFamilyBtn.addEventListener("click", familyLogout);

  // Tags
  const tagsTab = document.getElementById("tags-tab-btn");
  if (tagsTab) tagsTab.addEventListener("click", () => {
    tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
  });
  if (closeTagPanel) closeTagPanel.addEventListener("click", () => tagPanel.style.display = "none");
  if (clearTagFilter) clearTagFilter.addEventListener("click", () => {
    activeTagFilter = ""; render(); renderTags();
  });

  // Chat
  if (chatToggleBtn) chatToggleBtn.addEventListener("click", toggleChat);
  if (chatCloseBtn) chatCloseBtn.addEventListener("click", toggleChat);

  if (backToTopBtn) backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  if (deleteAllBtn) deleteAllBtn.addEventListener("click", deleteAll);
  if (fileInput) fileInput.addEventListener("change", uploadFiles);
  if (videoFeedBtn) videoFeedBtn.addEventListener("click", openPhoneOverlay);
  if (phoneCloseBtn) phoneCloseBtn.addEventListener("click", closePhoneOverlay);
  if (phoneBackBtn) phoneBackBtn.addEventListener("click", closePhoneOverlay);

  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (lightbox) lightbox.addEventListener("click", e => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-content")) closeLightbox();
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeLightbox();
      closePhoneOverlay();
    }
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });
  window.addEventListener("wheel", handleLightboxWheel, { passive: false });
}

// ======================== AUTH FUNCTIONS ========================
async function unlockFamily() {
  const code = familyCodeInput.value.trim();
  if (!code) return;

  try {
    const res = await fetch("/api/family-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const data = await res.json();

    if (data.success) {
      familyAccess = true;
      currentGallery = "family";
      gateScreen.style.display = "none";
      mainHeader.style.display = "flex";
      sortButtons.style.display = "flex";
      await refreshStatus();
      await loadMedia();
    } else {
      gateMessage.textContent = "Wrong code. Try again.";
      familyCodeInput.value = "";
      familyCodeInput.focus();
    }
  } catch (err) {
    console.error(err);
    gateMessage.textContent = "Connection error. Try again.";
  }
}

async function adminLogin() { /* your original code */ }
async function adminLogout() { /* your original code */ }
async function switchToFamily() { /* your original code */ }
async function switchToPrivate() { /* your original code */ }
async function familyLogout() { /* your original code */ }
function toggleChat() { /* your original code */ }
async function deleteAll() { /* your original code */ }

// ======================== CORE GALLERY ========================
async function refreshStatus() { /* your original code */ }

async function loadMedia() { /* your original code */ }

function setSortActive(btn) { /* your original code */ }

function shuffleArray(arr) { /* your original code */ }
function getFilteredItems() { /* your original code */ }

function render() {
  gallery.innerHTML = "";
  const displayItems = getFilteredItems();

  if (!displayItems.length) {
    gallery.innerHTML = "<p style='padding:20px;'>No matching images or videos.</p>";
    return;
  }

  displayItems.forEach((item) => {
    const originalIndex = items.findIndex(i => i.public_id === item.public_id);
    const div = document.createElement("div");
    div.className = "masonry-item";

    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      div.appendChild(img);
    } else {
      const vid = document.createElement("video");
      vid.src = item.url;
      vid.controls = true;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.autoplay = true;
      div.appendChild(vid);
    }

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "media-tags";
    (item.tags || []).forEach(tag => {
      const chip = document.createElement("button");
      chip.className = "media-tag";
      chip.textContent = `#${tag}`;
      chip.addEventListener("click", e => {
        e.stopPropagation();
        activeTagFilter = tag;
        render();
        renderTags();
      });
      tagsWrap.appendChild(chip);
    });
    div.appendChild(tagsWrap);

    if (item.caption) {
      const captionLine = document.createElement("div");
      captionLine.className = "caption-inline";
      captionLine.textContent = item.caption;
      div.appendChild(captionLine);
    }

    const actions = document.createElement("div");
    actions.className = "media-actions";

    const tagBtn = document.createElement("button");
    tagBtn.className = "add-tag-btn";
    tagBtn.textContent = "Add Tag";
    tagBtn.addEventListener("click", e => { e.stopPropagation(); addTagToItem(item.public_id); });
    actions.appendChild(tagBtn);

    if (isAdmin) {
      const capBtn = document.createElement("button");
      capBtn.className = "add-tag-btn";
      capBtn.textContent = "Edit Caption";
      capBtn.addEventListener("click", e => { e.stopPropagation(); editCaption(item.public_id); });
      actions.appendChild(capBtn);
    }
    div.appendChild(actions);

    const likeDiv = document.createElement("div");
    likeDiv.className = "like-container";
    likeDiv.innerHTML = `<button class="like-btn">❤️ <span class="like-count">${item.likes || 0}</span></button>`;
    div.appendChild(likeDiv);

    likeDiv.querySelector(".like-btn").addEventListener("click", e => {
      e.stopPropagation();
      likeItem(item.public_id);
    });

    // Click to open lightbox (fixed)
    div.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      openLightbox(originalIndex);
    });

    gallery.appendChild(div);
  });
}

async function likeItem(public_id) { /* your original like code */ }
async function addTagToItem(publicId) { /* your original */ }
async function editCaption(publicId) { /* your original */ }
function renderTags() { /* your original */ }
async function uploadFiles() { /* your original */ }

// ======================== LIGHTBOX & DEPRIVITY ========================
function openLightbox(index) {
  lightboxIndex = index;
  showLightboxItem(index);
  lightbox.classList.add("active");
}

function showLightboxItem(index) {
  const item = items[index];
  if (!item) return;

  lightboxImg.style.display = "none";
  lightboxVideo.style.display = "none";
  lightboxCaption.classList.remove("show");
  lightboxCaption.textContent = item.caption || "";
  if (item.caption) lightboxCaption.classList.add("show");

  if (item.type === "image") {
    lightboxImg.src = item.url;
    lightboxImg.style.display = "block";
  } else {
    lightboxVideo.src = item.url;
    lightboxVideo.style.display = "block";
    lightboxVideo.muted = false;
    lightboxVideo.controls = true;
    lightboxVideo.play().catch(() => {});
  }

  document.querySelectorAll(".overlay-element").forEach(el => el.remove());

  if (isAdmin && currentGallery === "private") {
    createDepravityPanel(item);
  }
}

function closeLightbox() {
  lightbox.classList.remove("active");
  lightboxImg.src = "";
  lightboxVideo.pause();
  lightboxVideo.src = "";
  lightboxCaption.classList.remove("show");
  document.querySelectorAll(".overlay-element").forEach(el => el.remove());
}

// ======================== DEPRIVITY PANEL ========================
function createDepravityPanel(item) {
  const panel = document.createElement("div");
  panel.id = "depravity-panel";
  panel.style = `position:absolute; top:20px; left:20px; width:400px; background:rgba(0,0,0,0.95); padding:20px; border-radius:14px; color:#fff; z-index:1002; max-height:80vh; overflow-y:auto;`;

  panel.innerHTML = `
    <h3 style="text-align:center;color:#ff5a5f">🔥 Depravity Tools</h3>
    <button id="emoji-btn" style="width:100%;padding:12px;margin:6px 0;background:#ff1493;border:none;color:white;border-radius:8px;">😈 Draggable Emoji</button>
    <button id="text-btn" style="width:100%;padding:12px;margin:6px 0;background:#ff4500;border:none;color:white;border-radius:8px;">✍️ Tattoo Text</button>
    <button id="bubble-btn" style="width:100%;padding:12px;margin:6px 0;background:#8a2be2;border:none;color:white;border-radius:8px;">💬 Speech Bubble</button>
    <button id="auto-caption-btn" style="width:100%;padding:12px;margin:6px 0;background:#e60023;border:none;color:white;border-radius:8px;">🤖 Auto Filthy Caption</button>
    <button id="delete-btn" style="width:100%;padding:12px;margin:12px 0 0 0;background:#333;border:none;color:white;border-radius:8px;">🗑️ Delete Image</button>
  `;

  document.querySelector(".lightbox-content").appendChild(panel);

  panel.querySelector("#emoji-btn").onclick = () => addDraggableEmoji(item);
  panel.querySelector("#text-btn").onclick = () => addDraggableText(item);
  panel.querySelector("#bubble-btn").onclick = () => addSpeechBubble(item);
  panel.querySelector("#auto-caption-btn").onclick = () => autoDepravedCaption(item.public_id);
  panel.querySelector("#delete-btn").onclick = () => deleteSingleItem(item.public_id);
}

// Add the draggable functions (emoji, text, bubble) and other helpers from previous messages here.
// For brevity, I recommend you paste the draggable functions I gave you earlier.

async function autoDepravedCaption(public_id) { /* your auto caption function */ }
async function deleteSingleItem(public_id) { /* your delete function */ }

// Keep all your phone overlay functions at the bottom
async function openPhoneOverlay() { /* ... */ }
function closePhoneOverlay() { /* ... */ }
async function buildPhoneFeed() { /* ... */ }
function escapeHtml(text) { /* ... */ }