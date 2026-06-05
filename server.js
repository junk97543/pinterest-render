require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v2: cloudinary } = require("cloudinary");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const TEMP_UPLOAD_DIR = path.join(__dirname, "tmp-uploads");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

// MongoDB Setup
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("family_gallery");
    console.log("✅ Connected to MongoDB");
  }
  return db;
}

// Run connection on startup
connectDB().catch(console.error);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" }
}));

app.use(express.static(PUBLIC_DIR));

const upload = multer({ dest: TEMP_UPLOAD_DIR });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const FAMILY_GALLERY_CODE = process.env.FAMILY_GALLERY_CODE || "1234";
let activeGallery = "family";

async function loadState() {
  try {
    const database = await connectDB();
    const state = await database.collection("state").findOne({ _id: "main" });
    return state ? {
      family: Array.isArray(state.family) ? state.family : [],
      private: Array.isArray(state.private) ? state.private : []
    } : { family: [], private: [] };
  } catch (err) {
    console.error("DB loadState error:", err);
    return { family: [], private: [] };
  }
}

async function saveState(state) {
  try {
    const database = await connectDB();
    await database.collection("state").updateOne(
      { _id: "main" },
      { $set: { family: state.family || [], private: state.private || [] } },
      { upsert: true }
    );
  } catch (err) {
    console.error("DB saveState error:", err);
  }
}

async function loadChat() {
  try {
    const database = await connectDB();
    const chatDoc = await database.collection("chat").findOne({ _id: "main" });
    return chatDoc && Array.isArray(chatDoc.messages) ? chatDoc.messages : [];
  } catch (err) {
    console.error("DB loadChat error:", err);
    return [];
  }
}

async function saveChat(chat) {
  try {
    const database = await connectDB();
    await database.collection("chat").updateOne(
      { _id: "main" },
      { $set: { messages: chat.slice(-200) } },
      { upsert: true }
    );
  } catch (err) {
    console.error("DB saveChat error:", err);
  }
}

function isAdmin(req) { return !!req.session?.isAdmin; }
function hasFamilyAccess(req) { return !!req.session?.familyAccess; }
function canAccessGallery(req, gallery) {
  if (gallery === "private") return isAdmin(req);
  return hasFamilyAccess(req) || isAdmin(req);
}
function normalizeTag(tag) {
  return String(tag || "").trim().replace(/^#/, "").replace(/\s+/g, " ");
}
function getTargetGallery(req) {
  const g = String(req.query.gallery || req.body?.gallery || activeGallery || "family").toLowerCase();
  return g === "private" ? "private" : "family";
}
function configureCloudinary(gallery) {
  if (gallery === "private") {
    cloudinary.config({
      secure: true,
      cloud_name: process.env.PRIVATE_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.PRIVATE_CLOUDINARY_API_KEY,
      api_secret: process.env.PRIVATE_CLOUDINARY_API_SECRET
    });
  } else {
    cloudinary.config({
      secure: true,
      cloud_name: process.env.FAMILY_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.FAMILY_CLOUDINARY_API_KEY,
      api_secret: process.env.FAMILY_CLOUDINARY_API_SECRET
    });
  }
}
async function uploadToCloudinary(filePath, originalName, gallery) {
  const ext = path.extname(originalName).toLowerCase();
  const isVideo = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".ogg"].includes(ext);
  configureCloudinary(gallery);
  return await cloudinary.uploader.upload(filePath, {
    resource_type: isVideo ? "video" : "image",
    folder: gallery === "private" ? "private_gallery" : "family_gallery"
  });
}

// ======================== ROUTES ========================

