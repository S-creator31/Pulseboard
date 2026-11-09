/**
 * seedDemo.js - Deterministic demo data generator for Pulseboard
 * Uses mulberry32 PRNG with a fixed seed so every run produces identical data.
 * Idempotent: deletes only the demo board and its associated documents.
 */

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

const User = require('../models/User');
const Board = require('../models/Board');
const List = require('../models/List');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');
const TaskDependency = require('../models/TaskDependency');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const TimeEntry = require('../models/TimeEntry');
const ActivityLog = require('../models/ActivityLog');

// Deterministic Mulberry32 PRNG
function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const prng = mulberry32(20261109);

function randomInt(min, max) {
    return Math.floor(prng() * (max - min + 1)) + min;
}

function choice(arr) {
    return arr[Math.floor(prng() * arr.length)];
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

async function runSeed() {
    console.log('--- Starting PulseBoard Demo Seeder ---');
    await connectDB();

    const DEMO_BOARD_TITLE = 'PulseBoard Core Platform';
    const DEMO_USERS_CONFIG = [
        { name: 'Alex Rivera', email: 'alex@pulseboard.dev', role: 'admin' },
        { name: 'Shlok Patel', email: 'shlok@pulseboard.dev', role: 'admin' },
        { name: 'Tushar Sharma', email: 'tushar@pulseboard.dev', role: 'user' },
        { name: 'Keshav Rao', email: 'keshav@pulseboard.dev', role: 'user' },
        { name: 'Riya Sen', email: 'riya@pulseboard.dev', role: 'user' },
    ];

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Upsert Demo Users
    const users = [];
    for (const u of DEMO_USERS_CONFIG) {
        let existing = await User.findOne({ email: u.email });
        if (!existing) {
            existing = await User.create({
                name: u.name,
                email: u.email,
                password: passwordHash,
                role: u.role
            });
        }
        users.push(existing);
    }
    const [alex, shlok, tushar, keshav, riya] = users;

    // 2. Clear Existing Demo Board & Dependent Documents (Idempotent cleanup)
    const existingBoard = await Board.findOne({ title: DEMO_BOARD_TITLE });
    if (existingBoard) {
        const boardId = existingBoard._id;
        console.log(`Clearing existing demo board ${boardId}...`);
        await Task.deleteMany({ board: boardId });
        await List.deleteMany({ board: boardId });
        await Sprint.deleteMany({ board: boardId });
        await TaskDependency.deleteMany({ board: boardId });
        await TaskStatusHistory.deleteMany({ board: boardId });
        await ActivityLog.deleteMany({ board: boardId });

        // Clean up TimeEntries on tasks associated with this board
        const demoTaskIds = (await Task.find({ board: boardId }).select('_id')).map(t => t._id);
        await TimeEntry.deleteMany({ task: { $in: demoTaskIds } });
        await Board.deleteOne({ _id: boardId });
    }

    // 3. Create Demo Board
    const board = await Board.create({
        title: DEMO_BOARD_TITLE,
        color: 'violet',
        owner: alex._id,
        members: [
            { user: shlok._id, role: 'admin' },
            { user: tushar._id, role: 'member' },
            { user: keshav._id, role: 'member' },
            { user: riya._id, role: 'member' }
        ],
        createdAt: addDays(new Date(), -90)
    });
    console.log(`Created board "${board.title}" (${board._id})`);

    // 4. Create Lists
    const listTodo = await List.create({
        title: 'To Do',
        statusKey: 'todo',
        board: board._id,
        order: 0
    });
    const listInProgress = await List.create({
        title: 'In Progress',
        statusKey: 'in-progress',
        board: board._id,
        order: 1
    });
    const listDone = await List.create({
        title: 'Done',
        statusKey: 'done',
        board: board._id,
        order: 2
    });

    const listsByStatus = {
        todo: listTodo,
        'in-progress': listInProgress,
        done: listDone
    };

    // 5. Create 4 Sprints (3 closed, 1 active)
    const now = new Date();
    const sprintConfigs = [
        {
            name: 'Sprint 1: Architecture & Auth',
            goal: 'Establish basic foundations, JWT auth and board CRUD',
            startsOn: addDays(now, -56),
            endsOn: addDays(now, -42),
            status: 'closed',
            committedPoints: 34
        },
        {
            name: 'Sprint 2: Lists, Tasks & Drag-Drop',
            goal: 'Complete Kanban board interaction and real-time state',
            startsOn: addDays(now, -42),
            endsOn: addDays(now, -28),
            status: 'closed',
            committedPoints: 38
        },
        {
            name: 'Sprint 3: Dependencies & CPM Engine',
            goal: 'Implement scheduling graph and critical-path calculation',
            startsOn: addDays(now, -28),
            endsOn: addDays(now, -14),
            status: 'closed',
            committedPoints: 40
        },
        {
            name: 'Sprint 4: Analytics, Heatmap & AI',
            goal: 'Ship project-control charts, capacity heatmap and AI digest',
            startsOn: addDays(now, -8),
            endsOn: addDays(now, 6), // 6 days left
            status: 'active',
            committedPoints: 36
        }
    ];

    const sprints = [];
    for (const sc of sprintConfigs) {
        const sp = await Sprint.create({ ...sc, board: board._id });
        sprints.push(sp);
    }

    // 6. Generate 68 Tasks across Sprints with deterministic features
    const STORY_POINTS_POOL = [1, 1, 2, 2, 2, 3, 3, 3, 5, 5, 8];
    const PRIORITIES = ['low', 'medium', 'medium', 'high', 'urgent'];

    const taskTitlesSprint1 = [
        'Initialize Express & Mongoose API scaffolding',
        'Configure JWT auth and bcrypt password hashing',
        'Create User registration and login endpoints',
        'Set up protected board membership middleware',
        'Build board creation modal with color palette',
        'Design violet/coral CSS token design system',
        'Create responsive dashboard board listing',
        'Implement board deletion with confirmation',
        'Configure CORS and local development origins',
        'Build auth context provider with localStorage caching',
        'Add input validation for signup form',
        'Write MongoDB connection retry logic',
        'Setup ESLint and PostCSS configuration',
        'Create PulseLogo and brand header'
    ];

    const taskTitlesSprint2 = [
        'Create List model and CRUD controllers',
        'Add statusKey column mapping to List schema',
        'Implement React DnD task drag and drop',
        'Fix moveTaskToList authorization check',
        'Add task deletion with optimistic UI update',
        'Build AddMemberForm for board collaboration',
        'Support admin role assignments on board members',
        'Build task creation input on list footer',
        'Add member avatar chips on task cards',
        'Write ActivityLog schema and helper function',
        'Create per-board activity feed endpoint',
        'Fix User model schema required attribute typo',
        'Style lists with distinct header accent lines',
        'Implement optimistic status toggle checkbox',
        'Add empty state for boards with zero lists',
        'Sanitize title inputs across all task mutations',
        'Refactor list order persistence'
    ];

    const taskTitlesSprint3 = [
        'Define TaskDependency schema with compound unique index',
        'Build pure topological sort with cycle detection',
        'Implement forward pass for earliest start and finish',
        'Implement backward pass for latest start and finish',
        'Compute total float and critical path flags',
        'Create TaskStatusHistory collection and logging',
        'Build cycle-prevention validator on dependency POST',
        'Expose /api/boards/:id/schedule calculation endpoint',
        'Expose /api/boards/:id/graph adjacency endpoint',
        'Write pure unit tests asserting exact CP duration',
        'Create TimeEntry model for actual effort tracking',
        'Implement burndown aggregation pipeline',
        'Implement velocity and rolling average pipeline',
        'Implement cycle-time scatter aggregation',
        'Implement cumulative flow stacked counts pipeline',
        'Test dependency graph cycle error reporting',
        'Seed historical status transition documents'
    ];

    const taskTitlesSprint4 = [
        'Single-SVG Gantt timeline with dependency curves',
        'Activity-on-node PERT diagram with ES/EF/LS/LF boxes',
        'Critical-path highlighter toggle with 25% opacity fade',
        'Top-level delivery health panel with SPI and CPI',
        'Board header stat rail with burndown sparkline',
        'Quick log-time popover with 15m/30m/1h/2h chips',
        'Card estimate-vs-actual progress bar with hatched overrun',
        'Team weekly capacity heatmap (display-only load)',
        'Slide-over ActivityLog drawer with cursor pagination',
        'Filter pills for activity drawer (actor and action)',
        'Delivery digest AI facts aggregator (zero hallucinations)',
        'Groq AI delivery lead summary with hover metric provenance',
        'AI work breakdown assistant with strict scope bounds',
        'cmdk command palette (Cmd/Ctrl+K)',
        'Keyboard shortcuts help dialog (?)',
        'Board filter bar (assignee, priority, blocked only)',
        'Overdue and due-soon badge flags on cards',
        'Compact/comfortable density layout toggle',
        'Dark mode manual toggle with persistence',
        'Permission matrix modal and viewer role affordances'
    ];

    const sprintTaskSets = [
        { sprint: sprints[0], titles: taskTitlesSprint1, isClosed: true },
        { sprint: sprints[1], titles: taskTitlesSprint2, isClosed: true },
        { sprint: sprints[2], titles: taskTitlesSprint3, isClosed: true },
        { sprint: sprints[3], titles: taskTitlesSprint4, isClosed: false }
    ];

    let totalTasks = 0;
    let totalHistories = 0;
    let totalTimeEntries = 0;
    let totalLogs = 0;
    let totalDeps = 0;

    const allCreatedTasks = [];
    const sprint4Tasks = [];

    // Stale tasks tracker (exactly 3 tasks with no move in 6+ days)
    const staleIndicesInSprint4 = [2, 5, 11];

    for (let sIdx = 0; sIdx < sprintTaskSets.length; sIdx++) {
        const { sprint, titles, isClosed } = sprintTaskSets[sIdx];
        const sStart = sprint.startsOn;
        const sEnd = sprint.endsOn;

        for (let tIdx = 0; tIdx < titles.length; tIdx++) {
            const title = titles[tIdx];
            const points = choice(STORY_POINTS_POOL);
            const priority = choice(PRIORITIES);
            const estimateHours = points * randomInt(2, 4);
            const assignedUser = users[tIdx % users.length];

            // 10-15% of tasks added mid-sprint
            const isMidSprint = prng() < 0.15;
            const taskCreatedDate = isMidSprint
                ? addDays(sStart, randomInt(3, 7))
                : addDays(sStart, randomInt(0, 2));

            let finalStatus;
            let targetList;

            if (isClosed) {
                // In closed sprints, all or almost all are done
                finalStatus = 'done';
                targetList = listDone;
            } else {
                // In active sprint: mix of done, in-progress, and todo
                if (tIdx < 8) {
                    finalStatus = 'done';
                    targetList = listDone;
                } else if (tIdx < 14) {
                    finalStatus = 'in-progress';
                    targetList = listInProgress;
                } else {
                    finalStatus = 'todo';
                    targetList = listTodo;
                }
            }

            const taskDoc = await Task.create({
                title,
                description: `Implementation work for ${title}. Managed under ${sprint.name}.`,
                board: board._id,
                list: targetList._id,
                assignedTo: assignedUser._id,
                status: finalStatus,
                storyPoints: points,
                priority,
                estimateHours,
                startDate: taskCreatedDate,
                durationDays: Math.max(1, Math.round(estimateHours / 4)),
                sprint: sprint._id,
                order: tIdx,
                createdAt: taskCreatedDate,
                updatedAt: isClosed ? sEnd : now
            });

            totalTasks++;
            allCreatedTasks.push(taskDoc);
            if (!isClosed) {
                sprint4Tasks.push(taskDoc);
            }

            // Create TaskStatusHistory
            // Initial 'todo' transition
            await TaskStatusHistory.create({
                task: taskDoc._id,
                board: board._id,
                fromStatus: null,
                toStatus: 'todo',
                changedBy: alex._id,
                changedAt: taskCreatedDate
            });
            totalHistories++;

            await ActivityLog.create({
                board: board._id,
                user: alex._id,
                action: `created task "${taskDoc.title}"`,
                task: taskDoc._id,
                toStatus: 'todo',
                createdAt: taskCreatedDate
            });
            totalLogs++;

            if (finalStatus === 'in-progress' || finalStatus === 'done') {
                // Work transitions cluster towards the end of the sprint
                const isStale = (!isClosed && staleIndicesInSprint4.includes(tIdx));
                const progDate = isStale
                    ? addDays(now, -7) // 7 days ago, so stale > 5 days
                    : addDays(sStart, randomInt(3, 8));

                await TaskStatusHistory.create({
                    task: taskDoc._id,
                    board: board._id,
                    fromStatus: 'todo',
                    toStatus: 'in-progress',
                    changedBy: assignedUser._id,
                    changedAt: progDate
                });
                totalHistories++;

                await ActivityLog.create({
                    board: board._id,
                    user: assignedUser._id,
                    action: `moved "${taskDoc.title}" to In Progress (in-progress)`,
                    task: taskDoc._id,
                    fromStatus: 'todo',
                    toStatus: 'in-progress',
                    createdAt: progDate
                });
                totalLogs++;

                if (finalStatus === 'done') {
                    // Cluster towards the end of sprint
                    const doneDate = isClosed
                        ? addDays(sEnd, -randomInt(0, 3))
                        : addDays(now, -randomInt(1, 4));

                    await TaskStatusHistory.create({
                        task: taskDoc._id,
                        board: board._id,
                        fromStatus: 'in-progress',
                        toStatus: 'done',
                        changedBy: assignedUser._id,
                        changedAt: doneDate
                    });
                    totalHistories++;

                    await ActivityLog.create({
                        board: board._id,
                        user: assignedUser._id,
                        action: `marked "${taskDoc.title}" as done`,
                        task: taskDoc._id,
                        fromStatus: 'in-progress',
                        toStatus: 'done',
                        createdAt: doneDate
                    });
                    totalLogs++;

                    // Time entries for completed tasks:
                    // Roughly 1/3 overrun their estimate
                    const willOverrun = prng() < 0.35;
                    const multiplier = willOverrun ? (1.15 + prng() * 0.45) : (0.7 + prng() * 0.25);
                    const totalLoggedMinutes = Math.round(estimateHours * 60 * multiplier);

                    const entryCount = randomInt(1, 3);
                    let minutesRemaining = totalLoggedMinutes;

                    for (let e = 0; e < entryCount; e++) {
                        const entryMinutes = (e === entryCount - 1)
                            ? minutesRemaining
                            : Math.round((minutesRemaining / (entryCount - e)) * (0.8 + prng() * 0.4));
                        minutesRemaining = Math.max(0, minutesRemaining - entryMinutes);

                        const entryDate = addDays(progDate, Math.min(e + 1, 5));
                        const entryUser = (prng() < 0.8) ? assignedUser : choice(users);

                        await TimeEntry.create({
                            task: taskDoc._id,
                            user: entryUser._id,
                            minutes: Math.max(15, entryMinutes),
                            loggedOn: entryDate,
                            note: `Work on ${taskDoc.title} session ${e + 1}`
                        });
                        totalTimeEntries++;
                    }
                }
            }
        }
    }

    // 7. Create Dependency Chain in Sprint 4:
    // Real chain of 8-10 tasks producing critical path of >= 5 + parallel branch with slack
    // Chain:
    // T0 (Gantt timeline) -> T1 (PERT diagram) -> T2 (Critical path toggle) -> T3 (Health panel) -> T4 (Stat rail) -> T5 (Log time) -> T7 (Capacity heatmap) [Duration sum is longest]
    // Parallel branch:
    // T0 -> T6 (Card progress bar) -> T8 (Slide-over drawer) -> T7
    if (sprint4Tasks.length >= 10) {
        const chain = [
            sprint4Tasks[0], // Gantt timeline
            sprint4Tasks[1], // PERT diagram
            sprint4Tasks[2], // Critical path toggle
            sprint4Tasks[3], // Delivery health panel
            sprint4Tasks[4], // Stat rail
            sprint4Tasks[5], // Log time
            sprint4Tasks[7], // Capacity heatmap
        ];

        // Critical path chain
        for (let i = 0; i < chain.length - 1; i++) {
            await TaskDependency.create({
                board: board._id,
                predecessor: chain[i]._id,
                successor: chain[i + 1]._id
            });
            totalDeps++;
        }

        // Parallel branch with slack
        const parallelT6 = sprint4Tasks[6]; // Card progress bar
        const parallelT8 = sprint4Tasks[8]; // Slide-over drawer

        await TaskDependency.create({
            board: board._id,
            predecessor: chain[0]._id,
            successor: parallelT6._id
        });
        await TaskDependency.create({
            board: board._id,
            predecessor: parallelT6._id,
            successor: parallelT8._id
        });
        await TaskDependency.create({
            board: board._id,
            predecessor: parallelT8._id,
            successor: chain[chain.length - 1]._id
        });
        totalDeps += 3;

        // Set realistic dates and durations for the dependency chain
        let curStart = addDays(sprints[3].startsOn, 1);
        for (let i = 0; i < chain.length; i++) {
            const task = chain[i];
            task.startDate = curStart;
            task.durationDays = Math.max(2, randomInt(2, 3));
            await task.save();
            curStart = addDays(curStart, task.durationDays);
        }

        parallelT6.startDate = addDays(chain[0].startDate, chain[0].durationDays);
        parallelT6.durationDays = 1;
        await parallelT6.save();

        parallelT8.startDate = addDays(parallelT6.startDate, 1);
        parallelT8.durationDays = 2;
        await parallelT8.save();
    }

    console.log('\n========================================');
    console.log('       DEMO SEED COMPLETED SUCCESSFULLY  ');
    console.log('========================================');
    console.table({
        'Board Title': board.title,
        'Board ID': board._id.toString(),
        'Demo Members': users.length,
        'Sprints': sprints.length,
        'Tasks Created': totalTasks,
        'Status Histories': totalHistories,
        'Time Entries': totalTimeEntries,
        'Activity Logs': totalLogs,
        'Dependencies': totalDeps
    });

    console.log('\nLogin credentials for testing:');
    console.log('Email: alex@pulseboard.dev (Owner)');
    console.log('Email: shlok@pulseboard.dev (Admin)');
    console.log('Password: Password123!');
    console.log('----------------------------------------\n');

    process.exit(0);
}

runSeed().catch((err) => {
    console.error('Seeding failed with error:', err);
    process.exit(1);
});
