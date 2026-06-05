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

// ======================== DB HELPERS ========================
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
  } catch {
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

// ======================== CLOUDINARY ========================
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

// ======================== AUTO SYNC ========================
async function syncGalleryFromCloudinary(gallery) {
  const folder = gallery === "private" ? "private_gallery" : "family_gallery";
  configureCloudinary(gallery);

  const allResources = [];
  let next_cursor = null;

  try {
    do {
      const result = await cloudinary.api.resources({
        type: "upload",
        prefix: folder,
        max_results: 500,
        next_cursor: next_cursor
      });

      allResources.push(...result.resources);
      next_cursor = result.next_cursor;
    } while (next_cursor);

    const state = await loadState();
    const existingIds = new Set(state[gallery].map(item => item.public_id));

    const newItems = allResources
      .filter(resource => !existingIds.has(resource.public_id))
      .map(resource => ({
        public_id: resource.public_id,
        url: resource.secure_url,
        type: resource.resource_type === "video" ? "video" : "image",
        likes: 0,
        tags: resource.tags || [],
        caption: "",
        createdAt: resource.created_at,
        gallery
      }));

    if (newItems.length > 0) {
      state[gallery].push(...newItems);
      await saveState(state);
      console.log(`✅ Synced ${newItems.length} new items to ${gallery} gallery`);
    }

    return { success: true, synced: newItems.length, total: allResources.length };
  } catch (err) {
    console.error("Sync error:", err);
    return { success: false, error: err.message };
  }
}

// ======================== ROUTES ========================
app.get("/api/status", (req, res) => {
  res.json({
    isAdmin: !!req.session?.isAdmin,
    familyAccess: !!req.session?.familyAccess,
    activeGallery,
    currentView: !!req.session?.isAdmin ? activeGallery : "family"
  });
});

app.post("/api/admin-login", (req, res) => { /* ... same as before */ });
app.post("/api/admin-logout", (req, res) => { /* ... same */ });
app.post("/api/family-unlock", (req, res) => { /* ... same */ });
app.post("/api/family-logout", (req, res) => { /* ... same */ });
app.post("/api/switch-gallery", (req, res) => { /* ... same */ });

app.get("/media", async (req, res) => {
  const gallery = getTargetGallery(req);
  if (!canAccessGallery(req, gallery)) return res.status(403).json({ success: false, error: "Access denied" });

  const sort = String(req.query.sort || "random");
  let state = await loadState();
  let media = [...state[gallery]];

  if (sort === "newest") media.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (sort === "popular") media.sort((a, b) => (b.likes || 0) - (a.likes || 0));

  res.json(media);
});

app.post("/api/sync-gallery", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });
  const { gallery } = req.body || {};
  const target = gallery === "private" ? "private" : "family";
  const result = await syncGalleryFromCloudinary(target);
  res.json(result);
});

// Other routes (upload, like, tag, caption, delete-all, chat) remain the same as in previous version
// ... (copy them from the previous full server.js I gave you)

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));