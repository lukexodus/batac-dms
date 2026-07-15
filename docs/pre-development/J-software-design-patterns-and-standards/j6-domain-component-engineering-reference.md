# J6 — Domain Component Engineering Reference

> **batac-dms · `packages/ui` · Pre-development specification**
>
> This document is the single engineering source of truth for all Tier 3 domain compound components
> in `packages/ui`. It has three purposes: (1) define all shared TypeScript types; (2) produce the
> canonical `STATUS_META` constant; (3) provide a complete per-component implementation spec
> sufficient for an AI agent to implement any Tier 3 component in a single PR without reading any
> other document except the ones explicitly cited below.
>
> **Authoritative inputs:** DESIGN.md §6–§8, globals.css `@theme` block, F5 (Tier 3 inventory), F6
> (ARIA contracts), consolidated-architecture-and-requirements-reference-iteration-3.md (Parts 3,
> 4.1, 4.2, 4.14, 4.17, 4.18, 5.1, 11.4, 11.5, 11.6), d2-sequence-diagrams.md (Diagrams 1, 2, 7B,
> 7C, 7D).
>
> **Conflict rule:** Where STATUS_META and DESIGN.md §7 conflict, §7 is authoritative. Where DESIGN.md
> §7 is internally inconsistent (label vs. hex), the hex value governs because hex maps directly to an
> `@theme` token. Where J6 and F5 conflict on field names, J6 defines the canonical type but flags
> the change as `// [F5 update required]`.

---

## Table of Contents

