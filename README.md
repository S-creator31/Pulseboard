# PulseBoard: From Task Board to Delivery Dashboard
> **CS447: Software Project Management — Group 9**  
> Measuring Schedule, Effort & Flow for small agile teams without enterprise overhead.

---

## 🌟 Overview & Architecture

PulseBoard bridges the gap between simple visual Kanban boards and heavyweight enterprise project-management tools. It provides small agile engineering teams with continuous schedule clarity, effort transparency, and flow bottleneck detection directly derived from board activity.

```
                      ┌──────────────────────────────────────┐
                      │    Next.js 15 Client (App Router)    │
                      │  Tailwind CSS v4 + Recharts + React  │
                      └──────────────────┬───────────────────┘
                                         │ Axios & Fetch (JWT)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       Node.js / Express 5 API        │
                      ├──────────────────┬───────────────────┤
                      │  Schedule Engine │  Analytics Engine │
                      │  (Pure CPM Sort) │  (Aggregations)   │
                      ├──────────────────┴───────────────────┤
                      │   RBAC + Activity Audit Logging      │
                      └──────────────────┬───────────────────┘
                                         │ Mongoose 8
                                         ▼
                      ┌──────────────────────────────────────┐
                      │          MongoDB Database            │
                      │ Tasks, Sprints, History, TimeEntries │
                      └──────────────────────────────────────┘
```

---

## 🚀 The 11 Visible Surfaces

1. **Kanban Board Upgraded**:
   - Slim **Board Stat Rail** directly under the header with sprint days remaining, points burned/committed, blocked task count, and inline 60px SVG burndown sparkline.
   - Priority chips, assignee avatars, overdue and due-soon indicators, blocked chain glyphs, and responsive density toggle (compact vs. comfortable).
2. **Delivery Analytics Page** (`/board/[id]/analytics`):
   - **Sprint Switcher**: segmented control switching between all sprints, driving charts and URL params.
   - **AI Delivery Digest**: 100% fact-checked stand-up summary with hover provenance chips linking every number to its database query.
   - **6 Project-Control Health Tiles**: Schedule Health (zero float), Schedule Performance Index (SPI), Cost Performance Index (CPI), Blocked Cards, Stale Cards (5+ days idle), and WIP limit tracker.
   - **4 Core Charts**:
     - *Sprint Burndown* (ideal line + remaining + shaded scope-added band)
     - *Velocity Trend* (committed vs. completed + 3-sprint rolling average)
     - *Cycle-Time Scatter* (actual elapsed duration with p50 and p85 thresholds)
     - *Cumulative Flow Diagram* (stacked area by list status showing bottlenecks)
   - **Team Capacity Heatmap**: advisory weekly workload matrix (committed hours vs. 30h baseline).
3. **Timeline View (Gantt)** (`/board/[id]/timeline`):
   - Single `<svg>` coordinate canvas rendering scheduled task bars and dependency curves with zero layout jitter.
   - Interactive **Critical Path Highlighter**: toggles non-critical paths to 25% opacity with 200ms transition.
   - Float slack extension badges and zoom controls (Day / Week / Month).
4. **Network View (PERT Diagram)** (`/board/[id]/timeline`):
   - Activity-on-Node boxes featuring Earliest Start (ES) / Earliest Finish (EF) on the top row, and Latest Start (LS) / Latest Finish (LF) with total float on the bottom row.
   - Ranked layout arranged by dependency depth; convergence nodes (3+ incoming dependencies) highlighted with warning rings.
5. **Task Detail & Time Logging Modal**:
   - Estimate-vs-actual effort bar with hatched overrun indicator.
   - Two-click quick time logger (15m, 30m, 1h, 2h chips + numeric entry and note).
   - Logged session audit history with per-entry removal.
6. **AI Work Breakdown Assistant**:
   - Quiet "Break down" assistant producing 3–7 task-specific, actionable subtasks (each under 8h), grounded in the task title and description.
   - Server-enforced prompt assembly (empty request body constraint).
   - Interactive preview with inline editable titles and estimate chips before acceptance.
7. **Activity Drawer**:
   - Slide-over right drawer sectioned by day with sticky date headers.
   - Cursor-based infinite scroll with from/to status chips and filters by actor and action.
8. **Members Surface & Role Matrix**:
   - Header avatar stack with overflow counter and owner crown.
   - Role badges (Owner, Admin, Member, Viewer).
   - Permission Matrix modal detailing RBAC boundaries across operations.
