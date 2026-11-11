'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BoardNav from '@/components/BoardNav';
import PulseAvatar from '@/components/PulseAvatar';
import TaskDetailModal from '@/components/TaskDetailModal';

export default function TimelinePage() {
  const { id: boardId } = useParams();
  const { user } = useAuth();
  const token = user?.token;

  const [board, setBoard] = useState(null);
  const [scheduleData, setScheduleData] = useState({ tasks: [], criticalPath: [], projectDuration: 0 });
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [viewMode, setViewMode] = useState('gantt'); // 'gantt' | 'pert'
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [zoomLevel, setZoomLevel] = useState('day'); // 'day' | 'week' | 'month'
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingModalTask, setEditingModalTask] = useState(null);

  useEffect(() => {
    if (!token || !boardId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [boardRes, schedRes, graphRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/schedule`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/graph`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (boardRes.ok) setBoard(await boardRes.json());
        if (schedRes.ok) setScheduleData(await schedRes.json());
        if (graphRes.ok) setGraphData(await graphRes.json());
      } catch (err) {
        console.error('Error fetching timeline data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [boardId, token]);

  const criticalSet = useMemo(() => new Set(scheduleData.criticalPath || []), [scheduleData]);
  const criticalPathLabels = useMemo(() => {
    const titlesById = new Map((scheduleData.tasks || []).map((task) => [String(task.id), task.title]));
    return (scheduleData.criticalPath || []).map((id) => titlesById.get(String(id)) || id);
  }, [scheduleData]);

  // Scale settings based on zoom
  const dayWidth = zoomLevel === 'day' ? 36 : zoomLevel === 'week' ? 18 : 8;
  const rowHeight = 44;
  const headerHeight = 40;
  const labelWidth = 240;

  const totalDays = Math.max(scheduleData.projectDuration + 5, 20);
  const ganttWidth = labelWidth + totalDays * dayWidth;
  const ganttHeight = headerHeight + scheduleData.tasks.length * rowHeight + 30;

  // Task map for fast lookup
  const taskMap = useMemo(() => {
    const map = new Map();
    scheduleData.tasks.forEach((t, index) => {
      map.set(t.id, { ...t, index });
    });
    return map;
  }, [scheduleData.tasks]);

  // -------------------------------------------------------------
  // PERT RANKED LAYOUT COMPUTATION
  // Laid out by dependency rank (longest-path depth from root)
  // -------------------------------------------------------------
  const pertLayout = useMemo(() => {
    if (!scheduleData.tasks.length) return { nodes: [], edges: [], width: 1000, height: 600 };

    const nodeWidth = 160;
    const nodeHeight = 84;
    const colSpacing = 220;
    const rowSpacing = 110;

    // Incoming count for convergence ring (3+ incoming edges)
    const inDegree = new Map();
    const successorsMap = new Map();
    scheduleData.tasks.forEach(t => {
      inDegree.set(t.id, 0);
      successorsMap.set(t.id, []);
    });

    graphData.edges.forEach(e => {
      const pred = (e.predecessor?._id || e.predecessor).toString();
      const succ = (e.successor?._id || e.successor).toString();
      if (inDegree.has(succ)) {
        inDegree.set(succ, (inDegree.get(succ) || 0) + 1);
      }
      if (successorsMap.has(pred)) {
        successorsMap.get(pred).push(succ);
      }
    });

    // Rank = ES (Earliest Start) or longest path depth
    const ranks = new Map();
    scheduleData.tasks.forEach(t => {
      // Use ES as rank or calculate rank
      ranks.set(t.id, Math.floor(t.es / 2));
    });

    // Group nodes by rank
    const columns = new Map();
    scheduleData.tasks.forEach(t => {
      const r = ranks.get(t.id) || 0;
      if (!columns.has(r)) columns.set(r, []);
      columns.get(r).push(t);
    });

    const sortedRanks = Array.from(columns.keys()).sort((a, b) => a - b);
    const positionedNodes = [];
    const nodePosMap = new Map();

    sortedRanks.forEach((r, colIdx) => {
      const colTasks = columns.get(r);
      colTasks.forEach((t, rowIdx) => {
        const x = 50 + colIdx * colSpacing;
        const y = 60 + rowIdx * rowSpacing;
        const isConv = (inDegree.get(t.id) || 0) >= 3;
        const pos = { ...t, x, y, isConvergence: isConv };
        positionedNodes.push(pos);
        nodePosMap.set(t.id, pos);
      });
    });

    const positionedEdges = [];
    graphData.edges.forEach(e => {
      const predId = (e.predecessor?._id || e.predecessor).toString();
      const succId = (e.successor?._id || e.successor).toString();
      const pNode = nodePosMap.get(predId);
      const sNode = nodePosMap.get(succId);

      if (pNode && sNode) {
        const isCritEdge = criticalSet.has(predId) && criticalSet.has(succId);
        positionedEdges.push({
          id: e._id || `${predId}-${succId}`,
          from: { x: pNode.x + nodeWidth, y: pNode.y + nodeHeight / 2 },
          to: { x: sNode.x, y: sNode.y + nodeHeight / 2 },
          isCritical: isCritEdge
        });
      }
    });

    const maxWidth = Math.max(1200, (sortedRanks.length + 1) * colSpacing);
    const maxHeight = Math.max(700, Math.max(...Array.from(columns.values()).map(c => c.length)) * rowSpacing + 120);

    return {
      nodes: positionedNodes,
      edges: positionedEdges,
      width: maxWidth,
      height: maxHeight,
      nodeWidth,
      nodeHeight
    };
  }, [scheduleData, graphData, criticalSet]);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-paper)" }}>
      <BoardNav
        board={board}
        activeTab="timeline"
        members={board?.members || []}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* View Switcher, Critical Path Filter & Zoom Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b" style={{ borderColor: "var(--color-line)" }}>
          
          {/* Segmented Control: Timeline (Gantt) vs Network (PERT) */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--color-surface-2)" }}>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'gantt' ? 'shadow-sm' : ''
              }`}
              style={{
                background: viewMode === 'gantt' ? "var(--color-surface)" : "transparent",
                color: viewMode === 'gantt' ? "var(--color-brand)" : "var(--color-ink-muted)"
              }}
            >
              📊 Timeline (Gantt)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pert')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'pert' ? 'shadow-sm' : ''
              }`}
              style={{
                background: viewMode === 'pert' ? "var(--color-surface)" : "transparent",
                color: viewMode === 'pert' ? "var(--color-brand)" : "var(--color-ink-muted)"
              }}
            >
              🕸️ Network (PERT Diagram)
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Critical Path Highlighter Toggle */}
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCriticalOnly}
                onChange={(e) => setShowCriticalOnly(e.target.checked)}
                className="rounded accent-[#ff5a4e] cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />
                <span>Highlight Critical Path ({scheduleData.criticalPath.length} tasks)</span>
              </span>
            </label>

            {/* Zoom selector for Gantt */}
            {viewMode === 'gantt' && (
              <div className="flex items-center gap-1 border rounded-lg p-0.5 text-xs" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
                {['day', 'week', 'month'].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className="px-2 py-0.5 rounded capitalize font-medium cursor-pointer transition-colors"
                    style={{
                      background: zoomLevel === z ? "var(--color-brand-soft)" : "transparent",
                      color: zoomLevel === z ? "var(--color-brand)" : "var(--color-ink-muted)"
                    }}
                  >
                    {z}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Informative Banner */}
        <div className="flex items-center justify-between text-xs px-4 py-2.5 rounded-xl border" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)" }}>
          <div className="flex items-center gap-4">
            <span><strong>Project Duration:</strong> <span className="font-data font-bold">{scheduleData.projectDuration} days</span></span>
            <span><strong>Critical Chain:</strong> <span className="font-data font-medium">{criticalPathLabels.join(' → ') || 'None'}</span></span>
          </div>
          <span style={{ color: "var(--color-ink-muted)" }}>
            {viewMode === 'gantt' ? 'Single <svg> vector coordinate timeline' : 'Activity-on-Node PERT boxes with ES/EF and LS/LF float'}
          </span>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 1: SINGLE-SVG GANTT TIMELINE                                  */}
        {/* ------------------------------------------------------------------ */}
        {viewMode === 'gantt' && (
          <div
            className="rounded-2xl border overflow-x-auto shadow-sm"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", maxHeight: "75vh" }}
          >
            {loading ? (
              <div className="p-16 text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                Computing critical path schedule…
              </div>
            ) : scheduleData.tasks.length === 0 ? (
              <div className="p-16 text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                No tasks found to schedule. Add tasks and dependencies to visualize the timeline.
              </div>
            ) : (
              <svg width={ganttWidth} height={ganttHeight} className="block select-none">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-line)" />
                  </marker>
                  <marker id="arrow-crit" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-accent)" />
                  </marker>
                </defs>

                {/* Left Header Column */}
                <rect x="0" y="0" width={labelWidth} height={headerHeight} fill="var(--color-surface-2)" />
                <text x="16" y="24" fontSize="12" fontWeight="600" fill="var(--color-ink)">Task Title & Float</text>
                <line x1={labelWidth} y1="0" x2={labelWidth} y2={ganttHeight} stroke="var(--color-line)" strokeWidth="1.5" />

                {/* Day Header Ruler */}
                {Array.from({ length: totalDays }).map((_, d) => {
                  const x = labelWidth + d * dayWidth;
                  return (
                    <g key={d}>
                      <rect x={x} y="0" width={dayWidth} height={headerHeight} fill={d % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-2)"} />
                      <line x1={x} y1="0" x2={x} y2={ganttHeight} stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="2 2" />
                      <text x={x + dayWidth / 2} y="24" fontSize="10" textAnchor="middle" fill="var(--color-ink-muted)" fontFamily="var(--font-jetbrains)">
                        D{d + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Task Rows & Bars */}
                {scheduleData.tasks.map((task, idx) => {
                  const y = headerHeight + idx * rowHeight;
                  const isCrit = criticalSet.has(task.id);
                  const opacity = (showCriticalOnly && !isCrit) ? 0.25 : 1;

                  const barX = labelWidth + task.es * dayWidth;
                  const barW = Math.max(task.duration * dayWidth, 12);
                  const barColor = isCrit ? "var(--color-accent)" : "var(--color-brand)";

                  return (
                    <g
                      key={task.id}
                      style={{ transition: "opacity 200ms ease" }}
                      opacity={opacity}
                      className="cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      {/* Row Background stripe */}
                      <rect x="0" y={y} width={ganttWidth} height={rowHeight} fill={idx % 2 === 0 ? "transparent" : "var(--color-surface-2)"} opacity="0.4" />
                      <line x1="0" y1={y + rowHeight} x2={ganttWidth} y2={y + rowHeight} stroke="var(--color-line)" strokeWidth="0.5" />

                      {/* Task Label on Left */}
                      <text x="16" y={y + 20} fontSize="12" fontWeight="500" fill="var(--color-ink)">
                        {task.title.length > 24 ? task.title.slice(0, 24) + '…' : task.title}
                      </text>
                      <text x="16" y={y + 34} fontSize="10" fill="var(--color-ink-muted)" fontFamily="var(--font-jetbrains)">
                        ES:{task.es} EF:{task.ef} {task.float > 0 ? `· Float: ${task.float}d` : '· Critical (0d)'}
                      </text>

                      {/* Float Slack Extension Bar */}
                      {task.float > 0 && (
                        <rect
                          x={barX + barW}
                          y={y + 16}
                          width={task.float * dayWidth}
                          height="12"
                          rx="4"
                          fill="var(--color-brand-soft)"
                          stroke="var(--color-brand)"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Scheduled Duration Gantt Bar */}
                      <rect
                        x={barX}
                        y={y + 12}
                        width={barW}
                        height="20"
                        rx="6"
                        fill={barColor}
                      />

                      {/* Task duration inside bar */}
                      <text
                        x={barX + barW / 2}
                        y={y + 26}
                        fontSize="10"
                        fontWeight="600"
                        fill="white"
                        textAnchor="middle"
                        fontFamily="var(--font-jetbrains)"
                      >
                        {task.duration}d
                      </text>
                    </g>
                  );
                })}

                {/* Dependency Connecting Curves in SVG Coordinate Space */}
                {graphData.edges.map((e, eIdx) => {
                  const predId = (e.predecessor?._id || e.predecessor).toString();
                  const succId = (e.successor?._id || e.successor).toString();

                  const pred = taskMap.get(predId);
                  const succ = taskMap.get(succId);

                  if (!pred || !succ) return null;

                  const isCritEdge = criticalSet.has(predId) && criticalSet.has(succId);
                  const opacity = (showCriticalOnly && !isCritEdge) ? 0.25 : 1;

                  const startX = labelWidth + (pred.es + pred.duration) * dayWidth;
                  const startY = headerHeight + pred.index * rowHeight + 22;

                  const endX = labelWidth + succ.es * dayWidth;
                  const endY = headerHeight + succ.index * rowHeight + 22;

                  const midX = startX + (endX - startX) / 2;
                  const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX - 6} ${endY}`;

                  return (
                    <path
                      key={eIdx}
                      d={pathD}
                      fill="none"
                      stroke={isCritEdge ? "var(--color-accent)" : "var(--color-line)"}
                      strokeWidth={isCritEdge ? "2" : "1.5"}
                      markerEnd={isCritEdge ? "url(#arrow-crit)" : "url(#arrow)"}
                      opacity={opacity}
                      style={{ transition: "opacity 200ms ease" }}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 2: ACTIVITY-ON-NODE PERT DIAGRAM                              */}
        {/* ------------------------------------------------------------------ */}
        {viewMode === 'pert' && (
          <div
            className="rounded-2xl border overflow-auto shadow-sm p-4"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", maxHeight: "75vh" }}
          >
            {loading ? (
              <div className="p-16 text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                Computing PERT network coordinates…
              </div>
            ) : pertLayout.nodes.length === 0 ? (
              <div className="p-16 text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                No task graph available to construct PERT diagram.
              </div>
            ) : (
              <svg width={pertLayout.width} height={pertLayout.height} className="block select-none">
                <defs>
                  <marker id="pert-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-line)" />
                  </marker>
                  <marker id="pert-arrow-crit" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--color-accent)" />
                  </marker>
                </defs>

                {/* Connecting Edges */}
                {pertLayout.edges.map((edge) => {
                  const opacity = (showCriticalOnly && !edge.isCritical) ? 0.25 : 1;
                  const dx = edge.to.x - edge.from.x;
                  const cx1 = edge.from.x + dx * 0.5;
                  const cx2 = edge.to.x - dx * 0.5;
                  const d = `M ${edge.from.x} ${edge.from.y} C ${cx1} ${edge.from.y}, ${cx2} ${edge.to.y}, ${edge.to.x - 6} ${edge.to.y}`;

                  return (
                    <path
                      key={edge.id}
                      d={d}
                      fill="none"
                      stroke={edge.isCritical ? "var(--color-accent)" : "var(--color-line)"}
                      strokeWidth={edge.isCritical ? "2.5" : "1.5"}
                      markerEnd={edge.isCritical ? "url(#pert-arrow-crit)" : "url(#pert-arrow)"}
                      opacity={opacity}
                      style={{ transition: "opacity 200ms ease" }}
                    />
                  );
                })}

                {/* Activity-on-Node PERT Boxes */}
                {pertLayout.nodes.map((node) => {
                  const isCrit = criticalSet.has(node.id);
                  const opacity = (showCriticalOnly && !isCrit) ? 0.25 : 1;
                  const borderColor = isCrit ? "var(--color-accent)" : "var(--color-line)";
                  const headerFill = isCrit ? "var(--color-accent-soft)" : "var(--color-surface-2)";

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      opacity={opacity}
                      style={{ transition: "opacity 200ms ease" }}
                      className="cursor-pointer"
                      onClick={() => setSelectedTask(node)}
                    >
                      {/* Convergence Highlight Ring (3+ incoming dependencies) */}
                      {node.isConvergence && (
                        <rect
                          x="-6"
                          y="-6"
                          width={pertLayout.nodeWidth + 12}
                          height={pertLayout.nodeHeight + 12}
                          rx="16"
                          fill="none"
                          stroke="var(--color-warning)"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                        />
                      )}

                      {/* Main Box Container */}
                      <rect
                        x="0"
                        y="0"
                        width={pertLayout.nodeWidth}
                        height={pertLayout.nodeHeight}
                        rx="12"
                        fill="var(--color-surface)"
                        stroke={borderColor}
                        strokeWidth={isCrit ? "2.5" : "1.5"}
                      />

                      {/* TOP ROW: Earliest Start (ES) | Title | Earliest Finish (EF) */}
                      <rect x="0" y="0" width={pertLayout.nodeWidth} height="24" rx="12" fill={headerFill} />
                      <rect x="0" y="14" width={pertLayout.nodeWidth} height="10" fill={headerFill} />
                      <line x1="0" y1="24" x2={pertLayout.nodeWidth} y2="24" stroke={borderColor} strokeWidth="1" />
                      <line x1="36" y1="0" x2="36" y2="24" stroke={borderColor} strokeWidth="1" />
                      <line x1={pertLayout.nodeWidth - 36} y1="0" x2={pertLayout.nodeWidth - 36} y2="24" stroke={borderColor} strokeWidth="1" />

                      <text x="18" y="16" fontSize="10" fontWeight="700" fill="var(--color-ink)" textAnchor="middle" fontFamily="var(--font-jetbrains)">
                        {node.es}
                      </text>
                      <text x={pertLayout.nodeWidth / 2} y="16" fontSize="10" fontWeight="600" fill="var(--color-ink)" textAnchor="middle">
                        Duration: {node.duration}d
                      </text>
                      <text x={pertLayout.nodeWidth - 18} y="16" fontSize="10" fontWeight="700" fill="var(--color-ink)" textAnchor="middle" fontFamily="var(--font-jetbrains)">
                        {node.ef}
                      </text>

                      {/* MIDDLE ROW: Task Title */}
                      <text x={pertLayout.nodeWidth / 2} y="44" fontSize="11" fontWeight="600" fill="var(--color-ink)" textAnchor="middle">
                        {node.title.length > 18 ? node.title.slice(0, 18) + '…' : node.title}
                      </text>

                      {/* BOTTOM ROW: Latest Start (LS) | Float Badge | Latest Finish (LF) */}
                      <line x1="0" y1="60" x2={pertLayout.nodeWidth} y2="60" stroke={borderColor} strokeWidth="1" />
                      <line x1="36" y1="60" x2="36" y2={pertLayout.nodeHeight} stroke={borderColor} strokeWidth="1" />
                      <line x1={pertLayout.nodeWidth - 36} y1="60" x2={pertLayout.nodeWidth - 36} y2={pertLayout.nodeHeight} stroke={borderColor} strokeWidth="1" />

                      <text x="18" y="76" fontSize="10" fontWeight="700" fill="var(--color-ink-muted)" textAnchor="middle" fontFamily="var(--font-jetbrains)">
                        {node.ls}
                      </text>
                      <text x={pertLayout.nodeWidth / 2} y="76" fontSize="10" fontWeight="700" fill={isCrit ? "var(--color-accent)" : "var(--color-success)"} textAnchor="middle" fontFamily="var(--font-jetbrains)">
                        Float: {node.float}d
                      </text>
                      <text x={pertLayout.nodeWidth - 18} y="76" fontSize="10" fontWeight="700" fill="var(--color-ink-muted)" textAnchor="middle" fontFamily="var(--font-jetbrains)">
                        {node.lf}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}

        {/* Selected Task Details Sheet/Modal */}
        {selectedTask && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setSelectedTask(null)}
          >
            <div
              className="rounded-2xl border p-6 max-w-md w-full shadow-xl space-y-4"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    criticalSet.has(selectedTask.id) ? 'bg-[#ffe6e2] text-[#d93c30]' : 'bg-[#efe7ff] text-[#5416e0]'
                  }`}>
                    {criticalSet.has(selectedTask.id) ? 'Critical Path Item' : `Slack: ${selectedTask.float} days float`}
                  </span>
                  <h3 className="font-display text-lg font-bold" style={{ color: "var(--color-ink)" }}>
                    {selectedTask.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold border cursor-pointer"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl" style={{ background: "var(--color-surface-2)" }}>
                <div><strong>Earliest Start (ES):</strong> <span className="font-data">Day {selectedTask.es}</span></div>
                <div><strong>Earliest Finish (EF):</strong> <span className="font-data">Day {selectedTask.ef}</span></div>
                <div><strong>Latest Start (LS):</strong> <span className="font-data">Day {selectedTask.ls}</span></div>
                <div><strong>Latest Finish (LF):</strong> <span className="font-data">Day {selectedTask.lf}</span></div>
                <div><strong>Duration:</strong> <span className="font-data">{selectedTask.duration} days</span></div>
                <div><strong>Total Float:</strong> <span className="font-data">{selectedTask.float} days</span></div>
              </div>

              <div className="flex justify-between items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const foundNode = graphData.nodes.find(n => n.id === selectedTask.id);
                    setEditingModalTask({
                      _id: selectedTask.id,
                      title: selectedTask.title,
                      durationDays: selectedTask.duration,
                      estimateHours: foundNode?.estimateHours || 4,
                      priority: foundNode?.priority || 'medium',
                      assignedTo: foundNode?.assignedTo
                    });
                    setSelectedTask(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                  style={{ borderColor: "var(--color-brand)", color: "var(--color-brand)", background: "var(--color-surface-2)" }}
                >
                  Manage Dependencies & Edit ↗
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white cursor-pointer"
                  style={{ background: "var(--color-brand)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Task & Dependency Management Modal */}
        {editingModalTask && (
          <TaskDetailModal
            task={editingModalTask}
            boardId={boardId}
            isOpen={!!editingModalTask}
            onClose={() => setEditingModalTask(null)}
            onTaskUpdated={() => {
              // Re-fetch timeline graph & CPM data
              window.location.reload();
            }}
            members={board?.members || []}
            allTasks={graphData.nodes.map(n => ({ _id: n.id, title: n.title, durationDays: n.durationDays || 1 }))}
          />
        )}

      </main>
    </div>
  );
}
