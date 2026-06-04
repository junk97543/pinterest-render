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
const topLogo = document.getElementById("top-logo");
const favicon = document.getElementById("favicon");
const videoFeedBtn = document.getElementById("video-feed-btn");
const feedModal = document.getElementById("feed-modal");
const feedClose = document.getElementById("feed-close");
const feedScroller = document.getElementById("feed-scroller");
const feedPhoneBtn = document.getElementById("feed-phone-btn");
const feedDesktopBtn = document.getElementById("feed-desktop-btn");
const tagsTabBtn = document.getElementById("tags-tab-btn");
const tagPanel = document.getElementById("tag-panel");
const tagList = document.getElementById("tag-list");
const closeTagPanel = document.getElementById("close-tag-panel");
const clearTagFilter = document.getElementById("clear-tag-filter");

let items = [];
let zoom = 1, x = 0, y = 0, dragging = false, startX = 0, startY = 0;
let isAdmin = false;
let currentSort = 'random';
let currentLayout = 'masonry';
let logoIndex = 0;
let logoTimer = null;
let feedObserver = null;
let feedVideos = [];
let feedMode = 'phone';
let activeTagFilter = '';

checkAdmin();

(async () => {
  await loadMedia();
  loadChat();
  setInterval(loadChat, 3000);
})();

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

sortNewestBtn.addEventListener("click", async () => {
  currentSort = 'newest';
  currentLayout = 'grid';
  sortNewestBtn.classList.add('active');
  sortRandomBtn.classList.remove('active');
  sortPopularBtn.classList.remove('active');
  await loadMedia();
});

sortRandomBtn.addEventListener("click", async () => {
  currentSort = 'random';
  currentLayout = 'masonry';
  sortRandomBtn.classList.add('active');
  sortNewestBtn.classList.remove('active');
  sortPopularBtn.classList.remove('active');
  await loadMedia();
});

sortPopularBtn.addEventListener("click", async () => {
  currentSort = 'popular';
  currentLayout = 'grid';
  sortPopularBtn.classList.add('active');
  sortNewestBtn.classList.remove('active');
  sortRandomBtn.classList.remove('active');
  await loadMedia();
});

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadMedia() {
  const res = await fetch(`/media?sort=${currentSort}`);
  items = await res.json();
  gallery.className = currentLayout === 'grid' ? 'grid-gallery' : 'masonry';
  render();
  renderTags();
  updateLogoRotation();
}

function getFilteredItems() {
  const base = currentSort === 'random' ? shuffleArray(items) : [...items];
  if (!activeTagFilter) return base;
  return base.filter(item => Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase() === activeTagFilter.toLowerCase()));
}

function render() {
  gallery.innerHTML = "";
  const displayItems = getFilteredItems();

  if (!displayItems.length) {
    gallery.innerHTML = "<p>No matching images or videos.</p>";
    return;
  }

  displayItems.forEach((item) => {
    const originalIndex = items.findIndex(i => i.public_id === item.public_id);
    const div = document.createElement("div");
    div.className = "masonry-item";
    div.dataset.index = originalIndex >= 0 ? originalIndex : "0";

    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "Uploaded image";
      div.appendChild(img);
    } else {
      const vid = document.createElement("video");
      vid.src = item.url;
      vid.controls = true;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      div.appendChild(vid);
    }

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "media-tags";
    (item.tags || []).forEach(tag => {
      const chip = document.createElement("button");
      chip.className = "media-tag";
      chip.textContent = `#${tag}`;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveTagFilter(tag);
      });
      tagsWrap.appendChild(chip);
    });
    div.appendChild(tagsWrap);

    const actions = document.createElement("div");
    actions.className = "media-actions";
    if (item.type === "image") {
      const tagBtn = document.createElement("button");
      tagBtn.className = "add-tag-btn";
      tagBtn.textContent = "Add Tag";
      tagBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await addTagToItem(item.public_id);
      });
      actions.appendChild(tagBtn);
    }
    div.appendChild(actions);

    const likeDiv = document.createElement("div");
    likeDiv.className = "like-container";
    likeDiv.innerHTML = `
      <button class="like-btn" data-public-id="${item.public_id}">
        ❤️ <span class="like-count">${item.likes || 0}</span>
      </button>
    `;
    div.appendChild(likeDiv);

    const likeBtn = likeDiv.querySelector(".like-btn");
    likeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const countSpan = likeBtn.querySelector(".like-count");
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id })
      });
      const data = await res.json();
      if (data.success) countSpan.textContent = data.likes;
    });

    div.addEventListener("click", () => {
      const index = Number(div.dataset.index);
      openLightbox(index);
    });

    gallery.appendChild(div);
  });
}

