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
let currentTierListName = "My Tier List";
let activeOverlay = null;

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

    const albumsBtn = document.createElement("button");
    albumsBtn.textContent = "📁 Albums";
    albumsBtn.className = "feed-btn";
    albumsBtn.addEventListener("click", showAlbums);
    mainHeader.appendChild(albumsBtn);

    const tierListBtn = document.createElement("button");
    tierListBtn.textContent = "📊 Tier Lists";
    tierListBtn.className = "feed-btn";
    tierListBtn.addEventListener("click", openTierListViewer);
    mainHeader.appendChild(tierListBtn);

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
            closeAnyModal();
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
            const imgContainer = document.createElement("div");
            imgContainer.className = "img-container";  
            imgContainer.style.position = "relative";
            imgContainer.style.width = "100%";
            imgContainer.style.height = "auto";
            
            const img = document.createElement("img");
            img.src = item.url;
            img.style.width = "100%";
            img.style.height = "auto";
            img.style.display = "block";
            imgContainer.appendChild(img);

            if (item.overlays && item.overlays.length) {
                const rect = img.getBoundingClientRect();
                item.overlays.forEach(ov => {
                    if (ov.type === "text") {
                        const overlay = document.createElement("div");
                        overlay.style.position = "absolute";
                        overlay.style.top = ov.top;
                        overlay.style.left = ov.left;
                        overlay.style.fontSize = ov.fontSize || "32px";
                        overlay.style.color = ov.color || "#ff0000";
                        overlay.style.zIndex = "2";
                        overlay.style.userSelect = "none";
                        overlay.style.pointerEvents = "none";
                        overlay.style.opacity = ov.opacity || "1";
                        overlay.textContent = ov.content;
                        imgContainer.appendChild(overlay);
                    } else if (ov.type === "emoji") {
                        const overlay = document.createElement("div");
                        overlay.style.position = "absolute";
                        overlay.style.top = ov.top;
                        overlay.style.left = ov.left;
                        overlay.style.fontSize = ov.fontSize || "42px";
                        overlay.style.zIndex = "2";
                        overlay.style.userSelect = "none";
                        overlay.style.pointerEvents = "none";
                        overlay.style.opacity = ov.opacity || "0.9";
                        overlay.textContent = ov.content;
                        imgContainer.appendChild(overlay);
                    } else if (ov.type === "snapchat") {
                        const overlay = document.createElement("div");
                        overlay.style.position = "absolute";
                        overlay.style.top = ov.top;
                        overlay.style.left = "0";
                        overlay.style.width = "100%";
                        overlay.style.background = ov.background || "rgba(0,0,0,0.45)";
                        overlay.style.padding = ov.padding || "12px 20px";
                        overlay.style.textAlign = "center";
                        overlay.style.zIndex = "2";
                        overlay.style.pointerEvents = "none";
                        overlay.style.opacity = ov.opacity || "1";
                        
                        const textSpan = document.createElement("span");
                        textSpan.style.color = ov.color || "#fff";
                        textSpan.style.fontSize = ov.fontSize || "26px";
                        textSpan.style.fontWeight = "bold";
                        textSpan.textContent = ov.content;
                        overlay.appendChild(textSpan);
                        imgContainer.appendChild(overlay);
                    } else if (ov.type === "speech") {
                        const overlay = document.createElement("div");
                        overlay.style.position = "absolute";
                        overlay.style.top = ov.top;
                        overlay.style.left = ov.left;
                        overlay.style.fontSize = ov.fontSize || "18px";
                        overlay.style.color = ov.color || "#000";
                        overlay.style.background = ov.background || "rgba(255,255,255,0.95)";
                        overlay.style.padding = ov.padding || "12px 18px";
                        overlay.style.borderRadius = ov.borderRadius || "20px";
                        overlay.style.maxWidth = ov.maxWidth || "260px";
                        overlay.style.zIndex = "2";
                        overlay.style.userSelect = "none";
                        overlay.style.pointerEvents = "none";
                        overlay.style.opacity = ov.opacity || "1";
                        overlay.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
                        overlay.textContent = ov.content;
                        imgContainer.appendChild(overlay);
                    }
                });
            }

            div.appendChild(imgContainer);
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
        tagBtn.addEventListener("click", e => { e.stopPropagation(); addTagToItem(item.public_id); });
        actions.appendChild(tagBtn);

        if (isAdmin) {
            const capBtn = document.createElement("button");
            capBtn.className = "add-tag-btn";
            capBtn.textContent = "Edit Caption";
            capBtn.addEventListener("click", e => { e.stopPropagation(); editCaption(item.public_id); });
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
            }
        });

        div.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON" || e.target.closest("button") || e.target.closest(".media-tag")) {
                return;
            }
            openLightbox(originalIndex);
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

    document.querySelectorAll("#rating-panel, #toolbox-panel, #sliders-panel, .lightbox-overlay, #emoji-picker, #tier-list-modal, #tier-viewer-modal, #album-viewer-modal").forEach(el => el.remove());

    if (isAdmin && currentGallery === "private") {
        createRatingPanel(item, index);
        createToolbox(item);
        loadSavedOverlays(item);
    }

    if (item.overlays && item.overlays.length) {
        item.overlays.forEach(ov => {
            createOverlayElement(ov, item);
        });
    }

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
}

