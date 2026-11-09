'use client';

import React, { useState, useEffect } from 'react';
import PulseAvatar from './PulseAvatar';
import ActivityLogDrawer from './ActivityLogDrawer';
import { toast } from 'sonner';

export default function TaskDetailModal({
  task,
  boardId,
  isOpen,
  onClose,
  onTaskUpdated,
  members = []
}) {
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'time' | 'breakdown' | 'history'
  const [timeEntries, setTimeEntries] = useState([]);
  const [totalActualHours, setTotalActualHours] = useState(0);

  // Time logging inputs
  const [logMinutes, setLogMinutes] = useState(30);
  const [logNote, setLogNote] = useState('');
  const [loggingTime, setLoggingTime] = useState(false);

  // AI Breakdown states
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownResult, setBreakdownResult] = useState(null);
  const [selectedSubtasks, setSelectedSubtasks] = useState({});
  const [addingSubtasks, setAddingSubtasks] = useState(false);

  // Task details edit
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [estimateHours, setEstimateHours] = useState(task?.estimateHours || 4);
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?._id || task?.assignedTo || '');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || '');
    setDescription(task.description || '');
    setPriority(task.priority || 'medium');
    setEstimateHours(task.estimateHours || 4);
    setAssignedTo(task.assignedTo?._id || task.assignedTo || '');
    fetchTimeEntries();
  }, [task]);

  const fetchTimeEntries = async () => {
    if (!task?._id) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${task._id}/time`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTimeEntries(data.entries || []);
        setTotalActualHours(data.actualHours || 0);
      }
    } catch (e) {
      console.error('Error fetching time entries:', e);
    }
  };

  const handleLogTime = async (minutesToLog, noteToLog) => {
    if (!minutesToLog || minutesToLog <= 0) return;
    setLoggingTime(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${task._id}/time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ minutes: minutesToLog, note: noteToLog || '' })
      });

      if (res.ok) {
        toast.success(`Logged ${+(minutesToLog / 60).toFixed(1)}h successfully!`);
        setLogNote('');
        fetchTimeEntries();
        if (onTaskUpdated) onTaskUpdated();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to log time');
      }
    } catch (err) {
      toast.error('Error logging time');
    } finally {
      setLoggingTime(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/time-entries/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Time entry removed');
        fetchTimeEntries();
        if (onTaskUpdated) onTaskUpdated();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Could not delete entry');
      }
    } catch (e) {
      toast.error('Error deleting time entry');
    }
  };

  const handleTriggerBreakdown = async () => {
    setBreakdownLoading(true);
    setActiveTab('breakdown');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/tasks/${task._id}/breakdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({}) // Empty body constraint
      });

      if (res.ok) {
        const data = await res.json();
        setBreakdownResult(data);
        // Pre-select all generated subtasks
        const initialSelected = {};
        (data.subtasks || []).forEach((_, idx) => {
          initialSelected[idx] = true;
        });
        setSelectedSubtasks(initialSelected);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Breakdown failed');
      }
    } catch (err) {
      toast.error('Error requesting breakdown');
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleAcceptSubtasks = async () => {
    if (!breakdownResult?.subtasks) return;
    const accepted = breakdownResult.subtasks.filter((_, idx) => selectedSubtasks[idx]);
    if (accepted.length === 0) {
      toast.info('No subtasks selected');
      return;
    }

    setAddingSubtasks(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${task._id}/subtasks/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subtasks: accepted })
      });

      if (res.ok) {
        toast.success(`Added ${accepted.length} subtasks to board!`);
        setBreakdownResult(null);
        setActiveTab('details');
        if (onTaskUpdated) onTaskUpdated();
        onClose();
      }
    } catch (e) {
      toast.error('Error creating subtasks');
    } finally {
      setAddingSubtasks(false);
    }
  };

  const handleSaveDetails = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${task._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          priority,
          estimateHours: Number(estimateHours),
          assignedTo: assignedTo || null
        })
      });

      if (res.ok) {
        toast.success('Task details saved');
        if (onTaskUpdated) onTaskUpdated();
        onClose();
      }
    } catch (e) {
      toast.error('Error updating task');
    }
  };

  if (!isOpen || !task) return null;

  // Calculate estimate vs actual percentage
  const estHours = task.estimateHours || 4;
  const ratio = estHours > 0 ? totalActualHours / estHours : 0;
  const isOverrun = ratio > 1.0;
  const barPercent = Math.min(100, Math.round(ratio * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b flex items-start justify-between gap-4" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase font-bold font-data px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}>
                Status: {task.status}
              </span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                task.priority === 'urgent' ? 'bg-[#ffe6e2] text-[#d93c30]' :
                task.priority === 'high' ? 'bg-[#fef3e0] text-[#b45f06]' : 'bg-[#e3faf0] text-[#12b76a]'
              }`}>
                {task.priority || 'medium'}
              </span>
            </div>
            <h2 className="font-display text-lg font-bold truncate" style={{ color: "var(--color-ink)" }}>
              {task.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Breakdown Button */}
            <button
              type="button"
              onClick={handleTriggerBreakdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-line)",
                color: "var(--color-brand)"
              }}
              title="Break down into subtasks with AI"
            >
              <span>✨</span>
              <span>Break down</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl border flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Estimate-vs-Actual Progress Bar with Hatched Overrun */}
        <div className="px-5 py-3 border-b flex items-center justify-between gap-4 text-xs" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                Effort: <strong className="font-data">{totalActualHours}h</strong> logged of <strong className="font-data">{estHours}h</strong> estimate
              </span>
              <span className="font-data font-semibold text-[11px]" style={{ color: isOverrun ? "var(--color-danger)" : ratio > 0.8 ? "var(--color-warning)" : "var(--color-success)" }}>
                {Math.round(ratio * 100)}%
              </span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-2.5 rounded-full bg-gray-200 overflow-hidden relative flex">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (totalActualHours / estHours) * 100)}%`,
                  background: isOverrun ? "var(--color-danger)" : ratio > 0.8 ? "var(--color-warning)" : "var(--color-success)"
                }}
              />
              {/* Hatched extension for overrun */}
              {isOverrun && (
                <div
                  className="h-full flex-1"
                  style={{
                    background: "repeating-linear-gradient(45deg, var(--color-danger), var(--color-danger) 4px, var(--color-danger-soft) 4px, var(--color-danger-soft) 8px)"
                  }}
                  title="Effort overrun past initial estimate"
                />
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-2 border-b flex items-center gap-4 text-xs font-semibold" style={{ borderColor: "var(--color-line)" }}>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${activeTab === 'details' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            Details & Assignee
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('time')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${activeTab === 'time' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            Time Tracking ({timeEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${activeTab === 'breakdown' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            AI Breakdown {breakdownResult && `(${breakdownResult.subtasks.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${activeTab === 'history' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            Audit History
          </button>
        </div>

        {/* Modal Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">

          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Description</label>
                <textarea
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details, acceptance criteria, or context…"
                  className="w-full text-xs px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Assignee</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m, idx) => {
                      const u = m.user || m;
                      return (
                        <option key={u._id || idx} value={u._id}>
                          {u.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none capitalize"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Estimate (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={estimateHours}
                    onChange={(e) => setEstimateHours(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none font-data"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white cursor-pointer"
                  style={{ background: "var(--color-brand)" }}
                >
                  Save Task Details
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TIME TRACKING */}
          {activeTab === 'time' && (
            <div className="space-y-4">
              {/* Quick Log Box */}
              <div className="p-4 rounded-xl border space-y-3" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)" }}>
                <h4 className="font-semibold text-xs" style={{ color: "var(--color-ink)" }}>Quick Log Time</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {[15, 30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleLogTime(mins, `Quick log ${mins}m`)}
                      disabled={loggingTime}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors"
                      style={{
                        background: "var(--color-surface)",
                        borderColor: "var(--color-line)",
                        color: "var(--color-brand)"
                      }}
                    >
                      +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="5"
                    step="5"
                    placeholder="Custom mins"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(Number(e.target.value))}
                    className="w-28 px-2.5 py-1.5 text-xs rounded-lg border bg-white outline-none font-data"
                    style={{ borderColor: "var(--color-line)" }}
                  />
                  <input
                    type="text"
                    placeholder="Work note (optional)…"
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border bg-white outline-none"
                    style={{ borderColor: "var(--color-line)" }}
                  />
                  <button
                    type="button"
                    onClick={() => handleLogTime(logMinutes, logNote)}
                    disabled={loggingTime}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white cursor-pointer"
                    style={{ background: "var(--color-brand)" }}
                  >
                    Log Time
                  </button>
                </div>
              </div>

              {/* Time Entries List */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs" style={{ color: "var(--color-ink-muted)" }}>Logged Sessions ({timeEntries.length})</h4>
                {timeEntries.length === 0 ? (
                  <p className="text-center py-6 text-xs" style={{ color: "var(--color-ink-muted)" }}>
                    No time entries logged yet for this card.
                  </p>
                ) : (
                  timeEntries.map((entry) => (
                    <div
                      key={entry._id}
                      className="p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors hover:bg-black/5"
                      style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                    >
                      <div className="flex items-center gap-2.5">
                        <PulseAvatar name={entry.user?.name} size={24} />
                        <div>
                          <strong className="font-medium" style={{ color: "var(--color-ink)" }}>{entry.user?.name || 'User'}</strong>
                          <span className="text-[11px] block" style={{ color: "var(--color-ink-muted)" }}>
                            {entry.note || 'General task development'} · {new Date(entry.loggedOn).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-data font-bold px-2 py-0.5 rounded-md" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
                          {+(entry.minutes / 60).toFixed(1)}h ({entry.minutes}m)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTimeEntry(entry._id)}
                          className="text-xs text-red-500 hover:text-red-700 cursor-pointer font-bold"
                          title="Delete entry"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AI BREAKDOWN */}
          {activeTab === 'breakdown' && (
            <div className="space-y-4">
              {breakdownLoading ? (
                <div className="space-y-3 py-4 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="animate-spin text-base">✨</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
                      AI Decomposing task into actionable subtasks…
                    </span>
                  </div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3 rounded-xl border space-y-2" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
                      <div className="h-4 w-3/4 rounded" style={{ background: "var(--color-line)" }} />
                      <div className="h-3 w-1/2 rounded" style={{ background: "var(--color-line)" }} />
                    </div>
                  ))}
                </div>
              ) : !breakdownResult ? (
                <div className="text-center py-10 space-y-3">
                  <span className="text-3xl block">✨</span>
                  <h4 className="font-display font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
                    Ready to break down this work package?
                  </h4>
                  <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--color-ink-muted)" }}>
                    Our AI assistant reads this task's scope and generates 3-7 manageable subtasks completable in under a day.
                  </p>
                  <button
                    type="button"
                    onClick={handleTriggerBreakdown}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-white cursor-pointer"
                    style={{ background: "var(--color-brand)" }}
                  >
                    Generate AI Breakdown
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--color-line)" }}>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
                      Suggested by AI - review before adding.
                    </span>
                    <button
                      type="button"
                      onClick={handleTriggerBreakdown}
                      className="text-xs underline cursor-pointer"
                      style={{ color: "var(--color-ink-muted)" }}
                    >
                      Regenerate
                    </button>
                  </div>

                  {/* Subtask Check List */}
                  <div className="space-y-2">
                    {breakdownResult.subtasks.map((subtask, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border flex items-start gap-3 transition-colors"
                        style={{
                          background: selectedSubtasks[idx] ? "var(--color-surface)" : "var(--color-surface-2)",
                          borderColor: selectedSubtasks[idx] ? "var(--color-brand)" : "var(--color-line)"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedSubtasks[idx]}
                          onChange={(e) => setSelectedSubtasks(prev => ({ ...prev, [idx]: e.target.checked }))}
                          className="mt-1 cursor-pointer accent-[#6d28f5]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="font-semibold" style={{ color: "var(--color-ink)" }}>{subtask.title}</strong>
                            <span className="font-data font-bold shrink-0 px-2 py-0.5 rounded text-[11px]" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
                              ~{subtask.estimateHours}h
                            </span>
                          </div>
                          <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-muted)" }}>
                            {subtask.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Acceptance Criteria */}
                  {breakdownResult.acceptanceCriteria && (
                    <div className="p-3 rounded-xl border" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)" }}>
                      <strong className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Acceptance Criteria:</strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]" style={{ color: "var(--color-ink-muted)" }}>
                        {breakdownResult.acceptanceCriteria.map((ac, i) => (
                          <li key={i}>{ac}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--color-line)" }}>
                    <button
                      type="button"
                      onClick={() => setBreakdownResult(null)}
                      className="text-xs cursor-pointer"
                      style={{ color: "var(--color-ink-muted)" }}
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleAcceptSubtasks}
                      disabled={addingSubtasks}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-white cursor-pointer"
                      style={{ background: "var(--color-brand)" }}
                    >
                      {addingSubtasks ? 'Adding…' : `Add ${Object.values(selectedSubtasks).filter(Boolean).length} Subtasks`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <ActivityLogDrawer boardId={boardId} taskId={task._id} />
          )}

        </div>
      </div>
    </div>
  );
}
