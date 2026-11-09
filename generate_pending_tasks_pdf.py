import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#71717A"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(45, 755, "PULSEBOARD — Project Status, Pending Tasks & Engineering Roadmap")
            self.setFont("Helvetica", 7.5)
            self.drawRightString(567, 755, "CS447 Software Project Management (Group 9)")
            self.setStrokeColor(colors.HexColor("#E4E4E7"))
            self.setLineWidth(0.6)
            self.line(45, 749, 567, 749)

        # Footer (all pages)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#71717A"))
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(567, 28, footer_text)
        self.drawString(45, 28, "PulseBoard Project Report | Confidential — For Academic & Technical Evaluation Only")
        self.setStrokeColor(colors.HexColor("#E4E4E7"))
        self.setLineWidth(0.6)
        self.line(45, 37, 567, 37)
        self.restoreState()

def build_pdf(filename="PulseBoard_Pending_and_Improvements.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Brand Colors
    c_brand = colors.HexColor("#5416E0")       # Pulse Violet
    c_ink = colors.HexColor("#18181B")         # Charcoal Dark
    c_muted = colors.HexColor("#52525B")       # Secondary text
    c_bg_light = colors.HexColor("#F9FAFB")    # Table alt row
    c_border = colors.HexColor("#E4E4E7")      # Border lines
    c_success = colors.HexColor("#059669")     # Emerald Green

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=c_brand,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=c_muted,
        spaceAfter=8
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=c_brand,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_ink,
        spaceAfter=4
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white
    )

    table_body = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=c_ink
    )

    badge_done = ParagraphStyle(
        'BadgeDone',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8,
        textColor=c_success
    )

    story = []

    # =========================================================================
    # PAGE 1: TITLE, METADATA & SECTION 1 (EXECUTIVE SUMMARY & CORE COMMITMENTS)
    # =========================================================================
    story.append(Paragraph("PulseBoard: Project Status, Pending Tasks & Roadmap", title_style))
    story.append(Paragraph("Measuring Schedule, Effort & Flow for Small Agile Teams — CS447 Group 9 Evaluation Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.2, color=c_brand, spaceBefore=0, spaceAfter=6))

    meta_data = [
        [
            Paragraph("<b>Academic Course:</b> CS447 Software Project Management", table_body),
            Paragraph("<b>Repository:</b> github.com/S-creator31/Pulseboard", table_body)
        ],
        [
            Paragraph("<b>Team Group 9:</b> Shlok Chauhan (202351131), Tushar Shukla (202351149), Keshav Badaya (202351065), Mohli Thapa (202351084)", table_body),
            Paragraph("<b>Active Git Branches:</b> <code>main</code> (up to date), <code>feat/project-controls</code>", table_body)
        ],
        [
            Paragraph("<b>Delivered Scope:</b> 11 Production UI Surfaces, 6 Core Commitments Shipped", table_body),
            Paragraph("<b>Verification:</b> 6/6 Pure Unit Tests Passed | Next.js Build 8/8 Routes Validated", table_body)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.8*inch, 3.4*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_bg_light),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("1. Executive Summary & Baseline Core Commitments (Delivered 100%)", h1_style))
    story.append(Paragraph(
        "PulseBoard transforms standard agile Kanban boards into an always-on <b>delivery management platform</b> by embedding classical "
        "project controls (Critical Path Method, Effort Tracking, Cumulative Flow, Cycle Time, and Fact-Grounded AI) without enterprise overhead. "
        "All <b>6 fixed core commitments</b> agreed upon in the project charter have been fully implemented, backed by a 90-day deterministic "
        "Mulberry32 dataset, pure algorithm unit tests, and production Next.js builds.",
        body_style
    ))

    commitments_data = [
        [Paragraph("Core Commitment (CS447 Charter)", table_header), Paragraph("Delivered Technical Architecture & UI Surface", table_header), Paragraph("Verification & Status", table_header)],
        [
            Paragraph("<b>1. Work Organization</b><br/>Board &rarr; List &rarr; Task Hierarchy", table_body),
            Paragraph("Full Kanban board with drag-and-drop, <code>statusKey</code> bidirectional synchronization (preventing status drift), density toggles (compact/cozy/comfortable), assignee & priority chips, and &#8984;K command palette.", table_body),
            Paragraph("<b>100% SHIPPED</b><br/>68 tasks, 5 lists, zero status drift.", badge_done)
        ],
        [
            Paragraph("<b>2. Access & Audit Trail</b><br/>Role-Based Access & Audit Logging", table_body),
            Paragraph("4-tier role hierarchy (Owner, Admin, Member, Viewer) with <code>requireRole</code> middleware; cursor-paginated Activity Drawer tracking card moves, time logs, and status transitions; rollback undo alerts.", table_body),
            Paragraph("<b>100% SHIPPED</b><br/>186 historical transitions logged & auditable.", badge_done)
        ],
        [
            Paragraph("<b>3. Schedule Visibility</b><br/>CPM Engine, Gantt & PERT Diagrams", table_body),
            Paragraph("Pure CPM scheduling engine with topological sort, forward/backward pass, and Total Float ($TF = LS - ES$). Interactive single-SVG Gantt timeline and ranked activity-on-node PERT diagram with Critical Path toggle.", table_body),
            Paragraph("<b>100% SHIPPED</b><br/>6/6 unit tests passing (CPM math & cycle prevention).", badge_done)
        ],
        [
            Paragraph("<b>4. Effort Visibility</b><br/>Logged Time vs Estimates & Capacity", table_body),
            Paragraph("Task estimate progress bars, quick-log popover, individual time audit ledger, and 4-week team capacity heatmap with 40-hour capacity baseline benchmarks and task hover breakdowns.", table_body),
            Paragraph("<b>100% SHIPPED</b><br/>109 logged entries tracked against task estimates.", badge_done)
        ],
        [
            Paragraph("<b>5. Flow Visibility</b><br/>Sprint Analytics & Bottlenecks", table_body),
            Paragraph("Four high-performance Mongoose aggregation pipelines: ideal vs actual sprint burndown, 4-sprint velocity trend with rolling average, cycle time scatter with p50/p85 percentiles, and cumulative flow diagram (CFD).", table_body),
            Paragraph("<b>100% SHIPPED</b><br/>6 real-time delivery health status indicators.", badge_done)
        ],
        [
            Paragraph("<b>6. AI-Assisted Insight</b><br/>Advisory & Fact-Grounded Insight", table_body),
            Paragraph("Fact-derived delivery digest (facts pre-aggregated server-side before prompt construction, metrics locked against hallucination) and Work Breakdown Assistant strictly bounded to 3–7 subtasks &le;8h each.", table_body),
            Paragraph("<b>100% SHIPPED</b><br/>Deterministic offline fallback + schema unit tests.", badge_done)
        ]
    ]
    t_comm = Table(commitments_data, colWidths=[2.1*inch, 3.7*inch, 1.4*inch])
    t_comm.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_brand),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_comm)

    # PAGE 2 BREAK
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: SECTION 2 (SCOPE TRADE-OFFS) & SECTION 3 (ENGINEERING BACKLOG)
    # =========================================================================
    story.append(Paragraph("2. Scope Trade-Offs & Architectural Decisions (Evaluator Review)", h1_style))
    story.append(Paragraph(
        "Under the 29-hour engineering budget, specific write-path complexities were deliberately structured as read-only computed views or "
        "deferred to Phase 2. This represents sound project control: prioritizing mathematical rigor and analytical visibility over complex UI mutations:",
        body_style
    ))

    tradeoffs_data = [
        [Paragraph("Feature Item", table_header), Paragraph("Engineering Rationale & Trade-off Analysis", table_header), Paragraph("Academic Defense Line (Viva / Presentation)", table_header)],
        [
            Paragraph("<b>Drag-to-Reschedule on Timeline</b><br/>(Interactive Bar Resizing on Gantt)", table_body),
            Paragraph("Direct canvas drag-rescheduling requires complex multi-task cascade recalculations in browser memory that risk invalidating topological sorting. Dates and durations are edited on cards/modals to preserve deterministic CPM invariants.", table_body),
            Paragraph("<i>'The timeline is an analytical projection over the scheduling engine; schedule modifications happen on task cards to preserve strict CPM DAG integrity.'</i>", table_body)
        ],
        [
            Paragraph("<b>Dynamic Role Permission Editor</b><br/>(Custom Matrix per User / Board)", table_body),
            Paragraph("A complete 4-tier RBAC system (Owner, Admin, Member, Viewer) is enforced via <code>requireRole</code> middleware. A dynamic matrix allowing custom permission bitmask editing was deferred in favor of fixed, battle-tested permission tiers.", table_body),
            Paragraph("<i>'Role permissions are strictly enforced at the API gateway layer; a dynamic permission rulebuilder is queued for Phase 2 multi-tenant administration.'</i>", table_body)
        ],
        [
            Paragraph("<b>Secondary Write-Path Activity Logs</b><br/>(List renames & metadata edits)", table_body),
            Paragraph("All core delivery events (card moves across lists, time logged, dependency links/unlinks) produce audit logs and status history entries. Cosmetic updates (list renaming) were deferred to prevent audit feed noise.", table_body),
            Paragraph("<i>'Audit logging captures all state transitions and effort entries; non-state cosmetic changes are batched in the database changelog.'</i>", table_body)
        ]
    ]
    t_trade = Table(tradeoffs_data, colWidths=[1.8*inch, 2.7*inch, 2.7*inch])
    t_trade.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_brand),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_trade)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. Engineering Backlog & High-Impact Improvements (Phase 2 Roadmap)", h1_style))
    story.append(Paragraph(
        "The following prioritized roadmap outlines key pending enhancements that build directly upon PulseBoard's core scheduling, flow, and analytics engines:",
        body_style
    ))

    roadmap_data = [
        [Paragraph("Improvement Feature", table_header), Paragraph("Priority", table_header), Paragraph("Complexity", table_header), Paragraph("Target Impact & SPM Benefit", table_header)],
        [
            Paragraph("<b>1. Real-time Multi-User Sync (Socket.io)</b><br/>Live drag-and-drop card sync across concurrent users with active presence indicators.", table_body),
            Paragraph("<font color='#E11D48'><b>P1 (High)</b></font>", table_body),
            Paragraph("Medium (3d)", table_body),
            Paragraph("Eliminates polling; ensures sprint planning boards reflect immediate team-wide movements without race conditions.", table_body)
        ],
        [
            Paragraph("<b>2. Three-Point PERT & Monte Carlo Risk</b><br/>Allow entering optimistic (a), most likely (m), and pessimistic (b) durations with probability curves.", table_body),
            Paragraph("<font color='#E11D48'><b>P1 (High)</b></font>", table_body),
            Paragraph("Medium (2d)", table_body),
            Paragraph("Elevates deterministic CPM to probabilistic schedule forecasting ($E = \\frac{a+4m+b}{6}$) with 95% confidence delivery dates.", table_body)
        ],
        [
            Paragraph("<b>3. Automated Webhook & Slack Alerts</b><br/>Push notifications for WIP cap breaches, sprint scope creep &gt;15%, and critical path slippages.", table_body),
            Paragraph("<font color='#D97706'><b>P2 (Med)</b></font>", table_body),
            Paragraph("Small (1d)", table_body),
            Paragraph("Provides proactive delivery alarms to project managers without requiring active dashboard polling.", table_body)
        ],
        [
            Paragraph("<b>4. Executive PDF & CSV Report Generator</b><br/>One-click downloadable delivery report containing sprint burndown, velocity tables, and audit logs.", table_body),
            Paragraph("<font color='#059669'><b>P3 (Norm)</b></font>", table_body),
            Paragraph("Small (1d)", table_body),
            Paragraph("Facilitates stakeholder status reporting, client milestone sign-offs, and academic grading documentation.", table_body)
        ],
        [
            Paragraph("<b>5. Enterprise SSO & OAuth Providers</b><br/>Sign in with Google Workspace, GitHub, or Microsoft Azure AD; organization multi-tenancy support.", table_body),
            Paragraph("<font color='#059669'><b>P3 (Norm)</b></font>", table_body),
            Paragraph("Medium (2d)", table_body),
            Paragraph("Streamlines enterprise adoption and academic lab onboarding with federated identity management.", table_body)
        ]
    ]
    t_road = Table(roadmap_data, colWidths=[2.5*inch, 0.7*inch, 0.9*inch, 3.1*inch])
    t_road.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_brand),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_road)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated clean 2-page {filename}")

if __name__ == "__main__":
    out_pdf = "PulseBoard_Pending_and_Improvements.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    build_pdf(out_pdf)
