const multer = require('multer');
const cloudinary = require('../config/cloudinary');

// Multer memory storage engine to hold buffers prior to Cloudinary / Data URI processing
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed!'), false);
    }
  },
});

// Helper function to stream buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'mess-management/menu-items',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// Middleware wrapper: Tries Cloudinary upload first, falls back seamlessly to Data URI if Cloudinary fails
const handleImageUpload = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);

    singleUpload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Image upload failed — file exceeds the 5MB size limit.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Image upload failed — ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: `Image upload error: ${err.message}`,
        });
      }

      // Process uploaded file buffer if present
      if (req.file && req.file.buffer) {
        try {
          const cloudResult = await uploadToCloudinary(req.file.buffer);
          req.file.path = cloudResult.secure_url;
          req.file.secure_url = cloudResult.secure_url;
          req.file.filename = cloudResult.public_id;
          req.file.public_id = cloudResult.public_id;
          console.log(`[Cloudinary] Successfully uploaded image: ${cloudResult.secure_url}`);
        } catch (cloudErr) {
          console.warn(`[Cloudinary Warning] Upload to Cloudinary API failed (${cloudErr.message}). Using Data URI fallback.`);
          const base64Data = req.file.buffer.toString('base64');
          const dataUri = `data:${req.file.mimetype};base64,${base64Data}`;
          req.file.path = dataUri;
          req.file.secure_url = dataUri;
          req.file.filename = null;
          req.file.public_id = null;
        }
      }

      next();
    });
  };
};

module.exports = {
  upload,
  handleImageUpload,
};
