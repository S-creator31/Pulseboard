'use client';

import React from 'react';

export default function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘K / Ctrl+K', description: 'Open command palette' },
    { key: '?', description: 'Show keyboard shortcuts' },
    { key: 'G B', description: 'Go to Kanban Board' },
    { key: 'G A', description: 'Go to Analytics & Health' },
    { key: 'G T', description: 'Go to Timeline & PERT' },
    { key: 'G R', description: 'Go to Risk Analysis' },
    { key: 'D', description: 'Toggle density (Compact / Comfortable)' },
    { key: 'Esc', description: 'Close any active modal or drawer' }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border p-6 max-w-md w-full shadow-2xl space-y-4"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-brand)" }} />
            <h3 className="font-display text-base font-bold" style={{ color: "var(--color-ink)" }}>
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="divide-y text-xs" style={{ borderColor: "var(--color-line)" }}>
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between">
              <span style={{ color: "var(--color-ink)" }}>{s.description}</span>
              <kbd
                className="px-2 py-1 rounded-md border font-data font-semibold text-[11px]"
                style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)", color: "var(--color-brand)" }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white cursor-pointer"
            style={{ background: "var(--color-brand)" }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
