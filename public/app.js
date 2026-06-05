document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");
  const uploadInput = document.getElementById("uploadInput");
  const galleryEl = document.getElementById("gallery");
  const statusEl = document.getElementById("status");
  const runButton = document.getElementById("runButton");

  let currentGallery = "family";

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data = {};
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return data;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function mediaCard(item) {
    const wrap = document.createElement("div");
    wrap.className = "media-card";
    wrap.dataset.id = item.public_id;

    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.caption || "Gallery image";

    const cap = document.createElement("div");
    cap.className = "caption";
    cap.textContent = item.caption || "";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.likes || 0} likes`;

    const btnRow = document.createElement("div");
    btnRow.className = "button-row";

    const likeBtn = document.createElement("button");
    likeBtn.textContent = "Like";
    likeBtn.onclick = async () => {
      await api("/api/like", {
        method: "POST",
        body: JSON.stringify({ public_id: item.public_id })
      });
      loadMedia();
    };

    const runBtn = document.createElement("button");
    runBtn.textContent = "Run ComfyDeploy";
    runBtn.disabled = item.gallery !== "private";
    runBtn.onclick = async () => {
      try {
        setStatus("Running ComfyDeploy...");
        const result = await api("/api/run-comfy", {
          method: "POST",
          body: JSON.stringify({
            public_id: item.public_id,
            gallery: item.gallery
          })
        });
        setStatus("Done");
        await loadMedia();
        console.log(result);
      } catch (err) {
        console.error(err);
        setStatus(err.message);
      }
    };

    btnRow.appendChild(likeBtn);
    btnRow.appendChild(runBtn);

    wrap.appendChild(img);
    wrap.appendChild(cap);
    wrap.appendChild(meta);
    wrap.appendChild(btnRow);
    return wrap;
  }

  async function loadMedia() {
    try {
      const res = await fetch(`/media?gallery=${encodeURIComponent(currentGallery)}&sort=newest`);
      const items = await res.json();
      galleryEl.innerHTML = "";
      items.forEach(item => galleryEl.appendChild(mediaCard(item)));
    } catch (err) {
      console.error(err);
      setStatus("Failed to load gallery");
    }
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const files = uploadInput.files;
      if (!files || !files.length) return;

      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      formData.append("gallery", currentGallery);

      try {
        setStatus("Uploading...");
        const res = await fetch("/upload", {
          method: "POST",
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        uploadInput.value = "";
        setStatus(`Uploaded ${data.count} file(s)`);
        await loadMedia();
      } catch (err) {
        console.error(err);
        setStatus(err.message);
      }
    });
  }

  loadMedia();
});