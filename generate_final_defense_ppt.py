import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# --- COLOR PALETTE (Exact match to initial PulseBoard PPT) ---
C_NAVY_TITLE = RGBColor(0x2E, 0x3C, 0x4E)   # Dark Charcoal/Navy for Main Titles
C_INK_BODY   = RGBColor(0x38, 0x46, 0x53)   # Dark Slate for Body
C_PILL_BG    = RGBColor(0xD5, 0xED, 0xF6)   # Light Cyan Pill
C_PILL_TXT   = RGBColor(0x2E, 0x3C, 0x4E)   # Pill Text
C_LINE       = RGBColor(0x38, 0x46, 0x53)   # Accent line

# Card Pastels
C_PASTEL_BLUE   = RGBColor(0xAF, 0xCB, 0xF8) # Soft Blue
C_PASTEL_GREEN  = RGBColor(0xD9, 0xE8, 0xD6) # Soft Green
C_PASTEL_PURPLE = RGBColor(0xD8, 0xAF, 0xF8) # Soft Purple
C_PASTEL_YELLOW = RGBColor(0xFC, 0xEC, 0x99) # Soft Yellow
C_PASTEL_ROSE   = RGBColor(0xFA, 0xA1, 0xA1) # Soft Rose
C_CARD_NEUTRAL  = RGBColor(0xF8, 0xF9, 0xFA) # Light Neutral Card
C_BORDER_LIGHT  = RGBColor(0xE4, 0xE4, 0xE7) # Neutral Border

# Brand Highlight
C_BRAND_PURPLE  = RGBColor(0x54, 0x16, 0xE0) # Pulse Violet

FONT_HEADING = 'Barlow Bold'
FONT_BODY    = 'Montserrat'
FONT_BOLD    = 'Montserrat Bold'

def create_base_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    return prs

def get_blank_layout(prs):
    return prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[0]

def add_header(slide, category_tag, slide_title):
    # Category Pill
    pill_width = Inches(max(1.4, len(category_tag) * 0.12 + 0.5))
    pill = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(0.69), Inches(0.52), pill_width, Inches(0.28)
    )
    pill.fill.solid()
    pill.fill.fore_color.rgb = C_PILL_BG
    pill.line.fill.background()
    
    tf_p = pill.text_frame
    tf_p.word_wrap = False
    tf_p.margin_left = Inches(0.1)
    tf_p.margin_right = Inches(0.1)
    tf_p.margin_top = Inches(0.04)
    tf_p.margin_bottom = Inches(0.04)
    p = tf_p.paragraphs[0]
    p.text = category_tag.upper()
    p.font.name = FONT_BODY
    p.font.bold = True
    p.font.size = Pt(9)
    p.font.color.rgb = C_PILL_TXT

    # Slide Title
    tx_box = slide.shapes.add_textbox(Inches(0.69), Inches(0.88), Inches(11.95), Inches(0.72))
    tf = tx_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p_title = tf.paragraphs[0]
    p_title.text = slide_title
    p_title.font.name = FONT_HEADING
    p_title.font.bold = True
    p_title.font.size = Pt(31)
    p_title.font.color.rgb = C_NAVY_TITLE

def add_card(slide, left, top, width, height, bg_color=None, border_color=None, corner_radius=True):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if corner_radius else MSO_SHAPE.RECTANGLE
    card = slide.shapes.add_shape(shape_type, Inches(left), Inches(top), Inches(width), Inches(height))
    card.fill.solid()
    if bg_color:
        card.fill.fore_color.rgb = bg_color
    else:
        card.fill.fore_color.rgb = C_CARD_NEUTRAL
        
    if border_color:
        card.line.color.rgb = border_color
        card.line.width = Pt(1)
    else:
        card.line.fill.background()
    return card

def populate_text_card(card, title, bullets=[], subtitle=None, title_size=15, body_size=10.5, title_color=C_NAVY_TITLE):
    tf = card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.24)
    tf.margin_right = Inches(0.24)
    tf.margin_top = Inches(0.20)
    tf.margin_bottom = Inches(0.20)

    # Title
    p_title = tf.paragraphs[0]
    p_title.text = title
    p_title.font.name = FONT_HEADING
    p_title.font.bold = True
    p_title.font.size = Pt(title_size)
    p_title.font.color.rgb = title_color
    p_title.space_after = Pt(4)

    # Subtitle if present
    if subtitle:
        p_sub = tf.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.name = FONT_BOLD
        p_sub.font.size = Pt(body_size + 1)
        p_sub.font.color.rgb = C_INK_BODY
        p_sub.space_after = Pt(5)

    # Bullets
    for i, b in enumerate(bullets):
        p_b = tf.add_paragraph()
        p_b.text = b
        p_b.font.name = FONT_BODY
        p_b.font.size = Pt(body_size)
        p_b.font.color.rgb = C_INK_BODY
        p_b.space_after = Pt(3.5)
        p_b.level = 0

