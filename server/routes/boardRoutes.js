const express = require('express');
const router = express.Router();
const {
    createBoard,
    getBoards,
    getBoardById,
    deleteBoard,
    addMember,
    updateMemberRole
} = require('../controllers/boardController');
const checkBoardAccess = require('../middlewares/checkBoardAccess');
const protect = require('../middlewares/authMiddleware.js');
const requireRole = require('../middlewares/requireRole');

router.post('/', protect, createBoard);
router.get('/', protect, getBoards);
router.get('/:id', protect, getBoardById);
router.delete('/:id', protect, requireRole('owner'), deleteBoard);
router.post('/:boardId/members', protect, requireRole('admin'), addMember);
router.get('/:boardId', protect, checkBoardAccess);
router.put('/:boardId/members/:memberId/role', protect, requireRole('admin'), updateMemberRole);

module.exports = router;
