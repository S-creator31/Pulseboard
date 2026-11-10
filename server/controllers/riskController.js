const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskDependency = require('../models/TaskDependency');
const TaskEstimate = require('../models/TaskEstimate');
const { CycleError } = require('../services/schedule');
const { computePertAnalysis, pertEstimate, EstimateError } = require('../services/pert');
const { logActivity } = require('./activityLogController');

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(v) {
    if (v === '' || v === null || v === undefined) return NaN;
    return Number(v);
}

function optionalNumber(v) {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

/** Parses 'YYYY-MM-DD' (or any ISO date) to a UTC-midnight Date, or null. */
function parseDay(value) {
    if (!value || typeof value !== 'string') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function todayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * GET /api/boards/:id/risk
 * Query: iterations, seed, distribution (pert|triangular), bins,
 *        startDate (YYYY-MM-DD, default today), deadline (YYYY-MM-DD) or deadlineDays
 */
exports.getRisk = async (req, res) => {
    const { id: boardId } = req.params;
    const { iterations, seed, distribution, bins, startDate, deadline, deadlineDays } = req.query;

    try {
        const start = parseDay(startDate) || todayUtc();

        let deadlineInDays = optionalNumber(deadlineDays);
        if (deadlineInDays === undefined && deadline) {
            const deadlineDate = parseDay(deadline);
            if (!deadlineDate) {
                return res.status(400).json({ message: 'deadline must be a valid date (YYYY-MM-DD)' });
            }
            deadlineInDays = Math.round((deadlineDate.getTime() - start.getTime()) / DAY_MS);
        }

        const [tasks, dependencies, estimates] = await Promise.all([
            Task.find({ board: boardId }),
            TaskDependency.find({ board: boardId }),
            TaskEstimate.find({ board: boardId })
        ]);

        const analysis = computePertAnalysis(tasks, dependencies, estimates, {
            iterations: optionalNumber(iterations),
            seed: optionalNumber(seed),
            bins: optionalNumber(bins),
            distribution: distribution || undefined,
            startDate: start,
            deadlineDays: deadlineInDays
        });

        res.json(analysis);
    } catch (err) {
        if (err instanceof CycleError) {
            return res.status(409).json({ message: err.message, cycle: err.chain });
        }
        if (err instanceof EstimateError) {
            return res.status(400).json({ message: err.message, taskId: err.taskId });
        }
        console.error('Error computing PERT / Monte Carlo risk:', err);
        res.status(500).json({ message: err.message });
    }
};

/** GET /api/boards/:id/estimates */
exports.getEstimates = async (req, res) => {
    const { id: boardId } = req.params;

    try {
        const estimates = await TaskEstimate.find({ board: boardId });
        res.json(estimates.map((e) => ({
            _id: e._id,
            task: e.task,
            optimistic: e.optimistic,
            mostLikely: e.mostLikely,
            pessimistic: e.pessimistic,
            ...pertEstimate(e.optimistic, e.mostLikely, e.pessimistic)
        })));
    } catch (err) {
        console.error('Error fetching estimates:', err);
        res.status(500).json({ message: err.message });
    }
};

/** PUT /api/boards/:id/estimates/:taskId   body: { optimistic, mostLikely, pessimistic } */
exports.upsertEstimate = async (req, res) => {
    const { id: boardId, taskId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(taskId)) {
        return res.status(400).json({ message: 'Invalid task id' });
    }

    const optimistic = toNumber(req.body.optimistic);
    const mostLikely = toNumber(req.body.mostLikely);
    const pessimistic = toNumber(req.body.pessimistic);

    let computed;
    try {
        computed = pertEstimate(optimistic, mostLikely, pessimistic);
    } catch (err) {
        if (err instanceof EstimateError) {
            return res.status(400).json({ message: err.message });
        }
        throw err;
    }

    try {
        const task = await Task.findById(taskId);
        if (!task || task.board.toString() !== boardId.toString()) {
            return res.status(404).json({ message: 'Task not found on this board' });
        }

        const estimate = await TaskEstimate.findOneAndUpdate(
            { task: taskId },
            { board: boardId, optimistic, mostLikely, pessimistic, updatedBy: userId },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        await logActivity({
            boardId,
            userId,
            action: `set three-point estimate for "${task.title}"`,
            taskId: task._id
        });

        res.json({
            _id: estimate._id,
            task: estimate.task,
            optimistic,
            mostLikely,
            pessimistic,
            ...computed
        });
    } catch (err) {
        console.error('Error saving estimate:', err);
        res.status(500).json({ message: err.message });
    }
};

/** DELETE /api/boards/:id/estimates/:taskId */
exports.deleteEstimate = async (req, res) => {
    const { id: boardId, taskId } = req.params;
    const userId = req.user._id;

    if (!mongoose.isValidObjectId(taskId)) {
        return res.status(400).json({ message: 'Invalid task id' });
    }

    try {
        const removed = await TaskEstimate.findOneAndDelete({ task: taskId, board: boardId });
        if (!removed) {
            return res.status(404).json({ message: 'No estimate found for this task' });
        }

        const task = await Task.findById(taskId);
        await logActivity({
            boardId,
            userId,
            action: `removed three-point estimate${task ? ` for "${task.title}"` : ''}`,
            taskId: task ? task._id : undefined
        });

        res.json({ message: 'Estimate removed successfully' });
    } catch (err) {
        console.error('Error deleting estimate:', err);
        res.status(500).json({ message: err.message });
    }
};
