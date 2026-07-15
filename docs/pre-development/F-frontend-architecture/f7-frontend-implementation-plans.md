# F7 — Frontend Implementation Plans

`batac-dms` · `packages/ui` · `apps/web` · Version 1.0
**Status:** Pre-development specification
**Audience:** Development team — internal reference only; primary input for the A1 UI module pass
**Source documents:** DESIGN.md v1.0, F4, F5, F6, J6, `globals.css`, `button.tsx`, `tabs.tsx`, `avatar.tsx`, `components.json`, `INSTALL.sh`
**Canonical path:** `docs/pre-development/F-frontend-architecture/f7-frontend-implementation-plans.md`
**Replaces:** Informally circulated "Frontend Foundation Plans" (conversation artifact); this file is the on-disk version. Any discrepancy between this file and that artifact is resolved in favor of this file, which was reconciled against F5 §4.3 as the upstream authority.

---

## Table of Contents

- [L28–L41] Reconciliation Notes (F7 vs. Conversation Artifact) — Reconciliation and corrections made to the original plans against F5 §4.3 overview table.
- [L42–L71] Part 1 — Tier 1, 2, 3 Explained — Ownership model for the three component tiers; construction rules and the bar for each tier.
- [L72–L98] Part 2 — The UI Building Process — Strict layer-by-layer dependency sequence from tokens through Tier 3 to pages; what each AI agent needs to implement a Tier 3 component.
- [L99–L114] Part 3 — What's Missing Without the Kitchen-Sink — Two gaps closed by per-component dev routes; one genuine gap (cross-component visual consistency) filled by task ordering in A1.
- [L115–L354] Part 4 — Implementation Plans — Overview of plans for foundation setup, component creation, and integration pages.
  - [L117–L180] Plan 0 — Foundation PR — Spec, prerequisites, and AI Agent Prompt for the Tier 1 + Tier 2 base PR.
  - [L181–L246] Plan 1 — Tier 3 Component Template — Reusable AI Agent Prompt template and fill-in table for all 16 Tier 3 components.
  - [L247–L273] Per-Component Fill-In Table — One row per component; corrected against F5 §4.3 overview table.
  - [L274–L304] Plan 2 — Cross-Component Integration Page — AI Agent Prompt for the /dev/all-components integration page task.
  - [L305–L343] Execution Order — Group A → B → C → D dependency graph; parallelism notes.
  - [L344–L354] On Plans 0, 1, 2: Prompt Directly or Wait for A1? — Why these plans belong in A1, not as standalone prompts.

---

## Reconciliation Notes (F7 vs. Conversation Artifact)

The following corrections were made when this document was written. F5 §4.3 overview table is the authority for composition; any Plans prose or fill-in table entry that conflicted with F5 was corrected here.

**Correction 1 — Component count.** The conversation artifact said "17 Tier 3 components" in its prose (Parts 1, 2, and Plan 1). F5 §1 says "sixteen" and F5 §4.3 ToC entry says "16 custom, domain-specific legislative and layout components." The per-component fill-in table in the artifact already had 16 rows, confirming the prose was wrong. All prose in this document reads "16."

**Correction 2 — Per-component fill-in table, Composing Primitives column.** The original column was headed "Tier 1 Primitives" and contained several entries that did not match F5 §4.3. The column is renamed to "Composing Primitives (T1 + T2)" because F5's overview table lists both Tier 1 and Tier 2 compositions. Specific row corrections are documented in §4.2.1.

**Correction 3 — AI Prompt Template, `{Tier1Primitives}` placeholder.** The original template text said "Compose `{Tier1Primitives}` from `@batac/ui/components/ui/*`." The corrected template says "Compose `{ComposingPrimitives}` from `@batac/ui/components/ui/*` (for T1) and `@batac/ui` barrel (for T2 — Button, AvatarName, Tabs, Avatar)."

**Resolved — QRCodeDisplay composition.** _[Resolved by the A1 UI module pass, with human authorization — see `docs/pre-development/A-project-planning/a1-tasks/ui.md`, `TASK-UI-013`.]_ The original Plans had `DocumentNumberBadge` as a Tier 3 dependency of `QRCodeDisplay`; F5 §4.3 lists `QRCodeDisplay` composition as `—` (no named primitives), leaving this document's table ambiguous between the two. J6 §3.11 — the canonical per-component engineering reference — resolves this with a complete implementation: the document number renders as plain styled text (`font-mono text-xs font-medium text-text-primary`) directly inside the component, with no Tier 1, Tier 2, or Tier 3 dependency at all. **Decision: `QRCodeDisplay` has no Tier 3 dependency**, per J6. Row 11 below reflects this.

