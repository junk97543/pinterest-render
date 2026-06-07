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
      currentGallery = "family";
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
    const password = prompt("Re-enter admin password to open Private Gallery:");
    if (!password) return;
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!data.success) {
      alert("Wrong admin password");
      return;
    }
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
    currentGallery = "family";
    await refreshStatus();
    await loadMedia();
  });

  document.getElementById("tags-tab-btn")?.addEventListener("click", () => {
    tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
  });

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

  fileInput.addEventListener("change", uploadFiles);
  videoFeedBtn.addEventListener("click", openPhoneOverlay);

// Add this near the other buttons
const albumsBtn = document.createElement("button");
albumsBtn.textContent = "📁 Albums";
albumsBtn.className = "feed-btn";
albumsBtn.addEventListener("click", showAlbums);
mainHeader.appendChild(albumsBtn);

  phoneCloseBtn.addEventListener("click", closePhoneOverlay);
  phoneBackBtn.addEventListener("click", closePhoneOverlay);

  lightboxClose.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", e => {
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
  currentGallery = data.currentView || "family";

  const showMain = familyAccess || isAdmin;
  gateScreen.style.display = showMain ? "none" : "flex";
  mainHeader.style.display = showMain ? "flex" : "none";
  sortButtons.style.display = showMain ? "flex" : "none";
  adminBar.style.display = isAdmin ? "flex" : "none";

  deleteAllBtn.style.display = isAdmin ? "inline-block" : "none";
  familyGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
  privateGalleryBtn.style.display = isAdmin ? "inline-block" : "none";
  chatToggleBtn.style.display = isAdmin && currentGallery === "private" ? "inline-block" : "none";

  galleryTitle.textContent = currentGallery === "private" ? "Private Gallery" : "Family Gallery";
  galleryBadge.textContent = currentGallery === "private" ? "Private" : "Family";

  await loadExcludedTags();
  renderExcludedTagsPanel();
}

async function loadExcludedTags() {
  try {
    const res = await fetch("/api/excluded-tags");
    const data = await res.json();
    excludedTags = data.success && Array.isArray(data.excludedTags) ? data.excludedTags : [];
  } catch {
    excludedTags = [];
  }
}

function renderExcludedTagsPanel() {
  if (!tagPanel) return;
  const existingHeader = tagPanel.querySelector(".excluded-tags-panel");
  if (existingHeader) existingHeader.remove();

  if (!isAdmin || currentGallery !== "private") return;

  const wrap = document.createElement("div");
  wrap.className = "excluded-tags-panel";
  wrap.innerHTML = `
    <div class="tag-panel-header">
      <h2>Excluded Tags</h2>
    </div>
    <div class="tag-list" id="excluded-tags-list"></div>
    <div class="excluded-tag-form">
      <input id="excluded-tag-input" type="text" placeholder="Add excluded tag, e.g. nsfw" />
      <button id="add-excluded-tag-btn" class="tag-clear-btn">Exclude Tag</button>
    </div>
  `;
  tagPanel.prepend(wrap);

  const list = wrap.querySelector("#excluded-tags-list");
  list.innerHTML = "";

  if (!excludedTags.length) {
    list.innerHTML = "<p>No excluded tags.</p>";
  } else {
    excludedTags.forEach(tag => {
      const chip = document.createElement("button");
      chip.className = "tag-chip active";
      chip.textContent = `#${tag} ✕`;
      chip.addEventListener("click", async () => {
        await fetch("/api/excluded-tags/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag })
        });
        await refreshStatus();
        await loadMedia();
      });
      list.appendChild(chip);
    });
  }

  wrap.querySelector("#add-excluded-tag-btn").addEventListener("click", async () => {
    const input = wrap.querySelector("#excluded-tag-input");
    const tag = input.value.trim();
    if (!tag) return;
    const res = await fetch("/api/excluded-tags/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag })
    });
    const data = await res.json();
    if (data.success) {
      input.value = "";
      await refreshStatus();
      await loadMedia();
    }
  });
}

