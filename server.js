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
const WORKFLOW_PATH = path.join(__dirname, "undress_workflow.json");
const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForComfyResult(promptId, timeoutMs = 120000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${COMFY_URL}/history/${promptId}`);
      if (r.ok) {
        const history = await r.json();
        const entry = history?.[promptId] || history?.[String(promptId)];
        if (entry?.outputs) {
          if (entry.outputs["28"]?.images?.length) return entry.outputs["28"].images[0];
          for (const nodeId of Object.keys(entry.outputs)) {
            const out = entry.outputs[nodeId];
            if (out?.images?.length) return out.images[0];
          }
        }
      }
    } catch {}
    await sleep(2500);
  }

  return null;
}

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/test-comfy", async (req, res) => {
  try {
    const r = await fetch(COMFY_URL);
    res.json({ ok: true, comfyUrl: COMFY_URL, status: r.status });
  } catch (err) {
    res.status(500).json({ ok: false, comfyUrl: COMFY_URL, error: err.message });
  }
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

  if (sort === "popular") {
    items = [...items].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (sort === "newest") {
    items = [...items];
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

app.post("/api/run-comfy", async (req, res) => {
  try {
    const { public_id, gallery } = req.body || {};

    if (gallery !== "private") {
      return res.status(400).json({ success: false, error: "Only private gallery items can run this workflow." });
    }

    const item = mediaStore.find(x => x.public_id === public_id && x.gallery === "private");
    if (!item) {
      return res.status(404).json({ success: false, error: "Image not found." });
    }

    if (!fs.existsSync(WORKFLOW_PATH)) {
      return res.status(500).json({ success: false, error: "Workflow file not found." });
    }

    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
    if (!workflow["1"] || !workflow["1"].inputs) {
      return res.status(500).json({ success: false, error: "Workflow node 1 not found." });
    }

    const localSourcePath = path.join(UPLOADS_DIR, item.filename || "");
    if (!fs.existsSync(localSourcePath)) {
      return res.status(500).json({ success: false, error: "Local source file not found." });
    }

    const sourceBuffer = fs.readFileSync(localSourcePath);
    const uploadForm = new FormData();
    uploadForm.append("image", new Blob([sourceBuffer]), `${item.filename || public_id}.png`);

    const uploadResp = await fetch(`${COMFY_URL}/upload/image`, {
      method: "POST",
      body: uploadForm
    });

    if (!uploadResp.ok) {
      const text = await uploadResp.text().catch(() => "");
      return res.status(500).json({ success: false, error: `Failed to upload image to ComfyUI. ${text}` });
    }

    const uploadData = await uploadResp.json().catch(() => ({}));
    const uploadedName = uploadData.name || uploadData.filename || uploadData.path;
    if (!uploadedName) {
      return res.status(500).json({ success: false, error: "ComfyUI did not return an uploaded image name." });
    }

    workflow["1"].inputs.image = uploadedName;

    const promptResp = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: "gallery-app" })
    });

    const promptData = await promptResp.json().catch(() => ({}));
    if (!promptResp.ok) {
      return res.status(500).json({ success: false, error: "Failed to queue ComfyUI workflow.", details: promptData });
    }

    const promptId = promptData.prompt_id || promptData.promptId || promptData.id;
    if (!promptId) {
      return res.status(500).json({ success: false, error: "No prompt id returned." });
    }

    const resultImage = await waitForComfyResult(promptId, 120000);
    if (!resultImage) {
      return res.status(500).json({ success: false, error: "Workflow finished but no output image was found." });
    }

    const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(resultImage.filename)}&subfolder=${encodeURIComponent(resultImage.subfolder || "")}&type=${encodeURIComponent(resultImage.type || "output")}`;
    const viewResp = await fetch(viewUrl);

    if (!viewResp.ok) {
      return res.status(500).json({ success: false, error: "Could not fetch ComfyUI output image." });
    }

    const outputBuffer = Buffer.from(await viewResp.arrayBuffer());

    const saved = saveImageToGallery({
      buffer: outputBuffer,
      filename: `comfy_${Date.now()}_${public_id}.png`,
      gallery: "private",
      caption: "ComfyUI result",
      source: "comfy"
    });

    return res.json({ success: true, saved });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server started");
});