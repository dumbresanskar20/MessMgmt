const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const AdminUser = require('../models/AdminUser');

// Middleware to verify Student JWT
const verifyStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production');

    if (decoded.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Forbidden. Student access required.' });
    }

    const student = await Student.findById(decoded.id).select('-password_hash');
    if (!student) {
      return res.status(401).json({ success: false, message: 'Student account not found.' });
    }

    if (!student.is_verified) {
      return res.status(403).json({ success: false, message: 'Student email/account is not verified.' });
    }

    req.user = student;
    req.studentId = student._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

// Middleware to verify Admin JWT
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - No Bearer token provided in headers.`);
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Authentication required. No token provided.' });
    }

    let token = authHeader.split(' ')[1];
    if (token) {
      token = token.replace(/^"(.*)"$/, '$1').trim();
    }

    if (!token || token === 'null' || token === 'undefined') {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Null or empty Bearer token value.`);
      return res.status(401).json({ success: false, code: 'NO_TOKEN', message: 'Authentication required. Invalid token format.' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_access_key_change_in_production';
    const decoded = jwt.verify(token, jwtSecret);

    if (!['super_admin', 'staff'].includes(decoded.role)) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Invalid role: ${decoded.role}`);
      return res.status(403).json({ success: false, code: 'FORBIDDEN_ROLE', message: 'Forbidden. Admin access required.' });
    }

    const admin = await AdminUser.findById(decoded.id).select('-password_hash');
    if (!admin) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Admin ID ${decoded.id} not found in DB.`);
      return res.status(401).json({ success: false, code: 'ACCOUNT_NOT_FOUND', message: 'Admin account not found.' });
    }

    if (!admin.is_active) {
      console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - Admin account ${admin.username} is deactivated.`);
      return res.status(403).json({ success: false, code: 'ACCOUNT_DEACTIVATED', message: 'Admin account is deactivated.' });
    }

    req.admin = admin;
    req.adminId = admin._id;
    next();
  } catch (error) {
    console.warn(`[verifyAdmin Auth Fail] Path: ${req.originalUrl} - JWT error: ${error.name} (${error.message})`);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid authentication token.' });
  }
};

// Middleware to enforce specific admin roles (e.g., super_admin)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of roles: [${roles.join(', ')}]`,
      });
    }
    next();
  };
};

module.exports = {
  verifyStudent,
  verifyAdmin,
  requireRole,
};
