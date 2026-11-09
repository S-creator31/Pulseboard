const TimeEntry = require('../models/TimeEntry');
const Task = require('../models/Task');
const Board = require('../models/Board');
const { logActivity } = require('./activityLogController');

exports.logTime = async (req, res) => {
    const { id: taskId } = req.params;
    const { minutes, loggedOn, note } = req.body;
    const userId = req.user._id;

    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
        return res.status(400).json({ message: 'Valid minutes (>0) is required' });
    }

    try {
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const board = await Board.findById(task.board);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isMember = board.owner.toString() === userId.toString() ||
            board.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) return res.status(403).json({ message: 'Not authorized for this board' });

        const entry = await TimeEntry.create({
            task: taskId,
            user: userId,
            minutes,
            loggedOn: loggedOn ? new Date(loggedOn) : new Date(),
            note: note || ''
        });

        const hoursLogged = +(minutes / 60).toFixed(1);
        await logActivity({
            boardId: board._id,
            userId,
            action: `logged ${hoursLogged}h on task "${task.title}"`,
            taskId: task._id
        });

        const populated = await entry.populate('user', 'name email');
        res.status(201).json(populated);
    } catch (err) {
        console.error('Error logging time:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getTimeEntriesByTask = async (req, res) => {
    const { id: taskId } = req.params;

    try {
        const entries = await TimeEntry.find({ task: taskId })
            .populate('user', 'name email')
            .sort({ loggedOn: -1, createdAt: -1 });

        const totalMinutes = entries.reduce((acc, e) => acc + (e.minutes || 0), 0);
        const actualHours = +(totalMinutes / 60).toFixed(1);

        res.json({
            entries,
            totalMinutes,
            actualHours
        });
    } catch (err) {
        console.error('Error fetching time entries:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.deleteTimeEntry = async (req, res) => {
    const { id: entryId } = req.params;
    const userId = req.user._id;

    try {
        const entry = await TimeEntry.findById(entryId);
        if (!entry) return res.status(404).json({ message: 'Time entry not found' });

        // Own entries only, or board owner
        if (entry.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You can only delete your own time entries' });
        }

        const task = await Task.findById(entry.task);
        await entry.deleteOne();

        if (task) {
            await logActivity({
                boardId: task.board,
                userId,
                action: `removed ${+(entry.minutes / 60).toFixed(1)}h time log from "${task.title}"`,
                taskId: task._id
            });
        }

        res.json({ message: 'Time entry deleted successfully' });
    } catch (err) {
        console.error('Error deleting time entry:', err);
        res.status(500).json({ message: err.message });
    }
};