app.get("/api/status", (req, res) => {
  res.json({
    isAdmin: isAdmin(req),
    familyAccess: hasFamilyAccess(req),
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
  if (gallery !== "family" && gallery !== "private") return res.status(400).json({ success: false, error: "Invalid gallery" });
  activeGallery = gallery;
  res.json({ success: true, activeGallery });
});

app.get("/media", async (req, res) => {
  const gallery = getTargetGallery(req);
  if (!canAccessGallery(req, gallery)) return res.status(403).json({ success: false, error: "Access denied" });

  const sort = String(req.query.sort || "random");
  const state = await loadState();
  let media = [...state[gallery]];

  if (sort === "newest") media.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (sort === "popular") media.sort((a, b) => (b.likes || 0) - (a.likes || 0));

  res.json(media);
});

app.post("/upload", upload.array("files", 1000), async (req, res) => {
  const gallery = String(req.body.gallery || "family").toLowerCase() === "private" ? "private" : "family";

  try {
    if (!canAccessGallery(req, gallery)) return res.status(403).json({ success: false, error: "Access denied" });
    if (gallery === "private" && !isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });
    if (gallery === "family" && !hasFamilyAccess(req) && !isAdmin(req)) {
      return res.status(401).json({ success: false, error: "Family access required" });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: "No files uploaded" });
    if (files.length > 1000) return res.status(400).json({ success: false, error: "Maximum 1000 files per upload" });

    const state = await loadState();
    const uploaded = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await uploadToCloudinary(file.path, file.originalname, gallery);
        uploaded.push({
          public_id: result.public_id,
          url: result.secure_url,
          type: result.resource_type === "video" ? "video" : "image",
          likes: 0,
          tags: [],
          caption: "",
          createdAt: new Date().toISOString(),
          gallery
        });
      } catch (err) {
        errors.push(`${file.originalname}: ${err.message}`);
      } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }

    state[gallery].push(...uploaded);
    await saveState(state);

    res.json({ success: true, count: uploaded.length, errors, activeGallery: gallery });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

app.post("/api/like", async (req, res) => {
  try {
    const { public_id, gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";
    if (!canAccessGallery(req, targetGallery)) return res.status(403).json({ success: false, error: "Access denied" });

    const state = await loadState();
    const item = state[targetGallery].find(m => m.public_id === public_id);
    if (!item) return res.status(404).json({ success: false, error: "Media not found" });

    item.likes = (item.likes || 0) + 1;
    await saveState(state);
    res.json({ success: true, likes: item.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Like failed" });
  }
});

app.post("/api/tag", async (req, res) => {
  try {
    const { public_id, tag, gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";
    if (!canAccessGallery(req, targetGallery)) return res.status(403).json({ success: false, error: "Access denied" });

    const cleanTag = normalizeTag(tag);
    if (!public_id || !cleanTag) return res.status(400).json({ success: false, error: "Missing public_id or tag" });

    const state = await loadState();
    const item = state[targetGallery].find(m => m.public_id === public_id);
    if (!item) return res.status(404).json({ success: false, error: "Media not found" });

    if (!Array.isArray(item.tags)) item.tags = [];
    if (!item.tags.includes(cleanTag)) item.tags.push(cleanTag);
    await saveState(state);

    res.json({ success: true, tags: item.tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Tag failed" });
  }
});

app.post("/api/caption", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });
    const { public_id, caption, gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";

    const state = await loadState();
    const item = state[targetGallery].find(m => m.public_id === public_id);
    if (!item) return res.status(404).json({ success: false, error: "Media not found" });

    item.caption = String(caption || "").slice(0, 200);
    await saveState(state);
    res.json({ success: true, caption: item.caption });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Caption failed" });
  }
});

app.post("/delete-all", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });
    const { gallery } = req.body || {};
    const targetGallery = gallery === "private" ? "private" : "family";

    configureCloudinary(targetGallery);
    const state = await loadState();

    for (const item of state[targetGallery]) {
      try {
        await cloudinary.uploader.destroy(item.public_id, { resource_type: item.type === "video" ? "video" : "image" });
      } catch {}
    }

    state[targetGallery] = [];
    await saveState(state);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

app.get("/api/chat", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
  res.json(await loadChat());
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: "Admin only" });
    const { name, message } = req.body || {};
    if (!name || !message) return res.status(400).json({ success: false, error: "Missing name or message" });

    const chat = await loadChat();
    chat.push({
      name: String(name).slice(0, 40),
      message: String(message).slice(0, 500),
      timestamp: new Date().toISOString()
    });

    await saveChat(chat);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Chat failed" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));