const express = require('express');
const router = express.Router();
const {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  permanentDeleteStudent,
  resetStudentPassword,
  listAdmins,
  getAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  permanentDeleteAdmin,
  resetAdminPassword,
  listAuditLogs,
} = require('../controllers/ownerController');
const { verifyOwner } = require('../middleware/authMiddleware');
const { ownerLimiter } = require('../middleware/rateLimiter');

// Guard all owner routes with strict rate limiting and JWT owner verification
router.use(ownerLimiter);
router.use(verifyOwner);

// Student Management Endpoints
router.get('/students', listStudents);
router.get('/students/:id', getStudent);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.delete('/students/:id/permanent', permanentDeleteStudent);
router.post('/students/:id/reset-password', resetStudentPassword);

// Admin Account Management Endpoints
router.get('/admins', listAdmins);
router.get('/admins/:id', getAdmin);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.delete('/admins/:id', deleteAdmin);
router.delete('/admins/:id/permanent', permanentDeleteAdmin);
router.post('/admins/:id/reset-password', resetAdminPassword);

// Audit Logs Viewer
router.get('/audit-logs', listAuditLogs);

module.exports = router;
