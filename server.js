require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { v2: cloudinary } = require("cloudinary");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const TEMP_UPLOAD_DIR = path.join(__dirname, "tmp-uploads");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, JSON.stringify({ family: [], private: [] }, null, 2));
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax"
  }
}));

app.use(express.static(PUBLIC_DIR));

const upload = multer({ dest: TEMP_UPLOAD_DIR });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const FAMILY_GALLERY_CODE = process.env.FAMILY_GALLERY_CODE || "1234";

let activeGallery = "family";

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      family: Array.isArray(raw.family) ? raw.family : [],
      private: Array.isArray(raw.private) ? raw.private : []
    };
  } catch {
    return { family: [], private: [] };
  }
}

function saveState(state) {
  writeJSON(STATE_FILE, state);
}

function loadChat() {
  return readJSON(CHAT_FILE);
}

function saveChat(chat) {
  writeJSON(CHAT_FILE, chat);
}

function isAdmin(req) {
  return req.session && req.session.isAdmin;
}

function ensureGalleryAccess(req, gallery) {
  if (gallery === "private") return isAdmin(req);
  if (gallery === "family") return req.session && req.session.familyAccess === true;
  return false;
}

function getGalleryFromQueryOrActive(req) {
  const g = String(req.query.gallery || activeGallery || "family").toLowerCase();
  return g === "private" ? "private" : "family";
}

function cloudinaryConfigFor(gallery) {
  if (gallery === "private") {
    return {
      cloud_name: process.env.PRIVATE_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.PRIVATE_CLOUDINARY_API_KEY,
      api_secret: process.env.PRIVATE_CLOUDINARY_API_SECRET
    };
  }
  return {
    cloud_name: process.env.FAMILY_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.FAMILY_CLOUDINARY_API_KEY,
    api_secret: process.env.FAMILY_CLOUDINARY_API_SECRET
  };
}

function configureCloudinary(gallery) {
  cloudinary.config({
    secure: true,
    ...cloudinaryConfigFor(gallery)
  });
}

function normalizeTag(tag) {
  return String(tag || "").trim().replace(/^#/, "").replace(/\s+/g, " ");
}

app.get("/api/status", (req, res) => {
  res.json({
    isAdmin: isAdmin(req),
    familyAccess: !!(req.session && req.session.familyAccess),
    activeGallery,
    currentView: isAdmin(req) ? activeGallery : "family"
  });
});

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    activeGallery = "private";
    return res.json({ success: true, activeGallery });
  }
  return res.status(401).json({ success: false, error: "Wrong admin password" });
});

app.post("/api/admin-logout", (req, res) => {
  req.session.isAdmin = false;
  activeGallery = "family";
  res.json({ success: true });
});

app.post("/api/family-unlock", (req, res) => {
  const { code } = req.body || {};
  if (String(code || "") === String(FAMILY_GALLERY_CODE)) {
    req.session.familyAccess = true;
    activeGallery = "family";
    return res.json({ success: true, activeGallery: "family" });
  }
  return res.status(401).json({ success: false, error: "Wrong family code" });
});

app.post("/api/family-logout", (req, res) => {
  req.session.familyAccess = false;
  if (!isAdmin(req)) activeGallery = "family";
  res.json({ success: true });
});

app.post("/api/switch-gallery", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });
  const { gallery } = req.body || {};
  if (gallery !== "family" && gallery !== "private") {
    return res.status(400).json({ success: false, error: "Invalid gallery" });
  }
  activeGallery = gallery;
  res.json({ success: true, activeGallery });
});

app.get("/api/active-gallery", (req, res) => {
  const requested = getGalleryFromQueryOrActive(req);
  if (requested === "private" && !isAdmin(req)) {
    return res.status(403).json({ success: false, error: "Private gallery requires admin" });
  }
  if (requested === "family" && !(req.session && req.session.familyAccess)) {
    return res.status(403).json({ success: false, error: "Family gallery requires code" });
  }
  res.json({ activeGallery: requested });
});

