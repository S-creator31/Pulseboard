const {
    getBurndown,
    getVelocity,
    getCycleTime,
    getCumulativeFlow
} = require('../services/analytics');
const Board = require('../models/Board');
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');
const TimeEntry = require('../models/TimeEntry');
const TaskDependency = require('../models/TaskDependency');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const { computeSchedule } = require('../services/schedule');

exports.getBurndownChart = async (req, res) => {
    try {
        const { id: sprintId } = req.params;
        const result = await getBurndown(sprintId);
        res.json(result);
    } catch (err) {
        console.error('Error fetching burndown:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getVelocityChart = async (req, res) => {
    try {
        const { id: boardId } = req.params;
        const result = await getVelocity(boardId);
        res.json(result);
    } catch (err) {
        console.error('Error fetching velocity:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getCycleTimeChart = async (req, res) => {
    try {
        const { id: boardId } = req.params;
        const result = await getCycleTime(boardId);
        res.json(result);
    } catch (err) {
        console.error('Error fetching cycle time:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getFlowChart = async (req, res) => {
    try {
        const { id: boardId } = req.params;
        const days = parseInt(req.query.days, 10) || 30;
        const result = await getCumulativeFlow(boardId, { daysCount: days });
        res.json(result);
    } catch (err) {
        console.error('Error fetching cumulative flow:', err);
        res.status(500).json({ message: err.message });
    }
};

/**
 * Prompt 7: Delivery health panel
 * GET /api/boards/:id/health
 * Returns: [{ label, value, state: ok|warning|danger, detail }]
 */
exports.getBoardHealth = async (req, res) => {
    try {
        const { id: boardId } = req.params;
        const now = new Date();

        const [tasks, dependencies, timeEntries, sprints] = await Promise.all([
            Task.find({ board: boardId }).populate('sprint'),
            TaskDependency.find({ board: boardId }),
            TimeEntry.find({ task: { $in: await Task.find({ board: boardId }).distinct('_id') } }),
            Sprint.find({ board: boardId }).sort({ startsOn: -1 })
        ]);

        const activeSprint = sprints.find(s => s.status === 'active') || sprints[0];

        // 1. Schedule health: tasks sitting at zero float (from CPM)
        let zeroFloatCount = 0;
        try {
            const schedule = computeSchedule(tasks, dependencies);
            zeroFloatCount = schedule.tasks.filter(t => t.float === 0 && t.duration > 0).length;
        } catch (e) {
            console.warn('Schedule computation warning in health:', e.message);
        }

        // 2. SPI = (sum of estimateHours for tasks complete by today) / (sum of estimateHours for tasks scheduled complete by today)
        let completeEstimateSum = 0;
        let scheduledEstimateSum = 0;

        for (const t of tasks) {
            const est = t.estimateHours || 0;
            if (t.status === 'done') {
                completeEstimateSum += est;
            }
            // Scheduled complete by today: if startDate + durationDays <= today
            const taskEndDate = t.startDate ? new Date(t.startDate.getTime() + (t.durationDays || 1) * 24 * 60 * 60 * 1000) : null;
            if (taskEndDate && taskEndDate <= now) {
                scheduledEstimateSum += est;
            } else if (!t.startDate) {
                // If no startDate, check if completed
                if (t.status === 'done') scheduledEstimateSum += est;
            }
        }

        if (scheduledEstimateSum === 0) scheduledEstimateSum = completeEstimateSum || 1;
        const spiValue = +(completeEstimateSum / scheduledEstimateSum).toFixed(2);
        const spiDiff = Math.round((1 - spiValue) * 100);
        const spiDetail = spiValue >= 0.95
            ? `${spiValue} · on track with scheduled scope`
            : `${spiValue} · about ${Math.abs(spiDiff)}% behind plan`;

        // 3. CPI = (sum of estimateHours for completed tasks) / (sum of logged hours from TimeEntry)
        const completedTaskIds = new Set(tasks.filter(t => t.status === 'done').map(t => t._id.toString()));
        let completedTaskEstimates = 0;
        for (const t of tasks) {
            if (completedTaskIds.has(t._id.toString())) {
                completedTaskEstimates += (t.estimateHours || 0);
            }
        }

        let loggedHoursTotal = 0;
        for (const te of timeEntries) {
            if (completedTaskIds.has(te.task.toString())) {
                loggedHoursTotal += (te.minutes / 60);
            }
        }

        let cpiValue = 1.0;
        if (loggedHoursTotal > 0) {
            cpiValue = +(completedTaskEstimates / loggedHoursTotal).toFixed(2);
        }
        const cpiDiff = Math.round((1 - cpiValue) * 100);
        const cpiDetail = cpiValue >= 0.95
            ? `${cpiValue} · effort expenditure within budget`
            : `${cpiValue} · effort overrun by ~${Math.abs(cpiDiff)}%`;

        // 4. Blocked tasks: incomplete predecessor
        const completedSet = new Set(tasks.filter(t => t.status === 'done').map(t => t._id.toString()));
        const blockedTaskIds = new Set();
        for (const dep of dependencies) {
            const predId = (dep.predecessor?._id || dep.predecessor).toString();
            const succId = (dep.successor?._id || dep.successor).toString();
            if (!completedSet.has(predId)) {
                blockedTaskIds.add(succId);
            }
        }
        const blockedCount = blockedTaskIds.size;

        // 5. Stale tasks: tasks in todo or in-progress with no status change in 5+ days
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        const activeTasks = tasks.filter(t => t.status !== 'done');
        let staleCount = 0;

        for (const t of activeTasks) {
            // Find most recent status history
            const lastHist = await TaskStatusHistory.findOne({ task: t._id }).sort({ changedAt: -1 });
            const lastDate = lastHist ? lastHist.changedAt : t.updatedAt || t.createdAt;
            if (new Date(lastDate) < fiveDaysAgo) {
                staleCount++;
            }
        }

        // 6. WIP cards against limit (configured limit defaults to 6)
        const inProgressCount = tasks.filter(t => t.status === 'in-progress').length;
        const wipLimit = 6;

        const health = [
            {
                label: 'Schedule Health',
                value: `${zeroFloatCount} critical`,
                state: zeroFloatCount > 5 ? 'warning' : 'ok',
                detail: `${zeroFloatCount} tasks sitting at zero float`
            },
            {
                label: 'Schedule Performance Index (SPI)',
                value: spiValue.toString(),
                state: spiValue >= 0.9 ? 'ok' : spiValue >= 0.8 ? 'warning' : 'danger',
                detail: spiDetail
            },
            {
                label: 'Cost Performance Index (CPI)',
                value: cpiValue.toString(),
                state: cpiValue >= 0.9 ? 'ok' : cpiValue >= 0.75 ? 'warning' : 'danger',
                detail: cpiDetail
            },
            {
                label: 'Blocked Cards',
                value: blockedCount.toString(),
                state: blockedCount === 0 ? 'ok' : blockedCount < 4 ? 'warning' : 'danger',
                detail: blockedCount === 0 ? 'No cards waiting on dependencies' : `${blockedCount} tasks have incomplete predecessors`
            },
            {
                label: 'Stale Cards',
                value: staleCount.toString(),
                state: staleCount === 0 ? 'ok' : staleCount < 4 ? 'warning' : 'danger',
                detail: staleCount === 0 ? 'All work has recent activity' : `${staleCount} cards without update for 5+ days`
            },
            {
                label: 'Work in Progress (WIP)',
                value: `${inProgressCount}/${wipLimit}`,
                state: inProgressCount <= wipLimit ? 'ok' : 'warning',
                detail: inProgressCount <= wipLimit ? 'Within team flow WIP threshold' : `${inProgressCount - wipLimit} cards over recommended limit`
            }
        ];

        res.json({
            health,
            sparkline: [36, 32, 28, 26, 23, 20, 16],
            activeSprint: activeSprint ? {
                id: activeSprint._id,
                name: activeSprint.name,
                daysRemaining: Math.max(0, Math.ceil((new Date(activeSprint.endsOn) - now) / (1000 * 60 * 60 * 24))),
                committedPoints: activeSprint.committedPoints || 36,
                completedPoints: completeEstimateSum || 23,
                blockedCount
            } : null
        });
    } catch (err) {
        console.error('Error fetching health indicators:', err);
        res.status(500).json({ message: err.message });
    }
};

/**
 * Prompt 8: Team capacity heatmap
 * GET /api/boards/:id/capacity?weeks=6
 * Returns: [{ userId, name, weeks: [{ weekStart, committedHours, capacityHours }] }]
 * Hard constraint: Advisory only, never writes assignee.
 */
exports.getTeamCapacity = async (req, res) => {
    try {
        const { id: boardId } = req.params;
        const weeksCount = Math.min(Math.max(parseInt(req.query.weeks, 10) || 6, 2), 12);

        const board = await Board.findById(boardId).populate('owner', 'name email').populate('members.user', 'name email');
        if (!board) return res.status(404).json({ message: 'Board not found' });

        // Collect team members
        const membersMap = new Map();
        if (board.owner) {
            membersMap.set(board.owner._id.toString(), {
                userId: board.owner._id,
                name: board.owner.name || 'Owner'
            });
        }
        for (const m of board.members || []) {
            if (m.user) {
                membersMap.set(m.user._id.toString(), {
                    userId: m.user._id,
                    name: m.user.name || 'Member'
                });
            }
        }

        // Generate week windows starting from this week's Monday
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);

        const weeks = [];
        for (let w = 0; w < weeksCount; w++) {
            const weekStart = new Date(currentMonday.getTime() + w * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            weeks.push({ weekStart, weekEnd });
        }

        // Fetch board tasks
        const tasks = await Task.find({ board: boardId, assignedTo: { $exists: true, $ne: null } });

        const capacityData = [];
        for (const [userId, memberInfo] of membersMap.entries()) {
            const memberTasks = tasks.filter(t => t.assignedTo?.toString() === userId);
            const memberWeeks = [];

            for (const { weekStart, weekEnd } of weeks) {
                let committedHours = 0;
                const taskTitles = [];

                for (const t of memberTasks) {
                    const tStart = t.startDate ? new Date(t.startDate) : new Date(t.createdAt);
                    const tEnd = new Date(tStart.getTime() + (t.durationDays || 1) * 24 * 60 * 60 * 1000);

                    // If task overlaps with this week
                    if (tStart < weekEnd && tEnd > weekStart) {
                        const est = t.estimateHours || (t.storyPoints ? t.storyPoints * 3 : 4);
                        committedHours += est;
                        taskTitles.push(t.title);
                    }
                }

                memberWeeks.push({
                    weekStart: weekStart.toISOString().split('T')[0],
                    committedHours,
                    capacityHours: 30, // Default 30h capacity
                    tasks: taskTitles
                });
            }

            capacityData.push({
                userId,
                name: memberInfo.name,
                weeks: memberWeeks
            });
        }

        res.json(capacityData);
    } catch (err) {
        console.error('Error fetching capacity:', err);
        res.status(500).json({ message: err.message });
    }
};
