/**
 * schedule.js - Pure Critical Path Method (CPM) calculation engine
 * Zero database access. Pure deterministic graph algorithm.
 */

class CycleError extends Error {
    constructor(chain = []) {
        super(`Cycle detected in task dependencies: ${chain.join(' -> ')}`);
        this.name = 'CycleError';
        this.chain = chain;
    }
}

/**
 * Computes CPM schedule for a set of tasks and dependencies.
 * @param {Array} tasks - Array of task objects [{ id, durationDays, ... }]
 * @param {Array} dependencies - Array of [{ predecessor, successor }]
 * @returns {Object} { tasks: [{ id, es, ef, ls, lf, float, isCritical }], criticalPath: [ids], projectDuration }
 */
function computeSchedule(tasks = [], dependencies = []) {
    if (!tasks || tasks.length === 0) {
        return { tasks: [], criticalPath: [], projectDuration: 0 };
    }

    // Normalize task id and duration
    const taskMap = new Map();
    for (const t of tasks) {
        const id = (t.id || t._id || '').toString();
        const duration = typeof t.durationDays === 'number'
            ? t.durationDays
            : typeof t.duration === 'number'
                ? t.duration
                : typeof t.estimateHours === 'number'
                    ? Math.max(1, Math.round(t.estimateHours / 8))
                    : 1;
        taskMap.set(id, {
            id,
            title: t.title || id,
            duration: Math.max(0, duration),
            raw: t
        });
    }

    // Build adjacency graphs
    const outgoing = new Map(); // predecessor -> set of successors
    const incoming = new Map(); // successor -> set of predecessors

    for (const id of taskMap.keys()) {
        outgoing.set(id, new Set());
        incoming.set(id, new Set());
    }

    for (const dep of dependencies) {
        const p = (dep.predecessor?.id || dep.predecessor?._id || dep.predecessor || '').toString();
        const s = (dep.successor?.id || dep.successor?._id || dep.successor || '').toString();

        if (taskMap.has(p) && taskMap.has(s) && p !== s) {
            outgoing.get(p).add(s);
            incoming.get(s).add(p);
        }
    }

    // 1. Topological Sort + Cycle Detection via 3-color DFS
    const visited = new Map(); // 0 = unvisited, 1 = visiting, 2 = visited
    const parentMap = new Map();
    const topoOrder = [];

    for (const id of taskMap.keys()) {
        visited.set(id, 0);
    }

    function dfs(u, path) {
        visited.set(u, 1);
        path.push(u);

        for (const v of outgoing.get(u)) {
            if (visited.get(v) === 1) {
                // Cycle found
                const cycleStartIndex = path.indexOf(v);
                const cycleChain = path.slice(cycleStartIndex).concat(v);
                throw new CycleError(cycleChain);
            }
            if (visited.get(v) === 0) {
                dfs(v, path);
            }
        }

        visited.set(u, 2);
        path.pop();
        topoOrder.push(u);
    }

    for (const id of taskMap.keys()) {
        if (visited.get(id) === 0) {
            dfs(id, []);
        }
    }

    topoOrder.reverse(); // Standard topological ordering

    // 2. Forward Pass: Earliest Start (ES) and Earliest Finish (EF)
    const es = new Map();
    const ef = new Map();

    for (const id of taskMap.keys()) {
        es.set(id, 0);
        ef.set(id, 0);
    }

    for (const u of topoOrder) {
        const uTask = taskMap.get(u);
        const uES = es.get(u);
        const uEF = uES + uTask.duration;
        ef.set(u, uEF);

        for (const v of outgoing.get(u)) {
            if (uEF > es.get(v)) {
                es.set(v, uEF);
            }
        }
    }

    // Overall Project Duration = max(EF of all tasks)
    let projectDuration = 0;
    for (const val of ef.values()) {
        if (val > projectDuration) projectDuration = val;
    }

    // 3. Backward Pass: Latest Finish (LF) and Latest Start (LS)
    const lf = new Map();
    const ls = new Map();

    for (const id of taskMap.keys()) {
        lf.set(id, projectDuration);
        ls.set(id, projectDuration);
    }

    // Process in reverse topological order
    for (let i = topoOrder.length - 1; i >= 0; i--) {
        const u = topoOrder[i];
        const uTask = taskMap.get(u);
        const succs = Array.from(outgoing.get(u));

        if (succs.length > 0) {
            let minSuccLS = Infinity;
            for (const v of succs) {
                const vLS = ls.get(v);
                if (vLS < minSuccLS) minSuccLS = vLS;
            }
            lf.set(u, minSuccLS);
        } else {
            lf.set(u, projectDuration);
        }

        const uLS = lf.get(u) - uTask.duration;
        ls.set(u, uLS);
    }

    // 4. Float and Critical Path Determination
    const resultTasks = [];
    const criticalTaskIds = new Set();

    for (const id of topoOrder) {
        const uTask = taskMap.get(id);
        const uES = es.get(id);
        const uEF = ef.get(id);
        const uLS = ls.get(id);
        const uLF = lf.get(id);
        const float = Math.max(0, uLS - uES);
        const isCritical = (float === 0 && uTask.duration >= 0);

        if (isCritical) {
            criticalTaskIds.add(id);
        }

        resultTasks.push({
            id,
            title: uTask.title,
            duration: uTask.duration,
            es: uES,
            ef: uEF,
            ls: uLS,
            lf: uLF,
            float,
            isCritical,
            raw: uTask.raw
        });
    }

    // Extract ordered critical path
    const criticalPath = [];
    for (const id of topoOrder) {
        if (criticalTaskIds.has(id)) {
            criticalPath.push(id);
        }
    }

    return {
        tasks: resultTasks,
        criticalPath,
        projectDuration
    };
}

module.exports = {
    computeSchedule,
    CycleError
};
