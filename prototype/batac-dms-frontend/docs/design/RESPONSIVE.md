# Batac City LGU Platform — Responsive Design Guidelines

**Version:** 0.1 · **Companion to:** `DESIGN.md` §6 (Layout Patterns), `COMPONENT-GUIDELINES.md`
**Scope:** Breakpoints, responsive behavior per page, and touch-target rules. Written against the prototype's Tailwind-based layout.

---

## 1. Breakpoints

Standard Tailwind breakpoints are used throughout:

| Breakpoint | Min width | Primary device class |
|---|---|---|
| (default) | 0px | Mobile phones — primary Citizen Portal and Barangay-official target (`1-domain-context.md` §11.16) |
| `sm` | 640px | Large phones, small tablets (portrait) |
| `md` | 768px | Tablets (portrait), small laptops |
| `lg` | 1024px | Laptops, City Hall secondary monitors |
| `xl` | 1280px | City Hall primary Windows 11 workstations (confirmed primary device, `consolidated-architecture-and-requirements-reference.md` §11.16) |

**Design priority order:** The internal application (Sidebar + AppShell pages) is designed **desktop-first** (`xl` is the primary target, per confirmed City Hall device specs) and degrades gracefully downward. The **Citizen Portal is mobile-first** (per `DESIGN.md` §14 — "Primary use case is a citizen on a smartphone") and scales upward. These are deliberately different design priorities for different shells — do not force one responsive strategy across both.

---

## 2. AppShell (Sidebar + Internal Pages)

### 2.1 Sidebar

| Breakpoint | Behavior |
|---|---|
| `xl` and up | Full sidebar, 256px, expanded by default. User-toggleable to 64px (collapsed/icon-only) via the existing collapse control. |
| `lg` | Sidebar defaults to **collapsed** (64px) to preserve content width; user can still expand. |
| `md` and below | Sidebar becomes an **off-canvas drawer** — hidden by default, opened via a hamburger menu in the TopBar. Overlays content with a scrim when open; closes on navigation or scrim tap. |

**Rationale:** City Hall workstations (confirmed `xl`+) get the full navigation experience. Below `lg`, screen real estate for data tables and the WMS split-panel becomes the priority — navigation should not permanently consume horizontal space.

### 2.2 Top Bar

- Always full-width, fixed height (52px) at all breakpoints.
- Below `md`: the hamburger menu (sidebar toggle) appears on the left; the notification/settings/profile cluster on the right collapses to just the profile avatar + a single overflow (`MoreHorizontal`) menu for notifications/settings.

### 2.3 Dashboard Grids (Mayor's / SP Secretary's)

| Element | `xl`+ | `lg` | `md` | below `md` |
|---|---|---|---|---|
| KPI row (`StatCard` ×4) | 4 columns | 4 columns | 2 columns (2×2) | 1 column (stacked) |
| Main content grid (table + sidebar widgets) | 3 columns (2 + 1) | 2 columns → table full width, widgets below | 1 column, stacked: table first, then widgets | 1 column |
| Charts (`Recharts` `ResponsiveContainer`) | Fixed height (~185–195px) | Same | Reduce to ~160px height | Reduce to ~140px height; consider hiding legend, keep axes |

**Rule:** Never let a `StatCard` go below ~160px width before wrapping to the next row — at narrower widths, the icon + value + trend layout becomes cramped. 2-column at `md` is the practical floor; 1-column below that.

### 2.4 DTS Timeline

| Element | `xl`+ | `md`–`lg` | below `md` |
|---|---|---|---|
| Layout | 3-column grid: 2-col timeline + 1-col sidebar (cover sheet, details, actions) | Stack: timeline full width, then sidebar content below in a 2-column row | Single column, fully stacked: doc header → QR cover sheet → timeline → details → actions |
| QR code in doc header | Shown inline, top-right of the document summary card | Same | Move below the title/metadata — QR + tracking number become a centered block at the top of the stacked card |
| Timeline entry cards | Full detail text always visible | Same | Same — **do not truncate timeline detail text on mobile**; this is the audit record and must remain complete. If space is tight, reduce font size slightly (12px → 11px) rather than truncating content. |