function closeLightbox() {
    lightbox.classList.remove("active");
    lightboxImg.src = "";
    lightboxVideo.pause();
    lightboxVideo.src = "";
    lightboxCaption.classList.remove("show");
    lightboxCaption.textContent = "";
    document.querySelectorAll("#rating-panel, #toolbox-panel, #sliders-panel, #emoji-picker, #tier-list-modal, #tier-viewer-modal, #album-viewer-modal").forEach(el => el.remove());
    activeOverlay = null;
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

function closeAnyModal() {
    document.querySelectorAll("#tier-list-modal, #tier-viewer-modal, #album-viewer-modal").forEach(el => el.remove());
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
    panel.style = `position:absolute; top:20px; left:20px; width:420px; background:rgba(0,0,0,0.95); border-radius:16px; color:#fff; z-index:1002; max-height:85vh; overflow-y:auto;`;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">
            <h3 style="color:#ff5a5f; margin:0;">Rate This Image</h3>
            <button id="collapse-rating-btn" style="background:#666; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer;">−</button>
        </div>
        <div id="rating-content">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:14px;">
                <div>
                    <label>chest:</label><br>
                    <select id="r-chest" style="width:100%;padding:8px;margin:4px 0;">
                        <option value="flat">Flat / veryflat</option>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="big">Big</option>
                        <option value="huge" selected>huge / Massive</option>
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

                <div><label>loveability (0-10)</label><br><input type="number" id="r-fuck" step="0.1" min="0" max="10" value="${item.ratings?.loveability || 7.5}" style="width:100%;padding:8px;"></div>
                <div><label>Cuteness (0-10)</label><br><input type="number" id="r-cute" step="0.1" min="0" max="10" value="${item.ratings?.cuteness || 7}" style="width:100%;padding:8px;"></div>
                <div><label>Beauty (0-10)</label><br><input type="number" id="r-beauty" step="0.1" min="0" max="10" value="${item.ratings?.beauty || 7}" style="width:100%;padding:8px;"></div>
                <div><label>Hotness (0-10)</label><br><input type="number" id="r-hot" step="0.1" min="0" max="10" value="${item.ratings?.hotness || 8}" style="width:100%;padding:8px;"></div>
                <div><label>funness (0-10)</label><br><input type="number" id="r-fun" step="0.1" min="0" max="10" value="${item.ratings?.funness || 6}" style="width:100%;padding:8px;"></div>
                <div><label>Submissiveness (0-10)</label><br><input type="number" id="r-sub" step="0.1" min="0" max="10" value="${item.ratings?.submissiveness || 5}" style="width:100%;padding:8px;"></div>
            </div>

            <button id="save-rating-btn" style="margin-top:15px;width:100%;padding:12px;background:#e60023;border:none;color:white;font-weight:bold;border-radius:8px;">💾 Save Ratings & Tags</button>
            <button id="add-emoji-btn" style="margin-top:8px;width:100%;padding:10px;background:#ff1493;border:none;color:white;font-weight:bold;border-radius:8px;">😈 Add Emoji</button>
            <button id="delete-item-btn" style="margin-top:8px;width:100%;padding:10px;background:#333;border:none;color:white;font-weight:bold;border-radius:8px;">🗑️ Delete This Image</button>
        </div>
    `;

    document.querySelector(".lightbox-content").appendChild(panel);

    let isCollapsed = false;
    panel.querySelector("#collapse-rating-btn").addEventListener("click", () => {
        const content = panel.querySelector("#rating-content");
        const btn = panel.querySelector("#collapse-rating-btn");
        if (isCollapsed) {
            content.style.display = "block";
            btn.textContent = "−";
        } else {
            content.style.display = "none";
            btn.textContent = "+";
        }
        isCollapsed = !isCollapsed;
    });

    panel.querySelector("#save-rating-btn").addEventListener("click", saveRatings);
    panel.querySelector("#add-emoji-btn").addEventListener("click", () => showEmojiPickerWithMove(item));
    panel.querySelector("#delete-item-btn").addEventListener("click", () => deleteSingleItem(item.public_id));
}

async function saveRatings() {
    const ratings = {
        chest: document.getElementById("r-chest").value,
        bodyShape: document.getElementById("r-body").value,
        build: document.getElementById("r-build").value,
        loveability: parseFloat(document.getElementById("r-fuck").value),
        cuteness: parseFloat(document.getElementById("r-cute").value),
        beauty: parseFloat(document.getElementById("r-beauty").value),
        hotness: parseFloat(document.getElementById("r-hot").value),
        funness: parseFloat(document.getElementById("r-fun").value),
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

function showEmojiPickerWithMove(item) {
    const existingPicker = document.getElementById("emoji-picker");
    if (existingPicker) {
        existingPicker.remove();
        return;
    }
    
    const emojis = ["🍆", "💦", "😈", "🍑", "🔥", "🥵", "💋", "🍼", "😩", "🤤", "👅", "🍒"];
    
    const picker = document.createElement("div");
    picker.id = "emoji-picker";
    picker.style = `position:absolute; top:20px; right:20px; background:rgba(0,0,0,0.95); padding:15px; border-radius:12px; z-index:1003; display:flex; flex-wrap:wrap; gap:8px; width:280px;`;

    emojis.forEach(emo => {
        const btn = document.createElement("button");
        btn.textContent = emo;
        btn.style = "font-size:42px; background:none; border:none; cursor:pointer; padding:8px;";
        btn.addEventListener("click", () => addEmojiToImageWithMove(emo, item));
        picker.appendChild(btn);
    });
    
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Close";
    closeBtn.style = "width:100%; padding:8px; margin-top:10px; background:#666; border:none; color:white; border-radius:6px;";
    closeBtn.addEventListener("click", () => picker.remove());
    picker.appendChild(closeBtn);

    document.querySelector(".lightbox-content").appendChild(picker);
}

function addEmojiToImageWithMove(emoji, item) {
    if (!item.overlays) item.overlays = [];
    
    const lightboxContent = document.querySelector(".lightbox-content");
    if (!lightboxContent) return;
    
    const rect = lightboxContent.getBoundingClientRect();
    
    const overlay = {
        type: "emoji",
        content: emoji,
        top: (rect.height / 2) + "px",
        left: (rect.width / 2) + "px",
        fontSize: "48px",
        opacity: "0.9"
    };
    
    item.overlays.push(overlay);

    createOverlayElement(overlay, item);
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

function createToolbox(item) {
    const panel = document.createElement("div");
    panel.id = "toolbox-panel";
    panel.style = `position:absolute; top:20px; right:20px; width:280px; background:rgba(0,0,0,0.95); border-radius:16px; color:#fff; z-index:1002;`;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;">
            <h3 style="color:#ff5a5f; margin:0;">🛠️ Toolbox</h3>
            <button id="collapse-toolbox-btn" style="background:#666; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer;">−</button>
        </div>
        <div id="toolbox-content">
            <button id="add-tattoo-btn" style="width:100%;padding:10px;margin:5px 0;background:#ff6b35;border:none;color:white;font-weight:bold;border-radius:8px;">📝 Tattoo Text</button>
            <button id="add-snapchat-btn" style="width:100%;padding:10px;margin:5px 0;background:#fffc00;color:black;border:none;font-weight:bold;border-radius:8px;">📱 Snapchat Text</button>
            <button id="add-speech-btn" style="width:100%;padding:10px;margin:5px 0;background:#ffffff;border:none;color:black;font-weight:bold;border-radius:8px;">💬 Speech Bubble</button>
            <button id="add-tier-btn" style="width:100%;padding:10px;margin:5px 0;background:#4CAF50;border:none;color:white;font-weight:bold;border-radius:8px;">📊 Add to Tier List</button>
            <button id="add-to-album-btn" style="width:100%;padding:10px;margin:5px 0;background:#2196F3;border:none;color:white;font-weight:bold;border-radius:8px;">📁 Add to Album</button>
            <button id="auto-caption-btn" style="width:100%;padding:10px;margin:5px 0;background:#9C27B0;border:none;color:white;font-weight:bold;border-radius:8px;">✨ Auto Caption</button>
            <button id="remove-all-overlays-btn" style="width:100%;padding:10px;margin:5px 0;background:#f44336;border:none;color:white;font-weight:bold;border-radius:8px;">🗑️ Remove All Overlays</button>
            <button id="save-overlays-btn" style="width:100%;padding:10px;margin:5px 0;background:#e60023;border:none;color:white;font-weight:bold;border-radius:8px;">💾 Save Overlays</button>
        </div>
    `;

    document.querySelector(".lightbox-content").appendChild(panel);

    let isCollapsed = false;
    panel.querySelector("#collapse-toolbox-btn").addEventListener("click", () => {
        const content = panel.querySelector("#toolbox-content");
        const btn = panel.querySelector("#collapse-toolbox-btn");
        if (isCollapsed) {
            content.style.display = "block";
            btn.textContent = "−";
        } else {
            content.style.display = "none";
            btn.textContent = "+";
        }
        isCollapsed = !isCollapsed;
    });

    panel.querySelector("#add-tattoo-btn").addEventListener("click", () => addDraggableTextNoBox(item));
    panel.querySelector("#add-snapchat-btn").addEventListener("click", () => addSnapchatText(item));
    panel.querySelector("#add-speech-btn").addEventListener("click", () => addSpeechBubbleWithSlider(item));
    panel.querySelector("#add-tier-btn").addEventListener("click", () => openTierListMaker(item));
    panel.querySelector("#add-to-album-btn").addEventListener("click", () => addToAlbum(item));
    panel.querySelector("#auto-caption-btn").addEventListener("click", () => autoCaption(item));
    panel.querySelector("#remove-all-overlays-btn").addEventListener("click", () => removeAllOverlays(item));
    panel.querySelector("#save-overlays-btn").addEventListener("click", () => saveOverlaysToDB(item));
}

function createOverlayElement(ov, item) {
    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    const lightboxContent = document.querySelector(".lightbox-content");
          if (!lightboxContent) return;
    
          const rect = lightboxContent.getBoundingClientRect();
    overlay.style.position = "absolute";
    overlay.style.zIndex = "1003";
    overlay.style.userSelect = "none";
    overlay.style.cursor = "move";
    overlay.style.pointerEvents = "auto";
    
    overlay.style.top = (rect.height * ov.topPercent / 100) + "px";
    overlay.style.left = (rect.width * ov.leftPercent / 100) + "px";
    overlay.style.fontSize = ov.fontSize || "32px";
    overlay.style.color = ov.color || "#ff0000";
    overlay.style.opacity = ov.opacity || "1";

    if (ov.type === "text") {
        overlay.textContent = ov.content;
        overlay.style.background = "none";
    } else if (ov.type === "emoji") {
        overlay.textContent = ov.content;
    } else if (ov.type === "snapchat") {
        overlay.style.width = "100%";
        overlay.style.background = ov.background || "rgba(0,0,0,0.45)";
        overlay.style.padding = ov.padding || "12px 20px";
        overlay.style.textAlign = "center";

        const textSpan = document.createElement("span");
        textSpan.style.color = ov.color || "#fff";
        textSpan.style.fontSize = ov.fontSize || "26px";
        textSpan.style.fontWeight = "bold";
        textSpan.textContent = ov.content;
        overlay.appendChild(textSpan);
    } else if (ov.type === "speech") {
        overlay.textContent = ov.content;
        overlay.style.background = ov.background || "rgba(255,255,255,0.95)";
        overlay.style.padding = ov.padding || "12px 18px";
        overlay.style.borderRadius = ov.borderRadius || "20px";
        overlay.style.maxWidth = ov.maxWidth || "260px";
        overlay.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    }

    document.querySelector(".lightbox-content").appendChild(overlay);
    makeDraggable(overlay, item, ov);
    return overlay;
}

function makeDraggable(el, item, ov) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    el.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = el.offsetLeft;
        startTop = el.offsetTop;
        el.style.cursor = "grabbing";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = (startLeft + dx) + "px";
        el.style.top = (startTop + dy) + "px";
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            el.style.cursor = "move";
        }
    });
}

async function saveOverlaysToDB(item) {
    const overlays = item.overlays || [];

    const res = await fetch("/api/overlay/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            public_id: item.public_id, 
            gallery: currentGallery,
            overlays 
        })
    });

    const data = await res.json();
    if (data.success) {
        alert("✅ Overlays saved! They will show on gallery images.");
    } else {
        alert("Failed to save overlays");
    }
}

function loadSavedOverlays(item) {
    if (!item.overlays || !item.overlays.length) return;
    
    document.querySelectorAll(".lightbox-overlay").forEach(el => el.remove());
    
    item.overlays.forEach(ov => {
        createOverlayElement(ov, item);
    });
}

function addDraggableTextNoBox(item) {
    const txt = prompt("Tattoo text:", "text");
    if (!txt) return;

    const lightboxContent = document.querySelector(".lightbox-content");
    if (!lightboxContent) return;
    
    const rect = lightboxContent.getBoundingClientRect();
    
    const overlay = {
        type: "text",
        content: txt,
        top: (rect.height / 2) + "px",
        left: (rect.width / 2) + "px",
        fontSize: "32px",
        color: "#ff0000",
        opacity: "1"
    };
    
    if (!item.overlays) item.overlays = [];
    item.overlays.push(overlay);

    const el = createOverlayElement(overlay, item);
    addSlidersToOverlay(overlay, item, el);
}

function addSnapchatText(item) {
    const txt = prompt("Snapchat text:", "text");
    if (!txt) return;

    const lightboxContent = document.querySelector(".lightbox-content");
    if (!lightboxContent) return;
    
    const rect = lightboxContent.getBoundingClientRect();
    
    const overlay = {
        type: "snapchat",
        content: txt,
        top: (rect.height * 0.7) + "px",
        left: (rect.width / 2) + "px",
        fontSize: "26px",
        color: "#fff",
        background: "rgba(0,0,0,0.45)",
        padding: "12px 20px",
        opacity: "1"
    };

    if (!item.overlays) item.overlays = [];
    item.overlays.push(overlay);

    const el = createOverlayElement(overlay, item);
    addSlidersToOverlay(overlay, item, el);
}

function addSpeechBubbleWithSlider(item) {
    const txt = prompt("What does she say?", "text");
    if (!txt) return;

    const lightboxContent = document.querySelector(".lightbox-content");
    if (!lightboxContent) return;
    
    const rect = lightboxContent.getBoundingClientRect();
    
    const overlay = {
        type: "speech",
        content: txt,
        top: (rect.height * 0.3) + "px",
        left: (rect.width / 2) + "px",
        fontSize: "18px",
        color: "#000",
        background: "rgba(255,255,255,0.95)",
        padding: "12px 18px",
        borderRadius: "20px",
        maxWidth: "260px",
        opacity: "1"
    };

    if (!item.overlays) item.overlays = [];
    item.overlays.push(overlay);

    const el = createOverlayElement(overlay, item);
    addSlidersToOverlay(overlay, item, el);
}

function addSlidersToOverlay(overlay, item, overlayEl) {
    const sliderPanel = document.createElement("div");
    sliderPanel.id = "sliders-panel";
    sliderPanel.style = `position:absolute; top:20px; left:20px; width:200px; background:rgba(0,0,0,0.95); border-radius:12px; color:#fff; z-index:1004; padding:15px;`;
    
    sliderPanel.innerHTML = `
        <div style="margin-bottom:10px;">
            <label style="display:block; margin-bottom:5px;">Size: <span id="size-value">${overlay.fontSize || "32px"}</span></label>
            <input type="range" id="size-slider" min="12" max="72" value="${parseInt(overlay.fontSize) || 32}" style="width:100%;">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block; margin-bottom:5px;">Transparency: <span id="opacity-value">${(parseFloat(overlay.opacity) || 1).toFixed(1)}</span></label>
            <input type="range" id="opacity-slider" min="0" max="1" step="0.1" value="${overlay.opacity || 1}" style="width:100%;">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block; margin-bottom:5px;">Color</label>
            <input type="color" id="color-picker" value="${overlay.color || '#ff0000'}" style="width:100%;">
        </div>
        <button id="save-sliders-btn" style="width:100%; padding:8px; background:#e60023; border:none; color:white; border-radius:6px; margin-top:10px;">💾 Save Changes</button>
        <button id="close-sliders-btn" style="width:100%; padding:8px; background:#666; border:none; color:white; border-radius:6px; margin-top:5px;">Close</button>
    `;
    
    document.querySelector(".lightbox-content").appendChild(sliderPanel);
    
    const sizeSlider = sliderPanel.querySelector("#size-slider");
    const opacitySlider = sliderPanel.querySelector("#opacity-slider");
    const colorPicker = sliderPanel.querySelector("#color-picker");
    const sizeValue = sliderPanel.querySelector("#size-value");
    const opacityValue = sliderPanel.querySelector("#opacity-value");
    
    sizeSlider.addEventListener("input", () => {
        const size = sizeSlider.value + "px";
        overlay.fontSize = size;
        sizeValue.textContent = size;
        overlayEl.style.fontSize = size;
    });
    
    opacitySlider.addEventListener("input", () => {
        const opacity = opacitySlider.value;
        overlay.opacity = opacity;
        opacityValue.textContent = opacity;
        overlayEl.style.opacity = opacity;
    });
    
    colorPicker.addEventListener("input", () => {
        const color = colorPicker.value;
        overlay.color = color;
        overlayEl.style.color = color;
        if (overlay.type === "snapchat") {
            const span = overlayEl.querySelector("span");
            if (span) span.style.color = color;
        }
    });
    
    sliderPanel.querySelector("#save-sliders-btn").addEventListener("click", () => {
        saveOverlaysToDB(item);
        alert("✅ Sliders saved!");
    });
    
    sliderPanel.querySelector("#close-sliders-btn").addEventListener("click", () => sliderPanel.remove());
}

function removeAllOverlays(item) {
    if (!item.overlays || !item.overlays.length) {
        alert("No overlays to remove");
        return;
    }
    
    if (!confirm("Remove ALL overlays from this image? This cannot be undone.")) return;
    
    item.overlays = [];
    document.querySelectorAll(".lightbox-overlay").forEach(el => el.remove());
    document.querySelectorAll("#rating-panel, #toolbox-panel, #sliders-panel, #emoji-picker").forEach(el => el.remove());
    
    saveOverlaysToDB(item);
}

function autoCaption(item) {
    const captions = [
        "text 1", "text 2", "text 3", "text 4", "text 5",
        "text 6", "text 7", "text 8", "text 9", "text 10",
        "text 11", "text 12", "text 13", "text 14", "text 15",
        "text 16", "text 17", "text 18", "text 19", "text 20"
    ];
    
    const caption = captions[Math.floor(Math.random() * captions.length)];
    item.caption = caption;

    fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: item.public_id, caption: caption, gallery: currentGallery })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            alert(`✅ Auto caption: ${caption}`);
            loadMedia();
        }
    });
}