function familyImages() {
  return items.filter(item => item.gallery === "family" && item.type === "image");
}

function startFamilyLogoRotation() {
  if (familyLogoTimer) clearInterval(familyLogoTimer);
  const imgs = familyImages();
  if (!imgs.length) {
    mainRotatingLogo.removeAttribute("src");
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
  gallery.className = currentLayout === "grid" ? "grid-gallery" : "masonry";
  render();
  renderTags();
  updateBrandLogo();
  updateFaviconFromFamily();
  if (phoneOverlay.classList.contains("active")) await buildPhoneFeed();
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
      if (data.success) {
        e.currentTarget.querySelector(".like-count").textContent = data.likes;
        await loadMedia();
      }
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
    const res = await fetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.success) {
      await loadMedia();
      if (data.errors && data.errors.length) alert(`Uploaded ${data.count || 0} files. Some files failed:\n${data.errors.join("\n")}`);
    } else {
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

  // Clear old panels
  document.querySelectorAll("#rating-panel, #depravity-panel, .overlay-element").forEach(el => el.remove());

  if (isAdmin && currentGallery === "private") {
    createRatingPanel(item, index);   // LEFT SIDE - Rating
    createDepravityPanel(item);       // RIGHT SIDE - Depravity Tools
  }
}
function closeLightbox() {
  lightbox.classList.remove("active");
  lightboxImg.src = "";
  lightboxVideo.pause();
  lightboxVideo.src = "";
  lightboxCaption.classList.remove("show");
  lightboxCaption.textContent = "";
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

function enableAudioOnFirstGesture() {
  if (!lightbox.classList.contains("active")) return;
  if (!lightboxVideo || !lightboxVideo.src) return;
  lightboxVideo.muted = false;
  lightboxVideo.play().catch(() => {});
}

async function openPhoneOverlay() {
  phoneOverlay.classList.add("active");
  await buildPhoneFeed();
}

function closePhoneOverlay() {
  phoneOverlay.classList.remove("active");
  phoneFeed.innerHTML = "";
}

async function buildPhoneFeed() {
  const res = await fetch(`/media?sort=newest&gallery=${currentGallery}`);
  if (!res.ok) {
    phoneFeed.innerHTML = "<div class='phone-item'><div class='phone-overlay-ui'><div class='phone-caption'>No access or no videos.</div></div></div>";
    return;
  }

  const data = await res.json();
  phoneVideos = data.filter(item => item.type === "video");
  phoneIndex = 0;
  phoneFeed.innerHTML = "";

  if (!phoneVideos.length) {
    phoneFeed.innerHTML = "<div class='phone-item'><div class='phone-overlay-ui'><div class='phone-caption'>No videos uploaded yet.</div></div></div>";
    return;
  }

  phoneVideos.forEach((item, idx) => {
    const el = document.createElement("section");
    el.className = "phone-item";
    el.dataset.index = idx;
    el.innerHTML = `
      <video class="phone-video" muted playsinline loop preload="metadata" src="${item.url}"></video>
      <button class="phone-video-unmute">Unmute</button>
      <div class="phone-overlay-ui">
        <div class="phone-edit-bar">
          <button class="phone-tag-edit">Add Tag</button>
          <button class="phone-caption-edit">Edit Caption</button>
        </div>
        <div class="phone-caption">${escapeHtml(item.caption || "")}</div>
        <div class="phone-tags">
          ${(item.tags || []).map(tag => `<button class="phone-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}
        </div>
        <div class="phone-comments">
          <div class="phone-comments-list"></div>
          <div class="phone-comment-form">
            <input type="text" placeholder="Write a comment..." />
            <button type="button">Post</button>
          </div>
        </div>
        <div class="phone-actions">
          <button class="phone-like">❤️ <span>${item.likes || 0}</span></button>
          <button class="phone-comment">💬</button>
          <button class="phone-share">↗</button>
        </div>
      </div>
    `;

    const video = el.querySelector(".phone-video");
    const unmuteBtn = el.querySelector(".phone-video-unmute");
    const likeBtn = el.querySelector(".phone-like");
    const commentBtn = el.querySelector(".phone-comment");
    const shareBtn = el.querySelector(".phone-share");
    const comments = el.querySelector(".phone-comments");
    const commentInput = el.querySelector(".phone-comment-form input");
    const postBtn = el.querySelector(".phone-comment-form button");
    const tagButtons = el.querySelectorAll(".phone-tag");
    const tagEditBtn = el.querySelector(".phone-tag-edit");
    const captionEditBtn = el.querySelector(".phone-caption-edit");

    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.muted = true;
    video.play().catch(() => {});

    unmuteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      video.muted = false;
      try { await video.play(); } catch { video.muted = true; }
    });

    el.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".phone-comments")) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });

    likeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id, gallery: currentGallery })
      });
      const data = await res.json();
      if (data.success) likeBtn.querySelector("span").textContent = data.likes;
    });

    commentBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      comments.classList.toggle("active");
      commentInput.focus();
    });

    postBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const txt = commentInput.value.trim();
      if (!txt) return;
      const row = document.createElement("div");
      row.className = "phone-comment-item";
      row.textContent = txt;
      el.querySelector(".phone-comments-list").appendChild(row);
      commentInput.value = "";
    });

    shareBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (navigator.share) {
        try { await navigator.share({ title: "Video", url: item.url }); } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.url);
        alert("Video link copied!");
      }
    });

    tagEditBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await addTagToItem(item.public_id);
      await buildPhoneFeed();
    });

    captionEditBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await editCaption(item.public_id);
      await buildPhoneFeed();
    });

    tagButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeTagFilter = btn.dataset.tag;
        closePhoneOverlay();
        render();
        renderTags();
      });
    });

    phoneFeed.appendChild(el);
  });

  await jumpToPhoneItem(0);
}

async function jumpToPhoneItem(idx) {
  const target = phoneFeed.querySelector(`.phone-item[data-index="${idx}"]`);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function createRatingPanel(item, index) {
  const panel = document.createElement("div");
  panel.id = "rating-panel";
  panel.style = `position:absolute; top:20px; left:20px; width:420px; background:rgba(0,0,0,0.95); padding:20px; border-radius:16px; color:#fff; z-index:1002; max-height:85vh; overflow-y:auto;`;

  panel.innerHTML = `
    <h3 style="text-align:center; color:#ff5a5f; margin:0 0 15px 0;">Rate This Nude</h3>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:14px;">
      <div>
        <label>Boobs:</label><br>
        <select id="r-breast" style="width:100%;padding:8px;margin:4px 0;">
          <option value="flat">Flat / Prepubescent</option>
          <option value="small">Small Perky</option>
          <option value="medium">Medium Teardrop</option>
          <option value="big">Big Full</option>
          <option value="huge" selected>Mommy Milkers / Massive</option>
        </select>
      </div>
      <div>
        <label>Body Shape:</label><br>
        <select id="r-body" style="width:100%;padding:8px;margin:4px 0;">
          <option value="slim">Slim / Skinny</option>
          <option value="athletic">Athletic / Toned</option>
          <option value="curvy">Curvy / Hourglass</option>
          <option value="thick">Thick / Juicy</option>
          <option value="bbw">BBW / Voluptuous</option>
        </select>
      </div>
      <div>
        <label>Build:</label><br>
        <select id="r-build" style="width:100%;padding:8px;margin:4px 0;">
          <option value="skinny">Skinny</option>
          <option value="chubby">Chubby / Soft</option>
          <option value="fat">Fat / Plump</option>
          <option value="athletic">Athletic</option>
        </select>
      </div>

      <div><label>Fuckability (0-10)</label><br><input type="number" id="r-fuck" step="0.1" min="0" max="10" value="${item.ratings?.fuckability || 7.5}" style="width:100%;padding:8px;"></div>
      <div><label>Cuteness (0-10)</label><br><input type="number" id="r-cute" step="0.1" min="0" max="10" value="${item.ratings?.cuteness || 7}" style="width:100%;padding:8px;"></div>
      <div><label>Beauty (0-10)</label><br><input type="number" id="r-beauty" step="0.1" min="0" max="10" value="${item.ratings?.beauty || 7}" style="width:100%;padding:8px;"></div>
      <div><label>Hotness (0-10)</label><br><input type="number" id="r-hot" step="0.1" min="0" max="10" value="${item.ratings?.hotness || 8}" style="width:100%;padding:8px;"></div>
      <div><label>Sluttiness (0-10)</label><br><input type="number" id="r-slut" step="0.1" min="0" max="10" value="${item.ratings?.sluttiness || 6}" style="width:100%;padding:8px;"></div>
      <div><label>Submissiveness (0-10)</label><br><input type="number" id="r-sub" step="0.1" min="0" max="10" value="${item.ratings?.submissiveness || 5}" style="width:100%;padding:8px;"></div>
    </div>

    <button id="save-rating-btn" style="margin-top:15px;width:100%;padding:12px;background:#e60023;border:none;color:white;font-weight:bold;border-radius:8px;">💾 Save Ratings & Tags</button>
    <button id="add-emoji-btn" style="margin-top:8px;width:100%;padding:10px;background:#ff1493;border:none;color:white;font-weight:bold;border-radius:8px;">😈 Add Porn Emoji</button>
    <button id="delete-item-btn" style="margin-top:8px;width:100%;padding:10px;background:#333;border:none;color:white;font-weight:bold;border-radius:8px;">🗑️ Delete This Image</button>
  `;

  document.querySelector(".lightbox-content").appendChild(panel);

  document.getElementById("save-rating-btn").addEventListener("click", saveRatings);
  document.getElementById("add-emoji-btn").addEventListener("click", () => showEmojiPicker(item));
  document.getElementById("delete-item-btn").addEventListener("click", () => deleteSingleItem(item.public_id));
}

async function saveRatings() {
  const ratings = {
    breast: document.getElementById("r-breast").value,
    bodyShape: document.getElementById("r-body").value,
    build: document.getElementById("r-build").value,
    fuckability: parseFloat(document.getElementById("r-fuck").value),
    cuteness: parseFloat(document.getElementById("r-cute").value),
    beauty: parseFloat(document.getElementById("r-beauty").value),
    hotness: parseFloat(document.getElementById("r-hot").value),
    sluttiness: parseFloat(document.getElementById("r-slut").value),
    submissiveness: parseFloat(document.getElementById("r-sub").value),
  };

  const res = await fetch("/api/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: items[lightboxIndex].public_id, gallery: currentGallery, ratings })
  });
  const data = await res.json();
  if (data.success) {
    alert(`✅ Saved! Overall Rating: ${data.overallRating}`);
    await loadMedia();
  }
}

function showEmojiPicker(item) {
  const emojis = ["🍆", "💦", "😈", "🍑", "🔥", "🥵", "💋", "🍼", "😩", "🤤", "👅", "🍒"];
  let picker = document.getElementById("emoji-picker");
  if (picker) picker.remove();

  picker = document.createElement("div");
  picker.id = "emoji-picker";
  picker.style = `position:absolute; top:20px; right:20px; background:rgba(0,0,0,0.95); padding:15px; border-radius:12px; z-index:1003; display:flex; flex-wrap:wrap; gap:8px; width:280px;`;

  emojis.forEach(emo => {
    const btn = document.createElement("button");
    btn.textContent = emo;
    btn.style = "font-size:28px; background:none; border:none; cursor:pointer; padding:8px;";
    btn.addEventListener("click", () => addEmojiToImage(emo, item));
    picker.appendChild(btn);
  });

  document.querySelector(".lightbox-content").appendChild(picker);
}

function addEmojiToImage(emoji, item) {
  if (!item.emojis) item.emojis = [];
  if (!item.emojis.includes(emoji)) item.emojis.push(emoji);

  // Visual overlay (you can improve positioning later)
  const overlay = document.createElement("div");
  overlay.style = `position:absolute; top:${Math.random()*60 + 20}%; left:${Math.random()*60 + 20}%; font-size:42px; pointer-events:none; z-index:1001; opacity:0.9;`;
  overlay.textContent = emoji;
  document.querySelector(".lightbox-content").appendChild(overlay);

  setTimeout(() => overlay.remove(), 8000);
}

// Single Delete
async function deleteSingleItem(public_id) {
  const password = prompt("Enter admin password to delete this image:");
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
  } else {
    alert(data.error || "Delete failed");
  }
}
// ======================== RIGHT SIDE: DEPRIVITY TOOLS ========================
function createDepravityPanel(item) {
  const panel = document.createElement("div");
  panel.id = "depravity-panel";
  panel.style = `position:absolute; top:20px; right:20px; width:380px; background:rgba(0,0,0,0.95); padding:20px; border-radius:14px; color:#fff; z-index:1002; max-height:80vh; overflow-y:auto;`;

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

// Draggable Emoji
function addDraggableEmoji(item) {
  const emojis = ["🍆","💦","🍑","🥵","😈","🤤","👅","🍼","🔥","😩","🍒"];
  const emo = emojis[Math.floor(Math.random()*emojis.length)];
  createDraggableElement(emo, 60, item);
}

// Draggable Tattoo Text with options
function addDraggableText(item) {
  const txt = prompt("Tattoo text:", "SLUT");
  if (!txt) return;
  const size = prompt("Text size (px):", "28") || 28;
  const color = prompt("Text color (#hex):", "#ff0000") || "#ff0000";
  const el = createDraggableElement(txt.toUpperCase(), parseInt(size), item);
  el.style.color = color;
  el.style.fontFamily = "'Comic Sans MS', cursive";
  el.style.textShadow = "2px 2px 4px #000";
  el.style.transform = "rotate(-8deg)";
}

// Speech Bubble with options
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
    pos3 = e.clientX; pos4 = e.clientY;
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
      left: el.style.left,
      fontSize: el.style.fontSize,
      color: el.style.color
    });
  });
  item.overlays = overlays;
  await fetch("/api/overlay/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: item.public_id, gallery: currentGallery, overlays })
  });
}

