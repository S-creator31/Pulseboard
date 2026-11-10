const Board = require('../models/Board');
const Task = require('../models/Task');
const List = require('../models/List');

const ROLE_HIERARCHY = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4
};

/**
 * Middleware factory enforcing minimum role required on a board.
 * Resolves boardId from params (id, boardId, taskId, listId) or body/query.
 * @param {'viewer' | 'member' | 'admin' | 'owner'} minimumRole
 */
function requireRole(minimumRole = 'member') {
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 2;

    return async (req, res, next) => {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            let boardId = req.params?.boardId || req.body?.boardId || req.query?.boardId;

            // If taskId is provided, look up parent task's board
            if (!boardId && req.params?.taskId) {
                const task = await Task.findById(req.params.taskId);
                if (task) boardId = task.board;
            }

            // Resolve a list before treating a generic `id` as a board ID.
            if (!boardId && req.params?.listId) {
                const list = await List.findById(req.params.listId);
                if (list) boardId = list.board;
            }

            // Routes such as DELETE /boards/:id use `id` for the board itself.
            if (!boardId && req.params?.id) {
                boardId = req.params.id;
            }

            if (!boardId) {
                return next(); // Pass through if board cannot be resolved from route context
            }

            const board = await Board.findById(boardId);
            if (!board) {
                return res.status(404).json({ message: 'Board not found' });
            }

            // Board owner always has 'owner' role and passes all checks
            if (board.owner.toString() === userId.toString()) {
                req.userBoardRole = 'owner';
                return next();
            }

            const memberObj = board.members.find(m => m.user?.toString() === userId.toString());
            if (!memberObj) {
                return res.status(403).json({
                    message: 'You are not a member of this board'
                });
            }

            const userRole = memberObj.role || 'member';
            const userLevel = ROLE_HIERARCHY[userRole] || 1;

            if (userLevel < requiredLevel) {
                return res.status(403).json({
                    message: `Action requires ${minimumRole} role or higher. Your role: ${userRole}. Contact an admin or owner to upgrade permissions.`,
                    requiredRole: minimumRole,
                    currentRole: userRole
                });
            }

            req.userBoardRole = userRole;
            next();
        } catch (err) {
            console.error('requireRole error:', err);
            res.status(500).json({ message: 'Authorization error: ' + err.message });
        }
    };
}

module.exports = requireRole;
