'use client';

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import PulseLogo from "@/components/PulseLogo";

export default function Login() {
    const { login } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            await login(formData.email, formData.password);
        } catch (err) {
            setError(err.message || 'Something went wrong!');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2" style={{ background: "var(--color-paper)" }}>

            {/* Brand panel */}
            <div className="hidden lg:flex flex-col justify-between p-12 pulse-gradient relative overflow-hidden">
                <div
                    className="absolute -top-24 -right-24 w-96 h-96 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                    aria-hidden="true"
                />
                <div
                    className="absolute bottom-0 left-0 w-72 h-72 rounded-full translate-y-1/3 -translate-x-1/4"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                    aria-hidden="true"
                />
                <span className="inline-flex items-center gap-2 relative z-10">
                    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                        <rect x="2" y="2" width="28" height="28" rx="9" fill="white" fillOpacity="0.16" />
                        <path d="M7 17.5H11.2L13.4 12L18 21L20.4 17.5H25" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                    <span className="font-display font-semibold text-lg text-white">Pulseboard</span>
                </span>

                <div className="relative z-10 max-w-sm">
                    <p className="font-display text-3xl font-semibold text-white leading-tight text-balance">
                        Feel your team's momentum.
                    </p>
                    <p className="mt-4 text-white/80 leading-relaxed">
                        Boards, lists, and tasks that move as fast as your team does. Sign in to pick up where you left off.
                    </p>
                </div>

                <p className="relative z-10 text-sm text-white/60">© {new Date().getFullYear()} Pulseboard</p>
            </div>

            {/* Form panel */}
            <div className="flex items-center justify-center p-6 sm:p-12">
                <form onSubmit={handleSubmit} className="w-full max-w-sm">

                    <div className="lg:hidden mb-8">
                        <PulseLogo size="md" />
                    </div>

                    <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
                        Welcome back
                    </h1>
                    <p className="text-sm mb-7" style={{ color: "var(--color-ink-muted)" }}>
                        Log in to jump back into your boards.
                    </p>

                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink)" }} htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full mb-4 px-3.5 py-2.5 rounded-xl border outline-none transition-shadow"
                        style={{
                            borderColor: "var(--color-line)",
                            background: "var(--color-surface)",
                            color: "var(--color-ink)",
                        }}
                    />

                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-ink)" }} htmlFor="password">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full mb-2 px-3.5 py-2.5 rounded-xl border outline-none transition-shadow"
                        style={{
                            borderColor: "var(--color-line)",
                            background: "var(--color-surface)",
                            color: "var(--color-ink)",
                        }}
                    />

                    {error && (
                        <p className="text-sm mt-2 mb-2 px-3 py-2 rounded-lg" style={{ color: "var(--color-danger)", background: "var(--color-danger-soft)" }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full mt-4 font-semibold py-2.5 px-4 rounded-xl text-white transition-opacity disabled:opacity-60 cursor-pointer"
                        style={{ background: "var(--color-brand)", boxShadow: "var(--shadow-glow)" }}
                    >
                        {submitting ? "Logging in…" : "Log in"}
                    </button>

                    <Link href="/register">
                        <p className="mt-6 text-sm text-center" style={{ color: "var(--color-ink-muted)" }}>
                            New to Pulseboard?{" "}
                            <span className="font-medium" style={{ color: "var(--color-brand)" }}>
                                Create an account
                            </span>
                        </p>
                    </Link>
                </form>
            </div>
        </div>
    );
}
