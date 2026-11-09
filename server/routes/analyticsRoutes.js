const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const {
    getBurndownChart,
    getVelocityChart,
    getCycleTimeChart,
    getFlowChart,
    getBoardHealth,
    getTeamCapacity
} = require('../controllers/analyticsController');
const { getSchedule, getGraph, createDependency } = require('../controllers/scheduleController');
const { getDigest, refreshDigest } = require('../controllers/aiController');

// Sprint analytics
router.get('/sprints/:id/burndown', protect, getBurndownChart);

// Board analytics & project controls
router.get('/boards/:id/velocity', protect, getVelocityChart);
router.get('/boards/:id/cycle-time', protect, getCycleTimeChart);
router.get('/boards/:id/flow', protect, getFlowChart);
router.get('/boards/:id/health', protect, getBoardHealth);
router.get('/boards/:id/capacity', protect, getTeamCapacity);

// CPM Schedule & Dependency Graph
router.get('/boards/:id/schedule', protect, getSchedule);
router.get('/boards/:id/graph', protect, getGraph);
router.post('/boards/:id/dependencies', protect, createDependency);

// AI Delivery Digest
router.get('/boards/:id/digest', protect, getDigest);
router.post('/boards/:id/digest/refresh', protect, refreshDigest);

module.exports = router;
