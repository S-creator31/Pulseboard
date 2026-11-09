const express = require('express');
const router = express.Router();
const protect = require('../middlewares/authMiddleware');
const { getSprintsByBoard, getSprintById, createSprint } = require('../controllers/sprintController');

router.get('/board/:boardId', protect, getSprintsByBoard);
router.get('/:id', protect, getSprintById);
router.post('/', protect, createSprint);

module.exports = router;
