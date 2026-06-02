const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const UploadCountSchema = new mongoose.Schema({
  identifier: String,
  date: String,
  count: Number
});
const UploadCount = mongoose.model('UploadCount', UploadCountSchema);

const ChatMessageSchema = new mongoose.Schema({
  name: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

const LikeSchema = new mongoose.Schema({
  public_id: String,
  count: { type: Number, default: 0 }
});
const Like = mongoose.model('Like', LikeSchema);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pinterest-photos',
    resource_type: 'auto',
    allowed_formats: ['jpg','jpeg','png','gif','webp','bmp','svg','mp4','webm','mov','avi','mkv']
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 1000 }
});

// Middleware
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-here-change-this-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  res.locals.isAdmin = req.session.isAdmin || false;
  next();
});

// Admin login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.json({ success: true, isAdmin: true });
  } else {
    res.json({ success: false, isAdmin: false });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

app.get('/api/admin', (req, res) => {
  res.json({ isAdmin: req.session.isAdmin || false });
});

// Upload endpoint
app.post('/upload', upload.array('files', 1000), async (req, res) => {
  try {
    const identifier = req.ip || req.connection.remoteAddress;
    const today = new Date().toISOString().split('T')[0];
    const isAdmin = req.session.isAdmin || false;
    
    if (!isAdmin) {
      let uploadCount = await UploadCount.findOne({ identifier, date: today });
      
      if (!uploadCount) {
        uploadCount = new UploadCount({ identifier, date: today, count: 0 });
      }
      
      if (uploadCount.count >= 5) {
        return res.status(403).json({ 
          success: false, 
          error: 'Daily upload limit reached (5 images per day). Come back tomorrow!' 
        });
      }
      
      uploadCount.count += req.files.length;
      await uploadCount.save();
    }
    
    const files = req.files || [];
    const result = files.map(f => ({
      public_id: f.path.split('/').pop(),
      url: f.path,
      type: f.mimetype.startsWith('video/') ? 'video' : 'image',
      mimetype: f.mimetype,
      size: f.size
    }));
    
    res.json({ success: true, files: result, isAdmin });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// Get media with likes
app.get('/media', async (req, res) => {
  try {
    const sortBy = req.query.sort || 'newest';
    
    const searchResult = await cloudinary.search
      .expression('folder:pinterest-photos')
      .sort_by('created_at', 'desc')
      .max_results(500)
      .execute();
    
    const media = searchResult.resources.map(r => ({
      public_id: r.public_id,
      url: r.secure_url,
      type: r.resource_type === 'video' ? 'video' : 'image',
      mimetype: r.format ? (r.resource_type === 'video' ? 'video/mp4' : `image/${r.format}`) : 'image/jpeg',
      size: r.bytes,
      createdAt: r.created_at
    }));
    
    const likes = await Like.find();
    const likeMap = {};
    likes.forEach(l => {
      likeMap[l.public_id] = l.count;
    });
    
    media.forEach(m => {
      m.likes = likeMap[m.public_id] || 0;
    });
    
    if (sortBy === 'popular') {
      media.sort((a, b) => b.likes - a.likes);
    } else {
      media.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    res.json(media);
  } catch (err) {
    console.error('Media list error:', err);
    res.status(500).json([]);
  }
});

// Like an image
app.post('/api/like', async (req, res) => {
  const { public_id } = req.body;
  
  try {
    let like = await Like.findOne({ public_id });
    
    if (!like) {
      like = new Like({ public_id, count: 1 });
    } else {
      like.count += 1;
    }
    
    await like.save();
    
    res.json({ success: true, likes: like.count });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ success: false, error: 'Like failed' });
  }
});

// Delete all (admin only) - SIMPLIFIED VERSION
app.post('/delete-all', async (req, res) => {
  if (!req.session.isAdmin) {
    console.log('Delete failed: not admin');
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
  
  try {
    console.log('=== DELETE ALL STARTED ===');
    
    // Search for all resources
    const searchResult = await cloudinary.search
      .expression('folder:pinterest-photos')
      .max_results(500)
      .execute();
    
    console.log(`Found ${searchResult.resources.length} resources`);
    
    if (searchResult.resources.length === 0) {
      console.log('No resources to delete');
      return res.json({ 
        success: true, 
        message: 'No images to delete',
        deletedCount: 0
      });
    }
    
    const publicIds = searchResult.resources.map(r => r.public_id);
    console.log('Public IDs to delete:', publicIds.slice(0, 5), '...');
    
    // Delete each resource individually (more reliable)
    let deletedCount = 0;
    for (const publicId of publicIds) {
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
        deletedCount++;
        console.log(`Deleted: ${publicId}`);
      } catch (deleteErr) {
        console.error(`Failed to delete ${publicId}:`, deleteErr.message);
      }
    }
    
    // Delete all likes from MongoDB
    await Like.deleteMany({});
    console.log('Deleted all likes from MongoDB');
    
    console.log(`=== DELETE ALL COMPLETE: ${deletedCount} resources deleted ===`);
    
    res.json({ 
      success: true, 
      message: `Deleted ${deletedCount} images from Cloudinary`,
      deletedCount: deletedCount
    });
    
  } catch (err) {
    console.error('=== DELETE ALL ERROR ===');
    console.error(err);
    console.error('========================');
    
    res.status(500).json({ 
      success: false, 
      error: 'Delete failed: ' + err.message,
      details: err.toString()
    });
  }
});

// Chat endpoints
app.post('/api/chat', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ success: false, error: 'Name and message required' });
  }
  
  const chatMessage = new ChatMessage({ name, message });
  await chatMessage.save();
  
  res.json({ success: true });
});

app.get('/api/chat', async (req, res) => {
  const messages = await ChatMessage.find()
    .sort({ timestamp: -1 })
    .limit(100);
  
  res.json(messages.reverse());
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});