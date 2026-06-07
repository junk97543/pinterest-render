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
  // Family Gate
  familyCodeBtn.addEventListener("click", unlockFamily);
  familyCodeInput.addEventListener("keydown", e => { if (e.key === "Enter") unlockFamily(); });

  // Sort
  sortNewestBtn.addEventListener("click", async () => { currentSort = "newest"; currentLayout = "grid"; setSortActive(sortNewestBtn); await loadMedia(); });
  sortRandomBtn.addEventListener("click", async () => { currentSort = "random"; currentLayout = "masonry"; setSortActive(sortRandomBtn); await loadMedia(); });
  sortPopularBtn.addEventListener("click", async () => { currentSort = "popular"; currentLayout = "grid"; setSortActive(sortPopularBtn); await loadMedia(); });

  // Admin
  adminLoginBtn.addEventListener("click", adminLogin);
  adminLogoutBtn.addEventListener("click", adminLogout);

  familyGalleryBtn.addEventListener("click", switchToFamily);
  privateGalleryBtn.addEventListener("click", switchToPrivate);
  logoutFamilyBtn.addEventListener("click", familyLogout);

  // Tags
  document.getElementById("tags-tab-btn")?.addEventListener("click", () => {
    tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
  });
  closeTagPanel.addEventListener("click", () => tagPanel.style.display = "none");
  clearTagFilter.addEventListener("click", () => { activeTagFilter = ""; render(); renderTags(); });

  // Chat
  chatToggleBtn.addEventListener("click", toggleChat);
  chatCloseBtn.addEventListener("click", toggleChat);

  backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  deleteAllBtn.addEventListener("click", deleteAll);
  fileInput.addEventListener("change", uploadFiles);
  videoFeedBtn.addEventListener("click", openPhoneOverlay);
  phoneCloseBtn.addEventListener("click", closePhoneOverlay);
  phoneBackBtn.addEventListener("click", closePhoneOverlay);

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-content")) closeLightbox();
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeLightbox(); closePhoneOverlay(); }
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });
  window.addEventListener("wheel", handleLightboxWheel, { passive: false });
}

// ======================== AUTH ========================
async function unlockFamily() { /* keep your working version */ }
async function adminLogin() { /* keep your working version */ }
async function adminLogout() { /* keep your working version */ }
async function switchToFamily() { /* keep */ }
async function switchToPrivate() { /* keep */ }
async function familyLogout() { /* keep */ }
function toggleChat() { /* keep */ }
async function deleteAll() { /* keep */ }

// ======================== CORE ========================
async function refreshStatus() { /* keep your version */ }
async function loadMedia() { /* keep your version */ }
function setSortActive(btn) { /* keep */ }
function shuffleArray(arr) { /* keep */ }
function getFilteredItems() { /* keep */ }

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

    // Click handler - FIXED
    div.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      openLightbox(originalIndex);
    });

    gallery.appendChild(div);
  });
}

async function likeItem(public_id) {
  const res = await fetch("/api/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id, gallery: currentGallery })
  });
  const data = await res.json();
  if (data.success) await loadMedia();
}

async function addTagToItem(publicId) { /* your code */ }
async function editCaption(publicId) { /* your code */ }
function renderTags() { /* your code */ }
async function uploadFiles() { /* your code */ }

// ======================== LIGHTBOX ========================
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

function handleLightboxWheel(e) {
  if (!lightbox.classList.contains("active")) return;
  e.preventDefault();
  if (wheelLock) return;
  wheelLock = true;
  stepLightbox(e.deltaY > 0 ? 1 : -1);
  setTimeout(() => wheelLock = false, 550);
}

function stepLightbox(direction) {
  if (!items.length) return;
  lightboxIndex = (lightboxIndex + direction + items.length) % items.length;
  showLightboxItem(lightboxIndex);
}

// ======================== DEPRIVITY PANEL ========================
function createDepravityPanel(item) {
  // Paste the full createDepravityPanel + draggable functions from my previous message here
  // (I can give you the complete version if needed)
  console.log("Depravity panel for item:", item.public_id);
}

// Keep your phone functions at the bottom
async function openPhoneOverlay() { /* your code */ }
function closePhoneOverlay() { /* your code */ }
async function buildPhoneFeed() { /* your code */ }
function escapeHtml(text) { /* your code */ }