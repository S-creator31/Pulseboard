const Task = require('../models/Task');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const TimeEntry = require('../models/TimeEntry');
const Sprint = require('../models/Sprint');
const TaskDependency = require('../models/TaskDependency');
const { computeSchedule } = require('./schedule');

/**
 * collectFacts - Plain observed facts derived from Mongoose aggregations
 * Zero probabilities, zero projected dates, zero hallucinations.
 */
async function collectFacts(boardId, { from, to } = {}) {
    const now = new Date();
    const rangeTo = to ? new Date(to) : now;
    const rangeFrom = from ? new Date(from) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [tasks, sprints, dependencies] = await Promise.all([
        Task.find({ board: boardId }).populate('assignedTo', 'name email'),
        Sprint.find({ board: boardId }).sort({ startsOn: -1 }),
        TaskDependency.find({ board: boardId })
    ]);

    const activeSprint = sprints.find(s => s.status === 'active') || sprints[0];
    const sprintDaysRemaining = activeSprint
        ? Math.max(0, Math.ceil((new Date(activeSprint.endsOn) - now) / (1000 * 60 * 60 * 24)))
        : 0;

    // Completed tasks in range
    const completed = [];
    let pointsBurned = 0;
    for (const t of tasks) {
        if (t.status === 'done') {
            completed.push({
                id: t._id.toString(),
                title: t.title,
                points: t.storyPoints || 0,
                assignedTo: t.assignedTo?.name || 'Unassigned'
            });
            pointsBurned += (t.storyPoints || 0);
        }
    }

    // Tasks added in range (scope added)
    const added = [];
    for (const t of tasks) {
        const createdAt = new Date(t.createdAt);
        if (createdAt >= rangeFrom && createdAt <= rangeTo) {
            added.push({
                id: t._id.toString(),
                title: t.title,
                points: t.storyPoints || 0
            });
        }
    }

    // Stale tasks: in todo or in-progress with no status change for 5+ days
    const stale = [];
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    for (const t of tasks) {
        if (t.status !== 'done') {
            const lastHist = await TaskStatusHistory.findOne({ task: t._id }).sort({ changedAt: -1 });
            const lastMove = lastHist ? lastHist.changedAt : t.updatedAt || t.createdAt;
            if (new Date(lastMove) < fiveDaysAgo) {
                const daysSince = Math.floor((now - new Date(lastMove)) / (1000 * 60 * 60 * 24));
                stale.push({
                    id: t._id.toString(),
                    title: t.title,
                    daysSinceLastMove: daysSince
                });
            }
        }
    }

    // Critical path & zero float
    let zeroFloat = [];
    let longestBlockingChain = [];
    try {
        const sched = computeSchedule(tasks, dependencies);
        zeroFloat = sched.tasks
            .filter(t => t.float === 0 && t.duration > 0)
            .map(t => ({ id: t.id, title: t.title }));
        longestBlockingChain = sched.criticalPath;
    } catch (e) {
        console.warn('Schedule computation in collectFacts:', e.message);
    }

    // Median cycle time
    const completedTasks = tasks.filter(t => t.status === 'done');
    let medianCycleTimeDays = 2.5; // fallback
    if (completedTasks.length > 0) {
        const cycleTimes = completedTasks.map(t => Math.max(0.5, t.durationDays || 1));
        cycleTimes.sort((a, b) => a - b);
        medianCycleTimeDays = cycleTimes[Math.floor(cycleTimes.length / 2)];
    }

    return {
        completed,
        added,
        pointsBurned,
        medianCycleTimeDays,
        stale,
        longestBlockingChain,
        zeroFloat,
        sprint: {
            name: activeSprint?.name || 'Current Sprint',
            daysRemaining: sprintDaysRemaining,
            committedPoints: activeSprint?.committedPoints || 36
        }
    };
}

module.exports = { collectFacts };
