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
const sortNewestBtn = document.getElementById("sort-newest");
const sortRandomBtn = document.getElementById("sort-random");
const sortPopularBtn = document.getElementById("sort-popular");
const chatMessages = document.getElementById("chat-messages");
const chatName = document.getElementById("chat-name");
const chatMessage = document.getElementById("chat-message");
const sendChat = document.getElementById("send-chat");
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

let items = [];
let zoom = 1, x = 0, y = 0, dragging = false, startX = 0, startY = 0;
let isAdmin = false;
let familyAccess = false;
let currentSort = "random";
let currentLayout = "masonry";
let currentGallery = "family";
let activeTagFilter = "";
let galleryLogoTimer = null;
let mainLogoTimer = null;
let galleryLogoIndex = 0;
let mainLogoIndex = 0;

initTheme();
initHandlers();
refreshStatus();

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

  adminLoginBtn.addEventListener("click", async () => {
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
    } else alert("Wrong admin password");
  });

  adminLogoutBtn.addEventListener("click", async () => {
    await fetch("/api/admin-logout", { method: "POST" });
    isAdmin = false;
    currentGallery = "family";
    await refreshStatus();
    await loadMedia();
  });

  familyGalleryBtn.addEventListener("click", async () => {
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

  privateGalleryBtn.addEventListener("click", async () => {
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

  logoutFamilyBtn.addEventListener("click", async () => {
    await fetch("/api/family-logout", { method: "POST" });
    familyAccess = false;
    currentGallery = isAdmin ? "private" : "family";
    await refreshStatus();
    await loadMedia();
  });

  if (document.getElementById("tags-tab-btn")) {
    document.getElementById("tags-tab-btn").addEventListener("click", () => {
      tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
    });
  }

  closeTagPanel.addEventListener("click", () => { tagPanel.style.display = "none"; });
  clearTagFilter.addEventListener("click", () => { activeTagFilter = ""; render(); renderTags(); });

  chatToggleBtn.addEventListener("click", () => {
    chatSection.style.display = "block";
    chatToggleBtn.style.display = "none";
    chatCloseBtn.style.display = "inline-block";
  });

  chatCloseBtn.addEventListener("click", () => {
    chatSection.style.display = "none";
    chatToggleBtn.style.display = "inline-block";
    chatCloseBtn.style.display = "none";
  });

  backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  deleteAllBtn.addEventListener("click", async () => {
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

  fileInput.addEventListener("change", () => {
    const selected = Array.from(fileInput.files || []).map(f => f.name).join(", ");
    const label = document.querySelector(".upload-btn");
    if (selected) label.textContent = `Selected: ${selected.slice(0, 45)}${selected.length > 45 ? "..." : ""}`;
    else label.textContent = "Upload Photos & Videos";
  });

  fileInput.addEventListener("change", uploadFiles);

  videoFeedBtn.addEventListener("click", () => {
    const url = `/phone.html?gallery=${encodeURIComponent(currentGallery)}`;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) location.href = url;
  });

  window.addEventListener("scroll", () => {
    backToTopBtn.style.display = window.scrollY > 300 ? "inline-block" : "none";
  });

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-content")) closeLightbox();
  });
  window.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
}

function setSortActive(btn) {
  [sortNewestBtn, sortRandomBtn, sortPopularBtn].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

async function unlockFamily() {
  const code = familyCodeInput.value.trim();
  if (!code) return;
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
  } else gateMessage.textContent = "Wrong code. Try again.";
}

async function refreshStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  isAdmin = data.isAdmin;
  familyAccess = data.familyAccess;
  currentGallery = data.currentView || (isAdmin ? "private" : "family");

  gateScreen.style.display = familyAccess || isAdmin ? "none" : "flex";
  mainHeader.style.display = familyAccess || isAdmin ? "flex" : "none";
  sortButtons.style.display = familyAccess || isAdmin ? "flex" : "none";
  adminBar.style.display = isAdmin ? "flex" : "none";

  deleteAllBtn.style.display = isAdmin ? "inline-block" : "none";
  familyGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
  privateGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
  chatToggleBtn.style.display = isAdmin && currentGallery === "private" ? "inline-block" : "none";

  galleryTitle.textContent = currentGallery === "private" ? "Private Gallery" : "Family Gallery";
  galleryBadge.textContent = currentGallery === "private" ? "Private" : "Family";
}

function getGalleryImages() {
  return items.filter(item => item.type === "image");
}

function startGalleryLogoRotation() {
  const img = document.getElementById("gallery-logo-img");
  const logos = currentGallery === "private"
    ? items.filter(item => item.type === "image")
    : items.filter(item => item.type === "image");
  if (galleryLogoTimer) clearInterval(galleryLogoTimer);
  if (!img || !logos.length) return;

  const update = () => {
    img.style.opacity = "0";
    setTimeout(() => {
      img.src = logos[galleryLogoIndex % logos.length].url;
      img.style.opacity = "1";
    }, 180);
    galleryLogoIndex = (galleryLogoIndex + 1) % logos.length;
  };

  update();
  galleryLogoTimer = setInterval(update, 3500);
}

function startMainLogoRotation() {
  if (mainLogoTimer) clearInterval(mainLogoTimer);
  if (!mainRotatingLogo) return;
  if (currentGallery !== "family") {
    mainRotatingLogo.removeAttribute("src");
    mainRotatingLogo.style.opacity = "0";
    return;
  }

  const familyImages = items.filter(item => item.type === "image");
  if (!familyImages.length) {
    mainRotatingLogo.removeAttribute("src");
    mainRotatingLogo.style.opacity = "0";
    return;
  }

  const update = () => {
    mainRotatingLogo.style.opacity = "0";
    setTimeout(() => {
      mainRotatingLogo.src = familyImages[mainLogoIndex % familyImages.length].url;
      mainRotatingLogo.style.opacity = "1";
    }, 180);
    mainLogoIndex = (mainLogoIndex + 1) % familyImages.length;
  };

  update();
  mainLogoTimer = setInterval(update, 3500);
}

async function loadMedia() {
  if (!familyAccess && !isAdmin) return;
  const res = await fetch(`/media?sort=${currentSort}&gallery=${currentGallery}`);
  const text = await res.text();
  if (!res.ok) return alert("Could not load media");

  items = JSON.parse(text);
  gallery.className = currentLayout === "grid" ? "grid-gallery" : "masonry";
  render();
  renderTags();
  startGalleryLogoRotation();
  startMainLogoRotation();
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

    const actions = document.createElement("div");
    actions.className = "media-actions";

    const tagBtn = document.createElement("button");
    tagBtn.className = "add-tag-btn";
    tagBtn.textContent = "Add Tag";
    tagBtn.addEventListener("click", async e => {
      e.stopPropagation();
      await addTagToItem(item.public_id);
    });
    actions.appendChild(tagBtn);

    if (isAdmin) {
      const capBtn = document.createElement("button");
      capBtn.className = "add-tag-btn";
      capBtn.textContent = "Edit Caption";
      capBtn.addEventListener("click", async e => {
        e.stopPropagation();
        await editCaption(item.public_id);
      });
      actions.appendChild(capBtn);
    }

    div.appendChild(actions);

    const likeDiv = document.createElement("div");
    likeDiv.className = "like-container";
    likeDiv.innerHTML = `<button class="like-btn">❤️ <span class="like-count">${item.likes || 0}</span></button>`;
    div.appendChild(likeDiv);

    likeDiv.querySelector(".like-btn").addEventListener("click", async e => {
      e.stopPropagation();
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id, gallery: currentGallery })
      });
      const data = await res.json();
      if (data.success) e.currentTarget.querySelector(".like-count").textContent = data.likes;
    });

    div.addEventListener("click", () => openLightbox(originalIndex));
    gallery.appendChild(div);
  });
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

  const text = await res.text();
  if (!res.ok) return alert("Tag save failed");
  const data = JSON.parse(text);
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
  else alert(data.error || "Caption save failed");
}

