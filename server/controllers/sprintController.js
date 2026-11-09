const Sprint = require('../models/Sprint');
const Board = require('../models/Board');
const Task = require('../models/Task');
const { logActivity } = require('./activityLogController');

exports.getSprintsByBoard = async (req, res) => {
    const { boardId } = req.params;

    try {
        const sprints = await Sprint.find({ board: boardId }).sort({ startsOn: -1 });
        res.json(sprints);
    } catch (err) {
        console.error('Error fetching sprints:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getSprintById = async (req, res) => {
    const { id } = req.params;

    try {
        const sprint = await Sprint.findById(id);
        if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
        res.json(sprint);
    } catch (err) {
        console.error('Error fetching sprint:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.createSprint = async (req, res) => {
    const { boardId, name, goal, startsOn, endsOn, committedPoints } = req.body;
    const userId = req.user._id;

    if (!boardId || !name || !startsOn || !endsOn) {
        return res.status(400).json({ message: 'boardId, name, startsOn and endsOn are required' });
    }

    try {
        const board = await Board.findById(boardId);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isMember = board.owner.toString() === userId.toString() ||
            board.members.some(m => m.user.toString() === userId.toString() && m.role === 'admin');
        if (!isMember) return res.status(403).json({ message: 'Only admins and owners can create sprints' });

        const sprint = await Sprint.create({
            board: boardId,
            name,
            goal: goal || '',
            startsOn: new Date(startsOn),
            endsOn: new Date(endsOn),
            committedPoints: committedPoints || 0,
            status: 'planned'
        });

        await logActivity({
            boardId,
            userId,
            action: `created sprint "${sprint.name}"`
        });

        res.status(201).json(sprint);
    } catch (err) {
        console.error('Error creating sprint:', err);
        res.status(500).json({ message: err.message });
    }
};