9. **Command Palette (`⌘K` / `Ctrl+K`)**:
   - Quick search and instant navigation across boards, analytics, timeline, and actions.
10. **Shortcuts Dialog (`?`)**:
    - Comprehensive keyboard shortcut map (`⌘K`, `?`, `G B`, `G A`, `G T`, `D`).
11. **Theme Toggle (Dark / Light / System)**:
    - Custom dark mode palette preserved in `localStorage` under `:root[data-theme]`.

---

## 📊 Synthetic Seed Dataset & Honest Data Pipeline

> **Transparency Note**: The demo board is seeded with **90 days of deterministic synthetic history** via `npm run seed:demo` (Mulberry32 PRNG constant seed) so all analytical pipelines, burndown slopes, cycle-time distributions, and critical-path models can be immediately demonstrated.
> 
> The pipeline is **completely live**: moving cards or logging 30 minutes in front of an evaluator immediately generates live `TaskStatusHistory`, `TimeEntry`, and `ActivityLog` documents reflected across the app.

### Demo Board Seed Summary:
- **Board**: `PulseBoard Core Platform`
- **Users**: 5 team members (Alex Rivera, Shlok Patel, Tushar Sharma, Keshav Rao, Riya Sen)
- **Sprints**: 4 two-week Sprints (3 closed, 1 active with 6 days remaining)
- **Tasks**: 68 tasks with story points, estimates, and priorities
- **Historical Transitions**: 186 status history documents
- **Time Entries**: 109 effort log entries
- **Dependencies**: 9 task dependency edges with a verified critical path

---

## 🔑 Demo Credentials

| Role | Name | Email | Password |
|---|---|---|---|
| **Owner** | Alex Rivera | `alex@pulseboard.dev` | `Password123!` |
| **Admin** | Shlok Patel | `shlok@pulseboard.dev` | `Password123!` |
| **Member** | Tushar Sharma | `tushar@pulseboard.dev` | `Password123!` |
| **Member** | Keshav Rao | `keshav@pulseboard.dev` | `Password123!` |
| **Member** | Riya Sen | `riya@pulseboard.dev` | `Password123!` |

---

## ⚡ Quick Start

### 1. Start Backend
```bash
cd server
npm install
npm run seed:demo  # Seeds deterministic demo board
npm start          # Runs backend on http://localhost:5000

```

For AI task breakdowns, add your Groq API key to `server/.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
```
Get a free key from [Groq Console](https://console.groq.com/keys). Keep this key server-side and never add it to the client or commit it.

### 2. Start Frontend
```bash
cd client
npm install
cp .env.local.example .env.local  # Configure the backend API URL
npm run dev        # Runs Next.js frontend on http://localhost:3000
```

### 3. Run Unit Tests (CPM & AI Validation)
```bash
cd server
npm test           # Runs pure CPM tests and Zod constraints
```

---

## 🎯 Seven-Minute Evaluator Walkthrough

1. **Board & Stat Rail (0:00)**: Open `/board/[id]`. Highlight active Sprint 4, days remaining, points burned vs committed, blocked task indicator, and the burndown sparkline.
2. **AI Delivery Digest (0:40)**: Navigate to `/analytics`. Hover over metric chips to demonstrate hover provenance queries (zero-hallucination guarantee).
3. **Delivery Health Strip (1:30)**: Review SPI (0.92), CPI, zero-float count, and stale card detection.
4. **Burndown & Sprint Switcher (2:20)**: Walk through closed sprints using the sprint switcher; demonstrate scope-added bands and cycle-time p50/p85 lines.
5. **Timeline & Critical Path (3:10)**: Switch to `/timeline`. Toggle "Highlight Critical Path" to fade non-critical tasks to 25% opacity.
6. **PERT Network View (3:40)**: Switch to PERT view. Show Activity-on-Node boxes with ES/EF and LS/LF float, plus convergence ring highlights.
7. **Live Card Effort & Activity Drawer (4:20)**: Click a card, log 30 minutes, watch the estimate-vs-actual bar adjust with hatched overrun, then open the Activity Drawer to show the live audit entry.
8. **AI Work Breakdown (5:20)**: Click "Break down" on a card to generate 3–7 actionable subtasks with verification criteria.
9. **Command Palette & Theme Toggle (6:35)**: Hit `⌘K` / `Ctrl+K` for instant command palette search and toggle dark mode.
