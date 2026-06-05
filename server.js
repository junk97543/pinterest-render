const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "gallery-secret",
  resave: false,
  saveUninitialized: false
}));

const UPLOADS_DIR = path.join(__dirname, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const mediaStore = global.mediaStore || [];
global.mediaStore = mediaStore;

const state = global.state || {
  currentView: "family",
  familyAccess: false,
  isAdmin: false
};
global.state = state;

function slugify(name) {
  return String(name || "image").replace(/[^a-z0-9_\-]+/gi, "_").replace(/_+/g, "_");
}

function saveImageToGallery({ buffer, filename, gallery, caption = "", source = "upload" }) {
  const safe = slugify(filename);
  fs.writeFileSync(path.join(UPLOADS_DIR, safe), buffer);

  const item = {
    public_id: crypto.randomUUID(),
    gallery,
    type: "image",
    url: `/uploads/${safe}`,
    filename: safe,
    caption,
    likes: 0,
    tags: [],
    source
  };

  mediaStore.unshift(item);
  return item;
}

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  res.json({
    isAdmin: state.isAdmin,
    familyAccess: state.familyAccess,
    currentView: state.currentView
  });
});

app.post("/api/family-unlock", (req, res) => {
  const { code } = req.body || {};
  const expected = process.env.FAMILY_CODE || "1234";
  if (String(code || "") === String(expected)) {
    state.familyAccess = true;
    state.currentView = "family";
    return res.json({ success: true });
  }
  return res.json({ success: false });
});

app.post("/api/family-logout", (req, res) => {
  state.familyAccess = false;
  if (!state.isAdmin) state.currentView = "family";
  res.json({ success: true });
});

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD || "admin";
  if (String(password || "") === String(expected)) {
    state.isAdmin = true;
    state.currentView = "private";
    return res.json({ success: true });
  }
  return res.json({ success: false });
});

app.post("/api/admin-logout", (req, res) => {
  state.isAdmin = false;
  state.currentView = "family";
  res.json({ success: true });
});

app.post("/api/switch-gallery", (req, res) => {
  const { gallery } = req.body || {};
  if (gallery !== "family" && gallery !== "private") {
    return res.status(400).json({ success: false, error: "Invalid gallery" });
  }
  state.currentView = gallery;
  res.json({ success: true });
});

app.get("/media", (req, res) => {
  const gallery = req.query.gallery || state.currentView || "family";
  const sort = req.query.sort || "random";

  let items = mediaStore.filter(item => item.gallery === gallery);

  if (sort === "newest") {
    items = [...items];
  } else if (sort === "popular") {
    items = [...items].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else {
    items = [...items].sort(() => Math.random() - 0.5);
  }

  res.json(items);
});

app.post("/upload", upload.array("files", 1000), (req, res) => {
  try {
    const gallery = req.body.gallery || "family";
    const files = req.files || [];
    const saved = [];

    for (const file of files) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeName = `${Date.now()}_${crypto.randomUUID()}${ext || ".bin"}`;
      const fullPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(fullPath, file.buffer);

      saved.push({
        public_id: crypto.randomUUID(),
        gallery,
        type: file.mimetype && file.mimetype.startsWith("video/") ? "video" : "image",
        url: `/uploads/${safeName}`,
        filename: safeName,
        caption: "",
        likes: 0,
        tags: []
      });
    }

    mediaStore.unshift(...saved);
    res.json({ success: true, count: saved.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

app.post("/api/like", (req, res) => {
  const { public_id } = req.body || {};
  const item = mediaStore.find(x => x.public_id === public_id);
  if (!item) return res.status(404).json({ success: false });
  item.likes = (item.likes || 0) + 1;
  res.json({ success: true, likes: item.likes });
});

app.post("/api/tag", (req, res) => {
  const { public_id, tag } = req.body || {};
  const item = mediaStore.find(x => x.public_id === public_id);
  if (!item) return res.status(404).json({ success: false });
  item.tags = item.tags || [];
  if (!item.tags.includes(tag)) item.tags.push(tag);
  res.json({ success: true });
});

app.post("/api/caption", (req, res) => {
  const { public_id, caption } = req.body || {};
  const item = mediaStore.find(x => x.public_id === public_id);
  if (!item) return res.status(404).json({ success: false });
  item.caption = caption || "";
  res.json({ success: true });
});

app.post("/delete-all", (req, res) => {
  const { gallery } = req.body || {};
  if (gallery !== "family" && gallery !== "private") {
    return res.status(400).json({ success: false, error: "Invalid gallery" });
  }

  const keep = [];
  for (const item of mediaStore) {
    if (item.gallery === gallery) {
      try {
        const filePath = path.join(UPLOADS_DIR, item.filename || "");
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}
    } else {
      keep.push(item);
    }
  }

  mediaStore.length = 0;
  mediaStore.push(...keep);

  res.json({ success: true });
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server started");
});