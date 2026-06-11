# Batac City LGU Platform — Design System

**Version:** 0.1 · **Status:** Pre-Release Prototype  
**Source Reference:** City of Batac official website (batac.gov.ph), SP Secretariat documents, stakeholder interview synthesis

---

## 1. Design Philosophy

### Governing Principle: Official Clarity

The Batac City LGU Platform must project **institutional trust** while enabling **operational efficiency** for government staff managing high-stakes documents. Unlike commercial SaaS products, every interface decision must reinforce the platform's legitimacy as an official government system.

Three tensions to resolve well:

| Tension | Resolution |
|---|---|
| Formal vs. Usable | Use formal visual language (structure, hierarchy, restraint) but not bureaucratic UX (no jargon menus, no 12-level modals) |
| Dense vs. Readable | Data density earns its place — tables where data belongs, breathing room in dashboards |
| Brand vs. System | Batac's government green is preserved and elevated, not diluted into generic "green" |

### Design Voice

- **Authoritative, not imposing.** The city seal and green palette signal official government. The typography and layout signal competence and care.
- **Role-aware.** A document that looks urgent *is* shown urgently. SLA breaches glow red. Certifications feel like completions.
- **Transparent.** Every document state is visible. Every action creates a record. The system makes the audit trail feel like a feature, not a surveillance mechanism.

---

## 2. Color System

### Brand Colors (extracted from batac.gov.ph)

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#00A651` | CTAs, active nav, primary badges, chart primary |
| `brand-dark` | `#0D3D20` | Sidebar background, deep states |
| `brand-mid` | `#1A6B35` | Sidebar section headers, dark accents |
| `brand-light` | `#E8F5ED` | Page backgrounds, light card fills |
| `brand-50` | `#F0FAF4` | Hover backgrounds, subtle highlights |

### Accent (City Seal Gold)

| Token | Hex | Usage |
|---|---|---|
| `accent-gold` | `#F59E0B` | Special session highlights, seal color, certification stamps |
| `accent-gold-dark` | `#92400E` | Gold text on light backgrounds |
| `accent-gold-light` | `#FEF3C7` | Gold background fills |

### Semantic Status Colors

| Status | Background | Text | Dot | Usage |
|---|---|---|---|---|
| Approved / Released | `#DCFCE7` | `#15803D` | `#16A34A` | Document approved, step completed |
| Pending Approval | `#FEF3C7` | `#92400E` | `#F59E0B` | Awaiting action |
| In Workflow | `#DBEAFE` | `#1E40AF` | `#2563EB` | Active workflow instance |
| In Committee | `#EDE9FE` | `#5B21B6` | `#7C3AED` | SP committee review |
| For Reading | `#F3E8FF` | `#6B21A8` | `#9333EA` | 1st/2nd/3rd reading stages |
| Rejected | `#FEE2E2` | `#991B1B` | `#DC2626` | Rejected document |
| Overdue / Breach | `#FEE2E2` | `#991B1B` | `#DC2626` | SLA exceeded |
| Under Investigation | `#FFEDD5` | `#9A3412` | `#EA580C` | Complaint/admin case |
| Draft | `#F3F4F6` | `#4B5563` | `#9CA3AF` | Not yet submitted |
| Archived | `#F3F4F6` | `#6B7280` | `#9CA3AF` | Permanently filed |

### Classification Level Colors

| Level | Color | Icon | Access Rule |
|---|---|---|---|
| Public | Green | Globe | All users + public portal |
| Internal | Blue | Building2 | All authenticated LGU employees |
| Confidential | Amber | Shield | Restricted role allowlist only |
| Restricted | Red | Lock | Explicit allowlist only — never portal |

### Neutral Grays

| Token | Hex | Usage |
|---|---|---|
| `gray-50` | `#F9FAFB` | Page backgrounds |
| `gray-100` | `#F3F4F6` | Subtle fills, disabled states |
| `gray-200` | `#E5E7EB` | Borders, dividers |
| `gray-400` | `#9CA3AF` | Placeholder text, muted icons |
| `gray-500` | `#6B7280` | Secondary text |
| `gray-700` | `#374151` | Primary text (headings) |
| `gray-900` | `#111827` | Primary text (body) |

---

## 3. Typography

