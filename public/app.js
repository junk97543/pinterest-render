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

const videoModal = document.getElementById("video-modal");
const videoModalClose = document.getElementById("video-modal-close");
const videoModalPhone = document.getElementById("video-modal-phone");
const videoModalScroller = document.getElementById("video-modal-scroller");

const phoneOverlay = document.getElementById("phone-overlay");
const phoneFeed = document.getElementById("phone-feed");
const phoneCloseBtn = document.getElementById("phone-close-btn");
const phoneBackBtn = document.getElementById("phone-back-btn");

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
let videoMode = "computer";

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

  tagsTabBtn?.addEventListener("click", () => { tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none"; });
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

  videoFeedBtn.addEventListener("click", async () => {
    await openVideoModal();
  });

  videoModalClose.addEventListener("click", closeVideoModal);
  videoModalPhone.addEventListener("click", async () => {
    videoMode = "phone";
    videoModal.classList.remove("active");
    phoneOverlay.classList.add("active");
    await buildPhoneFeed();
  });

  phoneCloseBtn.addEventListener("click", closePhoneOverlay);
  phoneBackBtn.addEventListener("click", () => {
    phoneOverlay.classList.remove("active");
    videoModal.classList.add("active");
  });

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-content")) closeLightbox();
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeLightbox();
      closeVideoModal();
      closePhoneOverlay();
    }
  });

  lightboxImg.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX - x;
    startY = e.clientY - y;
  });

  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    x = e.clientX - startX;
    y = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener("mouseup", () => { dragging = false; });

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
  if (!mainRotatingLogo) return;
  if (currentGallery !== "family") {
    mainRotatingLogo.removeAttribute("src");
    mainRotatingLogo.style.opacity = "0";
    return;
  }
  const familyImages = items.filter(item => item.type === "image");
  if (!familyImages.length) return;
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

    div.addEventListener("click", () => openLightbox(originalIndex));
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
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}
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

async function openVideoModal() {
  videoModal.classList.add("active");
  videoModalPhone.textContent = "Phone View";
  await buildComputerFeed();
}

function closeVideoModal() {
  videoModal.classList.remove("active");
  videoModalScroller.innerHTML = "";
}

async function buildComputerFeed() {
  videoMode = "computer";
  const res = await fetch(`/media?sort=newest&gallery=${currentGallery}`);
  if (!res.ok) {
    videoModalScroller.innerHTML = "<p style='color:#fff;text-align:center;padding:30px;'>No access to this feed.</p>";
    return;
  }

  const data = await res.json();
  const videos = data.filter(item => item.type === "video");
  videoModalScroller.innerHTML = "";

  if (!videos.length) {
    videoModalScroller.innerHTML = "<p style='color:#fff;text-align:center;padding:30px;'>No videos uploaded yet.</p>";
    return;
  }

  videos.forEach(item => {
    const card = document.createElement("div");
    card.className = "video-feed-card";
    card.innerHTML = `
      <video class="video-feed-player" muted playsinline loop preload="metadata" src="${item.url}"></video>
      <div class="card-actions">
        <button class="card-like">❤️ <span>${item.likes || 0}</span></button>
        <button class="card-comment">💬 Comment</button>
        <button class="card-tag">🏷 Tag</button>
        <button class="card-caption">✏ Caption</button>
        <button class="card-share">↗ Share</button>
      </div>
    `;

    const video = card.querySelector("video");
    const likeBtn = card.querySelector(".card-like");
    const commentBtn = card.querySelector(".card-comment");
    const tagBtn = card.querySelector(".card-tag");
    const captionBtn = card.querySelector(".card-caption");
    const shareBtn = card.querySelector(".card-share");

    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.play().catch(() => {});

    video.addEventListener("click", () => {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });

    likeBtn.addEventListener("click", async () => {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id, gallery: currentGallery })
      });
      const data = await res.json();
      if (data.success) likeBtn.querySelector("span").textContent = data.likes;
    });

    commentBtn.addEventListener("click", () => {
      const note = prompt("Comment here:");
      if (!note) return;
    });

    tagBtn.addEventListener("click", async () => {
      await addTagToItem(item.public_id);
      await buildComputerFeed();
    });

    captionBtn.addEventListener("click", async () => {
      await editCaption(item.public_id);
      await buildComputerFeed();
    });

    shareBtn.addEventListener("click", async () => {
      if (navigator.share) {
        try { await navigator.share({ title: "Video", url: item.url }); } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.url);
        alert("Video link copied!");
      }
    });

    card.addEventListener("click", () => {
      if (!video.paused) video.pause();
    });

    videoModalScroller.appendChild(card);
  });
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

function closePhoneOverlay() {
  phoneOverlay.classList.remove("active");
  phoneFeed.innerHTML = "";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}