async function addTagToItem(publicId) {
  const tag = prompt("Enter a tag for this image:");
  if (!tag) return;
  const clean = tag.trim();
  if (!clean) return;
  const res = await fetch("/api/tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id: publicId, tag: clean })
  });
  const data = await res.json();
  if (data.success) {
    await loadMedia();
    renderTags();
  } else {
    alert(data.error || "Could not add tag");
  }
}

function setActiveTagFilter(tag) {
  activeTagFilter = tag;
  render();
  renderTags();
  tagPanel.style.display = "block";
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

tagsTabBtn.addEventListener("click", () => {
  tagPanel.style.display = tagPanel.style.display === "none" ? "block" : "none";
});

closeTagPanel.addEventListener("click", () => {
  tagPanel.style.display = "none";
});

clearTagFilter.addEventListener("click", () => {
  activeTagFilter = "";
  render();
  renderTags();
});

chatToggleBtn.addEventListener("click", () => {
  chatSection.style.display = "block";
  chatToggleBtn.style.display = "none";
  chatCloseBtn.style.display = "inline-block";
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
});

chatCloseBtn.addEventListener("click", () => {
  chatSection.style.display = "none";
  chatToggleBtn.style.display = "inline-block";
  chatCloseBtn.style.display = "none";
});

backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  backToTopBtn.style.display = window.scrollY > 300 ? "inline-block" : "none";
});

async function loadChat() {
  const res = await fetch("/api/chat");
  const messages = await res.json();
  renderChat(messages);
}

function renderChat(messages) {
  chatMessages.innerHTML = "";
  messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "chat-message";
    const time = new Date(msg.timestamp).toLocaleTimeString();
    div.innerHTML = `<strong>${escapeHtml(msg.name)}</strong> <small>(${time})</small>: ${escapeHtml(msg.message)}`;
    chatMessages.appendChild(div);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendChat.addEventListener("click", async () => {
  const name = chatName.value.trim();
  const message = chatMessage.value.trim();
  if (!name || !message) {
    alert("Please enter your name and a message");
    return;
  }

  await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, message })
  });

  chatMessage.value = "";
  loadChat();
});

chatMessage.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChat.click();
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const fd = new FormData();
  files.forEach(f => fd.append("files", f));

  const btn = document.querySelector(".upload-btn");
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    const res = await fetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) {
      await loadMedia();
      isAdmin = data.isAdmin || isAdmin;
      updateAdminUI();
    } else {
      alert(data.error || "Upload failed");
    }
  } catch {
    alert("Upload error");
  } finally {
    btn.textContent = "Upload Photos & Videos";
    btn.disabled = false;
    fileInput.value = "";
  }
});

deleteAllBtn.addEventListener("click", async () => {
  if (!isAdmin) {
    alert("Admin only!");
    return;
  }
  if (!confirm("Delete ALL tagged photos and videos from Cloudinary? This cannot be undone!")) return;

  const res = await fetch("/delete-all", { method: "POST" });
  const data = await res.json();

  if (data.success) {
    alert("All tagged images deleted.");
    await loadMedia();
    closeLightbox();
  } else {
    alert("Delete failed: " + (data.error || "Unknown error"));
  }
});

videoFeedBtn.addEventListener("click", async () => {
  feedModal.classList.add("active");
  setFeedMode(feedMode);
  await buildFeed();
  setupFeedObserver();
});

feedClose.addEventListener("click", () => {
  closeFeed();
});

feedModal.addEventListener("click", (e) => {
  if (e.target === feedModal) closeFeed();
});

feedPhoneBtn.addEventListener("click", async () => {
  setFeedMode('phone');
  await buildFeed();
  setupFeedObserver();
});

feedDesktopBtn.addEventListener("click", async () => {
  setFeedMode('desktop');
  await buildFeed();
  setupFeedObserver();
});

function setFeedMode(mode) {
  feedMode = mode;
  feedPhoneBtn.classList.toggle("active", mode === "phone");
  feedDesktopBtn.classList.toggle("active", mode === "desktop");
}

function closeFeed() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }
  feedVideos.forEach(v => {
    v.pause();
    v.currentTime = 0;
  });
  feedModal.classList.remove("active");
}