---

## Part 1 — Tier 1, 2, 3 Explained

Think of it as three levels of ownership over a component's source code.

**Tier 1 — You own nothing. Shadcn owns it.**

You run `pnpm dlx shadcn@latest add dialog` and a file lands in `packages/ui/src/components/ui/dialog.tsx`. You do not touch that file. You import `Dialog`, `DialogContent`, `DialogHeader` and use them exactly as shadcn documents them. The reason they work accessibly out of the box is that shadcn wraps Radix UI primitives, which handle focus trapping, keyboard navigation, and ARIA roles automatically.

Examples in this project: Card, Input, Dialog, Sheet, Tooltip, Table, Alert, Command, Popover, Select, Checkbox, Calendar, Badge, Separator, Skeleton, Breadcrumb, Sonner.

Rule: if you find yourself editing a Tier 1 file, stop. Either you need a Tier 2 override, or you need a Tier 3 component that wraps this primitive.

**Tier 2 — You own the variants. Shadcn owns the primitives.**

You install from shadcn CLI exactly like Tier 1, then immediately replace the generated file with your customized version. The customization is always done via CVA — you add new variant strings to the existing CVA definition. The component's external API stays shadcn-compatible. Someone using your `Button` uses it identically to shadcn's `Button`, but now `variant="ghost-danger"` and `size="xs"` exist.

This project has exactly three Tier 2 components, all already built: `Button` (added `primary` alias, `ghost-danger`, `xs`), `Tabs` (added `underline` variant), `Avatar` (added `sm/md/lg` sizes, `AvatarName` compound).

Rule: you only make a Tier 2 override when the visual variant is so foundational that it will appear across many different parts of the app. The bar is high — three components in the entire system qualifies as high.

**Tier 3 — You own everything.**

These are components you write from scratch in `packages/ui/src/components/domain/`. They exist nowhere else. They encode batac-dms-specific domain knowledge: what a `DEEMED_APPROVED` state looks like, how an `OrderOfBusinessRow` renders a missing committee report red flag, how a `SLATimer` communicates breach. They are built by composing Tier 1 and Tier 2 components — a `WorkflowStepIndicator` uses `Tooltip` (Tier 1) for step hover labels; a `DocumentPreviewCard` uses `Card` (Tier 1) and `Skeleton` (Tier 1) as structural elements.

The 16 Tier 3 components are defined in F5 §4.3. Their type contracts are defined in J6. Their ARIA requirements are defined in F6.

Rule: no hardcoded hex values. No re-implementing a tooltip when `Tooltip` exists in Tier 1. No re-implementing a button when `Button` exists in Tier 2. Compose upward.

---

## Part 2 — The UI Building Process

The sequence is strict and the dependency is always upward — pages depend on Tier 3, Tier 3 depends on Tier 1 and 2, Tier 2 depends on Tier 1.

**Layer 0 — Token system.** `globals.css` is committed. This is the `@theme` block that generates every Tailwind utility the app uses: `bg-primary-800`, `text-text-muted`, `z-sticky`. Nothing else can be built without this because every component references these utilities.

**Layer 1 — Tier 1 install.** Run the shadcn CLI commands from `INSTALL.sh`. Every primitive lands in `packages/ui`. One PR. Nothing custom here — just install and commit.

**Layer 2 — Tier 2 replacement.** Replace `button.tsx`, `tabs.tsx`, `avatar.tsx` with the customized versions. These files already exist. One PR, or combined with Layer 1 as the foundation PR.

**Layer 3 — Tier 3 components.** Build each domain compound component one PR at a time. Each PR: one component file in `packages/ui/src/components/domain/`, exported from the barrel, with a `/dev/{component-name}` dev route as the visual acceptance gate. The type definitions in J6 and the STATUS_META constant must exist before components that depend on them.

**Layer 4 — Pages.** Pages in `/apps/web` import and compose Tier 1, 2, and 3 components. A page does not re-implement anything — if it needs a StatusBadge it imports it from `@batac/ui`, it does not write its own badge inline. Pages are thin compositions. All the domain display logic is in Tier 3.