function openTierListMaker(currentItem) {
    const existing = document.getElementById("tier-list-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "tier-list-modal";
    modal.style = `position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:10001; display:flex; align-items:center; justify-content:center;`;

    modal.innerHTML = `
        <div style="background:#111; padding:20px; border-radius:12px; width:90%; max-width:700px; color:white; max-height:85vh; overflow-y:auto;">
            <h2 style="text-align:center; margin-bottom:15px;">📊 Tier List Maker</h2>
            <div style="margin-bottom:15px;">
                <p style="font-size:13px; color:#aaa;">Drag this image into any tier below:</p>
                <div style="display:flex; justify-content:center; gap:10px; margin:10px 0;">
                    <img src="${currentItem.url}" style="width:100px; height:100px; object-fit:cover; border:3px solid #ff5a5f; border-radius:8px; cursor:grab;" id="tier-drag-image">
                </div>
            </div>
            <div style="background:#222; padding:15px; border-radius:8px;">
                <div style="display:grid; grid-template-columns:80px 1fr; gap:10px; margin-bottom:8px;">
                    <div style="background:#4CAF50; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px;">S</div>
                    <div class="tier-drop-zone" data-tier="S" style="background:#333; min-height:60px; border-radius:4px; padding:5px; display:flex; gap:5px; flex-wrap:wrap;"></div>
                </div>
                <div style="display:grid; grid-template-columns:80px 1fr; gap:10px; margin-bottom:8px;">
                    <div style="background:#8BC34A; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px;">A</div>
                    <div class="tier-drop-zone" data-tier="A" style="background:#333; min-height:60px; border-radius:4px; padding:5px; display:flex; gap:5px; flex-wrap:wrap;"></div>
                </div>
                <div style="display:grid; grid-template-columns:80px 1fr; gap:10px; margin-bottom:8px;">
                    <div style="background:#FFEB3B; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px; color:black;">B</div>
                    <div class="tier-drop-zone" data-tier="B" style="background:#333; min-height:60px; border-radius:4px; padding:5px; display:flex; gap:5px; flex-wrap:wrap;"></div>
                </div>
                <div style="display:grid; grid-template-columns:80px 1fr; gap:10px; margin-bottom:8px;">
                    <div style="background:#FF9800; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px;">C</div>
                    <div class="tier-drop-zone" data-tier="C" style="background:#333; min-height:60px; border-radius:4px; padding:5px; display:flex; gap:5px; flex-wrap:wrap;"></div>
                </div>
                <div style="display:grid; grid-template-columns:80px 1fr; gap:10px;">
                    <div style="background:#F44336; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px;">F</div>
                    <div class="tier-drop-zone" data-tier="F" style="background:#333; min-height:60px; border-radius:4px; padding:5px; display:flex; gap:5px; flex-wrap:wrap;"></div>
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <input type="text" id="tier-list-name" placeholder="Tier list name" value="${currentTierListName}" style="flex:1; padding:10px; border:none; border-radius:6px;">
                <button id="save-tier-btn" style="flex:1; padding:12px; background:#4CAF50; border:none; color:white; font-weight:bold; border-radius:8px;">💾 Save Tier List</button>
                <button id="close-tier-btn" style="flex:1; padding:12px; background:#666; border:none; color:white; font-weight:bold; border-radius:8px;">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const dragImage = modal.querySelector("#tier-drag-image");
    dragImage.draggable = true;
    
    dragImage.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify(currentItem));
        e.dataTransfer.effectAllowed = "move";
    });

    const dropZones = modal.querySelectorAll(".tier-drop-zone");
    dropZones.forEach(zone => {
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            zone.style.background = "#444";
        });

        zone.addEventListener("dragleave", () => {
            zone.style.background = "#333";
        });

        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.style.background = "#333";
            const item = JSON.parse(e.dataTransfer.getData("text/plain"));
            
            const img = document.createElement("img");
            img.src = item.url;
            img.style = "width:50px; height:50px; object-fit:cover; border-radius:4px; cursor:grab;";
            img.draggable = true;
            img.dataset.publicId = item.public_id;             
                              img.addEventListener("dragstart", (dragE) => {
                                       dragE.dataTransfer.setData("text/plain", JSON.stringify(item));
            });

            img.addEventListener("click", () => {
                if(confirm("Remove from tier?")) img.remove();
            });

            zone.appendChild(img);
        });
    });

    modal.querySelector("#save-tier-btn").addEventListener("click", async () => {
        const tierListName = modal.querySelector("#tier-list-name").value || "My Tier List";
        currentTierListName = tierListName;
        
        const tiers = {};
        dropZones.forEach(zone => {
            const tierName = zone.dataset.tier;
            const images = Array.from(zone.querySelectorAll("img")).map(img => ({
                url: img.src,
                public_id: img.dataset.publicId
            }));
            if (images.length > 0) {
                tiers[tierName] = images;
            }
        });

        const res = await fetch("/api/tierlists/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: tierListName, tiers })
        });

        const data = await res.json();
        if (data.success) {
            alert("✅ Tier list saved!");
            modal.remove();
        } else {
            alert("Failed to save tier: " + data.error);
        }
    });

    modal.querySelector("#close-tier-btn").addEventListener("click", () => modal.remove());
}

async function openTierListViewer() {
    if (!isAdmin) return alert("Admin only");
    
    const res = await fetch("/api/tierlists");
    const data = await res.json();
    
    if (!data.success || !data.tierLists || !data.tierLists.length) {
        return alert("No tier lists found. Create one first!");
    }

    const existing = document.getElementById("tier-viewer-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "tier-viewer-modal";
    modal.style = `position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:10002; display:flex; align-items:center; justify-content:center;`;

    modal.innerHTML = `
        <div style="background:#111; padding:20px; border-radius:12px; width:90%; max-width:800px; color:white; max-height:90vh; overflow-y:auto;">
            <h2 style="text-align:center; margin-bottom:20px;">📊 Tier Lists</h2>
        </div>
    `;

    const content = modal.querySelector("div");
    
    data.tierLists.forEach(tierList => {
        const tierListDiv = document.createElement("div");
        tierListDiv.style = `margin-bottom:30px;`;
        
        tierListDiv.innerHTML = `
            <h3 style="text-align:center; color:#ff5a5f; margin-bottom:15px;">${tierList.name}</h3>
            <div style="background:#222; padding:15px; border-radius:8px;">
        `;

        const tierOrder = ["S", "A", "B", "C", "F"];
        const tierColors = { S: "#4CAF50", A: "#8BC34A", B: "#FFEB3B", C: "#FF9800", F: "#F44336" };

        tierOrder.forEach(tierName => {
            const images = tierList.tiers?.[tierName] || [];
            tierListDiv.innerHTML += `
                <div style="display:grid; grid-template-columns:80px 1fr; gap:10px; margin-bottom:8px;">
                    <div style="background:${tierColors[tierName]}; display:flex; align-items:center; justify-content:center; font-weight:bold; border-radius:4px;">${tierName}</div>
                    <div style="background:#333; min-height:60px; border-radius:4px; padding:5px; display:flex; gap:5px; flex-wrap:wrap;">
                        ${images.length > 0 ? images.map(img => `<img src="${img.url}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`).join("") : '<span style="color:#666;">Empty</span>'}
                    </div>
                </div>
            `;
        });

        tierListDiv.innerHTML += `</div>`;
        content.appendChild(tierListDiv);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style = `width:100%; padding:12px; margin-top:15px; background:#666; border:none; color:white; font-weight:bold; border-radius:8px;`;
    closeBtn.addEventListener("click", () => modal.remove());
    content.appendChild(closeBtn);

    document.body.appendChild(modal);
}

async function addToAlbum(item) {
    const res = await fetch("/api/albums");
    const data = await res.json();
    
    let msg = "Albums:\n\n";
    const albums = data.albums || [];
    if (!albums.length) {
        msg = "No albums yet. Create one first:\n\n";
    } else {
        albums.forEach((a, i) => msg += `${i + 1}. ${a.name} (${a.items ? a.items.length : 0} items)\n`);
    }
    
    msg += "\nType album name (or create new):";
    const name = prompt(msg);
    if (!name) return;

    let album = albums.find(a => a.name.toLowerCase() === name.toLowerCase());
    
    if (!album) {
        const createRes = await fetch("/api/albums/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        const createData = await createRes.json();
        if (!createData.success) {
            alert("Failed to create album: " + createData.error);
            return;
        }
        album = createData.album;
    }

    const addRes = await fetch("/api/albums/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            albumName: album.name, 
            public_id: item.public_id,
            gallery: currentGallery 
        })
    });

    const addData = await addRes.json();
    if (addData.success) {
        alert(`✅ Added to "${album.name}"!`);
    } else {
        alert("Failed: " + addData.error);
    }
}

