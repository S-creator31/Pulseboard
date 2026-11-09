'use client';

import React from 'react';
import Link from 'next/link';

export default function BoardStatRail({ boardId, activeSprint, sparkline = [36, 32, 28, 26, 23, 20, 16] }) {
  if (!activeSprint) return null;

  // Convert sparkline points to SVG polyline coordinates inside 60x18
  const minVal = Math.min(...sparkline);
  const maxVal = Math.max(...sparkline, minVal + 1);
  const width = 60;
  const height = 18;

  const pointsStr = sparkline
    .map((val, idx) => {
      const x = (idx / (sparkline.length - 1)) * width;
      const y = height - ((val - minVal) / (maxVal - minVal)) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Link
      href={`/board/${boardId}/analytics`}
      className="group block w-full py-1.5 px-4 rounded-xl border transition-all hover:shadow-sm select-none"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-line)"
      }}
      title="Click to view full Delivery Analytics & Project Controls"
    >
      <div className="flex items-center justify-between gap-3 overflow-x-auto text-xs flex-wrap">
        
        {/* Left: Sprint badge & days left */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold"
            style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-brand)" }} />
            <span>{activeSprint.name || 'Sprint 4'}</span>
          </span>

          <span
            className="px-2 py-0.5 rounded-full font-data font-medium border"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "var(--color-line)",
              color: "var(--color-ink-muted)"
            }}
          >
            {activeSprint.daysRemaining} days left
          </span>
        </div>

        {/* Center: Points burned & Blocked count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-medium" style={{ color: "var(--color-ink)" }}>
            <span style={{ color: "var(--color-ink-muted)" }}>Points:</span>
            <span className="font-data font-bold">{activeSprint.completedPoints || 23}</span>
            <span style={{ color: "var(--color-ink-muted)" }}>/ {activeSprint.committedPoints || 36}</span>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                activeSprint.blockedCount > 0 ? 'bg-[#ffe6e2] text-[#d93c30]' : 'bg-[#e3faf0] text-[#12b76a]'
              }`}
            >
              <span>{activeSprint.blockedCount > 0 ? '⛔' : '✓'}</span>
              <span>{activeSprint.blockedCount} blocked</span>
            </span>
          </div>

          {/* 60px Burndown Sparkline */}
          <div className="flex items-center gap-1.5 pl-2 border-l" style={{ borderColor: "var(--color-line)" }}>
            <span className="text-[10px]" style={{ color: "var(--color-ink-muted)" }}>Burn:</span>
            <svg width={width} height={height} className="overflow-visible">
              <polyline
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsStr}
              />
            </svg>
          </div>
        </div>

        {/* Right prompt */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold transition-colors group-hover:text-[#6d28f5]" style={{ color: "var(--color-ink-muted)" }}>
          <span>View Controls</span>
          <span>→</span>
        </div>

      </div>
    </Link>
  );
}
