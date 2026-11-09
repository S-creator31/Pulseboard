const express = require('express');
const router = express.Router();
const {
    createTask,
    getTasksByBoard,
    moveTaskToList,
    updateTaskStatus,
    updateTask,
    createSubtasksBulk,
    deleteTask
} = require('../controllers/taskController');
const checkBoardAccess = require('../middlewares/checkBoardAccess');
const protect = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

router.post('/', protect, checkBoardAccess, requireRole('member'), createTask);
router.get('/board/:boardId', protect, checkBoardAccess, getTasksByBoard);
router.put('/:taskId/move', protect, requireRole('member'), moveTaskToList);
router.patch('/:taskId/status', protect, requireRole('member'), updateTaskStatus);
router.put('/:taskId', protect, requireRole('member'), updateTask);
router.post('/:taskId/subtasks/bulk', protect, requireRole('member'), createSubtasksBulk);
router.delete('/:taskId', protect, requireRole('admin'), deleteTask);

module.exports = router;
