# A1 — Module Task List: UI

**Pass type:** Step 2 — Module: UI (`A1-AGENTS.md` §2 Pass Types table)
**Wave:** A (no prerequisite module task lists — confirmed by the calling instruction and by `a1-skeleton.md` §2: UI depends on `None`)
**Documents loaded for this pass, in order:**

1. `docs/pre-development/A-project-planning/a1-skeleton.md`
2. `docs/pre-development/F-frontend-architecture/f5-ui-component-library-setup-and-package-architecture.md` (F5)
3. `docs/pre-development/J-software-design-patterns-and-standards/j6-domain-component-engineering-reference.md` (J6)
4. `docs/pre-development/F-frontend-architecture/f6-accessibility-compliance-checklist.md` (F6)
5. `docs/pre-development/F-frontend-architecture/f4-component-hierarchy-specification.md` (F4)
6. `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md` (F1)
7. `docs/design/DESIGN.md`
8. `packages/ui/src/styles/globals.css`
9. `docs/pre-development/F-frontend-architecture/f7-frontend-implementation-plans.md` (F7)

(`A1-AGENTS.md` itself — Section 2 Pass Types table and Section 6 Step 2 / UI-specific rules — was read first per the routing instruction, the same way the Skeleton pass reads it before producing its own output.)

**Sourcing & confidence legend** (same convention `a1-skeleton.md` v2 uses, applied here):

- Unmarked statements are taken directly from one of the nine loaded documents.
- `[Inference]` — a reasoned synthesis not stated verbatim in a loaded document, labeled individually at the point it is made (inferences are not chained).
- `[SPEC GAP]` — `A1-AGENTS.md` §1/§8 convention: something a source requires but no loaded document specifies clearly enough to write a self-contained AI Prompt for. Not invented; left for human resolution.
- `[CONFLICT]` — two loaded sources disagree; flagged rather than resolved by guessing which is more recent, per `A1-AGENTS.md` §1.
- `[F5 update required]` — carried forward verbatim from J6's own notation where J6's canonical type/behavior diverges from F5's earlier snapshot.
- Where this document could not determine something from the nine loaded sources, it says so directly rather than presenting a guess as settled.

This document does not use the words "prevent," "guarantee," "will never," "fixes," "eliminates," or "ensures that" outside of a direct citation from a loaded source.

---

## Table of Contents

- [L65–L74] Note on Section 6's general Step-2 capability-list instruction — Verification that UI is a cross-cutting build module rather than a schema-owning domain module.
- [L75–L78] Resolution pass — 2026-06-23 — Scope and findings of the resolution pass, including edits made to pre-dev documents.
- [L79–L93] Pre-task reconciliation findings — Compares F5, J6, F6, and F7 to reconcile conflicts on components, accessibility, and naming conventions.
- [L94–L101] Task ID convention used in this list — Details the TASK-UI-NNN ID format, non-applicability of special tags, and final task count rationale.
- [L102–L199] TASK-UI-001 — Sets up the UI package foundation, including token CSS, utilities, 20 Tier 1 shadcn primitives, Tier 2 overrides, and /dev/components route.
- [L200–L391] TASK-UI-002 — Generates canonical J6 shared domain types and the 26-member STATUS_META styling constant record.
- [L392–L395] Group A — layout shell (PageHeader, Sidebar, Topbar, AppShell) — Parent section for core layout shell components that have no Tier 3 domain dependencies.
- [L396–L480] TASK-UI-003 — Implements the PageHeader component displaying titles, subtitles, breadcrumbs, and consumer-provided action slots.
- [L481–L583] TASK-UI-004 — Implements the Sidebar component supporting collapsibility, active route states, and accessible-name hiding rules.
- [L584–L672] TASK-UI-005 — Implements the Topbar component containing branding, LGU logo, breadcrumbs, and user session details.
- [L673–L759] TASK-UI-006 — Implements the AppShell layout component composing Sidebar and Topbar slots.
- [L760–L763] Group B — standalone display (no Tier 3 dependencies) — Parent section for standalone visual display components that do not compose other Tier 3 elements.
- [L764–L839] TASK-UI-007 — Implements the DocumentNumberBadge component for rendering styled final and preliminary document numbers.
- [L840–L912] TASK-UI-008 — Implements the StatCard component displaying dashboard metrics with trend indicators.
- [L913–L991] TASK-UI-009 — Implements the EmptyState component for representing empty states with optional illustrations and CTA buttons.
- [L992–L1060] TASK-UI-010 — Implements the ScanQualityIndicator component visualizing OCR quality thresholds.
- [L1061–L1144] TASK-UI-011 — Implements the SLATimer component displaying deadline countdowns with priority-based warning thresholds.
- [L1145–L1243] TASK-UI-012 — Implements the RoutingHistoryTimeline component visualizing document tracking steps.
- [L1244–L1326] TASK-UI-013 — Implements the QRCodeDisplay component rendering document QR codes with fallback mono labels.
- [L1327–L1330] Group C — require J6 types (CommitteeReferralBlock, StatusBadge, WorkflowStepIndicator) — Parent section for components that require J6 domain types and STATUS_META stylings.
- [L1331–L1403] TASK-UI-014 — Implements the CommitteeReferralBlock component displaying referral details, status badge, and timeline.
- [L1404–L1479] TASK-UI-015 — Implements the StatusBadge component rendering document states with STATUS_META styles.
- [L1480–L1592] TASK-UI-016 — Implements the WorkflowStepIndicator component displaying workflow steps with step-state visual styling and ARIA tags.
- [L1593–L1596] Group D — composed (DocumentPreviewCard, OrderOfBusinessRow) — Parent section for components that compose other Tier 3 component primitives.
- [L1597–L1675] TASK-UI-017 — Implements the DocumentPreviewCard component composing DocumentNumberBadge, SLATimer, StatusBadge, and ScanQualityIndicator.
- [L1676–L1774] TASK-UI-018 — Implements the OrderOfBusinessRow component composing DocumentNumberBadge, StatusBadge, and inline referral badges.
- [L1775–L1776] Plan 2 — Cross-component integration — Parent section for the final cross-component integration page task.
- [L1777–L1818] TASK-UI-019 — Implements the /dev/all-components route rendering all Tier 3 components in all states.
- [L1819–L1853] Module Summary — UI — Summarizes UI module tasks, prerequisites, files created/edited, and the final verification checklist.

---

## Note on Section 6's general Step-2 capability-list instruction

`A1-AGENTS.md` §6 "Step 2 — Module passes" opens: _"Before writing any task: read the capability list for this module in consolidated ref §13 Phase 1, then read the module-specific documents in the order listed in the Pass Types table."_ `a1-skeleton.md` §3 reads this as applying "for every pass without exception."

The calling instruction for this pass supplied an explicit nine-document load list (reproduced above) that did not include the consolidated reference, and this document originally flagged the omission as an unverified `[SPEC GAP — process]`. **Verified in the resolution pass, 2026-06-23:** `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md` Part 13 ("Roadmap"), Phase 1's "Included" capability list, was read directly. It names IAM, Organization module, Document Core, Workflow Engine, the per-document-type workflows, DTS, Session attendance tracking, Order of Business view, Secretariat decision logging, In-app notifications, dashboards, Audit log, OCR, Citizen Complaint module, the Phase 1 public-portal subset, and Infrastructure — **`UI` is not named as a capability anywhere in Part 13**, in either Phase 1 or any later phase. This confirms `a1-skeleton.md` §2 footnote `[†1]`'s reasoning: `UI` is a cross-cutting build module, not one of the 11 schema-owning domain modules Part 13 enumerates capabilities for, so its task list is correctly "structurally fixed by F7's instantiation rule" rather than driven by a §13 capability enumeration. There is nothing in consolidated ref §13 this task list is missing.

---

---

## Resolution pass — 2026-06-23

Everything below this point was originally written during the initial UI module pass (2026-06-22) and has now been updated following an explicit human authorization to resolve the open items raised in that pass, including authorization to edit the pre-dev documents listed in `A1-AGENTS.md` §8's "do not edit" rule where doing so was necessary to reflect a resolution. Seven items were resolved; six required editing a pre-dev document outside this file (`f5-ui-component-library-setup-and-package-architecture.md`, `f6-accessibility-compliance-checklist.md`, `f7-frontend-implementation-plans.md`, `INSTALL.sh`, `a1-skeleton.md`); one (the consolidated-ref §13 check, above) required no edit, only direct verification. All edited documents are listed in the Module Summary's "Documents edited in the resolution pass" table at the end of this file. No item was resolved by guessing — each resolution below states which source it follows and why.

## Pre-task reconciliation findings

Per `A1-AGENTS.md` §6 Step 2: _"Before writing any task... read the module-specific documents... identify the complete set of Phase 1 capabilities this module must deliver before generating a single task."_ Reading F5, J6, F6, and F7 together surfaced the following cross-document items. None of these are invented content — each is a direct comparison of what two or more loaded documents actually say. Per `A1-AGENTS.md` §8, no pre-dev document was edited to resolve any of these; each is recorded here and, where it affects a specific task below, repeated in that task's own notes.

1. **UI Tier-3 component count — `a1-skeleton.md`'s flagged open item, now checked directly.** `a1-skeleton.md` §3 and §6 carried forward an unresolved "F5/F7 component-count discrepancy" from an earlier pass, deferred "to whenever the UI Step 2 module pass actually runs and reads F5/F7 directly." Having now read both directly: F5 §1 and §4.3 both state **sixteen** Tier 3 components, and F7's own "Reconciliation Notes" (Correction 1, at the top of that document) record that an earlier draft input said "17" and that F7 already corrected its own prose to "16" before this version was written to disk. F5 and F7, as loaded for this pass, agree at **16**. This pass treats `a1-skeleton.md`'s flagged item as resolved by direct reading, not as a remaining gap.
2. **`PageHeader` composing-primitives conflict — three-way, resolved 2026-06-23.** F5's overview table lists `PageHeader`'s "Composes" column as `—`. F7's per-component fill-in table (row 1) had "corrected" this to `Button (T2)`. J6 §3.1.2 states explicitly: _"the PageHeader renders the slot verbatim so it does not import Button directly — the consumer passes it. The component itself has no direct Tier 1 or Tier 2 imports."_ **Resolved by following J6**, with human authorization: F5's original `—` was correct, and F7's "correction" was the error. F7's row 1 has been edited to read `none` and to record that its earlier correction was itself wrong. Recorded in TASK-UI-003 below.
3. **`OrderOfBusinessRow` / `CommitteeReferralBlock` composition conflict — resolved 2026-06-23.** F7's per-component fill-in table (row 16) had listed `CommitteeReferralBlock` as a Tier 3 dependency of `OrderOfBusinessRow`. J6 §3.16 (props interface, Tier 1/2 dependency list, and visual-behavior layout description, item 5: _"one `Badge` per entry in `committeeReferrals` with per-status coloring"_) describes `OrderOfBusinessRow` rendering its own inline `Badge` (Tier 1) chips per committee referral, and does not list `CommitteeReferralBlock` anywhere in §3.16. **Resolved by following J6**, with human authorization — this changed the actual Prerequisites field, not just a documentation label. F7's row 16 and its Execution Order ASCII diagram have both been edited to remove `CommitteeReferralBlock` and record the correction. `OrderOfBusinessRow`'s Tier 3 dependencies are `DocumentNumberBadge` and `StatusBadge` only. Recorded in TASK-UI-018 below.
4. **`QRCodeDisplay` / `DocumentNumberBadge` composition — F7's own flagged open item, now resolved.** F7 had stated directly, under "Open item — QRCodeDisplay composition": _"F5 §4.3 lists `QRCodeDisplay` composition as `—`... This is not resolved in this document. The A1 UI module pass should flag it and the human should decide."_ J6 §3.11 gives a complete implementation spec with **no** Tier 1, Tier 2, or Tier 3 imports — the document number renders as plain text (`font-mono text-xs font-medium`) directly inside the component, not via a composed `DocumentNumberBadge`. The flag has now reached a human, who authorized resolving it: **`QRCodeDisplay` has no Tier 3 dependency**, per J6's complete spec. F7's "Open item" paragraph and its row 11 have both been edited to record this as resolved. Recorded in TASK-UI-013 below.
5. **`WorkflowStepIndicator` pending/error step ARIA — was genuinely unresolved in the source material; now decided.** F6 §3.2 had stated directly: _"DESIGN.md does not specify ARIA attributes for either state. I do not have a confirmed requirement here... this specific suggestion is [Speculation], not a confirmed DESIGN.md requirement, and should be resolved explicitly before implementation rather than assumed."_ With human authorization, this is now decided rather than left speculative: pending steps carry no special ARIA attribute beyond list position; error steps carry `aria-label="{step name} — error"`, the same default F6 had already proposed as "reasonable" before elevating it from speculation to a confirmed requirement. F6 §3.2 has been edited to record this as resolved, and its PR-check line updated accordingly. TASK-UI-016 below reflects the confirmed requirement.
6. **`Sidebar` collapsed-label hiding — F5 prose vs. F6 accessibility requirement.** F5 §4.3 describes collapsed-mode label hiding as `hidden` on the label `<span>`. F6 §3.5 states this conflicts with its own accessible-name requirement and gives a **required action** (a visually-hidden technique, or an explicit `aria-label` on the parent element) rather than leaving this open. This is not a gap — F6 resolves it — but F5's literal prose must not be followed as written. Recorded as a direct instruction in TASK-UI-004 below.
7. **Sonner `<Toaster>` position conflict — resolved 2026-06-23.** F5 §3 deviation #6 recorded a conflict between `INSTALL.sh` (`top-right`) and DESIGN.md §6.5 (`bottom-right`), unresolved in either source, though F5's own "Required action" column already leaned toward `bottom-right` ("recommended unless there is a documented UX rationale for `top-right`"). With human authorization: **`bottom-right` is the canonical position**, per DESIGN.md §6.5's specific, deliberate value (`bottom-4 right-4`, 5s auto-dismiss) — `top-right` in `INSTALL.sh` was never DESIGN.md's stated position and appears to have been an unmodified Sonner default in an example comment, not a considered choice. `INSTALL.sh` Step 5 and F5's deviation-table row 6 have both been edited to record this. Still does not block any of the 19 tasks below, since registering the provider isn't part of Plan 0's deliverable list.
8. **Domain-type location conflict — found and resolved during the resolution pass, not in the original pass.** F5 §1 and §4.3 stated that canonical domain types referenced in Tier 3 props interfaces (e.g., `DocumentState`) are defined in `packages/shared`, imported from `@batac/shared`. J6 §1 places them instead in `packages/ui/src/types/domain.ts`, with a stated rationale: `packages/ui` already depends on `packages/shared` for tRPC/Zod types, so having `packages/shared` import back from `packages/ui` would close a circular dependency. This task list's TASK-UI-002 had already followed J6's location throughout (it was never built against F5's claim), so no task content changes were needed — but F5's own text was wrong and is corrected: F5 §1's package-overview paragraph, its domain-types bullet rule, the `StatusBadge` section's description, and its implementation-steps reference have all been edited to `packages/ui/src/types/domain.ts`. F5's `DocumentState` union itself was also stale relative to J6 (23 members, including four "overlay" pseudo-states — `CERTIFIED_URGENT`, `SLA_AT_RISK`, `SLA_BREACHED`, `MISSING_REPORT` — that are not document lifecycle states; J6 correctly models these as booleans on `OrderOfBusinessItem` and a separate `SLAStatus` type instead, and adds seven lifecycle states F5 was missing). F5's `DocumentState` union has been replaced with J6's canonical 26-member version, with a code comment explaining the change.

---

## Task ID convention used in this list

`TASK-UI-{NNN}`, zero-padded three digits, starting at `001`, restarting from the global numbering only in the sense that every module restarts at `001` (`a1-skeleton.md` §1). No `[MIGRATION]`, `[ABAC]`, or `[AUDIT]` tag applies to any task below — `packages/ui` owns no database schema, no ABAC policy, and emits no audit events (`a1-skeleton.md` §5 special-tags table; none of the three trigger conditions are met by a frontend component-library package).

**Task count:** 19 (Plan 0 Foundation ×1, J6 type-system generation ×1, Tier 3 components ×16, Plan 2 integration page ×1). This sits at the upper bound of `a1-skeleton.md` §6's "17–19 tasks" estimate — the one task beyond F7's own "Foundation(1) + 16 components + Integration(1) = 18" arithmetic is TASK-UI-002, the J6 type/`STATUS_META` generation task, which `A1-AGENTS.md` §6's UI-specific rule requires to exist as a named prerequisite for Group C ("their tasks must list the J6-generation task as a prerequisite") but which neither F5 nor F7 instantiates as its own Plan or task — it is `[Inference]`, drawn directly from that one sentence in `A1-AGENTS.md` §6, that this task must be written into this list rather than folded into Plan 0 (F7's own Plan 0 AI Prompt, Steps 1–6, does not create `packages/ui/src/types/domain.ts` or `packages/ui/src/lib/status-meta.ts` anywhere in its text).

---

## TASK-UI-001

````
TASK-UI-001

