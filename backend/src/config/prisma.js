const { PrismaClient } = require('@prisma/client');

// DATABASE_URL is environment-specific — currently pointed at Aiven for development;
// will be repointed to domainz.in cPanel MySQL for production deployment.
// No application code changes are needed to switch — only update the DATABASE_URL
// value in the deployment environment (e.g. Render's environment variables).
//
// Connection string format:
//   mysql://user:password@host:port/database?ssl-mode=REQUIRED
//
// The ssl-mode=REQUIRED parameter in the URL is sufficient for Aiven.
// When switching to domainz.in's MySQL, simply update DATABASE_URL — no code changes needed.

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
