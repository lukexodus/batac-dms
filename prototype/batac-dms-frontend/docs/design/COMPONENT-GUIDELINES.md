# Batac City LGU Platform — Component Guidelines

**Version:** 0.1 · **Companion to:** `DESIGN.md`, `ACCESSIBILITY.md`
**Scope:** Per-component usage guidance for every component defined in `batac-lgu-prototype.jsx`. Each entry covers purpose, anatomy, variants, when to use / not use, and do's & don'ts.

---

## 1. `Btn`

**Purpose:** The single button component for all actions across the platform — never use raw `<button>` with ad-hoc styling.

**Variants:** `primary` · `secondary` · `danger` · `warning` · `ghost` · `outline`
**Sizes:** `xs` · `sm` · `md` · `lg`

| Variant | When to use |
|---|---|
| `primary` | The one main action on a panel/card (Sign, Approve, Submit Request, Log New Document) |
| `secondary` | Supporting actions (Export, Download, View, Print) |
| `danger` | Reject, irreversible/destructive actions — always paired with confirmation or mandatory comment |
| `warning` | Return for Revision — a "soft negative" that isn't final rejection |
| `ghost` | Low-emphasis inline actions (e.g., "View All" links inside a `SectionHdr`) |
| `outline` | Citizen Portal secondary CTAs where a filled secondary would compete with the primary action |

### Do's
- ✅ One `primary` button per logical action group. Two primary buttons side-by-side creates ambiguity about which matters more.
- ✅ Always pair `danger`/`warning` buttons with an icon (`X`, `RotateCcw`) — never color alone (see `ACCESSIBILITY.md` §2.3).
- ✅ Use `size="xs"` only inside dense table rows or card action rows; `size="lg"` only for the single most important action on a page (e.g., Citizen Portal "Submit Request").

### Don'ts
- ❌ Don't use `danger` for navigation or non-destructive actions (e.g., "Back" should never be a red button).
- ❌ Don't disable a button without explaining why nearby — a disabled "Confirm" button with no visible reason is a dead end for the user.
- ❌ Don't use `ghost` for primary actions — its low contrast is intentional for secondary/tertiary actions only.

---

## 2. `StatusBadge`

**Purpose:** Communicates a document or workflow instance's **current lifecycle state**. This is the single vocabulary for "where is this document right now."

**Anatomy:** Colored dot + text label, pill shape, `bg-{color}-100` / `text-{color}-700` pairing (see `ACCESSIBILITY.md` §2.2 for contrast rules).

**Canonical status values** (do not invent new ones without updating `statusConfig` and `CONTENT-STYLE-GUIDE.md` §3):
`Approved`, `Released`, `Completed`, `In Workflow`, `Pending Approval`, `In Committee`, `For 1st Reading`, `For 2nd Reading`, `3rd Reading`, `VP Certification`, `Under Investigation`, `Rejected`, `Draft`, `Archived`.

### Do's
- ✅ Use on every document reference: table rows, cards, detail headers, timeline "current step" markers.
- ✅ When a status doesn't exist yet in `statusConfig`, add it there first — don't inline a one-off color.

### Don'ts
- ❌ Don't abbreviate status text ("Pend. Appr.") — screen readers and scanning users need the full word.
- ❌ Don't use `StatusBadge` for classification (Public/Internal/Confidential/Restricted) — that's `ClassificationBadge`. These are two different axes of meaning and must never be visually conflated.

---

## 3. `ClassificationBadge`

**Purpose:** Communicates a document's **security/visibility level** — a legally significant attribute, independent of workflow status.

