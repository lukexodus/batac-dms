# Batac City LGU Platform — Accessibility Guidelines

**Version:** 0.1 · **Companion to:** `DESIGN.md`, `COMPONENT-GUIDELINES.md`
**Scope:** Accessibility standards, keyboard and screen-reader behavior, and a testing checklist for every page in this prototype.

> **A note on compliance claims** [Unverified]: This document sets **WCAG 2.1 Level AA** as the working target, as it is the most widely referenced baseline for public-sector digital services internationally. Philippine-specific statutory requirements for government digital accessibility (e.g., obligations under the Magna Carta for Persons with Disabilities and related accessibility law) should be confirmed with City Legal / DICT guidance before Production Rollout — this document does not constitute legal compliance advice. Where this document references specific WCAG success-criteria numbers, the development team should verify them against the current W3C WCAG specification, as numbering has changed between WCAG versions (2.0 → 2.1 → 2.2).

---

## 1. Why Accessibility Is Non-Negotiable Here

This is not a marketing site — it is the system of record for legislative documents, executive approvals, and citizen services. Three groups make accessibility a hard requirement, not a nice-to-have:

1. **Internal staff** — including Records Officers, Administrative Aides, and SP Members of varying ages and abilities, working long hours at Windows 11 workstations.
2. **Barangay officials** — using personal phones, sometimes older devices, often outdoors or in low-connectivity conditions (per `1-domain-context.md` §4.4, §11.16).
3. **Citizens** — the Citizen Portal explicitly serves people who "do not have to go in person" (per the stakeholder value statement in `consolidated-architecture-and-requirements-reference.md` Part 7.1) — this includes elderly citizens, citizens with disabilities, and citizens with limited digital literacy.

---

## 2. Color and Contrast

### 2.1 Minimum contrast ratios

| Element | Minimum ratio | Applies to |
|---|---|---|
| Body text | 4.5:1 | All `text-gray-700` / `text-gray-900` on white or `gray-50` |
| Large text (≥ 18px or ≥ 14px bold) | 3:1 | Headings, `PageHdr` titles |
| UI components (borders, icons conveying meaning) | 3:1 | Input borders, status dot indicators, focus rings |
| Disabled elements | No minimum (exempt) | `disabled` buttons, inactive pagination |

### 2.2 Status colors — verified pairs

The `statusConfig` and `classConfig` token pairs in the prototype (e.g., `bg-green-100` / `text-green-700`) were chosen because light-100 backgrounds with 700-weight text consistently clear 4.5:1 in Tailwind's default palette. **When adding new status types, always pair a `-100` background with `-700` (or darker) text** — never `-100` background with `-400`/`-500` text, which commonly fails AA.

### 2.3 Color is never the only signal

Every status indicator in this system uses **color + icon/shape + text**, never color alone:

- `StatusBadge`: colored dot **+** text label (e.g., "● Approved", not just a green dot)
- `ClassificationBadge`: colored tag **+** icon (`Globe`, `Building2`, `Shield`, `Lock`) **+** text
- `PriorityTag`: colored background **+** explicit text ("OVERDUE", "URGENT")
- SLA states: color **+** `AlertTriangle`/`AlertCircle` icon **+** explicit day-count text ("4 days in queue")

**Rule for new components:** if you can describe a component's meaning fully without mentioning its color, the color is supplementary (good). If removing the color would remove information, add an icon or text label before shipping.

### 2.4 Dark sidebar contrast

The sidebar (`#0D3D20` background) uses:
- White (`#FFFFFF`) for active nav item text — passes AA
- `rgba(255,255,255,0.65)` for inactive nav text — **borderline**; verify against `#0D3D20` before finalizing. If it fails, increase to `rgba(255,255,255,0.75)` minimum.
- `#86efac` (light green) for secondary labels ("LGU Platform · v0.1") — passes AA on `#0D3D20`

---

## 3. Keyboard Navigation

### 3.1 General requirements

- All interactive elements (`Btn`, table rows with actions, filter selects, tabs) must be reachable via `Tab` and operable via `Enter`/`Space`.
- Focus order follows visual/reading order: sidebar → top bar → page content (left-to-right, top-to-bottom).
- No keyboard traps — modals/dialogs (not yet present in this prototype, but planned for confirmation dialogs on Reject/Return actions) must allow `Escape` to close and return focus to the triggering element.

### 3.2 Page-specific keyboard patterns

