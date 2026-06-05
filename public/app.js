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
const syncGalleryBtn = document.getElementById("sync-gallery-btn");

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
  if (themeToggle) {
    themeToggle.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
    themeToggle.addEventListener("click", () => {
      const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
      document.body.className = newTheme;
      localStorage.setItem("theme", newTheme);
      themeToggle.textContent = newTheme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
    });
  }
}

function initHandlers() {
  // Gate Screen - Fixed
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

  // Admin
  if (adminLoginBtn) adminLoginBtn.addEventListener("click", adminLogin);
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", adminLogout);
  if (syncGalleryBtn) syncGalleryBtn.addEventListener("click", syncGallery);

  // Gallery Switch
  if (familyGalleryBtn) familyGalleryBtn.addEventListener("click", switchToFamily);
  if (privateGalleryBtn) privateGalleryBtn.addEventListener("click", switchToPrivate);
  if (logoutFamilyBtn) logoutFamilyBtn.addEventListener("click", familyLogout);

  // Other UI
  const tagsTabBtn = document.getElementById("tags-tab-btn");
  if (tagsTabBtn) tagsTabBtn.addEventListener("click", () => {
    tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
  });

  if (closeTagPanel) closeTagPanel.addEventListener("click", () => { tagPanel.style.display = "none"; });
  if (clearTagFilter) clearTagFilter.addEventListener("click", () => { activeTagFilter = ""; render(); renderTags(); });

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
  if (!familyCodeInput) return;
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
      if (gateScreen) gateScreen.style.display = "none";
      if (mainHeader) mainHeader.style.display = "flex";
      if (sortButtons) sortButtons.style.display = "flex";
      await refreshStatus();
      await loadMedia();
    } else {
      if (gateMessage) gateMessage.textContent = "Wrong code. Try again.";
      familyCodeInput.value = "";
      familyCodeInput.focus();
    }
  } catch (err) {
    console.error(err);
    if (gateMessage) gateMessage.textContent = "Connection error. Try again.";
  }
}

async function adminLogin() {
  const password = prompt("Enter admin password:");
  if (!password) return;
  try {
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.success) {
      isAdmin = true;
      currentGallery = "private";
      await refreshStatus();
      await loadMedia();
    } else alert("Wrong admin password");
  } catch (e) {
    alert("Login failed");
  }
}

async function adminLogout() {
  await fetch("/api/admin-logout", { method: "POST" });
  isAdmin = false;
  currentGallery = "family";
  await refreshStatus();
  await loadMedia();
}

