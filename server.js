const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();
const uploadDir = path.join(process.cwd(), "uploads");
const dbUrl = process.env.DB_URL || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "gallery";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// MongoDB client
let mongoClient;
let db;
let collection;

async function initDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(dbUrl);
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    collection = db.collection("media");
  }
}

// Ensure MongoDB is connected
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err) {
    console.error("MongoDB connection error:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.use(express.json());
app.use(express.static("public"));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "video/mp4", "video/webm", "video/quicktime"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  }
});

// Admin check
function isAdmin(req) {
  return req.session?.isAdmin === true;
}

// Session-based gallery access
function canAccessGallery(req, gallery) {
  if (gallery === "family") {
    return req.session?.familyAccess === true || isAdmin(req);
  }
  if (gallery === "private") {
    return isAdmin(req);
  }
  return false;
}

// Load state from MongoDB
async function loadState() {
  const state = {
    family: [],
    private: []
  };
  
  try {
    const docs = await collection.find({}).toArray();
    docs.forEach(doc => {
      if (doc.gallery === "family") {
        state.family.push(doc);
      } else if (doc.gallery === "private") {
        state.private.push(doc);
      }
    });
  } catch (err) {
    console.error("Error loading state:", err);
  }
  
  return state;
}

// Save state to MongoDB
async function saveState(state) {
  try {
    await collection.deleteMany({});
    
    const docs = [];
    if (state.family) {
      docs.push(...state.family.map(item => ({ ...item, gallery: "family" })));
    }
    if (state.private) {
      docs.push(...state.private.map(item => ({ ...item, gallery: "private" })));
    }
    
    if (docs.length > 0) {
      await collection.insertMany(docs);
    }
  } catch (err) {
    console.error("Error saving state:", err);
  }
}

