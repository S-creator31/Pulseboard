const express = require('express')
const router = express.Router()
const {createTask, getTasksByBoard, moveTaskToList, updateTaskStatus, deleteTask} = require('../controllers/taskController');
const checkBoardAccess = require('../middlewares/checkBoardAccess');


const protect = require('../middlewares/authMiddleware');


router.post('/', protect, checkBoardAccess, createTask);
router.get('/board/:boardId', protect, checkBoardAccess, getTasksByBoard);
router.put('/:taskId/move', protect, moveTaskToList);
router.patch('/:taskId/status', protect, updateTaskStatus);
router.delete('/:taskId', protect, deleteTask);



module.exports = router;
