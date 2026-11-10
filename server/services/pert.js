/**
 * pert.js - Three-point (PERT) estimation and Monte Carlo schedule-risk engine.
 *
 * Pure and deterministic: zero database access, seeded RNG. It sits ON TOP of the
 * existing CPM engine (services/schedule.js) and never modifies it:
 *
 *   1. Each task may carry an optimistic (a), most likely (m) and pessimistic (b)
 *      duration. Expected duration E = (a + 4m + b) / 6, variance = ((b - a) / 6)^2.
 *   2. Analytical PERT: run CPM on the expected durations, sum the variances along the
 *      critical chain, and use a normal approximation for confidence dates.
 *   3. Monte Carlo: sample every task duration from a Beta-PERT (or triangular)
 *      distribution, re-run forward/backward passes N times, and report the empirical
 *      distribution of the project duration plus a criticality index per task.
 *
 * Tasks without a three-point estimate keep their ordinary CPM duration (a = m = b),
 * so enabling this feature never changes the numbers of tasks nobody has estimated.
 */

const { computeSchedule } = require('./schedule');

const EPS = 1e-9;
const DEFAULT_ITERATIONS = 10000;
const MIN_ITERATIONS = 100;
const MAX_ITERATIONS = 50000;
const DEFAULT_SEED = 1337;
const DEFAULT_BINS = 30;
const DEFAULT_LEVELS = [0.5, 0.8, 0.9, 0.95, 0.99];
const PERCENTILE_POINTS = [0.1, 0.25, 0.5, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99];
const DISTRIBUTIONS = ['pert', 'triangular'];

class EstimateError extends Error {
    constructor(message, taskId) {
        super(message);
        this.name = 'EstimateError';
        this.taskId = taskId;
    }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function toId(x) {
    if (x === null || x === undefined) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'object') {
        if (x._id !== undefined && x._id !== null) return String(x._id);
        if (typeof x.id === 'string') return x.id;
    }
    return String(x);
}

function round(x, digits = 4) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return x;
    const f = 10 ** digits;
    return Math.round(x * f) / f;
}

/** start date + ceil(days) calendar days, as YYYY-MM-DD (UTC). */
function addDays(startDate, days) {
    if (!startDate) return null;
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return null;
    const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + Math.ceil(days - EPS)));
    return out.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Three-point estimate
// ---------------------------------------------------------------------------

function assertThreePoint(a, m, b) {
    const parts = [['optimistic', a], ['mostLikely', m], ['pessimistic', b]];
    for (const [name, v] of parts) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            throw new EstimateError(`${name} must be a finite number`);
        }
        if (v < 0) {
            throw new EstimateError(`${name} cannot be negative`);
        }
    }
    if (!(a <= m && m <= b)) {
        throw new EstimateError('Estimates must satisfy optimistic <= mostLikely <= pessimistic');
    }
}

/**
 * Classic PERT three-point estimate.
 * @returns {{ expected: number, variance: number, stdDev: number }}
 */
function pertEstimate(a, m, b) {
    assertThreePoint(a, m, b);
    const stdDev = (b - a) / 6;
    return {
        expected: (a + 4 * m + b) / 6,
        variance: stdDev * stdDev,
        stdDev
    };
}

// ---------------------------------------------------------------------------
// Normal distribution
// ---------------------------------------------------------------------------

// Abramowitz & Stegun 7.1.26, absolute error < 1.5e-7
function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
    return sign * (1 - poly * t * Math.exp(-ax * ax));
}

