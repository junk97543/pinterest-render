const feedScroller = document.getElementById("feed-scroller");
const feedClose = document.getElementById("feed-close");
const feedPhoneBtn = document.getElementById("feed-phone-btn");
const feedDesktopBtn = document.getElementById("feed-desktop-btn");

let feedObserver = null;
let feedVideos = [];
let feedMode = "phone";

feedClose.addEventListener("click", () => window.close());

feedPhoneBtn.addEventListener("click", async () => {
  setFeedMode("phone");
  await buildFeed();
  setupFeedObserver();
});

feedDesktopBtn.addEventListener("click", async () => {
  setFeedMode("desktop");
  await buildFeed();
  setupFeedObserver();
});

function setFeedMode(mode) {
  feedMode = mode;
  feedPhoneBtn.classList.toggle("active", mode === "phone");
  feedDesktopBtn.classList.toggle("active", mode === "desktop");
}

async function buildFeed() {
  const res = await fetch("/media?sort=newest&gallery=family");
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
        body: JSON.stringify({ public_id: item.public_id, gallery: "family" })
      });
      const data = await res.json();
      if (data.success) likeCount.textContent = data.likes;
    });

    commentBtn.addEventListener("click", () => commentsBox.classList.toggle("active"));

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
        try { await navigator.share({ title: "Video", url: item.url }); } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.url);
        alert("Video link copied!");
      }
    });

    feedScroller.appendChild(card);
  });

  feedVideos = Array.from(document.querySelectorAll(".feed-video"));
  if (feedVideos[0]) {
    try { await feedVideos[0].play(); } catch {}
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

buildFeed().then(setupFeedObserver);