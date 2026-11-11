import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

# --- MODERN PREMIUM COLOR PALETTE ---
# Rooted in the initial design system (PulseBoard Navy + Violet Brand + Modern Pastels)
C_DARK_NAVY    = RGBColor(0x1E, 0x29, 0x3B)  # #1E293B Slate 800 - Ultra crisp headings
C_TEXT_MUTED   = RGBColor(0x64, 0x74, 0x8B)  # #64748B Slate 500 - Subtitles & metadata
C_TEXT_BODY    = RGBColor(0x33, 0x41, 0x55)  # #334155 Slate 700 - Body paragraphs
C_BRAND_VIOLET = RGBColor(0x54, 0x16, 0xE0)  # #5416E0 Pulse Purple - Brand accents
C_CORAL_ACCENT = RGBColor(0xE1, 0x1D, 0x48)  # #E11D48 Rose/Coral - Critical path & alerts
C_EMERALD      = RGBColor(0x05, 0x96, 0x69)  # #059669 Emerald - Done & healthy

# Clean Modern Card Surfaces (Soft, subtle tints with high-contrast text)
C_CARD_WHITE   = RGBColor(0xFF, 0xFF, 0xFF)  # Crisp white card surface
C_CARD_BG_PAGE = RGBColor(0xF8, 0xFA, 0xFC)  # Slate 50 background
C_CARD_BLUE    = RGBColor(0xEE, 0xF2, 0xFF)  # Soft Indigo/Blue tint
C_CARD_PURPLE  = RGBColor(0xF5, 0xF3, 0xFF)  # Soft Violet tint
C_CARD_GREEN   = RGBColor(0xEC, 0xFD, 0xF5)  # Soft Emerald tint
C_CARD_AMBER   = RGBColor(0xFF, 0xFB, 0xEB)  # Soft Amber tint
C_CARD_ROSE    = RGBColor(0xFF, 0xF1, 0xF2)  # Soft Rose tint

C_BORDER_SUBTLE = RGBColor(0xE2, 0xE8, 0xF0) # Slate 200 - Clean modern hairline
C_PILL_BG       = RGBColor(0xD5, 0xED, 0xF6) # Light Cyan Pill from initial deck
C_PILL_TXT      = RGBColor(0x0F, 0x17, 0x2A) # Deep Slate text for pill

FONT_HEADING = 'Barlow Bold'
FONT_BODY    = 'Montserrat'
FONT_BOLD    = 'Montserrat Bold'

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    return prs

def get_blank_layout(prs):
    return prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[0]

def add_header(slide, category_tag, slide_title, subtitle=None):
    # Category Pill (modern rounded capsule)
    pill_w = Inches(max(1.5, len(category_tag) * 0.11 + 0.6))
    pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.55), pill_w, Inches(0.28))
    pill.fill.solid()
    pill.fill.fore_color.rgb = C_PILL_BG
    pill.line.fill.background()
    
    tf_p = pill.text_frame
    tf_p.word_wrap = False
    tf_p.margin_left = Inches(0.12)
    tf_p.margin_right = Inches(0.12)
    tf_p.margin_top = Inches(0.04)
    tf_p.margin_bottom = Inches(0.04)
    p = tf_p.paragraphs[0]
    p.text = category_tag.upper()
    p.font.name = FONT_BODY
    p.font.bold = True
    p.font.size = Pt(8.5)
    p.font.color.rgb = C_PILL_TXT

    # Slide Title Box
    title_h = Inches(0.85) if subtitle else Inches(0.65)
    tbox = slide.shapes.add_textbox(Inches(0.8), Inches(0.92), Inches(11.73), title_h)
    tf = tbox.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p_t = tf.paragraphs[0]
    p_t.text = slide_title
    p_t.font.name = FONT_HEADING
    p_t.font.bold = True
    p_t.font.size = Pt(28)
    p_t.font.color.rgb = C_DARK_NAVY

    if subtitle:
        p_sub = tf.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.name = FONT_BODY
        p_sub.font.size = Pt(11.5)
        p_sub.font.color.rgb = C_TEXT_MUTED
        p_sub.space_before = Pt(3)

def add_card(slide, left, top, width, height, bg_color=None, border_color=None):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color if bg_color else C_CARD_WHITE
    if border_color:
        card.line.color.rgb = border_color
        card.line.width = Pt(1)
    else:
        card.line.fill.background()
    return card

def populate_card(card, title, bullets=[], subtitle=None, tag=None, tag_color=None, title_size=15, body_size=10.5):
    tf = card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.24)
    tf.margin_right = Inches(0.24)
    tf.margin_top = Inches(0.22)
    tf.margin_bottom = Inches(0.22)

    # Optional Pill / Tag inside card
    p_first = tf.paragraphs[0]
    if tag:
        p_first.text = tag.upper()
        p_first.font.name = FONT_BOLD
        p_first.font.bold = True
        p_first.font.size = Pt(8)
        p_first.font.color.rgb = tag_color if tag_color else C_BRAND_VIOLET
        p_first.space_after = Pt(2)
        p_title = tf.add_paragraph()
    else:
        p_title = p_first

    p_title.text = title
    p_title.font.name = FONT_HEADING
    p_title.font.bold = True
    p_title.font.size = Pt(title_size)
    p_title.font.color.rgb = C_DARK_NAVY
    p_title.space_after = Pt(4)

    if subtitle:
        p_sub = tf.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.name = FONT_BOLD
        p_sub.font.size = Pt(body_size + 0.5)
        p_sub.font.color.rgb = C_TEXT_MUTED
        p_sub.space_after = Pt(6)

    for b in bullets:
        p_b = tf.add_paragraph()
        p_b.text = b
        p_b.font.name = FONT_BODY
        p_b.font.size = Pt(body_size)
        p_b.font.color.rgb = C_TEXT_BODY
        p_b.space_after = Pt(3.5)

