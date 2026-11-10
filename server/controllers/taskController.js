const Task = require('../models/Task');
const Board = require('../models/Board');
const List = require('../models/List');
const User = require('../models/User');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const { logActivity } = require('./activityLogController');

exports.createTask = async (req, res) => {
    const {
        title,
        description,
        listId,
        boardId,
        assignedTo,
        priority,
        estimateHours,
        storyPoints,
        startDate,
        durationDays,
        sprint
    } = req.body;
    const userId = req.user._id;

    if (!title || !listId || !boardId) {
        return res.status(400).json({ message: 'Title, listId, and boardId are required' });
    }

    try {
        const board = await Board.findById(boardId);
        if (!board) {
            return res.status(404).json({ message: "Board not found" });
        }

        const isMember = board.members.some(member => member.user.toString() === userId.toString()) ||
            board.owner.toString() === userId.toString();
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this board' });
        }

        if (assignedTo) {
            const userToAssign = await User.findById(assignedTo);
            if (!userToAssign) {
                return res.status(404).json({ message: 'Assigned user not found' });
            }

            const isAssignedMember = board.members.some(member => member.user.toString() === assignedTo.toString()) ||
                board.owner.toString() === assignedTo.toString();
            if (!isAssignedMember) {
                return res.status(403).json({ message: 'Assigned user is not a member of this board' });
            }
        }

        const list = await List.findById(listId);
        const initialStatus = list ? (list.statusKey || 'todo') : 'todo';

        const task = await Task.create({
            title,
            description: description || '',
            list: listId,
            board: boardId,
            assignedTo: assignedTo || null,
            status: initialStatus,
            priority: priority || 'medium',
            estimateHours: typeof estimateHours === 'number' ? estimateHours : (parseFloat(estimateHours) || 0),
            storyPoints: typeof storyPoints === 'number' ? storyPoints : (parseInt(storyPoints, 10) || 0),
            startDate: startDate ? new Date(startDate) : undefined,
            durationDays: typeof durationDays === 'number' ? durationDays : (parseInt(durationDays, 10) || 1),
            sprint: sprint || undefined
        });

        const populatedTask = await task.populate('assignedTo', 'name email');

        // Record initial status history
        await TaskStatusHistory.create({
            task: task._id,
            board: boardId,
            fromStatus: null,
            toStatus: initialStatus,
            changedBy: userId,
            changedAt: new Date()
        });

        await logActivity({
            boardId,
            userId,
            action: `created task "${task.title}"`,
            taskId: task._id,
            toStatus: initialStatus
        });

        res.status(201).json(populatedTask);
    } catch (err) {
        console.error('Error creating task:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getTasksByBoard = async (req, res) => {
    const { boardId } = req.params;

    try {
        const tasks = await Task.find({ board: boardId })
            .populate('assignedTo', 'name email')
            .populate('sprint', 'name status');
        res.status(200).json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ message: 'Failed to fetch tasks' });
    }
};

