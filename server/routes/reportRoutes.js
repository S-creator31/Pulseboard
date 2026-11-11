const express = require('express');
const protect = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const { downloadDeliveryReport } = require('../controllers/reportController');

const router = express.Router();
router.get('/boards/:boardId/reports/:sprintId/:format', protect, requireRole('viewer'), downloadDeliveryReport);

module.exports = router;
