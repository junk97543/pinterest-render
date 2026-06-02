const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const UploadCountSchema = new mongoose.Schema({
  identifier: String, // IP address or username
  date: String, // YYYY-MM-DD
  count: Number
});
const UploadCount = mongoose.model('UploadCount', UploadCountSchema);

const ChatMessageSchema = new mongoose.Schema({
  name: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

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
  secret: 'your-secret-key-here-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using HTTPS
}));

// Check if user is admin
app.use((req, res, next) => {
  res.locals.isAdmin = req.session.isAdmin || false;
  next();
});

// Admin login
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  const isMatch = await bcrypt.compare(password, adminPassword);
  if (isMatch) {
    req.session.isAdmin = true;
    res.json({ success: true, isAdmin: true });
  } else {
    res.json({ success: false, isAdmin: false });
  }
});

// Admin logout
app.post('/api/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

// Check admin status
app.get('/api/admin', (req, res) => {
  res.json({ isAdmin: req.session.isAdmin || false });
});

// Upload endpoint with limit
app.post('/upload', upload.array('files', 1000), async (req, res) => {
  try {
    const identifier = req.ip || req.connection.remoteAddress;
    const today = new Date().toISOString().split('T')[0];
    
    // Check if admin (unlimited)
    const isAdmin = req.session.isAdmin || false;
    
    if (!isAdmin) {
      // Get or create upload count
      let uploadCount = await UploadCount.findOne({ identifier, date: today });
      
      if (!uploadCount) {
        uploadCount = new UploadCount({ identifier, date: today, count: 0 });
      }
      
      // Check limit (5 per day for non-admin)
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

// List all media
app.get('/media', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:pinterest-photos')
      .sort_by('created_at', 'desc')
      .max_results(500)
      .execute();
    
    const media = result.resources.map(r => ({
      public_id: r.public_id,
      url: r.secure_url,
      type: r.resource_type === 'video' ? 'video' : 'image',
      mimetype: r.format ? (r.resource_type === 'video' ? 'video/mp4' : `image/${r.format}`) : 'image/jpeg',
      size: r.bytes,
      createdAt: r.created_at
    }));
    
    res.json(media);
  } catch (err) {
    console.error('Media list error:', err);
    res.status(500).json([]);
  }
});

// Delete all (admin only)
app.post('/delete-all', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }
  
  try {
    const result = await cloudinary.search
      .expression('folder:pinterest-photos')
      .max_results(500)
      .execute();
    
    const publicIds = result.resources.map(r => r.public_id);
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds, { resource_type: 'auto' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete all error:', err);
    res.status(500).json({ success: false, error: 'Delete failed' });
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