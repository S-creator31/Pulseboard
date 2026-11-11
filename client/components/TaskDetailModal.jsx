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
  members = [],
  allTasks = [],
  sprints = []
}) {
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'dependencies' | 'time' | 'breakdown' | 'history'
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
  const [storyPoints, setStoryPoints] = useState(task?.storyPoints || 3);
  const [durationDays, setDurationDays] = useState(task?.durationDays || 2);
  const [startDate, setStartDate] = useState(task?.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '');
  const [sprint, setSprint] = useState(task?.sprint?._id || task?.sprint || '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?._id || task?.assignedTo || '');

  // Schedule & Dependencies
  const [boardSprints, setBoardSprints] = useState(sprints || []);
  const [boardTasks, setBoardTasks] = useState(allTasks || []);
  const [dependencies, setDependencies] = useState({ predecessors: [], successors: [] });
  const [cpmStats, setCpmStats] = useState(null);
  const [selectedPredecessor, setSelectedPredecessor] = useState('');
  const [addingDependency, setAddingDependency] = useState(false);
  const [cycleError, setCycleError] = useState(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || '');
    setDescription(task.description || '');
    setPriority(task.priority || 'medium');
    setEstimateHours(task.estimateHours || 4);
    setStoryPoints(task.storyPoints !== undefined ? task.storyPoints : 3);
    setDurationDays(task.durationDays || 2);
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '');
    setSprint(task.sprint?._id || task.sprint || '');
    setAssignedTo(task.assignedTo?._id || task.assignedTo || '');
    setCycleError(null);
    fetchTimeEntries();
    fetchDependenciesAndSchedule();
    fetchSprints();
  }, [task, boardId]);

  const fetchSprints = async () => {
    if (!boardId) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sprints/board/${boardId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setBoardSprints(data);
      }
    } catch (e) {
      console.error('Error loading sprints in task modal:', e);
    }
  };

  const fetchDependenciesAndSchedule = async () => {
    if (!boardId || !task?._id) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/schedule`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const schedTasks = data.tasks || [];
        const currentTaskCpm = schedTasks.find(t => t.id === task._id);
        setCpmStats(currentTaskCpm || null);

        const allTasksList = schedTasks.map(t => ({
          _id: t.id,
          title: t.title,
          durationDays: t.duration || 1
        }));
        if (allTasksList.length > 0) {
          setBoardTasks(allTasksList);
        }

        const allDeps = data.dependencies || [];
        const preds = allDeps
          .filter(d => (d.successor === task._id || d.successor?._id === task._id))
          .map(d => {
            const fromId = typeof d.predecessor === 'object' ? d.predecessor._id : d.predecessor;
            const predTask = allTasksList.find(t => t._id === fromId);
            return {
              depId: d.id || d._id,
              task: predTask || { _id: fromId, title: 'Predecessor task' }
            };
          });

        const succs = allDeps
          .filter(d => (d.predecessor === task._id || d.predecessor?._id === task._id))
          .map(d => {
            const toId = typeof d.successor === 'object' ? d.successor._id : d.successor;
            const succTask = allTasksList.find(t => t._id === toId);
            return {
              depId: d.id || d._id,
              task: succTask || { _id: toId, title: 'Successor task' }
            };
          });

        setDependencies({ predecessors: preds, successors: succs });
      }
    } catch (err) {
      console.error('Error fetching schedule & dependencies:', err);
    }
  };

  const handleAddDependency = async () => {
    if (!selectedPredecessor || !boardId) return;
    setAddingDependency(true);
    setCycleError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards/${boardId}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          predecessor: selectedPredecessor,
          successor: task._id
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          const cycleChain = Array.isArray(data.cycle) ? data.cycle.join(' → ') : '';
          const msg = data.message + (cycleChain ? ` (${cycleChain})` : '');
          setCycleError(msg);
          toast.error(`Cycle detected: ${data.message}`);
        } else {
          toast.error(data.message || 'Error adding dependency');
        }
        return;
      }
      toast.success('Predecessor dependency linked');
      setSelectedPredecessor('');
      fetchDependenciesAndSchedule();
      if (onTaskUpdated) onTaskUpdated();
    } catch (e) {
      toast.error('Network error linking dependency');
    } finally {
      setAddingDependency(false);
    }
  };

  const handleDeleteDependency = async (depId) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dependencies/${depId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Dependency unlinked');
        setCycleError(null);
        fetchDependenciesAndSchedule();
        if (onTaskUpdated) onTaskUpdated();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to unlink dependency');
      }
    } catch (e) {
      toast.error('Error removing dependency');
    }
  };

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
    setBreakdownResult(null);
    setSelectedSubtasks({});
    setActiveTab('breakdown');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/tasks/${task._id}/breakdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, description })
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
        body: JSON.stringify({
          subtasks: accepted,
          predecessorIds: [
            ...dependencies.predecessors.map(predecessor => predecessor.task._id),
            ...(selectedPredecessor ? [selectedPredecessor] : [])
          ]
        })
      });

      if (res.ok) {
        toast.success(`Replaced task with ${accepted.length} subtasks!`);
        setBreakdownResult(null);
        setActiveTab('details');
        if (onTaskUpdated) onTaskUpdated();
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Error creating subtasks');
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
          storyPoints: Number(storyPoints),
          durationDays: Number(durationDays),
          startDate: startDate ? new Date(startDate) : null,
          sprint: sprint || null,
          assignedTo: assignedTo || null
        })
      });

      if (res.ok) {
        toast.success('Task details saved');
        if (onTaskUpdated) onTaskUpdated();
        onClose();
      } else {
        toast.error('Error saving task');
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
        <div className="px-5 pt-2 border-b flex items-center gap-4 text-xs font-semibold overflow-x-auto" style={{ borderColor: "var(--color-line)" }}>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors shrink-0 ${activeTab === 'details' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            Details & Effort
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dependencies')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors shrink-0 ${activeTab === 'dependencies' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            Dependencies & CPM {dependencies.predecessors.length > 0 && `(${dependencies.predecessors.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('time')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors shrink-0 ${activeTab === 'time' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            Time Tracking ({timeEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors shrink-0 ${activeTab === 'breakdown' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
          >
            AI Breakdown {breakdownResult && `(${breakdownResult.subtasks.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 cursor-pointer transition-colors shrink-0 ${activeTab === 'history' ? 'border-[#6d28f5] text-[#6d28f5]' : 'border-transparent text-gray-500'}`}
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
                    className="themed-select w-full px-2.5 py-2 rounded-xl border outline-none"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
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
                    className="themed-select w-full px-2.5 py-2 rounded-xl border outline-none capitalize"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)", color: "var(--color-ink)" }}
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

              {/* Schedule & Effort Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Story Points</label>
                  <select
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none font-data"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  >
                    {[0, 1, 2, 3, 5, 8, 13, 21].map(pt => (
                      <option key={pt} value={pt}>{pt} pts</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none font-data"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none font-data text-xs"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1" style={{ color: "var(--color-ink)" }}>Sprint</label>
                  <select
                    value={sprint}
                    onChange={(e) => setSprint(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border outline-none text-xs"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  >
                    <option value="">No Sprint (Backlog)</option>
                    {boardSprints.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.name} {s.status === 'active' ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
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

          {/* TAB: DEPENDENCIES & CPM */}
          {activeTab === 'dependencies' && (
            <div className="space-y-5 text-xs">
              {/* CPM Metrics Banner */}
              {cpmStats && (
                <div
                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  style={{
                    background: cpmStats.isCritical ? '#fff1ef' : 'var(--color-surface-2)',
                    borderColor: cpmStats.isCritical ? '#ffb9b0' : 'var(--color-line)'
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          cpmStats.isCritical
                            ? 'bg-[#d93c30] text-white'
                            : 'bg-[#5416e0] text-white'
                        }`}
                      >
                        {cpmStats.isCritical ? 'Critical Path' : `${cpmStats.float}d Float`}
                      </span>
                      <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                        CPM Schedule Computation
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {cpmStats.isCritical
                        ? 'Zero slack (Float = 0): Any slippage on this task pushes back total project delivery.'
                        : `Has ${cpmStats.float} days of float before delaying downstream dependent tasks.`}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] font-data text-center shrink-0">
                    <div className="px-2 py-1 rounded bg-white/70 border border-black/5">
                      <div className="text-[9px] text-gray-500 uppercase">ES</div>
                      <div className="font-bold">Day {cpmStats.es}</div>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/70 border border-black/5">
                      <div className="text-[9px] text-gray-500 uppercase">EF</div>
                      <div className="font-bold">Day {cpmStats.ef}</div>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/70 border border-black/5">
                      <div className="text-[9px] text-gray-500 uppercase">LS</div>
                      <div className="font-bold">Day {cpmStats.ls}</div>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/70 border border-black/5">
                      <div className="text-[9px] text-gray-500 uppercase">LF</div>
                      <div className="font-bold">Day {cpmStats.lf}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cycle Error Banner */}
              {cycleError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span>⚠️</span> Dependency Cycle Prevented (DAG Enforced)
                  </div>
                  <p className="text-[11px] font-data">{cycleError}</p>
                  <p className="text-[10px] text-red-500">
                    PulseBoard uses Kahn&apos;s algorithm topological sorting. Cyclic dependencies would lock the schedule calculation.
                  </p>
                </div>
              )}

              {/* Predecessors Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    Predecessors (Must finish before this task can start)
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {dependencies.predecessors.length} blocker{dependencies.predecessors.length === 1 ? '' : 's'}
                  </span>
                </div>

                {dependencies.predecessors.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed text-center text-gray-400 text-xs">
                    No predecessor dependencies. This task can start on Day 0.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dependencies.predecessors.map((p) => (
                      <div
                        key={p.depId}
                        className="flex items-center justify-between p-2.5 rounded-xl border"
                        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className="font-medium text-xs" style={{ color: "var(--color-ink)" }}>
                            {p.task.title}
                          </span>
                          <span className="text-[10px] text-gray-400 font-data">
                            ({p.task.durationDays || 1}d duration)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDependency(p.depId)}
                          title="Unlink predecessor"
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Predecessor Control */}
                <div className="pt-2 flex items-center gap-2">
                  <select
                    value={selectedPredecessor}
                    onChange={(e) => {
                      setSelectedPredecessor(e.target.value);
                      setCycleError(null);
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border outline-none text-xs"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
                  >
                    <option value="">Select a task that must finish first...</option>
                    {boardTasks
                      .filter(t => t._id !== task._id && !dependencies.predecessors.some(p => p.task._id === t._id))
                      .map(t => (
                        <option key={t._id} value={t._id}>
                          {t.title} ({t.durationDays || 1}d)
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPredecessor || addingDependency}
                    onClick={handleAddDependency}
                    className="px-3.5 py-2 rounded-xl text-white font-semibold text-xs disabled:opacity-50 cursor-pointer shrink-0 transition-opacity"
                    style={{ background: "var(--color-brand)" }}
                  >
                    {addingDependency ? 'Checking...' : '+ Add Predecessor'}
                  </button>
                </div>
              </div>

              {/* Successors Section */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
                <div className="flex items-center justify-between">
                  <label className="font-semibold" style={{ color: "var(--color-ink)" }}>
                    Successors (Waiting for this task to finish)
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {dependencies.successors.length} downstream
                  </span>
                </div>

                {dependencies.successors.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed text-center text-gray-400 text-xs">
                    No downstream tasks depend on this card.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dependencies.successors.map((s) => (
                      <div
                        key={s.depId}
                        className="flex items-center justify-between p-2.5 rounded-xl border"
                        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="font-medium text-xs" style={{ color: "var(--color-ink)" }}>
                            {s.task.title}
                          </span>
                          <span className="text-[10px] text-gray-400 font-data">
                            ({s.task.durationDays || 1}d duration)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDependency(s.depId)}
                          title="Unlink dependency"
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                    className="w-28 px-2.5 py-1.5 text-xs rounded-lg border outline-none font-data"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-line)",
                      color: "var(--color-ink)"
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Work note (optional)…"
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-line)",
                      color: "var(--color-ink)"
                    }}
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
                    AI uses this task's title and description to create 3-7 specific, manageable subtasks. Add a clear outcome or requirements to get a more useful breakdown.
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
