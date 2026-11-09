const express = require('express');
const router = express.Router();
const { createList, getListsByBoard, deleteList } = require('../controllers/listController');
const protect = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

router.post('/', protect, requireRole('admin'), createList);
router.get('/board/:boardId', protect, getListsByBoard);
router.delete('/:id', protect, requireRole('admin'), deleteList);

module.exports = router;
