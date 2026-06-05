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
const familyUnlockForm = document.getElementById("familyUnlockForm");
const familyUnlockMessage = document.getElementById("familyUnlockMessage");

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

initTheme();
initHandlers();
refreshStatus();

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
  familyCodeBtn?.addEventListener("click", unlockFamily);
  familyCodeInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") unlockFamily();
  });

  if (familyUnlockForm) {
    familyUnlockForm.addEventListener("submit", e => {
      e.preventDefault();
      unlockFamily();
    });
  }

  sortNewestBtn?.addEventListener("click", async () => {
    currentSort = "newest";
    currentLayout = "grid";
    setSortActive(sortNewestBtn);
    await loadMedia();
  });

  sortRandomBtn?.addEventListener("click", async () => {
    currentSort = "random";
    currentLayout = "masonry";
    setSortActive(sortRandomBtn);
    await loadMedia();
  });

  sortPopularBtn?.addEventListener("click", async () => {
    currentSort = "popular";
    currentLayout = "grid";
    setSortActive(sortPopularBtn);
    await loadMedia();
  });

  adminLoginBtn?.addEventListener("click", async () => {
    const password = prompt("Enter admin password:");
    if (!password) return;
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
    } else {
      alert(data.error || "Wrong admin password");
    }
  });

  adminLogoutBtn?.addEventListener("click", async () => {
    await fetch("/api/admin-logout", { method: "POST" });
    isAdmin = false;
    currentGallery = "family";
    await refreshStatus();
    await loadMedia();
  });

  familyGalleryBtn?.addEventListener("click", async () => {
    if (!isAdmin) return;
    currentGallery = "family";
    await fetch("/api/switch-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallery: "family" })
    });
    await refreshStatus();
    await loadMedia();
  });

  privateGalleryBtn?.addEventListener("click", async () => {
    if (!isAdmin) return;
    currentGallery = "private";
    await fetch("/api/switch-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallery: "private" })
    });
    await refreshStatus();
    await loadMedia();
  });

  logoutFamilyBtn?.addEventListener("click", async () => {
    await fetch("/api/family-logout", { method: "POST" });
    familyAccess = false;
    currentGallery = isAdmin ? "private" : "family";
    await refreshStatus();
    await loadMedia();
  });

  document.getElementById("tags-tab-btn")?.addEventListener("click", () => {
    if (!tagPanel) return;
    tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
  });

  closeTagPanel?.addEventListener("click", () => {
    if (tagPanel) tagPanel.style.display = "none";
  });

  clearTagFilter?.addEventListener("click", () => {
    activeTagFilter = "";
    render();
    renderTags();
  });

  chatToggleBtn?.addEventListener("click", () => {
    if (chatSection) chatSection.style.display = "block";
    if (chatToggleBtn) chatToggleBtn.style.display = "none";
    if (chatCloseBtn) chatCloseBtn.style.display = "inline-block";
  });

  chatCloseBtn?.addEventListener("click", () => {
    if (chatSection) chatSection.style.display = "none";
    if (chatToggleBtn) chatToggleBtn.style.display = "inline-block";
    if (chatCloseBtn) chatCloseBtn.style.display = "none";
  });

  backToTopBtn?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  deleteAllBtn?.addEventListener("click", async () => {
    if (!confirm(`Delete all items from ${currentGallery} gallery?`)) return;
    const res = await fetch("/delete-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallery: currentGallery })
    });
    const data = await res.json();
    if (data.success) await loadMedia();
    else alert(data.error || "Delete failed");
  });

  fileInput?.addEventListener("change", uploadFiles);
  videoFeedBtn?.addEventListener("click", openPhoneOverlay);
  phoneCloseBtn?.addEventListener("click", closePhoneOverlay);
  phoneBackBtn?.addEventListener("click", closePhoneOverlay);
  lightboxClose?.addEventListener("click", closeLightbox);

  lightbox?.addEventListener("click", e => {
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
  window.addEventListener("click", enableAudioOnFirstGesture, { once: true });
}

function setSortActive(btn) {
  [sortNewestBtn, sortRandomBtn, sortPopularBtn].forEach(b => b?.classList.remove("active"));
  btn?.classList.add("active");
}

async function unlockFamily() {
  const code = String(familyCodeInput?.value || "").trim();
  if (!code) {
    if (familyUnlockMessage) familyUnlockMessage.textContent = "Enter the code.";
    return;
  }

  if (familyUnlockMessage) familyUnlockMessage.textContent = "Checking code...";

  const res = await fetch("/api/family-unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });

  const data = await res.json().catch(() => ({}));

  if (data.success) {
    familyAccess = true;
    currentGallery = "family";
    if (familyUnlockMessage) familyUnlockMessage.textContent = "Code accepted.";
    if (gateScreen) gateScreen.style.display = "none";
    if (mainHeader) mainHeader.style.display = "flex";
    if (sortButtons) sortButtons.style.display = "flex";
    await refreshStatus();
    await loadMedia();
  } else {
    if (familyUnlockMessage) familyUnlockMessage.textContent = data.error || "Wrong code. Try again.";
  }
}

async function refreshStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  isAdmin = data.isAdmin;
  familyAccess = data.familyAccess;
  currentGallery = data.currentView || (isAdmin ? "private" : "family");

  const canSee = familyAccess || isAdmin;
  if (gateScreen) gateScreen.style.display = canSee ? "none" : "flex";
  if (mainHeader) mainHeader.style.display = canSee ? "flex" : "none";
  if (sortButtons) sortButtons.style.display = canSee ? "flex" : "none";
  if (adminBar) adminBar.style.display = isAdmin ? "flex" : "none";
  if (deleteAllBtn) deleteAllBtn.style.display = isAdmin ? "inline-block" : "none";
  if (familyGalleryBtn) familyGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
  if (privateGalleryBtn) privateGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
  if (chatToggleBtn) chatToggleBtn.style.display = isAdmin && currentGallery === "private" ? "inline-block" : "none";
  if (galleryTitle) galleryTitle.textContent = currentGallery === "private" ? "Private Gallery" : "Family Gallery";
  if (galleryBadge) galleryBadge.textContent = currentGallery === "private" ? "Private" : "Family";
}

function familyImages() {
  return items.filter(item => item.gallery === "family" && item.type === "image");
}

function startFamilyLogoRotation() {
  if (familyLogoTimer) clearInterval(familyLogoTimer);
  const imgs = familyImages();
  if (!imgs.length || !mainRotatingLogo) {
    if (mainRotatingLogo) mainRotatingLogo.removeAttribute("src");
    return;
  }
  let idx = 0;
  const show = () => {
    mainRotatingLogo.style.opacity = "0";
    setTimeout(() => {
      mainRotatingLogo.src = imgs[idx % imgs.length].url;
      mainRotatingLogo.style.opacity = "1";
      idx = (idx + 1) % imgs.length;
    }, 150);
  };
  show();
  familyLogoTimer = setInterval(show, 3000);
}

function setFavicon(url) {
  if (!siteFavicon) return;
  siteFavicon.href = url || "";
}

function updateBrandLogo() {
  startFamilyLogoRotation();
}

function updateFaviconFromFamily() {
  const imgs = familyImages();
  if (!imgs.length) {
    setFavicon("");
    return;
  }
  const best = [...imgs].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
  setFavicon(best.url);
}

async function loadMedia() {
  if (!familyAccess && !isAdmin) return;
  const res = await fetch(`/media?sort=${currentSort}&gallery=${currentGallery}`);
  const text = await res.text();
  if (!res.ok) return alert("Could not load media");
  items = JSON.parse(text);
  if (gallery) gallery.className = currentLayout === "grid" ? "grid-gallery" : "masonry";
  render();
  renderTags();
  updateBrandLogo();
  updateFaviconFromFamily();
  if (phoneOverlay && phoneOverlay.classList.contains("active")) await buildPhoneFeed();
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFilteredItems() {
  const base = currentSort === "random" ? shuffleArray(items) : [...items];
  if (!activeTagFilter) return base;
  return base.filter(item => Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase() === activeTagFilter.toLowerCase()));
}

function render() {
  if (!gallery) return;
  gallery.innerHTML = "";
  const displayItems = getFilteredItems();

  if (!displayItems.length) {
    gallery.innerHTML = "<div class='empty-state'>No matching images or videos.</div>";
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
      vid.preload = "metadata";
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
    tagBtn.type = "button";
    tagBtn.textContent = "Add Tag";
    tagBtn.addEventListener("click", async e => {
      e.stopPropagation();
      await addTagToItem(item.public_id);
    });
    actions.appendChild(tagBtn);

    if (isAdmin) {
      const capBtn = document.createElement("button");
      capBtn.className = "add-tag-btn";
      capBtn.type = "button";
      capBtn.textContent = "Edit Caption";
      capBtn.addEventListener("click", async e => {
        e.stopPropagation();
        await editCaption(item.public_id);
      });
      actions.appendChild(capBtn);
    }

    if (currentGallery === "private") {
      const comfyBtn = document.createElement("button");
      comfyBtn.className = "add-tag-btn";
      comfyBtn.type = "button";
      comfyBtn.textContent = "Run ComfyDeploy";
      comfyBtn.addEventListener("click", async e => {
        e.stopPropagation();
        await runComfyWorkflow(item.public_id);
      });
      actions.appendChild(comfyBtn);
    }

    div.appendChild(actions);

    const likeDiv = document.createElement("div");
    likeDiv.className = "like-container";
    likeDiv.innerHTML = `<button class="like-btn" type="button">❤️ Like <span class="like-count">${item.likes || 0}</span></button>`;
    div.appendChild(likeDiv);

    likeDiv.querySelector(".like-btn").addEventListener("click", async e => {
      e.stopPropagation();
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id, gallery: currentGallery })
      });
      const data = await res.json();
      if (data.success) {
        e.currentTarget.querySelector(".like-count").textContent = data.likes;
        await loadMedia();
      }
    });

    div.addEventListener("click", () => openLightbox(originalIndex));
    gallery.appendChild(div);
  });
}