### Primary Typeface: IBM Plex Sans

Rationale: IBM Plex Sans projects technical competence and institutional authority. Its letterforms are slightly formal — more appropriate for government context than the startup-casual Inter or Roboto. The companion IBM Plex Mono is essential for tracking numbers, document series codes, and audit entries.

```
Font: IBM Plex Sans (400, 500, 600, 700)
Companion: IBM Plex Mono (400, 500) — for codes and identifiers
Fallback: system-ui, -apple-system, 'Segoe UI', sans-serif
```

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 2.25rem / 36px | 700 | 1.2 | Hero text, major page titles |
| `heading-xl` | 1.5rem / 24px | 700 | 1.3 | Major section titles |
| `heading-lg` | 1.25rem / 20px | 600 | 1.4 | Page titles |
| `heading-md` | 1rem / 16px | 600 | 1.5 | Card titles, panel headers |
| `heading-sm` | 0.875rem / 14px | 600 | 1.5 | Section headers, table headers |
| `body-md` | 0.875rem / 14px | 400 | 1.6 | Standard body text |
| `body-sm` | 0.75rem / 12px | 400 | 1.6 | Secondary text, metadata |
| `label` | 0.6875rem / 11px | 600 | 1.4 | UPPERCASED form labels, filter headers |
| `mono-md` | 0.8125rem / 13px | 400 | 1.5 | Tracking numbers, codes |
| `mono-sm` | 0.6875rem / 11px | 500 | 1.4 | Compact identifiers |

### Typography Rules

- **Tracking numbers** always use `IBM Plex Mono`, displayed as-is (DTS-2026-000045)
- **Document series numbers** (Resolution No. 2026-047) use IBM Plex Sans semibold
- **Table column headers** are ALL CAPS, 11px, tracked wide, gray-500
- **ARTA deadline dates** that are overdue render in red-600 bold
- **Never use font weight < 400** in data-dense tables — light fonts at 12px fail accessibility
- **Ilocano / Filipino labels**: supported, same weight rules apply

---

## 4. Spacing Scale

Based on a 4px base unit.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon padding, tight gaps |
| `space-2` | 8px | Internal component padding |
| `space-3` | 12px | Card internal padding (compact) |
| `space-4` | 16px | Standard spacing, gap between form fields |
| `space-5` | 20px | Card padding (standard) |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Between major sections |
| `space-10` | 40px | Page top padding |
| `space-12` | 48px | Hero sections |

### Layout Constants

| Token | Value | Notes |
|---|---|---|
| `sidebar-width` | 256px | Expanded |
| `sidebar-collapsed` | 64px | Collapsed (icons only) |
| `topbar-height` | 52px | Fixed top bar |
| `content-max-width` | 1400px | Max content width |
| `table-row-height` | 48px | Standard; 40px compact |
| `card-radius` | 12px | All cards and panels |
| `input-radius` | 8px | Form inputs |
| `badge-radius` | 9999px | Pill badges |
| `tag-radius` | 4px | Classification tags (square feel) |

---

## 5. Component Library

### Buttons

```
Variant    | Background      | Text       | Hover
Primary    | brand-primary   | white      | brand-dark (darker green)
Secondary  | white           | gray-700   | gray-50
Danger     | red-600         | white      | red-700
Warning    | amber-500       | white      | amber-600
Outline    | transparent     | brand-primary | brand-50
Ghost      | transparent     | gray-600   | gray-100
```

**Button rules:**
- Icon buttons have a 16px icon (14px for size `sm`)
- Destructive actions (Reject, Delete) always require a confirmation step or mandatory comment
- Loading state: spinner replaces icon, button disabled
- Never use danger buttons for reversible actions

### Badges and Status Indicators

**StatusBadge**: Pill shape, dot indicator + text  
**ClassificationBadge**: Rounded rectangle, icon + text  
**PriorityTag**: Square corners, ALL CAPS  
**CountBadge**: Numeric, sits on top-right of icons

### Cards

| Variant | Border | Shadow | Use case |
|---|---|---|---|
| Default | `gray-200` | None | Standard content cards |
| Elevated | `gray-200` | `sm` | Dashboard stat cards |
| Hoverable | `gray-200` → `green-300` | None → `md` | Clickable document rows |
| Alert | Color-matched border | None | System alerts |
| Outline-only | `dashed gray-300` | None | Upload zones, placeholder areas |