**What an AI agent needs to implement a Tier 3 component correctly:**

- The props interface from J6 (the exact TypeScript shape)
- The visual spec from DESIGN.md §6 (what it looks like in each state)
- The ARIA contract from F6 (what attributes are required)
- The Tailwind utilities from `globals.css` (what classes exist)
- The STATUS_META constant from J6 (for StatusBadge specifically)
- Which Tier 1 and Tier 2 components to compose (from F5 §4.3 overview table)

That is exactly what J6 + F5 + F6 + DESIGN.md together provide. This is why those documents exist — they are the complete specification an agent needs to produce a correct Tier 3 component PR without ambiguity.

---

## Part 3 — What's Missing Without the Kitchen-Sink

The kitchen-sink was doing three things. Two are replaced. One is a genuine gap that needs a decision.

**Replaced — Visual smoke test of the token system.** The `/dev/components` page inside the foundation PR renders all Tier 2 components against the token system. If `bg-primary-800` doesn't exist or `text-text-muted` is the wrong contrast, it shows up immediately.

**Replaced — Visual acceptance criteria per Tier 3 component.** Each Tier 3 component PR includes a `/dev/{component-name}` route that renders every state. The PR cannot be merged until that route is reviewed and approved. This is narrower than the kitchen-sink (one component at a time instead of all 16 at once) but achieves the same QA goal incrementally.

**Genuine gap — Cross-component visual consistency check.** The kitchen-sink put all 16 components on screen simultaneously, which revealed issues invisible when reviewing components one at a time. A `StatusBadge` that looks correct in isolation might be the wrong size relative to a `DocumentNumberBadge` next to it in an `OrderOfBusinessRow`. Without the kitchen-sink, this type of issue is only caught when the first page that composes multiple Tier 3 components is built.

This gap does not require a new document. It requires one task in the A1 task list: after all Tier 3 components are built, a single PR creates a `/dev/all-components` page that composes them together in realistic combinations, mirroring the actual page layouts from F4. This is the last Tier 3 task before the first feature page PR.

No new documents are needed. The gap is filled by task ordering in A1.

---

## Part 4 — Implementation Plans

### Plan 0 — Foundation PR

**Objective:** Establish the complete Tier 1 + Tier 2 base and verify the token system renders correctly. This is the gate for all Tier 3 work.

**Prerequisites — Spec documents:**

- DESIGN.md (§3 tokens, §4 Tailwind config, §5 shadcn theme, §6.3–6.6 component rules, §8 rules, §9 typography specimen)
- F5 (Tier 1 install list, Tier 2 override specs, PR boundary definition §7, export map §6)
- F6 (focus ring rule, touch target rule, reduced-motion rule — all from universal rules §2)
- `globals.css`
- `button.tsx`, `tabs.tsx`, `avatar.tsx`
- `components.json`
- `INSTALL.sh`
- `date-locale.ts`, `utils.ts`

**Prerequisites — Prior tasks:** None. This is the first frontend PR.

**Order:** First. Nothing else can start until this is merged.

---

**AI Agent Prompt:**

