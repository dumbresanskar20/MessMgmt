const cloudinary = require('cloudinary').v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret || cloudName === 'your_cloud_name_here') {
  console.warn(
    '\n⚠️  [Cloudinary Config Warning] Missing or default Cloudinary environment variables.\n' +
    '   Please fill CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env to enable live image uploads.\n'
  );
}

cloudinary.config({
  cloud_name: cloudName || 'demo',
  api_key: apiKey || '1234567890',
  api_secret: apiSecret || 'secret',
  secure: true,
});

module.exports = cloudinary;
