const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";
const WORKFLOW_PATH = path.join(__dirname, "undress_workflow.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const mediaStore = global.mediaStore || [];
global.mediaStore = mediaStore;

function slugify(name) {
  return String(name || "image").replace(/[^a-z0-9_\-]+/gi, "_").replace(/_+/g, "_");
}

function saveImageToGallery({ buffer, filename, gallery, caption = "", source = "comfy" }) {
  const safe = slugify(filename);
  const filePath = path.join(UPLOADS_DIR, safe);
  fs.writeFileSync(filePath, buffer);

  const publicId = crypto.randomUUID();
  const item = {
    public_id: publicId,
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
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`${COMFY_URL}/history/${promptId}`);
      if (r.ok) {
        const history = await r.json();
        const entry = history?.[promptId] || history?.[String(promptId)];
        if (entry && entry.outputs) {
          for (const nodeId of Object.keys(entry.outputs)) {
            const out = entry.outputs[nodeId];
            if (out && out.images && out.images.length) {
              return { output: out.images[0], nodeId };
            }
          }
        }
      }
    } catch (e) {}
    await sleep(2500);
  }

  return null;
}

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
    let sourceBuffer;

    if (fs.existsSync(localSourcePath)) {
      sourceBuffer = fs.readFileSync(localSourcePath);
    } else {
      const host = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const imageResp = await fetch(`${host}${item.url}`);
      if (!imageResp.ok) {
        return res.status(500).json({ success: false, error: "Could not fetch source image." });
      }
      sourceBuffer = Buffer.from(await imageResp.arrayBuffer());
    }

    const uploadForm = new FormData();
    uploadForm.append("image", new Blob([sourceBuffer]), `${public_id}.png`);

    const uploadResp = await fetch(`${COMFY_URL}/upload/image`, {
      method: "POST",
      body: uploadForm
    });

    if (!uploadResp.ok) {
      return res.status(500).json({ success: false, error: "Failed to upload image to ComfyUI." });
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
      body: JSON.stringify({
        prompt: workflow,
        client_id: "gallery-app"
      })
    });

    const promptData = await promptResp.json().catch(() => ({}));
    if (!promptResp.ok) {
      return res.status(500).json({
        success: false,
        error: "Failed to queue ComfyUI workflow.",
        details: promptData
      });
    }

    const promptId = promptData.prompt_id || promptData.promptId || promptData.id;
    if (!promptId) {
      return res.status(500).json({ success: false, error: "No prompt id returned." });
    }

    const result = await waitForComfyResult(promptId, 120000);
    if (!result || !result.output) {
      return res.status(500).json({ success: false, error: "Workflow finished but no output image was found." });
    }

    const out = result.output;
    const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(out.filename)}&subfolder=${encodeURIComponent(out.subfolder || "")}&type=${encodeURIComponent(out.type || "output")}`;
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

app.use("/uploads", express.static(UPLOADS_DIR));

module.exports = app;