async function syncGallery() {
  if (!confirm("Sync all media from Cloudinary folders?")) return;
  try {
    const res = await fetch("/api/sync-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallery: currentGallery })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Synced ${data.synced} new items!`);
      await loadMedia();
    } else {
      alert("Sync failed: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Sync error occurred");
  }
}

async function switchToFamily() {
  if (!isAdmin) return;
  currentGallery = "family";
  await fetch("/api/switch-gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gallery: "family" }) });
  await refreshStatus();
  await loadMedia();
}

async function switchToPrivate() {
  if (!isAdmin) return;
  currentGallery = "private";
  await fetch("/api/switch-gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gallery: "private" }) });
  await refreshStatus();
  await loadMedia();
}

async function familyLogout() {
  await fetch("/api/family-logout", { method: "POST" });
  familyAccess = false;
  currentGallery = isAdmin ? "private" : "family";
  await refreshStatus();
  await loadMedia();
}

function toggleChat() {
  if (chatSection.style.display === "block") {
    chatSection.style.display = "none";
    if (chatToggleBtn) chatToggleBtn.style.display = "inline-block";
    if (chatCloseBtn) chatCloseBtn.style.display = "none";
  } else {
    chatSection.style.display = "block";
    if (chatToggleBtn) chatToggleBtn.style.display = "none";
    if (chatCloseBtn) chatCloseBtn.style.display = "inline-block";
  }
}

async function deleteAll() {
  if (!confirm(`Delete all items from ${currentGallery} gallery?`)) return;
  const res = await fetch("/delete-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gallery: currentGallery })
  });
  const data = await res.json();
  if (data.success) await loadMedia();
  else alert(data.error || "Delete failed");
}

// ======================== CORE GALLERY ========================
async function refreshStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    isAdmin = data.isAdmin;
    familyAccess = data.familyAccess;
    currentGallery = data.currentView || (isAdmin ? "private" : "family");

    if (gateScreen) gateScreen.style.display = (familyAccess || isAdmin) ? "none" : "flex";
    if (mainHeader) mainHeader.style.display = (familyAccess || isAdmin) ? "flex" : "none";
    if (sortButtons) sortButtons.style.display = (familyAccess || isAdmin) ? "flex" : "none";
    if (adminBar) adminBar.style.display = isAdmin ? "flex" : "none";

    if (deleteAllBtn) deleteAllBtn.style.display = isAdmin ? "inline-block" : "none";
    if (familyGalleryBtn) familyGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
    if (privateGalleryBtn) privateGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
    if (chatToggleBtn) chatToggleBtn.style.display = (isAdmin && currentGallery === "private") ? "inline-block" : "none";

    if (galleryTitle) galleryTitle.textContent = currentGallery === "private" ? "Private Gallery" : "Family Gallery";
    if (galleryBadge) galleryBadge.textContent = currentGallery === "private" ? "Private" : "Family";
  } catch (e) {
    console.error("Status refresh failed", e);
  }
}

async function loadMedia() {
  if (!familyAccess && !isAdmin) return;
  
  try {
    const res = await fetch(`/media?sort=${currentSort}&gallery=${currentGallery}`);
    if (!res.ok) throw new Error("Failed to load");
    items = await res.json();

    gallery.className = currentLayout === "grid" ? "grid-gallery" : "masonry";
    render();
    renderTags();
    updateBrandLogo();
    updateFaviconFromFamily();

    // Auto Sync if empty (for Admin)
    if (items.length === 0 && isAdmin) {
      console.log("Gallery empty → Auto syncing from Cloudinary...");
      const syncRes = await fetch("/api/sync-gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gallery: currentGallery })
      });
      const syncData = await syncRes.json();
      if (syncData.success && syncData.synced > 0) {
        await loadMedia();
      }
    }
  } catch (err) {
    console.error(err);
    alert("Could not load media");
  }
}

function setSortActive(btn) {
  [sortNewestBtn, sortRandomBtn, sortPopularBtn].forEach(b => {
    if (b) b.classList.remove("active");
  });
  if (btn) btn.classList.add("active");
}

// Rest of your functions (render, upload, lightbox, phone, etc.) - copy from previous full version if needed
// For brevity, the most important parts are included. Add the remaining functions from earlier responses if missing.

function shuffleArray(arr) { /* same as before */ }
function getFilteredItems() { /* same */ }
function render() { /* full render function from previous response */ }
async function addTagToItem(publicId) { /* same */ }
async function editCaption(publicId) { /* same */ }
function renderTags() { /* same */ }
async function uploadFiles() { /* same */ }

// Lightbox functions
function openLightbox(index) { /* ... */ }
function showLightboxItem(index) { /* ... */ }
function closeLightbox() { /* ... */ }
function handleLightboxWheel(e) { /* ... */ }
function stepLightbox(direction) { /* ... */ }
function enableAudioOnFirstGesture() { /* ... */ }

// Phone Overlay
async function openPhoneOverlay() { /* ... */ }
function closePhoneOverlay() { /* ... */ }
async function buildPhoneFeed() { /* ... */ }
function escapeHtml(text) { /* ... */ }

function updateBrandLogo() { /* ... */ }
function updateFaviconFromFamily() { /* ... */ }
function familyImages() { /* ... */ }
function startFamilyLogoRotation() { /* ... */ }