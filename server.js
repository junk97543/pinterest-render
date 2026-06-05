const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

require("dotenv").config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const UPLOADS_DIR = path.join(__dirname, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

cloudinary.config({
  cloud_name: process.env.PRIVATE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.PRIVATE_CLOUDINARY_API_KEY,
  api_secret: process.env.PRIVATE_CLOUDINARY_API_SECRET,
  secure: true
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const state = global.state || {
  currentView: "family",
  familyAccess: false,
  isAdmin: false
};
global.state = state;

function slugify(name) {
  return String(name || "image").replace(/[^a-z0-9_\-]+/gi, "_").replace(/_+/g, "_");
}

function isVideo(asset) {
  return asset.resource_type === "video" || (asset.format && ["mp4", "mov", "webm", "m4v"].includes(asset.format.toLowerCase()));
}

function mapCloudinaryAsset(asset, gallery) {
  const meta = asset.context && asset.context.custom ? asset.context.custom : {};
  const tags = Array.isArray(asset.tags) ? asset.tags : [];

  return {
    public_id: asset.public_id,
    gallery,
    type: isVideo(asset) ? "video" : "image",
    url: asset.secure_url || asset.url,
    filename: asset.public_id,
    caption: meta.caption || "",
    likes: Number(meta.likes || 0),
    tags
  };
}

async function fetchCloudinaryAssets(gallery) {
  const prefix = gallery === "private" ? "private/" : "family/";
  const resourceTypes = ["image", "video"];
  const all = [];

  for (const resource_type of resourceTypes) {
    const res = await cloudinary.api.resources(resource_type, {
      type: "upload",
      prefix,
      max_results: 500
    });

    for (const asset of res.resources || []) {
      all.push(mapCloudinaryAsset(asset, gallery));
    }
  }

  return all;
}

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/status", (req, res) => {
  res.json({
    isAdmin: state.isAdmin,
    familyAccess: state.familyAccess,
    currentView: state.currentView
  });
});

app.post("/api/family-unlock", (req, res) => {
  try {
    const code = String((req.body && req.body.code) || "").trim();
    const expected = String(process.env.FAMILY_GALLERY_CODE || process.env.FAMILY_CODE || "1234").trim();

    if (!code) {
      return res.status(400).json({ success: false, error: "Code required" });
    }

    if (code === expected) {
      state.familyAccess = true;
      state.currentView = "family";
      return res.json({ success: true });
    }

    return res.status(401).json({ success: false, error: "Wrong code" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "Unlock failed" });
  }
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
  return res.status(401).json({ success: false, error: "Wrong password" });
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

app.get("/media", async (req, res) => {
  try {
    const gallery = req.query.gallery || state.currentView || "family";
    const sort = req.query.sort || "random";

    let items = await fetchCloudinaryAssets(gallery);

    if (sort === "popular") {
      items = [...items].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (sort === "newest") {
      items = [...items];
    } else {
      items = [...items].sort(() => Math.random() - 0.5);
    }

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not load media" });
  }
});

app.post("/upload", upload.array("files", 1000), async (req, res) => {
  try {
    const gallery = req.body.gallery || "family";
    const files = req.files || [];
    const folder = gallery === "private" ? "private" : "family";
    const saved = [];

    for (const file of files) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const resource_type = file.mimetype && file.mimetype.startsWith("video/") ? "video" : "image";
      const public_id = `${folder}/${Date.now()}_${crypto.randomUUID()}${ext ? ext : ""}`;

      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: path.basename(public_id, ext || ""),
            resource_type: resource_type,
            overwrite: true
          },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      saved.push({
        public_id: uploadRes.public_id,
        gallery,
        type: resource_type === "video" ? "video" : "image",
        url: uploadRes.secure_url,
        filename: uploadRes.public_id,
        caption: "",
        likes: 0,
        tags: []
      });
    }

    res.json({ success: true, count: saved.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

app.post("/api/like", (req, res) => {
  res.json({ success: true, likes: 0 });
});

app.post("/api/tag", (req, res) => {
  res.json({ success: true });
});

app.post("/api/caption", (req, res) => {
  res.json({ success: true });
});

app.post("/delete-all", async (req, res) => {
  try {
    const { gallery } = req.body || {};
    if (gallery !== "family" && gallery !== "private") {
      return res.status(400).json({ success: false, error: "Invalid gallery" });
    }

    const folder = gallery === "private" ? "private" : "family";
    const assets = await fetchCloudinaryAssets(gallery);

    for (const item of assets) {
      await cloudinary.uploader.destroy(item.public_id, {
        resource_type: item.type === "video" ? "video" : "image",
        invalidate: true
      });
    }

    res.json({ success: true, deleted: assets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server started");
});