function renderTags() {
  const allTags = [...new Set(items.flatMap(item => item.tags || []))].sort((a, b) => a.localeCompare(b));
  tagList.innerHTML = "";
  if (!allTags.length) {
    tagList.innerHTML = "<p>No tags yet.</p>";
    return;
  }
  allTags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-chip" + (activeTagFilter === tag ? " active" : "");
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
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;

  if (files.length > 1000) return alert("Maximum 1000 files per upload.");
  if (currentGallery === "private" && !isAdmin) return alert("Admin only for private gallery.");
  if (currentGallery === "family" && !familyAccess && !isAdmin) return alert("Family access required.");

  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  fd.append("gallery", currentGallery);

  const btn = document.querySelector(".upload-btn");
  const originalLabel = "Upload Photos & Videos";
  btn.textContent = `Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`;
  btn.disabled = true;

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: fd
    });

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (res.ok && data.success) {
      await loadMedia();
      if (data.errors && data.errors.length) {
        alert(`Uploaded ${data.count || 0} files. Some files failed:\n${data.errors.join("\n")}`);
      }
    } else {
      console.error(text);
      alert(data.error || "Upload failed");
    }
  } catch (err) {
    console.error(err);
    alert("Upload failed");
  } finally {
    btn.textContent = originalLabel;
    btn.disabled = false;
    fileInput.value = "";
  }
}

function openLightbox(index) {
  const item = items[index];
  if (!item) return;
  lightbox.classList.add("active");
  zoom = 1;
  x = 0;
  y = 0;
  updateTransform();

  if (item.type === "image") {
    lightboxImg.src = item.url;
    lightboxImg.style.display = "block";
    lightboxVideo.style.display = "none";
    lightboxVideo.pause();
  } else {
    lightboxVideo.src = item.url;
    lightboxVideo.style.display = "block";
    lightboxImg.style.display = "none";
    lightboxImg.src = "";
    lightboxVideo.play().catch(() => {});
  }
}

function closeLightbox() {
  lightbox.classList.remove("active");
  lightboxImg.src = "";
  lightboxVideo.src = "";
  lightboxVideo.pause();
}

function updateTransform() {
  lightboxImg.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
}

async function sendChatMsg() {
  if (currentGallery !== "private" || !isAdmin) return;
  const name = chatName.value.trim();
  const message = chatMessage.value.trim();
  if (!name || !message) return;
  await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, message })
  });
  chatMessage.value = "";
  loadChat();
}

async function loadChat() {
  if (currentGallery !== "private" || !isAdmin) return;
  const res = await fetch("/api/chat");
  const messages = await res.json();
  chatMessages.innerHTML = "";
  messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "chat-message";
    const time = new Date(msg.timestamp).toLocaleTimeString();
    div.innerHTML = `<strong>${escapeHtml(msg.name)}</strong> <small>(${time})</small>: ${escapeHtml(msg.message)}`;
    chatMessages.appendChild(div);
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}