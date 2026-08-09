# F6 — Accessibility Compliance Checklist (WCAG 2.1 AA)

`batac-dms` · `/apps/web` · Version 1.0
**Status:** Pre-development specification — PR acceptance criteria checklist
**Audience:** Frontend development team — internal reference; applies to every `apps/web` pull request
**Source files:** `DESIGN.md` v1.0 (§5, §6.3–§6.6, §8 Rules 5/10/11/12), `globals.css`, F5 — UI Component Library Setup and Package Architecture (component inventory, Tier 1/2/3 tables)

## Table of Contents

- [L32–L37] 1. Scope and Compliance Target — WCAG 2.1 AA target, primary/secondary test environments, NVDA+Chrome and VoiceOver+Safari screen reader pairings, and this document's relationship to PR review.
- [L38–L51] 2. Universal Rules (apply to every PR) — Seven single-statement, reviewer-testable rules covering focus rings, touch targets, hardcoded colors, reduced motion, the lang attribute, document title, and color-only meaning.
- [L52–L252] 3. Component-Specific Checklist — Required ARIA attributes, keyboard contract, and screen reader announcement for the ten Tier 3 components with non-trivial accessibility requirements.
  - [L56–L74] 3.1 `SLATimer` — Timer/progressbar roles, the aria-live="polite" requirement, and aria-valuenow clamping.
  - [L75–L97] 3.2 `WorkflowStepIndicator` — Ordered-list structure, aria-current/aria-label/aria-disabled per step state, and the resolved pending/error ARIA treatment.
  - [L98–L113] 3.3 `QRCodeDisplay` — role="img" flattening behavior and the required sibling-not-child placement of the document number text.
  - [L114–L130] 3.4 `OrderOfBusinessRow` — Flag icon and Certified Urgent chip labeling, and keyboard activation of the row.
  - [L131–L152] 3.5 Sidebar navigation — Active-item and collapse-toggle ARIA, plus a documented conflict with F5's hidden-attribute label treatment.
  - [L153–L173] 3.6 Topbar command palette — Focus trap, initial focus, and Escape-to-trigger return for the ⌘K palette.
  - [L174–L192] 3.7 Dialog / Modal — Radix focus-trap defaults, aria-describedby for destructive confirmations, and native-disabled submit gating.
  - [L193–L210] 3.8 `DataTable` (TanStack Table + Tier 1 shadcn `Table`) — Native table markup requirement, aria-sort placement on the th, and row-selection checkbox labeling.
  - [L211–L229] 3.9 `FileUpload` dropzone — Region/live-region ARIA and the keyboard-operability limits of native drag-and-drop.
  - [L230–L252] 3.10 Toast (Sonner) — Verified finding that Sonner's default behavior does not differentiate aria-live by toast variant, and the required role="alert" override.
- [L253–L266] 4. Form Accessibility Rules — Label/id association, role="alert" error messages, and aria-required for every form field, plus an open question on the DatePicker trigger element.
- [L267–L281] 5. Keyboard Navigation Contract — Table of required key bindings across the app, plus the sidebar collapse tab-order requirement.
- [L282–L301] 6. Color Contrast Reference Table — Computed WCAG 2.1 contrast ratios for nine token pairs and the explicit text-muted correction note.
- [L302–L337] 7. PR Review Gate — One-page checklist version of §2–§5 formatted for pasting directly into a PR review comment.

---

---

## 1. Scope and Compliance Target

This document defines the WCAG 2.1 Level AA compliance target for `batac-dms`'s internal web application (`/apps/web`) and, by inheritance, for the Phase 3 public portal (`/apps/portal`) when it is built. Level AAA is explicitly out of scope — no item in this document tests against an AAA success criterion, and no PR should be blocked on an AAA-only concern. The application is fully authenticated, so public search-engine or anonymous-screen-reader concerns do not apply, but WCAG AA remains an operational obligation rather than an optional nicety: SP Secretariat staff and LGU employees who use the system daily may have visual or motor impairments, and disability-inclusion mandates under the ARTA framework apply to government information systems regardless of whether the audience is internal or public. The primary test environment is a Windows 11 workstation at City Hall, used with keyboard and mouse, tested with **NVDA + Chrome** as the canonical screen reader and browser pairing. The secondary test environment is a personal smartphone used by barangay-level users for touch interaction, tested with **VoiceOver + Safari (iOS)**. Every item in this document must pass in the primary environment before merge; the secondary environment is required for any component that ships to a barangay-facing flow and is otherwise treated as a strong recommendation rather than a hard gate until the portal work begins. This document is the canonical accessibility reference for `apps/web`: §2–§5 are the standards a Tier 3 component or app view must meet to be considered complete, §6 is the verified contrast baseline every new color pairing is checked against, and §7 is the operational PR Review Gate — a condensed checklist a reviewer pastes directly into a pull request review comment. A PR that fails any applicable §7 item is not merge-ready regardless of functional correctness elsewhere in the diff.

---

## 2. Universal Rules (apply to every PR)

Each item below is a single statement a reviewer can check in 60 seconds or less by reading the diff and, where noted, the rendered component in DevTools.