> You are implementing the `packages/ui` foundation PR for batac-dms. This is the zero-feature setup PR that establishes the entire Tier 1 and Tier 2 component base. No domain logic, no pages, no feature components.
>
> **Provided files:** `globals.css`, `button.tsx`, `tabs.tsx`, `avatar.tsx`, `components.json`, `INSTALL.sh`, `date-locale.ts`, `utils.ts`, DESIGN.md, F5, F6.
>
> **Deliverables — execute in this order:**
>
> **Step 1 — Token system.** Place `globals.css` at `packages/ui/src/styles/globals.css`. Place `utils.ts` at `packages/ui/src/lib/utils.ts`. Place `date-locale.ts` at `packages/ui/src/lib/date-locale.ts`. Verify `date-fns` is in `packages/ui` dependencies. Add `date-fns-tz` to `packages/ui` dependencies — it is missing from `INSTALL.sh` but required by `date-locale.ts` for `formatInTimeZone`.
>
> **Step 2 — Tier 1 install.** Run every `pnpm dlx shadcn@latest add` command from `INSTALL.sh` Step 2. After running, do not modify any generated file. Commit the generated files as-is.
>
> **Step 3 — Tier 2 replacement.** Replace the shadcn-generated `button.tsx`, `tabs.tsx`, `avatar.tsx` with the provided customized versions. These are production-ready — do not modify them.
>
> **Step 4 — Export barrel.** Create `packages/ui/src/index.ts`. Export everything per the export map in F5 §6: all Tier 1 components, all Tier 2 components, `cn` from `./lib/utils`, `phLocale`/`PH_TIMEZONE`/`DATE_FORMATS` from `./lib/date-locale`. Do not export anything from `./styles/globals.css` — CSS is imported directly by app roots.
>
> **Step 5 — `package.json` exports map.** Add the `exports` field to `packages/ui/package.json` per F5 §6. Key entries: `"."` → `./src/index.ts`, `"./styles/globals.css"` → `./src/styles/globals.css`, `"./lib/utils"` → `./src/lib/utils.ts`, `"./lib/date-locale"` → `./src/lib/date-locale.ts`, `"./components/ui/*"` → `./src/components/ui/*.tsx`.
>
> **Step 6 — `/dev/components` route.** Create `apps/web/src/pages/dev/ComponentsPage.tsx`. This file renders the following sections, each with a section heading `<h2>`:
>
> — **Token System.** Color swatches for every named color in DESIGN.md §3: primary scale (50–950), neutral, success, danger, warning, info. Each swatch is a 40×40px div using the Tailwind utility class, with the token name below it in `font-mono text-xs`. Then typography: render every text style from DESIGN.md §9 with its Tailwind class annotated beside it.
>
> — **Button — all variants.** A grid showing every variant (`default`, `primary`, `secondary`, `destructive`, `ghost`, `ghost-danger`, `link`, `outline`) × every size (`xs`, `sm`, `default`, `lg`, `icon`, `icon-sm`). With icon (use `FileText` from lucide-react) and without. Show `disabled` state for `default` and `destructive`.
>
> — **Tabs — both variants.** Default variant with three tabs. Underline variant with tabs labeled Overview, Workflow, History, Attachments.
>
> — **Avatar / AvatarName — all sizes.** `AvatarImage` with placeholder. `AvatarName` for six names (Gladys R. Lagura, Mark Christian R. Chua, Albert D. Chua, and three councilor names from the consolidated reference) to demonstrate deterministic color spread. All three sizes.
>
> Add this route to the Vite dev router at `/dev/components`. Gate with `import.meta.env.DEV` — if `DEV` is false, redirect to `/`. This page must never ship to production.
>
> **Acceptance criteria:**
>
> - [ ] All Tier 1 shadcn components installed and importable from `@batac/ui/components/ui/{name}`
> - [ ] `Button` renders all 8 variants and 6 sizes without errors
> - [ ] `Tabs` underline variant shows bottom-border indicator on active tab
> - [ ] `AvatarName` produces different background colors for the six test names
> - [ ] `bg-primary-800` resolves to `#162e60` in the browser — verify via DevTools
> - [ ] `text-text-muted` resolves to `#5a6470` — verify WCAG AA correction is live
> - [ ] Focus ring appears on Tab through all interactive elements on `/dev/components`
> - [ ] `/dev/components` returns 404 or redirects in production build (`NODE_ENV=production pnpm build`)
> - [ ] `cn()` correctly merges conflicting Tailwind classes (test: `cn("px-4", "px-8")` → `"px-8"`)

---

### Plan 1 — Tier 3 Component Template

This is the template that the A1 task list instantiates for each of the 16 Tier 3 components. The placeholders in `{curly braces}` are filled per-component from the fill-in table in §4.2.1.

**Prerequisites — Spec documents (supply to every Tier 3 task):**

- DESIGN.md §6.{subsection} for this component
- F5 §4.3 (Tier 3 overview table row for this component — composing primitives, export path)
- F6 (component-specific ARIA subsection for this component)
- J6 (shared type definitions, STATUS_META if applicable)
- `globals.css`

**Prerequisite tasks:** Foundation PR must be merged. Any Tier 3 dependencies listed in the fill-in table must be merged.

---

**AI Agent Prompt Template:**

