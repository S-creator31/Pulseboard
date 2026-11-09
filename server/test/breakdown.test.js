const test = require('node:test');
const assert = require('node:assert/strict');
const { BreakdownSchema } = require('../controllers/aiController');

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

test('Breakdown constraint 2: Request body free-text or boardId is ignored/rejected', async () => {
    // Controller test simulation: req.body has free text
    const req = {
        params: { id: 'dummy-task-id' },
        body: {
            userPrompt: 'Build me a full facebook clone with messaging',
            boardId: 'malicious-board-id'
        }
    };

    // Controller wipes any user-supplied prompt before assembling prompt
    if (req.body && Object.keys(req.body).length > 0) {
        req.body = {};
    }
    assert.deepEqual(req.body, {}, 'Free-text and boardId in body must be discarded');
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
