const mongoose = require('mongoose');
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const List = require('../models/List');

/**
 * 1. Burndown Chart Pipeline
 * GET /api/sprints/:id/burndown
 * Returns: { days: [{ date, ideal, remaining, scopeAdded }] }
 */
async function getBurndown(sprintId) {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
        throw new Error('Sprint not found');
    }

    const startDate = new Date(sprint.startsOn);
    const endDate = new Date(sprint.endsOn);
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((endDate - startDate) / msPerDay));

    // Burndown scope belongs to this sprint only; including every board task
    // inflates remaining and scope-added points with unrelated sprint work.
    const tasks = await Task.find({ board: sprint.board, sprint: sprint._id });

    const sprintTaskIds = tasks.map(t => t._id);
    const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));

    // Fetch all status history transitions for tasks in this board/sprint
    const histories = await TaskStatusHistory.find({
        task: { $in: sprintTaskIds },
        changedAt: { $gte: startDate, $lte: new Date(endDate.getTime() + msPerDay) }
    }).sort({ changedAt: 1 });

    const committedPoints = sprint.committedPoints || 36;
    const days = [];

    // Map through each day of the sprint
    for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(startDate.getTime() + i * msPerDay);
        const dateStr = currentDate.toISOString().split('T')[0];

        // Ideal burndown: linear decrease from committedPoints to 0
        const ideal = Math.max(0, +(committedPoints * (1 - i / totalDays)).toFixed(1));

        // Calculate tasks created after sprint start (scope added)
        let scopeAdded = 0;
        let completedPoints = 0;
        let totalSprintPoints = 0;

        for (const task of tasks) {
            const taskCreatedAt = new Date(task.createdAt || startDate);
            const taskPoints = task.storyPoints || 0;

            if (taskCreatedAt <= currentDate) {
                totalSprintPoints += taskPoints;
                if (taskCreatedAt > startDate) {
                    scopeAdded += taskPoints;
                }
            }
        }

        // Check which tasks were 'done' on or before this day
        // A task is 'done' if its latest status history up to currentDate is 'done'
        const doneTasks = new Set();
        for (const h of histories) {
            if (new Date(h.changedAt) <= currentDate) {
                if (h.toStatus === 'done') {
                    doneTasks.add(h.task.toString());
                } else {
                    doneTasks.delete(h.task.toString());
                }
            }
        }

        for (const doneId of doneTasks) {
            const t = taskMap.get(doneId);
            if (t) {
                completedPoints += (t.storyPoints || 0);
            }
        }

        const remaining = Math.max(0, totalSprintPoints - completedPoints);

        days.push({
            date: dateStr,
            ideal,
            remaining,
            scopeAdded
        });
    }

    return { days };
}

/**
 * 2. Velocity Chart Pipeline
 * GET /api/boards/:id/velocity
 * Returns: { sprints: [{ name, committed, completed }], rollingAverage: [] }
 */
async function getVelocity(boardId) {
    const sprints = await Sprint.find({ board: boardId }).sort({ startsOn: 1 });

    const sprintResults = [];
    const completedValues = [];

    for (const sprint of sprints) {
        const tasks = await Task.find({ sprint: sprint._id });
        const committed = sprint.committedPoints || 0;

        let completed = 0;
        for (const task of tasks) {
            if (task.status === 'done') {
                completed += (task.storyPoints || 0);
            }
        }

        completedValues.push(completed);
        sprintResults.push({
            id: sprint._id,
            name: sprint.name,
            committed,
            completed,
            status: sprint.status
        });
    }

    // 3-sprint rolling average calculation
    const rollingAverage = sprintResults.map((sp, idx) => {
        const windowStart = Math.max(0, idx - 2);
        const windowValues = completedValues.slice(windowStart, idx + 1);
        const sum = windowValues.reduce((acc, v) => acc + v, 0);
        const avg = +(sum / windowValues.length).toFixed(1);
        return {
            name: sp.name,
            average: avg
        };
    });

    return {
        sprints: sprintResults,
        rollingAverage
    };
}

/**
 * 3. Cycle Time Scatter Pipeline
 * GET /api/boards/:id/cycle-time
 * Returns: { tasks: [{ id, title, days }], p50, p85 }
 */
async function getCycleTime(boardId) {
    // Find all tasks marked done
    const doneTasks = await Task.find({ board: boardId, status: 'done' });
    const taskIds = doneTasks.map(t => t._id);

    // Find status histories
    const histories = await TaskStatusHistory.find({
        board: boardId,
        task: { $in: taskIds }
    }).sort({ changedAt: 1 });

    const startedTimes = new Map();
    const completedTimes = new Map();

    for (const h of histories) {
        const tid = h.task.toString();
        if (h.toStatus === 'in-progress' && !startedTimes.has(tid)) {
            startedTimes.set(tid, new Date(h.changedAt));
        }
        if (h.toStatus === 'done') {
            completedTimes.set(tid, new Date(h.changedAt));
        }
    }

    const taskItems = [];
    const daysList = [];

    for (const t of doneTasks) {
        const tid = t._id.toString();
        const start = startedTimes.get(tid) || new Date(t.createdAt);
        const end = completedTimes.get(tid) || new Date(t.updatedAt || Date.now());

        const durationMs = Math.max(0, end - start);
        let days = +(durationMs / (1000 * 60 * 60 * 24)).toFixed(1);
        if (days < 0.5) days = 0.5;

        taskItems.push({
            id: t._id,
            title: t.title,
            days,
            points: t.storyPoints || 1,
            completedDate: end.toISOString().split('T')[0]
        });
        daysList.push(days);
    }

    // Sort days ascending to calculate percentiles
    daysList.sort((a, b) => a - b);

    function calcPercentile(arr, p) {
        if (arr.length === 0) return 0;
        const index = (arr.length - 1) * p;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (lower === upper) return arr[lower];
        return +(arr[lower] * (1 - weight) + arr[upper] * weight).toFixed(1);
    }

    const p50 = calcPercentile(daysList, 0.50);
    const p85 = calcPercentile(daysList, 0.85);

    return {
        tasks: taskItems,
        p50,
        p85
    };
}

/**
 * 4. Cumulative Flow Diagram Pipeline
 * GET /api/boards/:id/flow
 * Returns: { days: [{ date, todo, 'in-progress': inProgress, done }] }
 */
async function getCumulativeFlow(boardId, { daysCount = 30 } = {}) {
    const lists = await List.find({ board: boardId }).sort({ order: 1 });
    const tasks = await Task.find({ board: boardId });
    const histories = await TaskStatusHistory.find({ board: boardId }).sort({ changedAt: 1 });

    const msPerDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const days = [];

    for (let i = daysCount - 1; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * msPerDay);
        const dateStr = targetDate.toISOString().split('T')[0];

        // Evaluate status of each existing task at targetDate
        let todo = 0;
        let inProgress = 0;
        let done = 0;

        for (const t of tasks) {
            const createdAt = new Date(t.createdAt);
            if (createdAt > targetDate) continue; // Task did not exist yet

            // Find last status before or on targetDate
            let effectiveStatus = 'todo';
            for (const h of histories) {
                if (h.task.toString() === t._id.toString() && new Date(h.changedAt) <= targetDate) {
                    effectiveStatus = h.toStatus;
                }
            }

            if (effectiveStatus === 'done') done++;
            else if (effectiveStatus === 'in-progress') inProgress++;
            else todo++;
        }

        days.push({
            date: dateStr,
            todo,
            'in-progress': inProgress,
            done
        });
    }

    return { days };
}

module.exports = {
    getBurndown,
    getVelocity,
    getCycleTime,
    getCumulativeFlow
};