Phase:          1
Module:         UI
Title:          Foundation PR — Tier 1 install, Tier 2 overrides, token system, /dev/components
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /packages/ui/src/styles/globals.css — Tailwind v4 token layer (@theme block), shadcn HSL variable map, global resets, focus-ring rule, reduced-motion rule, touch-target rule, .touch-exempt and .font-doc-number utility classes. Provided file, committed as-is.
  - /packages/ui/src/lib/utils.ts — cn() helper composing clsx + tailwind-merge. Provided file, committed as-is.
  - /packages/ui/src/lib/date-locale.ts — phLocale, PH_TIMEZONE, DATE_FORMATS. Provided file, committed as-is.
  - /packages/ui/src/components/ui/*.tsx — 20 Tier 1 shadcn primitives generated by the single CLI invocation, inspected and corrected per the runbook below.
  - /packages/ui/src/components/ui/button.tsx, tabs.tsx, avatar.tsx — overwritten with the provided Tier 2 CVA-override versions; "use client" removed from tabs.tsx.
  - /packages/ui/src/components/domain/types.ts — SidebarUser, BreadcrumbItem layout-utility types (not domain types; domain types are TASK-UI-002's responsibility).
  - /packages/ui/src/index.ts — barrel re-exporting all Tier 1 + Tier 2 components, cn, phLocale/PH_TIMEZONE/DATE_FORMATS. Tier 3 export lines left as commented-out stubs.
  - /packages/ui/package.json — exports map per the table in this task's AI Prompt.
  - /packages/ui/components.json — provided shadcn CLI config, committed as-is.
  - /apps/web/src/pages/dev/ComponentsPage.tsx — dev-only route at /dev/components rendering token swatches, typography specimens, and every Tier 1/Tier 2 component state.
  - INSTALL.sh — one line added to Step 1: pnpm add date-fns-tz --filter @batac/ui (confirmed install gap; date-locale.ts imports formatInTimeZone from a package INSTALL.sh never installs).
Acceptance Criteria:
  - [ ] pnpm typecheck passes for packages/ui with strict: true and no implicit any
  - [ ] All 20 Tier 1 components import without error from @batac/ui/components/ui/{name}
  - [ ] Button renders all 8 variants (default, primary, secondary, destructive, ghost, ghost-danger, link, outline) and 6 sizes (xs, sm, default, lg, icon, icon-sm) without error
  - [ ] Tabs variant="underline" active trigger renders border-b-2 border-primary-800 text-primary-800 font-semibold; inactive trigger renders border-b-2 border-transparent text-text-secondary
  - [ ] AvatarName with name="Gladys R. Lagura" renders initials "GL" and the same background color on every render (deterministic hash) — manual check: refresh /dev/components three times, confirm the color does not change
  - [ ] cn("bg-red-500", "bg-blue-500") resolves to "bg-blue-500" and cn("px-4", false && "py-2", "py-3") resolves to "px-4 py-3" — add as a one-line unit assertion or confirm in a scratch console
  - [ ] In Chrome DevTools, getComputedStyle confirms bg-primary-800 resolves to #162e60 and text-text-muted resolves to #5a6470 (not the DESIGN.md §3 uncorrected #868e96)
  - [ ] Manual check: visiting /dev/components in a NODE_ENV=production pnpm build either 404s or redirects to / — the route must not ship to production
  - [ ] Manual check: Tab through every interactive element on /dev/components; the focus ring from globals.css is visible on each one with no element overriding it to outline: none
AI Prompt:
  > You are implementing the packages/ui foundation PR for batac-dms. This is the zero-feature setup PR that establishes the entire Tier 1 and Tier 2 component base. No domain logic, no pages, no feature components, no Tier 3 components — Tier 3 is out of scope for this PR even though four of its components (AppShell, Sidebar, Topbar, PageHeader) are prerequisites for every later authenticated view.
  >
  > **Confirmed technology lock-in for this package (deviation from any of these requires a written ADR, not a local workaround):** Tailwind CSS v4 with tokens declared in @layer base {:root {}} and extended via @theme {} in globals.css — no tailwind.config.ts in production. shadcn/ui with "rsc": false — no "use client" directives in any component. CVA (class-variance-authority) for every multi-variant component. clsx + tailwind-merge composed as cn() — never one without the other. Lucide as the sole icon library. Sonner for all toast notifications. Radix UI primitives transitively for accessibility. date-fns for all date operations, never moment.js. No <form> HTML elements anywhere in this package. No hardcoded hex/HSL/RGB color values in any component.
  >
  > **Step 1 — Token system.** Place the provided globals.css at packages/ui/src/styles/globals.css, utils.ts at packages/ui/src/lib/utils.ts, date-locale.ts at packages/ui/src/lib/date-locale.ts. Confirm date-fns is already a packages/ui dependency. Add this line to INSTALL.sh's Step 1 dependency block and run it: `pnpm add date-fns-tz --filter @batac/ui` — date-locale.ts's formatInTimeZone import has no corresponding install entry without this line.
  >
  > **Step 2 — Tier 1 install.** Run the single shadcn CLI invocation from INSTALL.sh Step 2, which installs these 20 primitives in one command: card, input, textarea, label, separator, skeleton, badge, dialog, sheet, tooltip, table, alert, command, popover, select, checkbox, calendar, chart, breadcrumb, sonner. After the CLI runs, inspect every generated file for three things and correct in place: (a) any hardcoded hex or hsl(var(...)) string that does not map to a @theme token utility — replace with the token class; (b) a "use client" directive at the top of the file — remove it; (c) a reference to a shadcn default theme variable not mapped in this package's HSL variable block — verify it resolves to the intended brand color. Do not skip this inspection step for any of the 20 files even though most will need no change.
  >
  > **Step 3 — Tier 2 replacement.** Overwrite the CLI-generated button.tsx, tabs.tsx, and avatar.tsx with the three provided production files. These are final; do not modify their CVA configuration. Confirmed variant/size rosters you are replacing TOWARD (for your own verification, not for you to re-derive): Button variants = default, primary, secondary, destructive, ghost, ghost-danger, link, outline (8); Button sizes = xs, sm, default, lg, icon, icon-sm (6). Tabs gains a variant="underline" CVA branch alongside shadcn's default pill style. Avatar gains an AvatarName compound export with a deterministic six-color hash palette keyed off the rendered name string. Remove "use client" from tabs.tsx specifically — it is a CLI generation artifact on this one file.
  >
  > **Step 4 — Layout-utility types file.** Create packages/ui/src/components/domain/types.ts containing exactly two interfaces, shared across multiple future Tier 3 components but not themselves domain types:
  > ```typescript
  > export interface SidebarUser {
  >   name: string;
  >   role: string;
  > }
  >
  > export interface BreadcrumbItem {
  >   label: string;
  >   /** Omit for the current (non-linked) final segment */
  >   href?: string;
  > }
  > ```
  > Do not put DocumentState, NumberVariant, or any other domain-meaning type in this file — those belong to a separate types module that a later task creates; this file is layout-only.
  >
  > **Step 5 — Export barrel.** Create packages/ui/src/index.ts. Export every Tier 1 component, all three Tier 2 overrides, cn from ./lib/utils, and phLocale/PH_TIMEZONE/DATE_FORMATS from ./lib/date-locale. Leave Tier 3 export lines as commented-out stubs (`// export * from './components/domain/DocumentNumberBadge';` etc., one per component, sixteen lines, all commented) so later Tier 3 PRs have an obvious single line to uncomment rather than needing to guess barrel placement.
  >
  > **Step 6 — package.json exports map.** Add an "exports" field to packages/ui/package.json:
  > ```json
  > {
  >   "exports": {
  >     ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
  >     "./styles/globals.css": "./src/styles/globals.css",
  >     "./lib/utils": { "types": "./src/lib/utils.ts", "default": "./src/lib/utils.ts" },
  >     "./lib/date-locale": { "types": "./src/lib/date-locale.ts", "default": "./src/lib/date-locale.ts" },
  >     "./components/ui/button": { "types": "./src/components/ui/button.tsx", "default": "./src/components/ui/button.tsx" },
  >     "./components/ui/tabs": { "types": "./src/components/ui/tabs.tsx", "default": "./src/components/ui/tabs.tsx" },
  >     "./components/ui/avatar": { "types": "./src/components/ui/avatar.tsx", "default": "./src/components/ui/avatar.tsx" },
  >     "./components/domain/*": { "types": "./src/components/domain/*.tsx", "default": "./src/components/domain/*.tsx" }
  >   }
  > }
  > ```
  > The "./styles/globals.css" entry is never re-exported through the barrel — every consuming app imports it directly at its own root (apps/web/src/main.tsx today; apps/portal/src/app/layout.tsx in Phase 3).
  >
  > **Step 7 — /dev/components route.** Create apps/web/src/pages/dev/ComponentsPage.tsx with these sections, each under its own <h2>:
  > — Token System: a 40×40px color swatch for every named step in the primary (50–950), neutral (50–950), success (100/300/500/900), danger (50/100/200/500/700/900), warning (100/500/900), and info (100/500/900) scales, token name below each swatch in font-mono text-xs. Beneath the swatches, render one line per typography specimen with its Tailwind class annotated beside it: text-2xl font-bold text-text-primary (page heading), text-xl font-semibold (section heading), text-base (body), text-sm (body small / default app body), text-sm text-text-secondary (helper text), text-xs text-text-muted (caption), font-mono text-xs font-medium (document number, final), font-mono text-xs font-medium italic text-text-secondary (document number, preliminary), font-mono text-xs text-text-muted (timestamp), text-3xl font-bold (dashboard metric), text-xs font-semibold uppercase tracking-wide text-text-muted (dashboard metric label).
  > — Button — all variants: an 8×6 grid (variant × size) using FileText from lucide-react as the icon prop on one row and no icon on another; render default and destructive a second time with disabled set.
  > — Tabs — both variants: default pill style with three tabs; underline variant with tabs labeled Overview, Workflow, History, Attachments.
  > — Avatar / AvatarName — all sizes: an AvatarImage with a placeholder src, then AvatarName at sizes sm/md/lg for these six names: "Gladys R. Lagura", "Mark Christian R. Chua", "Albert D. Chua", and three additional councilor names of your choosing consistent with Filipino naming conventions — the acceptance criterion is six visually distinct background colors, not these specific six names.
  > Add the route at /dev/components in the Vite dev router. Gate it: `if (!import.meta.env.DEV) return <Navigate to="/" replace />;` at the top of the component (or the route-config equivalent already in use elsewhere in apps/web) — this route must not exist in a production build.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] pnpm typecheck passes for packages/ui with strict: true and no implicit any
  > - [ ] All 20 Tier 1 components import without error from @batac/ui/components/ui/{name}
  > - [ ] Button renders all 8 variants and 6 sizes without error
  > - [ ] Tabs variant="underline" active/inactive classes match the spec above
  > - [ ] AvatarName produces the same background color for "Gladys R. Lagura" on three successive page refreshes
  > - [ ] cn("bg-red-500", "bg-blue-500") → "bg-blue-500"; cn("px-4", false && "py-2", "py-3") → "px-4 py-3"
  > - [ ] bg-primary-800 computes to #162e60 and text-text-muted computes to #5a6470 in DevTools
  > - [ ] /dev/components 404s or redirects in a production build
  > - [ ] Tab through /dev/components — focus ring visible on every interactive element, no outline: none anywhere in the diff
  > A reviewer will verify each one independently.
````

---

## TASK-UI-002

````
TASK-UI-002

Phase:          1
Module:         UI
Title:          Generate J6 shared domain types and STATUS_META constant
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/types/domain.ts — DocumentState, NumberVariant, SLAStatus, ScanQualityLevel, RoutingAction, CommitteeReportStatus, RoutingEntry, WorkflowStep, CommitteeReferral, OrderOfBusinessItem, DocumentPreview, StatusMetaEntry — the canonical shared type definitions every Tier 3 component below imports from.
  - /packages/ui/src/lib/status-meta.ts — STATUS_META, a Record<DocumentState, StatusMetaEntry> with one entry per of the 26 DocumentState members.
  - /packages/ui/src/index.ts — barrel updated to re-export everything from ./types/domain and STATUS_META from ./lib/status-meta.
Acceptance Criteria:
  - [ ] pnpm typecheck passes — Record<DocumentState, StatusMetaEntry> in status-meta.ts produces zero TypeScript errors, which is only possible if all 26 DocumentState members have a corresponding STATUS_META key (TypeScript's mapped-type completeness check enforces this structurally — no separate runtime test is needed for this property)
  - [ ] grep -c for top-level export inside domain.ts returns 12 (one per type/interface listed in Deliverables)
  - [ ] Every bg-*, text-*, and border-l-* class string inside status-meta.ts exists in packages/ui/src/styles/globals.css's @theme block — manual check: spot-check five entries against the @theme block rather than all 26
  - [ ] STATUS_META.DEEMED_APPROVED.textStyle === 'italic' and STATUS_META.CANCELLED.textStyle === 'line-through' — these two are the only non-'normal' textStyle values besides LAPSED ('italic') and DRAFT/DISMISSED's borderStyle ('dashed' only on DRAFT and DEEMED_APPROVED, not on DISMISSED)
  - [ ] @batac/ui exports DocumentState, StatusMetaEntry, and STATUS_META — confirm with a throwaway `import { STATUS_META, type DocumentState } from '@batac/ui';` in a scratch file that typechecks
AI Prompt:
  > You are creating the canonical shared type-definitions file and the STATUS_META styling constant for batac-dms's packages/ui. Every Tier 3 domain component that ships after this PR imports its prop types from the file you create here. Get the exact shape right — a later component PR cannot deviate from these types without breaking the type contract this whole package is built on.
  >
  > **File 1 — packages/ui/src/types/domain.ts.** Create exactly this content (this is the canonical type set; do not add, remove, or rename a member):
  >
  > ```typescript
  > // packages/ui/src/types/domain.ts
  > // Canonical shared domain types for packages/ui Tier 3 components and apps/web.
  > // Location: deliberately NOT packages/shared, to avoid a circular dependency —
  > // packages/ui already depends on packages/shared for tRPC/Zod types, so having
  > // packages/shared import back from packages/ui would close the circle.
  >
  > export type DocumentState =
  >   // Core document lifecycle
  >   | 'DRAFT'              // Document created; not yet submitted to Secretariat
  >   | 'SUBMITTED'          // Submitted to Secretariat; pending intake logging
  >   | 'IN_WORKFLOW'        // Active in a workflow instance — broad umbrella state
  >   | 'PENDING_APPROVAL'   // Awaiting a generic approval action (non-SP document types)
  >   | 'COMPLETED'          // Workflow instance reached a terminal approved outcome
  >   | 'RELEASED'           // Published to portal; publicly visible
  >   | 'ARCHIVED'           // Permanent historical record; read-only
  >   | 'DISPOSED'           // Records-managed disposal (no document destroyed — audit only)
  >   | 'CANCELLED'          // Withdrawn/cancelled; terminal; no further action possible
  >   // Reading and workflow-step states
  >   | 'FIRST_READING'      // Vice Mayor has referred document at First Reading session
  >   | 'SECOND_READING'     // Document before the body at Second Reading session
  >   | 'THIRD_READING'      // Document before the body at Third Reading session (Ordinances only)
  >   | 'IN_COMMITTEE'       // Referred to one or more standing committees
  >   | 'PENDING_MAYOR'      // Transmitted to Mayor; 10-day review clock running
  >   | 'VETOED'             // Mayor returned with veto; override vote pending or failed
  >   | 'OVERRIDE_PENDING'   // Override vote has not yet occurred; 2/3 threshold required
  >   | 'LAPSED'             // Mayor took no action within 10 days; lapsed into law per RA 7160
  >   // Panlalawigan review outcome states
  >   | 'PANLALAWIGAN_REVIEW'  // Transmitted to Sangguniang Panlalawigan; 30-day timer running
  >   | 'VALID'                // Panlalawigan affirmed the measure in its entirety
  >   | 'VALID_IN_PART'        // Panlalawigan approved with partial invalidity finding
  >   | 'RETURNED'             // Panlalawigan returned with objections
  >   | 'DEEMED_APPROVED'      // 30-day Panlalawigan window lapsed with no action; RA 7160 §56(d)
  >   // Citizen complaint states
  >   | 'PENDING_HEARING'      // Complaint logged; committee referral in progress
  >   | 'RECEIVED_SEEN'        // Vice Mayor or Committee has acknowledged the complaint
  >   | 'DISMISSED'            // Complaint dismissed by Secretariat or committee
  >   | 'RESOLVED';            // Committee report issued; complainant notified; case closed
  >
  > export type NumberVariant = 'final' | 'preliminary';
  >
  > export type SLAStatus = 'on-track' | 'at-risk' | 'breached';
  >
  > export type ScanQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';
  >
  > export type RoutingAction =
  >   | 'Logged' | 'Transmitted' | 'Received' | 'FirstReadingConducted'
  >   | 'ReferredToCommittee' | 'CommitteeReportSubmitted' | 'SecondReadingConducted'
  >   | 'ThirdReadingConducted' | 'FinalNumberAssigned' | 'VPCertified'
  >   | 'TransmittedToMayor' | 'SignedByMayor' | 'Vetoed' | 'Lapsed' | 'DeemedApproved'
  >   | 'SubmittedToPanlalawigan' | 'PanlalawiganOutcomeRecorded' | 'Released' | 'Archived'
  >   | 'CertificationOfUrgencyLogged' | 'CommitteeBypassApplied' | 'OverrideVoteRecorded'
  >   | 'Docketed' | 'Repassed' | 'OrderOfBusinessScheduled';
  >
  > export type CommitteeReportStatus = 'SUBMITTED' | 'PENDING' | 'ABSENT_NOT_HEARD';
  >
  > export interface RoutingEntry {
  >   id: string;
  >   actorName: string;
  >   actorOfficeName: string;
  >   action: RoutingAction;
  >   timestamp: Date;
  >   notes?: string;
  >   fromOfficeName?: string;
  >   toOfficeName?: string;
  > }
  >
  > export interface WorkflowStep {
  >   id: string;
  >   label: string;
  >   state: 'completed' | 'active' | 'pending' | 'skipped' | 'error';
  >   completedAt?: Date;
  >   assigneeName?: string;
  >   tooltip?: string;
  > }
  >
  > export interface CommitteeReferral {
  >   id: string;
  >   committeeName: string;
  >   status: CommitteeReportStatus;
  >   submittedBy?: string;
  >   submittedAt?: Date;
  > }
  >
  > export interface OrderOfBusinessItem {
  >   agendaNumber: number;
  >   documentNumber: string;
  >   numberVariant: NumberVariant;
  >   title: string;
  >   documentState: DocumentState;
  >   committeeReferrals: CommitteeReferral[];
  >   isCertifiedUrgent: boolean;
  >   isMissingReport: boolean;
  >   scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD';
  > }
  >
  > export interface DocumentPreview {
  >   id: string;
  >   documentNumber: string;
  >   numberVariant: NumberVariant;
  >   title: string;
  >   documentState: DocumentState;
  >   lastActionAt: Date;
  >   slaDeadlineAt?: Date;
  >   slaStartedAt?: Date;
  >   thumbnailUrl?: string;
  > }
  >
  > export interface StatusMetaEntry {
  >   label: string;
  >   bg: string;
  >   text: string;
  >   borderLeft: string;
  >   borderStyle: 'solid' | 'dashed';
  >   textStyle: 'normal' | 'italic' | 'line-through';
  > }
  > ```
  >
  > Two ambiguity notes to preserve as code comments above the `DocumentState` export, because a future maintainer will otherwise "fix" what looks like redundancy: (1) `IN_WORKFLOW` is a broad umbrella state and coexists with the more granular reading/committee states rather than being refactored into a discriminated union — that refactor is explicitly deferred, not an oversight; (2) `PENDING_APPROVAL` is a generic alias for non-SP document types — SP Resolutions and Ordinances use `PENDING_MAYOR` specifically, never `PENDING_APPROVAL`.
  >
  > **File 2 — packages/ui/src/lib/status-meta.ts.** This is the canonical color/style map for every DocumentState, validated against the @theme block in globals.css. Two correctness notes before the literal content: first, wherever a hex value of #868e96 appears in a border, the correct Tailwind class is `border-l-neutral-600` — #868e96 is neutral-600 in this project's @theme block, not neutral-500 (#adb5bd), even though some upstream design documentation mislabels it; second, DEEMED_APPROVED's textStyle is 'italic' even though italic is easy to miss when skimming the visual description. Create exactly this content:
  >
  > ```typescript
  > import type { DocumentState, StatusMetaEntry } from '../types/domain';
  >
  > export const STATUS_META: Record<DocumentState, StatusMetaEntry> = {
  >   DRAFT: { label: 'Draft', bg: 'bg-neutral-100', text: 'text-neutral-700', borderLeft: 'border-l-2 border-l-neutral-600', borderStyle: 'dashed', textStyle: 'normal' },
  >   SUBMITTED: { label: 'Submitted', bg: 'bg-neutral-50', text: 'text-neutral-700', borderLeft: 'border-l-2 border-l-neutral-500', borderStyle: 'solid', textStyle: 'normal' },
  >   IN_WORKFLOW: { label: 'In Workflow', bg: 'bg-info-100', text: 'text-info-900', borderLeft: 'border-l-2 border-l-info-500', borderStyle: 'solid', textStyle: 'normal' },
  >   PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-warning-100', text: 'text-warning-900', borderLeft: 'border-l-2 border-l-warning-500', borderStyle: 'solid', textStyle: 'normal' },
  >   COMPLETED: { label: 'Completed', bg: 'bg-success-100', text: 'text-success-900', borderLeft: 'border-l-2 border-l-success-500', borderStyle: 'solid', textStyle: 'normal' },
  >   RELEASED: { label: 'Released', bg: 'bg-success-100', text: 'text-success-900', borderLeft: 'border-l-2 border-l-success-300', borderStyle: 'solid', textStyle: 'normal' },
  >   ARCHIVED: { label: 'Archived', bg: 'bg-neutral-100', text: 'text-neutral-600', borderLeft: 'border-l-2 border-l-neutral-400', borderStyle: 'solid', textStyle: 'normal' },
  >   DISPOSED: { label: 'Disposed', bg: 'bg-neutral-100', text: 'text-neutral-600', borderLeft: 'border-l-2 border-l-neutral-400', borderStyle: 'solid', textStyle: 'normal' },
  >   CANCELLED: { label: 'Cancelled', bg: 'bg-neutral-100', text: 'text-neutral-600', borderLeft: 'border-l-2 border-l-neutral-400', borderStyle: 'solid', textStyle: 'line-through' },
  >   FIRST_READING: { label: 'First Reading', bg: 'bg-info-100', text: 'text-info-900', borderLeft: 'border-l-2 border-l-info-500', borderStyle: 'solid', textStyle: 'normal' },
  >   SECOND_READING: { label: 'Second Reading', bg: 'bg-info-100', text: 'text-info-900', borderLeft: 'border-l-2 border-l-info-500', borderStyle: 'solid', textStyle: 'normal' },
  >   THIRD_READING: { label: 'Third Reading', bg: 'bg-info-100', text: 'text-info-900', borderLeft: 'border-l-2 border-l-info-500', borderStyle: 'solid', textStyle: 'normal' },
  >   IN_COMMITTEE: { label: 'In Committee', bg: 'bg-info-100', text: 'text-info-900', borderLeft: 'border-l-2 border-l-info-500', borderStyle: 'solid', textStyle: 'normal' },
  >   PENDING_MAYOR: { label: 'Pending Mayor', bg: 'bg-warning-100', text: 'text-warning-900', borderLeft: 'border-l-2 border-l-warning-500', borderStyle: 'solid', textStyle: 'normal' },
  >   VETOED: { label: 'Vetoed', bg: 'bg-danger-100', text: 'text-danger-900', borderLeft: 'border-l-2 border-l-danger-500', borderStyle: 'solid', textStyle: 'normal' },
  >   OVERRIDE_PENDING: { label: 'Override Pending', bg: 'bg-warning-100', text: 'text-warning-900', borderLeft: 'border-l-2 border-l-warning-500', borderStyle: 'solid', textStyle: 'normal' },
  >   LAPSED: { label: 'Lapsed', bg: 'bg-neutral-100', text: 'text-neutral-700', borderLeft: 'border-l-2 border-l-neutral-400', borderStyle: 'solid', textStyle: 'italic' },
  >   PANLALAWIGAN_REVIEW: { label: 'Panlalawigan Review', bg: 'bg-warning-100', text: 'text-warning-900', borderLeft: 'border-l-2 border-l-warning-500', borderStyle: 'solid', textStyle: 'normal' },
  >   VALID: { label: 'Valid', bg: 'bg-success-100', text: 'text-success-900', borderLeft: 'border-l-2 border-l-success-500', borderStyle: 'solid', textStyle: 'normal' },
  >   VALID_IN_PART: { label: 'Valid in Part', bg: 'bg-warning-100', text: 'text-warning-900', borderLeft: 'border-l-2 border-l-warning-500', borderStyle: 'solid', textStyle: 'normal' },
  >   RETURNED: { label: 'Returned', bg: 'bg-danger-100', text: 'text-danger-900', borderLeft: 'border-l-2 border-l-danger-500', borderStyle: 'solid', textStyle: 'normal' },
  >   DEEMED_APPROVED: { label: 'Deemed Approved', bg: 'bg-success-100', text: 'text-success-900', borderLeft: 'border-l-2 border-l-success-300', borderStyle: 'dashed', textStyle: 'italic' },
  >   PENDING_HEARING: { label: 'Pending Hearing', bg: 'bg-warning-100', text: 'text-warning-900', borderLeft: 'border-l-2 border-l-warning-500', borderStyle: 'solid', textStyle: 'normal' },
  >   RECEIVED_SEEN: { label: 'Received / Seen', bg: 'bg-info-100', text: 'text-info-900', borderLeft: 'border-l-2 border-l-info-500', borderStyle: 'solid', textStyle: 'normal' },
  >   DISMISSED: { label: 'Dismissed', bg: 'bg-neutral-100', text: 'text-neutral-700', borderLeft: 'border-l-2 border-l-neutral-600', borderStyle: 'solid', textStyle: 'normal' },
  >   RESOLVED: { label: 'Resolved', bg: 'bg-success-100', text: 'text-success-900', borderLeft: 'border-l-2 border-l-success-500', borderStyle: 'solid', textStyle: 'normal' },
  > };
  > ```
  >
  > Update packages/ui/src/index.ts to add `export * from './types/domain';` and `export { STATUS_META } from './lib/status-meta';` to the barrel, in the section currently holding the commented-out Tier 3 stub lines from TASK-UI-001 (these two exports are not Tier 3 components, so they go above that section, not inside it).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] pnpm typecheck passes with zero errors — the Record<DocumentState, StatusMetaEntry> mapped type is the structural proof that all 26 states are covered
  > - [ ] domain.ts exports exactly 12 named types/interfaces — no more, no fewer
  > - [ ] Five spot-checked STATUS_META class strings (your choice of which five) match real classes in globals.css's @theme block
  > - [ ] STATUS_META.DEEMED_APPROVED.textStyle === 'italic' and STATUS_META.CANCELLED.textStyle === 'line-through'
  > - [ ] `import { STATUS_META, type DocumentState } from '@batac/ui';` typechecks from a scratch file outside packages/ui
  > A reviewer will verify each one independently.
