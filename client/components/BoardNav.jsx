'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PulseLogo from '@/components/PulseLogo';
import PulseAvatar from '@/components/PulseAvatar';
import ThemeToggle from '@/components/ThemeToggle';
import { boardColor } from '@/lib/colors';

export default function BoardNav({
  board,
  activeTab = 'board',
  members = [],
  onOpenMembers,
  onOpenActivity,
  onOpenShortcuts,
  onOpenCommandPalette,
  activeAssigneeFilter,
  onSelectAssigneeFilter,
  density,
  onToggleDensity,
  rightActions
}) {
  const pathname = usePathname();
  const boardId = board?._id || pathname?.split('/')[2];
  const c = boardColor(board?.color);

  // First 4 members + overflow count
  const displayMembers = members.slice(0, 4);
  const overflowCount = Math.max(0, members.length - 4);

  return (
    <header className="border-b sticky top-0 z-30" style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}>
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        
        {/* Left: Brand, Board Name & Nav Tabs */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="transition-transform hover:scale-105">
            <PulseLogo size="sm" />
          </Link>

          {board && (
            <>
              <span className="w-px h-5" style={{ background: "var(--color-line)" }} />
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.solid }} />
                <h1 className="font-display text-base font-semibold truncate max-w-[200px] sm:max-w-[280px]" style={{ color: "var(--color-ink)" }}>
                  {board.title}
                </h1>
              </div>
            </>
          )}

          {/* Navigation Tabs */}
          {boardId && (
            <nav className="flex items-center gap-1 ml-2 p-1 rounded-xl" style={{ background: "var(--color-surface-2)" }}>
              <Link
                href={`/board/${boardId}`}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'board' ? 'shadow-sm' : ''}`}
                style={{
                  background: activeTab === 'board' ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === 'board' ? 'var(--color-brand)' : 'var(--color-ink-muted)'
                }}
              >
                Board
              </Link>
              <Link
                href={`/board/${boardId}/analytics`}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'analytics' ? 'shadow-sm' : ''}`}
                style={{
                  background: activeTab === 'analytics' ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === 'analytics' ? 'var(--color-brand)' : 'var(--color-ink-muted)'
                }}
              >
                Analytics
              </Link>
              <Link
                href={`/board/${boardId}/timeline`}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'timeline' ? 'shadow-sm' : ''}`}
                style={{
                  background: activeTab === 'timeline' ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === 'timeline' ? 'var(--color-brand)' : 'var(--color-ink-muted)'
                }}
              >
                Timeline & PERT
              </Link>
              <Link
                href={`/board/${boardId}/risk`}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'risk' ? 'shadow-sm' : ''}`}
                style={{
                  background: activeTab === 'risk' ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === 'risk' ? 'var(--color-brand)' : 'var(--color-ink-muted)'
                }}
              >
                Risk
              </Link>
            </nav>
          )}
        </div>

        {/* Right: Controls, Avatar Stack, Drawer triggers */}
        <div className="flex items-center gap-2">

          {/* Member Avatar Stack */}
          {members.length > 0 && (
            <div
              onClick={onOpenMembers}
              className="flex items-center -space-x-1.5 p-1 rounded-full cursor-pointer transition-opacity hover:opacity-85 mr-1"
              title="Team members (Click to view roles)"
            >
              {displayMembers.map((m, idx) => {
                const u = m.user || m;
                const isOwner = board?.owner?._id === u._id || board?.owner === u._id;
                const isFilterActive = activeAssigneeFilter === u._id;
                return (
                  <div key={u._id || idx} className="relative">
                    <PulseAvatar name={u.name} size={28} ring={true} />
                    {isOwner && (
                      <span
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                        style={{ background: "var(--color-brand)" }}
                        title="Board Owner"
                      >
                        👑
                      </span>
                    )}
                  </div>
                );
              })}
              {overflowCount > 0 && (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ring-2 shrink-0 font-data"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-ink-muted)",
                    boxShadow: "0 0 0 2px var(--color-surface)"
                  }}
                >
                  +{overflowCount}
                </span>
              )}
            </div>
          )}

          {/* Command Palette Trigger */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
              title="Command Palette (Cmd/Ctrl + K)"
            >
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-data border" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-line)" }}>⌘K</kbd>
            </button>
          )}

          {/* Shortcuts Help */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-semibold cursor-pointer"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
              title="Keyboard Shortcuts (?)"
            >
              ?
            </button>
          )}

          {/* Density toggle on board view */}
          {onToggleDensity && (
            <button
              type="button"
              onClick={onToggleDensity}
              className="px-2 py-1 text-xs font-medium rounded-lg border cursor-pointer hidden sm:inline-flex"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
              title={`Switch density (currently ${density})`}
            >
              {density === 'compact' ? 'Compact' : 'Comfortable'}
            </button>
          )}

          {/* Activity Drawer Trigger */}
          {onOpenActivity && (
            <button
              type="button"
              onClick={onOpenActivity}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
              style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Activity</span>
            </button>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {rightActions}
        </div>
      </div>
    </header>
  );
}