// Auth routes
app.post("/api/admin-login", async (req, res) => {
  try {
    const { password } = req.body;
    if (password === "admin123") {
      req.session.isAdmin = true;
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Wrong password" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/admin-logout", async (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

app.post("/api/family-unlock", async (req, res) => {
  try {
    const { code } = req.body;
    if (code === "family123") {
      req.session.familyAccess = true;
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Wrong code" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unlock failed" });
  }
});

app.post("/api/family-logout", async (req, res) => {
  req.session.familyAccess = false;
  res.json({ success: true });
});

app.post("/api/switch-gallery", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const { gallery } = req.body;
    req.session.currentView = gallery === "private" ? "private" : "family";
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Switch failed" });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    res.json({
      isAdmin: isAdmin(req),
      familyAccess: req.session?.familyAccess === true,
      currentView: req.session?.currentView || "family"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Status failed" });
  }
});

// Get excluded tags
app.get("/api/excluded-tags", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const state = await loadState();
    const privateItems = state.private || [];
    
    const excludedTags = privateItems
      .filter(item => item.excluded === true)
      .map(item => item.tags?.[0])
      .filter(Boolean);
    
    res.json({ success: true, excludedTags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// Add excluded tag
app.post("/api/excluded-tags/add", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ error: "Tag required" });
    
    const state = await loadState();
    const items = state.private || [];
    
    const item = items.find(i => i.tags?.[0]?.toLowerCase() === tag.toLowerCase());
    if (item) {
      item.excluded = true;
      await saveState(state);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// Remove excluded tag
app.post("/api/excluded-tags/remove", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ error: "Tag required" });
    
    const state = await loadState();
    const items = state.private || [];
    
    const item = items.find(i => i.tags?.[0]?.toLowerCase() === tag.toLowerCase());
    if (item) {
      item.excluded = false;
      await saveState(state);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// Upload route
app.post("/upload", upload.array("files", 1000), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const gallery = req.body.gallery === "private" ? "private" : "family";
    if (!canAccessGallery(req, gallery)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const errors = [];
    const uploaded = [];

    for (const file of req.files) {
      try {
        const mimetype = file.mimetype;
        const type = mimetype.startsWith("image/") ? "image" : "video";
        const ext = path.extname(file.originalname);
        const publicId = uuidv4();

        const item = {
          public_id: publicId,
          url: `/uploads/${file.filename}`,
          type,
          gallery,
          mimetype,
          caption: "",
          tags: [],
          likes: 0,
          createdAt: new Date(),
          overlays: []
        };

        const result = await collection.insertOne(item);
        if (result.acknowledged) {
          uploaded.push(item);
        } else {
          errors.push(file.originalname);
        }
      } catch (err) {
        console.error("Upload error:", err);
        errors.push(file.originalname);
      }
    }

    res.json({
      success: true,
      count: uploaded.length,
      errors,
      items: uploaded
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Media route
app.get("/media", async (req, res) => {
  try {
    const sort = req.query.sort || "random";
    const gallery = req.query.gallery === "private" ? "private" : "family";
    
    if (!canAccessGallery(req, gallery)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const state = await loadState();
    const items = state[gallery] || [];

    if (sort === "newest") {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === "popular") {
      items.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load media" });
  }
});

// Get single media item by public_id (NEW - for album viewer)
app.get("/api/media/:public_id", async (req, res) => {
  try {
    const { public_id } = req.params;
    const { gallery: queryGallery } = req.query;
    const gallery = queryGallery === "private" ? "private" : "family";

    if (!canAccessGallery(req, gallery)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const item = await collection.findOne({ public_id: public_id, gallery });

    if (!item) {
      return res.status(404).json({ success: false, error: "Media not found" });
    }

    res.json({ success: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to load media" });
  }
});

// Like route
app.post("/api/like", async (req, res) => {
  try {
    const { public_id, gallery } = req.body;
    const targetGallery = gallery === "private" ? "private" : "family";

    if (!canAccessGallery(req, targetGallery)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await collection.findOneAndUpdate(
      { public_id: public_id, gallery: targetGallery },
      { $inc: { likes: 1 } }
    );

    if (result && result.likes !== undefined) {
      res.json({ success: true, likes: result.likes });
    } else {
      res.json({ success: false, error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Like failed" });
  }
});

// Tag route
app.post("/api/tag", async (req, res) => {
  try {
    const { public_id, tag, gallery } = req.body;
    const targetGallery = gallery === "private" ? "private" : "family";

    if (!canAccessGallery(req, targetGallery)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await collection.findOneAndUpdate(
      { public_id: public_id, gallery: targetGallery },
      { $push: { tags: tag } }
    );

    if (result) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Tag failed" });
  }
});

// Caption route
app.post("/api/caption", async (req, res) => {
  try {
    const { public_id, caption, gallery } = req.body;
    const targetGallery = gallery === "private" ? "private" : "family";

    if (!canAccessGallery(req, targetGallery)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await collection.findOneAndUpdate(
      { public_id: public_id, gallery: targetGallery },
      { $set: { caption } }
    );

    if (result) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Caption failed" });
  }
});

// Rate route
app.post("/api/rate", async (req, res) => {
  try {
    const { public_id, ratings, gallery } = req.body;
    const targetGallery = gallery === "private" ? "private" : "family";

    if (!canAccessGallery(req, targetGallery)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const ratingsArr = Object.entries(ratings).map(([k, v]) => `${k}:${v}`);
    const avg = Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length;

    const item = await collection.findOne({ public_id: public_id, gallery: targetGallery });
    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }

    const newTags = [...(item.tags || [])];
    ratingsArr.forEach(r => {
      if (!newTags.includes(r)) newTags.push(r);
    });

    await collection.findOneAndUpdate(
      { public_id: public_id, gallery: targetGallery },
      { $set: { ratings, tags: newTags, overallRating: avg } }
    );

    res.json({ success: true, overallRating: avg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Rate failed" });
  }
});

// Save overlays (NEW - for overlay persistence)
app.post("/api/overlay/save", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ success: false, error: "Admin only" });

    const { public_id, gallery, overlays } = req.body;
    const targetGallery = gallery === "private" ? "private" : "family";

    if (!canAccessGallery(req, targetGallery)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const result = await collection.findOneAndUpdate(
      { public_id: public_id, gallery: targetGallery },
      { $set: { overlays } }
    );

    if (result) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Overlay save failed" });
  }
});

// Delete route
app.post("/delete-all", async (req, res) => {
  try {
    const { gallery } = req.body;
    const targetGallery = gallery === "private" ? "private" : "family";

    if (!isAdmin(req)) {
      return res.status(401).json({ error: "Admin only" });
    }

    await collection.deleteMany({ gallery: targetGallery });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Delete single item
app.post("/api/delete-item", async (req, res) => {
  try {
    const { public_id, gallery, password } = req.body;
    
    if (password !== "admin123") {
      return res.status(401).json({ error: "Wrong password" });
    }

    const targetGallery = gallery === "private" ? "private" : "family";
    await collection.deleteOne({ public_id: public_id, gallery: targetGallery });
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Tier lists
app.post("/api/tierlists/save", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const { name, tiers } = req.body;
    const state = await loadState();
    if (!state.tierLists) state.tierLists = [];
    
    const existing = state.tierLists.find(t => t.name === name);
    if (existing) {
      existing.tiers = tiers;
    } else {
      state.tierLists.push({ name, tiers });
    }
    
    await saveState(state);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Save failed" });
  }
});

app.get("/api/tierlists", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const state = await loadState();
    res.json({ success: true, tierLists: state.tierLists || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// Albums
app.post("/api/albums/create", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    
    const state = await loadState();
    if (!state.albums) state.albums = [];
    
    if (state.albums.some(a => a.name === name)) {
      return res.json({ success: false, error: "Album already exists" });
    }
    
    const album = { name, items: [] };
    state.albums.push(album);
    await saveState(state);
    
    res.json({ success: true, album });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create failed" });
  }
});

app.post("/api/albums/add", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const { albumName, public_id, gallery } = req.body;
    if (!albumName || !public_id) return res.status(400).json({ error: "Missing data" });
    
    const state = await loadState();
    const album = state.albums?.find(a => a.name === albumName);
    
    if (!album) {
      return res.json({ success: false, error: "Album not found" });
    }
    
    if (!album.items.some(i => i.public_id === public_id)) {
      album.items.push({ public_id, gallery });
      await saveState(state);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Add failed" });
  }
});

app.get("/api/albums", async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Admin only" });
    
    const state = await loadState();
    res.json({ success: true, albums: state.albums || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// Session middleware
app.use((req, res, next) => {
  if (!req.session) {
    req.session = {};
  }
  next();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});