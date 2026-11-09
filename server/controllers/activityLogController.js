const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({ boardId, userId, action, taskId, fromStatus, toStatus }) => {
    try {
        await ActivityLog.create({
            board: boardId,
            user: userId,
            action,
            task: taskId || undefined,
            fromStatus: fromStatus || undefined,
            toStatus: toStatus || undefined,
        });
    } catch (err) {
        console.error('Activity log Failed:', err.message);
    }
};

const getActivityLogsByBoard = async (req, res) => {
    const { boardId } = req.params;
    const { cursor, actor, action, limit = 20, taskId } = req.query;

    try {
        const query = { board: boardId };

        if (actor) {
            query.user = actor;
        }

        if (action) {
            query.action = { $regex: action, $options: 'i' };
        }

        if (taskId) {
            query.task = taskId;
        }

        if (cursor) {
            // cursor is base64 or ISO date + _id, format: `${createdAt}_${_id}`
            const [cursorDate, cursorId] = cursor.split('_');
            if (cursorDate && cursorId) {
                query.$or = [
                    { createdAt: { $lt: new Date(cursorDate) } },
                    { createdAt: new Date(cursorDate), _id: { $lt: cursorId } }
                ];
            }
        }

        const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const logs = await ActivityLog.find(query)
            .populate('user', 'name email')
            .populate('task', 'title')
            .sort({ createdAt: -1, _id: -1 })
            .limit(pageSize + 1);

        const hasMore = logs.length > pageSize;
        const items = hasMore ? logs.slice(0, pageSize) : logs;
        let nextCursor = null;

        if (hasMore && items.length > 0) {
            const lastItem = items[items.length - 1];
            nextCursor = `${lastItem.createdAt.toISOString()}_${lastItem._id}`;
        }

        res.json({ items, nextCursor });
    } catch (err) {
        console.error('Error fetching activity logs:', err);
        res.status(500).json({ message: 'Error fetching activity logs' });
    }
};

module.exports = { logActivity, getActivityLogsByBoard };