### Data Tables

Pattern derived from TanStack Table specifications:

- **Column header**: `gray-50` background, 11px uppercase labels, sort indicators
- **Row height**: 48px standard, 40px compact (DMS repository)
- **Row hover**: `gray-50` background transition
- **Action column**: Hidden by default, revealed on row hover (opacity 0→1)
- **Fixed columns**: Tracking number column always visible on horizontal scroll
- **Empty state**: Centered icon + message, never an empty white box
- **Pagination**: Bottom bar, "N of M results", page size select, prev/next
- **Sort indicators**: `ChevronUp` / `ChevronDown` icons, active column uses `brand-primary`

### Form Elements

- **Label**: 11px, semibold, uppercase, tracked, gray-600 — always above input
- **Required indicator**: Red asterisk (*) in label
- **Input focus**: 2px `brand-primary` ring, border transparent
- **Error state**: Red border, red error text below
- **Helper text**: 12px gray-400, below input
- **Disabled**: 50% opacity, `not-allowed` cursor

### Timeline Component (DTS)

```
● ← Completed step dot (white fill, green-600 border + check icon)
│
● ← Current step dot (solid green-600, clock icon, green label)
│
○ ← Pending step dot (gray fill)
```

- Connecting line: 2px, `green-200` for completed segments, `gray-200` for pending
- Entry card: `gray-50` background for completed, `green-50` border + background for current
- Timestamp: Monospace, gray-400, bottom of each entry

---

## 6. Layout Patterns

### Primary Application Layout

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (256px)     │  Content Area                 │
│                      │                               │
│  [City Seal + Name]  │  [Top Bar: Title + Actions]   │
│  ─────────────────   │  ─────────────────────────    │
│  DASHBOARDS          │  [Page Content]               │
│  • Mayor             │                               │
│  • SP Secretary      │  [KPI Row]                    │
│                      │                               │
│  OPERATIONS          │  [Main Content Grid]          │
│  • Document Tracking │                               │
│  • Approval          │  [Supporting Content]         │
│  • Repository        │                               │
│                      │                               │
│  PUBLIC              │                               │
│  • Citizen Portal    │                               │
│  ─────────────────   │                               │
│  [User Profile]      │                               │
└──────────────────────────────────────────────────────┘
```

### Citizen Portal Layout

```
┌──────────────────────────────────────────────────────┐
│  [Green Gov Header: Seal + City Name + Contact]      │
│  [Tab Navigation: Track | Library | Submit]          │
│                                                      │
│  [Tab Content — max-width: 896px, centered]          │
└──────────────────────────────────────────────────────┘
```

Note: The Citizen Portal uses a distinct, simplified layout with no internal sidebar. It is designed to be accessible to citizens without any government staff background.

### Approval Interface Layout

```
┌──────────────────────────────────────────────────────┐
│  [PDF Viewer — flex: 1]  │  [Action Panel — 320px]  │
│                          │                           │
│  [Document toolbar]      │  Document Summary         │
│                          │  Workflow Position        │
│  [Document preview]      │  Action Buttons           │
│  (scrollable)            │  Comment Textarea         │
│                          │  Submit Button            │
└──────────────────────────────────────────────────────┘
```

### Dashboard Grid

| Breakpoint | KPI Row | Main Grid |
|---|---|---|
| 1280px+ | 4 columns | 3 columns (2+1) |
| 1024px | 4 columns | 2 columns |
| 768px | 2 columns | 1 column |
| < 768px | 1 column | 1 column |

---

## 7. Iconography

**Icon library**: Lucide React (v0.383.0)

### Icon Size Rules

| Context | Size | Notes |
|---|---|---|
| Sidebar navigation | 18px | Consistent visual weight |
| Button with label | 16px (sm: 14px) | Left of label text |
| Icon-only button | 18px | In 36px container |
| Card stat icon | 20px | In 40px colored container |
| Inline with text | 14px | Vertically centered |
| Empty state | 32–48px | Center of empty content area |
| Alert/notification | 16px | Aligned to first line of text |

### Semantic Icon Assignments

| Concept | Icon |
|---|---|
| SP/Legislative | `Scale` |
| Executive/Mayor | `Briefcase` |
| Document tracking | `Activity` |
| Approval workflow | `FileCheck` |
| Document repository | `Folder` |
| Public portal | `Globe` |
| Approved/success | `CheckCircle` |
| Rejected | `XCircle` |
| Overdue/warning | `AlertTriangle` |
| SLA breach | `AlertCircle` |
| Pending/time | `Clock` |
| Return for revision | `RotateCcw` |
| QR code (physical) | `QrCode` |
| Session calendar | `Calendar` |
| Classification: Public | `Globe` |
| Classification: Internal | `Building2` |
| Classification: Confidential | `Shield` |
| Classification: Restricted | `Lock` |
| Tracking number | `Hash` (IBM Plex Mono font) |

---

## 8. Data Display Patterns

### Tracking Numbers

- Always displayed in `IBM Plex Mono` font
- Format: `DTS-{YEAR}-{6-digit sequence}` — never abbreviated
- In tables: left-aligned, green-600 color, behaves as a link
- On cover sheets: 14px+ monospace, prominently placed with QR code

### Document Series Numbers

- Format: `{SP-Number}SP {YEAR}-{NN}` (e.g., `7SP 2026-047`)
- Displayed as heading-level text alongside the document title
- On the DTS timeline page: shown as the document's formal identifier

### SLA/ARTA Indicators

- Compliant (< 80%): No indicator shown (clean)
- Warning (80–100%): Amber `AlertTriangle`, amber text
- Breach (> 100%): Red `AlertCircle`, red text, bold, OVERDUE tag
- Days count: e.g., "4d in queue" — always displayed relative to ARTA deadline

### Philippine Peso Amounts

- Format: `₱{amount:,.2f}` — always with peso sign
- In tables: right-aligned
- Totals: bold, in a shaded row

---

## 9. Motion and Interaction

### Principles

- **Functional, not decorative.** Transitions communicate state, they don't entertain.
- **Fast.** No animation > 200ms on data interactions. Tables appear instantly.
- **Consistent.** All card hover = `box-shadow` transition. All button hover = `background-color` transition.

### Standard Transitions

```css
/* Elements */
transition: all 150ms ease; /* hover states */
transition: all 200ms ease; /* modal open/close */
transition: all 100ms ease; /* focus states */

