'use client'
import { useDrag } from "react-dnd";
import PulseAvatar from "./PulseAvatar";

export const Task = ({ task, onDeleteTask }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'task',
        item: { id: task._id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging()
        })
    }));

    return (
        <div
            ref={drag}
            className="group relative rounded-xl border px-3.5 py-3 mb-2.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
            style={{
                opacity: isDragging ? 0.4 : 1,
                background: "var(--color-surface)",
                borderColor: "var(--color-line)",
            }}
        >
            <p className="text-sm font-medium pr-5" style={{ color: "var(--color-ink)" }}>
                {task.title}
            </p>

            {task.assignedTo && (
                <div className="flex items-center gap-1.5 mt-2.5">
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