async function showAlbums() {
    if (!isAdmin) return alert("Admin only");
    
    const res = await fetch("/api/albums");
    const data = await res.json();
    
    const albums = data.albums || [];
    
    if (!albums.length) {
        const name = prompt("No albums yet. Create one by typing a name:");
        if (!name) return;
        
        const createRes = await fetch("/api/albums/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        const createData = await createRes.json();
        if (createData.success) {
            alert("Album created!");
            openAlbumViewer(createData.album);
        } else {
            alert("Failed to create: " + createData.error);
        }
        return;
    }
    
    let msg = "Select an album:\n\n";
    albums.forEach((a, i) => msg += `${i + 1}. ${a.name} (${a.items ? a.items.length : 0} items)\n`);
    msg += "\nEnter the NUMBER (1, 2, 3...) OR type the EXACT album name:\nOr type 'new' to create:";
    
    const choice = prompt(msg);
    if (!choice) return;
    
    if (choice.toLowerCase() === "new") {
        const name = prompt("Enter album name:");
        if (!name) return;
        
        const createRes = await fetch("/api/albums/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        const createData = await createRes.json();
        if (createData.success) {
            alert("Album created!");
            openAlbumViewer(createData.album);
        } else {
            alert("Failed to create: " + createData.error);
        }
        return;
    }
    
    const idx = parseInt(choice) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < albums.length) {
        openAlbumViewer(albums[idx]);
        return;
    }
    
    const album = albums.find(a => a.name.toLowerCase() === choice.toLowerCase());
    if (album) {
        openAlbumViewer(album);
        return;
    }
    
    alert("Invalid selection. Try the number or exact album name.");
}

async function openAlbumViewer(album) {
    const existing = document.getElementById("album-viewer-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "album-viewer-modal";
    modal.style = `position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.9); z-index:10003; display:flex; align-items:center; justify-content:center;`;

    const gridDiv = document.createElement("div");
    gridDiv.style = `display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px;`;
    gridDiv.setAttribute("data-grid", "true");

    modal.innerHTML = `
        <div style="background:#111; padding:20px; border-radius:12px; width:90%; max-width:800px; color:white; max-height:90vh; overflow-y:auto;">
            <h2 style="text-align:center; margin-bottom:20px;">📁 ${album.name}</h2>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px;"></div>
        </div>
        <button id="close-album-btn" style="width:100%; padding:12px; margin-top:15px; background:#666; border:none; color:white; font-weight:bold; border-radius:8px;">Close</button>
    </div>`;

    const contentDiv = modal.querySelector("div[data-grid]");
    
    if (!contentDiv) {
        contentDiv = modal.querySelector("div:not([style*='grid'])");
        const grid = document.createElement("div");
        grid.style = `display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px;`;
        contentDiv.appendChild(grid);
        contentDiv = grid;
    }
    
    if (!album.items || !album.items.length) {
        const empty = document.createElement("p");
        empty.textContent = "No items in this album.";
        empty.style = "text-align:center; color:#666; grid-column:1/-1;";
        contentDiv.appendChild(empty);
    } else {
        for (const item of album.items) {
            const res = await fetch(`/api/media/${item.public_id}`);
            const data = await res.json();
            if (!data.success || !data.item) continue;
            
            const fullItem = data.item;
            
            const img = document.createElement("img");
            img.src = fullItem.url;
            img.style = `width:100%; height:100px; object-fit:cover; border-radius:8px; cursor:pointer;`;
            img.addEventListener("click", () => {
                const idx = items.findIndex(i => i.public_id === item.public_id);
                if (idx >= 0) openLightbox(idx);
            });
            contentDiv.appendChild(img);
        }
    }

    modal.querySelector("#close-album-btn").addEventListener("click", () => modal.remove());
    document.body.appendChild(modal);
}