````

---

## Group A — layout shell (PageHeader, Sidebar, Topbar, AppShell)

Per `A1-AGENTS.md` §6 UI-specific rule: "Group A components... have no Tier 3 prerequisites. AppShell depends on Sidebar and Topbar." All four below carry `TASK-UI-001` as their only Foundation-level prerequisite; `AppShell` additionally carries `TASK-UI-004` and `TASK-UI-005`.

## TASK-UI-003

````
TASK-UI-003

Phase:          1
Module:         UI
Title:          Tier 3 component — PageHeader
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/PageHeader.tsx
  - /packages/ui/src/index.ts — uncomment the PageHeader export line
  - /apps/web/src/pages/dev/PageHeaderPage.tsx — dev route at /dev/components/page-header
Acceptance Criteria:
  - [ ] title always renders as an <h1>, never <div> or <h2> — inspect the rendered DOM
  - [ ] subtitle, when omitted, renders no empty <p> or <span> in the DOM (conditionally rendered, not rendered-empty)
  - [ ] actions slot renders whatever ReactNode is passed verbatim — test with a single Button and with two Buttons side by side
  - [ ] Container always shows border-b border-border-default and mb-6 pb-4 regardless of props
  - [ ] pnpm typecheck passes; PageHeaderProps has no optional title (title is required)
  - [ ] Manual check: with grayscale/Achromatopsia emulation in Chrome DevTools, the header still reads correctly — it carries no color-only meaning to lose