1. **No interactive element overrides the global focus ring.** The `:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }` rule in `globals.css` (lines 313–316) is the single focus-ring implementation for the app. **Test:** grep the component diff for `outline: none`, `outline: 0`, or `focus:outline-none`. If present without an equal-or-greater-visibility replacement, reject. [DESIGN.md §8 Rule 10; `globals.css` lines 312–316]
2. **Every interactive element meets the 44×44px touch-target minimum, or carries `.touch-exempt`.** `.touch-exempt` is permitted on exactly three components — `DocumentNumberBadge`, `StatusBadge`, `ScanQualityIndicator` — all non-actionable display chips. **Test:** search the diff for `.touch-exempt`; any appearance outside these three components is a reject. [DESIGN.md §5, §8 Rule 11; `globals.css` lines 328–343]
3. **No hardcoded `#ffffff` or `#000000`** (or any hex/HSL/RGB literal) in a component file. All color references resolve through Tailwind utilities generated from the `@theme {}` block. **Test:** grep the diff for hex literals (`#fff`, `#000`, six- or three-digit hex) and `rgb(`/`hsl(` inside `style={{}}` props; any match outside `globals.css`/`tokens.css` is a reject. [F5 §2 Confirmed Technology Lock-in — "No hardcoded hex, HSL, or RGB values"]
4. **Component-level CSS adds no `!important` to any animation or transition property.** The global `prefers-reduced-motion` query (`globals.css` lines 318–326) already applies `!important` to `animation-duration`, `animation-iteration-count`, `transition-duration`, and `scroll-behavior`. A component-level `!important` on the same properties, declared later in the cascade, can re-introduce motion for a reduced-motion user. **Test:** grep the component's CSS/inline styles for `!important` on any `animation-*`/`transition-*` property; any match is a reject. [`globals.css` lines 318–326]
5. **The root `<html>` element still carries `lang="en"`.** **Test:** confirm the diff does not touch `index.html`'s `<html>` tag, or, if it does, that `lang="en"` is still present. [Confirmed — `index.html`]
6. **The routed view updates `document.title` on mount.** **Test:** open the new or changed route and confirm the browser tab title reflects the current view name, not a stale title carried over from the previous route or the app's default title.
7. **No status, state, or meaning is conveyed by color alone.** Every `StatusBadge` instance renders with its left-border accent (the redundant non-color signal from DESIGN.md §7), and no new UI element introduces a color-only signal — for example, a colored dot with no accompanying icon, label, or border treatment. **Test:** view the component with a grayscale filter (Chrome DevTools → Rendering → Emulate vision deficiencies → Achromatopsia) and confirm every state distinction the color version conveys is still visible. [DESIGN.md §7, §8 Rule 2]

---

## 3. Component-Specific Checklist

One subsection per Tier 3 component with non-trivial ARIA requirements. Each covers the required ARIA attributes, the keyboard interaction contract, the expected screen reader announcement, and a PR check a reviewer can run directly.

### 3.1 `SLATimer`

`SLATimer` only renders on documents in `PENDING_MAYOR` or `PANLALAWIGAN_REVIEW` — per DESIGN.md §8 Rule 6, it must not render on `VALID`, `ARCHIVED`, `CANCELLED`, `DRAFT`, or `VETOED` documents, so a reviewer who sees it rendered on one of those states should reject on a state-logic ground before reaching the items below. [DESIGN.md §6.3 SLA Timer; §8 Rule 6]

