'use client'
import { useDrag } from "react-dnd";
import PulseAvatar from "./PulseAvatar";

export const Task = ({ task, onDeleteTask, onToggleStatus }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'task',
        item: { id: task._id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging()
        })
    }));

    const isDone = task.status === 'done';

    return (
        <div
            ref={drag}
            className="group relative rounded-xl border px-3.5 py-3 mb-2.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
            style={{
                opacity: isDragging ? 0.4 : isDone ? 0.7 : 1,
                background: "var(--color-surface)",
                borderColor: "var(--color-line)",
            }}
        >
            <div className="flex items-start gap-2.5 pr-5">
                <button
                    type="button"
                    onClick={() => onToggleStatus(task._id, isDone ? 'todo' : 'done')}
                    aria-label={isDone ? "Mark task as not done" : "Mark task as done"}
                    aria-pressed={isDone}
                    className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    style={{
                        borderColor: isDone ? "var(--color-success)" : "var(--color-line)",
                        background: isDone ? "var(--color-success)" : "transparent",
                    }}
                >
                    {isDone && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </button>
                <p
                    className="text-sm font-medium"
                    style={{
                        color: isDone ? "var(--color-ink-muted)" : "var(--color-ink)",
                        textDecoration: isDone ? "line-through" : "none",
                    }}
                >
                    {task.title}
                </p>
            </div>

            {task.assignedTo && (
                <div className="flex items-center gap-1.5 mt-2.5 pl-[26px]">
                    <PulseAvatar name={task.assignedTo?.name} size={20} />
                    <span className="text-xs" style={{ color: "var(--color-ink-muted)" }}>
                        {task.assignedTo?.name || "Unassigned"}
                    </span>
                </div>
            )}

            <button
                onClick={() => onDeleteTask(task._id)}
                aria-label="Delete task"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer"
                style={{ color: "var(--color-danger)", background: "var(--color-danger-soft)" }}
            >
                ×
            </button>
        </div>
    );
};
