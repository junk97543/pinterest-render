const feedRoot = document.getElementById("phone-feed");
const params = new URLSearchParams(location.search);
const gallery = params.get("gallery") || "family";

let currentVideos = [];
let currentIndex = 0;
let currentTagFilter = "";
let observer = null;

async function loadFeed() {
  const res = await fetch(`/media?sort=newest&gallery=${gallery}`);
  if (!res.ok) {
    feedRoot.innerHTML = "<div class='phone-empty'>No access or no videos.</div>";
    return;
  }

  const items = await res.json();
  currentVideos = items.filter(i => i.type === "video");
  renderFeed();
}

function renderFeed() {
  const filtered = currentTagFilter
    ? currentVideos.filter(v => (v.tags || []).some(t => t.toLowerCase() === currentTagFilter.toLowerCase()))
    : currentVideos;

  feedRoot.innerHTML = "";

  if (!filtered.length) {
    feedRoot.innerHTML = "<div class='phone-empty'>No videos found.</div>";
    return;
  }

  filtered.forEach((item, index) => {
    const el = document.createElement("section");
    el.className = "phone-card";
    el.innerHTML = `
      <div class="phone-video-wrap">
        <video class="phone-video" muted playsinline loop preload="metadata" src="${item.url}"></video>
        <div class="phone-overlay">
          <div class="phone-top-row">
            <div class="phone-caption">${escapeHtml(item.caption || "")}</div>
            <div class="phone-tags">
              ${(item.tags || []).map(tag => `<button class="phone-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}
            </div>
          </div>
          <div class="phone-actions">
            <button class="phone-like">❤️ <span>${item.likes || 0}</span></button>
            <button class="phone-comment">💬</button>
            <button class="phone-share">↗</button>
          </div>
          <div class="phone-comments">
            <div class="phone-comments-list"></div>
            <div class="phone-comment-form">
              <input type="text" placeholder="Write a comment..." />
              <button type="button">Post</button>
            </div>
          </div>
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

    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;

    video.addEventListener("click", (e) => {
      if (e.target.closest(".phone-comment-form") || e.target.closest(".phone-comments")) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });

    el.querySelector(".phone-overlay").addEventListener("click", (e) => {
      if (e.target.closest(".phone-comment-form") || e.target.closest(".phone-comments") || e.target.closest(".phone-tag") || e.target.closest("button")) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });

    likeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id, gallery })
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
      const text = commentInput.value.trim();
      if (!text) return;
      const div = document.createElement("div");
      div.className = "phone-comment-item";
      div.textContent = text;
      el.querySelector(".phone-comments-list").appendChild(div);
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

    tagButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        currentTagFilter = btn.dataset.tag;
        renderFeed();
      });
    });

    feedRoot.appendChild(el);

    if (index === 0) currentIndex = 0;
  });

  setupObserver();
  playVisible();
}

function setupObserver() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
  }, { root: null, threshold: 0.6 });

  document.querySelectorAll(".phone-video").forEach(v => observer.observe(v));
}

function playVisible() {
  const videos = document.querySelectorAll(".phone-video");
  if (videos[0]) videos[0].play().catch(() => {});
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

loadFeed();