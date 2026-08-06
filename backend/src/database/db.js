const prisma = require('./prisma');

// connectDB wraps Prisma's $connect so server.js startup pattern is unchanged.
// DATABASE_URL is read from the environment — currently Aiven (dev), domainz.in later.
const connectDB = async (retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('[Database] MySQL connected successfully via Prisma.');
      return;
    } catch (error) {
      console.error(`[Database] Connection attempt ${i + 1}/${retries} failed: ${error.message}`);
      if (i < retries - 1) {
        console.log(`[Database] Retrying connection in ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  console.warn('[Database] Initial connection attempt failed. App will lazily connect on incoming requests.');
};

module.exports = connectDB;
