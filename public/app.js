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
let mainLogoTimer = null;
let mainLogoIndex = 0;
let lightboxIndex = -1;

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

function startMainLogoRotation() {
  if (mainLogoTimer) clearInterval(mainLogoTimer);
  const familyImages = items.filter(item => item.gallery === "family" && item.type === "image");
  if (!familyImages.length) {
    mainRotatingLogo.removeAttribute("src");
    return;
  }
  const best = [...familyImages].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
  mainRotatingLogo.src = best.url;
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

    const captionLine = document.createElement("div");
    captionLine.className = "caption-inline";
    captionLine.textContent = item.caption ? item.caption : "";
    if (item.caption) div.appendChild(captionLine);

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
    lightboxVideo.play().catch(() => {
      lightboxVideo.muted = true;
      lightboxVideo.play().catch(() => {});
    });
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
  if (e.deltaY > 0) {
    lightboxIndex = (lightboxIndex + 1) % items.length;
  } else {
    lightboxIndex = (lightboxIndex - 1 + items.length) % items.length;
  }
  showLightboxItem(lightboxIndex);
}

function enableAudioOnFirstGesture() {
  if (!lightbox.classList.contains("active")) return;
  if (lightboxVideo && !lightboxVideo.src) return;
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
  const videos = data.filter(item => item.type === "video");
  phoneFeed.innerHTML = "";

  if (!videos.length) {
    phoneFeed.innerHTML = "<div class='phone-item'><div class='phone-overlay-ui'><div class='phone-caption'>No videos uploaded yet.</div></div></div>";
    return;
  }

  videos.forEach(item => {
    const el = document.createElement("section");
    el.className = "phone-item";
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
      try {
        await video.play();
      } catch {
        video.muted = true;
      }
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
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}