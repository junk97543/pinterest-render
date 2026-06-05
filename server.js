require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v2: cloudinary } = require("cloudinary");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const TEMP_UPLOAD_DIR = path.join(__dirname, "tmp-uploads");
const TEMP_DIR = path.join(__dirname, "temp");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, JSON.stringify({ family: [], private: [] }, null, 2));
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2));

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

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

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
function saveState(state) { writeJSON(STATE_FILE, state); }
function loadChat() { return readJSON(CHAT_FILE); }
function saveChat(chat) { writeJSON(CHAT_FILE, chat); }

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

// ==================== ROUTES ====================

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

// ==================== UNDRESS ENDPOINT ====================
app.post('/api/undress', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Admin only' });

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "No image URL provided" });

  const tempInput = path.join(TEMP_DIR, `input_${Date.now()}.jpg`);
  const tempOutput = path.join(TEMP_DIR, `output_${Date.now()}.png`);

  try {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    fs.writeFileSync(tempInput, buffer);

    let workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'undress_workflow.json'), 'utf8'));

    if (workflow["1"]) workflow["1"].inputs.image = path.basename(tempInput);

    const promptRes = await fetch('http://127.0.0.1:8188/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    const { prompt_id } = await promptRes.json();

    let outputUrl = null;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const historyRes = await fetch(`http://127.0.0.1:8188/history/${prompt_id}`);
      const history = await historyRes.json();
      if (history[prompt_id] && history[prompt_id].outputs && history[prompt_id].outputs["28"]) {
        const imgData = history[prompt_id].outputs["28"].images[0];
        if (imgData) {
          outputUrl = `http://127.0.0.1:8188/view?filename=${imgData.filename}&subfolder=&type=output`;
          break;
        }
      }
    }

    if (!outputUrl) throw new Error("Generation timed out.");

    const resultRes = await fetch(outputUrl);
    const resultBuffer = await resultRes.buffer();
    fs.writeFileSync(tempOutput, resultBuffer);

    configureCloudinary("private");
    const cloudinaryRes = await cloudinary.uploader.upload(tempOutput, {
      folder: "private_gallery",
      tags: ['ai-nude'],
    });

    const state = loadState();
    state.private.push({
      public_id: cloudinaryRes.public_id,
      url: cloudinaryRes.secure_url,
      type: "image",
      likes: 0,
      tags: ["ai-nude"],
      caption: "AI Undressed",
      createdAt: new Date().toISOString(),
      gallery: "private"
    });
    saveState(state);

    fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

    res.json({ success: true, message: "✅ Nude version added to Private Gallery!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload Route
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

    const state = loadState();
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
    saveState(state);

    res.json({ success: true, count: uploaded.length, errors, activeGallery: gallery });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

// Other routes (like, tag, etc.)
app.get("/media", (req, res) => { /* your original media route */ });
app.post("/api/like", (req, res) => { /* your original */ });
app.post("/api/tag", (req, res) => { /* your original */ });
app.post("/api/caption", (req, res) => { /* your original */ });
app.post("/delete-all", async (req, res) => { /* your original */ });
app.get("/api/chat", (req, res) => { /* your original */ });
app.post("/api/chat", (req, res) => { /* your original */ });

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));