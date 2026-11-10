'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import BoardNav from '@/components/BoardNav';

const API = process.env.NEXT_PUBLIC_API_URL;
const ITERATION_OPTIONS = [1000, 5000, 10000, 20000, 50000];
const FIELDS = [
  { key: 'optimistic', label: 'Optimistic (a)' },
  { key: 'mostLikely', label: 'Most likely (m)' },
  { key: 'pessimistic', label: 'Pessimistic (b)' }
];

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

function fmtDays(n, digits = 1) {
  return typeof n === 'number' ? `${n.toFixed(digits)}d` : '—';
}

function pct(p) {
  return typeof p === 'number' ? `${Math.round(p * 100)}%` : '—';
}

/** Validates the three draft inputs for a task row. */
function evaluateDraft(values) {
  const raw = [values.optimistic, values.mostLikely, values.pessimistic];
  if (raw.every((v) => v === '')) return { state: 'empty' };
  const nums = raw.map((v) => (v === '' ? NaN : Number(v)));
  if (nums.some((n) => !Number.isFinite(n))) return { state: 'incomplete' };
  if (nums.some((n) => n < 0)) return { state: 'invalid', message: 'Values cannot be negative' };
  const [a, m, b] = nums;
  if (!(a <= m && m <= b)) {
    return { state: 'invalid', message: 'Needs optimistic ≤ most likely ≤ pessimistic' };
  }
  return { state: 'valid', expected: (a + 4 * m + b) / 6, stdDev: (b - a) / 6, nums };
}

function Tile({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-2xl border p-4 relative overflow-hidden shadow-sm"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} />
      <span className="text-[11px] font-medium block" style={{ color: 'var(--color-ink-muted)' }}>{label}</span>
      <div className="font-data text-2xl font-bold my-1 tracking-tight" style={{ color: 'var(--color-ink)' }}>{value}</div>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--color-ink-muted)' }}>{sub}</p>
    </div>
  );
}