- [L62–L393] Section 1 — Shared Type Definitions {#section-1} — Exhaustive types for document states, SLAs, routing history, and component props consumed by packages/ui and apps/web.
  - [L74–L133] `DocumentState` — String literal union representing every possible state a document can occupy across SP legislative and citizen complaint lifecycles.
  - [L134–L147] `NumberVariant` — Indicates whether a document's number is a draft preliminary format or an enacted final format for visual styling.
  - [L148–L161] `SLAStatus` — Defines visual urgency tiers (on-track, at-risk, breached) for Mayor review and Panlalawigan review timeline clocks.
  - [L162–L175] `ScanQualityLevel` — Converts numerical scan quality scores into named semantic bands (excellent, good, fair, poor) for visual indicators.
  - [L176–L216] `RoutingAction` — Exhaustive list of all tracking actions logged during document flow to drive timeline dot colors and labels.
  - [L217–L237] `CommitteeReportStatus` — States of committee engagement (submitted, pending, absent) to determine status chip colors in referral components.
  - [L238–L265] `RoutingEntry` — Data contract for one timeline node in the document routing history, including actor, action, and physical custody.
  - [L266–L291] `WorkflowStep` — Model for a step in the visual workflow indicator, adding assignee and completion timestamp to the basic step.
  - [L292–L311] `CommitteeReferral` — Represents referral of a document to a committee, tracking the report status, submitter, and submission timestamp.
  - [L312–L343] `OrderOfBusinessItem` — Data model representing a single row in the session agenda, including reading type, referrals, and urgency flags.
  - [L344–L373] `DocumentPreview` — Data structure containing fields needed to display a document card preview, including embedded SLA details.
  - [L374–L393] `StatusMetaEntry` — Visual styling properties (colors, borders, text styles) mapped to each document state in the status badge constant.
- [L394–L751] Section 2 — STATUS_META Constant {#section-2} — Mapping of each DocumentState to its Tailwind classes and text styles for badge rendering.
  - [L715–L751] STATUS_META Completeness Validation — Audit checklist verifying that all 26 states in the DocumentState type are mapped in STATUS_META.
- [L752–L1960] Section 3 — Per-Component Specifications {#section-3} — Detailed prop interfaces, visual behaviors, dependencies, ARIA rules, and anti-patterns for 16 Tier 3 components.
  - [L763–L829] 3.1 PageHeader — Structural top header displaying title, subtitle, and action slot with strict h1 heading hierarchy.
  - [L830–L917] 3.2 Sidebar — Primary navigation container with dark background, width transitions, badge pills, and collapsed tooltip labels.
  - [L918–L996] 3.3 Topbar — Fixed top header with breadcrumbs, notification bell dropdown, user menu popover, and sidebar width offset transition.
  - [L997–L1068] 3.4 AppShell — Overall page layout container managing scroll regions and responsive spacing offsets for Sidebar and Topbar.
  - [L1069–L1127] 3.5 DocumentNumberBadge — Signature component rendering document numbers in monospace font with distinct styling for final and preliminary variants.
  - [L1128–L1190] 3.6 StatCard — Data display card showing large bold metrics and optional colored trend indicators with comparison labels.
  - [L1191–L1257] 3.7 EmptyState — Centered illustrative layout displaying directive copy and a call-to-action button when content is missing.
  - [L1258–L1320] 3.8 ScanQualityIndicator — Colored status indicator displaying OCR scan quality levels and full score details within an interactive tooltip.
  - [L1321–L1396] 3.9 SLATimer — Progress bar displaying elapsed time and urgency status for Mayor or Panlalawigan document review deadlines.
  - [L1397–L1483] 3.10 RoutingHistoryTimeline — Vertical timeline displaying document movements, actor details, action dot colors, and optional routing remarks.
  - [L1484–L1554] 3.11 QRCodeDisplay — Square QR code display component with centered document info, optimized for digital screens or print layouts.
  - [L1555–L1622] 3.12 CommitteeReferralBlock — List displaying standing committees referred to a document, their report statuses, and submitter avatar badges.
  - [L1623–L1684] 3.13 StatusBadge — Single-responsibility status chip mapping DocumentState to STATUS_META styling with dashed borders and line-through styles.
  - [L1685–L1774] 3.14 WorkflowStepIndicator — Linear progress track displaying sequential workflow steps with status-based ring rings and vertical/horizontal responsive layouts.
  - [L1775–L1857] 3.15 DocumentPreviewCard — Grid/list card displaying a document thumbnail, status badges, timestamp, and optional embedded SLA timer.
  - [L1858–L1960] 3.16 OrderOfBusinessRow — Horizontal agenda item displaying urgent flags, reading type chips, status badges, and red-flagged missing reports.
- [L1961–L2036] Section 4 — DESIGN.md Delta {#section-4} — Pending updates to DESIGN.md covering missing states, mislabeled color tokens, and props changes.

---

## Section 1 — Shared Type Definitions {#section-1}

**File:** `packages/ui/src/types/domain.ts`
**Barrel export:** `@batac/ui`

**Location justification:** These types are consumed by both `packages/ui` Tier 3 components and
`apps/web` page-level components; placing them in `packages/shared` would create a circular
dependency risk because `packages/ui` already depends on `packages/shared` for tRPC and Zod types,
and having `packages/shared` in turn import from `packages/ui` would close the circle.

---

### `DocumentState`

**Source:** Consolidated ref Part 11.4 (core lifecycle states), Part 4.1/4.2 (reading and workflow
step states), Part 4.3/4.4 (Panlalawigan outcome states), Part 4.14 (citizen complaint states).

**Purpose:** The exhaustive string literal union of every named state a document can occupy in the
system; `StatusBadge` and `STATUS_META` key off this union so that TypeScript enforces completeness.

```typescript
export type DocumentState =
  // ── Core document lifecycle (Part 11.4) ──────────────────────────────────────
  | 'DRAFT' // Document created; not yet submitted to Secretariat
  | 'SUBMITTED' // Submitted to Secretariat; pending intake logging
  | 'IN_WORKFLOW' // Active in a workflow instance — broad umbrella state // [Ambiguity — see note A]
  | 'PENDING_APPROVAL' // Awaiting a generic approval action // [Ambiguity — see note B]
  | 'COMPLETED' // Workflow instance reached a terminal approved outcome
  | 'RELEASED' // Published to portal; publicly visible
  | 'ARCHIVED' // Permanent historical record; read-only
  | 'DISPOSED' // Records-managed disposal (no document destroyed — audit only)
  | 'CANCELLED' // Withdrawn/cancelled; terminal; no further action possible
  // ── Reading and workflow-step states (Parts 4.1, 4.2) ────────────────────────
  | 'FIRST_READING' // Vice Mayor has referred document at First Reading session
  | 'SECOND_READING' // Document before the body at Second Reading session
  | 'THIRD_READING' // Document before the body at Third Reading session (Ordinances only)
  | 'IN_COMMITTEE' // Referred to one or more standing committees
  | 'PENDING_MAYOR' // Transmitted to Mayor; 10-day review clock running
  | 'VETOED' // Mayor returned with veto; override vote pending or failed
  | 'OVERRIDE_PENDING' // Override vote has not yet occurred; 2/3 threshold required
  | 'LAPSED' // Mayor took no action within 10 days; lapsed into law per RA 7160
  // ── Panlalawigan review outcome states (Parts 4.3, 4.4) ─────────────────────
  | 'PANLALAWIGAN_REVIEW' // Transmitted to Sangguniang Panlalawigan; 30-day timer running
  | 'VALID' // Panlalawigan affirmed the measure in its entirety
  | 'VALID_IN_PART' // Panlalawigan approved with partial invalidity finding
  | 'RETURNED' // Panlalawigan returned with objections; implementation typically stopped
  | 'DEEMED_APPROVED' // 30-day Panlalawigan window lapsed with no action; RA 7160 §56(d)
  // ── Citizen complaint states (Part 4.14) ─────────────────────────────────────
  | 'PENDING_HEARING' // Complaint logged; committee referral in progress
  | 'RECEIVED_SEEN' // Vice Mayor or Committee has acknowledged the complaint // [Not in task prompt — added from Part 4.14 source; Part 4.14 update required in task spec]
  | 'DISMISSED' // Complaint dismissed by Secretariat or committee
  | 'RESOLVED'; // Committee report issued; complainant notified; case closed
```

> **Note A — `IN_WORKFLOW` / step-level granularity ambiguity:** Part 11.4 defines `IN_WORKFLOW` as
> a broad lifecycle state encompassing any active workflow instance. States like `FIRST_READING`,
> `IN_COMMITTEE`, and `PENDING_MAYOR` are more granular positions _within_ `IN_WORKFLOW`. Showing
> both in one union creates a semantic hierarchy that TypeScript cannot enforce without a discriminated
> union refactor. For Phase 1, `IN_WORKFLOW` is retained for generic pipeline display (e.g., when
> the specific reading state is not yet surfaced in the UI), and the granular states coexist. A
> future refactor should make the step states a subtype of `IN_WORKFLOW` using a discriminated union.
> `// [Ambiguity — architectural decision deferred to Phase 2]`

> **Note B — `PENDING_APPROVAL` vs `PENDING_MAYOR`:** Part 11.4's lifecycle includes
> `PENDING_APPROVAL` as a generic pre-approval state. In the SP legislative context, the only
> concrete approval actor is the Mayor, so `PENDING_MAYOR` covers the SP workflow. `PENDING_APPROVAL`
> exists as a generic alias for non-SP document types that pass through a generic approval gate.
> `// [Ambiguity — use PENDING_MAYOR for SP Resolutions and Ordinances; PENDING_APPROVAL for other
document types introduced in later phases]`

---

### `NumberVariant`

**Source:** Consolidated ref Part 5.1 (preliminary format has `Draft` prefix; final format removes it).

**Purpose:** Encodes whether a document number is preliminary (draft) or final (enacted) so that
`DocumentNumberBadge` and any component embedding it can apply the correct visual treatment without
re-deriving the distinction from the number string itself.

```typescript
export type NumberVariant = 'final' | 'preliminary';
```

---

### `SLAStatus`

**Source:** DESIGN.md §6.3 SLATimer spec; consolidated ref Part 11.3 (warning triggered at 80% of
SLA time elapsed).

**Purpose:** Represents the three visual tiers of SLA urgency so that `SLATimer` and any consuming
component can branch on a named semantic rather than on raw percentage arithmetic.

```typescript
export type SLAStatus = 'on-track' | 'at-risk' | 'breached';
```

---

### `ScanQualityLevel`

**Source:** DESIGN.md §6.3 ScanQualityIndicator spec (four quality bands: ≥95% Excellent, 80–94%
Good, 60–79% Fair, <60% Poor).

**Purpose:** Allows components that receive a quality score to convert it to a named semantic level
once and then branch on the level, keeping score-to-level logic in a single utility function.

```typescript
export type ScanQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';
```

---

### `RoutingAction`

**Source:** Consolidated ref Part 11.6 (routing history records every movement); D2 Diagrams 1, 2,
7B, 7C, 7D (step transitions that produce routing history entries).

**Purpose:** Enumerates every action type that can appear in a `RoutingEntry` so that timeline
rendering can select the correct dot color and label without parsing strings.

```typescript
export type RoutingAction =
  // ── Provided in J6 task spec ──────────────────────────────────────────────
  | 'Logged' // Document first recorded by Secretariat (intake_logging)
  | 'Transmitted' // Physical or digital transmission dispatched
  | 'Received' // Receiving party confirmed receipt
  | 'FirstReadingConducted' // First Reading completed at session (first_reading)
  | 'ReferredToCommittee' // Referred to one or more committees (committee_referral)
  | 'CommitteeReportSubmitted' // Committee report submitted to Secretariat
  | 'SecondReadingConducted' // Second Reading vote recorded (second_reading_vote)
  | 'ThirdReadingConducted' // Third Reading vote recorded (third_reading_vote — Ordinances)
  | 'FinalNumberAssigned' // Draft prefix removed; final series number assigned
  | 'VPCertified' // Vice Mayor signed the certified copy (vp_certification)
  | 'TransmittedToMayor' // Transmittal letter dispatched to Mayor (mayor review clock starts)
  | 'SignedByMayor' // Mayor signed within 10-day window
  | 'Vetoed' // Mayor returned with formal veto
  | 'Lapsed' // Mayor took no action; lapsed into law per RA 7160
  | 'DeemedApproved' // 30-day Panlalawigan window expired; RA 7160 §56(d)
  | 'SubmittedToPanlalawigan' // Transmitted to Sangguniang Panlalawigan
  | 'PanlalawiganOutcomeRecorded' // SP Secretary recorded Panlalawigan VALID / VALID_IN_PART / RETURNED
  | 'Released' // Document published to public portal
  | 'Archived' // Permanently archived by Records Officer
  // ── Added by J6 — sourced from D2 Diagrams 2, 3, 7B, 7C ──────────────────
  | 'CertificationOfUrgencyLogged' // [Added in J6 — D2 Diagram 2] Secretariat logged a Certification of Urgency; committee referral bypassed
  | 'CommitteeBypassApplied' // [Added in J6 — D2 Diagram 2] Workflow engine recorded committee_referral step as Skipped per CERTIFIED_URGENT bypass
  | 'OverrideVoteRecorded' // [Added in J6 — D2 Diagram 3] SP override vote outcome logged (OVERRIDE_SUCCEEDED or OVERRIDE_FAILED)
  | 'Docketed' // [Added in J6 — D2 Diagram 1] Docketing step completed; document readied for distribution
  | 'Repassed' // [Added in J6 — D2 Diagram 7C] Document returned to drafting after RETURNED Panlalawigan outcome
  | 'OrderOfBusinessScheduled'; // [Added in J6 — D2 Diagram 1] Document added to next Tuesday Order of Business
```

---

### `CommitteeReportStatus`

**Source:** DESIGN.md §6.6 CommitteeReferralBlock spec.

**Purpose:** Encodes the three possible states of a committee's engagement with a referred measure,
so that the `CommitteeReferralBlock` and `OrderOfBusinessRow` components can apply the correct
status chip color without re-interpreting strings.

> **Naming note:** F5 defines this type as `CommitteeReferralStatus` with value `'ABSENT_NOT_HEARD'`.
> The J6 task spec abbreviates the third literal to `'ABSENT'`. DESIGN.md §6.6 writes it as
> `ABSENT/NOT HEARD`. J6 defers to F5's `ABSENT_NOT_HEARD` because J6 never contradicts completed
> prior documents. The type is renamed `CommitteeReportStatus` (from F5's `CommitteeReferralStatus`)
> to distinguish it from the `CommitteeReferral` interface name. `// [F5 update required — rename
CommitteeReferralStatus → CommitteeReportStatus for disambiguation]`

```typescript
export type CommitteeReportStatus = 'SUBMITTED' | 'PENDING' | 'ABSENT_NOT_HEARD';
```

---

### `RoutingEntry`

**Source:** Consolidated ref Part 11.6 (every movement recorded: from, to, actor, timestamp, action).

**Purpose:** Models one node in the document routing timeline so that `RoutingHistoryTimeline` has
a strict contract for the data it renders.

> **Field naming note:** F5 uses `actor`, `actorOffice`, `fromOffice`, `toOffice`. J6 renames these
> to `actorName`, `actorOfficeName`, `fromOfficeName`, `toOfficeName` for clarity when destructured
> alongside other name-like fields. J6 also adds `notes?: string` (from Part 11.6: routing history
> records remarks). `// [F5 update required — rename actor→actorName, actorOffice→actorOfficeName,
fromOffice→fromOfficeName, toOffice→toOfficeName; add notes? field]`

```typescript
export interface RoutingEntry {
  id: string;
  actorName: string; // Display name of the person who performed the action
  actorOfficeName: string; // Office/role of the actor (e.g. "SP Secretariat")
  action: RoutingAction; // What happened
  timestamp: Date; // When it happened — render via DATE_FORMATS.displayWithTime
  notes?: string; // Optional remarks logged alongside the routing action
  fromOfficeName?: string; // Physical custody: where the document came from
  toOfficeName?: string; // Physical custody: where the document went
}
```

---

### `WorkflowStep`

**Source:** DESIGN.md §6.3 WorkflowStepIndicator; D2 Diagram 1 step sequence (step keys and their
human-readable labels).

**Purpose:** Models one node in the `WorkflowStepIndicator` so that every component PR starts from
the same data contract without re-deriving step shape from the workflow engine response.

> **Additions vs F5:** F5 includes `tooltip?: string`. J6 retains it and adds `completedAt?: Date`
> and `assigneeName?: string` (both surfaced in the DESIGN.md §6.3 WorkflowStepIndicator behavior
> spec and required for the tooltip content). `// [F5 update required — add completedAt? and
assigneeName? to WorkflowStep]`

```typescript
export interface WorkflowStep {
  id: string;
  label: string; // Human-readable step name; sourced from D2 Diagram 1 step keys
  state: 'completed' | 'active' | 'pending' | 'skipped' | 'error';
  completedAt?: Date; // [Added in J6 — F5 update required] Render via DATE_FORMATS.display
  assigneeName?: string; // [Added in J6 — F5 update required] Current or past assignee
  tooltip?: string; // Additional context shown on hover via Tooltip (Tier 1)
}
```

---

### `CommitteeReferral`

**Source:** DESIGN.md §6.6 CommitteeReferralBlock; consolidated ref Part 4.18 (committee report
required before Second Reading; SP Secretary decides which committee/s receive the referral).

**Purpose:** Models one committee's referral record so that both `CommitteeReferralBlock` and
`OrderOfBusinessRow` share the same shape without duplicating fields.

```typescript
export interface CommitteeReferral {
  id: string;
  committeeName: string;
  status: CommitteeReportStatus;
  submittedBy?: string; // Name of person who submitted the report (renders via AvatarName T2)
  submittedAt?: Date; // Render via DATE_FORMATS.displayWithTime
}
```

---

### `OrderOfBusinessItem`

**Source:** DESIGN.md §6.6 Order of Business Row; consolidated ref Part 4.18 (session agenda
document, committee report required before Second Reading, red-flagging missing reports).

**Purpose:** Models one row in the Order of Business view, carrying all display data for
`OrderOfBusinessRow` without the component needing to join multiple data sources at render time.

> **Changes vs F5:** F5 has `agendaNumber: string`, `documentNumberVariant`, `committees: string[]`,
> `reportStatus: CommitteeReportStatus`. J6 changes `agendaNumber` to `number` (it is an integer
> position in the agenda, not a formatted string), renames `documentNumberVariant` → `numberVariant:
NumberVariant`, replaces the flat `committees` array + `reportStatus` with the richer
> `committeeReferrals: CommitteeReferral[]` (allows per-committee status), adds `documentState:
DocumentState` (needed for StatusBadge inside the row), and adds `scheduledReadingType` (needed
> for the reading-type chip). `// [F5 update required — see all comments below]`

```typescript
export interface OrderOfBusinessItem {
  agendaNumber: number; // [Changed in J6 — F5 had string; F5 update required]
  documentNumber: string; // e.g. "7SP 2026-001"
  numberVariant: NumberVariant; // [F5 had documentNumberVariant; F5 update required]
  title: string;
  documentState: DocumentState; // [Added in J6 — F5 update required]
  committeeReferrals: CommitteeReferral[]; // [Changed in J6 — replaces F5's committees[] + reportStatus; F5 update required]
  isCertifiedUrgent: boolean;
  isMissingReport: boolean;
  scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD'; // [Added in J6 — F5 update required]
}
```

---

### `DocumentPreview`

**Source:** DESIGN.md §6.6 DocumentPreviewCard; F5 Tier 3 table `DocumentPreviewCard` entry.

**Purpose:** Models the data shape consumed by `DocumentPreviewCard` so the component never reaches
into a larger document object at render time.

> **Changes vs F5:** F5 has `documentNumberVariant` (renamed to `numberVariant: NumberVariant` for
> consistency with the shared type), `state: DocumentState` (renamed to `documentState` to avoid
> shadowing a commonly used variable name), and omits SLA fields. J6 adds `slaDeadlineAt?: Date` and
> `slaStartedAt?: Date` so the card can conditionally render an embedded `SLATimer` for documents in
> `PENDING_MAYOR` or `PANLALAWIGAN_REVIEW` without a second data fetch. `// [F5 update required —
rename documentNumberVariant, rename state→documentState, add slaDeadlineAt?, slaStartedAt?]`

```typescript
export interface DocumentPreview {
  id: string;
  documentNumber: string;
  numberVariant: NumberVariant; // [F5 had documentNumberVariant; F5 update required]
  title: string;
  documentState: DocumentState; // [F5 had state; renamed for clarity; F5 update required]
  lastActionAt: Date; // Render via DATE_FORMATS.displayWithTime
  slaDeadlineAt?: Date; // [Added in J6 — F5 update required] Omit if state has no running SLA
  slaStartedAt?: Date; // [Added in J6 — F5 update required] Omit if state has no running SLA
  thumbnailUrl?: string; // Omit to render bg-neutral-100 placeholder
}
```

---

### `StatusMetaEntry`

**Source:** DESIGN.md §6.3 Status Badge; §7 state color map.

**Purpose:** Defines the shape of one entry in `STATUS_META` so that the constant's type is
machine-checkable and every consumer knows exactly what fields to expect.

```typescript
export interface StatusMetaEntry {
  label: string;
  bg: string; // Tailwind bg-* utility class; must exist in globals.css @theme
  text: string; // Tailwind text-* utility class; must exist in globals.css @theme
  borderLeft: string; // Space-separated Tailwind border-l-* utilities; must exist in @theme
  borderStyle: 'solid' | 'dashed';
  textStyle: 'normal' | 'italic' | 'line-through';
}
```

---

## Section 2 — STATUS_META Constant {#section-2}

**File:** `packages/ui/src/lib/status-meta.ts`
**Export:** named `STATUS_META`, re-exported from `@batac/ui`

**Critical pre-flight notes:**

1. **§7 labeling conflict on neutral border color:** DESIGN.md §7 consistently labels hex `#868e96`
   as `neutral-500`. In globals.css `@theme`, `neutral-500 = #adb5bd` and `neutral-600 = #868e96`.
   The hex is authoritative. Every border entry that §7 associates with `#868e96` uses
   `border-l-neutral-600` in STATUS_META. This is a systematic DESIGN.md §7 correction; see
   Section 4 Delta item 1.

2. **`DEEMED_APPROVED` textStyle:** DESIGN.md §7 notes column states "Dashed border variant, italic
   label" — therefore `textStyle: 'italic'` even though the task spec only called out `borderStyle`.

3. **States not in §7:** SUBMITTED, IN_WORKFLOW, PENDING_APPROVAL, COMPLETED, RELEASED, DISPOSED,
   RECEIVED_SEEN are derived from the closest analogous §7 state. Each is annotated.

```typescript
import type { DocumentState, StatusMetaEntry } from './types/domain';

/**
 * STATUS_META — canonical color and style map for every DocumentState.
 *
 * All Tailwind class strings validated against globals.css @theme block.
 * Source of truth: DESIGN.md §7. Where §7 is silent, the entry is derived
 * from the nearest analogous state (annotated inline).
 *
 * §7 labeling conflict: hex #868e96 is labeled (neutral-500) in §7 but is
 * neutral-600 in @theme. All occurrences corrected to border-l-neutral-600.
 * See Section 4 Delta item 1.
 */
export const STATUS_META: Record<DocumentState, StatusMetaEntry> = {
  // ── Core lifecycle states ─────────────────────────────────────────────────

  DRAFT: {
    label: 'Draft',
    bg: 'bg-neutral-100', // #f1f3f5 — neutral-100 ✓ in @theme
    text: 'text-neutral-700', // #495057 — neutral-700 ✓ in @theme
    borderLeft: 'border-l-2 border-l-neutral-600',
    // NOTE: §7 labels this border as neutral-500 (#868e96) but neutral-500 = #adb5bd in @theme.
    // The hex #868e96 = neutral-600. Using neutral-600. See Section 4 Delta item 1.
    borderStyle: 'dashed', // Mandated by DESIGN.md §7 / §2 "Preliminary drafts use dashed border"
    textStyle: 'normal',
  },

  SUBMITTED: {
    label: 'Submitted',
    bg: 'bg-neutral-50', // #f8f9fa — neutral-50 ✓ in @theme
    text: 'text-neutral-700', // neutral-700 ✓
    borderLeft: 'border-l-2 border-l-neutral-500', // neutral-500 ✓ — lighter than DRAFT to signal progression
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from DRAFT; lighter neutral to indicate intake progression;
    //  DESIGN.md update required — add SUBMITTED row to §7]
  },

  IN_WORKFLOW: {
    label: 'In Workflow',
    bg: 'bg-info-100', // #dbeafe — info-100 ✓ in @theme
    text: 'text-info-900', // #1e3a8a — info-900 ✓ in @theme
    borderLeft: 'border-l-2 border-l-info-500', // info-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from IN_COMMITTEE; represents active pipeline processing;
    //  DESIGN.md update required — add IN_WORKFLOW row to §7]
  },

  PENDING_APPROVAL: {
    label: 'Pending Approval',
    bg: 'bg-warning-100', // #fef3c7 — warning-100 ✓ in @theme
    text: 'text-warning-900', // #78350f — warning-900 ✓ in @theme
    borderLeft: 'border-l-2 border-l-warning-500', // warning-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from PENDING_MAYOR; generic pre-approval waiting state
    //  for non-SP document types; DESIGN.md update required — add PENDING_APPROVAL row to §7]
  },

  COMPLETED: {
    label: 'Completed',
    bg: 'bg-success-100', // #d1fae5 — success-100 ✓ in @theme
    text: 'text-success-900', // #064e3b — success-900 ✓ in @theme
    borderLeft: 'border-l-2 border-l-success-500', // success-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from VALID; terminal approved outcome before Release;
    //  DESIGN.md update required — add COMPLETED row to §7]
  },

  RELEASED: {
    label: 'Released',
    bg: 'bg-success-100', // success-100 ✓
    text: 'text-success-900', // success-900 ✓
    borderLeft: 'border-l-2 border-l-success-300', // #6ee7b7 — success-300 ✓ in @theme
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from VALID; success-300 border distinguishes RELEASED
    //  (publicly visible) from VALID (Panlalawigan affirmed but not yet published);
    //  DESIGN.md update required — add RELEASED row to §7]
  },

  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-neutral-100', // neutral-100 ✓
    text: 'text-neutral-600', // #868e96 — neutral-600 ✓ in @theme (muted, read-only signal)
    borderLeft: 'border-l-2 border-l-neutral-400', // #ced4da — neutral-400 ✓ in @theme
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 ARCHIVED row.
  },

  DISPOSED: {
    label: 'Disposed',
    bg: 'bg-neutral-100', // neutral-100 ✓
    text: 'text-neutral-600', // neutral-600 ✓
    borderLeft: 'border-l-2 border-l-neutral-400', // neutral-400 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from ARCHIVED; Records-managed disposition (no data
    //  deletion); identical visual to ARCHIVED since both are terminal read-only states;
    //  DESIGN.md update required — add DISPOSED row to §7]
  },

  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-neutral-100', // neutral-100 ✓
    text: 'text-neutral-600', // neutral-600 ✓ — §7: #868e96 = neutral-600
    borderLeft: 'border-l-2 border-l-neutral-400', // neutral-400 ✓
    borderStyle: 'solid',
    textStyle: 'line-through', // Mandated by DESIGN.md §7 — "neutral (strikethrough)" category
    // SOURCE: DESIGN.md §7 CANCELLED row.
  },

  // ── Reading and workflow-step states ────────────────────────────────────

  FIRST_READING: {
    label: 'First Reading',
    bg: 'bg-info-100', // info-100 ✓
    text: 'text-info-900', // info-900 ✓
    borderLeft: 'border-l-2 border-l-info-500', // info-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 FIRST_READING row.
  },

  SECOND_READING: {
    label: 'Second Reading',
    bg: 'bg-info-100',
    text: 'text-info-900',
    borderLeft: 'border-l-2 border-l-info-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 SECOND_READING row.
  },

  THIRD_READING: {
    label: 'Third Reading',
    bg: 'bg-info-100',
    text: 'text-info-900',
    borderLeft: 'border-l-2 border-l-info-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 THIRD_READING row.
  },

  IN_COMMITTEE: {
    label: 'In Committee',
    bg: 'bg-info-100',
    text: 'text-info-900',
    borderLeft: 'border-l-2 border-l-info-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 IN_COMMITTEE row.
  },

  PENDING_MAYOR: {
    label: 'Pending Mayor',
    bg: 'bg-warning-100', // warning-100 ✓
    text: 'text-warning-900', // warning-900 ✓
    borderLeft: 'border-l-2 border-l-warning-500', // warning-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 PENDING_MAYOR row. warning-* scale per DESIGN.md §7 amber/warning mapping.
  },

  VETOED: {
    label: 'Vetoed',
    bg: 'bg-danger-100', // danger-100 ✓
    text: 'text-danger-900', // #7f1d1d — danger-900 ✓ in @theme
    borderLeft: 'border-l-2 border-l-danger-500', // danger-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 VETOED row.
  },

  OVERRIDE_PENDING: {
    label: 'Override Pending',
    bg: 'bg-warning-100',
    text: 'text-warning-900',
    borderLeft: 'border-l-2 border-l-warning-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 OVERRIDE_PENDING row.
  },

  LAPSED: {
    label: 'Lapsed',
    bg: 'bg-neutral-100',
    text: 'text-neutral-700', // #495057 ✓
    borderLeft: 'border-l-2 border-l-neutral-400', // #ced4da ✓
    borderStyle: 'solid',
    textStyle: 'italic', // Mandated by DESIGN.md §7 — "italic" in text column
    // SOURCE: DESIGN.md §7 LAPSED row. LAPSED is not a failure — the document became law
    // per RA 7160 §47 (Resolutions) or §47 (Ordinances). Italic distinguishes it from
    // CANCELLED (line-through) and ARCHIVED (normal).
  },

  // ── Panlalawigan review outcome states ───────────────────────────────────

  PANLALAWIGAN_REVIEW: {
    label: 'Panlalawigan Review',
    bg: 'bg-warning-100',
    text: 'text-warning-900',
    borderLeft: 'border-l-2 border-l-warning-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 PANLALAWIGAN_REVIEW row. 30-day SLA timer active.
  },

  VALID: {
    label: 'Valid',
    bg: 'bg-success-100',
    text: 'text-success-900',
    borderLeft: 'border-l-2 border-l-success-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 VALID row.
  },

  VALID_IN_PART: {
    label: 'Valid in Part',
    bg: 'bg-warning-100',
    text: 'text-warning-900',
    borderLeft: 'border-l-2 border-l-warning-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 VALID_IN_PART row. Requires Secretariat follow-up action.
  },

  RETURNED: {
    label: 'Returned',
    bg: 'bg-danger-100',
    text: 'text-danger-900',
    borderLeft: 'border-l-2 border-l-danger-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 RETURNED row. Implementation typically stopped (Part 4.3).
  },

  DEEMED_APPROVED: {
    label: 'Deemed Approved',
    bg: 'bg-success-100', // success-100 ✓
    text: 'text-success-900', // success-900 ✓
    borderLeft: 'border-l-2 border-l-success-300', // #6ee7b7 — success-300 ✓ in @theme
    borderStyle: 'dashed', // Mandated by DESIGN.md §7 — "Dashed border variant"
    textStyle: 'italic', // DESIGN.md §7 notes: "italic label"
    // SOURCE: DESIGN.md §7 DEEMED_APPROVED row. RA 7160 §56(d) legal basis.
    // success-300 left border (not success-500) signals muted approval — Panlalawigan
    // did not act, so it is passive approval rather than active affirmation.
  },

  // ── Citizen complaint states ─────────────────────────────────────────────

  PENDING_HEARING: {
    label: 'Pending Hearing',
    bg: 'bg-warning-100',
    text: 'text-warning-900',
    borderLeft: 'border-l-2 border-l-warning-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 PENDING_HEARING (complaint) row.
  },

  RECEIVED_SEEN: {
    label: 'Received / Seen',
    bg: 'bg-info-100', // info-100 ✓
    text: 'text-info-900', // info-900 ✓
    borderLeft: 'border-l-2 border-l-info-500', // info-500 ✓
    borderStyle: 'solid',
    textStyle: 'normal',
    // [Not in DESIGN.md §7 — derived from PENDING_HEARING (info palette chosen to
    //  distinguish "acknowledged" from "still pending"); sourced from Part 4.14 complaint
    //  states; DESIGN.md update required — add RECEIVED_SEEN row to §7]
  },

  DISMISSED: {
    label: 'Dismissed',
    bg: 'bg-neutral-100',
    text: 'text-neutral-700', // #495057 ✓ — §7: "neutral | #f1f3f5 | #495057"
    borderLeft: 'border-l-2 border-l-neutral-600',
    // NOTE: §7 shows #868e96 for border (no label given). #868e96 = neutral-600 in @theme.
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 DISMISSED (complaint) row.
  },

  RESOLVED: {
    label: 'Resolved',
    bg: 'bg-success-100',
    text: 'text-success-900',
    borderLeft: 'border-l-2 border-l-success-500',
    borderStyle: 'solid',
    textStyle: 'normal',
    // SOURCE: DESIGN.md §7 RESOLVED (complaint) row.
  },
};
```

### STATUS_META Completeness Validation

Every member of `DocumentState` has a corresponding key in STATUS_META:

| State                 | In §7? | Entry present?                             |
| --------------------- | ------ | ------------------------------------------ |
| `DRAFT`               | ✓      | ✓                                          |
| `SUBMITTED`           | ✗      | ✓ (derived from DRAFT)                     |
| `IN_WORKFLOW`         | ✗      | ✓ (derived from IN_COMMITTEE)              |
| `PENDING_APPROVAL`    | ✗      | ✓ (derived from PENDING_MAYOR)             |
| `COMPLETED`           | ✗      | ✓ (derived from VALID)                     |
| `RELEASED`            | ✗      | ✓ (derived from VALID, success-300 border) |
| `ARCHIVED`            | ✓      | ✓                                          |
| `DISPOSED`            | ✗      | ✓ (derived from ARCHIVED)                  |
| `CANCELLED`           | ✓      | ✓                                          |
| `FIRST_READING`       | ✓      | ✓                                          |
| `SECOND_READING`      | ✓      | ✓                                          |
| `THIRD_READING`       | ✓      | ✓                                          |
| `IN_COMMITTEE`        | ✓      | ✓                                          |
| `PENDING_MAYOR`       | ✓      | ✓                                          |
| `VETOED`              | ✓      | ✓                                          |
| `OVERRIDE_PENDING`    | ✓      | ✓                                          |
| `LAPSED`              | ✓      | ✓                                          |
| `PANLALAWIGAN_REVIEW` | ✓      | ✓                                          |
| `VALID`               | ✓      | ✓                                          |
| `VALID_IN_PART`       | ✓      | ✓                                          |
| `RETURNED`            | ✓      | ✓                                          |
| `DEEMED_APPROVED`     | ✓      | ✓                                          |
| `PENDING_HEARING`     | ✓      | ✓                                          |
| `RECEIVED_SEEN`       | ✗      | ✓ (derived from PENDING_HEARING)           |
| `DISMISSED`           | ✓      | ✓                                          |
| `RESOLVED`            | ✓      | ✓                                          |

**Result: 26/26 states covered. No state is missing.**

---

## Section 3 — Per-Component Specifications {#section-3}

> **Import alias convention throughout this section:**
>
> - `@batac/ui/types/domain` — shared domain types from Section 1
> - `@batac/ui/lib/status-meta` — STATUS_META constant
> - `@batac/ui/lib/date-locale` — DATE_FORMATS, phLocale
> - `@batac/ui/components/domain/*` — peer Tier 3 components
> - `@batac/ui/components/ui/*` — Tier 1 shadcn primitives

---

### 3.1 PageHeader

#### 3.1.1 Props Interface

No additions to F5. Interface is canonical as specified.

```typescript
// packages/ui/src/components/domain/PageHeader.tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Page title — renders as h1 with text-2xl font-bold text-text-primary */
  title: string;
  /** Optional subtitle — renders as text-sm text-text-secondary mt-1 */
  subtitle?: string;
  /** Right slot: pass fully constructed Button (T2) elements */
  actions?: ReactNode;
  className?: string;
}
```

#### 3.1.2 Tier 1 and Tier 2 Dependencies

- **`Button` (Tier 2 CVA override):** Consumed in the `actions` render slot; the PageHeader renders the slot verbatim so it does not import `Button` directly — the consumer passes it. The component itself has no direct Tier 1 or Tier 2 imports.

#### 3.1.3 Visual Behavior

`PageHeader` is a structural container with no interactive states of its own. It always renders a bottom border (`border-b border-border-default`) and consistent bottom margin (`mb-6 pb-4`) so that every routed view in the app has a visually identical header zone. The `title` is always an `<h1>` element (never `<div>`, never `<h2>`) because each view renders exactly one page-level heading, ensuring a correct document outline for screen readers. The `subtitle`, when present, renders immediately beneath the title with reduced visual weight. The `actions` slot is right-aligned via `flex justify-between items-start` on the container row — the left side holds title + subtitle, the right side holds actions. Nothing in the component changes between states; it is purely structural.

#### 3.1.4 ARIA Requirements

See F6 §2 (Universal Rules) for the full ARIA contract. No ARIA attributes affect the props interface — the `<h1>` role is implicit.

#### 3.1.5 Usage Example

```tsx
import { PageHeader } from '@batac/ui/components/domain/PageHeader';
import { Button } from '@batac/ui/components/ui/button';

export function OrderOfBusinessPage() {
  return (
    <PageHeader
      title="Order of Business"
      subtitle="Regular Session · Tuesday, 17 June 2026"
      actions={
        <Button variant="default" onClick={() => {}}>
          Generate Order of Business
        </Button>
      }
    />
  );
}
```

#### 3.1.6 Anti-Pattern

**Wrong:**

```tsx
// Using h2 for the page title
<div className="border-border-default mb-6 border-b pb-4">
  <h2 className="text-text-primary text-2xl font-bold">{title}</h2>
</div>
```

This breaks the document heading hierarchy: screen readers expect each page to have exactly one `<h1>`. When `PageHeader` uses `<h2>`, the page has no `<h1>`, causing navigation landmarks to break and failing WCAG 2.1 §1.3.1.

---

### 3.2 Sidebar

#### 3.2.1 Props Interface

No additions to F5. Interface is canonical.

```typescript
// packages/ui/src/components/domain/Sidebar.tsx
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Unread count — renders as danger-500 pill per DESIGN.md §6.1 badge variant */
  badge?: number;
  disabled?: boolean;
}

interface SidebarUser {
  name: string;
  role: string;
}

interface SidebarProps {
  items: NavItem[];
  activeItemId: string;
  collapsed: boolean;
  onToggle: () => void;
  currentUser: SidebarUser;
}
```

#### 3.2.2 Tier 1 and Tier 2 Dependencies

- **`Tooltip` (Tier 1):** Wraps each nav item icon in collapsed mode — the icon is the only visible element when `collapsed=true`, and Tooltip provides the label text that would otherwise be hidden, meeting DESIGN.md §8 Rule 5 (icon-only buttons require accessible labels).
- **`AvatarName` (Tier 2 CVA override):** Renders the current user's avatar + name + role at the bottom of the sidebar in expanded mode (`size="md"`); in collapsed mode, only the avatar is shown.

#### 3.2.3 Visual Behavior

The sidebar background is always `bg-primary-950` — this is an invariant from DESIGN.md §8 Rule 3 that must never be lightened. In expanded state (`collapsed=false`), the sidebar is `w-60` (240px). In collapsed state it is `w-14` (56px). The width transition uses `transition-[width] duration-base ease-default` to animate smoothly.

Each nav item renders two distinct visual states: default (`text-primary-200 hover:bg-primary-800 hover:text-white`) and active (`bg-primary-700 text-white font-semibold border-l-2 border-l-warning-500`). The `border-l-warning-500` on the active item is a non-color redundant signal per DESIGN.md §8 Rule 2. Disabled items render at `opacity-40 cursor-not-allowed pointer-events-none`. The badge pill uses `bg-danger-500 text-white` with `.touch-exempt` applied because the badge is decorative and not independently interactive.

In collapsed mode, nav item `<span>` labels receive the `hidden` class — labels disappear but the icon remains, and the `Tooltip` provides the equivalent accessible text. The structure must never add `display: none` to the icon itself.

#### 3.2.4 ARIA Requirements

See F6 §3.5 for the full ARIA contract for Sidebar navigation. ARIA attributes that affect the props interface: none — the `activeItemId` comparison drives `aria-current="page"` on the active item internally.

#### 3.2.5 Usage Example

```tsx
import { Sidebar } from '@batac/ui/components/domain/Sidebar';
import { FileText, Users, Calendar, LayoutDashboard } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'documents', label: 'Documents', icon: FileText, href: '/documents', badge: 3 },
  { id: 'sessions', label: 'Sessions', icon: Calendar, href: '/sessions' },
  { id: 'members', label: 'SP Members', icon: Users, href: '/members' },
];

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <Sidebar
      items={navItems}
      activeItemId="documents"
      collapsed={collapsed}
      onToggle={onToggle}
      currentUser={{ name: 'Gladys R. Lagura', role: 'SP Secretary' }}
    />
  );
}
```

#### 3.2.6 Anti-Pattern

**Wrong:**

```tsx
// Lightening the sidebar in collapsed mode
<aside className={collapsed ? 'bg-neutral-100 w-14' : 'bg-primary-950 w-60'}>
```

DESIGN.md §8 Rule 3 is explicit: the sidebar must remain `bg-primary-950` in all states, including collapsed. Lightening it to `neutral-100` destroys the structural hierarchy that visually separates navigation from content and breaks brand coherence.

---

### 3.3 Topbar

#### 3.3.1 Props Interface

No additions to F5. The `SidebarUser` interface is shared with `Sidebar` and defined once in `packages/ui/src/components/domain/types.ts`.

```typescript
// packages/ui/src/components/domain/Topbar.tsx

interface BreadcrumbItem {
  label: string;
  /** Omit for the current (non-linked) final segment */
  href?: string;
}

interface TopbarProps {
  breadcrumbs: BreadcrumbItem[];
  /** Tracks sidebar width to adjust left offset (left-60 vs left-14) */
  sidebarCollapsed: boolean;
  notificationCount?: number;
  onNotificationClick?: () => void;
  currentUser: SidebarUser;
  onUserMenuAction?: (action: 'profile' | 'logout') => void;
}
```

#### 3.3.2 Tier 1 and Tier 2 Dependencies

- **`Breadcrumb` (Tier 1):** Renders the breadcrumb trail in the left slot; separator is the `/` literal character per DESIGN.md §6.2 (not a Lucide separator icon).
- **`Tooltip` (Tier 1):** Wraps the notification bell icon-only button — the bell icon must have both `aria-label` and a visible `Tooltip` per DESIGN.md §8 Rule 5.
- **`Popover` (Tier 1):** Wraps the user account menu triggered by the `AvatarName` in the right slot; provides keyboard-accessible dropdown behavior.
- **`AvatarName` (Tier 2 CVA override):** Renders the current user avatar + name in the right slot at `size="lg"`; acts as the Popover trigger.

#### 3.3.3 Visual Behavior

The topbar is always `fixed top-0 bg-white border-b border-border-default z-sticky`. Its left offset transitions between `left-60` (expanded sidebar) and `left-14` (collapsed sidebar) driven by `sidebarCollapsed`. This offset must use a CSS transition (`transition-[left] duration-base ease-default`) to stay in sync with the Sidebar width animation. The right is always `right-0` with `h-14` height.

The breadcrumb trail never wraps — on narrow viewports, middle segments truncate with `…` while the first and last segments always remain visible. The notification badge (when `notificationCount` is provided and greater than zero) renders as `bg-danger-500 text-white` over the bell icon, identical in structure to the Sidebar nav badge.

#### 3.3.4 ARIA Requirements

See F6 §3.6 (Topbar command palette) for the full ARIA contract. ARIA attributes affecting the props interface: `onNotificationClick` drives a button that must receive `aria-label="Notifications"` internally; `onUserMenuAction` drives the Popover which must receive `aria-label="User account menu"` internally.

#### 3.3.5 Usage Example

```tsx
import { Topbar } from '@batac/ui/components/domain/Topbar';

export function AppTopbar({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  return (
    <Topbar
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Documents', href: '/documents' },
        { label: '7SP 2026-001' }, // No href — current page
      ]}
      sidebarCollapsed={sidebarCollapsed}
      notificationCount={2}
      onNotificationClick={() => {}}
      currentUser={{ name: 'Gladys R. Lagura', role: 'SP Secretary' }}
      onUserMenuAction={(action) => {
        if (action === 'logout') {
          /* handle logout */
        }
      }}
    />
  );
}
```

#### 3.3.6 Anti-Pattern

**Wrong:**

```tsx
// Using a Lucide ChevronRight as the breadcrumb separator
<BreadcrumbSeparator>
  <ChevronRight className="h-4 w-4" />
</BreadcrumbSeparator>
```

DESIGN.md §6.2 mandates the `/` literal character as the breadcrumb separator, not an icon. A Lucide icon has a different visual weight and, if used as a `<svg>` without text content, requires explicit `aria-hidden="true"` to avoid screen reader confusion.

---

### 3.4 AppShell

#### 3.4.1 Props Interface

No additions to F5. Interface is canonical.

```typescript
// packages/ui/src/components/domain/AppShell.tsx
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  /** Driven by apps/web useLayoutStore — passed as prop to keep packages/ui Zustand-free */
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  /** Rendered in the fixed left slot */
  sidebarContent: ReactNode;
  /** Rendered in the fixed top slot */
  topbarContent: ReactNode;
}
```

#### 3.4.2 Tier 1 and Tier 2 Dependencies

`AppShell` composes `Sidebar` (Tier 3) and `Topbar` (Tier 3) through the `sidebarContent` and `topbarContent` render slots — it does not import them directly. This is intentional: `AppShell` is a layout container that must not hardcode which navigation component is used, enabling test substitution.

#### 3.4.3 Visual Behavior

`AppShell` defines three fixed regions that never overlap. The sidebar occupies `fixed left-0 top-0 h-screen z-sticky`. The topbar occupies `fixed top-0 right-0 z-sticky` with left offset matching the sidebar width. The main content area is `overflow-y-auto min-h-screen` with top margin `mt-14` (topbar height) and left margin that switches between `ml-60` and `ml-14` in sync with `sidebarCollapsed`. No scrollbar appears within the sidebar or topbar — only the main content area scrolls. Background is `bg-surface-raised` (`#f8f9fa`) on the main area, providing subtle differentiation from the white card surfaces within it.

#### 3.4.4 ARIA Requirements

See F6 §2 (Universal Rules). `AppShell` renders an implicit `<main>` landmark for the scrollable content area. The `sidebarContent` slot wraps in `<nav aria-label="Main navigation">` internally.

#### 3.4.5 Usage Example

```tsx
import { AppShell } from '@batac/ui/components/domain/AppShell';
import { AppSidebar } from './AppSidebar'; // consumer-defined composition
import { AppTopbar } from './AppTopbar';

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <AppShell
      sidebarCollapsed={collapsed}
      onSidebarToggle={() => setCollapsed((c) => !c)}
      sidebarContent={<AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />}
      topbarContent={<AppTopbar sidebarCollapsed={collapsed} />}
    >
      {children}
    </AppShell>
  );
}
```

#### 3.4.6 Anti-Pattern

**Wrong:**

```tsx
// Importing Zustand inside AppShell
import { useLayoutStore } from '@batac/web/stores/layoutStore';

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  // ...
}
```

`packages/ui` must not import from `apps/web`. Zustand is installed only under `--filter @batac/web` per the confirmed `INSTALL.sh` Step 3. Importing it from `packages/ui` would add Zustand as a peer dependency of the UI package, breaking the `apps/portal` consumption path in Phase 3.

---

### 3.5 DocumentNumberBadge

#### 3.5.1 Props Interface

No additions to F5. Interface is canonical.

```typescript
// packages/ui/src/components/domain/DocumentNumberBadge.tsx

interface DocumentNumberBadgeProps {
  /** Formatted document number string, e.g. "7SP 2026-001" or "Draft 7SP 2026-02" */
  number: string;
  /** Controls visual variant per DESIGN.md §6.3 Document Number Badge */
  variant: NumberVariant;
  className?: string;
}
```

#### 3.5.2 Tier 1 and Tier 2 Dependencies

No Tier 1 or Tier 2 imports. This component is pure Tailwind.

#### 3.5.3 Visual Behavior

`DocumentNumberBadge` is the signature component of the design system (DESIGN.md §2). It always renders the number in `font-mono` — this is a hard invariant that applies in every table cell, detail view, search result, and QR overlay with no exceptions.

The `final` variant renders `bg-primary-50 text-primary-800 border border-primary-300 border-l-2 border-l-primary-800 rounded-sm` — a solid primary-800 left border signals enacted status. The `preliminary` variant renders `bg-neutral-50 text-text-secondary border border-dashed border-neutral-400 rounded-sm italic` — the dashed border and italic text signal that the number and document content are not yet final. The badge is never truncated: if containing table cell space is tight, the cell wraps. The `.touch-exempt` class is always applied because the badge is not interactive. Container: `inline-flex items-center px-2 py-0.5 font-mono text-xs font-medium touch-exempt`.

Between `final` and `preliminary`, only the border style, background, text color, and font-style change. The container dimensions, padding, font size, and `touch-exempt` class are structurally stable across variants.

#### 3.5.4 ARIA Requirements

See F6 §2 (Universal Rules). No ARIA attributes affect the props interface — the number string itself is the accessible text content.

#### 3.5.5 Usage Example

```tsx
import { DocumentNumberBadge } from '@batac/ui/components/domain/DocumentNumberBadge';

// Final enacted resolution
<DocumentNumberBadge number="7SP 2026-001" variant="final" />

// Preliminary draft resolution
<DocumentNumberBadge number="Draft 7SP 2026-02" variant="preliminary" />

// Letter received — always final (no Draft prefix for SPR documents)
<DocumentNumberBadge number="SPR 2026-038" variant="final" />
```

#### 3.5.6 Anti-Pattern

**Wrong:**

```tsx
<span className="text-primary-800 font-sans text-xs">7SP 2026-001</span>
```

Using `font-sans` for a document number violates DESIGN.md §8 Rule 1 and Rule 12. In a dense table with many document numbers, proportional characters make the fixed-width format `7SP 2026-001` harder to scan and compare at a glance. Monospace is a government-document identity signal, not an aesthetic preference.

---

### 3.6 StatCard

#### 3.6.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/StatCard.tsx

interface StatCardTrend {
  value: number;
  direction: 'up' | 'down';
  label?: string; // e.g. "from last week"
}

interface StatCardProps {
  metric: string | number;
  label: string;
  trend?: StatCardTrend;
  className?: string;
}
```

#### 3.6.2 Tier 1 and Tier 2 Dependencies

- **`Card` (Tier 1):** Provides the `rounded-lg border border-border-default shadow-sm` surface. `StatCard` renders as `<Card className="p-4">` rather than reimplementing card chrome.

#### 3.6.3 Visual Behavior

The metric renders at `text-3xl font-bold text-text-primary` — this is the largest text in the data-density scale and the only use of `text-3xl` outside page-level headers. The label renders at `text-xs font-semibold uppercase tracking-wide text-text-muted`. When `trend` is provided, it renders below the label: an up-direction trend uses `text-success-500` with a Lucide `TrendingUp` icon; down uses `text-danger-500` with `TrendingDown`. The optional `trend.label` renders as `text-xs text-text-muted` beside the trend value. No state changes occur within the card itself — all dynamic behavior is driven by prop updates from the parent.

#### 3.6.4 ARIA Requirements

See F6 §2 (Universal Rules). No ARIA attributes affect the props interface.

#### 3.6.5 Usage Example

```tsx
import { StatCard } from '@batac/ui/components/domain/StatCard';

<StatCard
  metric={14}
  label="Pending in Queue"
  trend={{ value: 3, direction: 'up', label: 'from last week' }}
/>

<StatCard
  metric="7SP 2026-001"
  label="Latest Enacted Resolution"
  // trend omitted — no trend applicable for a document number metric
/>
```

#### 3.6.6 Anti-Pattern

**Wrong:**

```tsx
<StatCard
  metric={14}
  label="Pending"
  trend={{ value: 3, direction: 'up' }}
  className="bg-primary-50"
/>
```

Overriding the card background via `className` violates DESIGN.md §8 Rule 7 (color should never be used decoratively). `StatCard` backgrounds are always `bg-white` (via the `Card` primitive's default). Adding `bg-primary-50` to communicate a priority tier is an incorrect encoding — use a separate badge or alert instead.

---

### 3.7 EmptyState

#### 3.7.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/EmptyState.tsx
import type { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  /** Directive heading — state what is empty */
  heading: string;
  /** Directive body — state what action creates content */
  body: string;
  action?: EmptyStateAction;
  className?: string;
}
```

#### 3.7.2 Tier 1 and Tier 2 Dependencies

- **`Button` (Tier 2 CVA override):** Renders the optional CTA action (`variant="default"`).

#### 3.7.3 Visual Behavior

`EmptyState` always renders centered (`flex flex-col items-center text-center gap-4`). The icon renders at `h-12 w-12 text-neutral-300` — large, low-contrast, purely illustrative. The heading renders at `text-lg font-semibold text-text-secondary`. The body renders at `text-sm text-text-muted`. The optional action button renders at `mt-2`. Copy must be directive and never apologetic per DESIGN.md §8 Rule 9: heading states what is absent, body states what action resolves it. Nothing changes about the visual structure in any state.

#### 3.7.4 ARIA Requirements

See F6 §2 (Universal Rules). The icon receives `aria-hidden="true"` internally (it is decorative). No ARIA attributes affect the props interface.

#### 3.7.5 Usage Example

```tsx
import { EmptyState } from '@batac/ui/components/domain/EmptyState';
import { FileText } from 'lucide-react';

<EmptyState
  icon={FileText}
  heading="No documents in queue"
  body="Upload a resolution or ordinance to begin the SP workflow."
  action={{ label: 'Upload Document', onClick: () => {} }}
/>;
```

#### 3.7.6 Anti-Pattern

**Wrong:**

```tsx
<EmptyState
  icon={InboxIcon}
  heading="Sorry, nothing here yet!"
  body="It looks like there are no documents to display."
  // action omitted
/>
```

Apologetic copy ("Sorry") and passive language ("it looks like") violate DESIGN.md §8 Rule 9. Staff using this app all day need directive, actionable messages — not apologies. Omitting the action when an obvious action exists leaves users without a path forward.

---

### 3.8 ScanQualityIndicator

#### 3.8.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/ScanQualityIndicator.tsx

interface ScanQualityIndicatorProps {
  /** 0–100. Component derives ScanQualityLevel internally. */
  score: number;
  /** When true, renders the level label text alongside the color indicator */
  showLabel?: boolean;
  className?: string;
}
```

#### 3.8.2 Tier 1 and Tier 2 Dependencies

- **`Tooltip` (Tier 1):** Wraps the indicator in all cases; tooltip text is the full label + score (e.g., "Excellent — 97 / 100") for contexts where `showLabel` is false and the indicator appears as an icon or dot only.

#### 3.8.3 Visual Behavior

The component converts `score` to `ScanQualityLevel` internally using this mapping: `score >= 95 → 'excellent'`, `score >= 80 → 'good'`, `score >= 60 → 'fair'`, `score < 60 → 'poor'`. The color classes per level: `excellent → text-success-500`, `good → text-info-500`, `fair → text-warning-500`, `poor → text-danger-500`. When `showLabel=true`, the label text ("Excellent", "Good", "Fair", "Poor") renders beside the indicator in the same color. When `showLabel=false` (default), only the icon/dot renders, with the full detail surfaced via Tooltip.

No structure changes between levels — only the color class applied to the container changes.

#### 3.8.4 ARIA Requirements

See F6 §2 (Universal Rules). No ARIA attributes affect the props interface — the Tooltip provides the accessible description internally.

#### 3.8.5 Usage Example

```tsx
import { ScanQualityIndicator } from '@batac/ui/components/domain/ScanQualityIndicator';

// In a document upload zone after OCR (consolidated ref Part 11.4: OCR runs automatically)
<ScanQualityIndicator
  score={92}
  showLabel={true}
  // Renders: text-info-500 "Good" label (80–94% range)
/>

// In a file list where space is tight
<ScanQualityIndicator
  score={48}
  showLabel={false}
  // Renders: text-danger-500 dot/icon + Tooltip "Poor — 48 / 100"
/>
```

#### 3.8.6 Anti-Pattern

**Wrong:**

```tsx
// Deriving the level outside the component and passing it as a prop
type QualityProps = { level: 'excellent' | 'good' | 'fair' | 'poor'; score: number };
```

Externalising the level derivation forces every caller to implement the same threshold logic, creating duplication risk. The score-to-level boundary values come from DESIGN.md §6.3 and are design decisions — they belong in the component, not in every consumer.

---

### 3.9 SLATimer

#### 3.9.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/SLATimer.tsx

interface SLATimerProps {
  /** When the SLA window expires */
  deadlineAt: Date;
  /** When the SLA clock started (document entered a time-constrained state) */
  startedAt: Date;
  /** Human-readable label becomes aria-label on the role="timer" container */
  label: string;
  className?: string;
}
```

#### 3.9.2 Tier 1 and Tier 2 Dependencies

No Tier 1 or Tier 2 imports. Pure Tailwind and date arithmetic.

#### 3.9.3 Visual Behavior

`SLATimer` derives `SLAStatus` internally: compute `elapsed = (now - startedAt) / (deadlineAt - startedAt)` as a ratio. `elapsed < 0.8 → 'on-track'`, `0.8 ≤ elapsed < 1.0 → 'at-risk'`, `elapsed ≥ 1.0 → 'breached'`.

| SLAStatus  | Bar fill                                   | Text               | Extra                              |
| ---------- | ------------------------------------------ | ------------------ | ---------------------------------- |
| `on-track` | `bg-success-500` on `bg-success-100` track | `text-success-500` | —                                  |
| `at-risk`  | `bg-warning-500` on `bg-warning-100` track | `text-warning-500` | Pulsing amber dot beside the label |
| `breached` | `bg-danger-500` on `bg-danger-100` track   | `text-danger-500`  | `animate-pulse` on the entire bar  |

The progress bar width is `Math.min(elapsed * 100, 100)%` expressed as an inline style on the fill element (`width` style — this is the only justified use of inline styles in Tier 3 since the progress percentage cannot be expressed as a static Tailwind class). The remaining-time text is computed with `date-fns` `formatDistance(deadlineAt, now, { locale: phLocale })`.

This component must never be rendered on `VALID`, `ARCHIVED`, `CANCELLED`, `DRAFT`, or `VETOED` documents per DESIGN.md §8 Rule 6 — the consuming view is responsible for conditional rendering.

#### 3.9.4 ARIA Requirements

See F6 §3.1 for the full ARIA contract. ARIA attributes that affect the props interface: `label: string` becomes `aria-label={label}` on the `role="timer"` container element. The container also receives `aria-live="polite"` hardcoded internally.

#### 3.9.5 Usage Example

```tsx
import { SLATimer } from '@batac/ui/components/domain/SLATimer';
import { format } from 'date-fns';

// Mayor's 10-day review SLA — starts when transmittal letter is dispatched
// Document 7SP 2026-001 transmitted 2026-06-10, deadline 2026-06-20
const startedAt = new Date('2026-06-10T08:00:00+08:00');
const deadlineAt = new Date('2026-06-20T08:00:00+08:00');

// Rendered on a PENDING_MAYOR document (consuming view checks state before rendering)
<SLATimer
  startedAt={startedAt}
  deadlineAt={deadlineAt}
  label="Mayor review (10-day) — 7SP 2026-001"
  // className omitted — no override needed
/>;
```

#### 3.9.6 Anti-Pattern

**Wrong:**

```tsx
// Passing a pre-computed percentage instead of the Date objects
interface SLATimerProps {
  percentElapsed: number;
  label: string;
}
```

Externalising percentage calculation forces consumers to recompute the same arithmetic — and to handle the `now` reference themselves, creating bugs when `now` is computed at render time vs. effect time. The `SLAStatus` derivation must happen inside the component, keyed off `Date` objects, so the component can re-derive on each render with a current `now` reference.

---

### 3.10 RoutingHistoryTimeline

#### 3.10.1 Props Interface

Renamed and expanded from F5. See Section 1 `RoutingEntry` for the full interface.

```typescript
// packages/ui/src/components/domain/RoutingHistoryTimeline.tsx
import type { RoutingEntry } from '@batac/ui/types/domain';

interface RoutingHistoryTimelineProps {
  entries: RoutingEntry[]; // Rendered newest-first (consumer sorts before passing)
  className?: string;
}
```

#### 3.10.2 Tier 1 and Tier 2 Dependencies

- **`AvatarName` (Tier 2 CVA override):** Renders the actor avatar + name for each timeline entry at `size="sm"` (`h-8 w-8` per DESIGN.md §6.6).

#### 3.10.3 Visual Behavior

Each `RoutingEntry` renders as a two-column row: left column holds a vertical connector line (`border-l-2 border-border-subtle ml-3`) with a colored dot overlaid (`h-3 w-3 rounded-full -ml-[7px]`); right column holds `AvatarName` + action label + office name + timestamp.

Dot color by action category: `Transmitted`, `TransmittedToMayor` → `bg-info-500`; `SignedByMayor`, `VPCertified`, `Released`, `Archived`, `DeemedApproved` → `bg-success-500`; `Vetoed`, `Returned`, `PanlalawiganOutcomeRecorded` (when outcome is RETURNED/VETOED) → `bg-danger-500`; all others (`Logged`, `Received`, `FirstReadingConducted`, `Docketed`, etc.) → `bg-neutral-400`.

Timestamps render in `font-mono text-xs text-text-muted` using `DATE_FORMATS.displayWithTime` with `phLocale`. The `notes` field, when present, renders as `text-xs text-text-muted mt-1 pl-11` (indented to align with the right column).

#### 3.10.4 ARIA Requirements

See F6 §2 (Universal Rules). The timeline renders as an ordered list (`<ol>`) with each entry as `<li>`. No ARIA attributes affect the props interface.

#### 3.10.5 Usage Example

```tsx
import { RoutingHistoryTimeline } from '@batac/ui/components/domain/RoutingHistoryTimeline';
import type { RoutingEntry } from '@batac/ui/types/domain';

const entries: RoutingEntry[] = [
  {
    id: 'rh-001',
    actorName: 'Gladys R. Lagura',
    actorOfficeName: 'SP Secretariat',
    action: 'FinalNumberAssigned',
    timestamp: new Date('2026-06-12T10:30:00+08:00'),
    notes: 'Final number 7SP 2026-001 assigned; Draft prefix removed.',
    fromOfficeName: undefined,
    toOfficeName: undefined,
  },
  {
    id: 'rh-002',
    actorName: 'Gladys R. Lagura',
    actorOfficeName: 'SP Secretariat',
    action: 'TransmittedToMayor',
    timestamp: new Date('2026-06-13T09:00:00+08:00'),
    notes: 'Transmittal letter SPS 2026-038 dispatched. Mayor review 10-day clock started.',
    fromOfficeName: 'SP Secretariat',
    toOfficeName: 'Office of the Mayor',
  },
  {
    id: 'rh-003',
    actorName: 'Mark Christian R. Chua',
    actorOfficeName: 'Office of the City Mayor',
    action: 'SignedByMayor',
    timestamp: new Date('2026-06-17T14:15:00+08:00'),
    notes: undefined,
    fromOfficeName: undefined,
    toOfficeName: 'SP Secretariat',
  },
];

<RoutingHistoryTimeline entries={entries} />;
```

#### 3.10.6 Anti-Pattern

**Wrong:**

```tsx
// Using <div> list without semantic list markup
<div className="flex flex-col gap-4">
  {entries.map((e) => (
    <div key={e.id}>{e.actorName}</div>
  ))}
</div>
```

A routing history is an ordered sequence of events. Rendering it as anonymous `<div>` elements fails WCAG 2.1 §1.3.1 (Info and Relationships) — screen readers cannot convey that these entries form a meaningful ordered list. Use `<ol>` / `<li>`.

---

### 3.11 QRCodeDisplay

#### 3.11.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/QRCodeDisplay.tsx

interface QRCodeDisplayProps {
  /** UUID tracking ID from DTS tracking record — the QR payload (Part 11.6) */
  trackingId: string;
  /** Formatted document number for display below the QR, e.g. "7SP 2026-001" */
  documentNumber: string;
  /** Document title for display below the number */
  title: string;
  /** "screen" = standard with shadow; "print" = no shadow, min 200×200px */
  variant?: 'screen' | 'print';
  className?: string;
}
```

#### 3.11.2 Tier 1 and Tier 2 Dependencies

No Tier 1 or Tier 2 imports. Pure Tailwind with an `<img>` element for the QR data URL.

#### 3.11.3 Visual Behavior

The component renders three stacked elements: the QR image, the document number, and the title. The `screen` variant wraps in `bg-white rounded-lg border border-border-default shadow-sm p-4`. The `print` variant applies `bg-white border border-border-strong p-2 shadow-none min-w-[200px] min-h-[200px]` for guaranteed physical scanning legibility. In both variants the QR image is always square and square at its container's full width.

The document number renders as `font-mono text-xs font-medium text-text-primary` immediately below the QR image, centered. The title renders as `text-sm text-text-secondary` below the number, centered, with `line-clamp-2` on long titles. No interactive states exist — this component is always display-only.

#### 3.11.4 ARIA Requirements

See F6 §3.3 for the full ARIA contract. ARIA attributes that affect the props interface: `documentNumber` and `trackingId` compose the `aria-label` on the `role="img"` container — `aria-label={`QR code for document ${documentNumber}`}` — so both are required props (never optional).

#### 3.11.5 Usage Example

```tsx
import { QRCodeDisplay } from '@batac/ui/components/domain/QRCodeDisplay';

// Screen variant — document detail view
<QRCodeDisplay
  trackingId="dts-2026-00147"
  documentNumber="7SP 2026-001"
  title="An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac"
  variant="screen"
/>

// Print variant — cover sheet print layout (Part 11.4: cover page contains QR, tracking number, series number)
<QRCodeDisplay
  trackingId="dts-2026-00147"
  documentNumber="7SP 2026-001"
  title="Solid Waste Management Ordinance"
  variant="print"
/>
```

#### 3.11.6 Anti-Pattern

**Wrong:**

```tsx
<div>
  <img src={qrDataUrl} alt="" />
  <p>{documentNumber}</p>
</div>
```

An empty `alt=""` marks the image as decorative, but the QR code is the primary content of this component. Screen reader users need to know this is a QR code for a specific document. The correct pattern is `role="img"` on the container with `aria-label="QR code for document 7SP 2026-001"`, not an empty `alt` on the `<img>`.

---

### 3.12 CommitteeReferralBlock

#### 3.12.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/CommitteeReferralBlock.tsx
import type { CommitteeReferral } from '@batac/ui/types/domain';

interface CommitteeReferralBlockProps {
  referrals: CommitteeReferral[];
  className?: string;
}
```

#### 3.12.2 Tier 1 and Tier 2 Dependencies

- **`Badge` (Tier 1):** Renders the status chip per committee entry — `SUBMITTED` in `bg-success-100 text-success-900`, `PENDING` in `bg-warning-100 text-warning-900`, `ABSENT_NOT_HEARD` in `bg-neutral-100 text-neutral-700`.
- **`AvatarName` (Tier 2 CVA override):** Renders `submittedBy` name at `size="sm"` when the field is present.

#### 3.12.3 Visual Behavior

Each `CommitteeReferral` renders as a horizontal row: committee name in `text-sm font-medium text-text-primary` (left, `flex-1`), status `Badge` chip, optional `AvatarName` + `submittedAt` timestamp (right). The timestamp renders via `DATE_FORMATS.displayWithTime`. The `ABSENT_NOT_HEARD` chip is the only status without a submittedBy or submittedAt — those fields are always absent for this status.

No interactive states within the component itself — it is a display block.

#### 3.12.4 ARIA Requirements

See F6 §2 (Universal Rules). Renders as a `<ul>` / `<li>` list. No ARIA attributes affect the props interface.

#### 3.12.5 Usage Example

```tsx
import { CommitteeReferralBlock } from '@batac/ui/components/domain/CommitteeReferralBlock';
import type { CommitteeReferral } from '@batac/ui/types/domain';

const referrals: CommitteeReferral[] = [
  {
    id: 'cr-001',
    committeeName: 'Committee on Laws, Rules, Ethics & Privileges',
    status: 'SUBMITTED',
    submittedBy: 'Hon. Juan Paulo P. Flojo',
    submittedAt: new Date('2026-06-10T15:00:00+08:00'),
  },
  {
    id: 'cr-002',
    committeeName: 'Committee on Environment',
    status: 'PENDING',
    submittedBy: undefined, // not yet submitted — field intentionally absent
    submittedAt: undefined,
  },
];

<CommitteeReferralBlock referrals={referrals} />;
```

#### 3.12.6 Anti-Pattern

**Wrong:**

```tsx
// Hardcoding status chip colors with inline styles
<span style={{ backgroundColor: '#d1fae5', color: '#064e3b' }}>SUBMITTED</span>
```

This violates DESIGN.md §8 Rule 2 and the Tier 3 construction rule that forbids hardcoded hex values. If the success token changes in `globals.css`, the inline style silently diverges. Use `bg-success-100 text-success-900` classes exclusively.

---

### 3.13 StatusBadge

#### 3.13.1 Props Interface

No additions to F5.

```typescript
// packages/ui/src/components/domain/StatusBadge.tsx
import type { DocumentState } from '@batac/ui/types/domain';

interface StatusBadgeProps {
  state: DocumentState;
  className?: string;
}
```

#### 3.13.2 Tier 1 and Tier 2 Dependencies

No Tier 1 or Tier 2 imports. This component is CVA + pure Tailwind. It is specifically not derived from the shadcn `Badge` primitive — it has its own CVA configuration encoding the full 26-state color map from STATUS_META.

#### 3.13.3 Visual Behavior

`StatusBadge` is a single-responsibility component: it maps a `DocumentState` value to a visual chip using `STATUS_META`. Base classes always present: `inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium touch-exempt`. Then the state-specific classes from STATUS_META are applied: `bg`, `text`, `borderLeft`, with `border-dashed` when `borderStyle === 'dashed'` and `italic` or `line-through` when `textStyle` differs from `'normal'`.

The `textStyle` variants apply as Tailwind classes: `italic` → `italic` class, `line-through` → `line-through` class. These are applied conditionally via `cn()`, not via CVA variants, because CVA variants require compile-time enumeration and the STATUS_META entries provide the class strings dynamically.

A document always has exactly one active `StatusBadge` per DESIGN.md §6.3 — never two badges for the same document.

#### 3.13.4 ARIA Requirements

See F6 §2 (Universal Rules). The badge receives `aria-label={STATUS_META[state].label}` internally. No ARIA attributes affect the props interface.

#### 3.13.5 Usage Example

```tsx
import { StatusBadge } from '@batac/ui/components/domain/StatusBadge';

// Resolution 7SP 2026-001 — Panlalawigan review active
<StatusBadge state="PANLALAWIGAN_REVIEW" />
// Renders: bg-warning-100 text-warning-900 border-l-2 border-l-warning-500 — "Panlalawigan Review"

// Resolution 7SP 2026-001 — deemed approved after 30-day lapse
<StatusBadge state="DEEMED_APPROVED" />
// Renders: bg-success-100 text-success-900 border-l-2 border-l-success-300 border-dashed italic — "Deemed Approved"

// Letter SPR 2026-038 — lapsed into law
<StatusBadge state="LAPSED" />
// Renders: bg-neutral-100 text-neutral-700 border-l-2 border-l-neutral-400 italic — "Lapsed"
```

#### 3.13.6 Anti-Pattern

**Wrong:**

```tsx
<span style={{ backgroundColor: '#d1fae5', color: '#064e3b' }}>Deemed Approved</span>
```

Using inline `style={{ backgroundColor: '#d1fae5' }}` violates DESIGN.md §8 Rule 2 and the Tier 3 construction rule. When the `success-100` token value is updated in `globals.css`, the badge silently diverges from the design system. Only Tailwind utility classes from the `@theme` block may be used.

---

### 3.14 WorkflowStepIndicator

#### 3.14.1 Props Interface

Expanded from F5 — `WorkflowStep` gains two fields. See Section 1 for the canonical type.

```typescript
// packages/ui/src/components/domain/WorkflowStepIndicator.tsx
import type { WorkflowStep } from '@batac/ui/types/domain';

interface WorkflowStepIndicatorProps {
  steps: WorkflowStep[];
  currentStepId: string;
  orientation?: 'horizontal' | 'vertical'; // defaults to 'horizontal'; responsive breakpoint applies regardless
  className?: string;
}
```

#### 3.14.2 Tier 1 and Tier 2 Dependencies

- **`Tooltip` (Tier 1):** Wraps each step node; tooltip content is `WorkflowStep.tooltip` when provided, or auto-generated from `step.label + (completedAt ? " — completed " + format(completedAt, DATE_FORMATS.display, {locale: phLocale}) : "")`.

#### 3.14.3 Visual Behavior

The indicator renders as an `<ol>` of step nodes connected by horizontal or vertical lines. In horizontal mode (≥768px), steps are arranged left-to-right with `flex-1` connector lines between them. In vertical mode (<768px or `orientation="vertical"`), steps stack with a connecting line running down the left side.

Step node ring classes per state:

| State       | Ring fill        | Ring text          | Connector to next                        |
| ----------- | ---------------- | ------------------ | ---------------------------------------- |
| `completed` | `bg-success-500` | `text-white`       | `bg-success-500`                         |
| `active`    | `bg-primary-800` | `text-white`       | `bg-neutral-200`                         |
| `pending`   | `bg-neutral-200` | `text-neutral-500` | `bg-neutral-200`                         |
| `skipped`   | `bg-neutral-100` | `text-neutral-400` | `bg-neutral-200` (dashed border on ring) |
| `error`     | `bg-danger-500`  | `text-white`       | `bg-neutral-200`                         |

Step labels: `font-semibold` on active step only; `text-text-muted` on pending/skipped; `text-text-primary` on completed and active. The `assigneeName` field renders as `text-xs text-text-muted` below the label when `state === 'active'`. Step nodes are `<li>` elements; the `<ol>` carries `aria-label="Document workflow steps"`.

#### 3.14.4 ARIA Requirements

See F6 §3.2 for the full ARIA contract. ARIA attributes affecting the props interface: none — the `currentStepId` comparison drives `aria-current="step"` on the active node internally.

#### 3.14.5 Usage Example

```tsx
import { WorkflowStepIndicator } from '@batac/ui/components/domain/WorkflowStepIndicator';
import type { WorkflowStep } from '@batac/ui/types/domain';

// D2 Diagram 1 standard SP Resolution path — 7SP 2026-001 is at VP Certification
const steps: WorkflowStep[] = [
  {
    id: 'intake_logging',
    label: 'Intake Logging',
    state: 'completed',
    completedAt: new Date('2026-05-06T09:00:00+08:00'),
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'order_of_business_scheduling',
    label: 'Order of Business Scheduling',
    state: 'completed',
    completedAt: new Date('2026-05-08T16:00:00+08:00'),
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'first_reading',
    label: 'First Reading',
    state: 'completed',
    completedAt: new Date('2026-05-13T10:00:00+08:00'),
    assigneeName: undefined,
    tooltip: 'Referred to Committee on Laws and Committee on Environment',
  },
  {
    id: 'committee_referral',
    label: 'Committee Referral',
    state: 'completed',
    completedAt: new Date('2026-06-05T14:00:00+08:00'),
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'second_reading_vote',
    label: 'Second Reading',
    state: 'completed',
    completedAt: new Date('2026-06-10T11:30:00+08:00'),
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'final_number_assignment',
    label: 'Final Number Assignment',
    state: 'completed',
    completedAt: new Date('2026-06-12T10:30:00+08:00'),
    assigneeName: undefined,
    tooltip: '7SP 2026-001 assigned',
  },
  {
    id: 'vp_certification',
    label: 'VP Certification',
    state: 'active',
    completedAt: undefined,
    assigneeName: 'Hon. Albert D. Chua',
    tooltip: undefined,
  },
  {
    id: 'transmittal_letter_to_mayor',
    label: 'Transmittal to Mayor',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'mayor_review',
    label: 'Mayor Review',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'docketing',
    label: 'Docketing',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'panlalawigan_transmission_logging',
    label: 'Panlalawigan Transmission',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'panlalawigan_review',
    label: 'Panlalawigan Review',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'portal_publication',
    label: 'Portal Publication',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
  {
    id: 'archive',
    label: 'Archive',
    state: 'pending',
    completedAt: undefined,
    assigneeName: undefined,
    tooltip: undefined,
  },
];

<WorkflowStepIndicator steps={steps} currentStepId="vp_certification" orientation="horizontal" />;
```

#### 3.14.6 Anti-Pattern

**Wrong:**

```tsx
<div className="flex gap-2">
  {steps.map((step) => (
    <div key={step.id} className="flex flex-col items-center">
      <div
        className={`h-8 w-8 rounded-full ${step.state === 'completed' ? 'bg-success-500' : 'bg-neutral-200'}`}
      />
      <span>{step.label}</span>
    </div>
  ))}
</div>
```

Using `<div>` / `<div>` instead of `<ol>` / `<li>` is the highest-probability anti-pattern for this component. WCAG 2.1 §1.3.1 requires list semantics for sequential step indicators. Screen readers skip unlabelled `<div>` sequences without conveying the ordered relationship between steps. Use `<ol aria-label="Document workflow steps">` with `<li>` per step.

---

### 3.15 DocumentPreviewCard

#### 3.15.1 Props Interface

Expanded from F5 — see Section 1 `DocumentPreview` for full type with SLA fields.

```typescript
// packages/ui/src/components/domain/DocumentPreviewCard.tsx
import type { DocumentPreview } from '@batac/ui/types/domain';

interface DocumentPreviewCardProps {
  document: DocumentPreview;
  onClick?: () => void;
  /** When true, renders Skeleton placeholders instead of content */
  isLoading?: boolean;
  className?: string;
}
```

#### 3.15.2 Tier 1 and Tier 2 Dependencies

- **`Card` (Tier 1):** Provides the card surface (`bg-white rounded-lg border border-border-default shadow-sm`).
- **`Skeleton` (Tier 1):** Renders placeholder elements when `isLoading=true` — thumbnail as `w-full aspect-[3/4] rounded`, number badge as `w-20 h-5`, title as `w-full h-4` and `w-3/4 h-4`, status badge as `w-24 h-5`, timestamp as `w-28 h-3`.
- **`DocumentNumberBadge` (Tier 3):** Renders the document number with the correct variant treatment.
- **`StatusBadge` (Tier 3):** Renders the document state chip.

#### 3.15.3 Visual Behavior

The card is always `cursor-pointer` when `onClick` is provided. Hover transitions `shadow-sm → shadow-md` (`transition-shadow duration-base`). Content top-to-bottom: thumbnail (`w-full aspect-[3/4] bg-neutral-100 rounded object-cover mb-3`), then `DocumentNumberBadge` + `StatusBadge` on the same row, then title (`text-sm font-medium text-text-primary line-clamp-2 mt-1`), then last-action timestamp (`text-xs text-text-muted mt-1`). If `slaDeadlineAt` and `slaStartedAt` are present and the document state warrants a timer (`PENDING_MAYOR` or `PANLALAWIGAN_REVIEW`), an embedded `SLATimer` renders below the timestamp.

When `isLoading=true`, the `Skeleton` placeholders match these exact positions — thumbnail skeleton first, then two inline skeletons for badge row, then two-line title skeleton, then timestamp skeleton.

#### 3.15.4 ARIA Requirements

See F6 §2 (Universal Rules). When `onClick` is provided, the card container receives `role="button"` and `tabIndex={0}` with `onKeyDown` handling `Enter` and `Space`. When `isLoading=true`, the container receives `aria-busy="true"`.

#### 3.15.5 Usage Example

```tsx
import { DocumentPreviewCard } from '@batac/ui/components/domain/DocumentPreviewCard';
import type { DocumentPreview } from '@batac/ui/types/domain';

const doc: DocumentPreview = {
  id: 'doc-001',
  documentNumber: '7SP 2026-001',
  numberVariant: 'final',
  title: 'An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac, Ilocos Norte, Appropriating Funds Therefor, and for Other Purposes.',
  documentState: 'PANLALAWIGAN_REVIEW',
  lastActionAt: new Date('2026-06-13T09:00:00+08:00'),
  slaDeadlineAt: new Date('2026-07-13T09:00:00+08:00'), // 30-day Panlalawigan window
  slaStartedAt:  new Date('2026-06-13T09:00:00+08:00'),
  thumbnailUrl: '/api/documents/doc-001/thumbnail',
};

<DocumentPreviewCard
  document={doc}
  onClick={() => navigate(`/documents/doc-001`)}
  isLoading={false}
/>

// Loading state
<DocumentPreviewCard
  document={doc}       // data not yet available — pass a placeholder or omit
  isLoading={true}
  // onClick omitted — not interactive while loading
/>
```

#### 3.15.6 Anti-Pattern

**Wrong:**

```tsx
// Constructing a DocumentPreview with string dates
const doc: DocumentPreview = {
  id: 'doc-001',
  lastActionAt: '2026-06-13' as any, // string instead of Date
  // ...
};
```

All `Date` fields in the domain type system are TypeScript `Date` objects, never strings. Passing a string silently bypasses type checking (with `as any`) and causes `date-fns format()` to produce `Invalid Date` output. Server responses in JSON use ISO strings — convert them with `new Date(isoString)` at the API boundary, not at the component.

---

### 3.16 OrderOfBusinessRow

#### 3.16.1 Props Interface

Significantly expanded from F5. See Section 1 `OrderOfBusinessItem` for the canonical type.

```typescript
// packages/ui/src/components/domain/OrderOfBusinessRow.tsx
import type { OrderOfBusinessItem } from '@batac/ui/types/domain';

interface OrderOfBusinessRowProps {
  item: OrderOfBusinessItem;
  className?: string;
}
```

#### 3.16.2 Tier 1 and Tier 2 Dependencies

- **`Badge` (Tier 1):** Renders the `scheduledReadingType` chip (e.g., "1st Reading") and each committee name chip from `committeeReferrals`.
- **`Tooltip` (Tier 1):** Wraps the Lucide `Flag` icon when `isMissingReport=true` — the tooltip text is "Missing committee report" per DESIGN.md §6.6.
- **`DocumentNumberBadge` (Tier 3):** Renders the document number with the correct `numberVariant`.
- **`StatusBadge` (Tier 3):** Renders the `documentState`.

#### 3.16.3 Visual Behavior

The row is a `flex items-center gap-3` container. When `isMissingReport=true`, the row background is `bg-danger-50` — this is the only case where a row background changes and it is sourced directly from `globals.css @theme` (`danger-50` = `#fef2f2`). The red-flag row background is never applied via a `style` attribute.

Left-to-right layout:

1. Agenda number: `font-mono text-sm text-text-muted w-8 shrink-0` (e.g., "1.")
2. Certified urgent chip: `bg-warning-100 text-warning-900 text-xs font-semibold px-2 py-0.5 rounded-sm touch-exempt` — rendered only when `isCertifiedUrgent=true`, prepended to the number column
3. `DocumentNumberBadge`
4. Title: `text-sm text-text-primary flex-1 truncate`
5. Committee referral chips: one `Badge` per entry in `committeeReferrals` with per-status coloring
6. `StatusBadge` for `documentState`
7. Reading type chip: `Badge` variant for "1st/2nd/3rd Reading"
8. Flag icon: Lucide `Flag` in `text-danger-500` with `Tooltip` — rendered only when `isMissingReport=true`

#### 3.16.4 ARIA Requirements

See F6 §3.4 for the full ARIA contract. ARIA attributes that affect the props interface: the `Flag` icon's `Tooltip` is internally constructed as `aria-label="Missing committee report"` — this string is hardcoded internally (not a prop) because it is always the same message.

#### 3.16.5 Usage Example

```tsx
import { OrderOfBusinessRow } from '@batac/ui/components/domain/OrderOfBusinessRow';
import type { OrderOfBusinessItem } from '@batac/ui/types/domain';

const item: OrderOfBusinessItem = {
  agendaNumber: 1,
  documentNumber: '7SP 2026-001',
  numberVariant: 'final',
  title:
    'An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac',
  documentState: 'PANLALAWIGAN_REVIEW',
  committeeReferrals: [
    {
      id: 'cr-001',
      committeeName: 'Laws, Rules, Ethics & Privileges',
      status: 'SUBMITTED',
      submittedBy: 'Hon. Juan Paulo P. Flojo',
      submittedAt: new Date('2026-06-10T15:00:00+08:00'),
    },
    {
      id: 'cr-002',
      committeeName: 'Environment',
      status: 'ABSENT_NOT_HEARD',
      submittedBy: undefined,
      submittedAt: undefined,
    },
  ],
  isCertifiedUrgent: false,
  isMissingReport: true, // Environment committee absent → red flag + bg-danger-50
  scheduledReadingType: 'SECOND',
};

<OrderOfBusinessRow item={item} />;

// Letter SPR 2026-038 — certified urgent, first reading
const urgentItem: OrderOfBusinessItem = {
  agendaNumber: 2,
  documentNumber: 'SPR 2026-038',
  numberVariant: 'final',
  title: 'A Resolution Directing the City Engineer to Submit Report on Road Conditions',
  documentState: 'FIRST_READING',
  committeeReferrals: [], // bypassed by Certification of Urgency per Part 4.17
  isCertifiedUrgent: true,
  isMissingReport: false,
  scheduledReadingType: 'FIRST',
};

<OrderOfBusinessRow item={urgentItem} />;
```

#### 3.16.6 Anti-Pattern

**Wrong:**

```tsx
// Applying row background with inline style instead of Tailwind class
<div style={{ backgroundColor: item.isMissingReport ? '#fef2f2' : 'white' }}>
```

The danger-50 color `#fef2f2` is a design token — `bg-danger-50`. Using an inline hex bypasses the design token system and will not update if the danger-50 value is revised in `globals.css`. Apply `bg-danger-50` conditionally: `cn('flex items-center gap-3', item.isMissingReport && 'bg-danger-50')`.

---

## Section 4 — DESIGN.md Delta {#section-4}

This section lists every update DESIGN.md requires based on what J6 has discovered. Each item is an actionable update task. Items are grouped by category.

---

### Category A — States present in `DocumentState` but absent from DESIGN.md §7 (each requires a new row in §7's state color map table)

**A-1. `SUBMITTED`**
Add row to DESIGN.md §7: State `SUBMITTED`, category neutral, background `#f8f9fa` (neutral-50), text `#495057` (neutral-700), left-border `#adb5bd` (neutral-500), notes "Document received by Secretariat; pending intake logging. Lighter neutral than DRAFT to signal progression into the pipeline."

**A-2. `IN_WORKFLOW`**
Add row to DESIGN.md §7: State `IN_WORKFLOW`, category info, background `#dbeafe` (info-100), text `#1e3a8a` (info-900), left-border `#3b82f6` (info-500), borderStyle solid, notes "Broad umbrella state for any active workflow instance; use granular reading states when available. See J6 Ambiguity Note A."

**A-3. `PENDING_APPROVAL`**
Add row to DESIGN.md §7: State `PENDING_APPROVAL`, category warning, background `#fef3c7` (warning-100), text `#78350f` (warning-900), left-border `#f59e0b` (warning-500), notes "Generic pre-approval waiting state for non-SP document types. Use PENDING_MAYOR for SP Resolutions and Ordinances."

**A-4. `COMPLETED`**
Add row to DESIGN.md §7: State `COMPLETED`, category success, background `#d1fae5` (success-100), text `#064e3b` (success-900), left-border `#10b981` (success-500), notes "Terminal approved outcome — workflow instance completed; document not yet released to portal."

**A-5. `RELEASED`**
Add row to DESIGN.md §7: State `RELEASED`, category success (muted), background `#d1fae5` (success-100), text `#064e3b` (success-900), left-border `#6ee7b7` (success-300), notes "Published to public portal; title and first page visible. success-300 left border distinguishes RELEASED from VALID (lighter = passive publication)."

**A-6. `DISPOSED`**
Add row to DESIGN.md §7: State `DISPOSED`, category neutral, background `#f1f3f5` (neutral-100), text `#868e96` (neutral-600), left-border `#ced4da` (neutral-400), notes "Records-managed disposition — no data deleted; audit record created. Identical visual to ARCHIVED (both are terminal read-only)."

**A-7. `RECEIVED_SEEN`** (complaint state — sourced from consolidated ref Part 4.14)
Add row to DESIGN.md §7: State `RECEIVED_SEEN`, category info, background `#dbeafe` (info-100), text `#1e3a8a` (info-900), left-border `#3b82f6` (info-500), notes "Complaint acknowledged by Vice Mayor or Committee; intermediate state between PENDING_HEARING and resolution. Sourced from Part 4.14 — was not listed in J6 task prompt."
Also update consolidated ref Part 4.14: clarify that RECEIVED_SEEN is a formal named state in the complaint lifecycle and should be included in the DocumentState union.

---

### Category B — DESIGN.md §7 internal token labeling error (requires correction in §7 table)

**B-1. Systematic `neutral-500` / `neutral-600` mislabeling**
DESIGN.md §7 labels hex `#868e96` as `neutral-500` in the DRAFT left-border column. In the `@theme` block (globals.css), `neutral-500 = #adb5bd` and `neutral-600 = #868e96`. The hex is correct; the label is wrong. Update DESIGN.md §7 to replace all occurrences of `(neutral-500)` where the hex value is `#868e96` with `(neutral-600)`. Affected rows: DRAFT border, DISMISSED border. The corresponding Tailwind utility in STATUS_META and in all code examples is `border-l-neutral-600` (not `border-l-neutral-500`).

---

### Category C — Props interface additions that expand F5's Tier 3 table

**C-1. `WorkflowStep` interface — two new fields**
F5 Tier 3 table entry for `WorkflowStepIndicator` does not include `completedAt?: Date` or `assigneeName?: string` on the `WorkflowStep` sub-interface. Update F5 to add both fields. Rationale: `completedAt` enables tooltip content with exact completion timestamps; `assigneeName` is needed to display the current or past assignee below the active step label.

**C-2. `RoutingEntry` interface — renamed fields and one new field**
F5 uses `actor`, `actorOffice`, `fromOffice`, `toOffice`. J6 canonical type uses `actorName`, `actorOfficeName`, `fromOfficeName`, `toOfficeName` (clearer when destructured). J6 also adds `notes?: string` (from Part 11.6). Update F5 `RoutingHistoryTimeline` entry to reflect the canonical J6 field names and the new `notes?` field.

**C-3. `DocumentPreview` interface — renamed fields and two new fields**
F5 uses `documentNumberVariant` and `state`. J6 canonical type uses `numberVariant: NumberVariant` and `documentState: DocumentState`. J6 also adds `slaDeadlineAt?: Date` and `slaStartedAt?: Date` enabling an embedded `SLATimer` without a second fetch. Update F5 `DocumentPreviewCard` entry to reflect these changes.

**C-4. `OrderOfBusinessItem` interface — multiple changes**
F5 has `agendaNumber: string`, `committees: string[]`, `reportStatus: CommitteeReportStatus`, `documentNumberVariant`. J6 canonical type changes `agendaNumber` to `number`, replaces `committees[]` + `reportStatus` with `committeeReferrals: CommitteeReferral[]`, renames `documentNumberVariant` → `numberVariant: NumberVariant`, and adds `documentState: DocumentState` and `scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD'`. Update F5 `OrderOfBusinessRow` entry accordingly.

**C-5. `CommitteeReportStatus` type — naming clarification**
F5 names the type `CommitteeReferralStatus`. J6 renames it `CommitteeReportStatus` to avoid ambiguity with the `CommitteeReferral` interface. Update F5 to use the canonical name. Value `'ABSENT_NOT_HEARD'` is retained as-is (F5's established form); the J6 task prompt's abbreviation `'ABSENT'` is not adopted.

---

### Category D — Structural visual behavior from consolidated ref not yet documented in DESIGN.md §6

**D-1. DESIGN.md §6.6 Order of Business Row — add `scheduledReadingType` chip specification**
The consolidated ref Part 4.18 establishes that the Order of Business contains documents scheduled for their next reading. J6 has added `scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD'` to `OrderOfBusinessItem`. DESIGN.md §6.6 does not specify a visual chip for this field. Add to §6.6: "Reading type chip: renders to the right of the document number, using shadcn `Badge` in `bg-info-100 text-info-900` for FIRST, `bg-warning-100 text-warning-900` for SECOND, `bg-primary-100 text-primary-800` for THIRD. Uses `.touch-exempt`."

**D-2. DESIGN.md §6.6 Committee Referral Block — canonicalize `ABSENT_NOT_HEARD` value**
DESIGN.md §6.6 renders the third status as `ABSENT/NOT HEARD`. F5 uses `ABSENT_NOT_HEARD`. The slash in `ABSENT/NOT HEARD` is ambiguous as a TypeScript literal. DESIGN.md §6.6 should be updated to reference the canonical TypeScript value `'ABSENT_NOT_HEARD'` and display label `"Absent / Not Heard"`.

**D-3. DESIGN.md §6.3 Routing History Timeline — add `RoutingAction` dot-color mapping**
DESIGN.md §6.3 describes dot colors in general terms ("Transmitted → info, Approved → success, Returned → danger, Filed → neutral") but does not enumerate the full `RoutingAction` type. Add a table mapping each `RoutingAction` literal to its dot color token so implementing developers do not have to guess the mapping.

**D-4. DESIGN.md §6.6 Document Preview Card — add embedded SLATimer specification**
J6 adds `slaDeadlineAt?` and `slaStartedAt?` to `DocumentPreview` so the card can embed an `SLATimer`. DESIGN.md §6.6 does not document this embedded timer. Add to §6.6: "When `slaDeadlineAt` and `slaStartedAt` are present and `documentState` is `PENDING_MAYOR` or `PANLALAWIGAN_REVIEW`, render an embedded `SLATimer` below the last-action timestamp. In all other states, the SLA fields are unused."

---

_End of J6 — Domain Component Engineering Reference_
_batac-dms · `packages/ui` · Pre-development specification_