### 2.5 WMS Approval Interface

This is the highest-risk page for small screens — it's a **split panel by design** (PDF viewer + action panel).

| Breakpoint | Behavior |
|---|---|
| `xl`+ | Side-by-side: PDF viewer (flexible width) + 320px fixed action panel, both within a fixed-height container |
| `lg` | Same side-by-side layout, but action panel may narrow slightly (280px) |
| `md` and below | **Stack vertically**: action panel **first** (above the document viewer), document viewer below with a fixed reduced height (~50vh) and its own internal scroll. |

**Why action panel goes first on mobile:** An approver on a phone needs the decision controls (Approve/Return/Reject + comment) reachable without scrolling past a long document first. The document remains available below for reference, but the action panel — including the Workflow Position summary — is the primary content on small screens.

**Touch consideration:** The three action-selector cards (Approve/Return/Reject) must each meet the 44×44px minimum touch target (§5) even when stacked at full width on mobile — their current padding (`p-3`) at full width comfortably exceeds this.

### 2.6 DMS Repository

| Breakpoint | Behavior |
|---|---|
| `xl`+ | Full table: all 7 columns + action column, filter bar as a 4-column grid |
| `lg`–`md` | Filter bar grid drops to 2 columns (wraps to 2 rows). Table gains horizontal scroll (`overflow-x-auto`, already present) — **Tracking Number column should become `sticky left-0`** so it remains visible while scrolling horizontally through Title/Type/Office/etc. |
| below `md` | Filter bar becomes 1 column (fully stacked selects). **Table converts to a card-list view**: each document renders as a card showing Tracking No. + Title + Status + Classification badges stacked, with Type/Office/Date as smaller metadata lines and action icons always visible (not hover-revealed, since there's no hover on touch) |

**Rule:** The card-list fallback for mobile DMS is a **different component**, not a CSS-only reflow of the `<table>` — `<table>` elements reflow poorly below `md`. Build `DocumentCard` as a sibling component sharing the same filtered data source as the table, and switch between them based on breakpoint (e.g., `hidden md:block` on the table, `block md:hidden` on the card list).

---

## 3. Citizen Portal (Mobile-First)

The Citizen Portal has no sidebar and is built mobile-first — the prototype's `max-w-4xl mx-auto` centering pattern already scales up correctly; the responsive work is mostly about the **down-scaling** from that 4xl container to a phone viewport.

### 3.1 Header

| Breakpoint | Behavior |
|---|---|
| `md`+ | Seal + 3-line text block on the left, contact info (phone/address) on the right, single row |
| below `md` | Contact info row is **hidden** (or moved to the footer) — it's not essential for the primary tasks and competes for space with the seal/title. Seal size may reduce slightly (52px → 44px) but should not go below `CitySealOfficial`'s 48px minimum (`COMPONENT-GUIDELINES.md` §7) — if space is truly constrained, switch to `CitySeal` (simplified mark) at mobile header sizes rather than shrinking the official artwork below its minimum. |

### 3.2 Tab Bar

| Breakpoint | Behavior |
|---|---|
| `md`+ | Three tabs side-by-side with icon + full label, as in the prototype |
| below `md` | Tabs remain side-by-side (only 3 — manageable) but **icon-only with label below** (stacked icon+text within each tab) if "Submit a Request or Complaint" doesn't fit on one line at narrow widths. Each tab must still meet the 44px touch-target height. |

### 3.3 Track Tab

- The search input + button: at `md`+, side-by-side (`flex gap-3` as in prototype). Below `md`, **stack** — full-width input, full-width button below it. A 44px-tall input with an adjacent button often becomes too narrow on phones otherwise.
- Result card's 3-column metadata grid (Status / Office / Last Updated) → 1 column below `md`.

### 3.4 Library Tab

- Each ordinance/resolution card: at `md`+, icon + text on the left with actions on the right in one row (as in prototype). Below `md`, **stack**: icon+text row, then action buttons (View/PDF) full-width below, side-by-side with each other (2-column mini-grid) so they remain easily tappable.
- The search input in the section header: full-width below `md`, not constrained to `w-56`.

### 3.5 Submit Tab

- The 2-column form grid (Type/Office/Name/Contact) → **1 column below `md`** — this is already a general form rule from `COMPONENT-GUIDELINES.md` §14, restated here for emphasis because this is the longest form in the system and most likely to be filled out on a phone.
- File upload dropzone: full-width at all sizes; ensure the tap target for "Click to upload" covers the entire dashed box, not just the text.

---

## 4. Charts (Recharts)

`ResponsiveContainer` already handles width fluidly. Additional rules:

- Below `md`, reduce `barSize` (e.g., from 18–20px to 12–14px) so multi-series bar charts (Department Workload, Legislative Output) don't become illegibly cramped with 5–6 categories.
- Legends (`<Legend>`) may wrap to two lines below `md` — ensure the chart container has enough bottom margin to accommodate this without clipping.
- Never hide the Y-axis entirely (even at small sizes) — SLA/compliance percentages and counts are the point of the chart; an axis-less chart becomes decorative rather than informational, which conflicts with `DESIGN.md` §9's "functional, not decorative" motion/visual principle.

---

## 5. Touch Targets

Minimum **44×44px** for all interactive elements on any touch-capable viewport (this applies at all breakpoints where a touchscreen is plausible — i.e., everything below `xl`, and the Citizen Portal at every breakpoint since phones are its primary device):

| Element | Prototype default | Mobile adjustment needed? |
|---|---|---|
| `Btn` size `md`/`lg` | `py-2`/`py-2.5` (~36–40px with text) | Increase vertical padding slightly on touch breakpoints, or accept ~40px as sufficient given WCAG 2.1's target is a guideline rather than hard 44px requirement — but prefer 44px where layout allows |
| `Btn` size `xs`/`sm` (table row actions) | ~24–28px | **Must not** be the only way to perform an action on mobile — mobile card-list view (§2.6) should use full-size buttons, not `xs`/`sm` |
| Tab triggers (Citizen Portal) | `py-4` (~56px including text) | Already compliant |
| Checkbox (privacy consent) | Native `<input type="checkbox">`, small visual size | Ensure the **label text is also clickable** (via `<label htmlFor>`) so the effective tap target includes the full label line, not just the tiny checkbox square |
| Sidebar nav items | `py-2.5` (~40px) | Acceptable for mouse-driven desktop sidebar; if the off-canvas mobile drawer (§2.1) is used, increase to `py-3` (~48px) for touch |

---

## 6. Testing Matrix

| Viewport | Pages to verify |
|---|---|
| 1920×1080 (City Hall primary) | All — this is the primary design target |
| 1366×768 (smaller City Hall monitors / laptops) | Dashboards (KPI row wrapping), WMS split panel |
| 1024×768 (`lg`/tablet landscape) | Sidebar collapse behavior, DMS table horizontal scroll |
| 768×1024 (tablet portrait) | Sidebar drawer, DMS card-list threshold, WMS stacking |
| 414×896 (large phone — Citizen Portal primary) | All Citizen Portal tabs, especially Submit form |
| 360×640 (smaller Android — Barangay personal phones, per `1-domain-context.md` §11.16) | Citizen Portal minimum viable experience; if internal pages must ever be used here (Barangay context, Phase 2+), DTS Timeline and a read-only DMS view are the most likely candidates |

---

*City Government of Batac · Ilocos Norte, Philippines*
*Responsive design guidelines for internal development use only — pre-production prototype.*
