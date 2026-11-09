const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const { breakdownTask } = require('../controllers/aiController');

router.post('/tasks/:id/breakdown', protect, breakdownTask);

module.exports = router;
