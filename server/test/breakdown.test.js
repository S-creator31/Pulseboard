const test = require('node:test');
const assert = require('node:assert/strict');
const { BreakdownSchema, buildBreakdownMessages, buildBreakdownTask } = require('../controllers/aiController');

test('Breakdown prompt is grounded in the selected task and rejects generic templates', () => {
    const task = {
        title: 'Add sprint burndown chart',
        description: 'Plot remaining story points by day using completed tasks in the active sprint.',
        priority: 'high',
        estimateHours: 8
    };
    const messages = buildBreakdownMessages(task, ['To do', 'In progress', 'Done']);
    const systemPrompt = messages.find(message => message.role === 'system').content;
    const userPrompt = messages.find(message => message.role === 'user').content;

    assert.match(userPrompt, /Add sprint burndown chart/);
    assert.match(userPrompt, /Plot remaining story points by day/);
    assert.match(systemPrompt, /Ground every subtask in the task title and description/);
    assert.match(systemPrompt, /Do not use generic lifecycle steps/);
    assert.match(systemPrompt, /Do not assume frameworks, libraries, file paths, screens, or architecture/);
    assert.match(systemPrompt, /Do not add testing, documentation, deployment, or setup subtasks/);
    assert.match(systemPrompt, /Treat the task description as the primary source of requirements/);
    assert.match(systemPrompt, /do not generate subtasks from the title alone/i);
    assert.match(systemPrompt, /Acceptance criteria must verify this task's stated outcome/);
});

test('Breakdown constraint 1: Schema enforces between 3 and 7 subtasks', () => {
    // 2 subtasks should fail
    const tooFew = {
        subtasks: [
            { title: 'Sub 1', estimateHours: 2, rationale: 'r1' },
            { title: 'Sub 2', estimateHours: 3, rationale: 'r2' }
        ],
        acceptanceCriteria: ['Pass test'],
        risks: ['Risk 1']
    };
    assert.equal(BreakdownSchema.safeParse(tooFew).success, false, 'Should reject fewer than 3 subtasks');

    // 8 subtasks should fail (rejects more than 7 subtasks)
    const tooMany = {
        subtasks: Array.from({ length: 8 }, (_, i) => ({
            title: `Sub ${i + 1}`,
            estimateHours: 2,
            rationale: `r${i + 1}`
        })),
        acceptanceCriteria: ['Pass test'],
        risks: ['Risk 1']
    };
    assert.equal(BreakdownSchema.safeParse(tooMany).success, false, 'Should reject more than 7 subtasks');

    // 4 subtasks should succeed
    const valid = {
        subtasks: [
            { title: 'Sub 1', estimateHours: 2, rationale: 'r1' },
            { title: 'Sub 2', estimateHours: 3, rationale: 'r2' },
            { title: 'Sub 3', estimateHours: 2, rationale: 'r3' },
            { title: 'Sub 4', estimateHours: 1, rationale: 'r4' }
        ],
        acceptanceCriteria: ['Pass test'],
        risks: ['Risk 1']
    };
    const parsed = BreakdownSchema.safeParse(valid);
    assert.equal(parsed.success, true, 'Valid 4 subtasks should pass');
});

test('Breakdown uses current task title and description but ignores unrelated request fields', () => {
    const task = {
        title: 'Saved title',
        description: 'Saved description',
        toObject() {
            return { title: this.title, description: this.description };
        }
    };
    const breakdownTask = buildBreakdownTask(task, {
        title: 'Current title',
        description: 'Specific acceptance criteria and behavior',
        userPrompt: 'Unrelated prompt',
        boardId: 'untrusted-board'
    });

    assert.equal(breakdownTask.title, 'Current title');
    assert.equal(breakdownTask.description, 'Specific acceptance criteria and behavior');
    assert.equal(breakdownTask.boardId, undefined);
    assert.equal(breakdownTask.userPrompt, undefined);
});

test('Breakdown constraint 3: Subtask estimate hours bounded under a day (<= 8 hours)', () => {
    const invalidEstimate = {
        subtasks: [
            { title: 'Sub 1', estimateHours: 12, rationale: 'over a day' },
            { title: 'Sub 2', estimateHours: 3, rationale: 'r2' },
            { title: 'Sub 3', estimateHours: 2, rationale: 'r3' }
        ],
        acceptanceCriteria: ['Pass'],
        risks: ['Risk']
    };
    assert.equal(BreakdownSchema.safeParse(invalidEstimate).success, false, 'Estimate hours > 8 should be rejected');
});