AI Prompt:
  > Implement the PageHeader Tier 3 component for packages/ui. This is a Group A layout-shell component with no Tier 3 dependencies of its own.
  >
  > **Props interface (canonical, J6 §3.1.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/PageHeader.tsx
  > import type { ReactNode } from 'react';
  >
  > interface PageHeaderProps {
  >   /** Page title — renders as h1 with text-2xl font-bold text-text-primary */
  >   title: string;
  >   /** Optional subtitle — renders as text-sm text-text-secondary mt-1 */
  >   subtitle?: string;
  >   /** Right slot: pass fully constructed Button (T2) elements */
  >   actions?: ReactNode;
  >   className?: string;
  > }
  > ```
  >
  > **Tier 1/2 dependencies:** none directly. The `actions` prop is a render-prop slot — the consuming page constructs and passes its own `Button` elements; `PageHeader.tsx` itself contains no `import { Button } from ...` line. *[Resolved 2026-06-23: F7's per-component fill-in table had listed `Button (T2)` as a composed primitive for this component, conflicting with J6 §3.1.2's explicit statement that the component "does not import Button directly — the consumer passes it... has no direct Tier 1 or Tier 2 imports." F7's table has been corrected to match J6 — F5's original `—` was right all along.]* Write no Button import in this file.
  >
  > **Visual behavior:** Structural container, no interactive states. Always renders a bottom border `border-b border-border-default` and bottom spacing `mb-6 pb-4`, so every routed view's header zone is visually identical. The `title` is always an `<h1>` — never `<div>`, never `<h2>` — because each view renders exactly one page-level heading, which keeps the document outline correct for screen readers. `subtitle`, when present, renders immediately beneath the title with `text-sm text-text-secondary mt-1`. The `actions` slot is right-aligned via `flex justify-between items-start` on the outer row: left side holds title + subtitle, right side holds actions.
  >
  > **ARIA:** No ARIA attributes affect the props interface — the `<h1>` role is implicit. See the Universal Rules below; nothing component-specific applies beyond them.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — breaks document heading hierarchy
  > <div className="mb-6 pb-4 border-b border-border-default">
  >   <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
  > </div>
  > ```
  > Screen readers expect exactly one `<h1>` per page. If `PageHeader` uses `<h2>`, the page has no `<h1>` at all, breaking navigation landmarks and failing WCAG 2.1 §1.3.1.
  >
  > **Usage example to mirror in the dev route:**
  > ```tsx
  > <PageHeader
  >   title="Order of Business"
  >   subtitle="Regular Session · Tuesday, 17 June 2026"
  >   actions={<Button variant="default" onClick={() => {}}>Generate Order of Business</Button>}
  > />
  > ```
  >
  > **Universal accessibility rules that apply to every Tier 3 PR (F6 §2), check each:**
  > 1. No interactive element overrides the global focus ring (`globals.css` lines 313–316). Grep your diff for `outline: none` / `focus:outline-none`.
  > 2. Every interactive element meets the 44×44px touch-target minimum, or is one of the only three components allowed `.touch-exempt` (`DocumentNumberBadge`, `StatusBadge`, `ScanQualityIndicator` — `PageHeader` is not one of them and has no interactive elements of its own anyway).
  > 3. No hardcoded hex/HSL/RGB literal anywhere in the file.
  > 4. No component-level `!important` on any `animation-*`/`transition-*` property.
  > 5. `document.title` is the consuming route's job, not this component's — no action needed here.
  > 6. No status/state/meaning conveyed by color alone — not applicable; this component has no state.
  >
  > Build the dev route at apps/web/src/pages/dev/PageHeaderPage.tsx, gated `import.meta.env.DEV` the same way as TASK-UI-001's /dev/components route, showing: title only; title + subtitle; title + actions (one Button); title + subtitle + actions (two Buttons).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] title is always <h1>
  > - [ ] subtitle conditionally rendered, no empty element when omitted
  > - [ ] actions slot renders any ReactNode verbatim
  > - [ ] border-b and mb-6 pb-4 present regardless of props
  > - [ ] typecheck passes, title is a required prop
  > - [ ] Grayscale emulation check passes (nothing to lose — confirms no accidental color-only element was added)
  > A reviewer will verify each one independently.
````

---

## TASK-UI-004

````
TASK-UI-004

Phase:          1
Module:         UI
Title:          Tier 3 component — Sidebar [implements F6 §3.5's accessible-name required action]
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/Sidebar.tsx
  - /packages/ui/src/index.ts — uncomment the Sidebar export line
  - /apps/web/src/pages/dev/SidebarPage.tsx — dev route at /dev/components/sidebar
Acceptance Criteria:
  - [ ] Every nav item is a real <a> or <button> — grep the diff for a <div> with onClick inside this component (must return nothing)
  - [ ] The active nav item carries aria-current="page"
  - [ ] The collapse toggle's aria-expanded and aria-label update together and in the correct direction (expanded → aria-expanded="true", aria-label="Collapse sidebar"; collapsed → aria-expanded="false", aria-label="Expand sidebar")
  - [ ] In collapsed mode, inspect a nav item in Chrome DevTools' Accessibility pane and confirm it still has a non-empty accessible name — this is the F6 §3.5 conflict check, not a visual check
  - [ ] Collapsing the sidebar does not remove any nav item from the Tab order — Tab through all items in both states
  - [ ] Sidebar background is bg-primary-950 in both expanded and collapsed state — confirm with DevTools, do not rely on the visual approximation
  - [ ] Disabled nav items render opacity-40 cursor-not-allowed pointer-events-none and are skipped by Tab
  - [ ] AvatarName at the bottom renders size="md" in expanded mode and only the avatar (no name/role text) in collapsed mode
AI Prompt:
  > Implement the Sidebar Tier 3 component for packages/ui. This is a Group A layout-shell component.
  >
  > **Props interface (canonical, J6 §3.2.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/Sidebar.tsx
  > import type { LucideIcon } from 'lucide-react';
  >
  > interface NavItem {
  >   id: string;
  >   label: string;
  >   icon: LucideIcon;
  >   href: string;
  >   /** Unread count — renders as danger-500 pill per DESIGN.md §6.1 badge variant */
  >   badge?: number;
  >   disabled?: boolean;
  > }
  >
  > interface SidebarUser {
  >   name: string;
  >   role: string;
  > }
  >
  > interface SidebarProps {
  >   items: NavItem[];
  >   activeItemId: string;
  >   collapsed: boolean;
  >   onToggle: () => void;
  >   currentUser: SidebarUser;
  > }
  > ```
  > `SidebarUser` is the same shape created in TASK-UI-001's packages/ui/src/components/domain/types.ts — import it from there rather than redeclaring it in this file.
  >
  > **Tier 1/2 dependencies:** `Tooltip` (Tier 1) wraps each nav item icon in collapsed mode, since the icon is the only visible element when `collapsed=true` and the Tooltip supplies the label text that would otherwise be invisible (DESIGN.md §8 Rule 5: icon-only controls require an accessible label). `AvatarName` (Tier 2) renders the current user's avatar + name + role at the bottom in expanded mode (`size="md"`); in collapsed mode render only the avatar.
  >
  > **Visual behavior:** Sidebar background is always `bg-primary-950` — DESIGN.md §8 Rule 3 states this must never be lightened, in any state, including collapsed. Expanded width is `w-60` (240px); collapsed width is `w-14` (56px); the transition is `transition-[width] duration-base ease-default`. Default nav item state: `text-primary-200 hover:bg-primary-800 hover:text-white`. Active nav item state: `bg-primary-700 text-white font-semibold border-l-2 border-l-warning-500` — the left-border accent is a required non-color redundant signal (DESIGN.md §8 Rule 2), not decorative. Disabled items: `opacity-40 cursor-not-allowed pointer-events-none`. The unread-count badge: `bg-danger-500 text-white`, with `.touch-exempt` applied (it is one of only three components in the whole app permitted that class, per F6 §2 rule 2 — `Sidebar`'s badge counts as part of `DocumentNumberBadge`/`StatusBadge`/`ScanQualityIndicator`'s exemption only insofar as the badge itself is decorative and not independently interactive; if a reviewer flags this, the badge is non-actionable display only, consistent with the other three exempted components' role).
  >
  > **Required action on a real spec conflict (F6 §3.5) — do not implement the literal `hidden`-attribute approach:** F5's component description says collapsed-mode label hiding uses `hidden` on the label `<span>`. The HTML `hidden` attribute removes the element from the accessibility tree entirely, which means the parent link/button is left with no accessible name (the icon alone carries no text without an `aria-label`). F6 §3.5 requires one of two approaches instead: (a) hide the label visually only — `overflow-hidden` clipping or a visually-hidden/`sr-only` utility class that keeps the text in the accessibility tree — or (b) keep `hidden` for layout simplicity but add an explicit `aria-label={item.label}` to the parent `<a>`/`<button>` so the accessible name does not depend on the hidden child. Pick one; either satisfies the requirement. Do not implement F5's literal `hidden`-only description as written.
  >
  > **ARIA (F6 §3.5):**
  > - Every nav item is `<a>` (if `href` navigates) or `<button>` — never a `<div>` with a synthetic click handler.
  > - The active item carries `aria-current="page"`.
  > - The collapse toggle carries `aria-expanded` reflecting state (`true` expanded / `false` collapsed) and `aria-label="Collapse sidebar"` (expanded) / `aria-label="Expand sidebar"` (collapsed) — the label always describes the action the control performs, not the current state.
  > - In collapsed mode, each nav icon's label is exposed via the Tier 1 `Tooltip` (500ms delay per DESIGN.md §6.5) — and, per the required action above, remains in the accessibility tree by one of the two approved techniques.
  >
  > **Keyboard contract (F6 §3.5 / §5):** Tab/Shift-Tab cycles through nav items in DOM order plus the collapse toggle; Enter activates an `<a>` item, Enter or Space activates a `<button>` item or the toggle; collapsing never removes an item from the Tab order.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — lightens the sidebar in collapsed mode
  > <aside className={collapsed ? 'bg-neutral-100 w-14' : 'bg-primary-950 w-60'}>
  > ```
  > DESIGN.md §8 Rule 3 requires `bg-primary-950` in every state including collapsed. Lightening it destroys the visual separation between navigation and content.
  >
  > **Usage example to mirror in the dev route:**
  > ```tsx
  > const navItems = [
  >   { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  >   { id: 'documents', label: 'Documents', icon: FileText, href: '/documents', badge: 3 },
  >   { id: 'sessions', label: 'Sessions', icon: Calendar, href: '/sessions' },
  >   { id: 'members', label: 'SP Members', icon: Users, href: '/members' },
  > ];
  > <Sidebar items={navItems} activeItemId="documents" collapsed={collapsed} onToggle={onToggle}
  >   currentUser={{ name: 'Gladys R. Lagura', role: 'SP Secretary' }} />
  > ```
  > Build the dev route showing both expanded and collapsed state side by side, plus a disabled nav item and a nav item with a badge.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] No <div onClick> nav items
  > - [ ] aria-current="page" on the active item
  > - [ ] Toggle's aria-expanded/aria-label update together correctly in both directions
  > - [ ] Collapsed nav item has a non-empty accessible name in DevTools' Accessibility pane (not just visually)
  > - [ ] Tab order includes every item in both expanded and collapsed state
  > - [ ] bg-primary-950 confirmed in DevTools in both states
  > - [ ] Disabled items show the correct classes and are skipped by Tab
  > - [ ] AvatarName shows full name+role expanded, avatar-only collapsed
  > A reviewer will verify each one independently.
````

---

## TASK-UI-005

````
TASK-UI-005

Phase:          1
Module:         UI
Title:          Tier 3 component — Topbar
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/Topbar.tsx
  - /packages/ui/src/index.ts — uncomment the Topbar export line
  - /apps/web/src/pages/dev/TopbarPage.tsx — dev route at /dev/components/topbar
Acceptance Criteria:
  - [ ] Breadcrumb separator renders the literal "/" character, not a Lucide icon — inspect rendered DOM
  - [ ] Notification bell carries both a visible Tooltip and aria-label="Notifications" — confirm both, not just one
  - [ ] User account Popover carries aria-label="User account menu"
  - [ ] left offset is left-60 when sidebarCollapsed=false and left-14 when sidebarCollapsed=true, with a CSS transition on left
  - [ ] Notification badge renders only when notificationCount is provided and > 0 — confirm it does not render at notificationCount={0}
  - [ ] On a narrow viewport, middle breadcrumb segments truncate with "…" while first and last segments stay visible
  - [ ] typecheck passes; onNotificationClick and onUserMenuAction are both optional
AI Prompt:
  > Implement the Topbar Tier 3 component for packages/ui. This is a Group A layout-shell component.
  >
  > **Props interface (canonical, J6 §3.3.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/Topbar.tsx
  >
  > interface BreadcrumbItem {
  >   label: string;
  >   /** Omit for the current (non-linked) final segment */
  >   href?: string;
  > }
  >
  > interface TopbarProps {
  >   breadcrumbs: BreadcrumbItem[];
  >   /** Tracks sidebar width to adjust left offset (left-60 vs left-14) */
  >   sidebarCollapsed: boolean;
  >   notificationCount?: number;
  >   onNotificationClick?: () => void;
  >   currentUser: SidebarUser;
  >   onUserMenuAction?: (action: 'profile' | 'logout') => void;
  > }
  > ```
  > Import `SidebarUser` from `./types` (the same file TASK-UI-001 created); import `BreadcrumbItem` from the same location if you choose to centralize it there rather than redeclaring it locally — either is acceptable since both are layout-utility types, not domain types.
  >
  > **Tier 1/2 dependencies:** `Breadcrumb` (Tier 1) renders the trail in the left slot — the separator is the literal `/` character per DESIGN.md §6.2, not a Lucide icon. `Tooltip` (Tier 1) wraps the notification bell icon-only button; the bell must carry both `aria-label` and a visible Tooltip (DESIGN.md §8 Rule 5). `Popover` (Tier 1) wraps the user account menu, triggered by `AvatarName` (Tier 2) at `size="lg"` in the right slot.
  >
  > **Visual behavior:** Always `fixed top-0 bg-white border-b border-border-default z-sticky`, `right-0`, `h-14`. Left offset transitions between `left-60` (sidebar expanded) and `left-14` (sidebar collapsed), driven by `sidebarCollapsed`, using `transition-[left] duration-base ease-default` so it stays visually in sync with the Sidebar's own width animation. The breadcrumb trail never wraps — middle segments truncate with `…` on narrow viewports while the first and last segments always stay visible. The notification badge (when `notificationCount` is provided and greater than zero) renders `bg-danger-500 text-white`, structurally identical to the Sidebar's nav-item badge.
  >
  > **ARIA (J6 §3.3.4, F6 §3.6):** `onNotificationClick` drives a button with `aria-label="Notifications"`. `onUserMenuAction` drives the Popover with `aria-label="User account menu"`. The Topbar itself does not implement the ⌘K command palette — that lives in a search input this component may trigger, but the palette's own ARIA contract (focus trap, initial focus on the search input, Escape returns focus to the triggering element in the Topbar, not to document.body) is F6 §3.6's scope; if your implementation of this task includes a palette trigger button, wire that button's `aria-label="Search documents and navigate"` and confirm Escape-focus-return behavior, but the palette's internal Command/cmdk wiring is not part of this task's required deliverables unless you choose to include it here.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — uses a Lucide icon as the breadcrumb separator
  > <BreadcrumbSeparator><ChevronRight className="h-4 w-4" /></BreadcrumbSeparator>
  > ```
  > DESIGN.md §6.2 requires the literal `/` character. An icon `<svg>` used this way needs explicit `aria-hidden="true"` to avoid screen-reader confusion, and has different visual weight than the spec calls for.
  >
  > **Usage example to mirror in the dev route:**
  > ```tsx
  > <Topbar
  >   breadcrumbs={[
  >     { label: 'Home', href: '/dashboard' },
  >     { label: 'Documents', href: '/documents' },
  >     { label: '7SP 2026-001' }, // no href — current page
  >   ]}
  >   sidebarCollapsed={sidebarCollapsed}
  >   notificationCount={2}
  >   onNotificationClick={() => {}}
  >   currentUser={{ name: 'Gladys R. Lagura', role: 'SP Secretary' }}
  >   onUserMenuAction={(action) => { if (action === 'logout') { /* handle logout */ } }}
  > />
  > ```
  > Build the dev route showing: zero notifications (badge absent), two notifications (badge present), a long breadcrumb trail on a narrowed viewport (truncation), and both sidebarCollapsed states.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Separator is literal "/" in the DOM
  > - [ ] Bell has both Tooltip and aria-label="Notifications"
  > - [ ] Popover has aria-label="User account menu"
  > - [ ] left-60/left-14 swap correctly with a transition
  > - [ ] Badge absent at notificationCount={0} or undefined
  > - [ ] Breadcrumb truncation keeps first and last segment visible
  > - [ ] typecheck passes, both callback props optional
  > A reviewer will verify each one independently.
````

---

## TASK-UI-006

````
TASK-UI-006

Phase:          1
Module:         UI
Title:          Tier 3 component — AppShell
Prerequisites:  [TASK-UI-001, TASK-UI-004, TASK-UI-005]
Deliverables:
  - /packages/ui/src/components/domain/AppShell.tsx
  - /packages/ui/src/index.ts — uncomment the AppShell export line
  - /apps/web/src/pages/dev/AppShellPage.tsx — dev route at /dev/components/app-shell, composing a real Sidebar + Topbar (not stand-ins)
Acceptance Criteria:
  - [ ] packages/ui/src/components/domain/AppShell.tsx contains no import from apps/web or any Zustand import — grep the file
  - [ ] Sidebar and Topbar are passed only as sidebarContent/topbarContent ReactNode props, never imported directly inside AppShell.tsx
  - [ ] Main content area is the only scrollable region — confirm Sidebar and Topbar do not scroll independently when content overflows
  - [ ] ml-60/ml-14 on the main content area tracks sidebarCollapsed in sync with the actual Sidebar width passed in via sidebarContent
  - [ ] An implicit <main> landmark wraps the scrollable content area — confirm in DevTools' Accessibility pane
  - [ ] The sidebarContent slot is wrapped in <nav aria-label="Main navigation"> — confirm in rendered DOM
  - [ ] Main area background is bg-surface-raised (#f8f9fa), distinct from the white Card surfaces rendered inside it
AI Prompt:
  > Implement the AppShell Tier 3 component for packages/ui. This is the last Group A component — it composes the Sidebar (TASK-UI-004) and Topbar (TASK-UI-005) you have already built, but only through render-prop slots, never by importing them directly.
  >
  > **Props interface (canonical, J6 §3.4.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/AppShell.tsx
  > import type { ReactNode } from 'react';
  >
  > interface AppShellProps {
  >   children: ReactNode;
  >   /** Driven by apps/web useLayoutStore — passed as prop to keep packages/ui Zustand-free */
  >   sidebarCollapsed: boolean;
  >   onSidebarToggle: () => void;
  >   /** Rendered in the fixed left slot */
  >   sidebarContent: ReactNode;
  >   /** Rendered in the fixed top slot */
  >   topbarContent: ReactNode;
  > }
  > ```
  >
  > **Tier 1/2/3 dependencies:** `AppShell` composes `Sidebar` and `Topbar` (both Tier 3) exclusively through the `sidebarContent` and `topbarContent` render slots — it must not `import { Sidebar } from './Sidebar'` or `import { Topbar } from './Topbar'` anywhere in this file. This is deliberate, not an oversight: `AppShell` is a layout container that must not hardcode which navigation component fills its slots, which is what makes it test-substitutable.
  >
  > **Visual behavior:** Three fixed regions, never overlapping. Sidebar slot: `fixed left-0 top-0 h-screen z-sticky`. Topbar slot: `fixed top-0 right-0 z-sticky`, left offset matching the current sidebar width. Main content area: `overflow-y-auto min-h-screen`, top margin `mt-14` (topbar height), left margin switching `ml-60`/`ml-14` in sync with `sidebarCollapsed`. Only the main content area scrolls — sidebar and topbar never show a scrollbar. Main area background is `bg-surface-raised` (`#f8f9fa`), which provides subtle visual differentiation from the white `Card` surfaces rendered inside it.
  >
  > **ARIA:** Universal Rules (below) plus two structural requirements specific to this component: the scrollable content area renders inside an implicit `<main>` landmark; the `sidebarContent` slot is wrapped in `<nav aria-label="Main navigation">` internally by `AppShell` itself (not by the `Sidebar` component, since `Sidebar` is generic and doesn't know it's being used as the app's primary nav in this particular composition).
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — imports Zustand inside AppShell
  > import { useLayoutStore } from '@batac/web/stores/layoutStore';
  >
  > export function AppShell({ children }: { children: ReactNode }) {
  >   const collapsed = useLayoutStore(s => s.sidebarCollapsed);
  >   // ...
  > }
  > ```
  > `packages/ui` must never import from `apps/web`. Zustand is installed only under `--filter @batac/web` (confirmed `INSTALL.sh` Step 3) — importing it here would add Zustand as a peer dependency of the UI package and break the `apps/portal` consumption path planned for Phase 3.
  >
  > **Usage example to mirror in the dev route — compose your real TASK-UI-004 Sidebar and TASK-UI-005 Topbar, not placeholder divs:**
  > ```tsx
  > const [collapsed, setCollapsed] = useState(false);
  > <AppShell
  >   sidebarCollapsed={collapsed}
  >   onSidebarToggle={() => setCollapsed(c => !c)}
  >   sidebarContent={<Sidebar items={navItems} activeItemId="documents" collapsed={collapsed}
  >     onToggle={() => setCollapsed(c => !c)} currentUser={{ name: 'Gladys R. Lagura', role: 'SP Secretary' }} />}
  >   topbarContent={<Topbar breadcrumbs={[{ label: 'Home', href: '/dashboard' }]} sidebarCollapsed={collapsed}
  >     currentUser={{ name: 'Gladys R. Lagura', role: 'SP Secretary' }} />}
  > >
  >   <div className="p-6">Page content goes here.</div>
  > </AppShell>
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] No apps/web or Zustand import anywhere in AppShell.tsx
  > - [ ] Sidebar/Topbar reach AppShell only via the two slot props
  > - [ ] Only the main content area scrolls
  > - [ ] ml-60/ml-14 stays in sync with the real Sidebar's width
  > - [ ] <main> landmark present in DevTools' Accessibility pane
  > - [ ] sidebarContent wrapped in <nav aria-label="Main navigation">
  > - [ ] Main area is bg-surface-raised, visibly distinct from any Card inside it
  > A reviewer will verify each one independently.
````

---

## Group B — standalone display (no Tier 3 dependencies)

Per `A1-AGENTS.md` §6 UI-specific rule: "Group B components (standalone display) have no Tier 3 dependencies and can run in parallel with Group A." All seven below carry only `TASK-UI-001` as a formal Prerequisite. Two of the seven (`DocumentNumberBadge`, `RoutingHistoryTimeline`) have props interfaces that reference a type defined in TASK-UI-002's `domain.ts` (`NumberVariant`, `RoutingEntry`); per Section 7's self-containment requirement, the needed type is pasted directly into each of those two AI Prompts below so the task does not actually require `domain.ts` to exist yet to be executable, even though `[Inference]` a real implementation will eventually want to import the canonical type once TASK-UI-002 lands rather than keep a locally-duplicated one. This is a narrower point than `A1-AGENTS.md`'s Group C rule, which is about `STATUS_META` specifically — it is not extended into a formal Prerequisite here, consistent with the instruction's explicit statement that Group B has no Tier 3 prerequisites.

## TASK-UI-007

````
TASK-UI-007

Phase:          1
Module:         UI
Title:          Tier 3 component — DocumentNumberBadge
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/DocumentNumberBadge.tsx
  - /packages/ui/src/index.ts — uncomment the DocumentNumberBadge export line
  - /apps/web/src/pages/dev/DocumentNumberBadgePage.tsx — dev route at /dev/components/document-number-badge
Acceptance Criteria:
  - [ ] number always renders in font-mono — confirm in every context the dev route shows, with zero exceptions
  - [ ] variant="final" renders bg-primary-50 text-primary-800 border border-primary-300 border-l-2 border-l-primary-800 rounded-sm
  - [ ] variant="preliminary" renders bg-neutral-50 text-text-secondary border border-dashed border-neutral-400 rounded-sm italic
  - [ ] .touch-exempt is present on the container in both variants
  - [ ] The badge never truncates — test with a long number string in a narrow container and confirm the container wraps instead
  - [ ] Container dimensions, padding, and font size are identical between variants — only border/background/text/italic differ
  - [ ] No Tier 1 or Tier 2 import appears in this file — grep confirms pure Tailwind
AI Prompt:
  > Implement the DocumentNumberBadge Tier 3 component for packages/ui. This is a Group B standalone-display component — no Tier 3 dependencies.
  >
  > **Props interface (canonical, J6 §3.5.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/DocumentNumberBadge.tsx
  >
  > type NumberVariant = 'final' | 'preliminary'; // canonical shape — see note below
  >
  > interface DocumentNumberBadgeProps {
  >   /** Formatted document number string, e.g. "7SP 2026-001" or "Draft 7SP 2026-02" */
  >   number: string;
  >   /** Controls visual variant per DESIGN.md §6.3 Document Number Badge */
  >   variant: NumberVariant;
  >   className?: string;
  > }
  > ```
  > Note: `NumberVariant` is also defined in `packages/ui/src/types/domain.ts` once that file exists (a separate task creates it). If that file already exists in your branch, import `NumberVariant` from `'@batac/ui/types/domain'` instead of declaring the local type alias shown above — both are the identical `'final' | 'preliminary'` union, so either is correct; do not declare two different shapes.
  >
  > **Tier 1/2 dependencies:** none. This component is pure Tailwind.
  >
  > **Visual behavior:** This is the signature component of the whole design system (DESIGN.md §2) — it always renders the number in `font-mono`, in every table cell, detail view, search result, and QR overlay, with no exceptions. `variant="final"`: `bg-primary-50 text-primary-800 border border-primary-300 border-l-2 border-l-primary-800 rounded-sm` — the solid primary-800 left border signals enacted status. `variant="preliminary"`: `bg-neutral-50 text-text-secondary border border-dashed border-neutral-400 rounded-sm italic` — the dashed border and italic text signal the number and content are not yet final. The badge never truncates — if the containing cell is tight, the cell wraps, not the badge. `.touch-exempt` is always applied (this is one of only three components in the entire app permitted that class). Container: `inline-flex items-center px-2 py-0.5 font-mono text-xs font-medium touch-exempt`. Between the two variants, only border style, background, text color, and font-style change — container dimensions, padding, and font size stay structurally identical.
  >
  > **ARIA:** See the Universal Rules. No ARIA attributes affect the props interface — the number string itself is the accessible text content.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG
  > <span className="font-sans text-xs text-primary-800">7SP 2026-001</span>
  > ```
  > Using `font-sans` violates DESIGN.md §8 Rules 1 and 12. In a dense table with many document numbers, proportional characters make the fixed-width format harder to scan and compare. Monospace is a government-document identity signal here, not an aesthetic choice.
  >
  > **Usage examples to mirror in the dev route:**
  > ```tsx
  > <DocumentNumberBadge number="7SP 2026-001" variant="final" />
  > <DocumentNumberBadge number="Draft 7SP 2026-02" variant="preliminary" />
  > <DocumentNumberBadge number="SPR 2026-038" variant="final" />
  > ```
  > Also show one badge inside a narrow (120px) container with a long number string to demonstrate cell-wrap rather than badge-truncation.
  >
  > **Universal accessibility rules (F6 §2) — check each:** no focus-ring override (n/a, no interactive element here); `.touch-exempt` is correctly one of the three permitted uses; no hardcoded hex/HSL/RGB; no component-level `!important` on animation/transition; no color-only meaning (the dashed border + italic text are the non-color redundant signal for `preliminary`, confirm both are present, not just the background tint).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] font-mono on every number, no exceptions
  > - [ ] final variant classes exactly as specified
  > - [ ] preliminary variant classes exactly as specified
  > - [ ] .touch-exempt present in both variants
  > - [ ] Long number in a narrow container wraps the container, not the text
  > - [ ] Dimensions/padding/font-size identical across variants
  > - [ ] No Tier 1/2 import in the file
  > A reviewer will verify each one independently.
````

---

## TASK-UI-008

````
TASK-UI-008

Phase:          1
Module:         UI
Title:          Tier 3 component — StatCard
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/StatCard.tsx
  - /packages/ui/src/index.ts — uncomment the StatCard export line
  - /apps/web/src/pages/dev/StatCardPage.tsx — dev route at /dev/components/stat-card
Acceptance Criteria:
  - [ ] metric renders text-3xl font-bold text-text-primary — confirm this is the only text-3xl usage outside page-level headers anywhere in the diff
  - [ ] label renders text-xs font-semibold uppercase tracking-wide text-text-muted
  - [ ] trend, when omitted, renders no trend row at all (not an empty one)
  - [ ] trend.direction="up" renders text-success-500 with a Lucide TrendingUp icon; "down" renders text-danger-500 with TrendingDown
  - [ ] Card surface is always bg-white via the Tier 1 Card primitive — no className override changes the background
  - [ ] metric accepts both string and number without a type error
AI Prompt:
  > Implement the StatCard Tier 3 component for packages/ui. This is a Group B standalone-display component.
  >
  > **Props interface (canonical, J6 §3.6.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/StatCard.tsx
  >
  > interface StatCardTrend {
  >   value: number;
  >   direction: 'up' | 'down';
  >   label?: string; // e.g. "from last week"
  > }
  >
  > interface StatCardProps {
  >   metric: string | number;
  >   label: string;
  >   trend?: StatCardTrend;
  >   className?: string;
  > }
  > ```
  >
  > **Tier 1/2 dependencies:** `Card` (Tier 1) provides the `rounded-lg border border-border-default shadow-sm` surface — render as `<Card className="p-4">` rather than re-implementing card chrome.
  >
  > **Visual behavior:** The metric renders at `text-3xl font-bold text-text-primary` — the largest text in the entire data-density scale, and the only place `text-3xl` is used outside page-level headers; keep this distinction in mind so you don't reach for `text-3xl` elsewhere out of habit. The label renders at `text-xs font-semibold uppercase tracking-wide text-text-muted`. When `trend` is provided, it renders below the label: `direction="up"` uses `text-success-500` with a Lucide `TrendingUp` icon; `direction="down"` uses `text-danger-500` with `TrendingDown`. The optional `trend.label` renders as `text-xs text-text-muted` beside the trend value. Nothing inside the card has internal state — all dynamic behavior comes from prop updates in the parent.
  >
  > **ARIA:** See the Universal Rules. No ARIA attributes affect the props interface.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG
  > <StatCard metric={14} label="Pending" trend={{ value: 3, direction: 'up' }} className="bg-primary-50" />
  > ```
  > Overriding the card background via `className` to communicate a priority tier violates DESIGN.md §8 Rule 7 (color is never used decoratively). `StatCard` backgrounds are always `bg-white` via the `Card` primitive's default — use a separate badge or alert for priority signaling instead.
  >
  > **Usage examples to mirror in the dev route:**
  > ```tsx
  > <StatCard metric={14} label="Pending in Queue" trend={{ value: 3, direction: 'up', label: 'from last week' }} />
  > <StatCard metric="7SP 2026-001" label="Latest Enacted Resolution" />
  > <StatCard metric={2} label="SLA Breaches This Week" trend={{ value: 1, direction: 'down', label: 'from last week' }} />
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] metric is the only text-3xl usage outside a page header in this diff
  > - [ ] label classes exactly as specified
  > - [ ] No trend prop → no trend row rendered at all
  > - [ ] up/down trend colors and icons correct
  > - [ ] Card background stays bg-white regardless of className
  > - [ ] metric typed as string | number, both accepted without error
  > A reviewer will verify each one independently.
````

---

## TASK-UI-009

````
TASK-UI-009

Phase:          1
Module:         UI
Title:          Tier 3 component — EmptyState
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/EmptyState.tsx
  - /packages/ui/src/index.ts — uncomment the EmptyState export line
  - /apps/web/src/pages/dev/EmptyStatePage.tsx — dev route at /dev/components/empty-state
Acceptance Criteria:
  - [ ] Layout is centered: flex flex-col items-center text-center gap-4
  - [ ] icon renders h-12 w-12 text-neutral-300 with aria-hidden="true"
  - [ ] heading renders text-lg font-semibold text-text-secondary; body renders text-sm text-text-muted
  - [ ] action button, when provided, renders via the Tier 2 Button (variant="default") at mt-2; when omitted, no button renders
  - [ ] Copy in the dev route's example states is directive, never apologetic — no "sorry," no "it looks like," no passive voice
  - [ ] typecheck passes; icon prop accepts a LucideIcon component reference, not a rendered element
AI Prompt:
  > Implement the EmptyState Tier 3 component for packages/ui. This is a Group B standalone-display component.
  >
  > **Props interface (canonical, J6 §3.7.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/EmptyState.tsx
  > import type { LucideIcon } from 'lucide-react';
  >
  > interface EmptyStateAction {
  >   label: string;
  >   onClick: () => void;
  > }
  >
  > interface EmptyStateProps {
  >   icon: LucideIcon;
  >   /** Directive heading — state what is empty */
  >   heading: string;
  >   /** Directive body — state what action creates content */
  >   body: string;
  >   action?: EmptyStateAction;
  >   className?: string;
  > }
  > ```
  >
  > **Tier 1/2 dependencies:** `Button` (Tier 2) renders the optional CTA action with `variant="default"` — this component does render `Button` itself (it receives action data, `{ label, onClick }`, not a `ReactNode` slot), unlike `PageHeader`'s `actions` prop in TASK-UI-003.
  >
  > **Visual behavior:** Always centered: `flex flex-col items-center text-center gap-4`. Icon: `h-12 w-12 text-neutral-300` — large, low-contrast, purely illustrative. Heading: `text-lg font-semibold text-text-secondary`. Body: `text-sm text-text-muted`. The optional action button renders at `mt-2`. Copy must be directive, never apologetic, per DESIGN.md §8 Rule 9: the heading states what is absent, the body states what action resolves it. Nothing about the visual structure changes in any state.
  >
  > **ARIA:** See the Universal Rules. The icon receives `aria-hidden="true"` internally — it is decorative. No ARIA attributes affect the props interface.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG
  > <EmptyState icon={InboxIcon} heading="Sorry, nothing here yet!" body="It looks like there are no documents to display." />
  > ```
  > Apologetic copy ("Sorry") and passive language ("it looks like") violate DESIGN.md §8 Rule 9. Staff using this app all day need directive, actionable messages, not apologies — and omitting an action when an obvious one exists leaves the user with no path forward.
  >
  > **Usage example to mirror in the dev route (with action and without):**
  > ```tsx
  > <EmptyState icon={FileText} heading="No documents in queue"
  >   body="Upload a resolution or ordinance to begin the SP workflow."
  >   action={{ label: 'Upload Document', onClick: () => {} }} />
  >
  > <EmptyState icon={Search} heading="No results match your filters"
  >   body="Adjust the date range or document type filter to see more results." />
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Centered layout classes exactly as specified
  > - [ ] icon has aria-hidden="true" and h-12 w-12 text-neutral-300
  > - [ ] heading/body classes exactly as specified
  > - [ ] action button present/absent matches the action prop, no empty button when omitted
  > - [ ] Dev-route copy is directive, contains no apologetic phrasing
  > - [ ] icon prop typed as LucideIcon (component reference), confirmed by passing e.g. FileText, not <FileText />
  > A reviewer will verify each one independently.
````

---

## TASK-UI-010

````
TASK-UI-010

Phase:          1
Module:         UI
Title:          Tier 3 component — ScanQualityIndicator
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/ScanQualityIndicator.tsx
  - /packages/ui/src/index.ts — uncomment the ScanQualityIndicator export line
  - /apps/web/src/pages/dev/ScanQualityIndicatorPage.tsx — dev route at /dev/components/scan-quality-indicator
Acceptance Criteria:
  - [ ] score=97 derives 'excellent' (text-success-500); score=85 derives 'good' (text-info-500); score=65 derives 'fair' (text-warning-500); score=40 derives 'poor' (text-danger-500) — test all four boundary-adjacent values, including exactly 95, 94, 80, 79, 60, 59
  - [ ] showLabel=true renders the level text beside the indicator in the same color as the indicator
  - [ ] showLabel=false (or omitted) renders only the icon/dot, with full detail in a Tooltip ("Excellent — 97 / 100" format)
  - [ ] Only the color class changes between levels — confirm the DOM structure is otherwise identical across all four levels
  - [ ] .touch-exempt is present on the container — this is one of the three permitted components
  - [ ] score is the only prop driving level derivation — no level prop exists anywhere in the interface
AI Prompt:
  > Implement the ScanQualityIndicator Tier 3 component for packages/ui. This is a Group B standalone-display component.
  >
  > **Props interface (canonical, J6 §3.8.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/ScanQualityIndicator.tsx
  >
  > interface ScanQualityIndicatorProps {
  >   /** 0–100. Component derives ScanQualityLevel internally. */
  >   score: number;
  >   /** When true, renders the level label text alongside the color indicator */
  >   showLabel?: boolean;
  >   className?: string;
  > }
  > ```
  >
  > **Tier 1/2 dependencies:** `Tooltip` (Tier 1) wraps the indicator in all cases — tooltip text is the full label + score (e.g., "Excellent — 97 / 100"), used in contexts where `showLabel` is false and the indicator is icon/dot only.
  >
  > **Visual behavior:** Convert `score` to a level internally using this exact mapping — do not externalize this logic to the caller: `score >= 95 → 'excellent'`, `score >= 80 → 'good'`, `score >= 60 → 'fair'`, `score < 60 → 'poor'`. Color classes: `excellent → text-success-500`, `good → text-info-500`, `fair → text-warning-500`, `poor → text-danger-500`. When `showLabel=true`, render the label text ("Excellent"/"Good"/"Fair"/"Poor") beside the indicator in the same color. When `showLabel=false` (the default), render only the icon/dot, with full detail surfaced via the Tooltip. No structural change between levels — only the color class on the container changes.
  >
  > **ARIA:** See the Universal Rules. No ARIA attributes affect the props interface — the Tooltip provides the accessible description internally.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — derives the level outside the component
  > type QualityProps = { level: 'excellent' | 'good' | 'fair' | 'poor'; score: number };
  > ```
  > Externalizing the level derivation forces every caller to reimplement the same threshold logic, risking inconsistent boundaries across the app. The score-to-level boundaries are a design decision (DESIGN.md §6.3) that belongs inside the component, not in every consumer.
  >
  > **Usage examples to mirror in the dev route — show all four levels, both showLabel states:**
  > ```tsx
  > <ScanQualityIndicator score={97} showLabel={true} />   {/* excellent */}
  > <ScanQualityIndicator score={92} showLabel={true} />   {/* good — DESIGN.md §6.3 80–94% range */}
  > <ScanQualityIndicator score={65} showLabel={true} />   {/* fair */}
  > <ScanQualityIndicator score={48} showLabel={false} />  {/* poor, icon-only + Tooltip "Poor — 48 / 100" */}
  > ```
  > Also render score={95}, score={94}, score={80}, score={79}, score={60}, score={59} in a row labeled "boundary check" to make the threshold behavior visually verifiable.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] All four levels derive correctly, boundary values included (95/94, 80/79, 60/59)
  > - [ ] showLabel=true shows matching-color text; showLabel=false shows icon/dot + Tooltip only
  > - [ ] DOM structure identical across levels, only color class differs
  > - [ ] .touch-exempt present
  > - [ ] No level prop exists in the interface — score is the sole input
  > A reviewer will verify each one independently.
````

---

## TASK-UI-011

````
TASK-UI-011

Phase:          1
Module:         UI
Title:          Tier 3 component — SLATimer
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/SLATimer.tsx
  - /packages/ui/src/index.ts — uncomment the SLATimer export line
  - /apps/web/src/pages/dev/SLATimerPage.tsx — dev route at /dev/components/sla-timer
Acceptance Criteria:
  - [ ] elapsed < 0.8 renders on-track (bg-success-500 fill on bg-success-100 track, text-success-500); 0.8 ≤ elapsed < 1.0 renders at-risk (warning colors + pulsing amber dot beside the label); elapsed ≥ 1.0 renders breached (danger colors + animate-pulse on the entire bar)
  - [ ] Bar fill width is an inline style (the only justified inline style in this package) computed as Math.min(elapsed * 100, 100)%
  - [ ] Outer container carries role="timer", aria-label={label}, aria-live="polite" — confirm aria-live is never "assertive"
  - [ ] Inner bar carries role="progressbar", aria-valuenow clamped to 0–100, aria-valuemin="0", aria-valuemax="100" — confirm aria-valuenow does not exceed 100 even when the document is breached past its deadline
  - [ ] Remaining-time text uses date-fns formatDistance(deadlineAt, now, { locale: phLocale })
  - [ ] Manual check: render with a deadlineAt in the past (breached) and confirm aria-valuenow is still clamped to exactly 100, not a number greater than 100
  - [ ] Component is not in the Tab order (no tabindex, no interactive role on the outer container)
AI Prompt:
  > Implement the SLATimer Tier 3 component for packages/ui. This is a Group B standalone-display component. This component renders only on documents in PENDING_MAYOR or PANLALAWIGAN_REVIEW — that conditional-rendering decision belongs to the consuming view, not to this component, but keep it in mind when building the dev-route examples below.
  >
  > **Props interface (canonical, J6 §3.9.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/SLATimer.tsx
  >
  > interface SLATimerProps {
  >   /** When the SLA window expires */
  >   deadlineAt: Date;
  >   /** When the SLA clock started (document entered a time-constrained state) */
  >   startedAt: Date;
  >   /** Human-readable label becomes aria-label on the role="timer" container */
  >   label: string;
  >   className?: string;
  > }
  > ```
  >
  > **Tier 1/2 dependencies:** none. Pure Tailwind and date arithmetic.
  >
  > **Visual behavior:** Derive `SLAStatus` internally: `elapsed = (now - startedAt) / (deadlineAt - startedAt)` as a ratio. `elapsed < 0.8 → 'on-track'`; `0.8 ≤ elapsed < 1.0 → 'at-risk'`; `elapsed ≥ 1.0 → 'breached'`.
  >
  > | SLAStatus | Bar fill | Text | Extra |
  > |---|---|---|---|
  > | on-track | bg-success-500 on bg-success-100 track | text-success-500 | — |
  > | at-risk | bg-warning-500 on bg-warning-100 track | text-warning-500 | Pulsing amber dot beside the label |
  > | breached | bg-danger-500 on bg-danger-100 track | text-danger-500 | animate-pulse on the entire bar |
  >
  > Progress bar width is `Math.min(elapsed * 100, 100)%` as an inline `width` style on the fill element — this is the only justified inline style in this entire package, since a continuous percentage cannot be expressed as a static Tailwind class. Remaining-time text uses `formatDistance(deadlineAt, now, { locale: phLocale })` from date-fns.
  >
  > **ARIA (J6 §3.9.4, F6 §3.1) — this component has a real ARIA contract, follow it exactly:**
  > - Outer container: `role="timer"`, `aria-label={label}`, `aria-live="polite"` hardcoded internally — never `"assertive"`. DESIGN.md §6.3 specifically calls out that `assertive` would interrupt the user's current task on every value update, which is disruptive for a slow countdown.
  > - Inner progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`. Clamp `aria-valuenow` to the 0–100 range for ARIA purposes even when the document is breached and the true elapsed percentage exceeds 100 — `aria-valuenow` cannot legally exceed `aria-valuemax` per the ARIA spec. `[Inference — F6 §3.1]`: this clamping rule follows from the ARIA value-range constraint itself rather than from an explicit DESIGN.md sentence, but is required regardless. The visual badge and label text (e.g., "3 days overdue") carry the breach detail separately from the clamped ARIA value.
  > - This is a read-only status display: not part of the Tab order, no key bindings.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — pre-computed percentage instead of Date objects
  > interface SLATimerProps { percentElapsed: number; label: string; }
  > ```
  > Externalizing the percentage forces every consumer to recompute the same arithmetic and handle the `now` reference itself, which creates bugs when `now` is computed at render time vs. effect time. The `SLAStatus` derivation must happen inside the component, keyed off `Date` objects, so it re-derives correctly on every render with a current `now`.
  >
  > **Usage example to mirror in the dev route — show on-track, at-risk, and breached:**
  > ```tsx
  > // Mayor's 10-day review SLA — starts when transmittal letter is dispatched
  > <SLATimer startedAt={new Date('2026-06-10T08:00:00+08:00')} deadlineAt={new Date('2026-06-20T08:00:00+08:00')}
  >   label="Mayor review (10-day) — 7SP 2026-001" />
  > ```
  > Build three examples with startedAt/deadlineAt pairs chosen so elapsed lands clearly in each of the three bands relative to the current date, plus one example with deadlineAt in the past to exercise the breached + clamping behavior.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] All three SLAStatus bands render the correct fill/track/text/extra combination
  > - [ ] Bar width is the inline style, computed correctly, clamped at 100%
  > - [ ] role="timer" + aria-label + aria-live="polite" (never assertive) on the outer container
  > - [ ] role="progressbar" + all three aria-value* attributes on the inner bar, aria-valuenow clamped ≤100
  > - [ ] Remaining-time text uses formatDistance with phLocale
  > - [ ] Past-deadline example confirms aria-valuenow stays at exactly 100
  > - [ ] No tabindex, no interactive role on the outer container
  > A reviewer will verify each one independently.
````

---

## TASK-UI-012

````
TASK-UI-012

Phase:          1
Module:         UI
Title:          Tier 3 component — RoutingHistoryTimeline
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/RoutingHistoryTimeline.tsx
  - /packages/ui/src/index.ts — uncomment the RoutingHistoryTimeline export line
  - /apps/web/src/pages/dev/RoutingHistoryTimelinePage.tsx — dev route at /dev/components/routing-history-timeline
Acceptance Criteria:
  - [ ] Renders as <ol> with each entry as <li> — grep confirms no <div>-only list markup
  - [ ] Connector line (border-l-2 border-border-subtle ml-3) with overlaid dot (h-3 w-3 rounded-full -ml-[7px]) renders in the left column for every entry
  - [ ] Dot color matches action category exactly: info-500 for Transmitted/TransmittedToMayor; success-500 for SignedByMayor/VPCertified/Released/Archived/DeemedApproved; danger-500 for Vetoed/Returned/PanlalawiganOutcomeRecorded-with-adverse-outcome; neutral-400 for everything else
  - [ ] AvatarName renders at size="sm" for every entry's actor
  - [ ] Timestamp renders font-mono text-xs text-text-muted using DATE_FORMATS.displayWithTime with phLocale
  - [ ] notes, when present, renders text-xs text-text-muted mt-1 pl-11; when absent, no empty element renders
  - [ ] Entries render in the order passed (newest-first is the consumer's responsibility, not this component's)
AI Prompt:
  > Implement the RoutingHistoryTimeline Tier 3 component for packages/ui. This is a Group B standalone-display component.
  >
  > **Props interface (canonical, J6 §3.10.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/RoutingHistoryTimeline.tsx
  >
  > type RoutingAction =
  >   | 'Logged' | 'Transmitted' | 'Received' | 'FirstReadingConducted'
  >   | 'ReferredToCommittee' | 'CommitteeReportSubmitted' | 'SecondReadingConducted'
  >   | 'ThirdReadingConducted' | 'FinalNumberAssigned' | 'VPCertified'
  >   | 'TransmittedToMayor' | 'SignedByMayor' | 'Vetoed' | 'Lapsed' | 'DeemedApproved'
  >   | 'SubmittedToPanlalawigan' | 'PanlalawiganOutcomeRecorded' | 'Released' | 'Archived'
  >   | 'CertificationOfUrgencyLogged' | 'CommitteeBypassApplied' | 'OverrideVoteRecorded'
  >   | 'Docketed' | 'Repassed' | 'OrderOfBusinessScheduled';
  >
  > interface RoutingEntry {
  >   id: string;
  >   actorName: string;
  >   actorOfficeName: string;
  >   action: RoutingAction;
  >   timestamp: Date;
  >   notes?: string;
  >   fromOfficeName?: string;
  >   toOfficeName?: string;
  > }
  >
  > interface RoutingHistoryTimelineProps {
  >   entries: RoutingEntry[]; // Rendered newest-first (consumer sorts before passing)
  >   className?: string;
  > }
  > ```
  > `RoutingAction` and `RoutingEntry` are also defined in `packages/ui/src/types/domain.ts` once that file exists (a separate task creates it). If it already exists in your branch, `import type { RoutingEntry } from '@batac/ui/types/domain';` instead of declaring the local types shown above — same shape either way.
  >
  > **Tier 1/2 dependencies:** `AvatarName` (Tier 2) renders the actor avatar + name for each entry at `size="sm"` (`h-8 w-8` per DESIGN.md §6.6).
  >
  > **Visual behavior:** Each entry renders as a two-column row. Left column: a vertical connector line (`border-l-2 border-border-subtle ml-3`) with a colored dot overlaid (`h-3 w-3 rounded-full -ml-[7px]`). Right column: `AvatarName` + action label + office name + timestamp. Dot color by action category — `Transmitted`, `TransmittedToMayor` → `bg-info-500`; `SignedByMayor`, `VPCertified`, `Released`, `Archived`, `DeemedApproved` → `bg-success-500`; `Vetoed`, `Returned`, `PanlalawiganOutcomeRecorded` (when the outcome is RETURNED or VETOED) → `bg-danger-500`; everything else (`Logged`, `Received`, `FirstReadingConducted`, `Docketed`, etc.) → `bg-neutral-400`. Timestamps render `font-mono text-xs text-text-muted` using `DATE_FORMATS.displayWithTime` with `phLocale`. The optional `notes` field renders `text-xs text-text-muted mt-1 pl-11` (indented to align with the right column).
  >
  > **ARIA:** See the Universal Rules. The timeline renders as an ordered list (`<ol>`) with each entry as `<li>`. No ARIA attributes affect the props interface.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — no semantic list markup
  > <div className="flex flex-col gap-4">{entries.map(e => <div key={e.id}>{e.actorName}</div>)}</div>
  > ```
  > A routing history is an ordered sequence of events. Anonymous `<div>` elements fail WCAG 2.1 §1.3.1 (Info and Relationships) — screen readers cannot convey that these entries form a meaningful ordered list. Use `<ol>`/`<li>`.
  >
  > **Usage example to mirror in the dev route:**
  > ```tsx
  > const entries: RoutingEntry[] = [
  >   { id: 'rh-001', actorName: 'Gladys R. Lagura', actorOfficeName: 'SP Secretariat',
  >     action: 'FinalNumberAssigned', timestamp: new Date('2026-06-12T10:30:00+08:00'),
  >     notes: 'Final number 7SP 2026-001 assigned; Draft prefix removed.' },
  >   { id: 'rh-002', actorName: 'Gladys R. Lagura', actorOfficeName: 'SP Secretariat',
  >     action: 'TransmittedToMayor', timestamp: new Date('2026-06-13T09:00:00+08:00'),
  >     notes: 'Transmittal letter SPS 2026-038 dispatched. Mayor review 10-day clock started.',
  >     fromOfficeName: 'SP Secretariat', toOfficeName: 'Office of the Mayor' },
  >   { id: 'rh-003', actorName: 'Mark Christian R. Chua', actorOfficeName: 'Office of the City Mayor',
  >     action: 'SignedByMayor', timestamp: new Date('2026-06-17T14:15:00+08:00'),
  >     toOfficeName: 'SP Secretariat' },
  > ];
  > <RoutingHistoryTimeline entries={entries} />
  > ```
  > Also include one entry with action: 'Vetoed' or 'Returned' to demonstrate the danger-500 dot, and one with no notes to demonstrate the conditional rendering.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] <ol>/<li> structure, not <div> list
  > - [ ] Connector line + dot render in the left column for every entry
  > - [ ] Dot color matches the category mapping exactly for at least one example per color
  > - [ ] AvatarName at size="sm" for every entry
  > - [ ] Timestamp formatting and classes exactly as specified
  > - [ ] notes renders only when present, with correct indentation
  > - [ ] Entries render in passed order (no internal re-sorting)
  > A reviewer will verify each one independently.
````

---

## TASK-UI-013

````
TASK-UI-013

Phase:          1
Module:         UI
Title:          Tier 3 component — QRCodeDisplay [F7's open item resolved 2026-06-23 — F7 and J6 now agree]
Prerequisites:  [TASK-UI-001]
Deliverables:
  - /packages/ui/src/components/domain/QRCodeDisplay.tsx
  - /packages/ui/src/index.ts — uncomment the QRCodeDisplay export line
  - /apps/web/src/pages/dev/QRCodeDisplayPage.tsx — dev route at /dev/components/qr-code-display
Acceptance Criteria:
  - [ ] Inspect the rendered DOM (not just JSX source): the document-number <p> is a sibling of, not a descendant of, the role="img" container — this is the single most important structural check for this component
  - [ ] role="img" container carries aria-label="QR code for document {documentNumber}" exactly
  - [ ] variant="screen" renders bg-white rounded-lg border border-border-default shadow-sm p-4; variant="print" renders bg-white border border-border-strong p-2 shadow-none min-w-[200px] min-h-[200px]
  - [ ] QR image is always square at the container's full width in both variants
  - [ ] documentNumber renders font-mono text-xs font-medium text-text-primary centered below the QR image; title renders text-sm text-text-secondary centered below the number with line-clamp-2 on long titles
  - [ ] No Tier 1, Tier 2, or Tier 3 import appears in this file — confirmed by grep, consistent with J6's complete spec
  - [ ] Component is not part of the Tab order in either variant
AI Prompt:
  > Implement the QRCodeDisplay Tier 3 component for packages/ui. This is a Group B standalone-display component.
  >
  > **A note on this task's sourcing before you start:** F7 (the implementation-plans document this task list was generated from) had explicitly flagged this component's composition as an unresolved open item — whether it should render the document number via a composed `DocumentNumberBadge` (Tier 3) or as plain text. J6, the canonical per-component engineering reference, gives a complete spec with **no** Tier 1, Tier 2, or Tier 3 dependency: the document number renders as plain styled text directly inside this component, not via `DocumentNumberBadge`. **This was resolved on 2026-06-23, with human authorization: J6's spec is final, and F7's own "Open item" note and its row 11 have been edited to record the resolution** — F7 and J6 now agree, so there is nothing further to flag in this task's PR description.
  >
  > **Props interface (canonical, J6 §3.11.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/QRCodeDisplay.tsx
  >
  > interface QRCodeDisplayProps {
  >   /** UUID tracking ID from the DTS tracking record — the QR payload */
  >   trackingId: string;
  >   /** Formatted document number for display below the QR, e.g. "7SP 2026-001" */
  >   documentNumber: string;
  >   /** Document title for display below the number */
  >   title: string;
  >   /** "screen" = standard with shadow; "print" = no shadow, min 200×200px */
  >   variant?: 'screen' | 'print';
  >   className?: string;
  > }
  > ```
  >
  > **Tier 1/2/3 dependencies:** none. Pure Tailwind with an `<img>` element for the QR data URL. Do not import `DocumentNumberBadge` — render the document number as plain styled text per the Visual Behavior section below.
  >
  > **Visual behavior:** Three stacked elements: the QR image, the document number, the title. `variant="screen"` (default) wraps in `bg-white rounded-lg border border-border-default shadow-sm p-4`. `variant="print"` applies `bg-white border border-border-strong p-2 shadow-none min-w-[200px] min-h-[200px]` for guaranteed physical scanning legibility. In both variants the QR image is always square at the container's full width. The document number renders `font-mono text-xs font-medium text-text-primary` immediately below the QR image, centered. The title renders `text-sm text-text-secondary` below the number, centered, with `line-clamp-2` on long titles. No interactive states — always display-only.
  >
  > **ARIA — this is the part most likely to be implemented wrong; read carefully (J6 §3.11.4, F6 §3.3):** The QR image container carries `role="img"` and `aria-label={`QR code for document ${documentNumber}`}` (both `trackingId` and `documentNumber` are therefore required props, never optional). The document-number and title `<p>` elements must be **siblings of**, not **descendants of**, the `role="img"` container. This is the single most important structural rule: `role="img"` instructs assistive technology to flatten its entire subtree into one image and expose only the `aria-label` text — any text nested inside it, even visually positioned below the QR graphic, is excluded from the accessibility tree and a screen reader user never hears it. Structure your JSX so the `role="img"` wrapper contains only the `<img>` element, with the number/title `<p>` elements as siblings outside that wrapper, inside a shared parent.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG
  > <div>
  >   <img src={qrDataUrl} alt="" />
  >   <p>{documentNumber}</p>
  > </div>
  > ```
  > An empty `alt=""` marks the image decorative, but the QR code is this component's primary content. Screen reader users need to know this is a QR code for a specific document. Use `role="img"` on the container with the full `aria-label`, not an empty `alt` on a bare `<img>`.
  >
  > **Usage examples to mirror in the dev route — both variants:**
  > ```tsx
  > <QRCodeDisplay trackingId="dts-2026-00147" documentNumber="7SP 2026-001"
  >   title="An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac"
  >   variant="screen" />
  >
  > <QRCodeDisplay trackingId="dts-2026-00147" documentNumber="7SP 2026-001"
  >   title="Solid Waste Management Ordinance" variant="print" />
  > ```
  > Include the long-title example above specifically to verify line-clamp-2 behavior.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Document-number <p> is a DOM sibling of the role="img" container, not nested inside it — inspect rendered DOM, not JSX
  > - [ ] aria-label exact format: "QR code for document {documentNumber}"
  > - [ ] screen/print variant classes exactly as specified
  > - [ ] QR image always square, full container width
  > - [ ] Number/title text classes and line-clamp-2 confirmed with the long-title example
  > - [ ] No Tier 1/2/3 import in this file
  > - [ ] Not part of the Tab order
  > A reviewer will verify each one independently.
````

---

## Group C — require J6 types (CommitteeReferralBlock, StatusBadge, WorkflowStepIndicator)

Per `A1-AGENTS.md` §6 UI-specific rule: "Group C components... require J6 types — their tasks must list the J6-generation task as a prerequisite." All three below carry `TASK-UI-002` (the J6 type/`STATUS_META` generation task) as a formal Prerequisite, in addition to `TASK-UI-001`.

## TASK-UI-014

````
TASK-UI-014

Phase:          1
Module:         UI
Title:          Tier 3 component — CommitteeReferralBlock
Prerequisites:  [TASK-UI-001, TASK-UI-002]
Deliverables:
  - /packages/ui/src/components/domain/CommitteeReferralBlock.tsx
  - /packages/ui/src/index.ts — uncomment the CommitteeReferralBlock export line
  - /apps/web/src/pages/dev/CommitteeReferralBlockPage.tsx — dev route at /dev/components/committee-referral-block
Acceptance Criteria:
  - [ ] Renders as <ul>/<li>, one <li> per referral
  - [ ] status="SUBMITTED" renders bg-success-100 text-success-900; "PENDING" renders bg-warning-100 text-warning-900; "ABSENT_NOT_HEARD" renders bg-neutral-100 text-neutral-700
  - [ ] AvatarName + submittedAt timestamp render only when submittedBy is present; an ABSENT_NOT_HEARD entry shows neither
  - [ ] Timestamp uses DATE_FORMATS.displayWithTime
  - [ ] Committee name renders text-sm font-medium text-text-primary in a flex-1 left column
  - [ ] No inline style={{ backgroundColor: ... }} anywhere in the file — grep confirms
  - [ ] import type { CommitteeReferral } from '@batac/ui/types/domain' resolves correctly (depends on TASK-UI-002 having merged)
AI Prompt:
  > Implement the CommitteeReferralBlock Tier 3 component for packages/ui. This is a Group C component — it requires the canonical domain types from TASK-UI-002, which must be merged before this task can typecheck.
  >
  > **Props interface (canonical, J6 §3.12.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/CommitteeReferralBlock.tsx
  > import type { CommitteeReferral } from '@batac/ui/types/domain';
  >
  > interface CommitteeReferralBlockProps {
  >   referrals: CommitteeReferral[];
  >   className?: string;
  > }
  > ```
  > `CommitteeReferral` (from `@batac/ui/types/domain`, created by TASK-UI-002) has this shape: `{ id: string; committeeName: string; status: 'SUBMITTED' | 'PENDING' | 'ABSENT_NOT_HEARD'; submittedBy?: string; submittedAt?: Date; }`.
  >
  > **Tier 1/2 dependencies:** `Badge` (Tier 1) renders the status chip per committee entry — `SUBMITTED` in `bg-success-100 text-success-900`, `PENDING` in `bg-warning-100 text-warning-900`, `ABSENT_NOT_HEARD` in `bg-neutral-100 text-neutral-700`. `AvatarName` (Tier 2) renders the `submittedBy` name at `size="sm"` when that field is present.
  >
  > **Visual behavior:** Each `CommitteeReferral` renders as a horizontal row: committee name in `text-sm font-medium text-text-primary` (left, `flex-1`), the status `Badge` chip, then an optional `AvatarName` + `submittedAt` timestamp (right). The timestamp renders via `DATE_FORMATS.displayWithTime`. `ABSENT_NOT_HEARD` is the only status where `submittedBy`/`submittedAt` are always absent — do not render an empty avatar or timestamp slot for that status. No interactive states — this is a display block.
  >
  > **ARIA:** See the Universal Rules. Renders as `<ul>`/`<li>`. No ARIA attributes affect the props interface.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG
  > <span style={{ backgroundColor: '#d1fae5', color: '#064e3b' }}>SUBMITTED</span>
  > ```
  > Hardcoded hex via inline style violates DESIGN.md §8 Rule 2 and the Tier 3 construction rule. If the `success-100` token value changes in `globals.css`, an inline style silently diverges from the design system. Use `bg-success-100 text-success-900` classes exclusively.
  >
  > **Usage example to mirror in the dev route — include all three statuses:**
  > ```tsx
  > const referrals: CommitteeReferral[] = [
  >   { id: 'cr-001', committeeName: 'Committee on Laws, Rules, Ethics & Privileges', status: 'SUBMITTED',
  >     submittedBy: 'Hon. Juan Paulo P. Flojo', submittedAt: new Date('2026-06-10T15:00:00+08:00') },
  >   { id: 'cr-002', committeeName: 'Committee on Environment', status: 'PENDING' },
  >   { id: 'cr-003', committeeName: 'Committee on Appropriations', status: 'ABSENT_NOT_HEARD' },
  > ];
  > <CommitteeReferralBlock referrals={referrals} />
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] <ul>/<li> structure
  > - [ ] All three status chip colors correct
  > - [ ] AvatarName + timestamp present only when submittedBy is present
  > - [ ] Timestamp format correct
  > - [ ] Committee name layout/classes correct
  > - [ ] No inline backgroundColor style anywhere
  > - [ ] CommitteeReferral import resolves (TASK-UI-002 merged)
  > A reviewer will verify each one independently.
````

---

## TASK-UI-015

````
TASK-UI-015

Phase:          1
Module:         UI
Title:          Tier 3 component — StatusBadge
Prerequisites:  [TASK-UI-001, TASK-UI-002]
Deliverables:
  - /packages/ui/src/components/domain/StatusBadge.tsx
  - /packages/ui/src/index.ts — uncomment the StatusBadge export line
  - /apps/web/src/pages/dev/StatusBadgePage.tsx — dev route at /dev/components/status-badge, showing all 26 DocumentState values
Acceptance Criteria:
  - [ ] All 26 DocumentState values render without error in the dev route — one StatusBadge per state, in the same order as the DocumentState union
  - [ ] state="DEEMED_APPROVED" renders bg-success-100 text-success-900 border-l-2 border-l-success-300 border-dashed italic; state="LAPSED" renders italic without border-dashed; state="CANCELLED" renders line-through
  - [ ] Base classes always present regardless of state: inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium touch-exempt
  - [ ] aria-label equals STATUS_META[state].label exactly, for at least three spot-checked states
  - [ ] No CVA variant enumeration drives the state-specific colors — confirm via code review that bg/text/borderLeft/borderStyle/textStyle come from STATUS_META at render time, applied with cn(), not from a compile-time CVA variants object
  - [ ] grep confirms zero inline style={{ backgroundColor }} or hardcoded hex in this file
AI Prompt:
  > Implement the StatusBadge Tier 3 component for packages/ui. This is a Group C component — it requires both the canonical DocumentState type and the STATUS_META constant from TASK-UI-002, which must be merged before this task can typecheck or render correctly.
  >
  > **Props interface (canonical, J6 §3.13.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/StatusBadge.tsx
  > import type { DocumentState } from '@batac/ui/types/domain';
  > import { STATUS_META } from '@batac/ui/lib/status-meta';
  >
  > interface StatusBadgeProps {
  >   state: DocumentState;
  >   className?: string;
  > }
  > ```
  > `DocumentState` (created by TASK-UI-002) is a 26-member string union covering the full document lifecycle — core states (DRAFT, SUBMITTED, IN_WORKFLOW, PENDING_APPROVAL, COMPLETED, RELEASED, ARCHIVED, DISPOSED, CANCELLED), reading/workflow states (FIRST_READING, SECOND_READING, THIRD_READING, IN_COMMITTEE, PENDING_MAYOR, VETOED, OVERRIDE_PENDING, LAPSED), Panlalawigan outcome states (PANLALAWIGAN_REVIEW, VALID, VALID_IN_PART, RETURNED, DEEMED_APPROVED), and citizen-complaint states (PENDING_HEARING, RECEIVED_SEEN, DISMISSED, RESOLVED). Do not redeclare this union locally — import it from `@batac/ui/types/domain`, the same file TASK-UI-002 created, so this component always stays in sync with the canonical type.
  >
  > **Tier 1/2 dependencies:** none. This component is CVA + pure Tailwind — and specifically **not** derived from the shadcn `Badge` primitive, because it needs its own configuration encoding the full 26-state color map from `STATUS_META` rather than a small fixed set of CVA variants.
  >
  > **Visual behavior:** Single responsibility — map a `DocumentState` to a visual chip using `STATUS_META`. Base classes always present, regardless of state: `inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium touch-exempt`. Then apply the state-specific values looked up from `STATUS_META[state]`: `bg`, `text`, `borderLeft` directly as classes; add `border-dashed` when `STATUS_META[state].borderStyle === 'dashed'`; add `italic` when `textStyle === 'italic'`, or `line-through` when `textStyle === 'line-through'`. Apply these conditionally with `cn()`, not via CVA variants — CVA variants require compile-time enumeration, while `STATUS_META` entries supply the class strings dynamically at render time, so a `cn(baseClasses, meta.bg, meta.text, meta.borderLeft, meta.borderStyle === 'dashed' && 'border-dashed', meta.textStyle === 'italic' && 'italic', meta.textStyle === 'line-through' && 'line-through')` pattern is the correct shape. A document always has exactly one active `StatusBadge` per DESIGN.md §6.3 — this component itself doesn't enforce that (it just renders whatever single `state` it's given), but don't build any internal logic that assumes more than one badge could apply.
  >
  > **Two example STATUS_META entries, for illustration of the exact shape you're consuming (the full 26-entry constant lives in `packages/ui/src/lib/status-meta.ts`, created by TASK-UI-002 — import it, do not recreate it here):**
  > ```typescript
  > // From STATUS_META, for reference only — do not paste this into StatusBadge.tsx:
  > DEEMED_APPROVED: { label: 'Deemed Approved', bg: 'bg-success-100', text: 'text-success-900', borderLeft: 'border-l-2 border-l-success-300', borderStyle: 'dashed', textStyle: 'italic' },
  > LAPSED: { label: 'Lapsed', bg: 'bg-neutral-100', text: 'text-neutral-700', borderLeft: 'border-l-2 border-l-neutral-400', borderStyle: 'solid', textStyle: 'italic' },
  > ```
  > Note from these two that `italic` and `border-dashed` are independent flags — `DEEMED_APPROVED` has both, `LAPSED` has only `italic`. Do not assume one implies the other.
  >
  > **ARIA:** See the Universal Rules. The badge receives `aria-label={STATUS_META[state].label}` internally. No ARIA attributes affect the props interface.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG
  > <span style={{ backgroundColor: '#d1fae5', color: '#064e3b' }}>Deemed Approved</span>
  > ```
  > Inline hex styling violates DESIGN.md §8 Rule 2 and the Tier 3 construction rule. When the `success-100` token value changes in `globals.css`, the badge silently diverges. Only Tailwind utility classes from the `@theme` block are allowed.
  >
  > **Usage examples to mirror in the dev route — show all 26 states, plus these three explicitly called out:**
  > ```tsx
  > <StatusBadge state="PANLALAWIGAN_REVIEW" />  {/* bg-warning-100 text-warning-900 border-l-2 border-l-warning-500 — "Panlalawigan Review" */}
  > <StatusBadge state="DEEMED_APPROVED" />       {/* bg-success-100 text-success-900 border-l-2 border-l-success-300 border-dashed italic — "Deemed Approved" */}
  > <StatusBadge state="LAPSED" />                {/* bg-neutral-100 text-neutral-700 border-l-2 border-l-neutral-400 italic — "Lapsed" */}
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] All 26 states render without error
  > - [ ] DEEMED_APPROVED/LAPSED/CANCELLED render exactly as specified above
  > - [ ] Base classes present on every state
  > - [ ] aria-label matches STATUS_META[state].label for at least three spot-checked states
  > - [ ] Colors come from STATUS_META at render time via cn(), not a CVA variants object
  > - [ ] No inline backgroundColor or hardcoded hex anywhere in the file
  > A reviewer will verify each one independently.
````

---

## TASK-UI-016

````
TASK-UI-016

Phase:          1
Module:         UI
Title:          Tier 3 component — WorkflowStepIndicator [pending/error step ARIA confirmed 2026-06-23 — see F6 §3.2]
Prerequisites:  [TASK-UI-001, TASK-UI-002]
Deliverables:
  - /packages/ui/src/components/domain/WorkflowStepIndicator.tsx
  - /packages/ui/src/index.ts — uncomment the WorkflowStepIndicator export line
  - /apps/web/src/pages/dev/WorkflowStepIndicatorPage.tsx — dev route at /dev/components/workflow-step-indicator, both orientations
Acceptance Criteria:
  - [ ] Renders as <ol aria-label="Document workflow steps"> with each step as <li> — grep confirms, not <div>/<div>
  - [ ] aria-current="step" present on exactly one <li> (the step matching currentStepId)
  - [ ] A completed step's <li> carries aria-label="{step name} — completed" — confirm this replaces, not supplements, the visible text as the accessible name
  - [ ] A skipped step's <li> carries aria-disabled="true"
  - [ ] An error step's <li> carries aria-label="{step name} — error" (confirmed requirement as of 2026-06-23, not a placeholder); a pending step's <li> carries no special ARIA attribute beyond its position in the list
  - [ ] Ring fill/text/connector classes match the five-state table exactly: completed (success-500/white/success-500), active (primary-800/white/neutral-200), pending (neutral-200/neutral-500/neutral-200), skipped (neutral-100/neutral-400/neutral-200 dashed), error (danger-500/white/neutral-200)
  - [ ] Horizontal mode (≥768px) arranges steps left-to-right with flex-1 connectors; vertical mode (<768px or orientation="vertical") stacks with a left-side connecting line — same DOM structure in both, CSS-only difference
  - [ ] Any step with a Tooltip has a focusable trigger element (a <button>, or an element with explicit tabindex="0") — not a bare non-interactive node
  - [ ] assigneeName renders text-xs text-text-muted below the label only when state === 'active'
AI Prompt:
  > Implement the WorkflowStepIndicator Tier 3 component for packages/ui. This is a Group C component — it requires the canonical WorkflowStep type from TASK-UI-002, which must be merged before this task can typecheck.
  >
  > **Props interface (canonical, J6 §3.14.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/WorkflowStepIndicator.tsx
  > import type { WorkflowStep } from '@batac/ui/types/domain';
  >
  > interface WorkflowStepIndicatorProps {
  >   steps: WorkflowStep[];
  >   currentStepId: string;
  >   orientation?: 'horizontal' | 'vertical'; // defaults to 'horizontal'; responsive breakpoint applies regardless
  >   className?: string;
  > }
  > ```
  > `WorkflowStep` (from `@batac/ui/types/domain`) has this shape: `{ id: string; label: string; state: 'completed' | 'active' | 'pending' | 'skipped' | 'error'; completedAt?: Date; assigneeName?: string; tooltip?: string; }`.
  >
  > **Tier 1/2 dependencies:** `Tooltip` (Tier 1) wraps each step node. Tooltip content is `step.tooltip` when provided, otherwise auto-generated from `step.label + (completedAt ? " — completed " + format(completedAt, DATE_FORMATS.display, { locale: phLocale }) : "")`.
  >
  > **Visual behavior:** Renders as an `<ol>` of step nodes connected by lines. Horizontal mode (≥768px): steps arranged left-to-right with `flex-1` connector lines between them. Vertical mode (<768px, or `orientation="vertical"` explicitly): steps stack with a connecting line down the left side. Both modes render the same DOM structure — only CSS changes between them; do not branch the markup itself.
  >
  > Step node ring classes per state:
  >
  > | State | Ring fill | Ring text | Connector to next |
  > |---|---|---|---|
  > | completed | bg-success-500 | text-white | bg-success-500 |
  > | active | bg-primary-800 | text-white | bg-neutral-200 |
  > | pending | bg-neutral-200 | text-neutral-500 | bg-neutral-200 |
  > | skipped | bg-neutral-100 | text-neutral-400 | bg-neutral-200 (dashed border on ring) |
  > | error | bg-danger-500 | text-white | bg-neutral-200 |
  >
  > Step labels: `font-semibold` on the active step only; `text-text-muted` on pending/skipped; `text-text-primary` on completed and active. `assigneeName`, when present, renders `text-xs text-text-muted` below the label, but only when `state === 'active'`. Step nodes are `<li>` elements; the `<ol>` carries `aria-label="Document workflow steps"`.
  >
  > **ARIA — read this section carefully; the pending/error step treatment was unresolved in the source material as of the original UI module pass but is now a confirmed decision (J6 §3.14.4, F6 §3.2):**
  > - The `<ol>` is `aria-label="Document workflow steps"`; each step is an `<li>`.
  > - The active step's `<li>` carries `aria-current="step"`, driven internally by comparing each step's `id` to `currentStepId` — this is not a separate boolean prop.
  > - A **completed** step's `<li>` carries `aria-label="{step name} — completed"` — this `aria-label` **replaces** the visible text as the accessible name; it is not additive on top of the visible label.
  > - A **skipped** step's `<li>` carries `aria-disabled="true"`.
  > - **Pending and error steps — confirmed 2026-06-23, with human authorization (was previously unresolved in this document).** DESIGN.md specifies the visual ring treatment for both (`neutral-200` ring for pending, `danger-500` ring for error) but does not specify ARIA attributes for either, which this prompt had originally transmitted as an open question rather than inventing an answer. **Confirmed requirement, F6 §3.2:** pending steps carry no special ARIA attribute beyond their position in the list — no `aria-current`, no completed-style `aria-label` — since that position, combined with the ring treatment, already communicates "not yet reached." Error steps carry `aria-label="{step name} — error"`, mirroring the completed-step pattern for consistency. Implement both as confirmed requirements, not as placeholders — there is nothing left to flag in the PR description for this item.
  > - If a step renders the optional `Tooltip`, that step's trigger element must itself be focusable — Radix `Tooltip` shows on focus as well as hover, but only when the wrapped trigger is a native focusable element (a `<button>`) or carries an explicit `tabindex="0"`. A non-focusable `<li>` with a tooltip attached to a non-interactive child makes the tooltip mouse-only, which fails WCAG 1.4.13.
  >
  > **Keyboard contract:** This is a read-only progress visualization, not an interactive control — not part of the Tab order and no key bindings of its own, except that any step rendering a `Tooltip` must be reachable via Tab so the tooltip is exposed to keyboard users.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — no semantic list markup, inline ternary instead of the state table
  > <div className="flex gap-2">
  >   {steps.map(step => (
  >     <div key={step.id} className="flex flex-col items-center">
  >       <div className={`h-8 w-8 rounded-full ${step.state === 'completed' ? 'bg-success-500' : 'bg-neutral-200'}`} />
  >       <span>{step.label}</span>
  >     </div>
  >   ))}
  > </div>
  > ```
  > Using `<div>`/`<div>` instead of `<ol>`/`<li>` is the highest-probability mistake here. WCAG 2.1 §1.3.1 requires list semantics for a sequential step indicator. Screen readers skip unlabelled `<div>` sequences without conveying the ordered relationship between steps.
  >
  > **Usage example to mirror in the dev route (D2 Diagram 1 standard SP Resolution path — 7SP 2026-001 at VP Certification):**
  > ```tsx
  > const steps: WorkflowStep[] = [
  >   { id: 'intake_logging', label: 'Intake Logging', state: 'completed', completedAt: new Date('2026-05-06T09:00:00+08:00') },
  >   { id: 'order_of_business_scheduling', label: 'Order of Business Scheduling', state: 'completed', completedAt: new Date('2026-05-08T16:00:00+08:00') },
  >   { id: 'first_reading', label: 'First Reading', state: 'completed', completedAt: new Date('2026-05-13T10:00:00+08:00'), tooltip: 'Referred to Committee on Laws and Committee on Environment' },
  >   { id: 'committee_referral', label: 'Committee Referral', state: 'completed', completedAt: new Date('2026-06-05T14:00:00+08:00') },
  >   { id: 'second_reading_vote', label: 'Second Reading', state: 'completed', completedAt: new Date('2026-06-10T11:30:00+08:00') },
  >   { id: 'final_number_assignment', label: 'Final Number Assignment', state: 'completed', completedAt: new Date('2026-06-12T10:30:00+08:00'), tooltip: '7SP 2026-001 assigned' },
  >   { id: 'vp_certification', label: 'VP Certification', state: 'active', assigneeName: 'Hon. Albert D. Chua' },
  >   { id: 'transmittal_letter_to_mayor', label: 'Transmittal to Mayor', state: 'pending' },
  >   { id: 'mayor_review', label: 'Mayor Review', state: 'pending' },
  >   { id: 'docketing', label: 'Docketing', state: 'pending' },
  > ];
  > <WorkflowStepIndicator steps={steps} currentStepId="vp_certification" orientation="horizontal" />
  > ```
  > Also build a second dev-route example containing a `skipped` step and an `error` step (neither appears in the standard-path example above) specifically to exercise those two ring treatments and confirm the now-decided error-step `aria-label` treatment noted above. Show both `orientation="horizontal"` and `orientation="vertical"` for at least one example.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] <ol aria-label="Document workflow steps"> / <li> structure
  > - [ ] aria-current="step" on exactly one step
  > - [ ] Completed step aria-label replaces visible text correctly
  > - [ ] Skipped step has aria-disabled="true"; error step has aria-label="{step name} — error"; pending step has no special attribute beyond list position
  > - [ ] All five ring-state class combinations correct
  > - [ ] Horizontal/vertical share DOM structure, differ only in CSS
  > - [ ] Every Tooltip-bearing step has a focusable trigger
  > - [ ] assigneeName shows only on the active step
  > - [ ] Error-state and pending-state ARIA treatment matches the confirmed requirement above (no longer an open question as of 2026-06-23)
  > A reviewer will verify each one independently.
````

---

## Group D — composed (DocumentPreviewCard, OrderOfBusinessRow)

Per `A1-AGENTS.md` §6 UI-specific rule: "Group D components... depend on specific Group B and C components — encode those as prerequisites, not just 'Group B done.'" Both tasks below list the exact upstream Tier 3 task IDs they compose, per J6's component-level dependency lists (not F7's summary table, where the two diverge — see the reconciliation notes above and the per-task note repeated below).

## TASK-UI-017

````
TASK-UI-017

Phase:          1
Module:         UI
Title:          Tier 3 component — DocumentPreviewCard
Prerequisites:  [TASK-UI-001, TASK-UI-002, TASK-UI-007 (DocumentNumberBadge), TASK-UI-011 (SLATimer), TASK-UI-015 (StatusBadge)]
Deliverables:
  - /packages/ui/src/components/domain/DocumentPreviewCard.tsx
  - /packages/ui/src/index.ts — uncomment the DocumentPreviewCard export line
  - /apps/web/src/pages/dev/DocumentPreviewCardPage.tsx — dev route at /dev/components/document-preview-card
Acceptance Criteria:
  - [ ] Content order top-to-bottom: thumbnail, DocumentNumberBadge + StatusBadge row, title (line-clamp-2), last-action timestamp, optional embedded SLATimer
  - [ ] SLATimer renders only when slaDeadlineAt AND slaStartedAt are both present AND documentState is PENDING_MAYOR or PANLALAWIGAN_REVIEW — confirm it does not render for a document in, e.g., COMPLETED or ARCHIVED even if SLA fields happen to be present
  - [ ] isLoading=true renders Skeleton placeholders in the exact same positions as the real content, not a generic spinner
  - [ ] onClick provided → role="button" tabIndex={0} with onKeyDown handling Enter and Space; onClick omitted → no button role, no tabIndex
  - [ ] isLoading=true → aria-busy="true" on the container
  - [ ] Hover transitions shadow-sm → shadow-md only when onClick is provided (cursor-pointer also conditional on onClick)
  - [ ] All Date fields (lastActionAt, slaDeadlineAt, slaStartedAt) are real Date objects in the dev-route fixture data, never string literals cast with as any
AI Prompt:
  > Implement the DocumentPreviewCard Tier 3 component for packages/ui. This is a Group D component composing three upstream Tier 3 components you have already built: DocumentNumberBadge (TASK-UI-007), SLATimer (TASK-UI-011), and StatusBadge (TASK-UI-015).
  >
  > **Props interface (canonical, J6 §3.15.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/DocumentPreviewCard.tsx
  > import type { DocumentPreview } from '@batac/ui/types/domain';
  >
  > interface DocumentPreviewCardProps {
  >   document: DocumentPreview;
  >   onClick?: () => void;
  >   /** When true, renders Skeleton placeholders instead of content */
  >   isLoading?: boolean;
  >   className?: string;
  > }
  > ```
  > `DocumentPreview` (from `@batac/ui/types/domain`) has this shape: `{ id: string; documentNumber: string; numberVariant: NumberVariant; title: string; documentState: DocumentState; lastActionAt: Date; slaDeadlineAt?: Date; slaStartedAt?: Date; thumbnailUrl?: string; }`.
  >
  > **Tier 1/2/3 dependencies:** `Card` (Tier 1) provides the surface (`bg-white rounded-lg border border-border-default shadow-sm`). `Skeleton` (Tier 1) renders placeholders when `isLoading=true`: thumbnail as `w-full aspect-[3/4] rounded`, number badge as `w-20 h-5`, title as `w-full h-4` and `w-3/4 h-4`, status badge as `w-24 h-5`, timestamp as `w-28 h-3`. `DocumentNumberBadge` (Tier 3, from TASK-UI-007) renders the number with the correct `numberVariant`. `StatusBadge` (Tier 3, from TASK-UI-015) renders the `documentState` chip. `SLATimer` (Tier 3, from TASK-UI-011) renders conditionally — see Visual Behavior below.
  >
  > **Visual behavior:** The card is `cursor-pointer` only when `onClick` is provided. Hover transitions `shadow-sm → shadow-md` (`transition-shadow duration-base`), also only when interactive. Content top-to-bottom: thumbnail (`w-full aspect-[3/4] bg-neutral-100 rounded object-cover mb-3`); then `DocumentNumberBadge` + `StatusBadge` on the same row; then title (`text-sm font-medium text-text-primary line-clamp-2 mt-1`); then the last-action timestamp (`text-xs text-text-muted mt-1`). If `slaDeadlineAt` and `slaStartedAt` are both present **and** `documentState` is `PENDING_MAYOR` or `PANLALAWIGAN_REVIEW`, render an embedded `SLATimer` below the timestamp — this state check belongs inside `DocumentPreviewCard` itself (it is the one place in this task list where a Tier 3 component does its own state-gating, rather than leaving it to the consuming page, because the SLA fields and the state live on the same `document` prop this component already receives). When `isLoading=true`, render the `Skeleton` placeholders in the exact same positions: thumbnail skeleton first, then two inline skeletons for the badge row, then a two-line title skeleton, then a timestamp skeleton.
  >
  > **ARIA:** See the Universal Rules. When `onClick` is provided, the card container receives `role="button"` and `tabIndex={0}`, with `onKeyDown` handling `Enter` and `Space` to fire the same action as a click. When `isLoading=true`, the container receives `aria-busy="true"`.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — string date cast with as any
  > const doc: DocumentPreview = { id: 'doc-001', lastActionAt: '2026-06-13' as any, /* ... */ };
  > ```
  > Every `Date` field in the domain type system is a real `Date` object, never a string. `as any` silently bypasses type checking and causes `date-fns format()` to produce `Invalid Date`. Server JSON responses use ISO strings — convert with `new Date(isoString)` at the API boundary, not inside this component.
  >
  > **Usage example to mirror in the dev route — interactive, loading, and with/without SLATimer:**
  > ```tsx
  > const doc: DocumentPreview = {
  >   id: 'doc-001', documentNumber: '7SP 2026-001', numberVariant: 'final',
  >   title: 'An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac, Ilocos Norte, Appropriating Funds Therefor, and for Other Purposes.',
  >   documentState: 'PANLALAWIGAN_REVIEW', lastActionAt: new Date('2026-06-13T09:00:00+08:00'),
  >   slaDeadlineAt: new Date('2026-07-13T09:00:00+08:00'), slaStartedAt: new Date('2026-06-13T09:00:00+08:00'),
  >   thumbnailUrl: '/api/documents/doc-001/thumbnail',
  > };
  > <DocumentPreviewCard document={doc} onClick={() => navigate('/documents/doc-001')} />
  > <DocumentPreviewCard document={doc} isLoading={true} />
  > ```
  > Also include one document in a non-SLA state (e.g., `documentState: 'ARCHIVED'`) with `slaDeadlineAt`/`slaStartedAt` still populated, specifically to verify the SLATimer correctly does NOT render despite the fields being present.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Content order matches the spec exactly
  > - [ ] SLATimer renders only under both conditions (SLA fields present AND correct state) — verify the negative case explicitly
  > - [ ] Skeleton placeholders match real-content positions exactly
  > - [ ] role="button"/tabIndex/onKeyDown present only with onClick; absent without it
  > - [ ] aria-busy="true" only when isLoading
  > - [ ] Hover shadow transition and cursor-pointer only when interactive
  > - [ ] All Date fields are real Date objects in your fixture data
  > A reviewer will verify each one independently.
````

---

## TASK-UI-018

````
TASK-UI-018

Phase:          1
Module:         UI
Title:          Tier 3 component — OrderOfBusinessRow [F7 corrected to match J6, 2026-06-23 — CommitteeReferralBlock not composed]
Prerequisites:  [TASK-UI-001, TASK-UI-002, TASK-UI-007 (DocumentNumberBadge), TASK-UI-015 (StatusBadge)]
Deliverables:
  - /packages/ui/src/components/domain/OrderOfBusinessRow.tsx
  - /packages/ui/src/index.ts — uncomment the OrderOfBusinessRow export line
  - /apps/web/src/pages/dev/OrderOfBusinessRowPage.tsx — dev route at /dev/components/order-of-business-row
Acceptance Criteria:
  - [ ] Left-to-right order matches the eight-item layout exactly (see AI Prompt) — confirm with a visual diff against the spec, not just "looks about right"
  - [ ] isMissingReport=true → row background bg-danger-50, applied via cn() conditional class, never an inline style attribute
  - [ ] isCertifiedUrgent=true → certified-urgent chip renders prepended to the agenda-number column; isCertifiedUrgent=false → no chip, no empty space reserved for it
  - [ ] Committee referral chips render as one Badge (Tier 1) per entry in committeeReferrals, with per-status coloring matching CommitteeReferralBlock's own color mapping (SUBMITTED → success, PENDING → warning, ABSENT_NOT_HEARD → neutral) — confirm this component does NOT import or render CommitteeReferralBlock itself
  - [ ] Flag icon (isMissingReport=true) carries role="img" and aria-label="Missing committee report", with a Tooltip showing the same text
  - [ ] Title truncates with truncate (single-line), not line-clamp-2 — this differs from DocumentPreviewCard's two-line title treatment, confirm you used the right one
  - [ ] If the row itself is a click target, Enter and Space both activate it, and no nested interactive element (Flag tooltip trigger, etc.) double-fires the row's own handler
AI Prompt:
  > Implement the OrderOfBusinessRow Tier 3 component for packages/ui. This is a Group D component.
  >
  > **A conflict that existed when this task was first written, now resolved (recorded in this module's reconciliation notes above, item 3):** F7's per-component fill-in table had listed `CommitteeReferralBlock` (Tier 3) as a composed dependency of this component. J6 §3.16 — both the explicit Tier 1/2 dependency list and the eight-item visual-behavior layout description — says this component renders its own inline `Badge` (Tier 1) chips for committee referrals, one per entry, and does **not** mention `CommitteeReferralBlock` anywhere in its spec. **Resolved 2026-06-23, with human authorization: F7's row 16 has been corrected to match J6.** Do not import or render `CommitteeReferralBlock` inside `OrderOfBusinessRow`. The two components serve different display densities — `CommitteeReferralBlock` shows a full vertical list with avatars and timestamps (appropriate for a document detail view); `OrderOfBusinessRow` shows compact inline chips (appropriate for a dense agenda table row) — and the Plan 2 integration page (TASK-UI-019) shows them adjacent, not nested, which is the intended composition.
  >
  > **Props interface (canonical, J6 §3.16.1) — implement exactly:**
  > ```typescript
  > // packages/ui/src/components/domain/OrderOfBusinessRow.tsx
  > import type { OrderOfBusinessItem } from '@batac/ui/types/domain';
  >
  > interface OrderOfBusinessRowProps {
  >   item: OrderOfBusinessItem;
  >   className?: string;
  > }
  > ```
  > `OrderOfBusinessItem` (from `@batac/ui/types/domain`) has this shape: `{ agendaNumber: number; documentNumber: string; numberVariant: NumberVariant; title: string; documentState: DocumentState; committeeReferrals: CommitteeReferral[]; isCertifiedUrgent: boolean; isMissingReport: boolean; scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD'; }`.
  >
  > **Tier 1/2/3 dependencies:** `Badge` (Tier 1) renders the `scheduledReadingType` chip (e.g., "1st Reading") and each committee-name chip from `committeeReferrals` — per the conflict resolution above, as raw `Badge` elements, not via `CommitteeReferralBlock`. `Tooltip` (Tier 1) wraps the Lucide `Flag` icon when `isMissingReport=true`, with tooltip text "Missing committee report" per DESIGN.md §6.6. `DocumentNumberBadge` (Tier 3, from TASK-UI-007) renders the document number with the correct `numberVariant`. `StatusBadge` (Tier 3, from TASK-UI-015) renders the `documentState`.
  >
  > **Visual behavior:** The row is a `flex items-center gap-3` container. When `isMissingReport=true`, the row background is `bg-danger-50` — the only case in this component where a row background changes, sourced from `globals.css`'s `@theme` block (`danger-50` = `#fef2f2`), applied via a conditional class (`cn('flex items-center gap-3', item.isMissingReport && 'bg-danger-50')`), never via a `style` attribute.
  >
  > Left-to-right layout, in this exact order:
  > 1. Agenda number: `font-mono text-sm text-text-muted w-8 shrink-0` (e.g., "1.")
  > 2. Certified-urgent chip: `bg-warning-100 text-warning-900 text-xs font-semibold px-2 py-0.5 rounded-sm touch-exempt` — rendered only when `isCertifiedUrgent=true`, prepended to the number column
  > 3. `DocumentNumberBadge`
  > 4. Title: `text-sm text-text-primary flex-1 truncate` — single-line truncation, not the two-line `line-clamp-2` you used for `DocumentPreviewCard`'s title
  > 5. Committee referral chips: one `Badge` per entry in `committeeReferrals`, colored to match `CommitteeReferralBlock`'s own status mapping (`SUBMITTED` → `bg-success-100 text-success-900`, `PENDING` → `bg-warning-100 text-warning-900`, `ABSENT_NOT_HEARD` → `bg-neutral-100 text-neutral-700`) even though this component renders the chips itself rather than delegating to `CommitteeReferralBlock`
  > 6. `StatusBadge` for `documentState`
  > 7. Reading-type chip: `Badge` variant for "1st/2nd/3rd Reading" derived from `scheduledReadingType`
  > 8. Flag icon: Lucide `Flag` in `text-danger-500` with `Tooltip` — rendered only when `isMissingReport=true`
  >
  > **ARIA (J6 §3.16.4, F6 §3.4):** The `Flag` icon carries `aria-label="Missing committee report"` (hardcoded internally, not a prop — it is always the same message) and `role="img"`. The certified-urgent chip's `aria-label="Certified Urgent"` largely restates its own visible text in different casing, which is the correct pattern under WCAG 2.5.3 (Label in Name) — the accessible name should contain the visible label text, not replace it with unrelated wording. **If the row itself is a click target** (opening the document detail), implementation detail matters: if you render this inside a native `<table>`/`<tr>`, do not put `role="button"`/`tabindex="0"` directly on the `<tr>` — overriding a native row's role is inconsistently supported and can break column-header associations for screen reader users navigating cell-by-cell. The more robust pattern is either (a) a non-table flex/grid row with `role="button"` + `tabindex="0"` on the whole row element, or (b) keep native row semantics and make the title cell's content the actual link/button performing navigation. `[Inference — F6 §3.4]`: neither DESIGN.md nor F5 states which container element this component uses; confirm your choice explicitly in the PR description rather than leaving it implicit. Whichever pattern you choose, any nested interactive control (the `Flag` tooltip trigger, etc.) must not double-fire the row's own navigation handler when activated.
  >
  > **Anti-pattern — do not do this:**
  > ```tsx
  > // WRONG — inline style instead of the danger-50 token class
  > <div style={{ backgroundColor: item.isMissingReport ? '#fef2f2' : 'white' }}>
  > ```
  > `danger-50` (`#fef2f2`) is a design token, not a literal. Inline hex bypasses the token system and will silently diverge if `danger-50` is revised in `globals.css`. Use `cn('flex items-center gap-3', item.isMissingReport && 'bg-danger-50')`.
  >
  > **Usage examples to mirror in the dev route:**
  > ```tsx
  > const item: OrderOfBusinessItem = {
  >   agendaNumber: 1, documentNumber: '7SP 2026-001', numberVariant: 'final',
  >   title: 'An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac',
  >   documentState: 'PANLALAWIGAN_REVIEW',
  >   committeeReferrals: [
  >     { id: 'cr-001', committeeName: 'Laws, Rules, Ethics & Privileges', status: 'SUBMITTED',
  >       submittedBy: 'Hon. Juan Paulo P. Flojo', submittedAt: new Date('2026-06-10T15:00:00+08:00') },
  >     { id: 'cr-002', committeeName: 'Environment', status: 'ABSENT_NOT_HEARD' },
  >   ],
  >   isCertifiedUrgent: false, isMissingReport: true, scheduledReadingType: 'SECOND',
  > };
  > <OrderOfBusinessRow item={item} />
  >
  > // Letter SPR 2026-038 — certified urgent, first reading, bypassed committee referral
  > const urgentItem: OrderOfBusinessItem = {
  >   agendaNumber: 2, documentNumber: 'SPR 2026-038', numberVariant: 'final',
  >   title: 'A Resolution Directing the City Engineer to Submit Report on Road Conditions',
  >   documentState: 'FIRST_READING', committeeReferrals: [],
  >   isCertifiedUrgent: true, isMissingReport: false, scheduledReadingType: 'FIRST',
  > };
  > <OrderOfBusinessRow item={urgentItem} />
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Eight-item left-to-right order matches exactly
  > - [ ] bg-danger-50 applied via cn(), never inline style
  > - [ ] Certified-urgent chip present/absent matches isCertifiedUrgent, no reserved empty space when absent
  > - [ ] Committee chips rendered directly via Badge, not via a CommitteeReferralBlock import
  > - [ ] Flag icon has role="img" + aria-label, and a Tooltip with the same text
  > - [ ] Title uses truncate (single-line), not line-clamp-2
  > - [ ] Row-click pattern choice documented in the PR description; Enter/Space work; no double-fire from nested interactive elements
  > A reviewer will verify each one independently.
````

---

## Plan 2 — Cross-component integration

## TASK-UI-019

```
TASK-UI-019

Phase:          1
Module:         UI
Title:          Cross-component integration page — /dev/all-components
Prerequisites:  [TASK-UI-003, TASK-UI-004, TASK-UI-005, TASK-UI-006, TASK-UI-007, TASK-UI-008, TASK-UI-009, TASK-UI-010, TASK-UI-011, TASK-UI-012, TASK-UI-013, TASK-UI-014, TASK-UI-015, TASK-UI-016, TASK-UI-017, TASK-UI-018]
Deliverables:
  - /apps/web/src/pages/dev/AllComponentsPage.tsx — dev route at /dev/all-components, gated by import.meta.env.DEV
Acceptance Criteria:
  - [ ] No visual proportion mismatch between DocumentNumberBadge and StatusBadge when side by side in a table row
  - [ ] WorkflowStepIndicator connector lines align correctly with step nodes at every viewport width from 375px to 1440px
  - [ ] SLATimer progress bar does not overflow its container in any of the three SLAStatus states
  - [ ] OrderOfBusinessRow's red-flag row does not shift row height relative to a normal row
  - [ ] All three sections below render without a console error and without a layout-shift warning
  - [ ] Route 404s or redirects in a production build, same gating pattern as every other /dev/* route in this module
  - [ ] All compositions reviewed and approved by the project lead before the first feature-page PR begins — this is a process gate, not a code check, and should be tracked as a sign-off outside this PR's own merge
AI Prompt:
  > Create apps/web/src/pages/dev/AllComponentsPage.tsx at route /dev/all-components, gated `import.meta.env.DEV` the same way as every other /dev/* route in this module. This task runs after all 16 Tier 3 component tasks (TASK-UI-003 through TASK-UI-018) are merged — its entire purpose is to catch visual proportion and composition issues that are invisible when reviewing components in isolation, one at a time, the way every previous task in this list was reviewed.
  >
  > Render all 16 Tier 3 components in realistic page-level combinations — not in isolation, but as they will actually appear together inside real page contexts, matching F4's described compositions.
  >
  > **Section 1 — SP Secretary Dashboard composition.** Wrap in `PageHeader` with title "SP Secretary Dashboard". Render: a stat row of four `StatCard`s; a mock table with six rows, each row containing `DocumentNumberBadge` + `StatusBadge` + `SLATimer` together; a grid of three `DocumentPreviewCard`s.
  >
  > **Section 2 — Document Detail composition.** Render `DocumentNumberBadge` + `StatusBadge` together in a header row. Below that: `WorkflowStepIndicator` with step 3 of 7 active. Below that: `RoutingHistoryTimeline` with five entries. Below that: `ScanQualityIndicator` inline next to a mock filename. Below that: `QRCodeDisplay`.
  >
  > **Section 3 — Order of Business composition.** Render three `OrderOfBusinessRow` instances in a mock session table — one normal, one Certified Urgent, one with a missing-report red flag. Below each row, separately, show the expanded `CommitteeReferralBlock` for that item's committee referrals. Rendering these as two separate, adjacent elements (a compact row plus a separate expanded block below it) is the intended composition, consistent with the resolution recorded in TASK-UI-018: `OrderOfBusinessRow` itself renders compact inline `Badge` chips per J6, while `CommitteeReferralBlock` is a separate, more detailed component shown alongside it here, not composed inside it — F7's table has been corrected to match.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] No proportion mismatch between DocumentNumberBadge and StatusBadge in the Section 1 table rows
  > - [ ] WorkflowStepIndicator connectors align with step nodes from 375px through 1440px viewport width
  > - [ ] SLATimer's bar never overflows its container in any state
  > - [ ] OrderOfBusinessRow's red-flag row height matches normal row height exactly
  > - [ ] No console errors, no layout-shift warnings across all three sections
  > - [ ] Route is DEV-gated correctly
  > Get explicit sign-off from the project lead on all three section compositions before the first feature-page PR begins — this gate exists because composition problems (spacing, proportion, alignment) are real risks that per-component review cannot catch, and this page is the one place they surface before real feature work starts.
```

---

## Module Summary — UI

**Tasks generated:** 19 (`TASK-UI-001` through `TASK-UI-019`).

**Coverage:** Plan 0 Foundation (1) — Tier 1 install, Tier 2 overrides, token system, `/dev/components`. J6 type-system generation (1) — `domain.ts` + `status-meta.ts`, not separately instantiated by F7 but required to exist as "the J6-generation task" per `A1-AGENTS.md` §6. All sixteen Tier 3 components confirmed by F5 §1/§4.3 (16) — Group A layout shell ×4, Group B standalone display ×7, Group C J6-dependent ×3, Group D composed ×2. Plan 2 cross-component integration page (1).

**Tasks carrying a status flag in their title, repeated here for visibility:**

- `TASK-UI-004` (Sidebar) — `[implements F6 §3.5's accessible-name required action]`; not an open item, but a real divergence from F5's literal prose that an implementer could easily miss if they only skimmed F5.
- `TASK-UI-013` (QRCodeDisplay) — `[F7's open item resolved 2026-06-23 — F7 and J6 now agree]`.
- `TASK-UI-016` (WorkflowStepIndicator) — `[pending/error step ARIA confirmed 2026-06-23 — see F6 §3.2]`.
- `TASK-UI-018` (OrderOfBusinessRow) — `[F7 corrected to match J6, 2026-06-23 — CommitteeReferralBlock not composed]`.

**All eight items from the original Module Summary's "open items" list are now resolved**, with human authorization, as of 2026-06-23 (see the Pre-task reconciliation findings above for full detail on each — none was resolved by guessing; each states which source it follows and why):

1. **Consolidated ref §13** — verified directly: Part 13's Phase 1 capability list does not name `UI` anywhere. Nothing missing from these 19 tasks.
2. **`WorkflowStepIndicator` pending/error step ARIA** (`TASK-UI-016`) — confirmed: no special attribute for pending steps; `aria-label="{step name} — error"` for error steps. F6 §3.2 edited to record this as decided rather than speculative.
3. **Sonner `<Toaster>` position** — confirmed: `bottom-right`, per DESIGN.md §6.5's specific value. `INSTALL.sh` Step 5 and F5's deviation-table row 6 edited accordingly.
4. **`QRCodeDisplay` composition** (`TASK-UI-013`) — confirmed: no Tier 3 dependency, per J6 §3.11's complete spec. F7's "Open item" paragraph and row 11 edited to record the resolution.
5. **`OrderOfBusinessRow` vs `CommitteeReferralBlock`** (`TASK-UI-018`) — confirmed: not composed, per J6 §3.16. F7's row 16 and Execution Order diagram edited to remove the incorrect dependency.
6. **F7's stale "23 states" note** (row 13) — corrected to reference J6's canonical 26-member `DocumentState` union, with the four-member discrepancy (`CERTIFIED_URGENT`/`SLA_AT_RISK`/`SLA_BREACHED`/`MISSING_REPORT`) explained inline.
7. **`PageHeader` composing-primitives conflict** (`TASK-UI-003`) — confirmed: no `Button` import; F5's original `—` was correct, F7's "correction" to `Button (T2)` was the actual error. F7's row 1 edited to record this.
8. **Domain-type location conflict, found during this resolution pass** — confirmed: canonical location is `packages/ui/src/types/domain.ts` (J6 §1), not `packages/shared` as F5 had stated. F5 §1's package overview, its domain-types bullet rule, the `StatusBadge` section description, its implementation-steps reference, and its `DocumentState` union (replaced with J6's canonical 26-member version) were all edited. This task list's own 19 tasks needed no content changes for this one — they had already followed J6's location throughout.

**Documents edited in the resolution pass (2026-06-23), with human authorization overriding `A1-AGENTS.md` §8's "do not edit any pre-dev document" rule for this specific purpose:**

| Document                                                                                                 | What changed                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/pre-development/F-frontend-architecture/f7-frontend-implementation-plans.md`                       | "Open item — QRCodeDisplay composition" → resolved. Row 1 (`PageHeader`) composing-primitives cell corrected. Row 11 (`QRCodeDisplay`) Tier 3 Deps cell corrected. Row 13 (`StatusBadge`) stale 23-state note corrected to 26 states. Row 16 (`OrderOfBusinessRow`) Tier 3 Deps cell corrected to remove `CommitteeReferralBlock`. Execution Order ASCII diagram's `OrderOfBusinessRow` annotation corrected to match. |
| `docs/pre-development/F-frontend-architecture/f6-accessibility-compliance-checklist.md`                  | §3.2 `WorkflowStepIndicator`'s pending/error ARIA treatment changed from `[Speculation]` to a confirmed requirement; its PR-check line and ToC entry updated to match.                                                                                                                                                                                                                                                 |
| `docs/pre-development/F-frontend-architecture/f5-ui-component-library-setup-and-package-architecture.md` | Deviation-table row 6 (Toaster position) marked resolved. Package-overview paragraph, domain-types bullet rule, `StatusBadge` section description, and implementation-steps reference all corrected from `packages/shared` to `packages/ui/src/types/domain.ts`. `DocumentState` union replaced with J6's canonical 26-member version (was a stale 23-member version with four non-state "overlay" pseudo-members).    |
| `INSTALL.sh`                                                                                             | Step 5 Sonner `<Toaster>` example changed from `position="top-right"` to `position="bottom-right"` with `duration={5000}` added, matching DESIGN.md §6.5.                                                                                                                                                                                                                                                              |
| `docs/pre-development/A-project-planning/a1-skeleton.md`                                                 | UI Tier-3 component-count discrepancy (§3 closing note, §6 table row, aggregate estimate, changelog row 10) marked resolved at 19 tasks; aggregate Phase 1 task-count range recalculated from "110–162" to "112–162."                                                                                                                                                                                                  |

**Documents read but not edited:** J6, F4, F1, DESIGN.md, `globals.css` — none contained anything this pass's resolutions required changing.

**Confidence note on this document as a whole:** every type definition, class string, ARIA attribute, and visual-behavior rule above is taken directly from one of the nine loaded documents (as corrected in this resolution pass) and cited to the specific section it came from; nothing in the 19 tasks' technical content was invented to fill a gap. Where this pass made a judgment call rather than simply reconciling two existing sources — items 2 and 3 above — the call is stated plainly as a decision made with the authority the project owner granted on 2026-06-23, not disguised as something the source documents already settled on their own.
