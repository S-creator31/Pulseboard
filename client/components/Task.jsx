'use client';

import React from 'react';
import { useDrag } from 'react-dnd';
import PulseAvatar from './PulseAvatar';
import { isPast, isToday, addDays } from 'date-fns';

export const Task = ({
  task,
  onDeleteTask,
  onToggleStatus,
  onClickTask,
  density = 'comfortable',
  isBlocked = false
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'task',
    item: { id: task._id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }));

  const isDone = task.status === 'done';
  const isCompact = density === 'compact';

  // Overdue check
  const dueDate = task.startDate ? addDays(new Date(task.startDate), task.durationDays || 1) : null;
  const isOverdue = dueDate && !isDone && isPast(dueDate) && !isToday(dueDate);
  const isDueSoon = dueDate && !isDone && isToday(dueDate);

  // Priority color token
  const priorityStyle =
    task.priority === 'urgent'
      ? { background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }
      : task.priority === 'high'
      ? { background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }
      : task.priority === 'low'
      ? { background: 'var(--color-surface-2)', color: 'var(--color-ink-muted)' }
      : { background: 'var(--color-brand-soft)', color: 'var(--color-brand)' };

  // Estimate vs Actual Effort bar calculations
  const est = task.estimateHours || (task.storyPoints ? task.storyPoints * 3 : 0);
  const logged = task.loggedHours || 0; // if provided or calculated
  const ratio = est > 0 ? logged / est : 0;
  const hasOverrun = ratio > 1.0;

  return (
    <div
      ref={drag}
      onClick={() => onClickTask && onClickTask(task)}
      className={`group relative rounded-xl border mb-2 cursor-pointer transition-all hover:shadow-md ${
        isCompact ? 'p-2.5' : 'p-3.5'
      }`}
      style={{
        opacity: isDragging ? 0.35 : isDone ? 0.65 : 1,
        background: "var(--color-surface)",
        borderColor: isBlocked ? "var(--color-danger)" : "var(--color-line)"
      }}
    >
      {/* Top badges: Priority, Blocked glyph, Overdue */}
      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {task.priority && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md font-data"
              style={priorityStyle}
            >
              {task.priority}
            </span>
          )}

          {isBlocked && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
              title="Blocked by incomplete predecessor dependency"
            >
              <span>🔗</span>
              <span>Blocked</span>
            </span>
          )}

          {isOverdue && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
            >
              Overdue
            </span>
          )}

          {isDueSoon && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--color-warning-soft)", color: "var(--color-warning)" }}
            >
              Due today
            </span>
          )}
        </div>

        {task.storyPoints > 0 && (
          <span
            className="text-[10px] font-bold font-data px-1.5 py-0.5 rounded-full border"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-line)",
              color: "var(--color-ink-muted)"
            }}
          >
            {task.storyPoints} pt{task.storyPoints > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Title & Checkbox */}
      <div className="flex items-start gap-2.5 pr-5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task._id, isDone ? 'todo' : 'done');
          }}
          aria-label={isDone ? "Mark as todo" : "Mark as done"}
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          style={{
            borderColor: isDone ? "var(--color-success)" : "var(--color-line)",
            background: isDone ? "var(--color-success)" : "transparent"
          }}
        >
          {isDone && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <p
          className={`font-medium leading-snug ${isCompact ? 'text-xs' : 'text-sm'}`}
          style={{
            color: isDone ? "var(--color-ink-muted)" : "var(--color-ink)",
            textDecoration: isDone ? "line-through" : "none"
          }}
        >
          {task.title}
        </p>
      </div>

      {/* Effort Progress Bar under card title */}
      {est > 0 && (
        <div className="mt-2.5 pl-[26px]">
          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden relative flex">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (logged > 0 ? (logged / est) * 100 : 35))}%`,
                background: hasOverrun ? "var(--color-danger)" : ratio > 0.8 ? "var(--color-warning)" : "var(--color-success)"
              }}
            />
            {hasOverrun && (
              <div
                className="h-full flex-1"
                style={{
                  background: "repeating-linear-gradient(45deg, var(--color-danger), var(--color-danger) 2px, var(--color-danger-soft) 2px, var(--color-danger-soft) 4px)"
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Footer: Assignee & Duration */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pl-[26px]">
        {task.assignedTo ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <PulseAvatar name={task.assignedTo?.name} size={18} />
            <span className="text-[11px] truncate" style={{ color: "var(--color-ink-muted)" }}>
              {task.assignedTo?.name}
            </span>
          </div>
        ) : (
          <span className="text-[11px] italic" style={{ color: "var(--color-ink-muted)" }}>
            Unassigned
          </span>
        )}

        {task.durationDays > 0 && (
          <span className="text-[10px] font-data" style={{ color: "var(--color-ink-muted)" }}>
            {task.durationDays}d
          </span>
        )}
      </div>

      {/* Delete button on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteTask(task._id);
        }}
        aria-label="Delete task"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer"
        style={{ color: "var(--color-danger)", background: "var(--color-danger-soft)" }}
      >
        ×
      </button>
    </div>
  );
};