def build_deck():
    prs = create_base_presentation()
    layout = get_blank_layout(prs)

    # Reusable coordinate constants
    col2_w = 5.86
    gap2 = 0.22
    y_split = 1.80
    h_split = 5.15

    col3_w = 3.82
    gap3 = 0.24
    y_arch = 1.80
    h_arch = 5.15

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(layout)
    add_card(s1, 8.4, 0.6, 4.3, 6.3, bg_color=C_BRAND_PURPLE)
    
    tx_right = s1.shapes.add_textbox(Inches(8.65), Inches(0.9), Inches(3.8), Inches(5.7))
    tf_r = tx_right.text_frame
    tf_r.word_wrap = True
    p0 = tf_r.paragraphs[0]
    p0.text = "CORE PLATFORM MODULES"
    p0.font.name = FONT_HEADING
    p0.font.bold = True
    p0.font.size = Pt(13)
    p0.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    p0.space_after = Pt(10)

    badges = [
        ("Pure CPM & DAG Engine", "Topological sort, forward/backward pass, float & cycle detection"),
        ("Single-SVG Gantt & PERT", "Bespoke vector charts, zero DOM bloat, live critical-path highlights"),
        ("Monte Carlo PERT Simulation", "Three-point estimates, Beta-PERT probability & criticality index"),
        ("Mongoose Flow Analytics", "Real-time Burndown, Velocity trends, CFD, and Cycle Time SLAs"),
        ("Delivery Health Engine", "6 live KPI tiles: WIP limits, Scope creep, Hours variance"),
        ("Fact-Grounded AI Assist", "Digest with locked metrics & bounded subtask decomposition"),
        ("Socket.io Real-Time Sync", "Instant multi-user card drag synchronization & alert webhooks"),
        ("4-Tier RBAC & Governance", "JWT auth, granular roles, activity drawer & undo toasts")
    ]
    for b_title, b_desc in badges:
        p_bt = tf_r.add_paragraph()
        p_bt.text = f"•  {b_title}"
        p_bt.font.name = FONT_BOLD
        p_bt.font.bold = True
        p_bt.font.size = Pt(9.5)
        p_bt.font.color.rgb = RGBColor(0xD5, 0xED, 0xF6)
        
        p_bd = tf_r.add_paragraph()
        p_bd.text = f"   {b_desc}"
        p_bd.font.name = FONT_BODY
        p_bd.font.size = Pt(8.0)
        p_bd.font.color.rgb = RGBColor(0xEE, 0xEE, 0xFF)
        p_bd.space_after = Pt(4)

    # Left content: Main title & metadata
    tx_main = s1.shapes.add_textbox(Inches(0.69), Inches(1.0), Inches(7.3), Inches(5.8))
    tf_m = tx_main.text_frame
    tf_m.word_wrap = True
    
    p_pill = tf_m.paragraphs[0]
    p_pill.text = "FINAL PROJECT DEFENSE (25 MIN)"
    p_pill.font.name = FONT_BOLD
    p_pill.font.bold = True
    p_pill.font.size = Pt(11)
    p_pill.font.color.rgb = C_BRAND_PURPLE
    p_pill.space_after = Pt(4)

    p_t = tf_m.add_paragraph()
    p_t.text = "PulseBoard"
    p_t.font.name = FONT_HEADING
    p_t.font.bold = True
    p_t.font.size = Pt(46)
    p_t.font.color.rgb = C_NAVY_TITLE
    
    p_sub = tf_m.add_paragraph()
    p_sub.text = "From Task Board to Delivery Dashboard"
    p_sub.font.name = FONT_HEADING
    p_sub.font.bold = True
    p_sub.font.size = Pt(26)
    p_sub.font.color.rgb = C_NAVY_TITLE
    p_sub.space_after = Pt(4)

    p_tag = tf_m.add_paragraph()
    p_tag.text = "Measuring Schedule, Effort & Flow for Small Agile Teams"
    p_tag.font.name = FONT_BODY
    p_tag.font.size = Pt(13.5)
    p_tag.font.color.rgb = C_INK_BODY
    p_tag.space_after = Pt(12)

    p_c = tf_m.add_paragraph()
    p_c.text = "CS447: Software Project Management · Group 9"
    p_c.font.name = FONT_BOLD
    p_c.font.bold = True
    p_c.font.size = Pt(14.5)
    p_c.font.color.rgb = C_NAVY_TITLE
    p_c.space_after = Pt(8)

    authors = [
        "Shlok Kamlesh Chauhan (202351131)",
        "Tushar Shukla (202351149)",
        "Keshav Badaya (202351065)",
        "Mohli Thapa (202351084)"
    ]
    for auth in authors:
        p_a = tf_m.add_paragraph()
        p_a.text = f"•  {auth}"
        p_a.font.name = FONT_BODY
        p_a.font.size = Pt(11)
        p_a.font.color.rgb = C_INK_BODY
        p_a.space_after = Pt(2)

    # =========================================================================
    # SLIDE 2: CONTEXT & PROBLEM STATEMENT
    # =========================================================================
    s2 = prs.slides.add_slide(layout)
    add_header(s2, "CONTEXT & PROBLEM", "The Small-Team Agile Delivery Dilemma")
    
    c_q = add_card(s2, 0.69, 1.75, 11.95, 0.75, bg_color=C_PILL_BG)
    tf_q = c_q.text_frame
    tf_q.margin_left = Inches(0.2)
    tf_q.margin_top = Inches(0.10)
    p_q = tf_q.paragraphs[0]
    p_q.text = '"Small teams need simple tools to organize tasks and assign ownership, while maintaining clear, automated visibility into schedule slippage, effort distribution, and workflow bottlenecks without manual status reporting."'
    p_q.font.name = FONT_BODY
    p_q.font.italic = True
    p_q.font.size = Pt(11.5)
    p_q.font.color.rgb = C_NAVY_TITLE

    grid_w = 2.82
    gap = 0.22
    y_top = 2.70
    h_card = 4.25

    p2_data = [
        ("Bloated Workflows", C_PASTEL_PURPLE, [
            "Enterprise tools like Jira enforce complex backlog schemas and heavy ceremony.",
            "Small teams end up ignoring 80% of tool features, bypassing estimation completely.",
            "Rigid project configurations hinder team autonomy and agile adaptation."
        ]),
        ("Fragmented Tooling", C_PASTEL_BLUE, [
            "77% of SPM tools are standalone single-purpose silos (Chadli et al. 2016).",
            "Forces constant context switching across Trello, Google Sheets, Slack, and Excel.",
            "High friction leads to outdated spreadsheets and missing project tracking."
        ]),
        ("Invisible Schedule Risk", C_PASTEL_GREEN, [
            "Traditional Kanban boards track WHERE a task is, never WHEN it finishes.",
            "Critical path dependencies remain invisible until delivery dates are missed.",
            "Upstream task delays silently compound, causing sudden milestone failure."
        ]),
        ("Effort Guesswork", C_PASTEL_YELLOW, [
            "No connection between planned estimates and actual developer effort.",
            "Developer over-allocation (>40h/week) stays hidden, causing burnout.",
            "Sprint reviews lack empirical data to calibrate future team velocity."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p2_data):
        c = add_card(s2, 0.69 + idx * (grid_w + gap), y_top, grid_w, h_card, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 3: RESEARCH EVIDENCE & CITATIONS
    # =========================================================================
    s3 = prs.slides.add_slide(layout)
    add_header(s3, "RESEARCH EVIDENCE", "Academic Grounding & Industry Literature")
    
    p3_cards = [
        ("Classical Controls in Small Teams", C_PASTEL_BLUE, [
            "• Research Finding: Classical project-control techniques (CPM, PERT, slack analysis) are absent in modern lightweight tools (Chadli et al., 2016).",
            "• Industry Context: Tools like Trello optimize for drag ease; tools like Jira optimize for enterprise process compliance.",
            "• The Missing Middle: Small teams need schedule adherence and flow metrics embedded directly inside their everyday task cards."
        ]),
        ("Team Autonomy & Quality", C_PASTEL_GREEN, [
            "• Team Autonomy vs Project Agility: Team autonomy and collaboration are directly correlated with agile performance (Radhakrishnan et al., 2022).",
            "• Process Overhead Drag: Process-heavy systems suppress team agency and inflate overhead.",
            "• Quality Predictability: Teamwork quality and coordination are primary empirical predictors of software success (Lindsjørn et al., 2016)."
        ]),
        ("Empirical Metrics vs Guesswork", C_PASTEL_YELLOW, [
            "• Little's Law in Agile: Work In Progress (WIP) directly governs Lead Time. Uncontrolled WIP guarantees delayed releases.",
            "• Percentiles over Averages: Average cycle time masks severe outliers; p85 percentiles provide realistic SLA delivery dates.",
            "• PulseBoard Objective: Combine rigorous SPM metrics with zero-delay setup and frictionless developer ergonomics."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p3_cards):
        c = add_card(s3, 0.69 + idx * (col3_w + gap3), y_arch, col3_w, h_arch, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 4: THE 6 CORE COMMITMENTS (100% SHIPPED)
    # =========================================================================
    s4 = prs.slides.add_slide(layout)
    add_header(s4, "AIM & OBJECTIVES", "The 6 Core Commitments: 100% Shipped")
    
    row_h = 2.45
    col_w = 3.82
    gap_x = 0.24
    gap_y = 0.20
    y0 = 1.80

    commitments = [
        ("1. Work Organization", C_PASTEL_BLUE, [
            "• Full Kanban board with drag-and-drop movement",
            "• statusKey synchronization eliminating status drift",
            "• 3-tier density toggles & Cmd+K command palette"
        ]),
        ("2. Access & Audit Trail", C_PASTEL_PURPLE, [
            "• 4-tier RBAC: Owner, Admin, Member, Viewer",
            "• Cursor-paginated Activity Drawer with 186 events",
            "• Real-time rollback undo toast notifications"
        ]),
        ("3. Schedule Visibility", C_PASTEL_GREEN, [
            "• Pure Critical Path Method (CPM) scheduling engine",
            "• Interactive single-SVG Gantt chart with float badges",
            "• Ranked Activity-on-Node PERT network diagram"
        ]),
        ("4. Effort Visibility", C_PASTEL_YELLOW, [
            "• Quick-log time popover (15m, 30m, 1h, 2h)",
            "• Estimate progress bars with visual overrun warnings",
            "• 4-week team capacity heatmap against 40h benchmark"
        ]),
        ("5. Flow Visibility", C_PASTEL_ROSE, [
            "• Ideal vs actual sprint burndown with scope-step alerts",
            "• 4-sprint velocity trend with 3-sprint rolling average",
            "• Cycle time percentiles (p50/p85) & Cumulative Flow"
        ]),
        ("6. Fact-Grounded AI", C_CARD_NEUTRAL, [
            "• Delivery digest: metrics pre-calculated server-side",
            "• Code-enforced work breakdown: 3-7 subtasks <= 8h",
            "• Deterministic offline fallback & schema validation"
        ])
    ]
    for idx, (title, color, bullets) in enumerate(commitments):
        row = idx // 3
        col = idx % 3
        x = 0.69 + col * (col_w + gap_x)
        y = y0 + row * (row_h + gap_y)
        c = add_card(s4, x, y, col_w, row_h, bg_color=color, border_color=C_BORDER_LIGHT if color == C_CARD_NEUTRAL else None)
        populate_text_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 5: OVERALL SYSTEM ARCHITECTURE
    # =========================================================================
    s5 = prs.slides.add_slide(layout)
    add_header(s5, "SYSTEM ARCHITECTURE", "End-to-End Technology Stack & Pipelines")
    
    c_front = add_card(s5, 0.69, y_arch, col3_w, h_arch, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_front, "Frontend Layer (Client)", [
        "• Framework: Next.js 15 App Router + React 19",
        "• Styling: Tailwind CSS + CSS Token Data Themes",
        "• State & Data: React Hooks, Axios, AuthContext",
        "• Visualization: Recharts (Analytics) + Pure Custom Single-SVG (Gantt, PERT & Risk Views)",
        "• UX Surfaces: cmdk Command Palette, Sonner toasts, Lucide icons, shortcuts modal"
    ], subtitle="Modern, Low-Latency Web App", body_size=10.5)

    c_back = add_card(s5, 0.69 + col3_w + gap3, y_arch, col3_w, h_arch, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_back, "Backend & API Gateway", [
        "• Server: Node.js + Express 5 REST API",
        "• Real-Time Bus: Socket.io bidirectional sync",
        "• Authentication: JWT tokens with bcrypt hashing",
        "• Authorization: requireRole middleware hierarchy (viewer < member < admin < owner)",
        "• Engines: Pure CPM service & Monte Carlo PERT simulator (topological sort, float, cycle check; 0 DB deps)",
        "• Aggregations: 6 Mongoose aggregation pipelines"
    ], subtitle="Stateless RESTful Microservices", body_size=10.0)

    c_data = add_card(s5, 0.69 + (col3_w + gap3) * 2, y_arch, col3_w, h_arch, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_data, "Data & AI Intelligence", [
        "• Database: MongoDB with Mongoose 8 ORM",
        "• 9 Core Schemas: Task, List, Sprint, Dependency, StatusHistory, TimeEntry, ActivityLog, AlertState, TaskEstimate",
        "• Seed Engine: Deterministic Mulberry32 PRNG (68 tasks, 4 sprints, 186 history transitions)",
        "• AI Client: Groq SDK (Llama 3 70B) in strict JSON mode",
        "• AI Fallback: 100% deterministic offline heuristics"
    ], subtitle="Mongoose Aggregations & LLMs", body_size=10.0)

    # =========================================================================
    # SLIDE 6: DATA MODELING & STATUS INTEGRITY
    # =========================================================================
    s6 = prs.slides.add_slide(layout)
    add_header(s6, "DATA MODELING", "Eliminating Status Drift in Agile Workspaces")
    
    c_s6_l = add_card(s6, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_ROSE)
    populate_text_card(c_s6_l, "The Status Drift Dilemma", [
        "• The Root Cause: In naive Kanban boards, tasks store both a column ID (`list`) and a `status` enum.",
        "• The Inconsistency: When moving a card between lists, `list` is updated while `status` remains untouched.",
        "• The Failure: Cards sitting in the 'Done' column still carry `status: 'todo'`. All burndown charts, cycle time metrics, and cumulative flow diagrams become completely invalid.",
        "• Security Defect Discovered: Initial repo lacked board membership checks in card movements, allowing any user to move cards across boards."
    ], subtitle="Architecture Analysis of Previous Codebase", body_size=11)

    c_s6_r = add_card(s6, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s6_r, "PulseBoard's Atomic Single Source of Truth", [
        "• List.statusKey Schema: Added `statusKey` enum (`todo`, `in-progress`, `done`) to the List model.",
        "• Atomic Sync on Move: `moveTaskToList` reads target list's `statusKey` and updates `task.status` and `task.list` in one atomic operation.",
        "• Audit & History Trail: Simultaneously inserts a row into `TaskStatusHistory` and logs an `ActivityLog` event.",
        "• Security Fixed: Enforced board membership verification before allowing any card movement or list mutation.",
        "• Unbreakable Analytics: Burndown, Cycle Time, and CFD all key off a status field that cannot drift."
    ], subtitle="Robust Schemas & Atomic State Synchronization", body_size=11)

    # =========================================================================
    # SLIDE 7: PURE CPM SCHEDULING ENGINE — THEORY & MATH (TUSHAR)
    # =========================================================================
    s7 = prs.slides.add_slide(layout)
    add_header(s7, "SCHEDULE MANAGEMENT (TUSHAR)", "Critical Path Method: Mathematical Engine")
    
    p7_cards = [
        ("1. Topological Sort", C_PASTEL_BLUE, [
            "• Graph Model: Tasks as nodes, dependencies as directed edges (u -> v).",
            "• Kahn's Algorithm: Computes in-degree for all vertices; iterates through zero in-degree queue.",
            "• Linear Time: Runs in pure O(V + E) time.",
            "• Pure Function: 100% decoupled from database imports for instantaneous execution and testing."
        ]),
        ("2. Forward & Backward Pass", C_PASTEL_GREEN, [
            "• Forward Pass (Earliest Dates):",
            "  ES_i = max(EF_p for p in Pred(i)), ES_start = 0",
            "  EF_i = ES_i + Duration_i",
            "• Backward Pass (Latest Dates):",
            "  LF_i = min(LS_s for s in Succ(i)), LF_end = Total Duration",
            "  LS_i = LF_i - Duration_i"
        ]),
        ("3. Float & Critical Path", C_PASTEL_YELLOW, [
            "• Total Float (Slack):",
            "  TF_i = LS_i - ES_i = LF_i - EF_i",
            "• Critical Path Invariant:",
            "  Tasks with TF_i = 0 have zero scheduling buffer.",
            "• Project Delivery Rule:",
            "  Any delay on a critical-path task directly pushes back total project completion date."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p7_cards):
        c = add_card(s7, 0.69 + idx * (col3_w + gap3), y_arch, col3_w, h_arch, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 8: DAG ENFORCEMENT & DEADLOCK PREVENTION (TUSHAR)
    # =========================================================================
    s8 = prs.slides.add_slide(layout)
    add_header(s8, "SCHEDULE MANAGEMENT (TUSHAR)", "DAG Enforcement & Deadlock Prevention")
    
    c_s8_l = add_card(s8, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_ROSE)
    populate_text_card(c_s8_l, "The Cycle Deadlock Problem", [
        "• Cyclic Dependencies: If Task A depends on B, B depends on C, and C depends on A (A -> B -> C -> A), topological sorting cannot complete.",
        "• The Hazard: In project management, cyclic dependencies represent fatal logical contradictions (tasks waiting for their own outputs).",
        "• Algorithmic Failure: Without validation, CPM algorithms loop infinitely or crash when computing longest paths."
    ], subtitle="Preventing Scheduling Graph Deadlocks", body_size=11)

    c_s8_r = add_card(s8, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s8_r, "Kahn's Real-Time Validation & HTTP 409", [
        "• Pre-Commit Edge Testing: Before inserting a dependency into MongoDB, the controller constructs a hypothetical graph.",
        "• Kahn's Verification: If the number of processed nodes != total nodes, a cycle exists.",
        "• CycleError with Chain: Traverses parent pointers to reconstruct and output the exact cycle chain (e.g. 'Task A -> Task B -> Task A').",
        "• HTTP 409 Conflict: Server aborts write and returns 409 with cycle details.",
        "• Visual UI Banner: Task modal catches 409 and displays an immediate red warning alert explaining the topological violation."
    ], subtitle="Proactive Server-Side Graph Integrity", body_size=11)

    # =========================================================================
    # SLIDE 9: INTERACTIVE TIMELINE & SINGLE-SVG GANTT (TUSHAR)
    # =========================================================================
    s9 = prs.slides.add_slide(layout)
    add_header(s9, "SCHEDULE VISUALIZATION (TUSHAR)", "Bespoke Single-SVG Gantt Timeline")
    
    p9_cards = [
        ("Pure Vector Architecture", C_PASTEL_BLUE, [
            "• Zero 3rd-Party Canvas Overhead: Entire Gantt chart rendered in a single, high-performance <svg> element.",
            "• 60fps Native Scrolling: Native CSS overflow-x scrolling eliminates sluggish per-frame re-render loops.",
            "• Dynamic Zoom Scales: Smooth toggle between Day, Week, and Month coordinate grids."
        ]),
        ("Critical Path Highlighting", C_PASTEL_ROSE, [
            "• Shared Critical Path Toggle: One-click switch instantly illuminates the zero-float critical path.",
            "• Distinct Color Coding: Critical tasks colored in high-visibility Ruby Red; non-critical tasks colored in Pulse Violet.",
            "• Visual Bezier Curves: Smooth SVG dependency connector arrows linking predecessor finishes to successor starts."
        ]),
        ("Interactive Inspection", C_PASTEL_YELLOW, [
            "• Float Badges: Cards visually display exact float buffer (e.g. '3d slack').",
            "• Node Click Modal: Clicking any timeline bar opens the CPM schedule inspector showing ES, EF, LS, LF, and float days.",
            "• Jump to Detail: Direct action opens task detail modal to modify duration or dependencies live."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p9_cards):
        c = add_card(s9, 0.69 + idx * (col3_w + gap3), y_arch, col3_w, h_arch, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 10: ACTIVITY-ON-NODE PERT NETWORK DIAGRAM (TUSHAR)
    # =========================================================================
    s10 = prs.slides.add_slide(layout)
    add_header(s10, "PERT NETWORK (TUSHAR)", "Activity-on-Node Dependency Network")
    
    c_s10_l = add_card(s10, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s10_l, "Standard 6-Cell PERT Node Layout", [
        "• Canonical Engineering Format: Replaces generic cards with canonical PERT activity boxes.",
        "• Top Row: Earliest Start (ES) on left, Earliest Finish (EF) on right.",
        "• Bottom Row: Latest Start (LS) on left, Latest Finish (LF) on right.",
        "• Center & Corner: Task title in center, Total Float (TF) badge in the top-right corner.",
        "• Immediate Read: Evaluators can immediately inspect CPM numbers from live data without opening sub-menus."
    ], subtitle="Classical Project Management Standard", body_size=11)

    c_s10_r = add_card(s10, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s10_r, "Ranked Topological Depth & Convergence", [
        "• Ranked Depth Layout: Nodes arranged from left to right strictly by dependency depth (longest path), NOT calendar date.",
        "• Parallelism Visible: Demonstrates concurrent workstreams that can execute in parallel.",
        "• Convergence Ring Alerts: Nodes with 3+ incoming dependency edges are ringed in amber to highlight high-risk project integration choke points.",
        "• Critical Path Glow: Toggle highlights the critical sequence driving the project completion date."
    ], subtitle="Visualizing Parallelism & Integration Choke Points", body_size=11)

    # =========================================================================
    # SLIDE 11: THREE-POINT PERT & MONTE CARLO SIMULATION (TUSHAR)
    # =========================================================================
    s11 = prs.slides.add_slide(layout)
    add_header(s11, "PROBABILISTIC SCHEDULING (TUSHAR)", "Three-Point PERT & Monte Carlo Simulation")
    
    c_s11_l = add_card(s11, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_s11_l, "Analytical Three-Point PERT Theory", [
        "• Triplet Estimates: Allows entering optimistic (a), most likely (m), and pessimistic (b) durations.",
        "• Expected Duration Formula: E = (a + 4m + b) / 6 based on Beta distribution.",
        "• Task Variance: Var = sigma^2 = ((b - a) / 6)^2 reflecting estimation uncertainty.",
        "• Project Critical Variance: Var_proj = sum(Var_i for i in CriticalPath).",
        "• Normal CDF Confidence: Evaluates delivery confidence (50%, 75%, 85%, 95%) using Z-score quantiles."
    ], subtitle="Probabilistic Risk & Estimation Uncertainty", body_size=10.5)

    c_s11_r = add_card(s11, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_YELLOW)
    populate_text_card(c_s11_r, "Monte Carlo Simulation Engine", [
        "• Empirical Sampling: Runs 1,000 to 10,000 iterations drawing task durations from Beta-PERT / Triangular distributions.",
        "• Criticality Index: Measures the exact percentage of iterations where a task became critical (identifies near-critical risks).",
        "• Parallel Path Risk: Captures merge bias where parallel paths increase project delay risk (which analytical CPM ignores).",
        "• Dedicated Risk View: Interactive histogram, cumulative probability S-curve, and deadline percentile target sliders in /board/:id/risk."
    ], subtitle="10,000-Iteration Empirical Simulation", body_size=10.5)

    # =========================================================================
    # SLIDE 12: INTERACTIVE DEPENDENCY MANAGEMENT SURFACE (TUSHAR)
    # =========================================================================
    s12 = prs.slides.add_slide(layout)
    add_header(s12, "DEPENDENCY CONTROLS (TUSHAR)", "Task-Level Dependency Management & CPM Surface")
    
    p12_cards = [
        ("Predecessors & Successors", C_PASTEL_BLUE, [
            "• Dedicated Modal Tab: Added 'Dependencies & CPM' tab inside TaskDetailModal.",
            "• Predecessor List: Shows all tasks that must finish before this task can start, along with their duration.",
            "• Successor List: Shows all downstream tasks waiting for this card.",
            "• One-Click Removal: Instant delete button (X) unlinks dependencies and recalculates CPM."
        ]),
        ("Live Add & Cycle Alert", C_PASTEL_ROSE, [
            "• Dropdown Selector: Select any task on the board to establish a predecessor link.",
            "• Real-Time DAG Verification: Calls backend POST /api/boards/:id/dependencies.",
            "• Immediate Cycle Warning: If a cyclic path is introduced, the modal displays an inline red warning banner detailing the cycle chain."
        ]),
        ("Live Schedule Calculation", C_PASTEL_YELLOW, [
            "• On-Card CPM Stats: Automatically displays computed ES, EF, LS, LF, and Float.",
            "• Critical Path Badge: Clear visual tag indicating whether the task sits on the Critical Path (Zero Slack).",
            "• Immediate Feedback: Adding/removing dependencies instantly updates board schedule data."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p12_cards):
        c = add_card(s12, 0.69 + idx * (col3_w + gap3), y_arch, col3_w, h_arch, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 13: EFFORT TRACKING & PLANNED VS ACTUAL ANALYSIS (TUSHAR)
    # =========================================================================
    s13 = prs.slides.add_slide(layout)
    add_header(s13, "EFFORT TRACKING (TUSHAR)", "Planned vs. Actual Effort Accounting")
    
    c_s13_l = add_card(s13, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s13_l, "Effort Logging & Audit Ledger", [
        "• Quick-Log Presets: One-click logging for 15 min, 30 min, 1 hour, or 2 hours with optional task notes.",
        "• Custom Logging: Manual minute-precision time logging for detailed developer timesheets.",
        "• Immutable Audit Ledger: Every entry creates a TimeEntry document recording author, date, duration, and context.",
        "• Total Aggregation: Instant calculation of cumulative actual hours against original estimate."
    ], subtitle="Granular Time Recording per Task", body_size=11)

    c_s13_r = add_card(s13, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_YELLOW)
    populate_text_card(c_s13_r, "Dynamic Estimate Variance Bar", [
        "• Progress Indicator: Visual progress bar directly comparing actual logged hours against estimated hours.",
        "• Three-Color Status Alerts:",
        "  - Green: Healthy progress (<80% of estimate used)",
        "  - Amber: Approaching estimate threshold (80-100%)",
        "  - Red Overrun: Overrun condition (>100% used), warning team of effort creep.",
        "• Feedback Loop: Enables teams to calibrate estimation accuracy in retrospective reviews."
    ], subtitle="Visual Variance & Overrun Detection", body_size=11)

    # =========================================================================
    # SLIDE 14: TEAM CAPACITY HEATMAP (TUSHAR)
    # =========================================================================
    s14 = prs.slides.add_slide(layout)
    add_header(s14, "CAPACITY MANAGEMENT (TUSHAR)", "4-Week Team Capacity Heatmap")
    
    c_s14_l = add_card(s14, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_s14_l, "Workload Benchmarking against 40h Baseline", [
        "• Member-by-Member Breakdown: Aggregates total assigned story points and logged hours across all active board members.",
        "• 4-Week Rolling Matrix: Projects weekly developer allocation across the sprint timeline.",
        "• 40-Hour Threshold: Uses 40 hours/week as the standard sustainable capacity benchmark.",
        "• Burnout Prevention: Flags team members who are systematically over-allocated before deadlines approach."
    ], subtitle="Sustainable Sprint Workload Management", body_size=11)

    c_s14_r = add_card(s14, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s14_r, "Color-Coded Heatmap & Task Inspector", [
        "• High-Contrast Color Tiers:",
        "  - Under-Allocated: Soft neutral (<20h workload)",
        "  - Healthy Balance: Emerald green (20h - 40h workload)",
        "  - Capacity Overrun: Vibrant coral/red (>40h over-allocated)",
        "• Interactive Hover Popover: Hovering any developer's weekly cell displays exact task names and hourly breakdown.",
        "• Read-Only Discipline: Displays computed allocations without writing back to task assignees, maintaining pure data separation."
    ], subtitle="Actionable Capacity Visualization", body_size=11)

    # =========================================================================
    # SLIDE 15: FLOW ANALYTICS — BURNDOWN & VELOCITY (SHLOK)
    # =========================================================================
    s15 = prs.slides.add_slide(layout)
    add_header(s15, "FLOW ANALYTICS (SHLOK)", "Sprint Burndown & Historical Velocity")
    
    c_s15_l = add_card(s15, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_ROSE)
    populate_text_card(c_s15_l, "Sprint Burndown with Scope Steps", [
        "• Ideal Burndown Line: Linear mathematical path from initial committed story points to zero on sprint end.",
        "• Actual Burndown Curve: Daily remaining story points computed via Mongoose TaskStatusHistory aggregations.",
        "• Scope Creep Visualization: Mid-sprint task additions appear as distinct upward steps on the curve, immediately revealing unplanned scope injection.",
        "• Sprint Switcher Control: URL-persisted segmented control to inspect past and active sprints."
    ], subtitle="Daily Milestone Progress Tracking", body_size=11)

    c_s15_r = add_card(s15, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s15_r, "4-Sprint Velocity Trend & Rolling Average", [
        "• Committed vs Completed: Stacked bar chart comparing committed story points vs delivered points across 4 sprints.",
        "• Rolling 3-Sprint Average: Computes running velocity average line, smoothing out seasonal anomalies and vacation dips.",
        "• Predictable Commitment: Empowers product owners to commit to realistic sprint scope based on empirical team delivery capacity rather than wishful thinking."
    ], subtitle="Empirical Team Delivery Predictability", body_size=11)

    # =========================================================================
    # SLIDE 16: CYCLE TIME & CUMULATIVE FLOW (SHLOK)
    # =========================================================================
    s16 = prs.slides.add_slide(layout)
    add_header(s16, "FLOW ANALYTICS (SHLOK)", "Cycle Time Percentiles & Cumulative Flow (CFD)")
    
    c_s16_l = add_card(s16, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s16_l, "Cycle Time Scatter & SLA Percentiles", [
        "• Pure Status Timing: Measures exact duration each task spent between 'in-progress' and 'done' using TaskStatusHistory timestamps.",
        "• Percentile Benchmarking: Avoids misleading averages by computing p50 (median), p85, and p95 percentiles.",
        "• Actionable SLA Targets: '85% of our tasks complete in under 4.2 days', giving stakeholders realistic delivery expectations.",
        "• Outlier Detection: Identifies stranded cards that suffered prolonged blockage."
    ], subtitle="Statistical Lead & Cycle Time Analysis", body_size=11)

    c_s16_r = add_card(s16, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_s16_r, "Cumulative Flow Diagram (CFD)", [
        "• Daily Stacked Area Chart: Visualizes the distribution of tasks in 'todo', 'in-progress', and 'done' over time.",
        "• Bottleneck Identification: A widening 'in-progress' band immediately exposes downstream bottlenecks (e.g. testing/code review starvation).",
        "• Little's Law Application: Visualizes the direct mathematical relationship between Work In Progress (WIP), Cycle Time, and Throughput.",
        "• Process Stability: Parallel smooth bands verify a stable, predictable workflow."
    ], subtitle="Bottleneck Identification via Area Bands", body_size=11)

    # =========================================================================
    # SLIDE 17: REAL-TIME DELIVERY HEALTH ENGINE (SHLOK)
    # =========================================================================
    s17 = prs.slides.add_slide(layout)
    add_header(s17, "DELIVERY HEALTH (SHLOK)", "6 Real-Time Delivery Health Indicators")
    
    health_tiles = [
        ("1. Scope Creep %", C_PASTEL_ROSE, [
            "• Percentage of story points added mid-sprint after sprint planning.",
            "• Flags risk when scope expands beyond 15%."
        ]),
        ("2. WIP Cap Breach", C_PASTEL_YELLOW, [
            "• Tracks active cards in 'in-progress' against column WIP limit.",
            "• Prevents context switching and multi-tasking drag."
        ]),
        ("3. Hours Variance", C_PASTEL_BLUE, [
            "• Aggregate variance between estimated hours and logged time.",
            "• Identifies systematic underestimation trends."
        ]),
        ("4. Blocked Critical Path", C_PASTEL_PURPLE, [
            "• Live count of critical path tasks currently blocked.",
            "• Highest urgency indicator for project managers."
        ]),
        ("5. Unestimated Ratio", C_PASTEL_GREEN, [
            "• Percentage of tasks lacking story points or hour estimates.",
            "• Enforces estimation hygiene before sprint kickoff."
        ]),
        ("6. Sprint Days Left", C_CARD_NEUTRAL, [
            "• Active countdown to sprint review and retrospective.",
            "• Synchronized with sprint start and end dates."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(health_tiles):
        row = idx // 3
        col = idx % 3
        x = 0.69 + col * (col_w + gap_x)
        y = y0 + row * (row_h + gap_y)
        c = add_card(s17, x, y, col_w, row_h, bg_color=color, border_color=C_BORDER_LIGHT if color == C_CARD_NEUTRAL else None)
        populate_text_card(c, title, bullets, title_size=15, body_size=10.5)

    # =========================================================================
    # SLIDE 18: FACT-GROUNDED AI DELIVERY DIGEST (SHLOK)
    # =========================================================================
    s18 = prs.slides.add_slide(layout)
    add_header(s18, "AI INSIGHTS (SHLOK)", "Fact-Grounded AI Delivery Digest")
    
    c_s18_l = add_card(s18, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_ROSE)
    populate_text_card(c_s18_l, "The Hallucination Dilemma", [
        "• Unreliable LLMs: Generic AI integrations feed raw text to LLMs, allowing them to hallucinate metrics and fabricate sprint progress.",
        "• Inconsistent Reporting: Different runs produce contradictory numbers for scope creep, completion rates, and delivery dates.",
        "• Management Distrust: When AI reports numbers that contradict the database, stakeholders immediately lose confidence."
    ], subtitle="Why Naive LLM Prompts Fail in SPM", body_size=11)

    c_s18_r = add_card(s18, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s18_r, "Facts-First Aggregation Architecture", [
        "• Pre-Aggregation: Backend Mongoose service computes verified facts first: exact scope creep %, WIP breaches, hours variance, critical path tasks.",
        "• Constrained Prompt: Ground-truth JSON is fed into Groq Llama-3 in strict JSON mode.",
        "• Server Overwrite Protection: Backend server explicitly inspects the AI output and overwrites any metrics array with computed ground truth.",
        "• Actionable Narrative: Delivers a natural language summary explaining delivery risks, milestone confidence, and recommended corrective actions.",
        "• Offline Fallback: Fully functional deterministic heuristics if offline or LLM unavailable."
    ], subtitle="Mathematically Anchored LLM Insights", body_size=11)

    # =========================================================================
    # SLIDE 19: AI WORK BREAKDOWN ASSISTANT (SHLOK)
    # =========================================================================
    s19 = prs.slides.add_slide(layout)
    add_header(s19, "AI INSIGHTS (SHLOK)", "Constrained AI Work Breakdown Assistant")
    
    c_s19_l = add_card(s19, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_s19_l, "Code-Enforced Schema Constraints", [
        "• Empty Body Rule: Accepts empty POST body; reads only existing database card title and description to prevent prompt injection.",
        "• Subtask Count Guard: Strictly enforces between 3 and 7 subtasks via Zod schema validation.",
        "• Duration Guard: Every proposed subtask estimate must be <= 8 hours (less than one working day).",
        "• Automated Unit Tests: Tested in automated test suite (breakdown.test.js passing 100%)."
    ], subtitle="Rigorous Structural Bounds on Generative AI", body_size=11)

    c_s19_r = add_card(s19, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s19_r, "Human-in-the-Loop Advisory Model", [
        "• Advisory Only: The AI never automatically writes to the task list without developer approval.",
        "• Interactive Review: Proposes subtasks with checkboxes and hour estimates inside the Task Detail Modal.",
        "• Selective Insertion: Developers review, uncheck irrelevant items, and click 'Add Selected Subtasks'.",
        "• Bulk Creation: Server creates subtasks linked to parent task with inherited sprint and status."
    ], subtitle="Developer Autonomy & Quality Control", body_size=11)

    # =========================================================================
    # SLIDE 20: BOARD CANVAS & WORKSPACE UX (KESHAV)
    # =========================================================================
    s20 = prs.slides.add_slide(layout)
    add_header(s20, "WORKSPACE UX (KESHAV)", "Kanban Board Canvas & UX Ergonomics")
    
    p20_cards = [
        ("HTML5 Drag-and-Drop", C_PASTEL_BLUE, [
            "• Fast Responsive Movement: Zero drag lag; instant visual column drop target indicators.",
            "• Atomic Column Moves: Cards move smoothly across lists with immediate UI updates and background synchronization.",
            "• Unassigned Quick Create: Inline task addition at the bottom of any list column."
        ]),
        ("Multi-Dimensional Filters", C_PASTEL_GREEN, [
            "• Multi-Filter Bar: Filter board cards by Assignee, Priority (Urgent/High/Medium/Low), and Overdue.",
            "• Blocked Dependency Filter: One-click filter highlighting tasks currently blocked by predecessors.",
            "• URL-Persisted State: Filter parameters reflected in URL for bookmarking and team sharing."
        ]),
        ("Visual Density Toggles", C_PASTEL_YELLOW, [
            "• Compact Mode: Minimalist layout for dense developer scrums.",
            "• Cozy Mode: Standard balanced view with priority badges and assignees.",
            "• Comfortable Mode: Rich cards displaying estimate progress bars, subtask counters, and due dates."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p20_cards):
        c = add_card(s20, 0.69 + idx * (col3_w + gap3), y_arch, col3_w, h_arch, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 21: PRODUCTIVITY SURFACE & SPRINT LIFECYCLE (KESHAV)
    # =========================================================================
    s21 = prs.slides.add_slide(layout)
    add_header(s21, "PRODUCTIVITY SURFACE (KESHAV)", "Stat Rail, Command Palette & Sprints")
    
    p21_cards = [
        ("Board Stat Rail", C_PASTEL_PURPLE, [
            "• Above-Board Overview: Sits directly under the header so evaluators immediately see project controls.",
            "• Sprint Progress Bar: Committed story points vs completed points.",
            "• Blocked Counter: Red badge highlighting blocked critical tasks.",
            "• 60px SVG Sparkline: Mini inline burndown sparkline tracking active sprint velocity."
        ]),
        ("Command Palette (Cmd+K)", C_PASTEL_BLUE, [
            "• Keyboard-First Productivity: Built with cmdk library; triggered via Cmd+K or Ctrl+K.",
            "• Instant Task Search: Real-time fuzzy filtering of all board cards.",
            "• View Navigation: Fast jump between Board, Analytics, Timeline, Risk, and Members views.",
            "• Keyboard Shortcuts Modal: Accessible via '?' key showing all navigation hotkeys."
        ]),
        ("Sprint Creation Modal", C_PASTEL_YELLOW, [
            "• '+ New Sprint' Button: Sits directly in the sprint switcher header.",
            "• Comprehensive Fields: Sprint Name, Sprint Goal, Start Date, End Date, Committed Points.",
            "• Immediate Persistence: POST /api/sprints with auto-selection in analytics views.",
            "• Task Association: Tasks easily assigned to active/future sprints."
        ])
    ]
    for idx, (title, color, bullets) in enumerate(p21_cards):
        c = add_card(s21, 0.69 + idx * (col3_w + gap3), y_arch, col3_w, h_arch, bg_color=color)
        populate_text_card(c, title, bullets, body_size=10.5)

    # =========================================================================
    # SLIDE 22: SECURITY, RBAC & AUDIT TRAIL (MOHLI)
    # =========================================================================
    s22 = prs.slides.add_slide(layout)
    add_header(s22, "SECURITY & AUDIT (MOHLI)", "4-Tier RBAC & Immutable Audit Feed")
    
    c_s22_l = add_card(s22, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s22_l, "4-Tier Role-Based Access Control", [
        "• Role Hierarchy: Owner (Full control), Admin (Manage lists/members/sprints), Member (Create/edit/move tasks), Viewer (Read-only access).",
        "• Gateway Middleware: `requireRole` protects administrative routes, returning 403 Forbidden on violations.",
        "• Self-Explaining UI: Viewer accounts see clean, disabled controls with tooltip explanations.",
        "• Members Panel: Role badges, owner crown, and interactive permission matrix."
    ], subtitle="Enterprise Security Governance", body_size=11)

    c_s22_r = add_card(s22, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s22_r, "Activity Feed & Rollback Alerts", [
        "• Cursor-Paginated Drawer: High-performance infinite scroll activity log tracking card moves, time logs, and status transitions.",
        "• Detailed Event Context: Records actor, source column, destination column, timestamp, and duration.",
        "• Rollback Undo Toasts: Dragging a card triggers a toast notification with an 'Undo' action that reverts the task move immediately.",
        "• Complete Accountability: Eliminates manual status reporting while preserving a complete audit trail."
    ], subtitle="Real-Time Transparency & Undo Support", body_size=11)

    # =========================================================================
    # SLIDE 23: REAL-TIME SYNC & DELIVERY ALERTS (MOHLI & SHLOK)
    # =========================================================================
    s23 = prs.slides.add_slide(layout)
    add_header(s23, "REAL-TIME & ALERTS", "Socket.io Live Sync & Automated Delivery Webhooks")
    
    c_s23_l = add_card(s23, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_s23_l, "Socket.io Real-Time Synchronization", [
        "• Live Multi-User Collaboration: Eliminates page reloads during concurrent planning sessions.",
        "• Instant Broadcast: Dragging a card, adding a dependency, or creating a task emits lightweight events to board room subscribers.",
        "• Conflict Avoidance: Optimistic UI updates with server-authoritative reconciliation.",
        "• Presence Feedback: Subtle live badges signal real-time peer movements."
    ], subtitle="Collaborative Multi-User Architecture", body_size=11)

    c_s23_r = add_card(s23, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_ROSE)
    populate_text_card(c_s23_r, "Automated Delivery Alerts & Report Exports", [
        "• Proactive Alarm Engine: Background delivery alerts monitor WIP limits, critical path slippage, and scope creep.",
        "• Webhook Integration: Dispatches webhook events (e.g. Slack/Discord) when team thresholds are breached.",
        "• Alert State Tracking: Persistent AlertState model prevents repetitive spamming while alerts remain active.",
        "• Executive Report Export: One-click CSV and structured report exports for management reviews."
    ], subtitle="Automated Governance & Stakeholder Reporting", body_size=11)

    # =========================================================================
    # SLIDE 24: LIVE DEMO WALKTHROUGH (7-MINUTE SCRIPT)
    # =========================================================================
    s24 = prs.slides.add_slide(layout)
    add_header(s24, "DEMO WALKTHROUGH", "Evaluator Live Demonstration Protocol (7 Mins)")
    
    c_s24_l = add_card(s24, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_BLUE)
    populate_text_card(c_s24_l, "Demo Steps: 0:00 - 3:30", [
        "• 0:00 - Board Canvas & Stat Rail: Show sprint days left, committed points, blocked cards, and 60px burndown sparkline.",
        "• 0:40 - AI Delivery Digest: Review fact-grounded sprint summary, locked metrics, and risk assessment.",
        "• 1:30 - 6 Health Tiles: Demonstrate Scope Creep %, WIP limit breach, and hours variance.",
        "• 2:20 - Burndown & Velocity: Toggle past sprints with sprint switcher; review p50/p85 cycle time percentiles.",
        "• 3:10 - Critical Path Toggle: Open Timeline; flip Critical Path switch to illuminate Ruby Red zero-float tasks."
    ], subtitle="Phase 1: Project Controls & Flow Overview", body_size=11)

    c_s24_r = add_card(s24, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_PASTEL_GREEN)
    populate_text_card(c_s24_r, "Demo Steps: 3:30 - 7:00", [
        "• 3:40 - PERT Network Diagram: Show ranked depth layout, 6-cell ES/EF/LS/LF boxes, and convergence rings.",
        "• 4:20 - Log Effort & Heatmap: Log 30 min on task; view estimate progress bar and 4-week team capacity heatmap.",
        "• 5:05 - Activity Drawer & Revert: Drag card to Done; inspect activity drawer; click toast 'Undo' to revert.",
        "• 5:50 - AI Breakdown & Cycle Prevention: Break down card with AI assistant; attempt to introduce a dependency cycle to show 409 alert.",
        "• 6:35 - Productivity & Theme: Open Cmd+K palette; demonstrate light/dark mode theme toggle."
    ], subtitle="Phase 2: Deep-Dive Interactions & AI", body_size=11)

    # =========================================================================
    # SLIDE 25: WORK DISTRIBUTION, CONCLUSION & REFERENCES
    # =========================================================================
    s25 = prs.slides.add_slide(layout)
    add_header(s25, "WORK DISTRIBUTION & CONCLUSION", "Team Contributions, Learnings & Citations")
    
    c_s25_l = add_card(s25, 0.69, y_split, col2_w, h_split, bg_color=C_PASTEL_PURPLE)
    populate_text_card(c_s25_l, "Group 9 Work Distribution Matrix", [
        "• Tushar Shukla (202351149): Project Scheduling & Effort (Pure CPM engine, DAG cycle detection, SVG Gantt & PERT views, Three-point PERT & Monte Carlo simulation, Time tracking, Capacity heatmap, Dependency modal).",
        "• Shlok Chauhan (202351131): Flow Analytics, Dashboard & AI (Burndown, Velocity, CFD, Cycle Time percentiles, 6 Health tiles, Fact-derived AI digest & breakdown, Delivery alert engine).",
        "• Keshav Badaya (202351065): Workspace UX & Board CRUD (Board/List/Task CRUD, statusKey sync, Board Stat Rail, Sprint creation modal, Cmd+K palette, Density toggles, HTML5 drag-and-drop).",
        "• Mohli Thapa (202351084): Security, RBAC & Audit Trail (JWT auth, 4-tier RBAC middleware, Members panel, Activity Drawer with cursor pagination, Rollback undo toasts, Socket.io sync)."
    ], subtitle="Balanced Subsystem Ownership Across Group 9", body_size=9.5)

    c_s25_r = add_card(s25, 0.69 + col2_w + gap2, y_split, col2_w, h_split, bg_color=C_CARD_NEUTRAL, border_color=C_BORDER_LIGHT)
    populate_text_card(c_s25_r, "Academic Conclusions & References", [
        "• Core Finding: Small agile teams do not need enterprise Jira bloat to achieve schedule adherence. Embedding classical CPM, empirical percentiles, and capacity heatmaps into lightweight boards delivers rigorous project control with zero friction.",
        "• [1] Y. Lindsjørn et al., 'Teamwork quality and project success in software development: A survey of agile teams', J. Syst. Softw., 2016.",
        "• [2] S. Y. Chadli et al., 'Software project management tools in global software development: a systematic mapping study', SpringerPlus, 2016.",
        "• [3] A. Radhakrishnan et al., 'The impact of project team characteristics on project agility: An empirical study', Eur. Manag. J., 2022.",
        "• [4] Atlassian, 'Jira project management template', 2026."
    ], subtitle="Software Project Management Takeaways", body_size=9.5)

    out_file = "PulseBoard_Final_Defense.pptx"
    prs.save(out_file)
    print(f"Successfully generated 25-slide defense presentation: {out_file}")

if __name__ == "__main__":
    build_deck()