async function runComfyWorkflow(publicId) {
  const res = await fetch("/api/run-comfy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: publicId, gallery: "private" })
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || "ComfyDeploy workflow failed");
    return;
  }
  await loadMedia();
}

async function addTagToItem(publicId) {
  const tag = prompt("Enter a tag for this item:");
  if (!tag) return;
  const clean = tag.trim().replace(/^#/, "").replace(/\s+/g, " ");
  if (!clean) return;
  const res = await fetch("/api/tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: publicId, tag: clean, gallery: currentGallery })
  });
  const data = await res.json();
  if (data.success) await loadMedia();
}

async function editCaption(publicId) {
  const caption = prompt("Enter caption:");
  if (caption === null) return;
  const res = await fetch("/api/caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: publicId, caption, gallery: currentGallery })
  });
  const data = await res.json();
  if (data.success) await loadMedia();
}

function renderTags() {
  if (!tagList) return;
  const allTags = [...new Set(items.flatMap(item => item.tags || []))].sort((a, b) => a.localeCompare(b));
  tagList.innerHTML = "";
  if (!allTags.length) {
    tagList.innerHTML = "<div class='empty-tags'>No tags yet.</div>";
    return;
  }
  allTags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-chip" + (activeTagFilter === tag ? " active" : "");
    btn.type = "button";
    btn.textContent = `#${tag}`;
    btn.addEventListener("click", () => {
      activeTagFilter = activeTagFilter === tag ? "" : tag;
      render();
      renderTags();
    });
    tagList.appendChild(btn);
  });
}

