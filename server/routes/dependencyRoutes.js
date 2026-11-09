const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const { deleteDependency } = require('../controllers/scheduleController');

router.delete('/:id', protect, deleteDependency);

module.exports = router;
