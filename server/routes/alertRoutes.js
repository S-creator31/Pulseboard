const express = require('express');
const protect = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { getAlertSettings, updateAlertSettings } = require('../controllers/alertController');

const router = express.Router();
router.get('/boards/:boardId/alerts', protect, requireRole('admin'), getAlertSettings);
router.put('/boards/:boardId/alerts', protect, requireRole('admin'), updateAlertSettings);

module.exports = router;