| Page | Pattern |
|---|---|
| **Sidebar navigation** | Each nav item is a `<button>` — focusable, `Enter`/`Space` activates. Collapse toggle is reachable last in tab order. |
| **Mayor's / SP Secretary Dashboard** | Stat cards are non-interactive (no tabindex). Document queue rows: the row itself is not a single giant click target — instead, "Review"/"Sign" buttons within the row are independently focusable. |
| **DTS Timeline** | Timeline entries are read-only content — no special keyboard handling needed beyond normal document flow. "Print Cover Sheet" and action buttons in the sidebar are standard buttons. |
| **WMS Approval Interface** | The three action cards (Approve/Return/Reject) must be operable as a **radio group**: `Tab` moves between them, `Enter`/`Space` selects, only one can be active. The comment `<textarea>` becomes focusable/enabled only after an action is selected — but must still be `Tab`-reachable (not `display: none`) so screen reader users know it exists, with its disabled state announced. |
| **DMS Repository** | Filter `<select>` elements and the search `<input>` are standard form controls. Table row action icons (revealed on hover) **must also appear on focus** — `opacity-0 group-hover:opacity-100` must be paired with `group-focus-within:opacity-100` so keyboard users can reach them without hovering. |
| **Citizen Portal tabs** | Implemented as a proper tab list: `role="tablist"` on the container, `role="tab"` + `aria-selected` on each button, `role="tabpanel"` on the content area. Arrow keys move between tabs (Left/Right), `Tab` moves into the active panel. |

### 3.3 Focus indicator

All focusable elements use the `brand-ring` style: a 2px solid `#00A651` outline with 2px offset. This must remain visible — **never** use `outline: none` without a replacement focus style.

---

## 4. Screen Reader Patterns

### 4.1 Status and classification

| Component | Spoken as |
|---|---|
| `StatusBadge status="Approved"` | "Status: Approved" — implemented via `aria-label="Status: Approved"` on the badge container, with the dot marked `aria-hidden="true"` |
| `ClassificationBadge level="Confidential"` | "Classification: Confidential" — same pattern; icon is `aria-hidden="true"`, text conveys meaning |
| `PriorityTag priority="overdue"` | "Overdue" — the tag's text content is sufficient; no extra `aria-label` needed since "OVERDUE" is already plain text |

### 4.2 Tracking numbers

Tracking numbers (`DTS-2026-000045`) are displayed in `IBM Plex Mono`, but **screen readers should not spell out the full string letter-by-letter by default** — that becomes tedious for sighted-equivalent comprehension. Instead:

- The visual text remains `DTS-2026-000045`
- Add `aria-label="Tracking number D T S dash 2 0 2 6 dash 0 0 0 0 4 5"` **only** on the primary tracking-number display per page (e.g., the DTS Timeline header), not on every table cell — repeating a verbose label 12 times in a DMS table would be worse than the default pronunciation.
- In the DMS table, the default browser pronunciation of the monospace string is acceptable; row context (document title, type) carries the primary meaning.

### 4.3 QR codes

Every `QRDisplay` instance must have:
```
alt="QR code for tracking number DTS-2026-000045 — scan to view document status"
```
Never `alt="QR code"` alone — the tracking number is the functional content of the image.

### 4.4 Timeline (DTS)

Each timeline entry should be exposed as a list item with a structured `aria-label`, e.g.:

```
aria-label="Step 7 of 9, completed: VP Certification and Series Number Assigned,
performed by Vice Mayor Albert D. Chua, May 29, 2026, 2:30 PM"
```

The "CURRENT" badge on the active step must be announced — e.g., `aria-current="step"` on that entry's container, in addition to its visual badge.

### 4.5 Forms (WMS comment field, Citizen Portal submission)

- Every `<label>` is explicitly associated with its input via `htmlFor`/`id` — placeholder text is never the only label.
- Required fields: the visual red asterisk (`*`) is paired with `aria-required="true"` on the input AND the word "required" in the visible label text (not color/symbol alone) — see `COMPONENT-GUIDELINES.md` for the exact pattern used in the WMS comment field ("Comment * Required").
- Validation errors (e.g., "A comment is required for this action") are rendered with `role="alert"` so they are announced immediately when they appear, and are also visually adjacent to the field they describe — never only in a toast/banner disconnected from the field.

### 4.6 Live regions

- SLA breach alerts and confirmation messages (e.g., the WMS "Document Approved" result screen) should use `aria-live="polite"` so screen reader users are notified of the state change without an abrupt context switch.
- The notification bell's red dot (`Bell` icon with unread indicator) should have an associated `aria-label` indicating count, e.g., `aria-label="Notifications, 3 unread"` — never an unlabeled colored dot.

