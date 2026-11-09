const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const {
    logTime,
    getTimeEntriesByTask,
    deleteTimeEntry
} = require('../controllers/timeEntryController');

router.post('/tasks/:id/time', protect, logTime);
router.get('/tasks/:id/time', protect, getTimeEntriesByTask);
router.delete('/time-entries/:id', protect, deleteTimeEntry);

module.exports = router;