export default function RiskPage() {
  const { id: boardId } = useParams();
  const { user } = useAuth();
  const token = user?.token;

  const [board, setBoard] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Simulation controls
  const [iterations, setIterations] = useState(10000);
  const [distribution, setDistribution] = useState('pert');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');

  // Unsaved edits of the three-point inputs: { [taskId]: { optimistic, mostLikely, pessimistic } }
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);

  const requestCounter = useRef(0);
  const didInit = useRef(false);

  const runAnalysis = useCallback(async () => {
    if (!token || !boardId) return;
    const myRequest = ++requestCounter.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ iterations: String(iterations), distribution });
      if (startDate) params.set('startDate', startDate);
      if (deadline) params.set('deadline', deadline);

      const res = await fetch(`${API}/boards/${boardId}/risk?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json().catch(() => ({}));
      if (myRequest !== requestCounter.current) return; // a newer run superseded this one
      if (!res.ok) {
        setError(body.message || 'Could not compute schedule risk');
        return;
      }
      setData(body);
    } catch (err) {
      if (myRequest === requestCounter.current) {
        console.error('Error computing schedule risk:', err);
        setError('Could not reach the server');
      }
    } finally {
      if (myRequest === requestCounter.current) setLoading(false);
    }
  }, [token, boardId, iterations, distribution, startDate, deadline]);

  // Default the start date on the client (avoids a server/client timezone hydration mismatch)
  useEffect(() => {
    setStartDate(localToday());
  }, []);

  useEffect(() => {
    if (!token || !boardId) return;
    fetch(`${API}/boards/${boardId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && setBoard(b))
      .catch((err) => console.error('Error fetching board:', err));
  }, [token, boardId]);

  // First automatic run once the token and the default start date are available
  useEffect(() => {
    if (didInit.current || !token || !boardId || !startDate) return;
    didInit.current = true;
    runAnalysis();
  }, [token, boardId, startDate, runAnalysis]);

  const pert = data?.pert;
  const mc = data?.monteCarlo;
  const baseline = data?.baseline;
  const meta = data?.meta;

  // ---- Task rows (critical first) --------------------------------------------------------
  const rows = useMemo(() => {
    if (!pert) return [];
    return [...pert.tasks].sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      return a.es - b.es;
    });
  }, [pert]);

  const valuesFor = (row) => ({
    optimistic: edits[row.id]?.optimistic ?? (row.hasEstimate ? String(row.optimistic) : ''),
    mostLikely: edits[row.id]?.mostLikely ?? (row.hasEstimate ? String(row.mostLikely) : ''),
    pessimistic: edits[row.id]?.pessimistic ?? (row.hasEstimate ? String(row.pessimistic) : '')
  });

  const setField = (row, key, value) => {
    setEdits((prev) => ({ ...prev, [row.id]: { ...valuesFor(row), ...prev[row.id], [key]: value } }));
  };

  const clearEdits = (id) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEstimate = async (row, nums) => {
    setSavingId(row.id);
    try {
      const [optimistic, mostLikely, pessimistic] = nums;
      const res = await fetch(`${API}/boards/${boardId}/estimates/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ optimistic, mostLikely, pessimistic })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.message || 'Could not save estimate');
        return;
      }
      toast.success(`Estimate saved for "${row.title}"`);
      clearEdits(row.id);
      await runAnalysis();
    } catch {
      toast.error('Could not save estimate');
    } finally {
      setSavingId(null);
    }
  };

  const removeEstimate = async (row) => {
    setSavingId(row.id);
    try {
      const res = await fetch(`${API}/boards/${boardId}/estimates/${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.message || 'Could not remove estimate');
        return;
      }
      toast.success(`Estimate removed for "${row.title}"`);
      clearEdits(row.id);
      await runAnalysis();
    } catch {
      toast.error('Could not remove estimate');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Chart data -----------------------------------------------------------------------
  const chart = useMemo(() => {
    if (!mc || !mc.histogram || mc.histogram.length < 2) return null;
    const bins = mc.histogram;
    const width = bins[0].to - bins[0].from;
    const decimals = width < 0.1 ? 2 : width < 1 ? 1 : 0;
    const points = bins.map((b) => {
      const mid = (b.from + b.to) / 2;
      return {
        label: mid.toFixed(decimals),
        from: b.from,
        to: b.to,
        probability: Math.round(b.probability * 1000) / 10,
        cumulative: Math.round(b.cumulative * 1000) / 10
      };
    });
    const labelFor = (value) => {
      if (typeof value !== 'number') return null;
      const hit = points.find((p, i) => value >= p.from && (value < p.to || i === points.length - 1));
      return value < points[0].from || value > points[points.length - 1].to ? null : hit?.label ?? null;
    };
    const markers = [
      { key: 'cpm', text: 'CPM', value: baseline?.projectDuration, color: 'var(--color-ink-muted)' },
      { key: 'p50', text: 'P50', value: mc.percentiles.p50, color: 'var(--color-brand)' },
      { key: 'p95', text: 'P95', value: mc.percentiles.p95, color: 'var(--color-accent)' },
      { key: 'deadline', text: 'Deadline', value: meta?.deadlineDays, color: 'var(--color-danger)' }
    ]
      .map((m) => ({ ...m, label: labelFor(m.value) }))
      .filter((m) => m.label !== null);
    return { points, markers };
  }, [mc, baseline, meta]);

  const hasUncertainty = !!mc && mc.stdDev > 0;
  const p95 = mc?.confidence?.find((c) => c.level === 0.95);
  const pert95 = pert?.confidence?.find((c) => c.level === 0.95);
  const deadlineP = mc?.deadlineProbability;
  const deadlineAccent =
    deadlineP == null ? 'var(--color-line)' : deadlineP >= 0.85 ? 'var(--color-success)' : deadlineP >= 0.5 ? 'var(--color-warning)' : 'var(--color-danger)';

  const inputStyle = {
    background: 'var(--color-surface)',
    borderColor: 'var(--color-line)',
    color: 'var(--color-ink)'
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-paper)' }}>
      <BoardNav board={board} activeTab="risk" members={board?.members || []} />

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 space-y-5">
        {/* Header + controls */}
        <section
          className="rounded-2xl border p-4 flex flex-wrap items-end justify-between gap-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
        >
          <div className="max-w-xl">
            <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-ink)' }}>
              Schedule Risk — Three-Point PERT &amp; Monte Carlo
            </h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
              Enter optimistic, most likely and pessimistic durations per task. Expected duration is
              E = (a + 4m + b) / 6. The simulation samples every estimated task thousands of times to show
              how likely each delivery date really is. Tasks without an estimate keep their CPM duration.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-medium flex flex-col gap-1" style={{ color: 'var(--color-ink-muted)' }}>
              Project start
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border font-data"
                style={inputStyle}
              />
            </label>
            <label className="text-[11px] font-medium flex flex-col gap-1" style={{ color: 'var(--color-ink-muted)' }}>
              Target deadline
              <input
                type="date"
                value={deadline}
                min={startDate || undefined}
                onChange={(e) => setDeadline(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border font-data"
                style={inputStyle}
              />
            </label>
            <label className="text-[11px] font-medium flex flex-col gap-1" style={{ color: 'var(--color-ink-muted)' }}>
              Distribution
              <select
                value={distribution}
                onChange={(e) => setDistribution(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg border cursor-pointer"
                style={inputStyle}
              >
                <option value="pert">Beta-PERT</option>
                <option value="triangular">Triangular</option>
              </select>
            </label>
            <label className="text-[11px] font-medium flex flex-col gap-1" style={{ color: 'var(--color-ink-muted)' }}>
              Iterations
              <select
                value={iterations}
                onChange={(e) => setIterations(Number(e.target.value))}
                className="px-2 py-1.5 text-xs rounded-lg border cursor-pointer font-data"
                style={inputStyle}
              >
                {ITERATION_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n.toLocaleString()}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading || !token}
              className="px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer text-white disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-brand)' }}
            >
              {loading ? 'Running…' : 'Run simulation'}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border p-3 text-xs"
            style={{ background: 'var(--color-danger-soft)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          >
            {error}
          </div>
        )}

        {!data && loading && (
          <div className="text-sm py-16 text-center" style={{ color: 'var(--color-ink-muted)' }}>
            Running simulation…
          </div>
        )}

        {data && !pert && (
          <div className="text-sm py-16 text-center" style={{ color: 'var(--color-ink-muted)' }}>
            This board has no tasks yet. Add tasks and dependencies to forecast delivery risk.
          </div>
        )}

        {data && pert && mc && (
          <>
            {/* Summary tiles */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Tile
                label="Deterministic CPM"
                value={fmtDays(baseline.projectDuration)}
                sub={hasUncertainty
                  ? `Only ${pct(mc.probabilityOfBaseline)} likely to hold given your estimates`
                  : 'No three-point estimates yet — add some below'}
                accent="var(--color-ink-muted)"
              />
              <Tile
                label="PERT expected duration"
                value={fmtDays(pert.projectDuration)}
                sub={`σ ${fmtDays(pert.stdDev, 2)} over critical chain · mean of simulation ${fmtDays(mc.mean)}`}
                accent="var(--color-brand)"
              />
              <Tile
                label="95% confidence delivery"
                value={p95 ? fmtDate(p95.date) : '—'}
                sub={p95
                  ? `Simulation: ${fmtDays(p95.days)} · normal approx.: ${pert95 ? `${fmtDays(pert95.days)} (${fmtDate(pert95.date)})` : '—'}`
                  : ''}
                accent="var(--color-accent)"
              />
              <Tile
                label={deadline ? `Chance of meeting ${fmtDate(deadline)}` : 'Chance of meeting deadline'}
                value={deadlineP == null ? '—' : pct(deadlineP)}
                sub={deadlineP == null
                  ? 'Pick a target deadline above to see the probability'
                  : `Normal approximation: ${pct(pert.deadlineProbability)}`}
                accent={deadlineAccent}
              />
            </section>

            {/* Probability curve */}
            <section
              className="rounded-2xl border p-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
                  Project duration probability curve
                </h3>
                <span className="text-[11px] font-data" style={{ color: 'var(--color-ink-muted)' }}>
                  {mc.iterations.toLocaleString()} runs · {mc.distribution === 'pert' ? 'Beta-PERT' : 'Triangular'} · range {fmtDays(mc.min)}–{fmtDays(mc.max)}
                </span>
              </div>

              {chart ? (
                <div style={{ width: '100%', height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart.points} margin={{ top: 22, right: 12, left: 0, bottom: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        interval="preserveStartEnd"
                        label={{ value: 'Project duration (days)', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--color-ink-muted)' }}
                      />
                      <YAxis
                        yAxisId="prob"
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        tickFormatter={(v) => `${v}%`}
                        width={44}
                      />
                      <YAxis
                        yAxisId="cdf"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        tickFormatter={(v) => `${v}%`}
                        width={44}
                      />
                      <Tooltip
                        formatter={(value, name) => [`${value}%`, name]}
                        labelFormatter={(label) => `≈ ${label} days`}
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-line)',
                          borderRadius: 12,
                          fontSize: 12
                        }}
                      />
                      <Bar
                        yAxisId="prob"
                        dataKey="probability"
                        name="Probability of finishing in this range"
                        fill="var(--color-brand)"
                        fillOpacity={0.35}
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        yAxisId="cdf"
                        type="monotone"
                        dataKey="cumulative"
                        name="Chance of finishing by then"
                        stroke="var(--color-accent)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      {chart.markers.map((m) => (
                        <ReferenceLine
                          key={m.key}
                          yAxisId="prob"
                          x={m.label}
                          stroke={m.color}
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                          label={{ value: m.text, position: 'top', fontSize: 10, fill: m.color }}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-xs py-12 text-center" style={{ color: 'var(--color-ink-muted)' }}>
                  Every task currently has a fixed duration, so the outcome is a single date. Add optimistic and
                  pessimistic estimates below to see the probability curve.
                </div>
              )}
            </section>

            {/* Confidence table */}
            <section
              className="rounded-2xl border p-4 overflow-x-auto"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
            >
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-muted)' }}>
                Delivery dates by confidence level
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--color-ink-muted)' }}>
                    <th className="text-left font-semibold pb-2">Confidence</th>
                    <th className="text-left font-semibold pb-2">Monte Carlo</th>
                    <th className="text-left font-semibold pb-2">Date</th>
                    <th className="text-left font-semibold pb-2">PERT (normal approx.)</th>
                    <th className="text-left font-semibold pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {mc.confidence.map((c, i) => {
                    const p = pert.confidence[i];
                    return (
                      <tr key={c.level} className="border-t" style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink)' }}>
                        <td className="py-2 font-semibold">{pct(c.level)}</td>
                        <td className="py-2 font-data">{fmtDays(c.days)}</td>
                        <td className="py-2 font-data">{fmtDate(c.date)}</td>
                        <td className="py-2 font-data">{p ? fmtDays(p.days) : '—'}</td>
                        <td className="py-2 font-data">{p ? fmtDate(p.date) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                Dates are the project start plus the duration rounded up to whole calendar days. The normal
                approximation only looks at the critical chain, so it is optimistic when several paths are close
                in length; the simulation accounts for that.
              </p>
            </section>

            {/* Estimates + criticality */}
            <section
              className="rounded-2xl border p-4 overflow-x-auto"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-line)' }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
                  Three-point estimates &amp; criticality
                </h3>
                <span className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                  {meta.tasksWithEstimates} of {meta.tasksTotal} tasks estimated · values in days
                </span>
              </div>

              <table className="w-full text-xs min-w-[860px]">
                <thead>
                  <tr style={{ color: 'var(--color-ink-muted)' }}>
                    <th className="text-left font-semibold pb-2">Task</th>
                    {FIELDS.map((f) => (
                      <th key={f.key} className="text-left font-semibold pb-2">{f.label}</th>
                    ))}
                    <th className="text-left font-semibold pb-2">E · σ</th>
                    <th className="text-left font-semibold pb-2">Criticality</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const values = valuesFor(row);
                    const draft = evaluateDraft(values);
                    const dirty = !!edits[row.id];
                    const ci = mc.criticalityIndex[row.id] ?? 0;
                    const busy = savingId === row.id;
                    const placeholder = String(row.expected);

                    return (
                      <tr key={row.id} className="border-t align-top" style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink)' }}>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{row.title}</div>
                          {row.isCritical && (
                            <span
                              className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                            >
                              Critical path
                            </span>
                          )}
                        </td>
                        {FIELDS.map((f) => (
                          <td key={f.key} className="py-2 pr-3">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              inputMode="decimal"
                              aria-label={`${f.label} for ${row.title}`}
                              value={values[f.key]}
                              placeholder={placeholder}
                              onChange={(e) => setField(row, f.key, e.target.value)}
                              className="w-20 px-2 py-1 rounded-lg border font-data"
                              style={inputStyle}
                            />
                          </td>
                        ))}
                        <td className="py-2 pr-3 font-data whitespace-nowrap">
                          {draft.state === 'valid' ? (
                            <>
                              <span className="font-semibold">{draft.expected.toFixed(2)}d</span>
                              <span style={{ color: 'var(--color-ink-muted)' }}> · σ {draft.stdDev.toFixed(2)}</span>
                            </>
                          ) : draft.state === 'invalid' ? (
                            <span style={{ color: 'var(--color-danger)' }}>{draft.message}</span>
                          ) : draft.state === 'incomplete' ? (
                            <span style={{ color: 'var(--color-ink-muted)' }}>Fill all three</span>
                          ) : (
                            <span style={{ color: 'var(--color-ink-muted)' }}>CPM {row.expected}d</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 w-40">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.round(ci * 100)}%`, background: ci >= 0.5 ? 'var(--color-accent)' : 'var(--color-brand)' }}
                              />
                            </div>
                            <span className="font-data w-9 text-right">{pct(ci)}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={busy || draft.state !== 'valid' || !dirty}
                            onClick={() => saveEstimate(row, draft.nums)}
                            className="px-3 py-1 text-[11px] font-semibold rounded-lg cursor-pointer text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: 'var(--color-brand)' }}
                          >
                            {busy ? 'Saving…' : 'Save'}
                          </button>
                          {row.hasEstimate && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeEstimate(row)}
                              className="ml-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer disabled:opacity-40"
                              style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink-muted)', background: 'var(--color-surface)' }}
                              title="Remove the three-point estimate and fall back to the CPM duration"
                            >
                              Clear
                            </button>
                          )}
                          {!row.hasEstimate && dirty && (
                            <button
                              type="button"
                              onClick={() => clearEdits(row.id)}
                              className="ml-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer"
                              style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink-muted)', background: 'var(--color-surface)' }}
                            >
                              Reset
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--color-ink-muted)' }}>
                Criticality is the share of simulation runs in which a task had zero float — a task that is
                critical in 40% of runs deserves attention even if it is off the single expected critical path.
                Estimates are stored separately from the task&apos;s own duration, so the Timeline &amp; CPM view is
                unchanged.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