**Anatomy:** Square-cornered tag (not a pill — deliberately distinct from `StatusBadge`'s rounded shape, reinforcing that this is a different *kind* of information) + icon + text.

**Canonical values:** `Public` (Globe icon, green) · `Internal` (Building2 icon, blue) · `Confidential` (Shield icon, amber) · `Restricted` (Lock icon, red).

### Do's
- ✅ Show on **every** document card, table row, and detail view — per `DESIGN.md` §12, this is never omitted "for cleanliness."
- ✅ In the DMS Repository filter bar, always include a Classification filter — Records Officers and auditors need to scope by this axis routinely.

### Don'ts
- ❌ Don't make Classification user-editable inline in a table — classification changes are a deliberate workflow action (with audit trail), never a quick dropdown edit in a list view.
- ❌ Don't ever let a `Confidential` or `Restricted` document render with a `Public` badge on the Citizen Portal — this is a hardcoded gate, not a display preference (`DESIGN.md` §12).

---

## 4. `PriorityTag`

**Purpose:** A small, square, ALL-CAPS flag for time-sensitivity — `overdue` or `urgent`. Returns `null` (renders nothing) for `normal` priority, so it never adds visual noise to the common case.

### Do's
- ✅ Use only for genuinely time-bound urgency (ARTA deadline breaches, certified-urgent legislative items).
- ✅ Always pair with the actual day-count or deadline text nearby (e.g., "4d in queue · Due: June 7, 2026") — the tag flags it, the text explains it.

### Don'ts
- ❌ Don't use for general "important" flagging unrelated to time — that's a different concept and would dilute the signal.
- ❌ Don't stack multiple `PriorityTag`s on one item — a document is either overdue or not; avoid "OVERDUE URGENT CRITICAL" tag soup.

---

## 5. `StatCard`

**Purpose:** Top-of-dashboard KPI display. Four per dashboard, in a single row on desktop.

**Anatomy:** Icon in a colored container (top-right) + small label + large value + optional subtitle + optional trend indicator.

**Color prop:** `green` (default/positive) · `amber` (attention) · `red` (critical) · `blue` (informational/neutral) · `purple` (legislative-specific).

### Do's
- ✅ Keep the `value` short — a single number, percentage, or short count. If the value needs a sentence, it belongs in the subtitle, not the headline number.
- ✅ Use `trend`/`trendValue` only when there's a genuine month-over-month comparison; omit entirely rather than showing a fake "—" or "0%".
- ✅ Match `color` to meaning: `red` for overdue/breach counts, `amber` for "needs attention soon," `green` for compliance/positive metrics, `blue`/`purple` for neutral volume counts.

### Don'ts
- ❌ Don't exceed 4 `StatCard`s in the top row on desktop — this is a deliberate "at a glance" limit (`DESIGN.md` §14, Mayor's Dashboard notes).
- ❌ Don't use `red` color for a card that isn't actually a problem — reserve red for genuine alerts, or the dashboard cries wolf.

---

## 6. `PageHdr` and `SectionHdr`

**Purpose:** Two-tier heading system. `PageHdr` is used once per page (title, optional subtitle, breadcrumb, page-level actions). `SectionHdr` is used for each card/panel within the page (smaller title, optional subtitle, optional inline action).

### Do's
- ✅ Every page gets exactly one `PageHdr`, with a `breadcrumb` array reflecting the sidebar nav hierarchy (e.g., `["Operations", "Document Repository"]`).
- ✅ `PageHdr` actions are page-level (Export Report, Refresh, Upload) — `SectionHdr` actions are scoped to that one panel (View All, Log New).

### Don'ts
- ❌ Don't put more than 2–3 actions in a `PageHdr` — if there are more, they belong in a menu (`MoreHorizontal`) or are mis-scoped and should live closer to the relevant section.
- ❌ Don't use `SectionHdr` for the page's main title — that visual weight is reserved for `PageHdr`.

---

## 7. `CitySeal` / `CitySealOfficial`

**Purpose:** The two approved forms of the City Seal. See `BRAND.md` §2 for full usage rules — summary below.

| Component | Form | Use when |
|---|---|---|
| `CitySeal` | Simplified SVG mark | Size < 48px — sidebar, favicons, compact badges |
| `CitySealOfficial` | Full artwork (`<img>`) | Size ≥ 48px — Citizen Portal header, cover sheets, login screens |

### Do's
- ✅ Always pass a `size` prop matching the layout context — don't rely on CSS to resize, since the SVG's internal proportions (text, stars) are tuned for the 100×100 viewBox at specific target sizes.
- ✅ Always include the seal's `aria-label`/`alt` (already built into both components) — never strip it.

### Don'ts
- ❌ Don't use `CitySealOfficial` below 48px — the JPEG detail becomes mud at small sizes; use `CitySeal` instead.
- ❌ Don't recolor, rotate, or apply CSS filters (`hue-rotate`, `grayscale`, etc.) to either form — see `BRAND.md` §2.4.

---

## 8. `QRDisplay`

