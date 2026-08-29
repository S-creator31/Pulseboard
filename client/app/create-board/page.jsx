'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BOARD_COLORS, BOARD_COLOR_KEYS } from "@/lib/colors";

export default function CreateBoardPage() {
    const [title, setTitle] = useState('');
    const [color, setColor] = useState('violet');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const token = localStorage.getItem('token');
        if (!token) {
            setError('You must login');
            setSubmitting(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ title, color })
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.message || 'Something went wrong');
            } else {
                setTitle('');
                router.push('/dashboard');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--color-paper)" }}>
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-2xl border p-7"
                style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", boxShadow: "var(--shadow-soft)" }}
            >
                <h1 className="font-display text-xl font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
                    Create a board
                </h1>
                <p className="text-sm mb-6" style={{ color: "var(--color-ink-muted)" }}>
                    Give it a name and a color — you can always change the name later.
                </p>

                <label className="block text-sm font-medium mb-1.5" htmlFor="title" style={{ color: "var(--color-ink)" }}>
                    Board title
                </label>
                <input
                    id="title"
                    type="text"
                    placeholder="Sprint 6 — Drag & Drop"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full mb-5 px-3.5 py-2.5 rounded-xl border outline-none"
                    style={{ borderColor: "var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
                />

                <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-ink)" }}>
                    Color
                </label>
                <div className="flex gap-2.5 mb-6">
                    {BOARD_COLOR_KEYS.map((key) => {
                        const c = BOARD_COLORS[key];
                        const active = color === key;
                        return (
                            <button
                                type="button"
                                key={key}
                                onClick={() => setColor(key)}
                                title={c.label}
                                aria-label={c.label}
                                aria-pressed={active}
                                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform"
                                style={{
                                    background: c.solid,
                                    transform: active ? "scale(1.12)" : "scale(1)",
                                    boxShadow: active ? `0 0 0 3px var(--color-surface), 0 0 0 5px ${c.solid}` : "none",
                                }}
                            >
                                {active && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>

                {error && (
                    <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ color: "var(--color-danger)", background: "var(--color-danger-soft)" }}>
                        {error}
                    </p>
                )}

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 font-semibold text-white py-2.5 px-4 rounded-xl transition-opacity disabled:opacity-60 cursor-pointer"
                        style={{ background: "var(--color-brand)", boxShadow: "var(--shadow-glow)" }}
                    >
                        {submitting ? "Creating…" : "Create board"}
                    </button>
                    <Link
                        href="/dashboard"
                        className="text-sm font-medium px-4 py-2.5 rounded-xl"
                        style={{ color: "var(--color-ink-muted)" }}
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