app.get("/media", (req, res) => {
  const gallery = getGalleryFromQueryOrActive(req);
  if (!ensureGalleryAccess(req, gallery)) {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const sort = String(req.query.sort || "random");
  const state = loadState();
  const media = [...state[gallery]];

  if (sort === "newest") media.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (sort === "popular") media.sort((a, b) => (b.likes || 0) - (a.likes || 0));

  res.json(media);
});

app.post("/upload", upload.array("files", 1000), async (req, res) => {
  try {
    const gallery = String(req.body.gallery || activeGallery || "family").toLowerCase();
    if (gallery !== "family" && gallery !== "private") {
      return res.status(400).json({ success: false, error: "Invalid gallery" });
    }

    if (!ensureGalleryAccess(req, gallery)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (gallery === "private" && !isAdmin(req)) {
      return res.status(401).json({ success: false, error: "Admin only" });
    }

    if (gallery === "family" && !req.session.familyAccess && !isAdmin(req)) {
      return res.status(401).json({ success: false, error: "Family access required" });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: "No files uploaded" });

    if (files.length > 1000) {
      return res.status(400).json({ success: false, error: "Maximum 1000 files per upload" });
    }

    configureCloudinary(gallery);
    const state = loadState();

    const uploaded = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const isVideo = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".ogg"].includes(ext);
      const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif"].includes(ext);

      if (!isVideo && !isImage) {
        fs.unlinkSync(file.path);
        continue;
      }

      const resourceType = isVideo ? "video" : "image";
      const uploadedFile = await cloudinary.uploader.upload(file.path, {
        resource_type: resourceType,
        folder: gallery === "family" ? "family_gallery" : "private_gallery"
      });

      uploaded.push({
        public_id: uploadedFile.public_id,
        url: uploadedFile.secure_url,
        type: resourceType,
        likes: 0,
        tags: [],
        createdAt: new Date().toISOString(),
        gallery
      });

      fs.unlinkSync(file.path);
    }

    state[gallery].push(...uploaded);
    saveState(state);

    res.json({ success: true, count: uploaded.length, activeGallery: gallery });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

app.post("/api/like", (req, res) => {
  try {
    const { public_id, gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";
    if (!ensureGalleryAccess(req, targetGallery)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const state = loadState();
    const item = state[targetGallery].find(m => m.public_id === public_id);
    if (!item) return res.status(404).json({ success: false, error: "Media not found" });

    item.likes = (item.likes || 0) + 1;
    saveState(state);

    res.json({ success: true, likes: item.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Like failed" });
  }
});

app.post("/api/tag", (req, res) => {
  try {
    const { public_id, tag, gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";
    if (!ensureGalleryAccess(req, targetGallery)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const cleanTag = normalizeTag(tag);
    if (!public_id || !cleanTag) {
      return res.status(400).json({ success: false, error: "Missing public_id or tag" });
    }

    const state = loadState();
    const item = state[targetGallery].find(m => m.public_id === public_id);
    if (!item) return res.status(404).json({ success: false, error: "Media not found" });

    if (!Array.isArray(item.tags)) item.tags = [];
    if (!item.tags.includes(cleanTag)) item.tags.push(cleanTag);
    saveState(state);

    res.json({ success: true, tags: item.tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Tag failed" });
  }
});

app.post("/delete-all", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });
    const { gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";

    configureCloudinary(targetGallery);
    const state = loadState();

    for (const item of state[targetGallery]) {
      try {
        await cloudinary.uploader.destroy(item.public_id, {
          resource_type: item.type === "video" ? "video" : "image"
        });
      } catch {}
    }

    state[targetGallery] = [];
    saveState(state);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

app.get("/api/chat", (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
  res.json(loadChat());
});

app.post("/api/chat", (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
    const { name, message } = req.body || {};
    if (!name || !message) {
      return res.status(400).json({ success: false, error: "Missing name or message" });
    }

    const chat = loadChat();
    chat.push({
      name: String(name).slice(0, 40),
      message: String(message).slice(0, 500),
      timestamp: new Date().toISOString()
    });

    saveChat(chat.slice(-200));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Chat failed" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});