async function buildFeed() {
  const res = await fetch("/media?sort=newest");
  const all = await res.json();
  const videos = all.filter(item => item.type === "video");
  feedScroller.innerHTML = "";

  if (!videos.length) {
    feedScroller.innerHTML = "<p style='text-align:center;padding:40px;color:#fff;'>No videos uploaded yet.</p>";
    return;
  }

  videos.forEach(item => {
    const card = document.createElement("section");
    card.className = "feed-item";
    card.innerHTML = `
      <div class="feed-video-shell ${feedMode}">
        <video class="feed-video" playsinline muted preload="metadata" loop src="${item.url}"></video>
        <div class="feed-overlay">
          <div class="feed-caption">${escapeHtml(item.caption || "Untitled video")}</div>
          <div class="feed-actions">
            <button class="feed-like">❤️ <span class="like-count">${item.likes || 0}</span></button>
            <button class="feed-comment">💬 Comment</button>
            <button class="feed-share">↗ Share</button>
          </div>
          <div class="feed-comments">
            <div class="feed-comments-list"></div>
            <div class="feed-comment-form">
              <input type="text" placeholder="Write a comment..." />
              <button type="button">Post</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const video = card.querySelector(".feed-video");
    const likeBtn = card.querySelector(".feed-like");
    const commentBtn = card.querySelector(".feed-comment");
    const shareBtn = card.querySelector(".feed-share");
    const commentsBox = card.querySelector(".feed-comments");
    const commentsList = card.querySelector(".feed-comments-list");
    const commentInput = card.querySelector(".feed-comment-form input");
    const postBtn = card.querySelector(".feed-comment-form button");
    const likeCount = card.querySelector(".like-count");

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.loop = true;

    likeBtn.addEventListener("click", async () => {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id })
      });
      const data = await res.json();
      if (data.success) likeCount.textContent = data.likes;
    });

    commentBtn.addEventListener("click", () => {
      commentsBox.classList.toggle("active");
    });

    postBtn.addEventListener("click", () => {
      const text = commentInput.value.trim();
      if (!text) return;
      const div = document.createElement("div");
      div.className = "feed-comment-item";
      div.textContent = text;
      commentsList.appendChild(div);
      commentInput.value = "";
    });

    shareBtn.addEventListener("click", async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: "Video", url: item.url });
        } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.url);
        alert("Video link copied!");
      }
    });

    feedScroller.appendChild(card);
  });

  feedVideos = Array.from(document.querySelectorAll(".feed-video"));
  feedVideos.forEach(v => {
    v.pause();
    v.currentTime = 0;
  });

  if (feedVideos[0]) {
    try {
      await feedVideos[0].play();
    } catch {}
  }
}

function setupFeedObserver() {
  if (feedObserver) feedObserver.disconnect();

  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.muted = true;
        video.playsInline = true;
        const playPromise = video.play();
        if (playPromise && playPromise.catch) playPromise.catch(() => {});
      } else {
        video.pause();
      }
    });
  }, {
    root: feedScroller,
    rootMargin: "-30% 0px -30% 0px",
    threshold: 0.35
  });

  feedVideos.forEach(video => feedObserver.observe(video));
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
    lightboxVideo.removeAttribute("src");
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

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", e => {
  if (e.target === lightbox || e.target.classList.contains("lightbox-content")) closeLightbox();
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeLightbox();
    closeFeed();
  }
});

lightboxImg.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  dragging = true;
  startX = e.clientX - x;
  startY = e.clientY - y;
  lightboxImg.style.cursor = "grabbing";
});

window.addEventListener("mousemove", e => {
  if (!dragging) return;
  e.preventDefault();
  x = e.clientX - startX;
  y = e.clientY - startY;
  updateTransform();
});

window.addEventListener("mouseup", () => {
  dragging = false;
  lightboxImg.style.cursor = "zoom-in";
});

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

function updateTransform() {
  lightboxImg.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
}

function updateLogoRotation() {
  const onlyImages = items.filter(item => item.type === "image");
  if (onlyImages.length) {
    logoIndex = (logoIndex + 1) % onlyImages.length;
    const url = onlyImages[logoIndex].url;
    topLogo.src = url;
    favicon.href = url;
  }
  if (logoTimer) clearInterval(logoTimer);
  if (onlyImages.length) {
    logoTimer = setInterval(() => {
      logoIndex = (logoIndex + 1) % onlyImages.length;
      const url = onlyImages[logoIndex].url;
      topLogo.src = url;
      favicon.href = url;
    }, 5000);
  }
}