const feedWrapper = document.getElementById("feed-wrapper");
const backHome = document.getElementById("back-home");
const seenComments = JSON.parse(localStorage.getItem("feed-comments") || "{}");
const seenLikes = JSON.parse(localStorage.getItem("feed-likes") || "{}");

backHome.addEventListener("click", () => {
  window.location.href = "/";
});

let videos = [];

async function loadVideos() {
  const res = await fetch("/media?sort=newest");
  const items = await res.json();
  videos = items.filter(item => item.type === "video");
  renderFeed();
  observeVideos();
}

function renderFeed() {
  feedWrapper.innerHTML = "";
  if (!videos.length) {
    feedWrapper.innerHTML = "<p style='text-align:center;padding:40px;'>No videos uploaded yet.</p>";
    return;
  }

  videos.forEach((item, index) => {
    const card = document.createElement("section");
    card.className = "feed-item";
    card.dataset.publicId = item.public_id;

    card.innerHTML = `
      <video class="feed-video" playsinline muted loop preload="metadata" src="${item.url}"></video>
      <div class="feed-overlay">
        <div class="feed-caption">${escapeHtml(item.caption || "Untitled video")}</div>
        <div class="feed-actions">
          <button class="feed-like">❤️ <span class="like-count">${seenLikes[item.public_id] || item.likes || 0}</span></button>
          <button class="feed-comment">💬 Comment</button>
          <button class="feed-share">↗ Share</button>
        </div>
        <div class="feed-comments" id="comments-${item.public_id}">
          <div class="feed-comments-list" id="list-${item.public_id}">
            ${(seenComments[item.public_id] || []).map(c => `<div class="feed-comment-item">${escapeHtml(c)}</div>`).join("")}
          </div>
          <div class="feed-comment-form">
            <input type="text" placeholder="Write a comment..." />
            <button type="button">Post</button>
          </div>
        </div>
      </div>
    `;

    const video = card.querySelector("video");
    const likeBtn = card.querySelector(".feed-like");
    const commentBtn = card.querySelector(".feed-comment");
    const shareBtn = card.querySelector(".feed-share");
    const commentsBox = card.querySelector(".feed-comments");
    const commentsList = card.querySelector(".feed-comments-list");
    const commentInput = card.querySelector(".feed-comment-form input");
    const postBtn = card.querySelector(".feed-comment-form button");
    const likeCount = card.querySelector(".like-count");

    likeBtn.addEventListener("click", async () => {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id })
      });
      const data = await res.json();
      if (data.success) {
        likeCount.textContent = data.likes;
        seenLikes[item.public_id] = data.likes;
        localStorage.setItem("feed-likes", JSON.stringify(seenLikes));
      }
    });

    commentBtn.addEventListener("click", () => {
      commentsBox.classList.toggle("active");
    });

    postBtn.addEventListener("click", () => {
      const text = commentInput.value.trim();
      if (!text) return;
      const list = seenComments[item.public_id] || [];
      list.push(text);
      seenComments[item.public_id] = list;
      localStorage.setItem("feed-comments", JSON.stringify(seenComments));
      const div = document.createElement("div");
      div.className = "feed-comment-item";
      div.textContent = text;
      commentsList.appendChild(div);
      commentInput.value = "";
    });

    shareBtn.addEventListener("click", async () => {
      const url = item.url;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Video", url });
        } catch {}
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert("Video link copied!");
      }
    });

    feedWrapper.appendChild(card);
  });
}

function observeVideos() {
  const videosEls = document.querySelectorAll(".feed-video");
  const options = {
    root: null,
    rootMargin: "-35% 0px -35% 0px",
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, options);

  videosEls.forEach(video => observer.observe(video));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

loadVideos();