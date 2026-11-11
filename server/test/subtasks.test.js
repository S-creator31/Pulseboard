const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSubtaskDependencyEdges } = require('../controllers/taskController');

test('Subtask replacement redirects incoming dependencies to every subtask', () => {
    const edges = buildSubtaskDependencyEdges('parent', [{ _id: 'sub-1' }, { _id: 'sub-2' }], [
        { board: 'board', predecessor: 'predecessor', successor: 'parent' }
    ]);

    assert.deepEqual(edges, [
        { board: 'board', predecessor: 'predecessor', successor: 'sub-1' },
        { board: 'board', predecessor: 'predecessor', successor: 'sub-2' }
    ]);
});

test('Subtask replacement redirects outgoing dependencies from every subtask', () => {
    const edges = buildSubtaskDependencyEdges('parent', [{ _id: 'sub-1' }, { _id: 'sub-2' }], [
        { board: 'board', predecessor: 'parent', successor: 'successor' }
    ]);

    assert.deepEqual(edges, [
        { board: 'board', predecessor: 'sub-1', successor: 'successor' },
        { board: 'board', predecessor: 'sub-2', successor: 'successor' }
    ]);
});

test('Subtask replacement ignores unrelated dependencies', () => {
    const edges = buildSubtaskDependencyEdges('parent', [{ _id: 'sub-1' }], [
        { board: 'board', predecessor: 'other-1', successor: 'other-2' }
    ]);

    assert.deepEqual(edges, []);
});