// Other helpers
async function autoDepravedCaption(public_id) { /* your existing */ }
async function deleteSingleItem(public_id) { /* your existing */ }
async function addToAlbum(public_id) { /* your existing */ }

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
  const password = prompt("Enter admin password to delete this image:");
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
  } else {
    alert(data.error || "Delete failed");
  }
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
// ======================== LEFT: RATING PANEL (keep your existing) ========================
function createRatingPanel(item, index) {
  // Your existing createRatingPanel function (keep it as is)
  // ... paste your current createRatingPanel here if needed ...
}

// ======================== RIGHT: DEPRIVITY TOOLS PANEL ========================
function createDepravityPanel(item) {
  const panel = document.createElement("div");
  panel.id = "depravity-panel";
  panel.style = `position:absolute; top:20px; right:20px; width:380px; background:rgba(0,0,0,0.95); padding:20px; border-radius:14px; color:#fff; z-index:1002; max-height:80vh; overflow-y:auto;`;

  panel.innerHTML = `
    <h3 style="text-align:center;color:#ff5a5f">🔥 Depravity Tools</h3>
    <button id="emoji-btn" style="width:100%;padding:12px;margin:6px 0;background:#ff1493;border:none;color:white;border-radius:8px;">😈 Draggable Emoji</button>
    <button id="text-btn" style="width:100%;padding:12px;margin:6px 0;background:#ff4500;border:none;color:white;border-radius:8px;">✍️ Tattoo Text</button>
    <button id="snapchat-btn" style="width:100%;padding:12px;margin:6px 0;background:#00ff7f;border:none;color:black;border-radius:8px;">📱 Snapchat Text</button>
    <button id="bubble-btn" style="width:100%;padding:12px;margin:6px 0;background:#8a2be2;border:none;color:white;border-radius:8px;">💬 Speech Bubble</button>
    <button id="auto-caption-btn" style="width:100%;padding:12px;margin:6px 0;background:#e60023;border:none;color:white;border-radius:8px;">🤖 Auto Filthy Caption</button>
    <button id="album-btn" style="width:100%;padding:12px;margin:6px 0;background:#32cd32;border:none;color:white;border-radius:8px;">📁 Add to Album</button>
    <button id="tierlist-btn" style="width:100%;padding:12px;margin:6px 0;background:#00bfff;border:none;color:white;border-radius:8px;">🏆 Tier List Maker</button>
    <button id="delete-btn" style="width:100%;padding:12px;margin:12px 0 0 0;background:#333;border:none;color:white;border-radius:8px;">🗑️ Delete Image</button>
  `;

  document.querySelector(".lightbox-content").appendChild(panel);

  panel.querySelector("#emoji-btn").onclick = () => addDraggableEmoji(item);
  panel.querySelector("#text-btn").onclick = () => addDraggableText(item);
  panel.querySelector("#snapchat-btn").onclick = () => addSnapchatText(item);
  panel.querySelector("#bubble-btn").onclick = () => addSpeechBubble(item);
  panel.querySelector("#auto-caption-btn").onclick = () => autoDepravedCaption(item.public_id);
  panel.querySelector("#album-btn").onclick = () => addToAlbum(item.public_id);
  panel.querySelector("#tierlist-btn").onclick = () => alert("Tier List Maker coming soon!");
  panel.querySelector("#delete-btn").onclick = () => deleteSingleItem(item.public_id);
}