> You are implementing `{ComponentName}` as a Tier 3 domain compound component for batac-dms. It lives at `packages/ui/src/components/domain/{ComponentName}.tsx` and is exported from the `packages/ui` barrel.
>
> **Provided spec documents:** DESIGN.md §{Section}, F5 §4.3 (Tier 3 table entry for {ComponentName}), F6 ({ComponentName} ARIA subsection), J6 (shared types — use `{TypesNeeded}` from `packages/shared/src/types/domain.ts`), `globals.css`.
>
> **Rules that apply to every Tier 3 component:**
>
> - TypeScript strict mode. No `any`. No hardcoded hex values. All colors via Tailwind utilities from `globals.css` `@theme` block.
> - All conditional class composition via `cn()` from `@batac/ui/lib/utils`.
> - Compose `{ComposingPrimitives}` from `@batac/ui/components/ui/*` (for T1) and `@batac/ui` barrel (for T2 — Button, AvatarName, Tabs, Avatar). Do not reimplement their behavior.
> - Include every ARIA attribute listed in F6 for this component. No exceptions.
> - Non-actionable display chips carry `className` including `touch-exempt`.
> - No `<form>` elements.
> - No `"use client"` directive.
> - Export as a named export. Add to `packages/ui/src/index.ts` barrel.
>
> **Props interface** (from F5 §4.3 and J6 — implement exactly this shape, no deviations):
>
> ```typescript
> {
>   PropsInterface;
> }
> ```
>
> **Visual behavior** (from DESIGN.md §{Section}):
> {VisualBehaviorSummary}
>
> **ARIA requirements** (from F6):
> {ARIARequirements}
>
> **Do not do this** (the most likely wrong implementation):
> {AntiPattern}
>
> **After implementing the component, create the dev route:**
> Create `apps/web/src/pages/dev/{ComponentName}Page.tsx`. Render the component in every meaningful state using real domain mock data:
> {DevRouteStates}
>
> Each rendered instance carries a label above it:
> `<p className="text-xs font-mono text-text-muted uppercase tracking-widest mb-2">{ComponentName} · {state description}</p>`
>
> Add this route to the Vite dev router at `/dev/{component-name}`. Gate with `import.meta.env.DEV`.
>
> **Acceptance criteria:**
>
> - [ ] Component renders in all states listed in the dev route without errors
> - [ ] All ARIA attributes from F6 are present — verify in browser DevTools Accessibility panel
> - [ ] Tab through the component on `/dev/{component-name}` — focus ring visible on all interactive elements
> - [ ] No hardcoded hex values in the component file — verify via `grep '#[0-9a-fA-F]' {ComponentName}.tsx` returning empty
> - [ ] `touch-exempt` class present on non-actionable chip instances (if applicable)
> - [ ] Component exported from `packages/ui/src/index.ts`
> - [ ] TypeScript compiles with zero errors (`pnpm typecheck`)

---

### Per-Component Fill-In Table

**Note on column corrections:** The "Composing Primitives (T1 + T2)" column was corrected against F5 §4.3 overview table, which is the authoritative source for composition. The original conversation artifact headed this column "Tier 1 Primitives" and had several entries that did not match F5. All entries here follow F5. Discrepancies are noted inline. See Reconciliation Notes at the top of this document for the full list.