---

## 5. Forms and Validation

| Rule | Implementation |
|---|---|
| Labels above inputs, never placeholder-only | All form fields in `KitchenSinkPage`, WMS action panel, and Citizen Portal "Submit" tab use `<label className="...uppercase tracking-wide...">` |
| Required field marking | Red asterisk **+** explicit text where the asterisk alone would be ambiguous (e.g., "Comment * Required" in WMS, not just "Comment *") |
| Error state | Red border (`border-red-300`) **+** red helper text below the field — color is reinforced by text, never alone |
| Disabled state | 50% opacity **+** `cursor-not-allowed` **+** `aria-disabled="true"` |
| Privacy consent (Citizen Portal) | Real `<input type="checkbox">` with associated `<label>`, not a styled `<div>` — ensures native checkbox semantics and keyboard toggling |

---

## 6. Motion and Reduced Motion

Per `DESIGN.md` §9, this system already avoids decorative animation. Additionally:

- All `transition` properties (hover states, 150–200ms) should be wrapped in a `@media (prefers-reduced-motion: reduce)` override that sets `transition: none` — even though these transitions are subtle, citizens using assistive technology with vestibular sensitivities should not encounter any motion by default if they've set this OS-level preference.
- No animation is ever required to understand a state change (e.g., the WMS action selection works identically with or without the border-color transition).

---

## 7. Citizen Portal — Additional Considerations

The Citizen Portal carries the highest accessibility stakes because it has the least-known audience:

- **No login required for Track/Library tabs** — accessibility cannot depend on account setup.
- **Plain-language labels**: "Track a Document" / "Ordinances & Resolutions" / "Submit a Request or Complaint" — avoids acronyms (DTS/DMS) in primary navigation.
- **Mobile-first touch targets**: all buttons and tab triggers maintain a minimum 44×44px touch target (per WCAG 2.1 AA + common mobile guidance), even where the visual element appears smaller — achieved via padding, not just `font-size`.
- **Form length**: the "Submit a Request" form is long; it should be navigable by a screen reader using heading/landmark structure (`<fieldset>`/`<legend>` groupings for related fields) rather than a flat sequence of inputs. *(Not yet implemented in the static prototype — flagged for the working build.)*
- **Document previews**: per `consolidated-architecture-and-requirements-reference.md` §4.15, only the first page of a document is shown publicly with the body blurred. The blurred state must be announced (e.g., `aria-label="Preview unavailable — full document requires authorized access"`), not just visually implied.

---

## 8. Known Prototype Limitations

This is a **static UI prototype**, not a working application. The following accessibility behaviors are **designed for but not functionally implemented** in the current build, and must be addressed when this becomes a real `/apps/web` Vite+React application:

- `aria-live` regions are documented here but not wired to real state changes (no real async actions exist yet)
- The WMS action-selector "radio group" keyboard behavior (§3.2) is visually present but not yet implemented with full `role="radiogroup"` semantics
- Citizen Portal tabs use basic `onClick` state in the prototype; full `role="tablist"`/`aria-selected`/arrow-key navigation per §3.2 needs to be added in the real component
- No automated accessibility testing (axe-core, Lighthouse CI) has been run against this prototype — see §9 for the checklist to apply once real components exist

---

## 9. Testing Checklist (for the real implementation)

- [ ] Run axe-core or Lighthouse accessibility audit on every page — target zero "serious"/"critical" issues
- [ ] Tab through every page using keyboard only — confirm visible focus ring at every stop, confirm no traps
- [ ] Test with a screen reader (NVDA or VoiceOver) on: DTS Timeline, WMS Approval Interface, Citizen Portal Submit form
- [ ] Verify color contrast for every new status/classification color pair added beyond the documented set
- [ ] Test Citizen Portal on a low-end Android device at 3G-equivalent throttling (per `1-domain-context.md` §11.16 — barangay connectivity)
- [ ] Verify `prefers-reduced-motion` disables all transitions
- [ ] Confirm all images (seal, QR codes) have meaningful `alt` text — zero empty `alt=""` except genuinely decorative elements
- [ ] Verify form validation errors are announced via `aria-live` and are not color-only

---

*City Government of Batac · Ilocos Norte, Philippines*
*Accessibility guidelines for internal development use only — pre-production prototype. Legal/regulatory compliance claims require separate review.*
