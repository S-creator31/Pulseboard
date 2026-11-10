"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PulseLogo from "@/components/PulseLogo";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
      );

      const responseText = await res.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("Non-JSON response received:", responseText);

        throw new Error(
          `Server returned an invalid response. Status: ${res.status}`,
        );
      }

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong!");
      }

      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen grid lg:grid-cols-2"
      style={{ background: "var(--color-paper)" }}
    >
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
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="28"
              height="28"
              rx="9"
              fill="white"
              fillOpacity="0.16"
            />
            <path
              d="M7 17.5H11.2L13.4 12L18 21L20.4 17.5H25"
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span className="font-display font-semibold text-lg text-white">
            Pulseboard
          </span>
        </span>

        <div className="relative z-10 max-w-sm">
          <p className="font-display text-3xl font-semibold text-white leading-tight text-balance">
            Set up shop in under a minute.
          </p>
          <p className="mt-4 text-white/80 leading-relaxed">
            Create your account, spin up your first board, and start moving work
            with your team.
          </p>
        </div>

        <p className="relative z-10 text-sm text-white/60">
          © {new Date().getFullYear()} Pulseboard
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <PulseLogo size="md" />
          </div>

          <h1
            className="font-display text-2xl font-semibold mb-1"
            style={{ color: "var(--color-ink)" }}
          >
            Create your account
          </h1>
          <p
            className="text-sm mb-7"
            style={{ color: "var(--color-ink-muted)" }}
          >
            Free to start — no card required.
          </p>

          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--color-ink)" }}
            htmlFor="name"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            name="name"
            placeholder="Ada Lovelace"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full mb-4 px-3.5 py-2.5 rounded-xl border outline-none"
            style={{
              borderColor: "var(--color-line)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
            }}
          />

          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--color-ink)" }}
            htmlFor="email"
          >
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
            className="w-full mb-4 px-3.5 py-2.5 rounded-xl border outline-none"
            style={{
              borderColor: "var(--color-line)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
            }}
          />

          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--color-ink)" }}
            htmlFor="password"
          >
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
            className="w-full mb-2 px-3.5 py-2.5 rounded-xl border outline-none"
            style={{
              borderColor: "var(--color-line)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
            }}
          />

          {error && (
            <p
              className="text-sm mt-2 mb-2 px-3 py-2 rounded-lg"
              style={{
                color: "var(--color-danger)",
                background: "var(--color-danger-soft)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 font-semibold py-2.5 px-4 rounded-xl text-white transition-opacity disabled:opacity-60 cursor-pointer"
            style={{
              background: "var(--color-brand)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <Link href="/login">
            <p
              className="mt-6 text-sm text-center"
              style={{ color: "var(--color-ink-muted)" }}
            >
              Already have an account?{" "}
              <span
                className="font-medium"
                style={{ color: "var(--color-brand)" }}
              >
                Log in
              </span>
            </p>
          </Link>
        </form>
      </div>
    </div>
  );
}