def build_20_slide_deck():
    prs = create_presentation()
    layout = get_blank_layout(prs)

    # Grid Constants
    col2_w = 5.75
    gap2 = 0.23
    y_split = 1.95
    h_split = 5.00

    col3_w = 3.76
    gap3 = 0.22
    y_col3 = 1.95
    h_col3 = 5.00

    # =========================================================================
    # SLIDE 1: TITLE SLIDE (Clean, Modern, No Author Names on Top)
    # =========================================================================
    s1 = prs.slides.add_slide(layout)
    # Right hero accent card
    add_card(s1, 8.2, 0.7, 4.35, 6.1, bg_color=C_BRAND_VIOLET)
    
    tx_r = s1.shapes.add_textbox(Inches(8.5), Inches(1.0), Inches(3.75), Inches(5.5))
    tf_r = tx_r.text_frame
    tf_r.word_wrap = True
    p_rh = tf_r.paragraphs[0]
    p_rh.text = "CORE PLATFORM PILLARS"
    p_rh.font.name = FONT_HEADING
    p_rh.font.bold = True
    p_rh.font.size = Pt(13)
    p_rh.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    p_rh.space_after = Pt(14)

    pillars = [
        ("Pure CPM & DAG Engine", "Topological sort, forward/backward pass & cycle error detection"),
        ("Monte Carlo Simulation", "Beta-PERT three-point probability, Z-score quantiles & criticality"),
        ("Single-SVG Gantt & PERT", "Vector timelines with live critical path toggle and float badges"),
        ("Mongoose Flow Analytics", "Sprint Burndown, Velocity trends, CFD & p85 Cycle Time SLAs"),
        ("Fact-Grounded AI Insights", "Server-computed facts digest & bounded task decomposition"),
        ("Security & Live Collaboration", "4-Tier RBAC, immutable audit logging & Socket.io synchronization")
    ]
    for p_name, p_desc in pillars:
        p_pt = tf_r.add_paragraph()
        p_pt.text = f"•  {p_name}"
        p_pt.font.name = FONT_BOLD
        p_pt.font.bold = True
        p_pt.font.size = Pt(10)
        p_pt.font.color.rgb = RGBColor(0xD5, 0xED, 0xF6)
        
        p_pd = tf_r.add_paragraph()
        p_pd.text = f"   {p_desc}"
        p_pd.font.name = FONT_BODY
        p_pd.font.size = Pt(8.5)
        p_pd.font.color.rgb = RGBColor(0xEE, 0xF2, 0xFF)
        p_pd.space_after = Pt(6)

    # Left content: Minimal, High Design Title
    tx_l = s1.shapes.add_textbox(Inches(0.8), Inches(1.3), Inches(7.1), Inches(5.2))
    tf_l = tx_l.text_frame
    tf_l.word_wrap = True
    
    p_pill = tf_l.paragraphs[0]
    p_pill.text = "SOFTWARE PROJECT MANAGEMENT · COURSEWORK DEFENSE"
    p_pill.font.name = FONT_BOLD
    p_pill.font.bold = True
    p_pill.font.size = Pt(10)
    p_pill.font.color.rgb = C_BRAND_VIOLET
    p_pill.space_after = Pt(10)

    p_t = tf_l.add_paragraph()
    p_t.text = "PulseBoard"
    p_t.font.name = FONT_HEADING
    p_t.font.bold = True
    p_t.font.size = Pt(50)
    p_t.font.color.rgb = C_DARK_NAVY

    p_sub = tf_l.add_paragraph()
    p_sub.text = "From Task Board to Delivery Dashboard"
    p_sub.font.name = FONT_HEADING
    p_sub.font.bold = True
    p_sub.font.size = Pt(24)
    p_sub.font.color.rgb = C_DARK_NAVY
    p_sub.space_after = Pt(8)

    p_tag = tf_l.add_paragraph()
    p_tag.text = "Layering Schedule Adherence, Effort Accounting & Workflow Health for Small Agile Teams without Enterprise Overhead"
    p_tag.font.name = FONT_BODY
    p_tag.font.size = Pt(12.5)
    p_tag.font.color.rgb = C_TEXT_BODY
    p_tag.space_after = Pt(20)

    p_meta = tf_l.add_paragraph()
    p_meta.text = "Course: CS447 Software Project Management  ·  Group 9\nPlatform: Next.js 15 App Router + Node.js Express + MongoDB"
    p_meta.font.name = FONT_BOLD
    p_meta.font.size = Pt(11)
    p_meta.font.color.rgb = C_TEXT_MUTED

    # =========================================================================
    # SLIDE 2: THE PROBLEM STATEMENT & INDUSTRY CONTEXT
    # =========================================================================
    s2 = prs.slides.add_slide(layout)
    add_header(s2, "CONTEXT & PROBLEM", "The Small-Team Agile Delivery Dilemma", "Why lightweight task boards fail at schedule predictability")
    
    p2_cards = [
        ("Bloated Workflows", C_CARD_PURPLE, [
            "Enterprise systems (Jira) enforce rigid backlog schemas and heavy sprint administration.",
            "Small teams bypass 80% of configuration, leaving tickets unestimated and unlinked.",
            "Rigid ceremony suppresses team agency and introduces administrative drag."
        ]),
        ("Fragmented Tooling", C_CARD_BLUE, [
            "77% of SPM tools are standalone single-purpose silos (Chadli et al. 2016).",
            "Teams context-switch constantly between Kanban boards, Google Sheets, Slack, and Excel.",
            "High tooling friction causes delivery spreadsheets to become quickly outdated."
        ]),
        ("Invisible Schedule Risk", C_CARD_ROSE, [
            "Traditional Kanban tracks WHERE a task sits, but remains blind to WHEN it delivers.",
            "Dependency delays compound silently until delivery milestones fail catastrophically.",
            "Small teams lack simple visibility into critical path sequences and float buffers."
        ]),
        ("Effort Guesswork", C_CARD_AMBER, [
            "No automated connection between planned estimates and actual logged developer hours.",
            "Developer over-allocation (>40h/week) remains hidden, causing unmonitored team burnout.",
            "Sprint reviews lack empirical effort data to calibrate future commitment velocity."
        ])
    ]
    card_w4 = 2.76
    gap4 = 0.23
    for idx, (title, color, bullets) in enumerate(p2_cards):
        c = add_card(s2, 0.8 + idx * (card_w4 + gap4), y_split, card_w4, h_split, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 3: AIM, OBJECTIVES & 6 CORE COMMITMENTS
    # =========================================================================
    s3 = prs.slides.add_slide(layout)
    add_header(s3, "AIM & OBJECTIVES", "Project Scope & Baseline Commitments (100% Shipped)", "All 6 project charter commitments verified and demo-ready")

    row_h = 2.38
    gap_y = 0.22
    y0 = 1.95
    commitments = [
        ("1. Work Organization", C_CARD_BLUE, "Boards, Lists & Tasks", [
            "• High-performance Kanban board with drag-and-drop",
            "• statusKey atomic sync eliminating status drift",
            "• 3-tier density toggles (compact/cozy/comfortable) & Cmd+K"
        ]),
        ("2. Access & Audit Trail", C_CARD_PURPLE, "RBAC & Governance", [
            "• 4-tier RBAC: Owner, Admin, Member, Viewer",
            "• requireRole middleware protecting mutating APIs",
            "• Cursor-paginated Activity Drawer with 186 events & undo toasts"
        ]),
        ("3. Schedule Visibility", C_CARD_GREEN, "Pure CPM & Gantt", [
            "• Pure topological sort, forward/backward pass & float",
            "• Single-SVG Gantt timeline with zoom levels (Day/Week/Month)",
            "• Ranked activity-on-node PERT diagram with convergence rings"
        ]),
        ("4. Effort Visibility", C_CARD_AMBER, "Time vs Estimates", [
            "• Quick-log popover (15m, 30m, 1h, 2h) & custom entry ledger",
            "• Estimate progress bars with green/amber/red overrun states",
            "• 4-week team capacity heatmap against 40h standard baseline"
        ]),
        ("5. Flow Analytics", C_CARD_ROSE, "Sprint Performance", [
            "• Ideal vs actual sprint burndown with scope creep steps",
            "• 4-sprint velocity trend with 3-sprint rolling average",
            "• p50/p85 cycle time percentiles & Cumulative Flow (CFD)"
        ]),
        ("6. Fact-Grounded AI", C_CARD_WHITE, "Advisory Intelligence", [
            "• Pre-aggregated Mongoose facts prompt with locked metrics",
            "• Work breakdown assistant bounded to 3-7 subtasks <= 8h",
            "• Deterministic offline fallback & zero hallucination risk"
        ])
    ]
    for idx, (title, color, sub, bullets) in enumerate(commitments):
        r = idx // 3
        col = idx % 3
        c = add_card(s3, 0.8 + col * (col3_w + gap3), y0 + r * (row_h + gap_y), col3_w, row_h, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, subtitle=sub, title_size=14, body_size=10)

    # =========================================================================
    # SLIDE 4: SYSTEM ARCHITECTURE & DATA FLOW
    # =========================================================================
    s4 = prs.slides.add_slide(layout)
    add_header(s4, "SYSTEM ARCHITECTURE", "End-to-End Technology Stack & Architecture", "A clean full-stack decoupling with dedicated algorithmic services")

    c4_1 = add_card(s4, 0.8, y_split, col3_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c4_1, "Frontend Client", [
        "• Framework: Next.js 15 App Router + React 19",
        "• State & Data: React Context, Hooks, Axios",
        "• Styling: Tailwind CSS + CSS Token Dark/Light Themes",
        "• Visualization: Recharts (Flow/Health) + Bespoke Single-SVG (Gantt, PERT & Risk Views)",
        "• Productivity UX: cmdk Command Palette, Sonner toasts, keyboard shortcuts modal (?)"
    ], subtitle="Modern, Low-Latency Web App", tag="Client Layer", body_size=10.5)

    c4_2 = add_card(s4, 0.8 + col3_w + gap3, y_split, col3_w, h_split, bg_color=C_CARD_GREEN, border_color=C_BORDER_SUBTLE)
    populate_card(c4_2, "Backend & API Gateway", [
        "• Server: Node.js + Express 5 REST API",
        "• Real-Time Bus: Socket.io room-based card movement sync",
        "• Auth & RBAC: JWT authentication + requireRole middleware",
        "• Algorithmic Core: Pure CPM engine & Monte Carlo simulator (topological sort, float, cycle check; 0 DB imports)",
        "• Aggregations: 6 high-performance Mongoose aggregation pipelines"
    ], subtitle="Stateless RESTful Microservices", tag="Backend Layer", body_size=10.5)

    c4_3 = add_card(s4, 0.8 + (col3_w + gap3) * 2, y_split, col3_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c4_3, "Data & AI Layer", [
        "• Database: MongoDB with Mongoose 8 ORM",
        "• 9 Core Schemas: Task, List, Sprint, Dependency, StatusHistory, TimeEntry, ActivityLog, AlertState, TaskEstimate",
        "• Seed Engine: Deterministic Mulberry32 PRNG (68 tasks, 4 sprints, 186 history transitions)",
        "• AI Integration: Groq Llama-3 70B JSON mode with facts-first verification and offline fallback"
    ], subtitle="Document Store & Inference", tag="Persistence & AI", body_size=10.5)

    # =========================================================================
    # SLIDE 5: DATA INTEGRITY & STATUSKEY SYNCHRONIZATION
    # =========================================================================
    s5 = prs.slides.add_slide(layout)
    add_header(s5, "DATA MODELING", "Eliminating Status Drift in Agile Workspaces", "Solving the structural disconnect between board columns and task status")

    c5_l = add_card(s5, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_ROSE, border_color=C_BORDER_SUBTLE)
    populate_card(c5_l, "The Status Drift Dilemma", [
        "• The Root Problem: Standard Kanban boards store both a column ID (`list`) and a `status` enum ('todo', 'in-progress', 'done').",
        "• The Inconsistency: When drag-and-dropping a card between columns, naive systems update `list` while leaving `status` untouched.",
        "• Critical Analytic Failure: Cards resting in 'Done' columns retain 'todo' statuses. Burndown charts, velocity trends, and cumulative flow diagrams become completely incorrect.",
        "• Security Finding Fixed: Initial repository had no board authorization check on card movements, allowing any user to move any card on any board."
    ], subtitle="Architectural Analysis of Agile Board Failure", tag="Identified Defect", body_size=11)

    c5_r = add_card(s5, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_GREEN, border_color=C_BORDER_SUBTLE)
    populate_card(c5_r, "PulseBoard's Atomic Synchronization Solution", [
        "• Single Source of Truth: Added `statusKey` enum to the List schema (`todo`, `in-progress`, `done`).",
        "• Atomic State Transition: `moveTaskToList` reads the destination list's `statusKey` and updates both `task.list` and `task.status` in one atomic operation.",
        "• Immutable Audit Trail: Simultaneously appends a record to `TaskStatusHistory` and logs an `ActivityLog` event.",
        "• Strict Authorization: Verified board membership before processing any card drag or status update.",
        "• Unbreakable Flow Analytics: Burndown, CFD, and cycle time all derive from a single unified status truth."
    ], subtitle="Atomic Operations & Guaranteed Analytic Consistency", tag="Engineered Solution", body_size=11)

    # =========================================================================
    # SLIDE 6: PURE CPM SCHEDULING ENGINE — THEORY & MATHEMATICS
    # =========================================================================
    s6 = prs.slides.add_slide(layout)
    add_header(s6, "SCHEDULE MANAGEMENT", "Critical Path Method: Mathematical Engine", "Pure functional scheduling engine decoupled from database storage")

    p6_cards = [
        ("1. Topological Sort", C_CARD_BLUE, [
            "• Graph Model: Tasks as vertices (V), dependencies as directed edges (E).",
            "• Kahn's Algorithm: Computes in-degree counts; iterates via zero in-degree queue.",
            "• Pure Function: Zero database imports. Runs in linear O(V + E) time.",
            "• Unit-Tested: Passes deterministic test suite in <2ms."
        ]),
        ("2. Forward & Backward Pass", C_CARD_GREEN, [
            "• Forward Pass (Earliest Start/Finish):",
            "  ES_i = max(EF_p for p in Pred(i)), with ES_start = 0",
            "  EF_i = ES_i + Duration_i",
            "• Backward Pass (Latest Start/Finish):",
            "  LF_i = min(LS_s for s in Succ(i)), with LF_end = Total Duration",
            "  LS_i = LF_i - Duration_i"
        ]),
        ("3. Float & Critical Path", C_CARD_AMBER, [
            "• Total Float Formula:",
            "  TF_i = LS_i - ES_i = LF_i - EF_i",
            "• Zero-Float Invariant:",
            "  Tasks with TF_i = 0 lie on the Critical Path.",
            "• Delivery Reality:",
            "  Any delay on a zero-float task directly delays the entire project completion date."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p6_cards):
        c = add_card(s6, 0.8 + idx * (col3_w + gap3), y_split, col3_w, h_split, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 7: GRAPH INTEGRITY & REAL-TIME CYCLE DETECTION
    # =========================================================================
    s7 = prs.slides.add_slide(layout)
    add_header(s7, "GRAPH INTEGRITY", "DAG Deadlock Prevention & Cycle Detection", "Preventing cyclic dependency deadlocks with real-time Kahn validation")

    c7_l = add_card(s7, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_ROSE, border_color=C_BORDER_SUBTLE)
    populate_card(c7_l, "The Cyclic Deadlock Hazard", [
        "• Logical Contradiction: If Task A depends on Task B, B depends on C, and C is linked to depend on A (A -> B -> C -> A), tasks await their own completion.",
        "• Algorithmic Failure: In scheduling engines, cycles cause infinite loops or crash longest-path calculations.",
        "• Project Failure: In agile teams, circular blockers freeze workstreams without clear root-cause identification."
    ], subtitle="Why Circular Dependencies Paralyze Scheduling", tag="Risk Analysis", body_size=11)

    c7_r = add_card(s7, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c7_r, "Kahn's Validation & HTTP 409 Conflict", [
        "• Pre-Commit Edge Testing: Before saving any dependency edge, the controller builds a hypothetical graph.",
        "• Real-Time Cycle Detection: Runs Kahn's algorithm in O(V + E). If processed nodes < total nodes, a cycle exists.",
        "• CycleError Chain Generation: Traverses reverse adjacency pointers to extract the exact cycle path ('Task A -> Task B -> Task A').",
        "• HTTP 409 Conflict: Aborts database write cleanly and returns 409 with the cycle chain JSON.",
        "• UI Warning Alert: Task detail modal catches the 409 and displays a red warning banner explaining the topological violation."
    ], subtitle="Proactive Server-Side Graph Integrity", tag="Engineered Solution", body_size=11)

    # =========================================================================
    # SLIDE 8: INTERACTIVE TIMELINE & SINGLE-SVG GANTT
    # =========================================================================
    s8 = prs.slides.add_slide(layout)
    add_header(s8, "SCHEDULE VISUALIZATION", "Bespoke Single-SVG Gantt Timeline", "High-performance vector timeline without heavy third-party canvas overhead")

    p8_cards = [
        ("Pure Vector Architecture", C_CARD_BLUE, [
            "• Zero 3rd-Party Canvas Overhead: Entire Gantt rendered in a single high-performance <svg> element.",
            "• 60fps Native Scrolling: Native CSS overflow-x scrolling eliminates sluggish per-frame canvas redraw loops.",
            "• Dynamic Zoom Scales: Smooth toggle between Day, Week, and Month coordinate grids."
        ]),
        ("Critical Path Highlighting", C_CARD_ROSE, [
            "• Shared Critical Path Toggle: One-click switch instantly illuminates the zero-float critical path.",
            "• Distinct Color Coding: Critical tasks colored in high-visibility Ruby Red; non-critical tasks in Pulse Violet.",
            "• Visual Bezier Curves: Smooth SVG connector arrows linking predecessor finishes to successor starts."
        ]),
        ("Interactive Schedule Inspection", C_CARD_AMBER, [
            "• Visual Float Badges: Cards visually display exact float buffer (e.g. '3d slack').",
            "• Node Click Modal: Clicking any timeline bar opens the CPM inspector showing ES, EF, LS, LF, and float days.",
            "• Jump to Detail: Direct action opens task detail modal to modify duration or dependencies live."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p8_cards):
        c = add_card(s8, 0.8 + idx * (col3_w + gap3), y_split, col3_w, h_split, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 9: ACTIVITY-ON-NODE PERT NETWORK VIEW
    # =========================================================================
    s9 = prs.slides.add_slide(layout)
    add_header(s9, "PERT NETWORK", "Activity-on-Node Dependency Network", "Visualizing parallelism and integration choke points via ranked depth layout")

    c9_l = add_card(s9, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c9_l, "Canonical 6-Cell PERT Node Format", [
        "• Classical Engineering Standard: Replaces generic cards with canonical PERT activity boxes.",
        "• Top Row: Earliest Start (ES) on left, Earliest Finish (EF) on right.",
        "• Bottom Row: Latest Start (LS) on left, Latest Finish (LF) on right.",
        "• Center & Corner: Task title centered, Total Float (TF) badge in the top-right corner.",
        "• Instant Verification: Evaluators inspect all five CPM parameters from live data at a single glance."
    ], subtitle="Classical Project Controls Standard", tag="Node Anatomy", body_size=11)

    c9_r = add_card(s9, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_GREEN, border_color=C_BORDER_SUBTLE)
    populate_card(c9_r, "Ranked Depth Layout & Convergence Rings", [
        "• Ranked Depth Ordering: Nodes arranged from left to right strictly by dependency depth (longest-path distance from root), NOT calendar date.",
        "• True Parallelism Visible: Demonstrates concurrent workstreams that can execute in parallel.",
        "• Convergence Ring Alerts: Nodes with 3+ incoming dependency edges are ringed in amber to highlight high-risk integration choke points.",
        "• Critical Path Glow: Toggle highlights the critical sequence driving the project delivery date."
    ], subtitle="Topological Depth Ranking", tag="Visual Intelligence", body_size=11)

    # =========================================================================
    # SLIDE 10: PROBABILISTIC PERT & MONTE CARLO SIMULATION
    # =========================================================================
    s10 = prs.slides.add_slide(layout)
    add_header(s10, "PROBABILISTIC SCHEDULING", "Three-Point PERT & Monte Carlo Simulation", "Empirical risk modeling capturing merge bias and delivery confidence")

    c10_l = add_card(s10, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c10_l, "Analytical Three-Point PERT Theory", [
        "• Triplet Estimates: Captures optimistic (a), most likely (m), and pessimistic (b) durations.",
        "• Expected Duration Formula: E = (a + 4m + b) / 6 based on Beta distribution.",
        "• Task Variance: Var = sigma^2 = ((b - a) / 6)^2 reflecting estimation uncertainty.",
        "• Project Critical Variance: Var_proj = sum(Var_i for i in CriticalPath).",
        "• Normal CDF Confidence: Evaluates delivery confidence (50%, 75%, 85%, 95%) using Z-score quantiles."
    ], subtitle="Probabilistic Risk & Estimation Uncertainty", tag="Analytical Model", body_size=10.5)

    c10_r = add_card(s10, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_AMBER, border_color=C_BORDER_SUBTLE)
    populate_card(c10_r, "Monte Carlo Simulation Engine", [
        "• Empirical Sampling: Runs 1,000 to 10,000 iterations drawing task durations from Beta-PERT / Triangular distributions.",
        "• Criticality Index: Measures the exact percentage of iterations where a task became critical (identifies near-critical risks).",
        "• Merge Bias Capture: Accurately reflects how parallel independent paths increase overall project delay risk (which analytical CPM ignores).",
        "• Dedicated Risk View: Interactive histogram, cumulative probability S-curve, and deadline percentile target sliders in `/board/:id/risk`."
    ], subtitle="10,000-Iteration Empirical Simulation", tag="Simulation Engine", body_size=10.5)

    # =========================================================================
    # SLIDE 11: INTERACTIVE DEPENDENCY & EFFORT LOGGING SURFACE
    # =========================================================================
    s11 = prs.slides.add_slide(layout)
    add_header(s11, "EFFORT & DEPENDENCY CONTROLS", "Task-Level Controls & Effort Accounting", "Granular dependency management and real-time variance detection inside task cards")

    c11_l = add_card(s11, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c11_l, "Interactive Dependency & CPM Controls", [
        "• Predecessor & Successor Lists: Displays blocking dependencies and downstream dependent tasks directly inside TaskDetailModal.",
        "• Live Dropdown Linking: Add predecessor dropdown calling POST /api/boards/:id/dependencies with instant cycle prevention check.",
        "• On-Card CPM Stats: Automatically displays computed ES, EF, LS, LF, and Float duration on the task.",
        "• Critical Path Badge: Clear visual tag indicating whether the task sits on the Critical Path (Zero Slack)."
    ], subtitle="Modal-Driven Dependency Management", tag="Dependency Surface", body_size=11)

    c11_r = add_card(s11, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_GREEN, border_color=C_BORDER_SUBTLE)
    populate_card(c11_r, "Time Logging & Dynamic Variance Bar", [
        "• Quick-Log Presets: One-click logging for 15 min, 30 min, 1 hour, or 2 hours with optional contextual notes.",
        "• Immutable Audit Ledger: Every entry creates a TimeEntry document recording author, date, duration, and context.",
        "• Estimate vs Actual Progress Bar:",
        "  - Green: Healthy progress (<80% of estimate used)",
        "  - Amber: Approaching threshold (80-100%)",
        "  - Red Overrun: Overrun condition (>100% used), warning team of effort creep.",
        "• Retrospective Calibration: Calibrates developer estimation accuracy in retrospective reviews."
    ], subtitle="Effort Variance & Timesheet Ledger", tag="Effort Accounting", body_size=10.5)

    # =========================================================================
    # SLIDE 12: 4-WEEK TEAM CAPACITY HEATMAP
    # =========================================================================
    s12 = prs.slides.add_slide(layout)
    add_header(s12, "CAPACITY MANAGEMENT", "4-Week Team Capacity Heatmap", "Workload benchmarking against standard 40h capacity baseline to prevent team burnout")

    c12_l = add_card(s12, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c12_l, "Workload Benchmarking against 40h Baseline", [
        "• Member-by-Member Aggregation: Aggregates total assigned story points and logged hours across all active board members.",
        "• 4-Week Rolling Projection: Maps developer allocation across four consecutive sprint weeks.",
        "• 40-Hour Sustainable Threshold: Benchmarks workload against standard 40 hours/week developer capacity.",
        "• Burnout Prevention: Flags team members who are systematically over-allocated before release deadlines approach."
    ], subtitle="Sustainable Sprint Workload Management", tag="Capacity Model", body_size=11)

    c12_r = add_card(s12, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_AMBER, border_color=C_BORDER_SUBTLE)
    populate_card(c12_r, "Color-Coded Heatmap & Task Inspector", [
        "• High-Contrast Color Tiers:",
        "  - Under-Allocated: Soft neutral (<20h workload)",
        "  - Healthy Balance: Emerald green (20h - 40h workload)",
        "  - Capacity Overrun: Vibrant coral/red (>40h over-allocated)",
        "• Interactive Hover Popovers: Hovering any developer's weekly cell displays exact task titles and hourly distribution.",
        "• Read-Only Discipline: Displays computed allocations without writing back to task assignees, maintaining pure data separation."
    ], subtitle="Actionable Capacity Visualization", tag="Visual Feedback", body_size=11)

    # =========================================================================
    # SLIDE 13: SPRINT BURNDOWN & HISTORICAL VELOCITY
    # =========================================================================
    s13 = prs.slides.add_slide(layout)
    add_header(s13, "FLOW ANALYTICS", "Sprint Burndown & Historical Velocity", "Empirical delivery predictability driven by TaskStatusHistory aggregations")

    c13_l = add_card(s13, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_ROSE, border_color=C_BORDER_SUBTLE)
    populate_card(c13_l, "Sprint Burndown with Scope Steps", [
        "• Ideal Burndown Line: Linear mathematical path from initial committed story points to zero on sprint end.",
        "• Actual Burndown Curve: Daily remaining story points computed via Mongoose TaskStatusHistory aggregations.",
        "• Scope Creep Visualization: Mid-sprint task additions appear as distinct upward steps on the curve, immediately revealing unplanned scope injection.",
        "• Sprint Switcher Control: URL-persisted segmented control to inspect past and active sprints."
    ], subtitle="Daily Milestone Progress Tracking", tag="Burndown Curve", body_size=11)

    c13_r = add_card(s13, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_GREEN, border_color=C_BORDER_SUBTLE)
    populate_card(c13_r, "4-Sprint Velocity Trend & Rolling Average", [
        "• Committed vs Completed: Stacked bar chart comparing committed story points vs delivered points across 4 sprints.",
        "• Rolling 3-Sprint Average: Computes running velocity average line, smoothing out seasonal anomalies and vacation dips.",
        "• Predictable Commitment: Empowers product owners to commit to realistic sprint scope based on empirical team delivery capacity rather than wishful thinking."
    ], subtitle="Empirical Team Delivery Predictability", tag="Velocity Calibration", body_size=11)

    # =========================================================================
    # SLIDE 14: CYCLE TIME PERCENTILES & CUMULATIVE FLOW (CFD)
    # =========================================================================
    s14 = prs.slides.add_slide(layout)
    add_header(s14, "FLOW ANALYTICS", "Cycle Time Percentiles & Cumulative Flow", "Statistical SLA benchmarks and visual bottleneck identification via Little's Law")

    c14_l = add_card(s14, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c14_l, "Cycle Time Scatter & SLA Percentiles", [
        "• Pure Status Timing: Measures exact duration each task spent between 'in-progress' and 'done' using TaskStatusHistory timestamps.",
        "• Percentile Benchmarking: Avoids misleading averages by computing p50 (median), p85, and p95 percentiles.",
        "• Actionable SLA Targets: '85% of our tasks complete in under 4.2 days', giving stakeholders realistic delivery expectations.",
        "• Outlier Detection: Identifies stranded cards that suffered prolonged blockage."
    ], subtitle="Statistical Lead & Cycle Time Analysis", tag="SLA Benchmarking", body_size=11)

    c14_r = add_card(s14, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c14_r, "Cumulative Flow Diagram (CFD)", [
        "• Daily Stacked Area Chart: Visualizes the distribution of tasks in 'todo', 'in-progress', and 'done' over time.",
        "• Bottleneck Identification: A widening 'in-progress' band immediately exposes downstream bottlenecks (e.g. testing/code review starvation).",
        "• Little's Law Application: Visualizes the direct mathematical relationship between Work In Progress (WIP), Cycle Time, and Throughput.",
        "• Process Stability: Parallel smooth bands verify a stable, predictable workflow."
    ], subtitle="Bottleneck Identification via Area Bands", tag="Workflow Stability", body_size=11)

    # =========================================================================
    # SLIDE 15: REAL-TIME DELIVERY HEALTH ENGINE
    # =========================================================================
    s15 = prs.slides.add_slide(layout)
    add_header(s15, "DELIVERY HEALTH", "6 Real-Time Delivery Health Indicators", "Automated status tiles continuously monitoring schedule, effort, and WIP risks")

    health_tiles = [
        ("1. Scope Creep %", C_CARD_ROSE, [
            "• Percentage of story points added mid-sprint after sprint planning.",
            "• Flags delivery risk when scope expands beyond 15%."
        ]),
        ("2. WIP Cap Breach", C_CARD_AMBER, [
            "• Tracks active cards in 'in-progress' against column WIP limit.",
            "• Prevents multi-tasking drag and context-switching churn."
        ]),
        ("3. Hours Variance", C_CARD_BLUE, [
            "• Aggregate variance between estimated hours and logged time.",
            "• Identifies systematic team-wide underestimation trends."
        ]),
        ("4. Blocked Critical Path", C_CARD_PURPLE, [
            "• Live count of critical path tasks currently blocked.",
            "• Highest urgency indicator for project managers."
        ]),
        ("5. Unestimated Ratio", C_CARD_GREEN, [
            "• Percentage of tasks lacking story points or hour estimates.",
            "• Enforces estimation hygiene before sprint kickoff."
        ]),
        ("6. Sprint Days Left", C_CARD_WHITE, [
            "• Active countdown to sprint review and retrospective.",
            "• Synchronized with sprint start and end dates."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(health_tiles):
        r = idx // 3
        col = idx % 3
        c = add_card(s15, 0.8 + col * (col3_w + gap3), y0 + r * (row_h + gap_y), col3_w, row_h, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, title_size=14, body_size=10)

    # =========================================================================
    # SLIDE 16: FACT-GROUNDED AI INSIGHTS & DIGEST
    # =========================================================================
    s16 = prs.slides.add_slide(layout)
    add_header(s16, "AI INSIGHTS", "Fact-Grounded AI Delivery Digest & Breakdown", "Eliminating LLM hallucination through server-computed ground truth facts")

    c16_l = add_card(s16, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c16_l, "Fact-Grounded AI Delivery Digest", [
        "• The Hallucination Problem: Generic AI prompts fabricate sprint numbers, invent completion rates, and hallucinate delivery dates.",
        "• Facts-First Architecture: Backend Mongoose service computes verified facts first: exact scope creep %, WIP breaches, hours variance, critical path tasks.",
        "• Constrained JSON Prompt: Ground-truth JSON fed into Groq Llama-3 in strict JSON mode.",
        "• Server Overwrite Protection: Backend server explicitly inspects the AI output and overwrites any metrics array with computed ground truth.",
        "• Offline Fallback: Fully functional deterministic heuristics if offline or LLM unavailable."
    ], subtitle="Mathematically Anchored LLM Insights", tag="Delivery Digest", body_size=10.5)

    c16_r = add_card(s16, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c16_r, "Constrained AI Work Breakdown Assistant", [
        "• Empty Body Rule: Accepts empty POST body; reads only existing database card title and description to prevent prompt injection.",
        "• Subtask Count Guard: Strictly enforces between 3 and 7 subtasks via Zod schema validation.",
        "• Duration Guard: Every proposed subtask estimate must be <= 8 hours (under one working day).",
        "• Human-in-the-Loop Review: Proposals presented with checkboxes in TaskDetailModal; developers selectively insert approved subtasks.",
        "• Automated Unit Tests: breakdown.test.js passes 100% across all constraints."
    ], subtitle="Rigorous Structural Bounds on Generative AI", tag="Work Breakdown", body_size=10.5)

    # =========================================================================
    # SLIDE 17: WORKSPACE UX, ERGONOMICS & STAT RAIL
    # =========================================================================
    s17 = prs.slides.add_slide(layout)
    add_header(s17, "WORKSPACE ERGONOMICS", "Kanban Board UX, Filters & Productivity", "Frictionless developer workspace with keyboard-first navigation and density controls")

    p17_cards = [
        ("HTML5 Drag-and-Drop", C_CARD_BLUE, [
            "• Fast Responsive Movement: Zero drag lag; instant visual column drop target indicators.",
            "• Atomic Column Moves: Cards move smoothly across lists with immediate UI updates and background synchronization.",
            "• Inline Quick Create: Inline task addition at the bottom of any list column."
        ]),
        ("Multi-Dimensional Filters", C_CARD_GREEN, [
            "• Multi-Filter Bar: Filter board cards by Assignee, Priority (Urgent/High/Medium/Low), and Overdue.",
            "• Blocked Dependency Filter: One-click filter highlighting tasks currently blocked by predecessors.",
            "• URL-Persisted State: Filter parameters reflected in URL for bookmarking and team sharing."
        ]),
        ("Density & Productivity Rail", C_CARD_AMBER, [
            "• 3-Tier Density Switcher: Compact, Cozy, and Comfortable layouts adapting to dense developer scrums.",
            "• Board Stat Rail: Sits directly under the header showing active sprint days left, committed points, and 60px SVG sparkline.",
            "• Command Palette (Cmd+K): Instant keyboard fuzzy task search, view navigation, and shortcut helper (?)."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p17_cards):
        c = add_card(s17, 0.8 + idx * (col3_w + gap3), y_split, col3_w, h_split, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 18: SECURITY, RBAC & REAL-TIME COLLABORATION
    # =========================================================================
    s18 = prs.slides.add_slide(layout)
    add_header(s18, "SECURITY & COLLABORATION", "4-Tier RBAC, Audit Trail & Live Sync", "Enterprise-grade access governance and real-time Socket.io collaborative bus")

    c18_l = add_card(s18, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_PURPLE, border_color=C_BORDER_SUBTLE)
    populate_card(c18_l, "4-Tier Role-Based Access Control", [
        "• Role Hierarchy: Owner (Full control), Admin (Manage lists/members/sprints), Member (Create/edit/move tasks), Viewer (Read-only access).",
        "• Gateway Middleware: `requireRole` protects administrative routes, returning 403 Forbidden on violations.",
        "• Self-Explaining UI: Viewer accounts see clean, disabled controls with tooltip explanations.",
        "• Members Panel: Role badges, owner crown, and interactive permission matrix modal.",
        "• JWT Authentication: Token-based sessions with bcrypt password hashing."
    ], subtitle="Enterprise Security Governance", tag="Access Control", body_size=10.5)

    c18_r = add_card(s18, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c18_r, "Activity Feed, Rollback & Socket.io Sync", [
        "• Cursor-Paginated Drawer: High-performance infinite scroll activity log tracking card moves, time logs, and status transitions.",
        "• Rollback Undo Toasts: Dragging a card triggers a toast notification with an 'Undo' action that reverts the task move immediately.",
        "• Socket.io Real-Time Synchronization: Instant multi-user card drag synchronization without page reloads.",
        "• Delivery Webhook Alerts: Background alert engine dispatches automated notifications for WIP cap breaches and critical path delay.",
        "• Executive Report Exports: One-click CSV and structured report exports for management reviews."
    ], subtitle="Audit Trail & Live Collaboration", tag="Collaboration", body_size=10.5)

    # =========================================================================
    # SLIDE 19: QUALITY ASSURANCE & VERIFICATION
    # =========================================================================
    s19 = prs.slides.add_slide(layout)
    add_header(s19, "TESTING & QA", "Automated Test Suite & Build Verification", "Comprehensive verification across mathematical algorithms, builds, and seeds")

    p19_cards = [
        ("Unit Test Suite (24/24 Passing)", C_CARD_GREEN, [
            "• CPM Mathematics: Forward/backward pass, ES/EF/LS/LF calculations verified.",
            "• CycleError Chain: Kahn algorithm cycle detection and error string verified.",
            "• Monte Carlo Simulator: Beta-PERT sampling, criticality index & percentiles verified.",
            "• AI Breakdown Constraints: 3-7 subtask count and <=8h duration bounds verified."
        ]),
        ("Next.js Production Build", C_CARD_BLUE, [
            "• Zero Compilation Errors: ✓ Compiled successfully in 7.0s.",
            "• 8 Production Routes: Optimized static pages and dynamic server-rendered routes.",
            "• Strict Type & Syntax Validation: Free of hydration mismatch warnings or deprecated API calls.",
            "• Windows Path Bug Fixed: Reorganized favicon assets to prevent Windows apostrophe path crashes."
        ]),
        ("Deterministic Mulberry32 Seeder", C_CARD_AMBER, [
            "• Reproducible 90-Day History: Seeds identical realistic distributions on any machine.",
            "• 68 Tasks Across 5 Columns: Realistic priorities, estimates, and assignees.",
            "• 4 Sprints (3 Closed, 1 Active): Generates realistic burndown and velocity curves.",
            "• 186 Status Transitions & 109 Time Logs: Powers immediate real-time flow charts."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p19_cards):
        c = add_card(s19, 0.8 + idx * (col3_w + gap3), y_split, col3_w, h_split, bg_color=color, border_color=C_BORDER_SUBTLE)
        populate_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 20: LIVE DEMO PROTOCOL & ACADEMIC CONCLUSION
    # =========================================================================
    s20 = prs.slides.add_slide(layout)
    add_header(s20, "DEMO & CONCLUSION", "Evaluator Live Demo Protocol & Conclusions", "Structured 7-minute demonstration path and software project management takeaways")

    c20_l = add_card(s20, 0.8, y_split, col2_w, h_split, bg_color=C_CARD_BLUE, border_color=C_BORDER_SUBTLE)
    populate_card(c20_l, "7-Minute Live Demonstration Protocol", [
        "• 0:00 - Board Canvas & Stat Rail: Show sprint days left, committed points, blocked cards, and sparkline.",
        "• 0:40 - AI Delivery Digest: Review fact-grounded sprint summary, locked metrics, and risk assessment.",
        "• 1:30 - 6 Health Tiles: Demonstrate Scope Creep %, WIP limit breach, and hours variance.",
        "• 2:20 - Burndown & Velocity: Toggle past sprints with switcher; review p50/p85 cycle time percentiles.",
        "• 3:10 - Critical Path & Timeline: Flip Critical Path switch to illuminate Ruby Red zero-float tasks.",
        "• 3:40 - Ranked PERT Diagram: Show 6-cell boxes, ranked depth layout, and convergence rings.",
        "• 4:20 - Log Effort & Heatmap: Log 30 min on task; view estimate progress bar and 40h capacity heatmap.",
        "• 5:05 - Activity Drawer & Revert: Drag card; inspect activity drawer; click toast 'Undo' to revert.",
        "• 5:50 - AI Breakdown & Cycle Prevention: Break down card with AI assistant; test cycle prevention alert.",
        "• 6:35 - Productivity & Theme: Open Cmd+K palette; demonstrate light/dark mode theme toggle."
    ], subtitle="Step-by-Step Evaluator Walkthrough", tag="Demo Script", body_size=9.5)

    c20_r = add_card(s20, 0.8 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_WHITE, border_color=C_BORDER_SUBTLE)
    populate_card(c20_r, "Academic Conclusions & References", [
        "• Core Finding: Small agile teams do not need enterprise Jira bloat to achieve schedule predictability. Embedding classical CPM, empirical percentiles, and capacity heatmaps into lightweight boards delivers rigorous project control with zero friction.",
        "• Autonomy with Accountability: Automated state-derived metrics replace manual status reports, maintaining developer autonomy while providing stakeholders always-on delivery visibility.",
        "• [1] Y. Lindsjørn et al., 'Teamwork quality and project success in software development: A survey of agile teams', J. Syst. Softw., 2016.",
        "• [2] S. Y. Chadli et al., 'Software project management tools in global software development: a systematic mapping study', SpringerPlus, 2016.",
        "• [3] A. Radhakrishnan et al., 'The impact of project team characteristics on project agility: An empirical study', Eur. Manag. J., 2022.",
        "• [4] Atlassian, 'Jira project management template', 2026."
    ], subtitle="Software Project Management Takeaways", tag="Conclusions & Literature", body_size=9.5)

    out_file = "PulseBoard_Final_Defense.pptx"
    prs.save(out_file)
    print(f"Successfully generated clean 20-slide modern presentation: {out_file}")

if __name__ == "__main__":
    build_20_slide_deck()
