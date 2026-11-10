'use client';

import React from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';

export default function CommandPalette({
  boardId,
  isOpen,
  onClose,
  onOpenNewTask,
  onToggleTheme,
  onOpenShortcuts
}) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border w-full max-w-lg shadow-2xl overflow-hidden p-2"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="w-full">
          <div className="flex items-center gap-2 px-3 border-b pb-2" style={{ borderColor: "var(--color-line)" }}>
            <span className="text-sm">🔍</span>
            <Command.Input
              autoFocus
              placeholder="Type a command or jump to screen…"
              className="w-full text-sm outline-none bg-transparent"
              style={{ color: "var(--color-ink)" }}
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border font-data" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)" }}>ESC</kbd>
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2 text-xs space-y-1">
            <Command.Empty className="py-6 text-center text-gray-400">
              No matching commands found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1">
              <Command.Item
                onSelect={() => { router.push(`/board/${boardId}`); onClose(); }}
                className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
              >
                <div className="flex items-center gap-2">
                  <span>📋</span>
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>Kanban Board</span>
                </div>
                <kbd className="font-data text-[10px] text-gray-400">G B</kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => { router.push(`/board/${boardId}/analytics`); onClose(); }}
                className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
              >
                <div className="flex items-center gap-2">
                  <span>📈</span>
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>Delivery Analytics</span>
                </div>
                <kbd className="font-data text-[10px] text-gray-400">G A</kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => { router.push(`/board/${boardId}/timeline`); onClose(); }}
                className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
              >
                <div className="flex items-center gap-2">
                  <span>📊</span>
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>Timeline & PERT Diagram</span>
                </div>
                <kbd className="font-data text-[10px] text-gray-400">G T</kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => { router.push('/dashboard'); onClose(); }}
                className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
              >
                <div className="flex items-center gap-2">
                  <span>🏠</span>
                  <span className="font-medium" style={{ color: "var(--color-ink)" }}>Dashboard</span>
                </div>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick Actions" className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1">
              {onOpenNewTask && (
                <Command.Item
                  onSelect={() => { onOpenNewTask(); onClose(); }}
                  className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
                >
                  <div className="flex items-center gap-2">
                    <span>➕</span>
                    <span className="font-medium" style={{ color: "var(--color-ink)" }}>Add New Task</span>
                  </div>
                  <kbd className="font-data text-[10px] text-gray-400">N</kbd>
                </Command.Item>
              )}

              {onToggleTheme && (
                <Command.Item
                  onSelect={() => { onToggleTheme(); onClose(); }}
                  className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
                >
                  <div className="flex items-center gap-2">
                    <span>🌓</span>
                    <span className="font-medium" style={{ color: "var(--color-ink)" }}>Toggle Theme (Dark / Light)</span>
                  </div>
                </Command.Item>
              )}

              {onOpenShortcuts && (
                <Command.Item
                  onSelect={() => { onOpenShortcuts(); onClose(); }}
                  className="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-black/5"
                >
                  <div className="flex items-center gap-2">
                    <span>⌨️</span>
                    <span className="font-medium" style={{ color: "var(--color-ink)" }}>Keyboard Shortcuts</span>
                  </div>
                  <kbd className="font-data text-[10px] text-gray-400">?</kbd>
                </Command.Item>
              )}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
