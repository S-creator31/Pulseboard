const Task = require('../models/Task');
const TaskDependency = require('../models/TaskDependency');
const Board = require('../models/Board');
const { computeSchedule, CycleError } = require('../services/schedule');
const { logActivity } = require('./activityLogController');

exports.getSchedule = async (req, res) => {
    const { id: boardId } = req.params;

    try {
        const [tasks, dependencies] = await Promise.all([
            Task.find({ board: boardId }).populate('assignedTo', 'name email').populate('sprint', 'name'),
            TaskDependency.find({ board: boardId })
        ]);

        const schedule = computeSchedule(tasks, dependencies);
        res.json(schedule);
    } catch (err) {
        console.error('Error computing schedule:', err);
        if (err instanceof CycleError) {
            return res.status(409).json({ message: err.message, cycle: err.chain });
        }
        res.status(500).json({ message: err.message });
    }
};

exports.getGraph = async (req, res) => {
    const { id: boardId } = req.params;

    try {
        const [tasks, dependencies] = await Promise.all([
            Task.find({ board: boardId }).populate('assignedTo', 'name email'),
            TaskDependency.find({ board: boardId })
        ]);

        res.json({
            nodes: tasks.map(t => ({
                id: t._id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                assignedTo: t.assignedTo,
                durationDays: t.durationDays,
                estimateHours: t.estimateHours,
                startDate: t.startDate
            })),
            edges: dependencies.map(d => ({
                id: d._id,
                predecessor: d.predecessor,
                successor: d.successor
            }))
        });
    } catch (err) {
        console.error('Error fetching graph:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.createDependency = async (req, res) => {
    const { id: boardId } = req.params;
    const { predecessor, successor } = req.body;
    const userId = req.user._id;

    if (!predecessor || !successor) {
        return res.status(400).json({ message: 'predecessor and successor are required' });
    }

    if (predecessor === successor) {
        return res.status(400).json({ message: 'A task cannot depend on itself' });
    }

    try {
        const board = await Board.findById(boardId);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isMember = board.owner.toString() === userId.toString() ||
            board.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) return res.status(403).json({ message: 'Not authorized for this board' });

        const [tasks, existingDeps] = await Promise.all([
            Task.find({ board: boardId }),
            TaskDependency.find({ board: boardId })
        ]);

        // Hypothetical dependency set including new edge
        const testDeps = existingDeps.map(d => ({
            predecessor: d.predecessor.toString(),
            successor: d.successor.toString()
        }));
        testDeps.push({ predecessor: predecessor.toString(), successor: successor.toString() });

        // Cycle check: throws CycleError if cycle exists
        try {
            computeSchedule(tasks, testDeps);
        } catch (cycleErr) {
            if (cycleErr instanceof CycleError) {
                return res.status(409).json({
                    message: cycleErr.message,
                    cycle: cycleErr.chain
                });
            }
            throw cycleErr;
        }

        // Safe to save in DB
        const dependency = await TaskDependency.create({
            board: boardId,
            predecessor,
            successor
        });

        await logActivity({
            boardId,
            userId,
            action: 'added a task dependency'
        });

        res.status(201).json(dependency);
    } catch (err) {
        console.error('Error creating dependency:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'This dependency already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

exports.deleteDependency = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
        const dependency = await TaskDependency.findById(id);
        if (!dependency) return res.status(404).json({ message: 'Dependency not found' });

        const board = await Board.findById(dependency.board);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isMember = board.owner.toString() === userId.toString() ||
            board.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) return res.status(403).json({ message: 'Not authorized for this board' });

        await dependency.deleteOne();

        await logActivity({
            boardId: board._id,
            userId,
            action: 'removed a task dependency'
        });

        res.json({ message: 'Dependency removed successfully' });
    } catch (err) {
        console.error('Error deleting dependency:', err);
        res.status(500).json({ message: err.message });
    }
};
