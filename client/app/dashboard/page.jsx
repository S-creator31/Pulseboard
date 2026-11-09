'use client'

import { useAuth } from "@/context/AuthContext"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"
import Link from "next/link"
import PulseLogo from "@/components/PulseLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { boardColor } from "@/lib/colors";

export default function Dashboard() {
    const { user, logout, loading } = useAuth();
    const router = useRouter();

    const [boards, setBoards] = useState([]);
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Wait for AuthContext to finish reading localStorage before
        // deciding to redirect — checking only `user` here used to bounce
        // straight back to /login on every hard refresh of /dashboard,
        // because this effect ran before the auth state had loaded.
        if (loading) return;

        if (!user || !user.token) {
            router.push('/login');
            return;
        }

        const fetchBoards = async () => {
            const token = localStorage.getItem('token');

            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/boards`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    setError(data.message || 'Failed to fetch boards!');
                } else {
                    setBoards(data);
                }
            } catch (err) {
                setError('Server error')
            } finally {
                setLoaded(true);
            }
        };

        fetchBoards();

    }, [user, loading]);

    return (
        <div className="min-h-screen" style={{ background: "var(--color-paper)" }}>

            <header className="border-b" style={{ borderColor: "var(--color-line)" }}>
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <PulseLogo size="sm" />
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <AccountBadge />
                        <button
                            onClick={logout}
                            className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            style={{ color: "var(--color-ink-muted)" }}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
                    <div>
                        <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--color-ink)" }}>
                            Your boards
                        </h1>
                        <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
                            {boards.length > 0
                                ? `${boards.length} board${boards.length === 1 ? "" : "s"} you own or belong to.`
                                : "Nothing here yet — spin up your first board."}
                        </p>
                    </div>
                    <Link
                        href="/create-board"
                        className="font-semibold text-sm text-white px-4 py-2.5 rounded-xl transition-opacity hover:opacity-90"
                        style={{ background: "var(--color-brand)", boxShadow: "var(--shadow-glow)" }}
                    >
                        + New board
                    </Link>
                </div>

                {error && (
                    <p className="text-sm mb-6 px-3 py-2 rounded-lg inline-block" style={{ color: "var(--color-danger)", background: "var(--color-danger-soft)" }}>
                        {error}
                    </p>
                )}

                {loaded && boards.length === 0 && !error ? (
                    <EmptyState />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {boards.map((board) => (
                            <BoardCard key={board._id} board={board} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function BoardCard({ board }) {
    const c = boardColor(board.color);
    return (
        <Link
            href={`/board/${board._id}`}
            className="group block rounded-2xl border p-5 transition-shadow hover:shadow-lg"
            style={{ borderColor: "var(--color-line)", background: "var(--color-surface)", boxShadow: "var(--shadow-soft)" }}
        >
            <div className="h-2 -mt-5 -mx-5 mb-4 rounded-t-2xl" style={{ background: c.solid }} />
            <h2 className="font-display font-semibold text-lg leading-snug" style={{ color: "var(--color-ink)" }}>
                {board.title}
            </h2>
            <p className="text-xs mt-3 font-data" style={{ color: "var(--color-ink-muted)" }}>
                Created {new Date(board.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
        </Link>
    );
}

function EmptyState() {
    return (
        <div
            className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center py-16 px-6"
            style={{ borderColor: "var(--color-line)" }}
        >
            <div className="w-12 h-12 rounded-2xl pulse-gradient mb-4" />
            <p className="font-display font-semibold text-lg" style={{ color: "var(--color-ink)" }}>
                No boards yet
            </p>
            <p className="text-sm mt-1 mb-5 max-w-xs" style={{ color: "var(--color-ink-muted)" }}>
                Create a board to start organizing lists, tasks, and your team's work.
            </p>
            <Link
                href="/create-board"
                className="font-semibold text-sm text-white px-4 py-2.5 rounded-xl transition-opacity hover:opacity-90"
                style={{ background: "var(--color-brand)" }}
            >
                Create your first board
            </Link>
        </div>
    );
}

function AccountBadge() {
    // AuthContext only stores {token, id, _id} after login — no name or
    // email — so this shows a generic account glyph rather than a
    // first-letter avatar derived from an ObjectId, which would be
    // meaningless. A real "who am I" endpoint would let this show initials.
    return (
        <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}
            aria-label="Account"
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
            </svg>
        </span>
    );
}
