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

// ... (all your existing functions: readJSON, writeJSON, loadState, etc. stay exactly the same) ...

// Keep all your existing routes unchanged until the end

// ==================== NEW: UNDRESS ENDPOINT (Private Gallery Only) ====================
app.post('/api/undress', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }

  const { imageUrl, public_id } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "No image URL provided" });

  const tempInput = path.join(TEMP_DIR, `input_${Date.now()}.jpg`);
  const tempOutput = path.join(TEMP_DIR, `output_${Date.now()}.png`);

  try {
    // Download image
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    fs.writeFileSync(tempInput, buffer);

    // Load ComfyUI workflow
    let workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'undress_workflow.json'), 'utf8'));

    // Set input image (Node 1)
    if (workflow["1"]) {
      workflow["1"].inputs.image = path.basename(tempInput);
    } else {
      throw new Error("Input node 1 not found");
    }

    // Send prompt to ComfyUI
    const promptRes = await fetch('http://127.0.0.1:8188/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow })
    });

    const { prompt_id } = await promptRes.json();

    // Poll for result
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

    if (!outputUrl) throw new Error("Generation timed out. Is ComfyUI running?");

    // Download result
    const resultRes = await fetch(outputUrl);
    const resultBuffer = await resultRes.buffer();
    fs.writeFileSync(tempOutput, resultBuffer);

    // Upload to Cloudinary (Private Gallery)
    configureCloudinary("private");
    const cloudinaryRes = await cloudinary.uploader.upload(tempOutput, {
      folder: "private_gallery",
      tags: ['ai-nude', 'undressed'],
    });

    // Add to private gallery state
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

    // Cleanup
    fs.unlinkSync(tempInput);
    fs.unlinkSync(tempOutput);

    res.json({
      success: true,
      url: cloudinaryRes.secure_url,
      message: "✅ Nude version created and added to Private Gallery!"
    });

  } catch (err) {
    console.error("Undress error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ... your existing app.listen at the bottom
app.listen(PORT, () => console.log(`Server running on ${PORT}`));