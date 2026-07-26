const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Configure Multer Cloudinary storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mess-management/menu-items',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => {
      const fileName = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
      return `item_${Date.now()}_${fileName}`;
    },
  },
});

// Configure Multer instance with 2MB file size limit and image-only filter
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed!'), false);
    }
  },
});

// Middleware wrapper to handle Multer / Cloudinary upload errors cleanly
const handleImageUpload = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);

    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Image upload failed — file exceeds the 2MB size limit.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Image upload failed — ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: 'Image upload failed — please try a smaller file or check your connection.',
          error: err.message,
        });
      }
      next();
    });
  };
};

module.exports = {
  upload,
  handleImageUpload,
};