// Draggable Emoji, Text, Snapchat Text, Bubble, etc. (add the functions from previous response)

function addSnapchatText(item) {
  const txt = prompt("Snapchat text:", "I need to be fucked so bad");
  if (!txt) return;
  const el = createDraggableElement(txt, 24, item);
  el.style.background = "rgba(0,0,0,0.7)";
  el.style.color = "white";
  el.style.padding = "8px 20px";
  el.style.borderRadius = "4px";
  el.style.fontWeight = "bold";
  el.style.textAlign = "center";
  el.style.width = "80%";
}

async function addToAlbum(public_id) {
  const name = prompt("Enter album name:");
  if (!name) return;
  await fetch("/api/albums/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  alert("Added to album!");
}

async function autoDepravedCaption(public_id) {
  const res = await fetch("/api/auto-caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id, gallery: currentGallery })
  });
  const data = await res.json();
  if (data.success) {
    alert("Filthy caption added!");
    await loadMedia();
  }
}
async function showAlbums() {
  const res = await fetch("/api/albums");
  const data = await res.json();
  if (!data.success) return alert("Could not load albums");

  let message = "Current Albums:\n\n";
  if (data.albums && data.albums.length > 0) {
    data.albums.forEach(album => {
      message += `• ${album.name} (${album.items.length} images)\n`;
    });
  } else {
    message += "No albums yet.\n";
  }

  const newName = prompt(message + "\n\nCreate new album (or leave empty to cancel):");
  if (newName && newName.trim()) {
    await fetch("/api/albums/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() })
    });
    alert("Album created!");
  }
}