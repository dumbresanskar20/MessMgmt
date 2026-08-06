const express = require('express');
const router = express.Router();

const { login, getMe } = require('../controllers/devAuthController');
const { getStats, getCharts, getRecentActivities } = require('../controllers/devDashboardController');
const { getTables, generateBackup } = require('../controllers/devDbController');
const { list, get, create, update, remove, bulkDelete, bulkUpdate } = require('../controllers/devCrudController');
const { developerAuthMiddleware, developerRoleMiddleware } = require('../middlewares/devAuthMiddleware');

// Public Auth routes
router.post('/auth/login', login);

// Protected routes (Only accessible to authenticated developers)
router.use(developerAuthMiddleware);
router.use(developerRoleMiddleware);

// Profile detail
router.get('/auth/me', getMe);

// Dashboard routes
router.get('/dashboard/stats', getStats);
router.get('/dashboard/charts', getCharts);
router.get('/dashboard/activities', getRecentActivities);

// Database explorer routes
router.get('/database/tables', getTables);
router.get('/database/backup', generateBackup);

// Generic CRUD Operations for ANY model
router.get('/crud/:model', list);
router.get('/crud/:model/:id', get);
router.post('/crud/:model', create);
router.put('/crud/:model/:id', update);
router.delete('/crud/:model/:id', remove);
router.post('/crud/:model/bulk-delete', bulkDelete);
router.post('/crud/:model/bulk-update', bulkUpdate);

module.exports = router;
