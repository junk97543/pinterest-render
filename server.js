const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pinterest-photos',
    resource_type: 'auto', // images + videos
    allowed_formats: ['jpg','jpeg','png','gif','webp','bmp','svg','mp4','webm','mov','avi','mkv']
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 1000 }
});

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static('public'));

// Upload endpoint
app.post('/upload', upload.array('files', 1000), async (req, res) => {
  try {
    const files = req.files || [];
    const result = files.map(f => ({
      public_id: f.path.split('/').pop(), // Cloudinary public_id
      url: f.path,
      type: f.mimetype.startsWith('video/') ? 'video' : 'image',
      mimetype: f.mimetype,
      size: f.size
    }));
    res.json({ success: true, files: result });
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

// Delete all media
app.post('/delete-all', async (req, res) => {
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

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});