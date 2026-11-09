const { z } = require('zod');
const { generateJson, AiFormatError } = require('../lib/aiClient');
const { collectFacts } = require('../services/digestFacts');
const Task = require('../models/Task');
const Board = require('../models/Board');
const List = require('../models/List');

// Zod schema for Digest output
const DigestSchema = z.object({
    headline: z.string(),
    narrative: z.string(),
    metrics: z.array(z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        source: z.string()
    })),
    watchlist: z.array(z.object({
        taskId: z.string(),
        title: z.string().optional(),
        reason: z.string(),
        severity: z.enum(['warning', 'danger']).default('warning')
    }))
});

// Zod schema for Work Breakdown output
const BreakdownSchema = z.object({
    subtasks: z.array(z.object({
        title: z.string(),
        estimateHours: z.number().min(0.5).max(8),
        rationale: z.string()
    })).min(3).max(7),
    acceptanceCriteria: z.array(z.string()),
    risks: z.array(z.string())
});

exports.BreakdownSchema = BreakdownSchema;

exports.getDigest = async (req, res) => {
    const { id: boardId } = req.params;

    try {
        const facts = await collectFacts(boardId);

        // Ground-truth verified metrics
        const verifiedMetrics = [
            {
                label: 'Points Burned',
                value: facts.pointsBurned,
                source: 'Sum of storyPoints for completed tasks in current cycle'
            },
            {
                label: 'Days Remaining',
                value: facts.sprint.daysRemaining,
                source: `Active sprint (${facts.sprint.name}) calendar end date`
            },
            {
                label: 'Median Cycle Time',
                value: `${facts.medianCycleTimeDays}d`,
                source: 'p50 duration from in-progress to done across completed tasks'
            },
            {
                label: 'Zero-Float Tasks',
                value: facts.zeroFloat.length,
                source: 'Critical Path Method (CPM) earliest/latest start comparison'
            },
            {
                label: 'Stale Tasks',
                value: facts.stale.length,
                source: 'Tasks with no status transition recorded in past 5+ days'
            }
        ];

        // Format facts payload for LLM prompt
        const promptFacts = {
            sprintName: facts.sprint.name,
            daysRemaining: facts.sprint.daysRemaining,
            pointsBurned: facts.pointsBurned,
            completedTaskCount: facts.completed.length,
            completedTaskTitles: facts.completed.slice(0, 5).map(t => t.title),
            staleTaskCount: facts.stale.length,
            staleTasks: facts.stale.map(s => ({ title: s.title, daysSinceLastMove: s.daysSinceLastMove })),
            zeroFloatCount: facts.zeroFloat.length,
            zeroFloatTitles: facts.zeroFloat.map(z => z.title),
            medianCycleTimeDays: facts.medianCycleTimeDays
        };

        const systemPrompt = `You are a delivery lead writing a stand-up digest for a student engineering team. At most five sentences. Use ONLY the facts in the user message. Never invent a number, name or date. Never predict what will happen or say anything is likely to slip — report only what has happened and what is currently stuck. Plain language, no filler.`;

        let result = null;
        try {
            result = await generateJson({
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Generate a delivery digest JSON conforming to the schema using ONLY these exact facts:\n${JSON.stringify(promptFacts, null, 2)}`
                    }
                ],
                schema: DigestSchema,
                temperature: 0.1
            });
        } catch (llmErr) {
            console.warn('LLM call failed, generating deterministic fact report:', llmErr.message);
        }

        // If no API key or LLM error, synthesize 100% faithful response from facts
        if (!result) {
            const stalePart = facts.stale.length > 0
                ? `${facts.stale.length} tasks have been inactive for over 5 days.`
                : `No tasks are currently stalled.`;
            const zeroFloatPart = facts.zeroFloat.length > 0
                ? `${facts.zeroFloat.length} items sit on the critical path with zero float.`
                : `Schedule float remains healthy across the active board.`;

            result = {
                headline: `${facts.sprint.name}: ${facts.pointsBurned} points delivered, ${facts.sprint.daysRemaining} days left`,
                narrative: `The team has burned ${facts.pointsBurned} points across ${facts.completed.length} completed items with ${facts.sprint.daysRemaining} days remaining in ${facts.sprint.name}. Median cycle time is currently holding at ${facts.medianCycleTimeDays} days. ${zeroFloatPart} ${stalePart}`,
                metrics: verifiedMetrics,
                watchlist: facts.stale.map(s => ({
                    taskId: s.id,
                    title: s.title,
                    reason: `No activity for ${s.daysSinceLastMove} days`,
                    severity: s.daysSinceLastMove > 7 ? 'danger' : 'warning'
                }))
            };
        } else {
            // Overwrite metric values with server facts so wrong numbers CANNOT survive
            result.metrics = verifiedMetrics;
            if (!result.watchlist || result.watchlist.length === 0) {
                result.watchlist = facts.stale.map(s => ({
                    taskId: s.id,
                    title: s.title,
                    reason: `No activity for ${s.daysSinceLastMove} days`,
                    severity: 'warning'
                }));
            }
        }

        res.json({
            ...result,
            generatedAt: new Date(),
            facts
        });
    } catch (err) {
        console.error('Error generating digest:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.refreshDigest = async (req, res) => {
    return exports.getDigest(req, res);
};

/**
 * Prompt 11: AI Task Breakdown
 * POST /api/ai/tasks/:id/breakdown
 * Request body MUST BE EMPTY (enforced by controller).
 * Returns: { subtasks: [{ title, estimateHours, rationale }], acceptanceCriteria: [], risks: [] }
 * Read-only! Performs NO database writes.
 */
exports.breakdownTask = async (req, res) => {
    const { id: taskId } = req.params;

    // Strict constraint: Request body must not contain user-authored project prose
    if (req.body && Object.keys(req.body).length > 0) {
        // Discard any user-supplied prompt/prose
        req.body = {};
    }

    try {
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const lists = await List.find({ board: task.board }).sort({ order: 1 });
        const columnNames = lists.map(l => l.title);

        const promptPayload = {
            taskTitle: task.title,
            taskDescription: task.description || 'No description provided',
            taskPriority: task.priority || 'medium',
            estimateHours: task.estimateHours || 6,
            boardColumns: columnNames,
            targetSubtaskDurationHours: '2-4 hours (each completable in under a day)'
        };

        const systemPrompt = `You are a senior software architect breaking down an agile task into concrete subtasks.
Produce between 3 and 7 subtasks. Each subtask must be completable in under a day (between 1 and 6 hours).
Return valid JSON with:
- subtasks: array of { title, estimateHours (number), rationale }
- acceptanceCriteria: array of clear verification strings
- risks: array of delivery risks`;

        let result = null;
        try {
            result = await generateJson({
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Decompose this task into 3 to 7 subtasks:\n${JSON.stringify(promptPayload, null, 2)}`
                    }
                ],
                schema: BreakdownSchema,
                temperature: 0.2
            });
        } catch (llmErr) {
            console.warn('LLM breakdown failed, using deterministic decomposition:', llmErr.message);
        }

        // Deterministic fallback if API key absent
        if (!result) {
            const title = task.title;
            const subtaskHours = Math.max(1, Math.min(4, Math.round((task.estimateHours || 6) / 4)));

            result = {
                subtasks: [
                    {
                        title: `Design and interface spec for ${title}`,
                        estimateHours: subtaskHours,
                        rationale: 'Clarify boundaries and contract before writing implementation code'
                    },
                    {
                        title: `Core logic and handler implementation`,
                        estimateHours: subtaskHours * 1.5,
                        rationale: 'Core operational execution path and data handling'
                    },
                    {
                        title: `Validation, edge-case coverage and error flows`,
                        estimateHours: subtaskHours,
                        rationale: 'Protect against malformed states, network drops and bad input'
                    },
                    {
                        title: `Integration testing and UI state reconciliation`,
                        estimateHours: subtaskHours,
                        rationale: 'Verify end-to-end user feedback and data persistence'
                    }
                ],
                acceptanceCriteria: [
                    `Implementation addresses all primary objectives of "${title}"`,
                    'All error and boundary conditions throw explicit, actionable messages',
                    'State persists correctly without silent client-server drift'
                ],
                risks: [
                    'Unforeseen external library API incompatibilities',
                    'Scope expansion if subtasks touch uninstrumented state'
                ]
            };
        }

        // Schema validation guardrail
        const validated = BreakdownSchema.parse(result);

        // Strictly NO writes to database. Return proposed breakdown only.
        res.json({
            ...validated,
            disclaimer: 'Suggested by AI - review before adding.'
        });
    } catch (err) {
        console.error('Error in task breakdown:', err);
        res.status(500).json({ message: err.message });
    }
};
