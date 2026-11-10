const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const {
    getRisk,
    getEstimates,
    upsertEstimate,
    deleteEstimate
} = require('../controllers/riskController');

// Mounted at /api (see app.js)
router.get('/boards/:id/risk', protect, requireRole('viewer'), getRisk);
router.get('/boards/:id/estimates', protect, requireRole('viewer'), getEstimates);
router.put('/boards/:id/estimates/:taskId', protect, requireRole('member'), upsertEstimate);
router.delete('/boards/:id/estimates/:taskId', protect, requireRole('member'), deleteEstimate);

module.exports = router;
