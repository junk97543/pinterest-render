document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");
  const uploadInput = document.getElementById("uploadInput");
  const galleryEl = document.getElementById("gallery");
  const statusEl = document.getElementById("status");
  const familyUnlockForm = document.getElementById("familyUnlockForm");
  const familyCodeInput = document.getElementById("familyCodeInput");
  const familyUnlockMessage = document.getElementById("familyUnlockMessage");
  const familyPanel = document.getElementById("familyPanel");
  const appPanel = document.getElementById("appPanel");

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

  function showFamilyMessage(text, ok = false) {
    if (!familyUnlockMessage) return;
    familyUnlockMessage.textContent = text;
    familyUnlockMessage.style.color = ok ? "green" : "red";
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
      if (galleryEl) {
        galleryEl.innerHTML = "";
        items.forEach(item => galleryEl.appendChild(mediaCard(item)));
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to load gallery");
    }
  }

  async function refreshStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      const unlocked = !!data.familyAccess;
      if (familyPanel) familyPanel.style.display = unlocked ? "none" : "block";
      if (appPanel) appPanel.style.display = unlocked ? "block" : "none";
    } catch {}
  }

  if (familyUnlockForm) {
    familyUnlockForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        showFamilyMessage("Checking code...");
        const code = String(familyCodeInput.value || "").trim();
        const data = await api("/api/family-unlock", {
          method: "POST",
          body: JSON.stringify({ code })
        });

        if (data.success) {
          showFamilyMessage("Code accepted", true);
          await refreshStatus();
          await loadMedia();
          return;
        }

        showFamilyMessage("Wrong code");
      } catch (err) {
        showFamilyMessage(err.message || "Wrong code");
      }
    });
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

  refreshStatus();
  loadMedia();
});