function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Inverse standard normal CDF by bisection (plenty fast for a handful of calls). */
function normalInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    let lo = -10;
    let hi = 10;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (normalCdf(mid) < p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Seeded sampling (same PRNG family the repo's demo seeder uses)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gaussian(rng) {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Marsaglia-Tsang gamma sampler, valid for shape k >= 1 (Beta-PERT shapes are in [1, 5]). */
function sampleGamma(k, rng) {
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x;
        let v;
        do {
            x = gaussian(rng);
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = rng();
        if (u < 1 - 0.0331 * x * x * x * x) return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
}

/**
 * Returns a function rng -> duration for one task.
 * 'pert'       Beta-PERT (lambda = 4); its mean is exactly (a + 4m + b) / 6.
 * 'triangular' Triangular(a, m, b) via inverse CDF.
 */
function makeSampler(a, m, b, distribution) {
    if (b - a < EPS) return null; // deterministic task

    if (distribution === 'triangular') {
        const range = b - a;
        const fc = (m - a) / range;
        return (rng) => {
            const u = rng();
            return u < fc
                ? a + Math.sqrt(u * range * (m - a))
                : b - Math.sqrt((1 - u) * range * (b - m));
        };
    }

    const alpha = 1 + (4 * (m - a)) / (b - a);
    const beta = 1 + (4 * (b - m)) / (b - a);
    return (rng) => {
        const g1 = sampleGamma(alpha, rng);
        const g2 = sampleGamma(beta, rng);
        return a + (b - a) * (g1 / (g1 + g2));
    };
}

// ---------------------------------------------------------------------------
// Model construction (shared by the analytical and Monte Carlo parts)
// ---------------------------------------------------------------------------

function buildModel(tasks, dependencies, estimates) {
    // Plain, string-id copies. Passing normalised strings into computeSchedule keeps this
    // module independent of how Mongoose ObjectIds stringify.
    const normTasks = (tasks || []).map((t) => ({
        id: toId(t),
        title: t.title,
        durationDays: t.durationDays,
        duration: t.duration,
        estimateHours: t.estimateHours
    }));
    const normDeps = (dependencies || []).map((d) => ({
        predecessor: toId(d.predecessor),
        successor: toId(d.successor)
    }));

    // Deterministic CPM exactly as the app already computes it (throws CycleError on cycles).
    const baseline = computeSchedule(normTasks, normDeps);
    const baseDuration = new Map(baseline.tasks.map((t) => [t.id, t.duration]));
    const knownIds = new Set(baseDuration.keys());

    // Per-task stats
    const stats = new Map();
    for (const id of knownIds) {
        const d = baseDuration.get(id);
        stats.set(id, {
            hasEstimate: false,
            optimistic: d,
            mostLikely: d,
            pessimistic: d,
            expected: d,
            variance: 0,
            stdDev: 0
        });
    }

    for (const e of estimates || []) {
        const id = toId(e.task !== undefined ? e.task : e.taskId);
        if (!knownIds.has(id)) continue; // orphaned estimate (task deleted / other board)
        const a = e.optimistic;
        const m = e.mostLikely;
        const b = e.pessimistic;
        let est;
        try {
            est = pertEstimate(a, m, b);
        } catch (err) {
            if (err instanceof EstimateError) {
                throw new EstimateError(`Invalid estimate for task ${id}: ${err.message}`, id);
            }
            throw err;
        }
        stats.set(id, {
            hasEstimate: true,
            optimistic: a,
            mostLikely: m,
            pessimistic: b,
            expected: est.expected,
            variance: est.variance,
            stdDev: est.stdDev
        });
    }

    // CPM on expected durations
    const expectedTasks = normTasks.map((t) => {
        const s = stats.get(t.id);
        return s && s.hasEstimate ? { id: t.id, title: t.title, durationDays: s.expected } : t;
    });
    const pertSchedule = computeSchedule(expectedTasks, normDeps);

    // Graph (same rules computeSchedule applies: known ids only, no self-loops, de-duplicated)
    const preds = new Map();
    const succs = new Map();
    for (const id of knownIds) {
        preds.set(id, new Set());
        succs.set(id, new Set());
    }
    for (const d of normDeps) {
        if (knownIds.has(d.predecessor) && knownIds.has(d.successor) && d.predecessor !== d.successor) {
            succs.get(d.predecessor).add(d.successor);
            preds.get(d.successor).add(d.predecessor);
        }
    }

    return { baseline, pertSchedule, stats, preds, succs };
}

// ---------------------------------------------------------------------------
// Analytical PERT
// ---------------------------------------------------------------------------

function analyzePert(model, startDate, deadlineDays) {
    const { pertSchedule, stats, preds } = model;
    const T = pertSchedule.projectDuration;

    // Recompute criticality with a tolerance: expected durations are fractional, and the
    // exact `float === 0` comparison is not safe once floating-point sums are involved.
    const rows = pertSchedule.tasks.map((t) => {
        const s = stats.get(t.id);
        const float = Math.max(0, t.ls - t.es);
        return {
            id: t.id,
            title: t.title,
            hasEstimate: s.hasEstimate,
            optimistic: s.optimistic,
            mostLikely: s.mostLikely,
            pessimistic: s.pessimistic,
            expected: s.expected,
            variance: s.variance,
            stdDev: s.stdDev,
            es: t.es,
            ef: t.ef,
            ls: t.ls,
            lf: t.lf,
            float,
            isCritical: float < EPS
        };
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Max-variance critical chain via DP in topological order (rows are topologically ordered).
    const chainVar = new Map();
    const prev = new Map();
    for (const r of rows) {
        if (!r.isCritical) continue;
        let best = 0;
        let bestPred = null;
        for (const p of preds.get(r.id)) {
            const pr = byId.get(p);
            if (pr && pr.isCritical && Math.abs(pr.ef - r.es) < EPS) {
                const cv = chainVar.get(p);
                if (bestPred === null || cv > best) {
                    best = cv;
                    bestPred = p;
                }
            }
        }
        chainVar.set(r.id, r.variance + (bestPred === null ? 0 : best));
        prev.set(r.id, bestPred);
    }

    let endId = null;
    let endVar = -1;
    for (const r of rows) {
        if (r.isCritical && Math.abs(r.ef - T) < EPS) {
            const cv = chainVar.get(r.id);
            if (cv >= endVar) {
                endVar = cv;
                endId = r.id;
            }
        }
    }

    const criticalChain = [];
    for (let cur = endId; cur !== null && cur !== undefined; cur = prev.get(cur)) {
        criticalChain.unshift(cur);
    }

    const variance = Math.max(0, endVar);
    const stdDev = Math.sqrt(variance);

    const confidence = DEFAULT_LEVELS.map((level) => {
        const days = T + normalInv(level) * stdDev;
        return { level, days: round(days), date: addDays(startDate, days) };
    });

    let deadlineProbability = null;
    if (typeof deadlineDays === 'number' && Number.isFinite(deadlineDays)) {
        deadlineProbability = stdDev < EPS
            ? (T <= deadlineDays + EPS ? 1 : 0)
            : normalCdf((deadlineDays - T) / stdDev);
    }

    return {
        projectDuration: round(T),
        criticalPath: rows.filter((r) => r.isCritical).map((r) => r.id),
        criticalChain,
        variance: round(variance),
        stdDev: round(stdDev),
        confidence,
        deadlineProbability: deadlineProbability === null ? null : round(deadlineProbability),
        tasks: rows.map((r) => ({
            ...r,
            optimistic: round(r.optimistic),
            mostLikely: round(r.mostLikely),
            pessimistic: round(r.pessimistic),
            expected: round(r.expected),
            variance: round(r.variance),
            stdDev: round(r.stdDev),
            es: round(r.es),
            ef: round(r.ef),
            ls: round(r.ls),
            lf: round(r.lf),
            float: round(r.float)
        }))
    };
}

// ---------------------------------------------------------------------------
// Monte Carlo
// ---------------------------------------------------------------------------

function percentileOf(sorted, p) {
    const n = sorted.length;
    return sorted[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
}

/** Number of values <= x in an ascending Float64Array. */
function countAtOrBelow(sorted, x) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sorted[mid] <= x + EPS) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function buildHistogram(sorted, bins) {
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    if (max - min < EPS) {
        return [{ from: round(min), to: round(max), count: n, probability: 1, cumulative: 1 }];
    }
    const width = (max - min) / bins;
    const counts = new Array(bins).fill(0);
    for (let i = 0; i < n; i++) {
        counts[Math.min(bins - 1, Math.floor((sorted[i] - min) / width))]++;
    }
    let running = 0;
    return counts.map((count, i) => {
        running += count;
        return {
            from: round(min + i * width),
            to: round(min + (i + 1) * width),
            count,
            probability: round(count / n, 6),
            cumulative: round(running / n, 6)
        };
    });
}

function runMonteCarlo(model, options, startDate, deadlineDays, baselineDuration) {
    const { pertSchedule, stats, preds, succs } = model;
    const order = pertSchedule.tasks.map((t) => t.id); // topological order
    const n = order.length;
    const index = new Map(order.map((id, i) => [id, i]));

    const predIdx = order.map((id) => Array.from(preds.get(id)).map((p) => index.get(p)));
    const succIdx = order.map((id) => Array.from(succs.get(id)).map((s) => index.get(s)));
    const samplers = order.map((id) => {
        const s = stats.get(id);
        return makeSampler(s.optimistic, s.mostLikely, s.pessimistic, options.distribution);
    });
    const fixed = order.map((id) => stats.get(id).expected);

    const rng = mulberry32(options.seed);
    const iterations = options.iterations;

    const dur = new Float64Array(n);
    const es = new Float64Array(n);
    const ef = new Float64Array(n);
    const ls = new Float64Array(n);
    const totals = new Float64Array(iterations);
    const critCount = new Float64Array(n);

    for (let it = 0; it < iterations; it++) {
        // forward pass
        let total = 0;
        for (let i = 0; i < n; i++) {
            dur[i] = samplers[i] ? samplers[i](rng) : fixed[i];
            let start = 0;
            const ps = predIdx[i];
            for (let k = 0; k < ps.length; k++) {
                const f = ef[ps[k]];
                if (f > start) start = f;
            }
            es[i] = start;
            ef[i] = start + dur[i];
            if (ef[i] > total) total = ef[i];
        }
        totals[it] = total;

        // backward pass -> criticality
        for (let i = n - 1; i >= 0; i--) {
            let lf = total;
            const ss = succIdx[i];
            for (let k = 0; k < ss.length; k++) {
                const l = ls[ss[k]];
                if (l < lf) lf = l;
            }
            ls[i] = lf - dur[i];
            if (ls[i] - es[i] < 1e-7) critCount[i]++;
        }
    }

    const sorted = Float64Array.from(totals).sort();
    let sum = 0;
    for (let i = 0; i < iterations; i++) sum += totals[i];
    const mean = sum / iterations;
    let sq = 0;
    for (let i = 0; i < iterations; i++) sq += (totals[i] - mean) ** 2;
    const stdDev = Math.sqrt(sq / iterations);

    const percentiles = {};
    for (const p of PERCENTILE_POINTS) {
        percentiles[`p${Math.round(p * 100)}`] = round(percentileOf(sorted, p));
    }

    const confidence = DEFAULT_LEVELS.map((level) => {
        const days = percentileOf(sorted, level);
        return { level, days: round(days), date: addDays(startDate, days) };
    });

    const criticalityIndex = {};
    order.forEach((id, i) => {
        criticalityIndex[id] = round(critCount[i] / iterations);
    });

    let deadlineProbability = null;
    if (typeof deadlineDays === 'number' && Number.isFinite(deadlineDays)) {
        deadlineProbability = round(countAtOrBelow(sorted, deadlineDays) / iterations);
    }

    return {
        iterations,
        seed: options.seed,
        distribution: options.distribution,
        mean: round(mean),
        stdDev: round(stdDev),
        min: round(sorted[0]),
        max: round(sorted[iterations - 1]),
        percentiles,
        confidence,
        // How likely the deterministic CPM duration (as currently scheduled) is to hold.
        probabilityOfBaseline: round(countAtOrBelow(sorted, baselineDuration) / iterations),
        deadlineProbability,
        histogram: buildHistogram(sorted, options.bins),
        criticalityIndex
    };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

function resolveOptions(options = {}) {
    let iterations = Number.isFinite(options.iterations) ? Math.floor(options.iterations) : DEFAULT_ITERATIONS;
    iterations = Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, iterations));

    const distribution = options.distribution === undefined ? 'pert' : options.distribution;
    if (!DISTRIBUTIONS.includes(distribution)) {
        throw new EstimateError(`distribution must be one of: ${DISTRIBUTIONS.join(', ')}`);
    }

    const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : DEFAULT_SEED;
    const bins = Number.isFinite(options.bins) ? Math.min(100, Math.max(5, Math.floor(options.bins))) : DEFAULT_BINS;

    return { iterations, distribution, seed, bins };
}

/**
 * @param {Array} tasks         Task docs/objects ({ _id|id, title, durationDays, ... })
 * @param {Array} dependencies  [{ predecessor, successor }]
 * @param {Array} estimates     [{ task, optimistic, mostLikely, pessimistic }]
 * @param {Object} [options]    { iterations, seed, distribution: 'pert'|'triangular', bins,
 *                                startDate, deadlineDays }
 * @throws CycleError (from schedule.js) on cyclic dependencies, EstimateError on bad input
 */
function computePertAnalysis(tasks = [], dependencies = [], estimates = [], options = {}) {
    const opts = resolveOptions(options);
    const startDate = options.startDate || null;
    const deadlineDays = typeof options.deadlineDays === 'number' ? options.deadlineDays : null;

    const model = buildModel(tasks, dependencies, estimates);
    const meta = {
        tasksTotal: model.baseline.tasks.length,
        tasksWithEstimates: Array.from(model.stats.values()).filter((s) => s.hasEstimate).length,
        startDate: startDate ? addDays(startDate, 0) : null,
        deadlineDays
    };

    const baseline = {
        projectDuration: round(model.baseline.projectDuration),
        criticalPath: model.baseline.criticalPath
    };

    if (model.baseline.tasks.length === 0) {
        return { meta, baseline, pert: null, monteCarlo: null };
    }

    const pert = analyzePert(model, startDate, deadlineDays);
    const monteCarlo = runMonteCarlo(model, opts, startDate, deadlineDays, model.baseline.projectDuration);

    return { meta, baseline, pert, monteCarlo };
}

module.exports = {
    computePertAnalysis,
    pertEstimate,
    EstimateError,
    normalCdf,
    normalInv,
    mulberry32,
    addDays,
    MAX_ITERATIONS
};
