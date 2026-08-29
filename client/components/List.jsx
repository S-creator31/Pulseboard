import { useDrop } from "react-dnd";
import { Task } from "./Task";
import { colorForString } from "@/lib/colors";

export const List = ({ list, onDropTask, onDeleteTask, onDeleteList, onToggleStatus }) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'task',
        drop: (item) => {
            onDropTask(item.id, list._id);
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }));

    const c = colorForString(list.title);
    const tasks = list.tasks || [];

    return (
        <div
            ref={drop}
            className="rounded-2xl border transition-colors"
            style={{
                background: isOver ? c.soft : "var(--color-surface-2)",
                borderColor: isOver ? c.solid : "var(--color-line)",
                minHeight: "120px",
            }}
        >
            <div className="h-1.5 rounded-t-2xl" style={{ background: c.solid }} />
            <div className="px-3.5 pt-3 pb-3">
                <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
                        {list.title}
                        <span
                            className="text-xs font-data px-1.5 py-0.5 rounded-full"
                            style={{ background: c.soft, color: c.text }}
                        >
                            {tasks.length}
                        </span>
                    </h2>
                    <button
                        onClick={() => onDeleteList(list._id)}
                        aria-label="Delete list"
                        title="Delete list"
                        className="text-xs w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer"
                        style={{ color: "var(--color-ink-muted)" }}
                    >
                        ×
                    </button>
                </div>

                {tasks.map((task) => (
                    <Task key={task._id} task={task} onDeleteTask={onDeleteTask} onToggleStatus={onToggleStatus} />
                ))}

                {tasks.length === 0 && (
                    <p className="text-xs italic py-2 text-center" style={{ color: "var(--color-ink-muted)" }}>
                        Drop a task here
                    </p>
                )}
            </div>
        </div>
    );
};
