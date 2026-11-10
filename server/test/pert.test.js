const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSchedule, CycleError } = require('../services/schedule');
const {
    computePertAnalysis,
    pertEstimate,
    EstimateError,
    normalCdf,
    normalInv
} = require('../services/pert');

function assertClose(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${message || 'value'}: expected ${expected} ± ${tolerance}, got ${actual}`
    );
}

// Lecture network from schedule.test.js: A -> B -> D -> F and A -> C -> E -> F.
// Deterministic durations (used by plain CPM): A4 B5 C5 D6 E3 F0 => critical path A,B,D,F = 15.
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
// Three-point estimates on the critical tasks B and D only.
//   B: a3 m5 b7  -> E = (3+20+7)/6  = 5, sd = 4/6,  var = 0.4444
//   D: a4 m6 b14 -> E = (4+24+14)/6 = 7, sd = 10/6, var = 2.7778
// => expected project duration 4 + 5 + 7 = 16, variance 3.2222, sigma 1.79505
const estimates = [
    { task: 'B', optimistic: 3, mostLikely: 5, pessimistic: 7 },
    { task: 'D', optimistic: 4, mostLikely: 6, pessimistic: 14 }
];

test('PERT: three-point formula E = (a + 4m + b) / 6 and sigma = (b - a) / 6', () => {
    const r = pertEstimate(2, 5, 14);
    assert.equal(r.expected, 6);
    assert.equal(r.stdDev, 2);
    assert.equal(r.variance, 4);

    const flat = pertEstimate(3, 3, 3);
    assert.equal(flat.expected, 3);
    assert.equal(flat.variance, 0);
});

test('PERT: invalid three-point input is rejected', () => {
    assert.throws(() => pertEstimate(5, 3, 8), EstimateError, 'a > m');
    assert.throws(() => pertEstimate(1, 9, 8), EstimateError, 'm > b');
    assert.throws(() => pertEstimate(-1, 2, 3), EstimateError, 'negative');
    assert.throws(() => pertEstimate(NaN, 2, 3), EstimateError, 'NaN');
    assert.throws(() => pertEstimate('1', 2, 3), EstimateError, 'string');
});

test('PERT: normal helpers match known values', () => {
    assertClose(normalCdf(0), 0.5, 1e-9);
    assertClose(normalCdf(1.96), 0.975, 1e-3);
    assertClose(normalInv(0.95), 1.6449, 1e-3);
    assertClose(normalInv(0.5), 0, 1e-9);
});

test('PERT analytical: expected duration, critical chain, variance and confidence dates', () => {
    const r = computePertAnalysis(tasks, dependencies, estimates, {
        iterations: 1000,
        startDate: '2026-01-01',
        deadlineDays: 18
    });

    assert.equal(r.pert.projectDuration, 16);
    assert.deepEqual(r.pert.criticalChain, ['A', 'B', 'D', 'F']);
    assertClose(r.pert.variance, 3.2222, 1e-3, 'variance');
    assertClose(r.pert.stdDev, 1.7951, 1e-3, 'stdDev');

    const byId = new Map(r.pert.tasks.map((t) => [t.id, t]));
    assert.equal(byId.get('B').expected, 5);
    assert.equal(byId.get('D').expected, 7);
    assert.equal(byId.get('B').hasEstimate, true);
    assert.equal(byId.get('C').hasEstimate, false);
    // C and E are off the critical path: LS(E)=13, LS(C)=8 => float 4
    assert.equal(byId.get('C').float, 4);
    assert.equal(byId.get('E').float, 4);
    assert.equal(byId.get('C').isCritical, false);

    // 50% = expected duration; 95% = 16 + 1.6449 * 1.79505 = 18.953
    const c50 = r.pert.confidence.find((c) => c.level === 0.5);
    const c95 = r.pert.confidence.find((c) => c.level === 0.95);
    assertClose(c50.days, 16, 1e-3);
    assertClose(c95.days, 18.953, 0.01);
    assert.equal(c50.date, '2026-01-17'); // 2026-01-01 + 16 days
    assert.equal(c95.date, '2026-01-20'); // + ceil(18.95) = 19 days

    // P(finish <= 18) = Phi(2 / 1.79505) = 0.867
    assertClose(r.pert.deadlineProbability, 0.867, 0.005, 'normal deadline probability');
});

test('PERT: leaves the deterministic CPM baseline untouched', () => {
    const r = computePertAnalysis(tasks, dependencies, estimates, { iterations: 200 });
    const direct = computeSchedule(tasks, dependencies);

    assert.equal(r.baseline.projectDuration, direct.projectDuration);
    assert.equal(r.baseline.projectDuration, 15);
    assert.deepEqual(r.baseline.criticalPath, direct.criticalPath);
    assert.deepEqual(r.baseline.criticalPath, ['A', 'B', 'D', 'F']);
});

test('Monte Carlo: deterministic for a given seed, different across seeds', () => {
    const opts = { iterations: 2000, seed: 7 };
    const one = computePertAnalysis(tasks, dependencies, estimates, opts);
    const two = computePertAnalysis(tasks, dependencies, estimates, opts);
    const other = computePertAnalysis(tasks, dependencies, estimates, { ...opts, seed: 8 });

    assert.deepEqual(one.monteCarlo, two.monteCarlo);
    assert.notEqual(one.monteCarlo.mean, other.monteCarlo.mean);
});

test('Monte Carlo: Beta-PERT mean converges to the PERT expected duration', () => {
    const r = computePertAnalysis(tasks, dependencies, estimates, { iterations: 20000, seed: 42 });
    const mc = r.monteCarlo;

    assertClose(mc.mean, 16, 0.1, 'MC mean vs PERT expected duration');

    // Classic PERT sigma = (b - a) / 6 is an approximation. A Beta-PERT (lambda = 4) variable has
    // exact variance (mean - a)(b - mean) / 7:
    //   B: (5-3)(7-5)/7 = 0.5714    D: (7-4)(14-7)/7 = 3.0    => sqrt(3.5714) = 1.8898
    // so the simulated sigma is expected to sit a few percent above the analytical 1.795.
    assertClose(mc.stdDev, Math.sqrt(0.5714285714 + 3), 0.06, 'MC stdDev vs exact Beta-PERT sigma');
    assert.ok(mc.stdDev > r.pert.stdDev, 'MC sigma should exceed the (b-a)/6 approximation here');

    // Hard bounds from the inputs: best case 4+3+4 = 11, worst case 4+7+14 = 25.
    assert.ok(mc.min >= 11 && mc.max <= 25, `range ${mc.min}..${mc.max}`);

    // Percentiles must be monotonic and bracket the mean sensibly.
    const p = mc.percentiles;
    assert.ok(p.p10 <= p.p25 && p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p90 && p.p90 <= p.p95 && p.p95 <= p.p99);
    // The distribution of D is right-skewed, so the empirical P95 sits near (not exactly on)
    // the normal-approximation P95 of 18.95.
    assertClose(p.p95, 18.95, 0.75, 'MC P95 vs analytical P95');

    // Because the estimates are right-skewed, the old deterministic date (15) is unlikely.
    assert.ok(mc.probabilityOfBaseline < 0.5, `P(<= CPM 15d) = ${mc.probabilityOfBaseline}`);
});

test('Monte Carlo: histogram is a proper probability distribution', () => {
    const { monteCarlo } = computePertAnalysis(tasks, dependencies, estimates, { iterations: 5000, bins: 25 });
    const h = monteCarlo.histogram;

    assert.equal(h.length, 25);
    assert.equal(h.reduce((s, b) => s + b.count, 0), 5000);
    assertClose(h.reduce((s, b) => s + b.probability, 0), 1, 1e-3, 'probability mass');
    assert.equal(h[h.length - 1].cumulative, 1);
    for (let i = 1; i < h.length; i++) {
        assert.ok(h[i].cumulative >= h[i - 1].cumulative);
    }
});

test('Monte Carlo: criticality index identifies the driving path', () => {
    const { monteCarlo } = computePertAnalysis(tasks, dependencies, estimates, { iterations: 5000 });
    const ci = monteCarlo.criticalityIndex;

    for (const id of ['A', 'B', 'D', 'F']) {
        assert.ok(ci[id] > 0.99, `${id} should be almost always critical, got ${ci[id]}`);
    }
    // The C -> E branch (8 days) is far behind the 16 day chain; it should essentially never drive.
    assert.ok(ci.C < 0.02 && ci.E < 0.02, `C=${ci.C} E=${ci.E}`);
});

test('Monte Carlo: two identical parallel branches share criticality ~50/50', () => {
    const t = [{ id: 'S', durationDays: 1 }, { id: 'X', durationDays: 5 }, { id: 'Y', durationDays: 5 }, { id: 'Z', durationDays: 1 }];
    const d = [
        { predecessor: 'S', successor: 'X' },
        { predecessor: 'S', successor: 'Y' },
        { predecessor: 'X', successor: 'Z' },
        { predecessor: 'Y', successor: 'Z' }
    ];
    const e = [
        { task: 'X', optimistic: 3, mostLikely: 5, pessimistic: 9 },
        { task: 'Y', optimistic: 3, mostLikely: 5, pessimistic: 9 }
    ];
    const { monteCarlo } = computePertAnalysis(t, d, e, { iterations: 10000, seed: 3 });
    const ci = monteCarlo.criticalityIndex;

    assertClose(ci.X, 0.5, 0.05, 'X criticality');
    assertClose(ci.Y, 0.5, 0.05, 'Y criticality');
    assertClose(ci.X + ci.Y, 1, 0.001, 'exactly one branch drives each iteration');
    assert.equal(ci.S, 1);
    assert.equal(ci.Z, 1);
    // Merge bias: the mean of max(X, Y) exceeds the mean of either branch alone (7 + ... = 5.33 + 2).
    assert.ok(monteCarlo.mean > 7.33 + 0.1, `merge bias expected, mean=${monteCarlo.mean}`);
});

test('Monte Carlo: tasks without estimates stay deterministic (zero variance)', () => {
    const r = computePertAnalysis(tasks, dependencies, [], { iterations: 500 });

    assert.equal(r.meta.tasksWithEstimates, 0);
    assert.equal(r.pert.variance, 0);
    assert.equal(r.pert.projectDuration, 15);
    assert.equal(r.monteCarlo.stdDev, 0);
    assert.equal(r.monteCarlo.min, 15);
    assert.equal(r.monteCarlo.max, 15);
    assert.equal(r.monteCarlo.probabilityOfBaseline, 1);
    assert.equal(r.monteCarlo.histogram.length, 1);
});

test('Monte Carlo: triangular distribution has mean (a + m + b) / 3', () => {
    // B: (3+5+7)/3 = 5, D: (4+6+14)/3 = 8, plus A = 4  => 17
    const r = computePertAnalysis(tasks, dependencies, estimates, {
        iterations: 20000,
        seed: 11,
        distribution: 'triangular'
    });
    assert.equal(r.monteCarlo.distribution, 'triangular');
    assertClose(r.monteCarlo.mean, 17, 0.1, 'triangular mean');
});

test('Monte Carlo: deadline probability is monotonic and consistent with percentiles', () => {
    const early = computePertAnalysis(tasks, dependencies, estimates, { iterations: 5000, deadlineDays: 12 });
    const late = computePertAnalysis(tasks, dependencies, estimates, { iterations: 5000, deadlineDays: 30 });
    assert.ok(early.monteCarlo.deadlineProbability < 0.05);
    assert.equal(late.monteCarlo.deadlineProbability, 1);

    const r = computePertAnalysis(tasks, dependencies, estimates, { iterations: 10000 });
    const p90 = r.monteCarlo.percentiles.p90;
    const check = computePertAnalysis(tasks, dependencies, estimates, { iterations: 10000, deadlineDays: p90 });
    assert.ok(check.monteCarlo.deadlineProbability >= 0.9, `P(<= p90) = ${check.monteCarlo.deadlineProbability}`);
});

test('PERT: cycles still raise CycleError', () => {
    const cyc = [
        { predecessor: 'A', successor: 'B' },
        { predecessor: 'B', successor: 'A' }
    ];
    assert.throws(
        () => computePertAnalysis([{ id: 'A', durationDays: 1 }, { id: 'B', durationDays: 1 }], cyc, []),
        (err) => err instanceof CycleError
    );
});

test('PERT: bad estimates name the offending task; orphan estimates are ignored', () => {
    assert.throws(
        () => computePertAnalysis(tasks, dependencies, [{ task: 'B', optimistic: 9, mostLikely: 5, pessimistic: 7 }]),
        (err) => err instanceof EstimateError && err.taskId === 'B'
    );

    const r = computePertAnalysis(
        tasks,
        dependencies,
        [...estimates, { task: 'deleted-task', optimistic: 1, mostLikely: 2, pessimistic: 3 }],
        { iterations: 200 }
    );
    assert.equal(r.meta.tasksWithEstimates, 2);
});

test('PERT: rejects unknown distribution names', () => {
    assert.throws(
        () => computePertAnalysis(tasks, dependencies, estimates, { distribution: 'gaussian' }),
        EstimateError
    );
});

test('PERT: empty board and input immutability', () => {
    const empty = computePertAnalysis([], [], []);
    assert.equal(empty.pert, null);
    assert.equal(empty.monteCarlo, null);
    assert.equal(empty.baseline.projectDuration, 0);

    const before = JSON.stringify({ tasks, dependencies, estimates });
    computePertAnalysis(tasks, dependencies, estimates, { iterations: 300 });
    assert.equal(JSON.stringify({ tasks, dependencies, estimates }), before);
});

test('PERT: accepts Mongoose-style ObjectId ids (id is a Buffer, _id returns itself)', () => {
    class FakeObjectId {
        constructor(hex) {
            this.hex = hex;
            this.id = Buffer.from(hex); // bson 6 exposes the raw bytes as `id`
        }
        get _id() { return this; }
        toString() { return this.hex; }
    }
    const oid = (h) => new FakeObjectId(h);

    const mongoTasks = tasks.map((t) => ({ _id: oid(t.id), durationDays: t.durationDays, title: `Task ${t.id}` }));
    const mongoDeps = dependencies.map((d) => ({ predecessor: oid(d.predecessor), successor: oid(d.successor) }));
    const mongoEstimates = estimates.map((e) => ({ ...e, task: oid(e.task) }));

    const r = computePertAnalysis(mongoTasks, mongoDeps, mongoEstimates, { iterations: 500 });
    assert.equal(r.pert.projectDuration, 16);
    assert.deepEqual(r.pert.criticalChain, ['A', 'B', 'D', 'F']);
});
