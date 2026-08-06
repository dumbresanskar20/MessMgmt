const jwt = require('jsonwebtoken');
const prisma = require('../../database/prisma');

const developerAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');

    if (decoded.role !== 'developer') {
      return res.status(403).json({ success: false, message: 'Access denied. Developer role required.' });
    }

    const developer = await prisma.developer.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!developer) {
      return res.status(401).json({ success: false, message: 'Invalid token. Developer not found.' });
    }

    req.developer = developer;
    next();
  } catch (error) {
    console.error('[Dev Auth Middleware Error]', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

const developerRoleMiddleware = (req, res, next) => {
  if (!req.developer) {
    return res.status(403).json({ success: false, message: 'Access denied. Developer role required.' });
  }
  next();
};

module.exports = {
  developerAuthMiddleware,
  developerRoleMiddleware,
};