| #   | ComponentName            | DESIGN.md Section | Types Needed                                 | Composing Primitives (T1 + T2)                                                                                                                                                                                                                                                                                                          | Tier 3 Dependencies                                                                                                                                                                                                                                                                                                                                                                                                           | Dev Route States                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------ | ----------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PageHeader`             | §6.1              | none                                         | none [this row's earlier "corrected from F5" note — which changed this cell to `Button (T2)` — was itself wrong; resolved by the A1 UI module pass: J6 §3.1.2 confirms the component has no direct Tier 1/2 import, since `actions` is a render-prop slot the consumer fills with its own `Button`, not something `PageHeader` imports] | none                                                                                                                                                                                                                                                                                                                                                                                                                          | title only; title + subtitle; title + subtitle + action button                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | `Sidebar`                | §6.1              | none                                         | `Tooltip (T1)`, `AvatarName (T2)` [corrected from F5: original missing AvatarName]                                                                                                                                                                                                                                                      | none                                                                                                                                                                                                                                                                                                                                                                                                                          | expanded (240px); collapsed (56px) with icon-only nav; active nav item; nav item with unread badge                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | `Topbar`                 | §6.1              | `BreadcrumbItem`                             | `Breadcrumb (T1)`, `Tooltip (T1)`, `AvatarName (T2)`, `Popover (T1)` [corrected from F5: original had Command which F5 does not list for Topbar, and Avatar → AvatarName; Tooltip added per F5]                                                                                                                                         | none                                                                                                                                                                                                                                                                                                                                                                                                                          | single breadcrumb; multi-level breadcrumb; command palette open state                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | `AppShell`               | §6.1              | none                                         | none (composes only T3 deps below)                                                                                                                                                                                                                                                                                                      | `Sidebar`, `Topbar`                                                                                                                                                                                                                                                                                                                                                                                                           | expanded sidebar; collapsed sidebar; both inside a `h-[600px]` contained demo wrapper                                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | `DocumentNumberBadge`    | §6.3              | `NumberVariant`                              | none (pure Tailwind)                                                                                                                                                                                                                                                                                                                    | none                                                                                                                                                                                                                                                                                                                                                                                                                          | final variant (`7SP 2026-001`); preliminary variant (`Draft 7SP 2026-002`); resolution final (`SPR 2026-038`); each inside a mock table row                                                                                                                                                                                                                                                                                                                             |
| 6   | `StatCard`               | §6.3              | none                                         | `Card (T1)`                                                                                                                                                                                                                                                                                                                             | none                                                                                                                                                                                                                                                                                                                                                                                                                          | metric only; metric + label; metric + label + trend up; metric + label + trend down; danger value color                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | `EmptyState`             | §6.3              | none                                         | `Button (T2)` [corrected from F5: original said none]                                                                                                                                                                                                                                                                                   | none                                                                                                                                                                                                                                                                                                                                                                                                                          | icon + heading + body; icon + heading + body + action button; two domain examples (empty queue, empty search)                                                                                                                                                                                                                                                                                                                                                           |
| 8   | `ScanQualityIndicator`   | §6.3              | `ScanQualityLevel`                           | `Tooltip (T1)` [corrected from F5: original said none]                                                                                                                                                                                                                                                                                  | none                                                                                                                                                                                                                                                                                                                                                                                                                          | all four levels (97%, 88%, 72%, 45%); inline in a mock file-upload row                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9   | `SLATimer`               | §6.3              | `SLAStatus`                                  | none                                                                                                                                                                                                                                                                                                                                    | none                                                                                                                                                                                                                                                                                                                                                                                                                          | on-track (30% elapsed); at-risk (85% elapsed); breached (105% elapsed); `role="timer"` visible in debug annotation                                                                                                                                                                                                                                                                                                                                                      |
| 10  | `RoutingHistoryTimeline` | §6.3              | `RoutingEntry`, `RoutingAction`              | `AvatarName (T2)` [corrected from F5: original said Separator (T1); F5 lists AvatarName only — Separator may still be used structurally but is not named in F5 §4.3]                                                                                                                                                                    | none                                                                                                                                                                                                                                                                                                                                                                                                                          | five-entry history using real stakeholder names and `DATE_FORMATS.displayWithTime`; single entry; empty (EmptyState fallback)                                                                                                                                                                                                                                                                                                                                           |
| 11  | `QRCodeDisplay`          | §6.6              | none                                         | none                                                                                                                                                                                                                                                                                                                                    | none [resolved — see "Resolved — QRCodeDisplay composition" above; J6 §3.11 confirms no Tier 3 dependency]                                                                                                                                                                                                                                                                                                                    | screen variant; print variant; `role="img"` and `aria-label` visible in debug annotation                                                                                                                                                                                                                                                                                                                                                                                |
| 12  | `CommitteeReferralBlock` | §6.6              | `CommitteeReferral`, `CommitteeReportStatus` | `Badge (T1)`, `AvatarName (T2)` [corrected from F5: original missing AvatarName]                                                                                                                                                                                                                                                        | none                                                                                                                                                                                                                                                                                                                                                                                                                          | SUBMITTED entry; PENDING entry; ABSENT entry; all three together using real committee names from consolidated ref Part 6                                                                                                                                                                                                                                                                                                                                                |
| 13  | `StatusBadge`            | §6.3, §7          | `DocumentState`, `StatusMetaEntry`           | none (CVA + pure Tailwind) — but STATUS_META from J6 required                                                                                                                                                                                                                                                                           | none                                                                                                                                                                                                                                                                                                                                                                                                                          | all 26 states in a grid, per J6 §1's canonical `DocumentState` union [supersedes this row's earlier "23 states... per F5 §4.3" note — that referenced a stale F5 union containing `CERTIFIED_URGENT`/`SLA_AT_RISK`/`SLA_BREACHED`/`MISSING_REPORT` members, which J6 does not carry forward as `DocumentState` values; resolved by the A1 UI module pass]; three states in a mock table row; `LAPSED` italic; `CANCELLED` line-through; `DEEMED_APPROVED` dashed border |
| 14  | `WorkflowStepIndicator`  | §6.3              | `WorkflowStep`                               | `Tooltip (T1)`                                                                                                                                                                                                                                                                                                                          | none                                                                                                                                                                                                                                                                                                                                                                                                                          | D2 Diagram 1 step 3 of 7 active; D2 Diagram 2 Certified Urgent bypass; error at step 4; horizontal layout; vertical layout in forced narrow wrapper                                                                                                                                                                                                                                                                                                                     |
| 15  | `DocumentPreviewCard`    | §6.6              | `DocumentPreview`                            | `Card (T1)`, `Skeleton (T1)` [corrected from F5: original missing Skeleton]                                                                                                                                                                                                                                                             | `DocumentNumberBadge`, `StatusBadge`, `SLATimer`                                                                                                                                                                                                                                                                                                                                                                              | VALID resolution (final number); PENDING_MAYOR ordinance with SLATimer; DRAFT (preliminary number, no SLATimer); thumbnail placeholder (Skeleton visible)                                                                                                                                                                                                                                                                                                               |
| 16  | `OrderOfBusinessRow`     | §6.6              | `OrderOfBusinessItem`                        | `Badge (T1)`, `Tooltip (T1)` [corrected from F5: original missing Badge; Tooltip broken into TooltipContent/TooltipTrigger subcomponents — both refer to the same T1 Tooltip]                                                                                                                                                           | `DocumentNumberBadge`, `StatusBadge` [this row's earlier `CommitteeReferralBlock` entry was incorrect — resolved by the A1 UI module pass: J6 §3.16 renders committee referrals as inline `Badge` (T1) chips directly, not via a composed `CommitteeReferralBlock`; the two components serve different display densities (compact row vs. detailed block) and are shown adjacent, not nested, in the Plan 2 integration page] | normal row; Certified Urgent row; missing-report red-flag row with `aria-label` on flag icon visible in debug                                                                                                                                                                                                                                                                                                                                                           |

**Note on row 13 state count:** The `DocumentState` union in F5 §4.3 has 23 members (DRAFT, IN_COMMITTEE, FIRST_READING, SECOND_READING, THIRD_READING, PENDING_MAYOR, LAPSED, VETOED, OVERRIDE_PENDING, PANLALAWIGAN_REVIEW, VALID, VALID_IN_PART, RETURNED, DEEMED_APPROVED, ARCHIVED, CANCELLED, PENDING_HEARING, DISMISSED, RESOLVED, CERTIFIED_URGENT, SLA_AT_RISK, SLA_BREACHED, MISSING_REPORT). The dev route should render all 23, not "17+" as the original Plans said.

---

### Plan 2 — Cross-Component Integration Page

This runs after all 16 Tier 3 components are merged.

**Objective:** Catch visual proportion and composition issues that are invisible when reviewing components in isolation.

**Prerequisites:** All 16 Tier 3 component PRs merged. F4 (component hierarchy — to know which components appear together per page).

**Order:** Last Tier 3 task. Before the first feature page PR.

**AI Agent Prompt:**

> Create `apps/web/src/pages/dev/AllComponentsPage.tsx` at route `/dev/all-components`, gated by `import.meta.env.DEV`.
>
> This page renders all 16 Tier 3 components in realistic page-level combinations, matching the actual compositions defined in F4 Section 8. Do not render components in isolation — render them as they will appear together inside real page contexts.
>
> **Section 1 — SP Secretary Dashboard composition.** Render the stat row (four `StatCard`), a mock `DataTable` with six rows each containing `DocumentNumberBadge` + `StatusBadge` + `SLATimer`, and a `DocumentPreviewCard` grid of three cards. Wrap in `PageHeader` with title "SP Secretary Dashboard".
>
> **Section 2 — Document Detail composition.** Render `DocumentNumberBadge` + `StatusBadge` in a header row. Below: `WorkflowStepIndicator` (step 3 of 7 active). Below: `RoutingHistoryTimeline` (five entries). Below: `ScanQualityIndicator` inline with a filename. Below: `QRCodeDisplay`.
>
> **Section 3 — Order of Business composition.** Render three `OrderOfBusinessRow` instances in a mock session table — normal, Certified Urgent, missing-report. Below each row show the expanded `CommitteeReferralBlock`.
>
> **Acceptance criteria:**
>
> - [ ] No visual proportion mismatch between `DocumentNumberBadge` and `StatusBadge` when side by side in a table row
> - [ ] `WorkflowStepIndicator` connector lines align correctly with step nodes at all viewport widths from 375px to 1440px
> - [ ] `SLATimer` progress bar does not overflow its container in any state
> - [ ] `OrderOfBusinessRow` red-flag icon does not shift the row height relative to normal rows
> - [ ] All compositions reviewed and approved by project lead before first feature page PR begins

---

### Execution Order

```
Foundation PR
└── Tier 3 Group A — layout shell (no inter-component dependencies)
    ├── PageHeader
    ├── Sidebar
    ├── Topbar
    └── AppShell  ← depends on Sidebar + Topbar; build last in Group A

    [J6 must exist before Group B/C — confirmed present at j6-domain-component-engineering-reference.md]

└── Tier 3 Group B — standalone display (no Tier 3 dependencies)
    ├── DocumentNumberBadge
    ├── StatCard
    ├── EmptyState
    ├── ScanQualityIndicator
    ├── SLATimer
    ├── RoutingHistoryTimeline
    └── QRCodeDisplay

└── Tier 3 Group C — needs J6 types or depends on Group B
    ├── CommitteeReferralBlock
    ├── StatusBadge          ← needs STATUS_META from J6
    └── WorkflowStepIndicator ← needs WorkflowStep type from J6

└── Tier 3 Group D — depends on Group B + C
    ├── DocumentPreviewCard  ← needs DocumentNumberBadge + StatusBadge + SLATimer
    └── OrderOfBusinessRow   ← needs DocumentNumberBadge + StatusBadge (not CommitteeReferralBlock — resolved by the A1 UI module pass per J6 §3.16; see row 16 above)

└── Cross-component integration page (/dev/all-components)

└── First feature page PRs begin
```

Groups A and B can run in parallel with each other. Groups C and D are sequenced strictly. J6 is confirmed to exist in the repo at `docs/pre-development/J-software-design-patterns-and-standards/j6-domain-component-engineering-reference.md` — no blocking dependency on it for Group A or B.

---

### On Plans 0, 1, 2: Prompt Directly or Wait for A1?

**Do not prompt them directly. They belong in A1.**

Plans 0, 1, and 2 are implementation work — real code PRs going into the repository. A1 is defined in document-list.md as "the primary AI-assisted development driver" where "each task contains a self-contained AI prompt to execute the task." That is exactly what Plans 0, 1, and 2 are. Putting them outside A1 creates two parallel task systems, which immediately creates drift — someone follows A1 for backend work and follows a separate document for frontend work, and the dependency tracking between them breaks.

The concrete problem with prompting them directly: A1 does not exist yet. A1 is the document that enforces dependency ordering across all 11 modules, assigns phase labels, and ensures no task is executed before its prerequisite task is merged. If you run Plan 0 now as a standalone prompt, you have a foundation PR with no task ID, no prerequisite chain, no acceptance criteria tracked in the master list, and no way for A1 to reference it as a completed dependency when generating subsequent tasks.

What you do now with Plans 0, 1, and 2 is treat them as the template input that informs how A1 generates the frontend tasks. When A1 is generated, the prompt for the UI module pass includes this F7 document alongside F4, F5, F6, and J6. A1 then produces task entries for the foundation PR (Plan 0), each Tier 3 component (Plan 1 instantiated 16 times), and the integration page (Plan 2) — each with a task ID, prerequisite task IDs, deliverables checklist, and the self-contained AI prompt derived from the templates here.

The order is: generate A1 (supplying this F7 document as a UI module pass input) → execute tasks from A1 in dependency order.
