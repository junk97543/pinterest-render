const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

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

function isVideoAsset(asset) {
  return asset.resource_type === "video";
}

function mapAsset(asset, gallery) {
  const ctx = asset.context && asset.context.custom ? asset.context.custom : {};
  return {
    public_id: asset.public_id,
    gallery,
    type: isVideoAsset(asset) ? "video" : "image",
    url: asset.secure_url,
    filename: asset.public_id,
    caption: ctx.caption || "",
    likes: Number(ctx.likes || 0),
    tags: Array.isArray(asset.tags) ? asset.tags : []
  };
}

async function listCloudinaryAssets(gallery) {
  const prefix = gallery === "private" ? "private/" : "family/";
  const [images, videos] = await Promise.all([
    cloudinary.api.resources("image", {
      type: "upload",
      prefix,
      max_results: 500
    }),
    cloudinary.api.resources("video", {
      type: "upload",
      prefix,
      max_results: 500
    })
  ]);

  return [
    ...(images.resources || []).map(a => mapAsset(a, gallery)),
    ...(videos.resources || []).map(a => mapAsset(a, gallery))
  ];
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/status", (req, res) => {
  res.json({
    isAdmin: state.isAdmin,
    familyAccess: state.familyAccess,
    currentView: state.currentView
  });
});

app.post("/api/family-unlock", (req, res) => {
  const code = String((req.body && req.body.code) || "").trim();
  const expected = String(process.env.FAMILY_GALLERY_CODE || process.env.FAMILY_CODE || "").trim();
  if (!code) return res.status(400).json({ success: false, error: "Code required" });
  if (code === expected) {
    state.familyAccess = true;
    state.currentView = "family";
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: "Wrong code" });
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
    let items = await listCloudinaryAssets(gallery);

    if (sort === "popular") {
      items.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (sort === "newest") {
      items.sort((a, b) => b.public_id.localeCompare(a.public_id));
    } else {
      items.sort(() => Math.random() - 0.5);
    }

    res.json(items);
  } catch (err) {
    console.error("MEDIA ERROR:", err);
    res.status(500).json({ success: false, error: "Could not load media" });
  }
});

app.post("/upload", upload.array("files", 1000), async (req, res) => {
  try {
    const gallery = req.body.gallery || "family";
    const folder = gallery === "private" ? "private" : "family";
    const files = req.files || [];
    const uploaded = [];

    for (const file of files) {
      const resource_type = file.mimetype && file.mimetype.startsWith("video/") ? "video" : "image";
      const name = `${Date.now()}_${crypto.randomUUID()}`;

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: name,
            resource_type,
            overwrite: true,
            unique_filename: false
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
        stream.end(file.buffer);
      });

      uploaded.push({
        public_id: result.public_id,
        url: result.secure_url,
        type: resource_type,
        gallery
      });
    }

    res.json({ success: true, count: uploaded.length });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
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

    const assets = await listCloudinaryAssets(gallery);
    for (const item of assets) {
      await cloudinary.uploader.destroy(item.public_id, {
        resource_type: item.type === "video" ? "video" : "image",
        invalidate: true
      });
    }

    res.json({ success: true, deleted: assets.length });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server started");
});