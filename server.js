const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const MEDIA_FILE = path.join(DATA_DIR, "media.json");
const CHAT_FILE = path.join(DATA_DIR, "chat.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_FILE)) fs.writeFileSync(MEDIA_FILE, JSON.stringify([] , null, 2));
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, JSON.stringify([] , null, 2));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: path.join(__dirname, "uploads") });
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

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

function getMedia() {
  return readJSON(MEDIA_FILE);
}

function saveMedia(media) {
  writeJSON(MEDIA_FILE, media);
}

function getChat() {
  return readJSON(CHAT_FILE);
}

function saveChat(chat) {
  writeJSON(CHAT_FILE, chat);
}

let adminSession = false;

app.get("/api/admin", (req, res) => {
  res.json({ isAdmin: adminSession });
});

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    adminSession = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: "Wrong password" });
});

app.post("/api/logout", (req, res) => {
  adminSession = false;
  res.json({ success: true });
});

app.get("/media", (req, res) => {
  const sort = req.query.sort || "random";
  const media = getMedia();

  if (sort === "newest") {
    media.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === "popular") {
    media.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  }

  res.json(media);
});

app.post("/upload", upload.array("files"), (req, res) => {
  try {
    const media = getMedia();
    const files = req.files || [];

    files.forEach(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      const isVideo = [".mp4", ".mov", ".webm", ".m4v", ".avi"].includes(ext);
      const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif"].includes(ext);

      if (!isVideo && !isImage) return;

      const newName = `${crypto.randomUUID()}${ext}`;
      const newPath = path.join(__dirname, "uploads", newName);
      fs.renameSync(file.path, newPath);

      media.push({
        public_id: newName,
        url: `/uploads/${newName}`,
        type: isVideo ? "video" : "image",
        likes: 0,
        tags: [],
        createdAt: new Date().toISOString()
      });
    });

    saveMedia(media);
    res.json({ success: true, isAdmin: adminSession });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/api/like", (req, res) => {
  try {
    const { public_id } = req.body || {};
    if (!public_id) return res.status(400).json({ success: false, error: "Missing public_id" });

    const media = getMedia();
    const item = media.find(m => m.public_id === public_id);
    if (!item) return res.status(404).json({ success: false, error: "Media not found" });

    item.likes = (item.likes || 0) + 1;
    saveMedia(media);

    res.json({ success: true, likes: item.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Like failed" });
  }
});

app.post("/api/tag", (req, res) => {
  try {
    const { public_id, tag } = req.body || {};

    if (!public_id || !tag) {
      return res.status(400).json({ success: false, error: "Missing public_id or tag" });
    }

    const cleanTag = String(tag).trim().replace(/^#/, "").replace(/\s+/g, " ");
    if (!cleanTag) {
      return res.status(400).json({ success: false, error: "Invalid tag" });
    }

    const media = getMedia();
    const item = media.find(m => m.public_id === public_id);
    if (!item) {
      return res.status(404).json({ success: false, error: "Media not found" });
    }

    if (!Array.isArray(item.tags)) item.tags = [];
    if (!item.tags.includes(cleanTag)) item.tags.push(cleanTag);

    saveMedia(media);
    res.json({ success: true, tags: item.tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Tag failed" });
  }
});

app.get("/api/chat", (req, res) => {
  res.json(getChat());
});

app.post("/api/chat", (req, res) => {
  try {
    const { name, message } = req.body || {};
    if (!name || !message) {
      return res.status(400).json({ success: false, error: "Missing name or message" });
    }

    const chat = getChat();
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

app.post("/delete-all", (req, res) => {
  try {
    if (!adminSession) return res.status(401).json({ success: false, error: "Admin only" });

    const media = getMedia();
    media.forEach(item => {
      const filePath = path.join(__dirname, "uploads", path.basename(item.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    saveMedia([]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});