exports.moveTaskToList = async (req, res) => {
    try {
        const { listId } = req.body;
        const { taskId } = req.params;
        const userId = req.user._id;

        if (!listId) {
            return res.status(400).json({ message: 'listId is required' });
        }

        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const board = await Board.findById(task.board);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        // Authorization check: User must be member or owner of the board
        const isMember = board.owner.toString() === userId.toString() ||
            board.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this board' });
        }

        const destinationList = await List.findOne({ _id: listId, board: board._id });
        if (!destinationList) {
            return res.status(404).json({ message: 'Destination list not found' });
        }

        const previousStatus = task.status;
        const newStatus = destinationList.statusKey || 'todo';
        const previousListId = task.list.toString();

        // Restrict the update to the list read above so genuinely concurrent
        // moves cannot overwrite each other. Sequential moves read the latest
        // list from MongoDB and remain valid even if the client has stale metadata.
        const movedTask = await Task.findOneAndUpdate(
            { _id: taskId, board: board._id, list: task.list },
            { $set: { list: listId, status: newStatus } },
            { new: true }
        );
        if (!movedTask) {
            const current = await Task.findById(taskId).select('list');
            return res.status(409).json({
                message: 'Task was moved concurrently. Refresh the board and retry.',
                currentListId: current?.list?.toString()
            });
        }

        // Create TaskStatusHistory if status changed
        if (previousStatus !== newStatus) {
            await TaskStatusHistory.create({
                task: movedTask._id,
                board: board._id,
                fromStatus: previousStatus,
                toStatus: newStatus,
                changedBy: userId,
                changedAt: new Date()
            });
        }

        // Log activity with from/to
        await logActivity({
            boardId: board._id,
            userId,
            action: previousStatus !== newStatus
                ? `moved "${task.title}" to ${destinationList.title} (${newStatus})`
                : `moved "${task.title}" to ${destinationList.title}`,
            taskId: movedTask._id,
            fromStatus: previousStatus,
            toStatus: newStatus
        });

        const updatedTask = await movedTask.populate('assignedTo', 'name email');
        req.app.get('io')?.to(`board:${board._id}`).emit('task:moved', {
            task: updatedTask,
            fromListId: previousListId,
            toListId: listId,
            movedBy: userId.toString()
        });
        res.json({ message: 'Task moved successfully', task: updatedTask });
    } catch (err) {
        console.error('Error moving task:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.updateTaskStatus = async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    const ALLOWED_STATUSES = ['todo', 'in-progress', 'done'];
    if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const board = await Board.findById(task.board);
        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        const isMember = board.members.some(member => member.user.toString() === userId.toString()) ||
            board.owner.toString() === userId.toString();
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this board' });
        }

        const previousStatus = task.status;
        task.status = status;
        await task.save();

        const populatedTask = await task.populate('assignedTo', 'name email');

        if (previousStatus !== status) {
            await TaskStatusHistory.create({
                task: task._id,
                board: board._id,
                fromStatus: previousStatus,
                toStatus: status,
                changedBy: userId,
                changedAt: new Date()
            });

            await logActivity({
                boardId: board._id,
                userId,
                action: status === 'done'
                    ? `marked "${task.title}" as done`
                    : `reopened "${task.title}" to ${status}`,
                taskId: task._id,
                fromStatus: previousStatus,
                toStatus: status
            });

            req.app.get('io')?.to(`board:${board._id}`).emit('task:status', {
                task: populatedTask,
                changedBy: userId.toString()
            });
        }

        res.status(200).json(populatedTask);
    } catch (err) {
        console.error('Error updating task status:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.updateTask = async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user._id;
    const { title, description, assignedTo, priority, estimateHours, storyPoints, startDate, durationDays, sprint } = req.body;

    try {
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const board = await Board.findById(task.board);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isMember = board.members.some(member => member.user.toString() === userId.toString()) ||
            board.owner.toString() === userId.toString();
        if (!isMember) return res.status(403).json({ message: 'You are not a member of this board' });

        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
        if (priority !== undefined) task.priority = priority;
        if (estimateHours !== undefined) task.estimateHours = estimateHours;
        if (storyPoints !== undefined) task.storyPoints = storyPoints;
        if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : undefined;
        if (durationDays !== undefined) task.durationDays = durationDays;
        if (sprint !== undefined) task.sprint = sprint || undefined;

        await task.save();
        const populatedTask = await task.populate('assignedTo', 'name email');

        await logActivity({
            boardId: board._id,
            userId,
            action: `updated task "${task.title}"`,
            taskId: task._id
        });

        res.json(populatedTask);
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.createSubtasksBulk = async (req, res) => {
    const { taskId } = req.params;
    const { subtasks } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(subtasks) || subtasks.length === 0) {
        return res.status(400).json({ message: 'subtasks array is required' });
    }

    try {
        const parentTask = await Task.findById(taskId);
        if (!parentTask) return res.status(404).json({ message: 'Parent task not found' });

        const createdTasks = [];
        for (const st of subtasks) {
            const child = await Task.create({
                title: st.title,
                description: st.rationale || `Subtask of "${parentTask.title}"`,
                board: parentTask.board,
                list: parentTask.list,
                assignedTo: parentTask.assignedTo || userId,
                status: 'todo',
                estimateHours: st.estimateHours || 2,
                sprint: parentTask.sprint
            });

            await TaskStatusHistory.create({
                task: child._id,
                board: parentTask.board,
                fromStatus: null,
                toStatus: 'todo',
                changedBy: userId,
                changedAt: new Date()
            });

            createdTasks.push(child);
        }

        await logActivity({
            boardId: parentTask.board,
            userId,
            action: `added ${createdTasks.length} subtasks to "${parentTask.title}"`,
            taskId: parentTask._id
        });

        res.status(201).json({ message: 'Subtasks added successfully', tasks: createdTasks });
    } catch (err) {
        console.error('Error creating bulk subtasks:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.deleteTask = async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user._id;

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const board = await Board.findById(task.board);
        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        const isAuthorized = board.owner.toString() === userId.toString() ||
            board.members.some((m) => m.user.toString() === userId.toString() && m.role === 'admin');

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to delete this task' });
        }

        await task.deleteOne();

        await logActivity({
            boardId: board._id,
            userId: userId,
            action: `deleted a task: ${task.title}`,
            taskId: task._id
        });

        req.app.get('io')?.to(`board:${board._id}`).emit('task:deleted', {
            taskId: task._id.toString()
        });

        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).json({ message: err.message });
    }
};
