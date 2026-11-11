const Task = require('../models/Task');
const Board = require('../models/Board');
const List = require('../models/List');
const User = require('../models/User');
const TaskDependency = require('../models/TaskDependency');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const { computeSchedule, CycleError } = require('../services/schedule');
const { logActivity } = require('./activityLogController');

const buildSubtaskDependencyEdges = (parentTaskId, subtasks, dependencies) => {
    const parentId = parentTaskId.toString();
    const edges = [];
    const seen = new Set();

    for (const dependency of dependencies) {
        const predecessorId = (dependency.predecessor?._id || dependency.predecessor).toString();
        const successorId = (dependency.successor?._id || dependency.successor).toString();

        for (const subtask of subtasks) {
            const edge = predecessorId === parentId
                ? { board: dependency.board, predecessor: subtask._id, successor: dependency.successor }
                : successorId === parentId
                    ? { board: dependency.board, predecessor: dependency.predecessor, successor: subtask._id }
                    : null;

            if (!edge) continue;
            const key = `${edge.predecessor.toString()}:${edge.successor.toString()}`;
            if (!seen.has(key)) {
                seen.add(key);
                edges.push(edge);
            }
        }
    }

    return edges;
};

exports.buildSubtaskDependencyEdges = buildSubtaskDependencyEdges;

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

        const destinationList = await List.findById(listId);
        if (!destinationList) {
            return res.status(404).json({ message: 'Destination list not found' });
        }

        const previousStatus = task.status;
        const newStatus = destinationList.statusKey || 'todo';
        const previousListId = task.list.toString();

        task.list = listId;
        task.status = newStatus;
        await task.save();

        // Create TaskStatusHistory if status changed
        if (previousStatus !== newStatus) {
            await TaskStatusHistory.create({
                task: task._id,
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
            taskId: task._id,
            fromStatus: previousStatus,
            toStatus: newStatus
        });

        const updatedTask = await task.populate('assignedTo', 'name email');
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
    const { subtasks, predecessorIds = [] } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(subtasks) || subtasks.length === 0) {
        return res.status(400).json({ message: 'subtasks array is required' });
    }
    if (!Array.isArray(predecessorIds) ||
        predecessorIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
        return res.status(400).json({ message: 'predecessorIds must be an array of task IDs' });
    }

    try {
        const parentTask = await Task.findById(taskId);
        if (!parentTask) return res.status(404).json({ message: 'Parent task not found' });

        const board = await Board.findById(parentTask.board);
        if (!board) return res.status(404).json({ message: 'Board not found' });
        const isMember = board.owner.toString() === userId.toString() ||
            board.members.some(member => member.user.toString() === userId.toString());
        if (!isMember) return res.status(403).json({ message: 'You are not a member of this board' });

        const dependencies = await TaskDependency.find({
            board: parentTask.board,
            $or: [{ predecessor: parentTask._id }, { successor: parentTask._id }]
        });
        const uniquePredecessorIds = [...new Set(predecessorIds)]
            .filter(id => id !== parentTask._id.toString());
        const selectedPredecessors = uniquePredecessorIds.length > 0
            ? await Task.find({ _id: { $in: uniquePredecessorIds }, board: parentTask.board })
            : [];
        if (selectedPredecessors.length !== uniquePredecessorIds.length) {
            return res.status(400).json({ message: 'Each predecessor must be a task on the same board' });
        }
        if (selectedPredecessors.length > 0) {
            const [boardTasks, boardDependencies] = await Promise.all([
                Task.find({ board: parentTask.board }),
                TaskDependency.find({ board: parentTask.board })
            ]);
            const proposedDependencies = [
                ...boardDependencies,
                ...selectedPredecessors.map(predecessor => ({
                    predecessor: predecessor._id,
                    successor: parentTask._id
                }))
            ];
            try {
                computeSchedule(boardTasks, proposedDependencies);
            } catch (err) {
                if (err instanceof CycleError) {
                    return res.status(409).json({ message: err.message, cycle: err.chain });
                }
                throw err;
            }
        }

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

        const dependenciesToReplace = [
            ...dependencies,
            ...selectedPredecessors.map(predecessor => ({
                board: parentTask.board,
                predecessor: predecessor._id,
                successor: parentTask._id
            }))
        ];
        const replacementDependencies = buildSubtaskDependencyEdges(
            parentTask._id,
            createdTasks,
            dependenciesToReplace
        );
        if (replacementDependencies.length > 0) {
            await TaskDependency.insertMany(replacementDependencies);
        }
        if (dependencies.length > 0) {
            await TaskDependency.deleteMany({ _id: { $in: dependencies.map(dependency => dependency._id) } });
        }

        await logActivity({
            boardId: parentTask.board,
            userId,
            action: `replaced "${parentTask.title}" with ${createdTasks.length} subtasks`,
            taskId: parentTask._id
        });

        await parentTask.deleteOne();

        res.status(201).json({ message: 'Task replaced with subtasks successfully', tasks: createdTasks });
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

        await TaskDependency.deleteMany({
            board: task.board,
            $or: [{ predecessor: task._id }, { successor: task._id }]
        });
        await task.deleteOne();

        await logActivity({
            boardId: board._id,
            userId: userId,
            action: `deleted a task: ${task.title}`,
            taskId: task._id
        });

        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).json({ message: err.message });
    }
};
