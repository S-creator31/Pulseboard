'use client'

import { useEffect, useState } from "react";

const ActivityLog = ({ boardId }) => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/activity-logs/${boardId}`, {
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('token')}`
                    }
                });
                const data = await res.json();
                setLogs(data);
            } catch (err) {
                console.error('Error fetching logs:', err);
            }
        };
        fetchLogs();
    }, [boardId]);

    return (
        <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
        >
            <h3 className="font-display text-sm font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
                Activity
            </h3>

            {logs.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>Nothing logged yet.</p>
            ) : (
                <ul className="space-y-3">
                    {logs.map((log) => (
                        <li key={log._id} className="flex gap-2.5 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--color-brand)" }} />
                            <span>
                                <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                                    {log.user?.name || 'Someone'}
                                </span>{' '}
                                <span style={{ color: "var(--color-ink-muted)" }}>{log.action}</span>
                                <br />
                                <span className="text-xs font-data" style={{ color: "var(--color-ink-muted)" }}>
                                    {new Date(log.createdAt).toLocaleString()}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ActivityLog;
