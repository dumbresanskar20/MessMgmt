const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = process.env.ATLAS_URI;
    if (!mongoUri || mongoUri.includes('example.mongodb.net')) {
      mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mess_management';
    }
    const poolMax = Number(process.env.DB_POOL_MAX || 20);
    const poolMin = Number(process.env.DB_POOL_MIN || 5);
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: poolMax,
      minPoolSize: poolMin,
    });
    console.log(`[Database] MongoDB connected successfully (Pool: ${poolMin}-${poolMax}) to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database] Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
