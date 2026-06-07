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
let excludedTags = [];

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
  familyCodeBtn.addEventListener("click", unlockFamily);
  familyCodeInput.addEventListener("keydown", e => { if (e.key === "Enter") unlockFamily(); });

  sortNewestBtn.addEventListener("click", async () => { currentSort = "newest"; currentLayout = "grid"; setSortActive(sortNewestBtn); await loadMedia(); });
  sortRandomBtn.addEventListener("click", async () => { currentSort = "random"; currentLayout = "masonry"; setSortActive(sortRandomBtn); await loadMedia(); });
  sortPopularBtn.addEventListener("click", async () => { currentSort = "popular"; currentLayout = "grid"; setSortActive(sortPopularBtn); await loadMedia(); });

  adminLoginBtn.addEventListener("click", adminLogin);
  adminLogoutBtn.addEventListener("click", adminLogout);
  familyGalleryBtn.addEventListener("click", switchToFamily);
  privateGalleryBtn.addEventListener("click", switchToPrivate);
  logoutFamilyBtn.addEventListener("click", familyLogout);

  document.getElementById("tags-tab-btn")?.addEventListener("click", () => {
    tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
  });

  closeTagPanel.addEventListener("click", () => { tagPanel.style.display = "none"; });
  clearTagFilter.addEventListener("click", () => { activeTagFilter = ""; render(); renderTags(); });

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

function setSortActive(btn) {
  [sortNewestBtn, sortRandomBtn, sortPopularBtn].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ======================== AUTH & CORE FUNCTIONS ========================
async function unlockFamily() { /* your code */ }
async function adminLogin() { /* your code */ }
async function adminLogout() { /* your code */ }
async function switchToFamily() { /* your code */ }
async function switchToPrivate() { /* your code */ }
async function familyLogout() { /* your code */ }
function toggleChat() { /* your code */ }
async function deleteAll() { /* your code */ }
async function refreshStatus() { /* your code */ }
async function loadMedia() { /* your code */ }
function familyImages() { /* your code */ }
function startFamilyLogoRotation() { /* your code */ }
function setFavicon(url) { /* your code */ }
function updateBrandLogo() { /* your code */ }
function updateFaviconFromFamily() { /* your code */ }
function shuffleArray(arr) { /* your code */ }
function getFilteredItems() { /* your code */ }
function render() { /* your current render function */ }
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
  setTimeout(() => { wheelLock = false; }, 550);
}

function stepLightbox(direction) {
  if (!items.length) return;
  lightboxIndex = (lightboxIndex + direction + items.length) % items.length;
  showLightboxItem(lightboxIndex);
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
    <button id="album-btn" style="width:100%;padding:12px;margin:6px 0;background:#32cd32;border:none;color:white;border-radius:8px;">📁 Add to Album</button>
    <button id="delete-btn" style="width:100%;padding:12px;margin:12px 0 0 0;background:#333;border:none;color:white;border-radius:8px;">🗑️ Delete Image</button>
  `;

  document.querySelector(".lightbox-content").appendChild(panel);

  panel.querySelector("#emoji-btn").onclick = () => addDraggableEmoji(item);
  panel.querySelector("#text-btn").onclick = () => addDraggableText(item);
  panel.querySelector("#bubble-btn").onclick = () => addSpeechBubble(item);
  panel.querySelector("#auto-caption-btn").onclick = () => autoDepravedCaption(item.public_id);
  panel.querySelector("#album-btn").onclick = () => addToAlbum(item.public_id);
  panel.querySelector("#delete-btn").onclick = () => deleteSingleItem(item.public_id);
}

// Draggable Functions
function addDraggableEmoji(item) {
  const emojis = ["🍆","💦","🍑","🥵","😈","🤤","👅","🍼","🔥","😩","🍒"];
  const emo = emojis[Math.floor(Math.random()*emojis.length)];
  createDraggableElement(emo, 60, item);
}

function addDraggableText(item) {
  const txt = prompt("Tattoo text:", "SLUT");
  if (!txt) return;
  const el = createDraggableElement(txt.toUpperCase(), 28, item);
  el.style.fontFamily = "'Comic Sans MS', cursive";
  el.style.color = "#ff0000";
  el.style.textShadow = "2px 2px 4px #000";
  el.style.transform = "rotate(-8deg)";
}

function addSpeechBubble(item) {
  const txt = prompt("What does she say?", "Please destroy my asshole Daddy 😭");
  if (!txt) return;
  const el = createDraggableElement(txt, 18, item);
  el.style.background = "rgba(255,255,255,0.95)";
  el.style.color = "#000";
  el.style.padding = "12px 18px";
  el.style.borderRadius = "20px";
  el.style.maxWidth = "240px";
}

function createDraggableElement(content, fontSize, item) {
  const el = document.createElement("div");
  el.className = "overlay-element";
  el.style.position = "absolute";
  el.style.fontSize = fontSize + "px";
  el.style.cursor = "move";
  el.style.zIndex = "1003";
  el.style.userSelect = "none";
  el.textContent = content;
  document.querySelector(".lightbox-content").appendChild(el);
  makeDraggable(el, item);
  return el;
}

function makeDraggable(el, item) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  el.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    el.style.top = (el.offsetTop - pos2) + "px";
    el.style.left = (el.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    saveCurrentOverlays(item);
  }
}

async function saveCurrentOverlays(item) {
  const overlays = [];
  document.querySelectorAll(".overlay-element").forEach(el => {
    overlays.push({
      content: el.textContent,
      top: el.style.top,
      left: el.style.left
    });
  });
  item.overlays = overlays;
  await fetch("/api/overlay/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: item.public_id, gallery: currentGallery, overlays })
  });
}

async function autoDepravedCaption(public_id) {
  const res = await fetch("/api/auto-caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id, gallery: currentGallery })
  });
  const data = await res.json();
  if (data.success) alert("Filthy caption added!");
}

async function deleteSingleItem(public_id) {
  const password = prompt("Enter admin password to delete:");
  if (!password) return;
  const res = await fetch("/api/delete-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id, gallery: currentGallery, password })
  });
  const data = await res.json();
  if (data.success) {
    alert("Image deleted");
    closeLightbox();
    await loadMedia();
  } else alert(data.error || "Failed");
}

async function addToAlbum(public_id) {
  const name = prompt("Enter album name to add this image to:");
  if (!name) return;
  await fetch("/api/albums/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  alert("Added to album!");
}

// Phone functions (keep your existing ones)
async function openPhoneOverlay() { /* your code */ }
function closePhoneOverlay() { /* your code */ }
async function buildPhoneFeed() { /* your code */ }
function escapeHtml(text) { /* your code */ }