**Required ARIA attributes**
- Outer timer container: `role="timer"`, `aria-label="SLA: {N} days remaining"`, `aria-live="polite"` so the updated label is announced without interrupting the user's current task. [DESIGN.md §6.3]
- `aria-live="assertive"` must not be used on this region — DESIGN.md §6.3 calls this out directly, because an assertive region interrupts on every value update, which is disruptive rather than informative for a slow-moving countdown.
- Inner progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`. `aria-valuenow` represents the percentage of the SLA window elapsed and must be clamped to the 0–100 range for ARIA purposes even when the underlying document is breached and the true elapsed percentage exceeds 100 — the visual badge and the label text (e.g., "3 days overdue") carry the breach detail separately, since `aria-valuenow` cannot exceed `aria-valuemax` without violating the ARIA value-range contract. **[Inference]** — DESIGN.md §6.3 specifies the three roles and the elapsed-percentage thresholds (80%, 100%) but does not state the clamping behavior explicitly; clamping follows from the ARIA specification's valuemax constraint, not from an explicit DESIGN.md instruction.

**Keyboard interaction contract**
- `SLATimer` is a read-only status display. It is not part of the tab order and has no key bindings of its own. A future interactive variant (e.g., a clickable timer opening SLA detail) would need its own `tabindex="0"` and Enter/Space handling — out of scope for the current spec.

**Screen reader announcement**
- On first encounter, NVDA reads the `role="timer"` region using its `aria-label` as the accessible name: "timer, SLA: 6 days remaining." On a label update, the `aria-live="polite"` region announces the new label text once NVDA's speech queue clears. **[Inference]** — exact phrasing and timing depend on NVDA's verbosity settings, which are not independently tested for this spec.

**PR check:** confirm `role="timer"` + `aria-live="polite"` (never `assertive`) on the outer container, and `role="progressbar"` + all three `aria-value*` attributes on the inner bar, with `aria-valuenow` clamped to ≤100.

---

### 3.2 `WorkflowStepIndicator`

Per F5 §4.3, `WorkflowStepIndicator` renders the same DOM structure at both the ≥768px horizontal layout and the <768px vertical layout — only the CSS changes — so the `<ol>`/`<li>` structure and every ARIA attribute below must hold in both states. [F5 §4.3 WorkflowStepIndicator; DESIGN.md §6.3 Workflow Step Indicator]

**Required ARIA attributes**
- The step list is an `<ol>` — sequence is legislative and load-bearing, not decorative — and each step is an `<li>`.
- The active step's `<li>` carries `aria-current="step"`.
- A completed step's `<li>` carries `aria-label="{step name} — completed"` (the `aria-label` replaces the visible text as the accessible name; it is not additive to it).
- A skipped step's `<li>` carries `aria-disabled="true"`.
- Pending and error step states are visually specified in DESIGN.md §6.3 (`neutral-200` ring for pending; `danger-500` ring for error); DESIGN.md does not specify ARIA attributes for either state. **Resolved by the A1 UI module pass, with human authorization** — see `docs/pre-development/A-project-planning/a1-tasks/ui.md`, `TASK-UI-016`: pending steps carry no special ARIA attribute beyond their position in the list (no `aria-current`, no completed-style `aria-label`) — that position, combined with the visual ring treatment, already communicates "not yet reached" without an explicit attribute. Error steps carry `aria-label="{step name} — error"`, mirroring the completed-step pattern for consistency. This was previously recorded in this document as a `[Speculation]` default; it is now the confirmed requirement.
- If a step renders the optional `Tooltip` (the `WorkflowStep.tooltip` field in F5 §4.3), the step's trigger element must itself be focusable. Radix `Tooltip` shows on focus as well as hover, but only if the wrapped trigger is a native focusable element (a `<button>`) or carries an explicit `tabindex="0"`; a non-focusable `<li>` with a tooltip attached to a non-interactive child makes the tooltip mouse-only, which fails WCAG 1.4.13 (content on hover or focus).

**Keyboard interaction contract**
- The indicator is a read-only progress visualization, not an interactive control, per the current spec — not part of the tab order and no key bindings of its own, except for any individual step rendering a `Tooltip`, which must be reachable via Tab so the tooltip is exposed to keyboard users.

**Screen reader announcement**
- The `<ol>` causes NVDA to announce "list, N items" on entry, then for each `<li>` the visible label or the `aria-label` override (for completed/skipped/error steps). The active step's `aria-current="step"` is read as part of NVDA's standard `aria-current` handling, commonly something like "{label}, current step." **[Unverified]** — the literal wording is NVDA-version-dependent and has not been independently tested for this app's markup.
- `aria-disabled="true"` on a skipped step's `<li>` carries a real risk worth flagging: `aria-disabled` is reliably announced on elements with a widget role (buttons, links, and similar); support for `aria-disabled` on a plain `<li>` with no interactive role is inconsistent across screen readers, since the attribute is most commonly tested against form controls. **[Unverified]** whether NVDA announces "dimmed" or "unavailable" for a disabled `<li>` in this app's actual markup — confirm with live NVDA testing rather than assuming the attribute alone communicates skipped status. The dashed border and `neutral-100`/`neutral-400` visual treatment should be treated as the primary signal, with `aria-disabled` as a supplementary one.

**PR check:** confirm `<ol>`/`<li>` structure (not `<div>`/`<div>`); `aria-current="step"` on exactly one step; `aria-label` suffix on completed steps; `aria-label="{step name} — error"` on error steps; `aria-disabled="true"` on skipped steps; no special attribute on pending steps beyond list position; any step with a `Tooltip` has a focusable trigger.

---

### 3.3 `QRCodeDisplay`

**Required ARIA attributes**
- The QR image container carries `role="img"` and `aria-label="QR code for document {documentNumber}"`. [DESIGN.md §6.6 QR Code Display; F5 §4.3 QRCodeDisplay]
- The document number (`font-mono text-xs`) and document title (`text-sm text-text-secondary`) render in a `<p>` element that is a **sibling of**, not a descendant of, the `role="img"` container. This is the single most important structural rule for this component: `role="img"` instructs assistive technology to treat its entire subtree as one flattened image and to expose only the `aria-label` text — any text nested inside it is excluded from the accessibility tree. If the document-number `<p>` sits inside the `role="img"` wrapper, even visually below the QR graphic, a screen reader user never hears it. [DESIGN.md §6.6: "document number below... not inside the role="img" element, to allow screen readers to read it as text"]

**Keyboard interaction contract**
- Non-interactive — `QRCodeDisplay` is not part of the tab order in either the `screen` or `print` variant, and has no key bindings.

**Screen reader announcement**
- NVDA announces "graphic, QR code for document 7SP 2026-001" on encountering the `role="img"` container, then continues past it without reading any QR-internal markup. The following document-number `<p>` and title text are read as ordinary text content immediately after, since they sit outside the flattened image subtree.

**PR check:** inspect the rendered DOM (not just the JSX source) to confirm the document-number `<p>` is a sibling, not a child, of the `role="img"` element — this is easy to get structurally wrong in JSX even when the source visually "looks" correct.

---

### 3.4 `OrderOfBusinessRow`

**Required ARIA attributes**
- The red-flag Lucide `Flag` icon (rendered when `isMissingReport` is true) carries `aria-label="Missing committee report"` and `role="img"`. [DESIGN.md §6.6 Order of Business Row]
- The Certified Urgent chip carries `aria-label="Certified Urgent"`. Because the chip's visible text is already the literal string "CERTIFIED URGENT," this `aria-label` largely restates the visible text in different casing, which is the correct pattern under WCAG 2.5.3 (Label in Name): the accessible name should contain the visible label text, not replace it with unrelated wording.

**Keyboard interaction contract**
- If the row as a whole is the click target (opening the document detail), it must support Enter and Space activation. The implementation detail matters: if `OrderOfBusinessRow` renders inside a native `<table>` `<tr>`, do not apply `role="button"`/`tabindex="0"` directly to the `<tr>` — overriding a native table row's role is inconsistently supported and can break the row's column-header associations for a screen reader user navigating cell-by-cell. The more robust pattern is either (a) render the row as a non-table flex/grid layout and make the whole row element `role="button"` + `tabindex="0"`, or (b) keep native row semantics and make the row's title-cell content the actual link/button performing the navigation. **[Inference]** — neither DESIGN.md nor F5 states which container element `OrderOfBusinessRow` uses; confirm before implementation.
- Any nested interactive control inside the row (the `Flag` icon's tooltip trigger, an overflow menu, etc.) needs keyboard reachability that does not conflict with a row-level Enter/Space handler — activating a nested control must not also fire the row's own navigation handler. This is a common real-world bug in "clickable row" patterns and is worth a dedicated PR check.

**Screen reader announcement**
- The `Flag` icon announces as "graphic, Missing committee report." The Certified Urgent chip announces as "Certified Urgent," read as part of the row's text flow since the chip is `.touch-exempt` and non-interactive. If the row is keyboard-activatable per the pattern chosen above, NVDA additionally announces the row's link/button role when it receives focus.

**PR check:** confirm the `Flag` icon has both `aria-label` and `role="img"`; confirm the Certified Urgent chip's `aria-label` text matches its visible text; if the row is clickable, confirm Enter and Space both activate it and that no nested interactive element double-fires the row handler.

---

### 3.5 Sidebar navigation

**Required ARIA attributes**
- Every nav item renders as `<a>` or `<button>` — never `<div>` with a synthetic click handler. [DESIGN.md §6.1; F5 §4.3 Sidebar]
- The active nav item carries `aria-current="page"`.
- The collapse toggle carries `aria-expanded` reflecting sidebar state (`true` when expanded, `false` when collapsed) and `aria-label="Collapse sidebar"` when expanded or `aria-label="Expand sidebar"` when collapsed — the label describes the action the control performs, not the current state.
- In collapsed icon-only mode, each nav icon shows its label via the Tier 1 `Tooltip` primitive with the 500ms delay specified in DESIGN.md §6.5.

**A conflict to resolve before implementation:** F5 §4.3's `Sidebar` entry states that in collapsed mode, "item labels are hidden (`hidden` on the label `<span>`)." The HTML `hidden` attribute is equivalent to `display: none` and removes the element from the accessibility tree, which also removes it from accessible-name computation for its parent link/button. This document's own keyboard-navigation requirement (§5 below) is that collapsed-state hiding must use a visual-only technique — clipping via `overflow-hidden`, or a visually-hidden/`sr-only` utility — precisely so it does not affect what is exposed to assistive technology. These two specifications conflict: implementing F5's `hidden` attribute literally leaves every collapsed nav item with no accessible name, since the icon alone, with no `aria-label`, carries no text. **Required action:** implement collapsed-state label hiding with a visually-hidden technique that keeps the label in the accessibility tree, or, if the `hidden` attribute is kept for layout reasons, add an explicit `aria-label={item.label}` to the parent `<a>`/`<button>` so the accessible name does not depend on the hidden child. Either approach satisfies the requirement; F5 §4.3 and this document should be reconciled once the team picks one.

**Keyboard interaction contract**
- Tab/Shift-Tab cycles through nav items in DOM order, top to bottom, plus the collapse toggle — confirm its position in the sequence is consistent and logical (typically at the top or bottom of the nav list, not interleaved).
- Enter activates an `<a>` nav item; Enter or Space activates a `<button>` nav item or the collapse toggle.
- Collapsing the sidebar does not remove any nav item from the tab order — every item stays focusable whether expanded or collapsed.

**Screen reader announcement**
- An `<a>` nav item announces as "{label}, link" ("{label}, current page, link" for the active item, via `aria-current="page"`). The collapse toggle announces as "Collapse sidebar, button, expanded" or "Expand sidebar, button, collapsed." **[Inference]** — based on standard `aria-expanded` support, not independently tested for this app's specific markup.

**PR check:** confirm every nav item is `<a>`/`<button>` (grep the diff for a `<div>` with `onClick` inside the Sidebar component); confirm the collapse toggle's `aria-label` and `aria-expanded` update together; confirm a collapsed nav item still has a non-empty accessible name (inspect the Accessibility pane in Chrome DevTools, not just the visual rendering).

---

### 3.6 Topbar command palette

**Required ARIA attributes**
- The search input carries `aria-label="Search documents and navigate"`.
- The underlying Tier 1 `Command` component (shadcn, wrapping the `cmdk` library, per F5 §4.1) supplies the ARIA combobox/listbox roles and roving selection internally — this app does not need to hand-roll those roles.

**Keyboard interaction contract**
- `⌘K` / `Ctrl+K` opens the palette via a global `keydown` listener registered on `document`, not on any specific element — this matters because the shortcut must work regardless of where focus currently sits (a table cell, a form field, the sidebar). [See §5 Keyboard Navigation Contract]
- When the palette opens, focus moves to the search input automatically — it must be the first focusable element the palette places focus on, not the first result or the panel container.
- While open, focus is trapped inside the Command panel: Tab/Shift-Tab cycle only among the search input and the visible result list, never escaping to elements behind the palette.
- Arrow Up/Down move the highlighted selection within the result list (inherited from `cmdk`'s internal roving-selection behavior).
- Enter activates the highlighted result.
- Escape closes the palette and returns focus to the element that triggered it (the search icon/button in the Topbar) — not to `document.body` and not to an unrelated element.

**Screen reader announcement**
- On open, NVDA announces the search input via its `aria-label`: "Search documents and navigate, edit text." As the user types and results populate, `cmdk`'s internal ARIA wiring is responsible for announcing result count and the currently-selected item. **[Unverified]** — the exact announcement text is a property of the installed `cmdk` version and has not been independently confirmed for this spec; verify with live NVDA testing once the palette is implemented.

**PR check:** confirm the `⌘K`/`Ctrl+K` listener is bound on `document` (grep for `addEventListener` location, not a component-scoped listener); confirm Escape returns focus to the triggering element, not `document.body`; confirm Tab does not escape the panel while it is open.

---

### 3.7 Dialog / Modal

**Required ARIA attributes**
- Radix `Dialog` (`@radix-ui/react-dialog`) supplies `role="dialog"`, focus trapping, and Escape-to-close as part of its default behavior — this app does not implement these manually. [F5 §2 Confirmed Technology Lock-in: "Radix provides ARIA roles, keyboard navigation, and focus trapping"]
- When the modal contains a destructive-action confirmation, `aria-describedby` on the dialog points to the modal body content (the confirmation message), so the warning text is announced alongside the dialog's title when it opens.

**Keyboard interaction contract**
- Tab/Shift-Tab cycle only within the dialog while it is open (Radix's default focus trap).
- Escape closes the dialog.
- Radix returns focus to the element that opened the dialog when it closes — this is a documented default of Radix `Dialog`, not something this app implements separately, but it is worth a PR check because a custom close handler that also triggers a route change can interfere with Radix's default focus-return behavior.
- The mandatory-comment variant (SP Secretary workflow override, manual workflow advance) keeps the required-comment gating native: the textarea is empty-checked, and the submit `<button>` carries the native `disabled` attribute until the comment is non-empty, per DESIGN.md §6.5. A native `disabled` button is correctly removed from the tab order and announced as unavailable by NVDA — acceptable here because the textarea's own `aria-required="true"` and visible helper text (§4 below) explain why the button is inactive, rather than leaving a silently-vanished control with no explanation.

**Screen reader announcement**
- On open, Radix moves focus into the dialog (by default, to the dialog content container, unless a specific child is configured to receive initial focus) and announces the dialog's accessible name from `DialogTitle`. Radix logs a development-time console warning if `DialogTitle` is omitted, which is itself a useful PR-time signal. **[Inference]** — the exact initial-focus target depends on configuration not specified in DESIGN.md or F5; confirm the chosen target during implementation.

**PR check:** confirm `DialogTitle` is present (no Radix console warning); confirm `aria-describedby` is wired for destructive-confirmation variants; confirm the mandatory-comment submit button uses native `disabled`, not a visually-disabled-but-still-focusable pattern; confirm Escape closes and focus returns to the trigger.

---

### 3.8 `DataTable` (TanStack Table + Tier 1 shadcn `Table`)

**Required ARIA attributes**
- The rendered markup is a real `<table>` with `<thead>` and `<tbody>` — TanStack Table is headless (it supplies sorting/filtering logic only), and the actual DOM comes from the Tier 1 shadcn `Table` primitive, which renders native table elements. [F5 §4.1: Table "paired with TanStack Table for sorting/filtering logic (`apps/web` concern)"] No `<div>`-based table layout is permitted anywhere in the app.
- `aria-sort` (`"ascending"`, `"descending"`, or `"none"`) belongs on the `<th>` element itself — not on a nested sort button inside the header cell. This is a common implementation mistake worth a dedicated PR check: the sort *button* handles the click/keyboard interaction, but `aria-sort` is only meaningful on an element with `columnheader`/`rowheader` semantics, which is the `<th>`, not its button child.
- If the table supports row selection (per F5 §4.1, the Tier 1 `Checkbox` is used for this), the header "select all" checkbox needs `aria-label="Select all rows"` and should support the indeterminate (`aria-checked="mixed"`) state when some but not all rows are selected — Radix `Checkbox` exposes this via its `indeterminate`/`data-state="indeterminate"` handling. Each row checkbox needs its own accessible label distinguishing it from the others, e.g. `aria-label="Select row {documentNumber}"`.

**Keyboard interaction contract**
- Sort buttons inside column headers are reachable via Tab, in left-to-right DOM order across the header row; Enter or Space toggles sort direction.
- Row click targets must be keyboard accessible. As with `OrderOfBusinessRow` (§3.4), avoid overriding a native `<tr>`'s role; either give the `<tr>` `tabindex="0"` with an Enter handler while confirming nested interactive cells (e.g., an overflow-menu button) do not also trigger the row handler, or make the row's primary navigation target an actual `<a>`/`<button>` within one cell.

**Screen reader announcement**
- The native `<table>`/`<thead>`/`<tbody>` structure lets NVDA report table dimensions on entry ("table, N rows, M columns") and read the associated column header as the user navigates cell-by-cell with table navigation commands. A sorted column's `<th>` is announced with its sort state as part of standard `aria-sort` support. **[Unverified]** — exact phrasing is browser/AT-version-dependent and has not been independently tested for this spec.

**PR check:** confirm the rendered DOM (DevTools, not source) shows real `<table>`/`<thead>`/`<tbody>`/`<th>`/`<td>` elements; confirm `aria-sort` is on the `<th>`, not the inner button; confirm row navigation works via keyboard end-to-end (Tab to a row, Enter opens the same target a click would).

---

### 3.9 `FileUpload` dropzone

**Required ARIA attributes**
- The dropzone container carries `role="region"` and `aria-label="File upload area"`, with `aria-describedby` pointing to the element containing the accepted-formats and size-limit text (PDF, DOCX, XLSX, PNG, JPG; 25MB per file, per DESIGN.md §6.4).
- Drag-over state changes announce via an `aria-live="polite"` region.
- Error messages (wrong file type, file too large) appear in an `aria-live="assertive"` region, distinct from the drag-over region — an error needs to interrupt; a drag-over state change does not.

**Keyboard interaction contract**
- If the dropzone supports click-to-browse (opening the native file picker), the clickable surface must be a real interactive element — a `<button>` wrapping the dropzone, or the dropzone container with `role="button"` + `tabindex="0"` + Enter/Space triggering the hidden native `<input type="file">`. The underlying `<input type="file">` element itself is permitted under DESIGN.md §8 Rule 8 — that rule bans the `<form>` tag, not individual form controls, so a file input is fine as long as it is not wrapped in `<form>`.
- Each uploaded file's remove button is a native `<button>`, reachable via Tab, activated by Enter or Space.
- **A scope note worth flagging directly:** native HTML5 drag-and-drop (the `dragenter`/`dragover`/`dragleave`/`drop` events the visual drag-over state depends on) is not keyboard-operable without an additional keyboard-drag-and-drop implementation, which is out of scope here. This means the `aria-live="polite"` drag-over announcement is primarily useful to sighted screen-reader users — for example, someone pairing magnification with NVDA while dragging with a mouse — rather than to a blind keyboard-only user, who relies exclusively on the click-to-browse path. **Confirm the click-to-browse path is fully operable independent of drag state**, since that is the path that actually matters for keyboard/screen-reader-only users.

**Screen reader announcement**
- On focus/entry, NVDA announces the region: "File upload area, region," followed by the `aria-describedby` content (accepted formats, size limit) as supplementary description. An error (wrong type/too large) interrupts via the assertive region, e.g. "Error: file exceeds 25MB" (exact copy not specified here).

**PR check:** confirm `role="region"` + `aria-label` + `aria-describedby` on the dropzone; confirm error messages render in a distinct `aria-live="assertive"` region (not reused from the drag-over `polite` region); confirm the click-to-browse path works with Tab + Enter alone, with no mouse and no drag interaction.

---

### 3.10 Toast (Sonner)

DESIGN.md §6.5 specifies `role="status"` + `aria-live="polite"` for success/info toasts and `role="alert"` + `aria-live="assertive"` for error/warning toasts. **This requires a manual override — Sonner's default behavior does not differentiate by toast variant.**

Based on inspection of the Sonner source repository (`github.com/emilkowalski/sonner`, `src/index.tsx`, checked June 2026), Sonner's default implementation wraps the entire toast list in a single container carrying `aria-live="polite"`, `aria-relevant="additions text"`, and `aria-atomic="false"`, with each individual toast rendered as an `<li role="status">` inside that container — regardless of whether the toast was created via `toast.success()`, `toast.error()`, `toast.warning()`, or plain `toast()`. There is no built-in per-variant switch to `aria-live="assertive"` for error/warning toasts. **[Verified by source inspection, not by live testing.]**

**Required override:** to meet DESIGN.md §6.5's assertive requirement for error and warning toasts, `toast.error()` and `toast.warning()` calls need to render via Sonner's custom-render API (`toast.custom()`), wrapping the toast content in an element that carries `role="alert"` so that subtree announces with assertive urgency independent of the outer `aria-live="polite"` container. **This is a recommended approach, not a confirmed-working one.** Nesting a `role="alert"` element inside an `aria-live="polite"` ancestor is a known area of inconsistent behavior across screen reader/browser combinations — some announce the inner alert immediately, some defer to the outer container's politeness, some double-announce. **[Speculation]** that this specific technique behaves as intended in NVDA + Chrome; it must be verified with live NVDA testing before this item is checked off in any PR, not assumed to work from the pattern alone.

**Required ARIA attributes (target state)**
- Success and info toasts: Sonner's default `role="status"` / `aria-live="polite"` is sufficient as-is — no override needed.
- Error and warning toasts: `role="alert"` via the `toast.custom()` override described above, pending NVDA verification.

**Keyboard interaction contract**
- Toasts are not part of the tab order by default in Sonner's standard configuration; any action button inside a toast (e.g., "Undo") needs to be reachable independently. **[Inference]** — confirm this against the installed Sonner version's documented keyboard support before relying on it; not independently verified for this spec.

**Screen reader announcement**
- Success/info: announced politely, without interrupting current speech, per Sonner's default `role="status"` behavior.
- Error/warning, once the `role="alert"` override is implemented and verified: intended to interrupt and announce immediately, matching the urgency of an error condition — subject to the verification caveat above.

**PR check:** confirm error/warning toasts use the `toast.custom()` + `role="alert"` override (or whatever override the team settles on after testing), not Sonner's default call signature; confirm this was specifically tested with NVDA + Chrome and not assumed from the implementation pattern alone.

---

### 3.11 `RichTextEditor`

`RichTextEditor` replaces `Textarea` for workflow comment, remarks, and report fields per DESIGN.md §6.4 and ADR-UI-017.

**Required ARIA attributes**
- Toolbar container: `role="toolbar"`, `aria-label="Formatting toolbar"`.
- Toggle-style buttons (Bold, Italic, Bullet List, Ordered List, Underline, Strikethrough, Heading 3, Heading 4, Blockquote, Link): `aria-pressed={editor.isActive(...)}` reflecting active state, each with a descriptive `aria-label`.
- Action-style buttons (Horizontal Rule, Undo, Redo): carry descriptive `aria-label` without `aria-pressed`, as they perform insert/history actions rather than toggling state.

**Keyboard interaction contract**
- The editable surface carries `role="textbox"` and `aria-multiline="true"`.
- Toolbar controls use native `<button type="button">`, receiving standard Tab navigation and Enter/Space activation automatically.
- Undo and Redo actions support standard browser keyboard shortcuts (`Mod-Z`, `Mod-Shift-Z`) via TipTap's bundled History extension, functioning independently of toolbar button focus.

**Screen reader announcement**
- Toolbar controls announce as interactive buttons with their accessible name (from `aria-label`). Toggle buttons announce state changes (between "pressed" and "not pressed") when activated. **[Inference]** — exact verbosity and announcement sequence depend on screen reader settings.

**PR check:** confirm `role="toolbar"` + `aria-label="Formatting toolbar"` on container, `aria-pressed` present on all 10 toggle buttons and absent on the 3 action buttons, and `aria-label` present on every button.

---

## 4. Form Accessibility Rules

Every form field — `Input`, `Textarea`, `Select`, `Checkbox`, `DatePicker`, and the multi-select `Combobox` — must satisfy three rules without exception, regardless of which container element wraps it. DESIGN.md §8 Rule 8's prohibition on `<form>` elements is a constraint on the *container*, not an exemption from these field-level rules; a field inside a `<div>` or `<section>` needs the same label association and error announcement a field inside a native `<form>` would.

1. **Every field has an associated `<label>` with `htmlFor` matching the field's `id`.** `aria-label` alone is not a substitute for a visible label, except when the field is icon-only (for example, an icon-only search input with no visible text label nearby). The `id` must be stable and explicit, not regenerated on every render — if a component relies on React's internal id generation (as Radix-based components like `Select` and `Checkbox` often do via `useId()`), confirm the generated id is what `htmlFor` actually targets, since a mismatch silently breaks the association without throwing any error.
2. **Error messages render inside a `<span role="alert">`,** so the error is announced immediately when it appears. The most broadly reliable implementation keeps the `<span role="alert">` element always present in the DOM — even when there is no error, with empty text content — and toggles its text content, rather than mounting/unmounting the element conditionally. This avoids any dependency on whether a given screen reader/browser pair reliably announces newly-inserted `role="alert"` nodes versus content changes inside an already-present one. `role="alert"` carries an implicit `aria-live="assertive"`, so no separate `aria-live` attribute is needed alongside it.
3. **Required fields carry `aria-required="true"`** in addition to the visual asterisk (`text-danger-500 ml-0.5`, per DESIGN.md §6.4). The asterisk alone is a color/symbol-only signal that a screen reader does not pick up unless it is paired with the ARIA attribute or included directly in the accessible name.

**Open question, flagged rather than assumed:** DESIGN.md §6.4 does not specify whether the `DatePicker` trigger renders as a text `Input` (showing the formatted date as editable text) or a `Button` (opening the `Calendar`/`Popover` on click only). **I do not have a confirmed answer.** Confirm this before implementation, since the correct label-association pattern depends on it — an `Input`-style trigger follows Rule 1 directly; a `Button`-style trigger needs an `aria-label` or visible label on the button itself, following the icon-only-field exception.

**Checkbox groups:** if "required" means "select at least one" across a set of checkboxes, rather than a single required checkbox, `aria-required="true"` belongs on the group container (`role="group"` + `aria-required="true"`), not repeated on every individual checkbox. DESIGN.md does not disambiguate which pattern applies to any specific checkbox field in the app — confirm per field during implementation rather than applying one pattern uniformly across the codebase.

---

## 5. Keyboard Navigation Contract

| Key | Applies to | Required behavior |
|---|---|---|
| `Tab` / `Shift+Tab` | Entire app | Cycle through all interactive elements in DOM order. No interactive element is skipped; no non-interactive element receives focus. |
| `Enter` | Buttons, links | Activates the focused element. |
| `Space` | Checkboxes, toggles, buttons | Activates the focused element. |
| `Arrow Up` / `Arrow Down` | Native `<select>`; Command palette result list; `Tabs` component (left/right or up/down depending on orientation) | Navigates within the control without leaving it. |
| `Escape` | `Dialog`, `Sheet`, Command palette, `Popover` | Closes the open overlay and returns focus to the element that opened it. |
| `⌘K` / `Ctrl+K` | Global | Opens the command palette. Bound via a `keydown` listener on `document`, not on any specific element, so it works regardless of current focus location. |

**Sidebar collapse and tab order:** sidebar nav items must stay in a predictable tab order whether the sidebar is expanded or collapsed. In collapsed icon-only mode, item labels must be hidden using a visual-only technique — clipping via `overflow-hidden` or a visually-hidden (`sr-only`-style) utility class — never `display: none` or `visibility: hidden`, both of which remove the label from the accessibility tree along with the screen, breaking the nav item's accessible name. See §3.5 above for the specific conflict this raises against F5 §4.3's `hidden`-attribute description of `Sidebar`, and the required resolution.

---

## 6. Color Contrast Reference Table

Every ratio below is computed directly from the confirmed hex values in `globals.css`/DESIGN.md §3 using the WCAG 2.1 relative-luminance formula — sRGB channels linearized, combined with the standard 0.2126 / 0.7152 / 0.0722 weighting, then `(L_lighter + 0.05) / (L_darker + 0.05)` — not estimated. Where the original task description supplied an illustrative ratio for a pair (for example, `text-primary` on `surface-base`), the computed value below is the one that should be treated as authoritative: a few of the illustrative figures in the original request were approximate and differ by a few tenths from the precise computed values shown here. All pairs are evaluated against the WCAG AA normal-text threshold (4.5:1) — every use of these tokens in the app is `text-sm` (14px) or smaller, which does not qualify for the relaxed 3:1 large-text threshold.

| Foreground token | Background token | Foreground hex | Background hex | Computed ratio | WCAG AA (4.5:1, normal text) |
|---|---|---|---|---|---|
| `text-primary` | `surface-base` | `#212529` | `#ffffff` | 15.43:1 | ✅ Pass |
| `text-secondary` | `surface-base` | `#495057` | `#ffffff` | 8.18:1 | ✅ Pass |
| `text-muted` (corrected) | `surface-base` | `#5a6470` | `#ffffff` | 6.01:1 | ✅ Pass |
| `text-inverse` | `primary-950` (sidebar) | `#ffffff` | `#081229` | 18.60:1 | ✅ Pass |
| `text-inverse` | `primary-800` (button) | `#ffffff` | `#162e60` | 13.18:1 | ✅ Pass |
| `success-900` | `success-100` | `#064e3b` | `#d1fae5` | 8.57:1 | ✅ Pass |
| `danger-900` | `danger-100` | `#7f1d1d` | `#fee2e2` | 8.20:1 | ✅ Pass |
| `warning-900` | `warning-100` | `#78350f` | `#fef3c7` | 8.15:1 | ✅ Pass |
| `info-900` | `info-100` | `#1e3a8a` | `#dbeafe` | 8.49:1 | ✅ Pass |

