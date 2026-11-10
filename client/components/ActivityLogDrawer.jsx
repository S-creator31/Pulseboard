'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PulseAvatar from './PulseAvatar';
import { formatDistanceToNow, format } from 'date-fns';

export default function ActivityLogDrawer({
  boardId,
  taskId, // Optional: if passed, acts as per-task history
  isOpen = true,
  onClose,
  members = []
}) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const scrollRef = useRef(null);

  const fetchLogs = useCallback(async (cursor = null, isAppend = false) => {
    if (!boardId) return;
    if (isAppend) setLoadingMore(true);
    else setLoading(true);

    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (actorFilter) params.set('actor', actorFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (taskId) params.set('taskId', taskId);
      params.set('limit', '25');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/activity-logs/board/${boardId}?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (res.ok) {
        const data = await res.json();
        const newItems = data.items || [];
        setItems(prev => isAppend ? [...prev, ...newItems] : newItems);
        setNextCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [boardId, taskId, actorFilter, actionFilter]);

  useEffect(() => {
    fetchLogs(null, false);
  }, [fetchLogs]);

  // Group items by day
  const groupedByDay = items.reduce((acc, log) => {
    const dayStr = log.createdAt ? format(new Date(log.createdAt), 'EEEE, MMMM d, yyyy') : 'Recent';
    if (!acc[dayStr]) acc[dayStr] = [];
    acc[dayStr].push(log);
    return acc;
  }, {});

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40 && nextCursor && !loadingMore) {
      fetchLogs(nextCursor, true);
    }
  };

  const statusChip = (status) => {
    if (!status) return null;
    const bg =
      status === 'done' ? "var(--color-success-soft)" :
      status === 'in-progress' ? "var(--color-warning-soft)" : "var(--color-surface-2)";
    const color =
      status === 'done' ? "var(--color-success)" :
      status === 'in-progress' ? "var(--color-warning)" : "var(--color-ink-muted)";
    const label = status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done' : 'To Do';

    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold font-data" style={{ background: bg, color }}>
        {label}
      </span>
    );
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-brand)" }} />
          <h3 className="font-display text-base font-semibold" style={{ color: "var(--color-ink)" }}>
            {taskId ? 'Task Audit Trail' : 'Activity Drawer'}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-data" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-muted)" }}>
            {items.length} events
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border cursor-pointer transition-colors"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Bar */}
      {!taskId && (
        <div className="p-3 border-b flex items-center gap-2 overflow-x-auto text-xs" style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border outline-none bg-white text-xs cursor-pointer"
            style={{ borderColor: "var(--color-line)" }}
          >
            <option value="">All Team Members</option>
            {members.map((m, idx) => {
              const u = m.user || m;
              return (
                <option key={u._id || idx} value={u._id}>
                  {u.name}
                </option>
              );
            })}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border outline-none bg-white text-xs cursor-pointer"
            style={{ borderColor: "var(--color-line)" }}
          >
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="moved">Moved</option>
            <option value="marked">Completed</option>
            <option value="logged">Logged Time</option>
            <option value="deleted">Deleted</option>
          </select>

          {(actorFilter || actionFilter) && (
            <button
              type="button"
              onClick={() => { setActorFilter(''); setActionFilter(''); }}
              className="text-[11px] underline cursor-pointer"
              style={{ color: "var(--color-brand)" }}
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Feed list with infinite scroll */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-6"
      >
        {loading && items.length === 0 ? (
          <div className="space-y-4 py-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full" style={{ background: "var(--color-line)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded" style={{ background: "var(--color-line)" }} />
                  <div className="h-3 w-1/4 rounded" style={{ background: "var(--color-line)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-xs" style={{ color: "var(--color-ink-muted)" }}>
            No activity logged yet.
          </div>
        ) : (
          Object.entries(groupedByDay).map(([dayLabel, dayLogs]) => (
            <div key={dayLabel} className="space-y-3">
              {/* Sticky day header */}
              <div
                className="sticky top-0 z-10 py-1 px-2.5 rounded-md text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md"
                style={{
                  background: "var(--color-surface-2)",
                  color: "var(--color-ink-muted)"
                }}
              >
                {dayLabel}
              </div>

              {dayLogs.map((log) => {
                const userName = log.user?.name || 'Someone';
                const createdDate = new Date(log.createdAt);
                const relativeTime = formatDistanceToNow(createdDate, { addSuffix: true });
                const absoluteTime = format(createdDate, 'PPpp');

                return (
                  <div
                    key={log._id}
                    className="flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5"
                  >
                    <PulseAvatar name={userName} size={28} />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="leading-snug" style={{ color: "var(--color-ink)" }}>
                        <strong className="font-semibold">{userName}</strong>{' '}
                        <span>{log.action}</span>
                      </p>

                      {/* From / To Status Chips */}
                      {(log.fromStatus || log.toStatus) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {log.fromStatus && statusChip(log.fromStatus)}
                          {log.fromStatus && log.toStatus && <span className="text-[10px] text-gray-400">→</span>}
                          {log.toStatus && statusChip(log.toStatus)}
                        </div>
                      )}

                      <span
                        className="text-[10px] mt-1 block cursor-help"
                        style={{ color: "var(--color-ink-muted)" }}
                        title={absoluteTime}
                      >
                        {relativeTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {loadingMore && (
          <div className="space-y-2 py-2 animate-pulse">
            <div className="h-4 w-2/3 rounded" style={{ background: "var(--color-line)" }} />
            <div className="h-4 w-1/2 rounded" style={{ background: "var(--color-line)" }} />
          </div>
        )}
      </div>
    </div>
  );

  // If used as an embedded component (e.g. inside Task detail modal), render directly
  if (taskId) {
    return <div className="h-[400px] border rounded-2xl overflow-hidden" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>{content}</div>;
  }

  // Slide-over drawer overlay
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-[2px] flex justify-end">
      <div
        className="w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300"
        style={{ background: "var(--color-surface)" }}
      >
        {content}
      </div>
    </div>
  );
}