**Purpose:** Visual placeholder for a tracking-number QR code. **This is a non-functional visual approximation** — it generates a QR-pattern-looking grid via deterministic math, not a real scannable code.

### Do's
- ✅ Always place inside a dark container (`bg-gray-900` or `bg-black` with padding) — this matches real QR code presentation (white module on dark "frame") and is the pattern used in both the DTS Timeline header and the cover-sheet sidebar.
- ✅ Always pair with the tracking number in `IBM Plex Mono` directly below or beside it — the QR code is never shown without its corresponding human-readable tracking number (per `DESIGN.md` §13, "never embed document content in the QR code").

### Don'ts
- ❌ Don't use `QRDisplay` in the real application — replace with the actual `qrcode` library output (per `tech-stack.md` stack decisions) encoding the real tracking ID. This component exists for prototype visual fidelity only.
- ❌ Don't resize below ~64px — the deterministic pattern becomes visually noisy and less "QR-like" at small sizes.

---

## 9. Sidebar Navigation

**Purpose:** Primary navigation for the internal application (Mayor, SP Secretary, Operations staff). Not used on the Citizen Portal, which has its own header/tab navigation (see §13).

**Anatomy:** Seal + wordmark lockup → grouped nav items (`PROTOTYPE` / `DASHBOARDS` / `OPERATIONS` / `PUBLIC`) → user profile + collapse toggle.

### Do's
- ✅ Group navigation by **mental model**, not alphabetically — "Dashboards" vs "Operations" vs "Public" reflects how a user thinks about *what kind of task* they're doing.
- ✅ Active state uses `nav-active` (solid brand green) + a small light-green indicator bar on the right edge — two redundant signals for the active item.
- ✅ Collapsed state (64px) keeps icons + `title` attributes for tooltips — never collapse to icons with zero accessible label.

### Don'ts
- ❌ Don't add more than 4 groups — additional groups should be nested or reconsidered as the platform grows (Phase 2 modules like Records Management should likely join "Operations," not create a 5th top-level group).
- ❌ Don't remove the "PROTOTYPE" group in the real application — it exists only for this demo; its presence in production would be a bug, not a feature, and is flagged in `DESIGN-HANDOFF.md`.

---

## 10. Data Table (DMS Repository pattern)

**Purpose:** The TanStack-Table-aligned pattern for all tabular document data.

**Anatomy:** Filter bar (search + dropdowns + active-filter pills) → results count + sort control → table (sticky `gray-50` header, sortable column chevrons, 48px rows) → pagination footer.

### Do's
- ✅ Every filterable table includes: Document Type, Originating Office, Status, and Classification Level filters as a baseline — these four axes recur across every document-bearing page in this system (per the task's DMS requirements).
- ✅ Row hover reveals action icons (`Eye`, `Activity`, `Download`, `MoreHorizontal`) via `opacity-0 group-hover:opacity-100` — **must also trigger on `group-focus-within`** for keyboard users (see `ACCESSIBILITY.md` §3.2).
- ✅ Active filters render as dismissible pills below the filter bar — users should never wonder "why is this list short?" without a visible reason.
- ✅ Empty state (`Search` icon + message + "Clear all filters" link) replaces the table body entirely — never an empty white box.

### Don'ts
- ❌ Don't make the Tracking Number column anything but the **first column** and **monospace** — it is the primary cross-reference key across DTS/WMS/DMS and must be visually consistent everywhere.
- ❌ Don't hide the Classification column behind a "show more columns" toggle — per `DESIGN.md` §12, classification is never optional-to-display for staff users.

---

## 11. Timeline (DTS pattern)

**Purpose:** Chronological routing history — the visual core of the Document Tracking System.

**Anatomy:** Vertical spine (dot + connecting line per entry) → entry card (action title, office, detail text, actor + timestamp).

**States:**
- **Completed** — white dot with green check icon, `bg-gray-50` card
- **Current** — solid green dot with clock icon, green-tinted card (`#F0FAF4` bg, green border), "CURRENT" badge

### Do's
- ✅ Always render top-to-bottom in chronological order, oldest first (per `DESIGN.md` §14 default — confirm against stakeholder preference before locking in for production, see Q-INT items in `consolidated-architecture-and-requirements-reference.md` Part 14).
- ✅ Every entry shows: action taken, office/committee, free-text detail, actor name + role, and a monospace timestamp — all five fields, every time. Partial entries undermine the "tamper-evident audit trail" framing.
- ✅ The current step gets exactly one visual treatment (green card + CURRENT badge + clock icon) — don't add additional emphasis (no pulsing, no extra borders) per `DESIGN.md` §9 motion principles.

### Don'ts
- ❌ Don't collapse or truncate timeline entries by default — if the list grows very long (e.g., a heavily-amended ordinance), prefer pagination/"load earlier history" over hiding entries silently.
- ❌ Don't reuse the timeline component for non-chronological data (e.g., don't repurpose it as a generic "list with icons" — its semantics (completed/current/pending + chronology) are specific).