**`text-muted` correction, explicit note:** DESIGN.md §3 specifies `text-muted` as `#868e96`. Computed against `surface-base` (`#ffffff`), that value produces a contrast ratio of **3.32:1**, which fails the 4.5:1 WCAG AA threshold for normal text. `globals.css` (line 132) has already corrected this to `#5a6470` — computed ratio 6.01:1, which passes — and labels the change "CONTRAST CORRECTION." This is recorded as deviation #1 in F5 §3. DESIGN.md §3's TEXT block and §9's muted/caption specimen entries still reference the failing `#868e96` value and need to be updated to `#5a6470` to match the implementation already shipped in `globals.css`.

---

## 7. PR Review Gate

Paste this section directly into a PR review comment. Every item is checkable by reading the diff and the rendered component — no automated tooling required, though automated audits (axe, Lighthouse) remain a useful supplement, not a substitute for the checks below.

### Universal (every PR)
- [ ] No `outline: none`/`outline: 0` without an equal-or-greater-visibility replacement focus style
- [ ] All interactive elements meet 44×44px touch target, or carry `.touch-exempt` (only on `DocumentNumberBadge`, `StatusBadge`, `ScanQualityIndicator`)
- [ ] No hardcoded `#fff`/`#ffffff`/`#000`/`#000000`/other hex or `rgb()`/`hsl()` literals in component files
- [ ] No `!important` on `animation-*`/`transition-*` properties in component-level CSS
- [ ] Root `<html lang="en">` unchanged
- [ ] Routed view updates `document.title` on mount
- [ ] No status/state conveyed by color alone — grayscale check passes; `StatusBadge` left-border accent present