/* Do NOT use */
/* No bounce, spring, or elastic animations in government data UIs */
/* No entrance animations on table rows */
/* No loading skeletons for instant state changes */
```

### Loading States

- **Global page load**: Spinner in center of content area (brand-primary color)
- **Table refresh**: Subtle opacity fade (opacity: 0.6), spinner in filter bar
- **Form submission**: Button shows spinner, is disabled — no full-page overlay

---

## 10. Accessibility

### Standards Target

WCAG 2.1 AA compliance minimum. Key requirements for this system:

- All interactive elements keyboard-navigable (Tab, Enter, Space, Escape)
- Focus rings visible and styled (2px solid brand-primary, 2px offset)
- Color never used as the *only* indicator of status (dot + text, never dot only)
- All form inputs have explicit `<label>` elements (not placeholders only)
- All icon-only buttons have `title` or `aria-label`
- Tables have proper `<thead>`, `<th scope>`, and `caption` when needed
- Alert messages use `role="alert"` or `aria-live="polite"` for dynamic content
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text and UI components

### Screen Reader Considerations

- Status badges read as: "Status: Approved" not just "Approved"
- Tracking numbers read digit by digit (D-T-S-2-0-2-6-0-0-0-0-4-5) — use `aria-label`
- Timeline entries include `aria-label` with full step description
- QR codes have `alt="QR code for tracking number DTS-2026-000045"`

---

## 11. Language Support

The platform serves three language groups: Filipino, English, Ilocano.

- UI chrome (buttons, labels, navigation): English
- Document content: As-submitted (may be Filipino, English, or mixed)
- Citizen portal: Planned for Filipino/English toggle (Phase 3)
- Error messages: English (Phase 1), Filipino (Phase 3)
- ARTA-mandated output: Follows regulatory language requirements

---

## 12. Document Classification Visual Hierarchy

The classification system is safety-critical: a Restricted document accidentally shown publicly is a legal violation. Visual treatment must make classification impossible to miss.

```
╔═════════════════════════════════════════════════════╗
║  PUBLIC     │ Green tag  │ Globe icon    │ Portal OK ║
║  INTERNAL   │ Blue tag   │ Building icon │ Staff only║
║  CONFIDENTIAL│ Amber tag │ Shield icon   │ Allowlist ║
║  RESTRICTED │ Red tag    │ Lock icon     │ Allowlist ║
╚═════════════════════════════════════════════════════╝
```

**Rule**: Classification badge must appear on every document card, table row, and detail view. It is never omitted for "cleanliness."

**Rule**: The Citizen Portal classification gate is hardcoded, not configurable. `Internal`, `Confidential`, and `Restricted` documents are never exposed regardless of any platform setting.

---

## 13. Print and Physical Document Integration

The system generates printable cover sheets for physical documents. Cover sheet design rules:

- **Cover sheet size**: Standard A4 (210 × 297 mm)
- **QR code position**: Top right of cover sheet, minimum 4cm × 4cm
- **Tracking number**: Below QR code, 14pt IBM Plex Mono
- **Document title**: 12pt semibold
- **Metadata table**: Compact, 10pt, bordered
- **City seal**: Top left, 3cm diameter
- **Retention schedule**: Prominent, bottom of cover sheet
- **"OFFICIAL USE ONLY"** watermark for Internal, Confidential, Restricted

The system never embeds document content in the QR code — only the tracking number. All data is fetched server-side on scan.

---

## 14. Page-Specific Design Notes

### Mayor's Dashboard
- **Primary viewport**: Information at a glance — all pending items visible without scroll on a 1080p display
- **Urgency hierarchy**: Overdue items (red) → Approaching deadline (amber) → Normal (default)
- **KPI cards**: 4 across the top, trend indicators, subtle colored backgrounds

### SP Secretary's Dashboard
- **Calendar widget**: Week-view or month-view of upcoming SP sessions
- **Queue table**: Dense table with type badges (Ordinance = purple, Resolution = blue)
- **Legislative output chart**: Monthly bar chart as a performance overview

### DTS Timeline
- **QR Code display**: Prominently positioned, with print action nearby
- **Timeline direction**: Top = most recent (or top = oldest — follow stakeholder preference; default: chronological top-to-bottom oldest-to-newest)
- **Physical custody tracking**: Shown separately from digital workflow status

### WMS Approval Interface
- **Two-column layout**: Document (60%) + Action panel (40%)
- **Action confirmation**: Require confirmation for Reject and Return for Revision
- **Comment enforcement**: Textarea border turns red if required and empty on submit
- **Workflow position indicator**: Shows where this document is in its full lifecycle

### DMS Repository
- **Filter persistence**: Active filters shown as dismissible tags below the filter bar
- **Column visibility**: Users can toggle column visibility (Phase 2)
- **Bulk selection**: Checkboxes appear on row hover for Records Officer bulk actions
- **Export**: Available to authorized roles only, respects classification rules

### Citizen Portal
- **No authentication required** for tracking number lookup and document library
- **Authentication required** for request submission (OTP verification flow)
- **Language tone**: Plain language, not bureaucratic. "Track your document" not "Document status inquiry."
- **Mobile-first**: Primary use case is a citizen on a smartphone

---

## 15. Design File Organization

```
/design
  /tokens
    colors.json
    typography.json
    spacing.json
    shadows.json
  /components
    buttons.md
    badges.md
    tables.md
    forms.md
    timeline.md
  /pages
    mayor-dashboard.md
    sp-secretary-dashboard.md
    dts-timeline.md
    wms-approval.md
    dms-repository.md
    citizen-portal.md
  DESIGN.md (this file)
```

---

## 16. Version History

| Version | Date | Notes |
|---|---|---|
| 0.1 | June 2026 | Initial design system — pre-requirements gathering baseline. Extracted from batac.gov.ph screenshots and SP Secretariat interview synthesis. All decisions subject to revision after stakeholder walkthroughs. |

---

*City Government of Batac · Ilocos Norte, Philippines*  
*Sangguniang Panlungsod and City Hall Document Management System*  
*Design system for internal development use only — pre-production prototype.*
