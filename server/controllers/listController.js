const Board = require('../models/Board');
const List = require('../models/List');
const Task = require('../models/Task');
const TaskDependency = require('../models/TaskDependency');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const TimeEntry = require('../models/TimeEntry');
const { logActivity } = require('./activityLogController');

exports.createList = async (req, res) => {
    const { title, boardId, statusKey } = req.body;

    try {
        const payload = { title, board: boardId };
        if (statusKey) payload.statusKey = statusKey;
        const list = await List.create(payload);

        res.status(201).json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getListsByBoard = async (req, res) => {
    const { boardId} = req.params;

    try{
        const lists = await List.find({board: boardId}).sort({order: 1}).populate({path: 'tasks', populate: {path: 'assignedTo', select: 'name email'}});
        res.json(lists);
    }catch(err){
        res.status(500).json({message: err.message});
    }
};

exports.deleteList = async (req, res) => {
    const listId = req.params.listId;
    const userId = req.user._id;

    try{
        const list = await List.findById(listId);
        if(!list){
            return res.status(404).json({message:'List not found'});
        }

        const board = await Board.findById(list.board);
        if(!board){
            return res.status(404).json({message:'Board not found'});
        }

        const isAuthorized = board.owner.toString() === userId.toString() ||
        board.members.some((m) => m.user.toString() === userId.toString() && m.role === 'admin');

        if(!isAuthorized){
            return res.status(403).json({message: 'Not Authorized to delete this list'})
        }

        const taskIds = (await Task.find({ board: board._id, list: list._id }).select('_id')).map(({ _id }) => _id);
        if (taskIds.length) {
            await Promise.all([
                TaskDependency.deleteMany({
                    board: board._id,
                    $or: [
                        { predecessor: { $in: taskIds } },
                        { successor: { $in: taskIds } }
                    ]
                }),
                TaskStatusHistory.deleteMany({ board: board._id, task: { $in: taskIds } }),
                TimeEntry.deleteMany({ task: { $in: taskIds } }),
                Task.deleteMany({ board: board._id, _id: { $in: taskIds } })
            ]);
        }
        await list.deleteOne();

        await logActivity({
            boardId: board._id,
            userId,
            action: `deleted a list: ${list.title}`
        });

        req.app.get('io')?.to(`board:${board._id}`).emit('list:deleted', {
            listId: list._id.toString()
        });

        res.json({message: 'List deleted successfully'});

    }catch(err){
        console.error('Error deleting list:', err);
        res.status(500).json({message: err.message});
    }
};