async function uploadFiles() {
  const files = fileInput?.files;
  if (!files || !files.length) return;

  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("gallery", currentGallery);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (data.success) {
    if (fileInput) fileInput.value = "";
    await loadMedia();
  } else {
    alert(data.error || "Upload failed");
  }
}

function openLightbox(index) {
  lightboxIndex = index;
  showLightbox();
  if (lightbox) lightbox.style.display = "flex";
}

function showLightbox() {
  const item = items[lightboxIndex];
  if (!item) return;
  if (lightboxImg) lightboxImg.style.display = item.type === "image" ? "block" : "none";
  if (lightboxVideo) lightboxVideo.style.display = item.type === "video" ? "block" : "none";
  if (item.type === "image" && lightboxImg) lightboxImg.src = item.url;
  if (item.type === "video" && lightboxVideo) {
    lightboxVideo.src = item.url;
    lightboxVideo.load();
  }
  if (lightboxCaption) lightboxCaption.textContent = item.caption || "";
}

function closeLightbox() {
  if (lightbox) lightbox.style.display = "none";
  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
  }
}

function stepLightbox(dir) {
  if (lightboxIndex < 0 || !items.length) return;
  lightboxIndex = (lightboxIndex + dir + items.length) % items.length;
  showLightbox();
}

function handleLightboxWheel(e) {
  if (!lightbox || lightbox.style.display === "none") return;
  e.preventDefault();
  if (wheelLock) return;
  wheelLock = true;
  stepLightbox(e.deltaY > 0 ? 1 : -1);
  setTimeout(() => wheelLock = false, 250);
}

function enableAudioOnFirstGesture() {}

function openPhoneOverlay() {
  if (!phoneOverlay) return;
  phoneOverlay.classList.add("active");
  buildPhoneFeed();
}

function closePhoneOverlay() {
  if (!phoneOverlay) return;
  phoneOverlay.classList.remove("active");
  if (phoneFeed) phoneFeed.innerHTML = "";
}

async function buildPhoneFeed() {
  phoneVideos = items.filter(item => item.type === "video");
  if (!phoneFeed) return;
  phoneFeed.innerHTML = "";
  phoneVideos.forEach((vidItem, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "phone-card";
    const v = document.createElement("video");
    v.src = vidItem.url;
    v.controls = true;
    v.loop = true;
    v.muted = true;
    v.autoplay = true;
    v.playsInline = true;
    wrap.appendChild(v);
    phoneFeed.appendChild(wrap);
  });
}