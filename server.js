const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const app = express();

app.use(express.json({ limit: "20mb" }));
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

const COMFYDEPLOY_API_KEY = process.env.COMFYDEPLOY_API_KEY || "";
const COMFYDEPLOY_ENDPOINT_URL = process.env.COMFYDEPLOY_ENDPOINT_URL || "";
const COMFYDEPLOY_DEPLOYMENT_ID = process.env.COMFYDEPLOY_DEPLOYMENT_ID || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(name) {
  return String(name || "image").replace(/[^a-z0-9_\-]+/gi, "_").replace(/_+/g, "_");
}

function fileUrl(filename) {
  if (!PUBLIC_BASE_URL) return `/uploads/${encodeURIComponent(filename)}`;
  return `${PUBLIC_BASE_URL}/uploads/${encodeURIComponent(filename)}`;
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

function getComfyOutputUrl(run) {
  if (!run) return null;
  return run.output_url || run.output?.url || run.result?.url || run.image_url || null;
}

async function createComfyDeployRun(imageUrl) {
  if (!COMFYDEPLOY_API_KEY || !COMFYDEPLOY_ENDPOINT_URL || !COMFYDEPLOY_DEPLOYMENT_ID) {
    throw new Error("Missing ComfyDeploy env vars");
  }

  const body = {
    deployment_id: COMFYDEPLOY_DEPLOYMENT_ID,
    inputs: {
      "49": imageUrl
    }
  };

  const resp = await fetch(COMFYDEPLOY_ENDPOINT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${COMFYDEPLOY_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`ComfyDeploy run failed: ${JSON.stringify(data)}`);
  return data;
}

async function getComfyDeployRun(runId) {
  const url = `${COMFYDEPLOY_ENDPOINT_URL.replace(/\/$/, "")}/${encodeURIComponent(runId)}`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${COMFYDEPLOY_API_KEY}`
    }
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`ComfyDeploy status failed: ${JSON.stringify(data)}`);
  return data;
}

async function waitForComfyDeployResult(runId, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await getComfyDeployRun(runId);
    const status = String(run.status || run.state || "").toLowerCase();
    const outputUrl = getComfyOutputUrl(run);

    if (outputUrl && (status === "completed" || status === "succeeded" || status === "success" || !status)) {
      return outputUrl;
    }

    if (status === "failed" || status === "error" || status === "cancelled") {
      throw new Error(`ComfyDeploy run failed: ${JSON.stringify(run)}`);
    }

    await sleep(3000);
  }

  throw new Error("Timed out waiting for ComfyDeploy result");
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
    const expected = String(process.env.FAMILY_CODE || "1234").trim();

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

    const localSourcePath = path.join(UPLOADS_DIR, item.filename || "");
    if (!fs.existsSync(localSourcePath)) {
      return res.status(500).json({ success: false, error: "Local source file not found." });
    }

    const publicImageUrl = fileUrl(item.filename);
    const run = await createComfyDeployRun(publicImageUrl);
    const runId = run.run_id || run.id || run.request_id || run.queue_id;
    const finalOutputUrl = runId ? await waitForComfyDeployResult(runId) : getComfyOutputUrl(run);

    if (!finalOutputUrl) {
      return res.status(500).json({ success: false, error: "No output returned from ComfyDeploy." });
    }

    const outputResp = await fetch(finalOutputUrl);
    if (!outputResp.ok) {
      return res.status(500).json({ success: false, error: "Could not fetch ComfyDeploy output image." });
    }

    const outputBuffer = Buffer.from(await outputResp.arrayBuffer());
    const saved = saveImageToGallery({
      buffer: outputBuffer,
      filename: `comfy_${Date.now()}_${public_id}.png`,
      gallery: "private",
      caption: "ComfyDeploy result",
      source: "comfydeploy"
    });

    return res.json({ success: true, saved, finalOutputUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Server started");
});