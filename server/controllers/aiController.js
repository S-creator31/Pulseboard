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

const buildBreakdownMessages = (task, boardColumns) => {
    const promptPayload = {
        taskTitle: task.title,
        taskDescription: task.description || '',
        taskPriority: task.priority || 'medium',
        estimateHours: task.estimateHours || 6,
        boardColumns,
        targetSubtaskDurationHours: '2-4 hours (each completable in under a day)'
    };

    return [
        {
            role: 'system',
            content: `You are a senior software architect decomposing one specific task into useful, independently actionable subtasks.
Produce 3 to 7 non-overlapping subtasks. Each must take 1 to 6 hours.
Ground every subtask in the task title and description. Use the actual features, components, data, or behavior named there; each title must identify a concrete task-specific deliverable.
Do not use generic lifecycle steps such as "design", "implement core logic", "add validation", or "write tests" unless that work is explicitly part of this task. Do not invent technologies, requirements, or unrelated work. If the task is vague, stay conservative and call out the missing detail in risks.
Do not assume frameworks, libraries, file paths, screens, or architecture that are not named in the task. Do not add testing, documentation, deployment, or setup subtasks unless the task explicitly asks for them. Every subtask must deliver a distinct part of the task's stated outcome.
Treat the task description as the primary source of requirements. When it is non-empty, every subtask must implement a distinct detail stated in the description, and the set of subtasks must cover its key details. Mention the relevant detail in each subtask title or rationale; do not generate subtasks from the title alone.
Before writing subtasks, identify the concrete behaviors and constraints in the description. Do not create a subtask that merely repeats the title or introduces work not supported by the description.
Order subtasks by dependency where appropriate. Make each rationale explain what task-specific outcome it delivers.
Acceptance criteria must verify this task's stated outcome. Include only relevant, task-specific risks; return an empty array when there are none.
Return valid JSON with:
- subtasks: array of { title, estimateHours (number), rationale }
- acceptanceCriteria: array of clear verification strings
- risks: array of delivery risks`
        },
        {
            role: 'user',
            content: `Create a scope-specific breakdown for this task. Do not provide a reusable template:\n${JSON.stringify(promptPayload, null, 2)}`
        }
    ];
};

exports.buildBreakdownMessages = buildBreakdownMessages;

const buildBreakdownTask = (task, requestBody = {}) => ({
    ...task.toObject(),
    title: typeof requestBody.title === 'string' ? requestBody.title : task.title,
    description: typeof requestBody.description === 'string' ? requestBody.description : task.description
});

exports.buildBreakdownTask = buildBreakdownTask;

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

    try {
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const lists = await List.find({ board: task.board }).sort({ order: 1 });
        const columnNames = lists.map(l => l.title);
        const breakdownTask = buildBreakdownTask(task, req.body);

        let result;
        try {
            result = await generateJson({
                messages: buildBreakdownMessages(breakdownTask, columnNames),
                schema: BreakdownSchema,
                temperature: 0.2
            });
        } catch (llmErr) {
            console.error('AI task breakdown failed:', llmErr.message);
            const providerError = llmErr instanceof AiFormatError
                ? 'invalid AI response'
                : llmErr.code || (llmErr.status ? `HTTP ${llmErr.status}` : 'provider/network error');
            return res.status(502).json({
                message: `AI could not generate a task-specific breakdown (${providerError}). Please try again.`
            });
        }

        if (!result) {
            return res.status(503).json({
                message: 'Groq AI is not configured. Add GROQ_API_KEY to server/.env and restart the server.'
            });
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