---

## 12. WMS Action Panel

**Purpose:** The approve/return/reject decision interface — the highest-stakes interaction pattern in the system (it changes a document's legal status).

**Anatomy:** Document Summary card → Workflow Position card → Take Action card (three action selectors + conditional comment field + submit button).

### Do's
- ✅ The three action options (Approve / Return for Revision / Reject) are always presented **together, with equal visual prominence** — never default-select one or visually emphasize "Approve" over "Reject." The interface must not nudge toward approval.
- ✅ The comment field's required/optional state is **driven by the selected action** (optional for Approve, required for Return/Reject) — and this must be communicated before submission attempt, not only as a post-submit error.
- ✅ The submit button's label and color change to match the selected action (`Confirm Approval` / green, `Send for Revision` / amber, `Confirm Rejection` / red) — the button never says generic "Submit."
- ✅ Workflow Position is always visible during review — the approver should never have to leave the screen to understand "what happens after I click this."

### Don'ts
- ❌ Don't allow submission with an empty required comment — the disabled-state + red-border pattern (see code) must hold even if a user tries to bypass via keyboard Enter on the textarea.
- ❌ Don't auto-advance to the next document after submission without an explicit confirmation screen — the result screen (showing what was submitted and to whom) is a deliberate checkpoint, not a "toast and move on."

---

## 13. Citizen Portal Tabs

**Purpose:** Top-level navigation for the public portal — replaces the internal sidebar entirely.

**Anatomy:** Three tabs (`Track a Document` / `Ordinances & Resolutions` / `Submit a Request or Complaint`), each with an icon, underneath the government header.

### Do's
- ✅ Tab labels are plain-language verbs/nouns, never module acronyms (see `BRAND.md` §4.3 and `CONTENT-STYLE-GUIDE.md`).
- ✅ "Track" requires zero authentication — this must never regress, as it's the system's primary stated value (`consolidated-architecture-and-requirements-reference.md` Part 7.1).
- ✅ The active tab uses the same brand green underline used for active states elsewhere — visual consistency between "this is selected" across internal and public surfaces, even though the surrounding chrome differs entirely.

### Don'ts
- ❌ Don't add a 4th top-level tab without strong justification — three is the limit for a portal whose primary users may have low digital literacy; additional functions should nest under "Submit" or become a footer link instead.
- ❌ Don't gate the "Library" (Ordinances & Resolutions) tab behind login — published legislative documents are `Public` classification by definition and must remain openly browsable.

---

## 14. Form Patterns (general)

Applies to: `KitchenSinkPage` form section, WMS comment field, Citizen Portal "Submit" tab.

### Do's
- ✅ Label every field, above the input, in the `uppercase text-[11px] tracking-wide text-gray-500` style — consistent across internal and citizen-facing forms.
- ✅ Required fields: red asterisk in the label, **plus** the word "required" where the field's importance might not be obvious from context (see `ACCESSIBILITY.md` §4.5 and §5).
- ✅ Group related fields visually (e.g., the Citizen Portal "Submit" form's 2-column grid for Type/Office/Name/Contact) — but always collapse to a single column on mobile (see `RESPONSIVE.md`).
- ✅ File upload zones use the dashed-border pattern with `Upload` icon + instructions text (file types, size limit) — never a bare `<input type="file">`.

### Don'ts
- ❌ Don't use placeholder text as the only field identifier — placeholders disappear on input and are not reliably announced by all screen readers.
- ❌ Don't validate on every keystroke for free-text fields (titles, descriptions) — validate on blur or submit, to avoid error messages flashing while the user is still typing.

---

*City Government of Batac · Ilocos Norte, Philippines*
*Component guidelines for internal development use only — pre-production prototype.*
