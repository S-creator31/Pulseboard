const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSchedule, CycleError } = require('../services/schedule');

test('CPM: Topological sort, forward/backward pass, and critical path', () => {
    // Network from lecture: A(4d) -> B(5d) -> D(6d) -> F(0d milestone)
    // and parallel branch A -> C(5d) -> E(3d) -> F (float 3 on C and E)
    const tasks = [
        { id: 'A', durationDays: 4 },
        { id: 'B', durationDays: 5 },
        { id: 'C', durationDays: 5 },
        { id: 'D', durationDays: 6 },
        { id: 'E', durationDays: 3 },
        { id: 'F', durationDays: 0 }
    ];

    const dependencies = [
        { predecessor: 'A', successor: 'B' },
        { predecessor: 'B', successor: 'D' },
        { predecessor: 'D', successor: 'F' },
        { predecessor: 'A', successor: 'C' },
        { predecessor: 'C', successor: 'E' },
        { predecessor: 'E', successor: 'F' }
    ];

    const result = computeSchedule(tasks, dependencies);

    assert.equal(result.projectDuration, 15, 'Project duration must be 15');
    assert.deepEqual(result.criticalPath, ['A', 'B', 'D', 'F'], 'Critical path must be A, B, D, F');

    const taskMap = new Map(result.tasks.map(t => [t.id, t]));

    // A: ES=0, EF=4, LS=0, LF=4, Float=0
    assert.equal(taskMap.get('A').es, 0);
    assert.equal(taskMap.get('A').ef, 4);
    assert.equal(taskMap.get('A').float, 0);
    assert.equal(taskMap.get('A').isCritical, true);

    // B: ES=4, EF=9, LS=4, LF=9, Float=0
    assert.equal(taskMap.get('B').es, 4);
    assert.equal(taskMap.get('B').ef, 9);
    assert.equal(taskMap.get('B').float, 0);
    assert.equal(taskMap.get('B').isCritical, true);

    // D: ES=9, EF=15, LS=9, LF=15, Float=0
    assert.equal(taskMap.get('D').es, 9);
    assert.equal(taskMap.get('D').ef, 15);
    assert.equal(taskMap.get('D').float, 0);
    assert.equal(taskMap.get('D').isCritical, true);

    // F: ES=15, EF=15, LS=15, LF=15, Float=0
    assert.equal(taskMap.get('F').es, 15);
    assert.equal(taskMap.get('F').ef, 15);
    assert.equal(taskMap.get('F').float, 0);
    assert.equal(taskMap.get('F').isCritical, true);

    // C: ES=4, EF=9, LS=7, LF=12, Float=3
    assert.equal(taskMap.get('C').es, 4);
    assert.equal(taskMap.get('C').ef, 9);
    assert.equal(taskMap.get('C').ls, 7);
    assert.equal(taskMap.get('C').lf, 12);
    assert.equal(taskMap.get('C').float, 3, 'C must have float 3');
    assert.equal(taskMap.get('C').isCritical, false);

    // E: ES=9, EF=12, LS=12, LF=15, Float=3
    assert.equal(taskMap.get('E').es, 9);
    assert.equal(taskMap.get('E').ef, 12);
    assert.equal(taskMap.get('E').ls, 12);
    assert.equal(taskMap.get('E').lf, 15);
    assert.equal(taskMap.get('E').float, 3, 'E must have float 3');
    assert.equal(taskMap.get('E').isCritical, false);
});

test('CPM: Network with C(2d) and E(3d) evaluates mathematically', () => {
    const tasks = [
        { id: 'A', durationDays: 4 },
        { id: 'B', durationDays: 5 },
        { id: 'C', durationDays: 2 },
        { id: 'D', durationDays: 6 },
        { id: 'E', durationDays: 3 },
        { id: 'F', durationDays: 0 }
    ];

    const dependencies = [
        { predecessor: 'A', successor: 'B' },
        { predecessor: 'B', successor: 'D' },
        { predecessor: 'D', successor: 'F' },
        { predecessor: 'A', successor: 'C' },
        { predecessor: 'C', successor: 'E' },
        { predecessor: 'E', successor: 'F' }
    ];

    const result = computeSchedule(tasks, dependencies);
    assert.equal(result.projectDuration, 15);
    assert.deepEqual(result.criticalPath, ['A', 'B', 'D', 'F']);
    const taskMap = new Map(result.tasks.map(t => [t.id, t]));
    assert.equal(taskMap.get('C').float, 6);
    assert.equal(taskMap.get('E').float, 6);
});

test('CPM: CycleError throws and names the cycle chain', () => {
    const tasks = [
        { id: 'task-1', durationDays: 2 },
        { id: 'task-2', durationDays: 3 },
        { id: 'task-3', durationDays: 1 }
    ];

    const cyclicDependencies = [
        { predecessor: 'task-1', successor: 'task-2' },
        { predecessor: 'task-2', successor: 'task-3' },
        { predecessor: 'task-3', successor: 'task-1' }
    ];

    assert.throws(
        () => computeSchedule(tasks, cyclicDependencies),
        (err) => {
            assert(err instanceof CycleError, 'Should be instance of CycleError');
            assert.equal(err.name, 'CycleError');
            assert(Array.isArray(err.chain), 'err.chain should be an array');
            assert(err.chain.length >= 3, 'Cycle chain should contain at least 3 nodes');
            assert(err.message.includes('Cycle detected'));
            return true;
        }
    );
});