### Component-specific
- [ ] `SLATimer`: `role="timer"` + `aria-live="polite"` (never `assertive`) + `role="progressbar"` with all three `aria-value*` attrs, `aria-valuenow` clamped ≤100
- [ ] `WorkflowStepIndicator`: `<ol>`/`<li>` structure; `aria-current="step"` on active step; `aria-label` suffix on completed steps; `aria-disabled="true"` on skipped steps
- [ ] `QRCodeDisplay`: `role="img"` + `aria-label` on QR container; document-number `<p>` is a DOM sibling, not a child, of that container (check rendered DOM)
- [ ] `OrderOfBusinessRow`: `Flag` icon has `aria-label="Missing committee report"` + `role="img"`; Certified Urgent chip's `aria-label` matches visible text; row keyboard-activatable (Enter/Space) if clickable
- [ ] Sidebar: nav items are `<a>`/`<button>`, never `<div>`; active item has `aria-current="page"`; collapse toggle has matching `aria-expanded`/`aria-label`; collapsed labels hidden via visual-only technique with accessible name preserved (not `hidden`/`display:none`)
- [ ] Command palette: `⌘K`/`Ctrl+K` listener is on `document`; focus moves to search input on open; focus trapped while open; Escape returns focus to trigger
- [ ] Dialog/Modal: `DialogTitle` present (no Radix console warning); destructive-confirmation variants wire `aria-describedby`; mandatory-comment submit button uses native `disabled`; Escape closes and focus returns to trigger
- [ ] `DataTable`: real `<table>`/`<thead>`/`<tbody>` (check rendered DOM, not source); `aria-sort` on `<th>`, not the inner sort button; row navigation works via keyboard
- [ ] `FileUpload`: `role="region"` + `aria-label` + `aria-describedby` on dropzone; error messages in a distinct `aria-live="assertive"` region (not the drag-over `polite` region); click-to-browse works with Tab + Enter alone, no mouse
- [ ] Toast: error/warning toasts use the `role="alert"` override (not Sonner's default `toast.error()`/`toast.warning()` call), and this was verified with live NVDA testing
- [ ] `RichTextEditor`: `role="toolbar"` + `aria-label="Formatting toolbar"` on toolbar container; `aria-pressed` on 10 toggle buttons (absent on 3 action buttons: Horizontal Rule, Undo, Redo); `aria-label` on all 13 buttons

### Forms
- [ ] Every field has a `<label htmlFor>` matching a stable field `id` (no `aria-label`-only labels except icon-only fields)
- [ ] Error messages render in `<span role="alert">`
- [ ] Required fields carry `aria-required="true"` in addition to the visual asterisk

### Keyboard
- [ ] Tab/Shift-Tab reaches every interactive element in DOM order, skips nothing, lands on nothing non-interactive
- [ ] Enter activates buttons/links; Space activates checkboxes/toggles/buttons
- [ ] Arrow keys navigate within `<select>`, Command palette results, and `Tabs`
- [ ] Escape closes `Dialog`/`Sheet`/Command palette/`Popover`
- [ ] Collapsed sidebar does not break tab order or remove any item's accessible name
