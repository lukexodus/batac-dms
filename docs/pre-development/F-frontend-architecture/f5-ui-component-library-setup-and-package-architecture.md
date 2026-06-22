# F5 — UI Component Library Setup and Package Architecture

`batac-dms` · `packages/ui` · `@batac/ui` · Version 1.0
**Status:** Pre-development specification
**Audience:** Development team — internal reference only
**Source files:** `DESIGN.md` v1.0, `globals.css`, `button.tsx`, `tabs.tsx`, `avatar.tsx`, `components.json`, `INSTALL.sh`, `date-locale.ts`, `utils.ts`, consolidated architecture reference (Parts 2, 9, 10, 13), `tech-stack.md`

## Table of Contents

- [L26–L31] 1. Package Identity and Scope — Defines @batac/ui boundaries, design tokens, component types, and exclusion of business logic, server state, and Zod schemas.
- [L32–L51] 2. Confirmed Technology Lock-in — Table of settled package technologies including Tailwind v4, shadcn/ui configuration, CVA usage, icon/date libraries, and form constraints.
- [L52–L66] 3. Confirmed Deviations from DESIGN.md — Tracks design deviations, contrast corrections, added tokens, syntax adaptations, and positional conflicts between production code and DESIGN.md.
- [L67–L595] 4. Component Inventory — Group header for Tier 1 primitives, Tier 2 CVA overrides, and Tier 3 domain compound components.
  - [L69–L101] 4.1 Tier 1 — shadcn Primitives, Used As-Is — Roster of 20 unmodified shadcn components, CLI installation details, custom-color/RSC cleanup checks, and badge type distinctions.
  - [L102–L153] 4.2 Tier 2 — shadcn Primitives with CVA Overrides — Specifications for custom CVA overrides of Button (8 variants), Tabs (underline style), and Avatar (deterministic hashing).
  - [L154–L595] 4.3 Tier 3 — Domain Compound Components — Construction rules, overview table, and props interface specifications for 16 custom, domain-specific legislative and layout components.
- [L596–L615] 5. Token Exposure and CSS Consumption Rules — Rules for importing globals.css, theme token utilities, global font loading, and resolving the date-fns-tz package installation gap.
- [L616–L704] 6. Package Export Map — Configuration of package.json exports mapping and the index.ts barrel file re-exporting all public library APIs.
- [L705–L739] 7. PR Boundary Definition — Foundation vs. Feature — Phased rollout plan separating the initial UI foundation PR checklist and acceptance criteria from subsequent Tier 3 feature work.
- [L740–L761] 8. Runbook: Adding a Component — Step-by-step instructions for installing Tier 1 shadcn primitives and implementing Tier 3 domain components with proper standards.

---

---

## 1. Package Identity and Scope

`@batac/ui` is the single shared React component library for the `batac-dms` monorepo, located at `packages/ui` and consumed by `apps/web` (the internal Vite SPA) and, in Phase 3, by `apps/portal` (the public Next.js citizen portal). The package owns four categories of output: (1) the design token layer — `src/styles/globals.css`, which contains the `:root` CSS custom property block, the Tailwind v4 `@theme {}` extension, and the shadcn/ui HSL variable map, and which is the single source of truth for every color, radius, shadow, and spacing value in the system; (2) shadcn/ui primitive components installed via the CLI and stored as owned source code under `src/components/ui/`, where they can be modified freely without waiting for upstream releases; (3) three CVA-extended overrides of those primitives where the batac-dms design system diverges from shadcn defaults (`Button`, `Tabs`, `Avatar`); and (4) sixteen domain compound components that encode government-document–specific visual logic (`DocumentNumberBadge`, `StatusBadge`, layout shell, and others), living under `src/components/domain/`. The package additionally owns `src/lib/utils.ts` (the `cn()` utility combining `clsx` and `tailwind-merge`) and `src/lib/date-locale.ts` (the `phLocale` customization of `date-fns` `enUS`, the `PH_TIMEZONE` constant, and the `DATE_FORMATS` display-format map). `@batac/ui` explicitly does not own server state, business logic, tRPC router types, or Zod validation schemas — those belong to `packages/shared` and `apps/server`. Any Tier 3 domain component that needs a domain type (e.g., `DocumentState` for `StatusBadge`) receives it as a TypeScript prop whose canonical definition lives in `packages/shared` and is imported by both the component and its consumer; the component is never the source of truth for a domain type.

---

## 2. Confirmed Technology Lock-in

Every decision in this table is irrevocably settled for `packages/ui`. Deviations require a written ADR and a migration plan, not a local workaround.

| Decision | Source | Consequence of deviation |
|---|---|---|
| **Tailwind CSS v4** — tokens declared in `@layer base {:root {}}` and extended via `@theme {}` in `globals.css`; `@import "tailwindcss"` at file top; no `tailwind.config.ts` in production | `globals.css` line 16: `@import "tailwindcss";`; `INSTALL.sh` Step 4: `pnpm add -D tailwindcss --filter @batac/ui` | A `tailwind.config.ts` file in `packages/ui` does not feed the `@theme {}` block and will not generate token-based utilities. DESIGN.md §4's `tailwind.config.ts` is a documentation reference only, not the production file. |
| **shadcn/ui with `rsc: false`** | `components.json` line 4: `"rsc": false` | Components must not carry `"use client"` directives. `packages/ui` targets a Vite SPA with no RSC support; the directive is dead code. Any component added via the CLI must be checked for the directive and have it removed. (The existing `tabs.tsx` carries it as a CLI artifact — it is harmless in Vite but must not be propagated to new components.) |
| **CVA (`class-variance-authority`)** for all multi-variant components | `button.tsx`, `tabs.tsx`, `avatar.tsx`; `INSTALL.sh` Step 1: `pnpm add class-variance-authority --filter @batac/ui` | Inline ternary variant logic in JSX breaks the pattern established by all three Tier 2 overrides and makes variant auditing impractical. Every component with more than one visual state uses CVA. |
| **`clsx` + `tailwind-merge`** composed as `cn()` in `src/lib/utils.ts` | `utils.ts`; `INSTALL.sh` Step 1: `pnpm add clsx tailwind-merge --filter @batac/ui` | `clsx` alone does not resolve Tailwind class conflicts (two `bg-*` on the same element keeps both). `tailwind-merge` alone does not handle conditional class objects. Both must be composed via the `cn()` helper on every component. Neither can be substituted. |
| **Lucide** as the sole icon library | `components.json` line 20: `"iconLibrary": "lucide"`; DESIGN.md §2 adaptation table (Lucide replaces emoji substitution) | No other icon libraries (Font Awesome, Heroicons, Material Icons) may be introduced. All icon-only interactive elements require `aria-label` per DESIGN.md §8 Rule 5. |
| **Sonner** for all toast notifications | `INSTALL.sh` Step 2: `sonner` in CLI list; `globals.css` resolved decisions: "Toast: Sonner (confirmed)" | Any custom toast component from kitchen-sink.jsx is superseded. All imperative calls use `import { toast } from "sonner"` directly. The `<Toaster>` provider is registered once in `apps/web/src/main.tsx`. |
| **Radix UI primitives** as the accessibility foundation | Installed transitively by every shadcn component; `INSTALL.sh` Step 1: `pnpm add @radix-ui/react-slot --filter @batac/ui` | Radix provides ARIA roles, keyboard navigation, and focus trapping. Raw HTML `<div>` replacements for dropdowns, dialogs, and tooltips will break keyboard accessibility and screen reader support. |
| **`date-fns`** for all date operations; never moment.js | `date-locale.ts` line 1: `import { enUS } from "date-fns/locale"`; `INSTALL.sh` Step 1: `pnpm add date-fns --filter @batac/ui`; `tech-stack.md`: "never moment.js" | `moment.js` is excluded by policy. `day.js` and `luxon` are not confirmed and must not be introduced. All formatting uses `date-fns/format` with `phLocale` and the `DATE_FORMATS` constants from `src/lib/date-locale.ts`. |
| **No `<form>` HTML elements** anywhere in this package | DESIGN.md §8 Rule 8 | All form interactions use `onClick`/`onChange` React event handlers. Containers are `<div>` or `<section>`. This is a non-negotiable platform architecture constraint documented as Rule 8. |
| **No hardcoded hex, HSL, or RGB values** in any component | DESIGN.md §3 (token dictionary), §8 Rule 7 | All color references use Tailwind utility classes generated from the `@theme {}` block (e.g., `bg-primary-800`, `text-text-muted`, `border-border-default`). Inline `style={{ color: '#162e60' }}` is prohibited. |
| **No `"use client"` directive** in new domain components | `components.json` `"rsc": false`; Vite SPA target | The Vite SPA in `apps/web` has no RSC build pipeline. The directive is a Next.js RSC concept. Do not add it to any Tier 3 component. The existing `tabs.tsx` carries it as a shadcn CLI generation artifact only. |

---

## 3. Confirmed Deviations from DESIGN.md

These entries record every place where the production implementation files diverge from DESIGN.md. Each entry is classified as **errata** (DESIGN.md contains an error requiring correction), **adaptation** (same intent expressed in v4 syntax), **extension** (valid addition not yet documented), or **conflict** (two sources contradict each other, requiring resolution before implementation).

| # | Deviation | Production value | DESIGN.md value | Introduced in | Classification | Required action |
|---|---|---|---|---|---|---|
| 1 | `--color-text-muted` | `#5a6470` — 6.01:1 contrast on white ✅ WCAG AA | `#868e96` — 3.8:1 contrast on white ❌ fails WCAG AA | `globals.css` line 132, labeled "CONTRAST CORRECTION" | **Errata** — DESIGN.md §3 specifies an inaccessible value | Update DESIGN.md §3 TEXT block and §9 Typography Specimen muted entries to `#5a6470` |
| 2 | Extra danger scale tokens: `danger-50 (#fef2f2)`, `danger-200 (#fecaca)`, `danger-700 (#b91c1c)` | Present in `globals.css` `:root` (lines 94–98) and `@theme {}` block | Absent from DESIGN.md §3 — only `danger-100`, `danger-500`, `danger-900` are defined | `globals.css` comment: "kitchen-sink.jsx uses danger-50, danger-200, danger-700 which are not in DESIGN.md §3" | **Errata** — DESIGN.md §3 danger token set is incomplete | Add `danger-50`, `danger-200`, `danger-700` to DESIGN.md §3 danger token block |
| 3 | Extra success token: `success-300 (#6ee7b7)` | Present in `globals.css` `:root` (line 76) and `@theme {}` block | Absent from DESIGN.md §3 — only `success-100`, `success-500`, `success-900` are defined | `globals.css` comment: "kitchen-sink.jsx also uses success-300 (#6ee7b7) for DEEMED_APPROVED border accent" | **Errata** — DESIGN.md §3 success token set is incomplete; §7 DEEMED_APPROVED left-border references `#6ee7b7` without a named token | Add `success-300` to DESIGN.md §3 success token block; update §7 DEEMED_APPROVED row to reference the named token |
| 4 | Tailwind configuration method | Tailwind v4 `@theme {}` block inside `src/styles/globals.css` — single file, single source of truth | DESIGN.md §4 presents a `tailwind.config.ts` file with an `extend` block | `globals.css` `@theme {}` block (confirmed 2026-06-19) | **Adaptation** — identical token values, different v4 syntax; DESIGN.md §4 is a documentation reference, not a production artefact | Add a note to DESIGN.md §4 stating that `tailwind.config.ts` is a reference only and that the production extension point is the `@theme {}` block in `globals.css` |
| 5 | `AvatarName` background color palette uses `bg-info-900` | `bg-info-900` (`#1e3a8a`) is one of six entries in `AVATAR_COLORS` in `avatar.tsx` (line 94) | `info-900` is defined as a token in DESIGN.md §3 but is not referenced in the §6.6 avatar color palette description (which contains no palette specification at all) | `avatar.tsx` `AVATAR_COLORS` constant | **Extension** — the token is valid (defined in §3) but its avatar usage is undocumented in §6.6 | Update DESIGN.md §6.6 "Avatar + Name" subsection to document the full six-color deterministic palette |
| 6 | Toaster position | `INSTALL.sh` Step 5 comment specifies `position="top-right"` | DESIGN.md §6.5 specifies bottom-right: `Position: Bottom-right (bottom-4 right-4)` | `INSTALL.sh` Step 5 comment (line 92) | **Conflict** — two authoritative sources contradict each other | Decide the canonical position before implementing the Toaster registration. DESIGN.md is the design system reference; `bottom-right` is recommended unless there is a documented UX rationale for `top-right`. Whichever is chosen, update the other source. |

---

## 4. Component Inventory

### 4.1 Tier 1 — shadcn Primitives, Used As-Is

These twenty components are installed via the shadcn CLI during the foundation PR and stored as owned source code under `src/components/ui/` without modification. All twenty are installed in the single Step 2 CLI invocation in `INSTALL.sh`. [Confirmed — `INSTALL.sh` lines 24–47]

After installation, each generated file must be inspected for two issues: (a) hardcoded hex or HSL values that do not map to the batac-dms `@theme {}` token utilities — replace with the equivalent token class; (b) the `"use client"` directive — remove it per the `rsc: false` constraint.

**Critical distinction:** The shadcn `Badge` component is a general-purpose inline label primitive. It is not the document-lifecycle `StatusBadge`. `StatusBadge` (Tier 3) implements the full 17-state color map from DESIGN.md §7 using its own CVA configuration and is not derived from shadcn `Badge`. The shadcn `Badge` is used for committee referral chips, file-format indicators in the upload zone, and unread count labels — contexts requiring no semantic workflow state mapping.

| Component | `shadcn add` argument | Export path | Primary usage in batac-dms |
|---|---|---|---|
| Card | `card` | `@batac/ui/components/ui/card` | `StatCard` base (Tier 3), `DocumentPreviewCard` base (Tier 3), generic panel wrappers throughout the SP Secretary and Mayor dashboards |
| Input | `input` | `@batac/ui/components/ui/input` | All form text inputs: document title, routing notes, search fields, inline edit fields |
| Textarea | `textarea` | `@batac/ui/components/ui/textarea` | Mandatory comment fields in workflow-advance dialogs; routing remarks; rejection rationale fields |
| Label | `label` | `@batac/ui/components/ui/label` | All form field labels; required field marker `*` is applied as a `text-danger-500` sibling of the label element, not inside it |
| Separator | `separator` | `@batac/ui/components/ui/separator` | Horizontal section dividers within drawers and multi-section forms; most page-level dividers use `border-b border-border-default` utility classes directly per DESIGN.md §6.1 |
| Skeleton | `skeleton` | `@batac/ui/components/ui/skeleton` | Table row placeholders during initial load; stat card value placeholders; document thumbnail loading in `DocumentPreviewCard` (Tier 3) |
| Badge | `badge` | `@batac/ui/components/ui/badge` | Committee referral chips in `OrderOfBusinessRow` (Tier 3); file-format chips (`.PDF`, `.DOCX`) in upload zones; unread count labels in sidebar nav items |
| Dialog | `dialog` | `@batac/ui/components/ui/dialog` | Destructive action confirmation modals; mandatory-comment dialogs for SP Secretary workflow override (comment textarea required before confirm button enables) |
| Sheet | `sheet` | `@batac/ui/components/ui/sheet` | Right-side document preview drawer (`w-96` minimum, `w-[480px]` for preview per DESIGN.md §6.5); routing detail side panel |
| Tooltip | `tooltip` | `@batac/ui/components/ui/tooltip` | Required on every icon-only button; required on truncated text; collapsed sidebar icon labels; 500ms show delay per DESIGN.md §6.5 |
| Table | `table` | `@batac/ui/components/ui/table` | All document queue views, session attendance tables, committee tables — paired with TanStack Table for sorting/filtering logic (`apps/web` concern) |
| Alert | `alert` | `@batac/ui/components/ui/alert` | Persistent inline SLA breach warnings; missing committee report banners; RETURNED-document notices; uses `border-l-4` left-accent pattern per DESIGN.md §6.5 |
| Command | `command` | `@batac/ui/components/ui/command` | ⌘K / Ctrl+K command palette inner panel; searchable Combobox and Select patterns (Command nested inside Popover) |
| Popover | `popover` | `@batac/ui/components/ui/popover` | Date picker trigger (Calendar nested inside Popover); Combobox dropdown; user account menu in Topbar (Tier 3) |
| Select | `select` | `@batac/ui/components/ui/select` | Office selector, document type selector, committee selector, session-filter dropdowns — for four or more options per DESIGN.md §6.4 |
| Checkbox | `checkbox` | `@batac/ui/components/ui/checkbox` | Row selection in data tables; multi-select form fields |
| Calendar | `calendar` | `@batac/ui/components/ui/calendar` | Date picker inner component nested inside Popover; week start configured via `phLocale` from `src/lib/date-locale.ts` (Monday) |
| Chart | `chart` | `@batac/ui/components/ui/chart` | Recharts wrapper utilities (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`) for SP Secretary and Mayor dashboard panels; Recharts itself is installed in `apps/web` per `INSTALL.sh` Step 3 |
| Breadcrumb | `breadcrumb` | `@batac/ui/components/ui/breadcrumb` | Page breadcrumb trail in `Topbar` (Tier 3); separator is a `/` literal character, not an icon, per DESIGN.md §6.2 |
| Sonner | `sonner` | `@batac/ui/components/ui/sonner` | Exports the `<Toaster>` provider component, registered once in `apps/web/src/main.tsx`; imperative `toast.success()` / `toast.error()` etc. import `toast` from the `sonner` npm package directly, not from this path |

---

### 4.2 Tier 2 — shadcn Primitives with CVA Overrides

Three shadcn components are replaced wholesale with batac-dms customisations. After the Step 2 CLI invocation, the generated files at `src/components/ui/button.tsx`, `src/components/ui/tabs.tsx`, and `src/components/ui/avatar.tsx` are overwritten with the custom versions per `INSTALL.sh` Step 2 NOTE. [Confirmed — `INSTALL.sh` lines 49–53] These three files are the source of truth; they must never be regenerated by the CLI.

#### Button

**Original shadcn behaviour:** `variant="default"` uses the `--primary` HSL variable, which maps to a zinc-based colour in shadcn's default theme. No `primary` alias variant. No `ghost-danger` variant. No `xs` or `icon-sm` sizes.

**Changes in `packages/ui/src/components/ui/button.tsx`:** [Confirmed — `button.tsx`]

| Change | Exact CVA value | Rationale |
|---|---|---|
| `variant="default"` restyles to brand navy | `bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-950` | Shadcn's zinc `--primary` has no semantic meaning here; brand navy is the primary action colour per DESIGN.md §2 adaptation table |
| `variant="primary"` added as alias | Identical styles to `variant="default"` | Migration bridge: kitchen-sink.jsx uses `variant="primary"` throughout; this alias avoids a mass rename before the codebase stabilises [per `button.tsx` source comment] |
| `variant="ghost-danger"` added | `text-danger-500 hover:bg-danger-50 hover:text-danger-700 active:bg-danger-100` | Delete actions in overflow menus; not explicitly in DESIGN.md but confirmed present in kitchen-sink.jsx usage per `button.tsx` comment [Confirmed — `button.tsx` line 60–65] |
| `size="xs"` added | `h-6 px-2 text-xs rounded-sm` | Used in `WorkflowStepIndicator` (Tier 3); below the 44px touch-target minimum — wrap with `.touch-exempt` container per DESIGN.md §8 Rule 11 [Confirmed — `button.tsx` lines 78–83] |
| `size="icon-sm"` added | `h-8 w-8` | Toolbar icon buttons requiring a smaller square than the 40px standard `icon` size [Confirmed — `button.tsx` lines 96–98] |
| `variant="outline"` retained | `border border-border-default bg-white text-text-primary hover:bg-surface-raised` | shadcn internal compatibility alias for `secondary`; prevents shadcn-generated components referencing `outline` from erroring |

Full variant roster confirmed in `button.tsx`: `default`, `primary`, `secondary`, `destructive`, `ghost`, `ghost-danger`, `link`, `outline` (8 variants). Full size roster: `xs`, `sm`, `default`, `lg`, `icon`, `icon-sm` (6 sizes).

---

#### Tabs

**Original shadcn behaviour:** `TabsList` renders a pill/background style (`bg-neutral-100 rounded-lg`). `TabsTrigger` uses a background colour indicator for the active state. No bottom-border underline variant.

**Changes in `packages/ui/src/components/ui/tabs.tsx`:** [Confirmed — `tabs.tsx`]

| Change | Exact CVA value | Rationale |
|---|---|---|
| `variant="underline"` on `TabsList` | `h-auto border-b border-border-default bg-transparent gap-0 w-full` | Document detail panel sub-navigation (Overview / Workflow / History / Attachments) uses bottom-border underline per DESIGN.md §6.2 |
| `variant="underline"` on `TabsTrigger` | Base: `rounded-none px-4 py-2.5 border-b-2 border-transparent`; active: `data-[state=active]:border-primary-800 data-[state=active]:text-primary-800 data-[state=active]:font-semibold`; hover: `hover:border-neutral-300` | Per DESIGN.md §6.2 active/inactive tab class specifications |
| `variant="default"` preserved unchanged | Original shadcn pill/background style | Retained for contexts where a background-style tab group is appropriate (settings panels, etc.) |
| `"use client"` directive present at line 19 | — | Carried over from shadcn CLI generation [Confirmed — `tabs.tsx` line 19]. Harmless in the Vite SPA context (`rsc: false`). **Do not propagate this directive to any new Tier 3 domain component.** |

---

#### Avatar

**Original shadcn behaviour:** A single root size with no size variants. No initials generation. No deterministic colour assignment.

**Changes in `packages/ui/src/components/ui/avatar.tsx`:** [Confirmed — `avatar.tsx`]

| Change | Detail | Rationale |
|---|---|---|
| `size` CVA variant added to `Avatar` root | `sm = h-6 w-6` (24px); `md = h-8 w-8` (32px, default); `lg = h-10 w-10` (40px) | DESIGN.md §6.6 specifies three distinct sizes: `h-6 w-6` for table cells, `h-8 w-8` for inline timelines, `h-10 w-10` for profile/topbar contexts |
| `AvatarName` compound component added | Generates initials via `getInitials(name)` (first character of first word + first character of last word, uppercased); assigns background colour via `getColorClass(name)` using a `(hash * 31 + charCode) >>> 0` hash modulo the palette length | Per DESIGN.md §6.6 "Avatar + Name" spec; matches kitchen-sink.jsx `AvatarName` behaviour per `avatar.tsx` comment |
| Six-colour deterministic palette | `bg-primary-700`, `bg-info-900`, `bg-success-900`, `bg-warning-900`, `bg-neutral-700`, `bg-danger-900` [Confirmed — `avatar.tsx` lines 92–99] | All six pass WCAG AA contrast with white text per `avatar.tsx` comment. Same name always maps to the same colour across renders and across sessions. |

---

### 4.3 Tier 3 — Domain Compound Components

Sixteen domain compound components encode batac-dms–specific visual logic that no Tier 1 primitive can express alone. None exists yet; all are built in Phase 1 feature PRs as they are needed. Each ships in the PR for the first Phase 1 feature that requires it.

**Construction rules for all Tier 3 components (non-negotiable):**

- Only Tailwind utility classes from the `@theme {}` block. No hardcoded hex, HSL, or RGB values anywhere.
- Compose only from named Tier 1 and Tier 2 primitives listed per-component below.
- All ARIA attributes specified in the relevant DESIGN.md §6 subsection must be present.
- No `<form>` HTML elements. Containers are `<div>` or `<section>`. [DESIGN.md §8 Rule 8]
- No `"use client"` directive. [`components.json` `"rsc": false`]
- Apply `.touch-exempt` class to non-actionable chips and badges. [DESIGN.md §8 Rule 11]
- Domain types referenced in props interfaces (e.g., `DocumentState`) are defined in `packages/shared` and imported — never redefined locally.

**Overview table:**

| Component | Export path | DESIGN.md ref | Composes | Ships in Phase 1 feature |
|---|---|---|---|---|
| `DocumentNumberBadge` | `@batac/ui/components/domain/DocumentNumberBadge` | §6.3, §7 Doc rows | — (pure Tailwind) | Document queue table |
| `StatusBadge` | `@batac/ui/components/domain/StatusBadge` | §6.3, §7 full state map | — (CVA + pure Tailwind) | Document queue table |
| `WorkflowStepIndicator` | `@batac/ui/components/domain/WorkflowStepIndicator` | §6.3 | `Tooltip` (T1) | Resolution / Ordinance detail view |
| `SLATimer` | `@batac/ui/components/domain/SLATimer` | §6.3, §8 Rule 6 | — | Document in PENDING\_MAYOR state |
| `ScanQualityIndicator` | `@batac/ui/components/domain/ScanQualityIndicator` | §6.3 | `Tooltip` (T1) | Document upload / secretariat logging |
| `RoutingHistoryTimeline` | `@batac/ui/components/domain/RoutingHistoryTimeline` | §6.3 | `AvatarName` (T2) | Document detail History tab; QR scan result |
| `StatCard` | `@batac/ui/components/domain/StatCard` | §6.3 | `Card` (T1) | SP Secretary dashboard |
| `EmptyState` | `@batac/ui/components/domain/EmptyState` | §6.3, §8 Rule 9 | `Button` (T2) | Document queue (zero results) |
| `OrderOfBusinessRow` | `@batac/ui/components/domain/OrderOfBusinessRow` | §6.6, arch ref Part 4.18 | `Badge` (T1), `Tooltip` (T1) | SP Secretary dashboard OOB view |
| `CommitteeReferralBlock` | `@batac/ui/components/domain/CommitteeReferralBlock` | §6.6 | `Badge` (T1), `AvatarName` (T2) | Document detail workflow tab |
| `DocumentPreviewCard` | `@batac/ui/components/domain/DocumentPreviewCard` | §6.6 | `Card` (T1), `Skeleton` (T1), `DocumentNumberBadge` (T3), `StatusBadge` (T3) | Document list / search results |
| `QRCodeDisplay` | `@batac/ui/components/domain/QRCodeDisplay` | §6.6, arch ref Part 11.6 | — | Document detail; QR scan result view |
| `AppShell` | `@batac/ui/components/domain/AppShell` | §6.1 | `Sidebar` (T3), `Topbar` (T3) | All authenticated views (foundation) |
| `Sidebar` | `@batac/ui/components/domain/Sidebar` | §6.1, §8 Rule 3 | `Tooltip` (T1), `AvatarName` (T2) | All authenticated views (foundation) |
| `Topbar` | `@batac/ui/components/domain/Topbar` | §6.1, §6.2 | `Breadcrumb` (T1), `Tooltip` (T1), `AvatarName` (T2), `Popover` (T1) | All authenticated views (foundation) |
| `PageHeader` | `@batac/ui/components/domain/PageHeader` | §6.1 | `Button` (T2) | All authenticated routed views (foundation) |

**Per-component props interfaces:**

The interfaces below are specifications derived from DESIGN.md §6 guidelines and the consolidated architecture reference. They are not confirmed implementations. [Inference — derived from DESIGN.md and architecture ref; no kitchen-sink.jsx available for cross-reference]

---

#### `DocumentNumberBadge`

Renders a document reference number always in `font-mono`, never truncated. Final enacted documents carry a 2px solid `primary-800` left border and `primary-50` background. Preliminary drafts carry a dashed `neutral-400` border, italic text, and `neutral-50` background. Applies `.touch-exempt` as the badge is not itself interactive. [Confirmed — DESIGN.md §6.3 Document Number Badge; §7 Doc: PRELIMINARY and Doc: FINAL rows]

```typescript
interface DocumentNumberBadgeProps {
  /** Formatted document number string, e.g. "7SP 2026-001" or "Draft 7SP 2026-02" */
  number: string;
  /** "final" → solid primary-800 left border; "preliminary" → dashed neutral border, italic */
  variant: 'final' | 'preliminary';
  className?: string;
}
```

---

#### `StatusBadge`

Maps each workflow and complaint state to the background colour, text colour, and left-border accent defined in DESIGN.md §7. Implemented as a CVA component with one case per `DocumentState` member. All styling uses token utilities from the `@theme {}` block. Applies `.touch-exempt`. The `DocumentState` union type is the canonical domain type defined in `packages/shared`. [Confirmed — DESIGN.md §6.3 Status Badge; §7 complete state colour map]

```typescript
/**
 * Full union of document lifecycle and complaint states from DESIGN.md §7.
 * Canonical definition belongs in packages/shared; imported here for the interface.
 */
type DocumentState =
  | 'DRAFT'
  | 'IN_COMMITTEE'
  | 'FIRST_READING'
  | 'SECOND_READING'
  | 'THIRD_READING'
  | 'PENDING_MAYOR'
  | 'LAPSED'
  | 'VETOED'
  | 'OVERRIDE_PENDING'
  | 'PANLALAWIGAN_REVIEW'
  | 'VALID'
  | 'VALID_IN_PART'
  | 'RETURNED'
  | 'DEEMED_APPROVED'
  | 'ARCHIVED'
  | 'CANCELLED'
  | 'PENDING_HEARING'    // complaint state
  | 'DISMISSED'          // complaint state
  | 'RESOLVED'           // complaint state
  | 'CERTIFIED_URGENT'   // tag overlay, not a primary document state
  | 'SLA_AT_RISK'        // computed overlay
  | 'SLA_BREACHED'       // computed overlay
  | 'MISSING_REPORT';    // computed overlay, triggers red-flag row treatment

interface StatusBadgeProps {
  state: DocumentState;
  className?: string;
}
```

---

#### `WorkflowStepIndicator`

Renders the legislative workflow position as a horizontal connector bar on viewports ≥768px and as a vertical list below that breakpoint. Each step node is coloured by per-step state: completed → `success-500`; active → `primary-800`; pending → `neutral-200`; skipped → `neutral-100` with dashed border; error → `danger-500`. Connector lines between completed steps render in `success-500`; all others in `neutral-200`. Step labels on active steps render in `font-semibold`. [Confirmed — DESIGN.md §6.3 Workflow Step Indicator]

```typescript
type WorkflowStepState = 'completed' | 'active' | 'pending' | 'skipped' | 'error';

interface WorkflowStep {
  id: string;
  label: string;
  state: WorkflowStepState;
  /** Optional text shown in Tooltip on hover */
  tooltip?: string;
  /** When this step was completed — enables tooltip content with exact completion timestamp */
  completedAt?: Date;
  /** Current or past assignee, displayed below the active step label */
  assigneeName?: string;
}

interface WorkflowStepIndicatorProps {
  steps: WorkflowStep[];
  currentStepId: string;
  /**
   * Explicit orientation override; component also switches to 'vertical'
   * via CSS responsive classes below 768px.
   */
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}
```

---

#### `SLATimer`

Displays elapsed/remaining time as a labelled progress bar. Derives its three visual states from the percentage of the SLA window elapsed: on-track (< 80%, `success` palette), at-risk (≥ 80%, `warning` palette + pulsing dot), breached (≥ 100%, `danger` palette + `animate-pulse`). Must carry `role="timer"`, `aria-label`, and `aria-live="polite"` per DESIGN.md §6.3. Must not be rendered on documents in `VALID`, `ARCHIVED`, `CANCELLED`, `DRAFT`, or `VETOED` states — the consuming view is responsible for conditional rendering. [Confirmed — DESIGN.md §6.3 SLA Timer; §8 Rule 6]

```typescript
interface SLATimerProps {
  /** When the SLA window expires */
  deadlineAt: Date;
  /** When the SLA clock started (document entered a time-constrained state) */
  startedAt: Date;
  /** Human-readable label, e.g. "Mayor review (10-day)" or "Panlalawigan review (30-day)" */
  label: string;
  className?: string;
}
```

---

#### `ScanQualityIndicator`

Colour-coded label indicating the OCR scan quality level derived from a 0–100 score. The four levels and their token colours are specified in DESIGN.md §6.3: Excellent (≥ 95%) → `text-success-500`; Good (80–94%) → `text-info-500`; Fair (60–79%) → `text-warning-500`; Poor (< 60%) → `text-danger-500`. Used in the document upload zone after automatic OCR processing (all uploads trigger OCR per the consolidated architecture reference Part 11.4) and in the attachment file list. [Confirmed — DESIGN.md §6.3 Scan Quality Indicator; arch ref Part 11.4]

```typescript
interface ScanQualityIndicatorProps {
  /** 0–100. Component derives level (Excellent / Good / Fair / Poor) internally. */
  score: number;
  /** When true, renders the level label text alongside the colour indicator; otherwise icon/dot only */
  showLabel?: boolean;
  className?: string;
}
```

---

#### `RoutingHistoryTimeline`

Vertical timeline of every routing event in a document's lifecycle. Left column: a continuous connecting line with a coloured dot per entry — `info` for Transmitted, `success` for Approved, `danger` for Returned, `neutral` for Filed. Right column: actor name (rendered via `AvatarName`, Tier 2), action label, office name, and timestamp. Timestamps render in `font-mono text-xs text-text-muted` per DESIGN.md §6.3 and the §9 monospace timestamp specimen. [Confirmed — DESIGN.md §6.3 Routing History Timeline; arch ref Part 11.6]

```typescript
/**
 * Known action types from DESIGN.md §6.3. String intersection allows
 * future extension without breaking the type.
 */
type RoutingActionType =
  | 'Transmitted'
  | 'Approved'
  | 'Returned'
  | 'Filed'
  | (string & {});

interface RoutingEntry {
  id: string;
  actorName: string;
  actorOfficeName: string;
  action: RoutingActionType;
  fromOfficeName?: string;
  toOfficeName?: string;
  timestamp: Date;
  /** Free-text note attached to this routing event */
  notes?: string;
}

interface RoutingHistoryTimelineProps {
  entries: RoutingEntry[];
  className?: string;
}
```

---

#### `StatCard`

Dashboard metric card showing one top-level KPI at a glance. Metric value renders in `text-3xl font-bold text-text-primary`. Label renders in `text-xs font-semibold uppercase tracking-wide text-text-muted`. Optional trend renders in `text-success-500` (up) or `text-danger-500` (down) with a `text-xs font-medium` value. Composes shadcn `Card` with `p-4 rounded-lg border border-border-default shadow-sm`. [Confirmed — DESIGN.md §6.3 Stat Card; §9 "Dashboard Metric" and "Dashboard Metric Label" specimen entries]

```typescript
interface StatCardTrend {
  value: number;
  direction: 'up' | 'down';
  /** Optional context label, e.g. "from last week" */
  label?: string;
}

interface StatCardProps {
  metric: string | number;
  label: string;
  trend?: StatCardTrend;
  className?: string;
}
```

---

#### `EmptyState`

Centred empty state for tables, queues, and search results. Lucide icon renders at 48px with `text-neutral-300`. Heading renders in `text-lg font-semibold text-text-secondary`. Body renders in `text-sm text-text-muted`. Optional action renders via `Button` (Tier 2, `variant="default"`). Copy must be directive, not apologetic — per DESIGN.md §8 Rule 9: state what is empty, then state what action creates content. [Confirmed — DESIGN.md §6.3 Empty State; §8 Rule 9]

```typescript
import type { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  /** Directive heading, e.g. "No documents in queue" */
  heading: string;
  /** Directive body, e.g. "Upload a resolution to begin workflow." */
  body: string;
  action?: EmptyStateAction;
  className?: string;
}
```

---

#### `OrderOfBusinessRow`

One row in the session Order of Business view. Left-to-right layout: monospace agenda number, `DocumentNumberBadge` (Tier 3), title (truncated, `flex-1`), committee chips (shadcn `Badge`, Tier 1), report status chip (shadcn `Badge`), Lucide `Flag` icon with `Tooltip` when a committee report is missing. When `isMissingReport` is true, the row background becomes `bg-danger-50`. When `isCertifiedUrgent` is true, a `bg-warning-100 text-warning-900` chip reading "CERTIFIED URGENT" is prepended to the document number column. The `Flag` icon carries `aria-label="Missing committee report"`. [Confirmed — DESIGN.md §6.6 Order of Business Row; arch ref Part 4.18]

```typescript
interface OrderOfBusinessItem {
  agendaNumber: number;                            // monospace, e.g. "1."
  documentNumber: string;
  numberVariant: NumberVariant;
  title: string;
  committeeReferrals: CommitteeReferral[];         // referral entries backing committee chips
  documentState: DocumentState;
  scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD';
  isMissingReport: boolean;                        // true → bg-danger-50 row + Flag icon
  isCertifiedUrgent: boolean;                      // true → CERTIFIED URGENT chip prepended
}

interface OrderOfBusinessRowProps {
  item: OrderOfBusinessItem;
  className?: string;
}
```

---

#### `CommitteeReferralBlock`

One block entry per committee assigned to a document. Each entry renders: committee name, status chip (shadcn `Badge`), submitted-by name (rendered via `AvatarName`, Tier 2, if present), and submission timestamp (rendered via `DATE_FORMATS.displayWithTime`). Status chip colours per DESIGN.md §6.6: `SUBMITTED` → `success-100` background; `PENDING` → `warning-100`; `ABSENT_NOT_HEARD` → `neutral-100`. [Confirmed — DESIGN.md §6.6 Committee Referral Block]

```typescript
type CommitteeReportStatus = 'SUBMITTED' | 'PENDING' | 'ABSENT_NOT_HEARD';

interface CommitteeReferral {
  id: string;
  committeeName: string;
  status: CommitteeReportStatus;
  /** Name of the person who submitted — renders via AvatarName if present */
  submittedBy?: string;
  /** Renders via DATE_FORMATS.displayWithTime */
  submittedAt?: Date;
}

interface CommitteeReferralBlockProps {
  referrals: CommitteeReferral[];
  className?: string;
}
```

---

#### `DocumentPreviewCard`

Clickable card shown in document list and search-result grid views. Contents in order: first-page thumbnail (`aspect-[3/4]`, `bg-neutral-100` placeholder if `thumbnailUrl` is absent), `DocumentNumberBadge` (Tier 3), title (2-line truncate via `line-clamp-2`), `StatusBadge` (Tier 3), last-action timestamp rendered in `text-xs text-text-muted`. Hover transitions `shadow-sm` → `shadow-md`. When `isLoading` is true, all content slots render as `Skeleton` (Tier 1) placeholders matching the real content dimensions. [Confirmed — DESIGN.md §6.6 Document Preview Card]

```typescript
interface DocumentPreview {
  id: string;
  documentNumber: string;
  numberVariant: NumberVariant;
  title: string;
  documentState: DocumentState;
  lastActionAt: Date;
  /** Omit to show bg-neutral-100 placeholder thumbnail */
  thumbnailUrl?: string;
  /** When the SLA window expires — enables an embedded SLATimer without a second fetch */
  slaDeadlineAt?: Date;
  /** When the SLA clock started — enables an embedded SLATimer without a second fetch */
  slaStartedAt?: Date;
}

interface DocumentPreviewCardProps {
  document: DocumentPreview;
  onClick?: () => void;
  /** When true, renders Skeleton placeholders instead of content */
  isLoading?: boolean;
  className?: string;
}
```

---

#### `QRCodeDisplay`

Renders the document tracking QR code (generated by the `qrcode` npm package server-side, received as a data URL or base64 string). Document number is displayed below in `font-mono text-xs`. Title is displayed below the number in `text-sm text-text-secondary`. The `print` variant removes shadows, increases the minimum rendered size to 200×200px, and increases contrast for physical scanning. Carries `role="img"` and `aria-label="QR code for document {documentNumber}"` per DESIGN.md §6.6. [Confirmed — DESIGN.md §6.6 QR Code Display; arch ref Part 11.6]

```typescript
interface QRCodeDisplayProps {
  /** UUID tracking ID from the DTS tracking record — the QR payload */
  trackingId: string;
  /** Formatted document number for display below the QR, e.g. "7SP 2026-001" */
  documentNumber: string;
  /** Document title for display below the number */
  title: string;
  /** "screen" = standard card with shadow; "print" = no shadow, min 200×200px */
  variant?: 'screen' | 'print';
  className?: string;
}
```

---

#### `AppShell`

Persistent layout frame for all authenticated views in `apps/web`. Never used in `apps/portal`. Renders three regions: a fixed left sidebar (full viewport height), a fixed topbar (full width minus sidebar), and a scrollable main content area (`overflow-y: auto`, `padding: var(--content-padding)`). Sidebar collapse state is driven by `apps/web`'s `useLayoutStore` Zustand store and passed as props — `packages/ui` does not install or import Zustand (confirmed absent from `INSTALL.sh` Step 1; Zustand is in Step 3 under `--filter @batac/web`). [Confirmed — DESIGN.md §6.1 App Shell; `INSTALL.sh` Step 3; tech-stack.md Zustand constraint]

```typescript
interface AppShellProps {
  children: React.ReactNode;
  /** Driven by apps/web useLayoutStore — passed as prop to keep packages/ui Zustand-free */
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  /** Sidebar component rendered in the fixed left slot */
  sidebarContent: React.ReactNode;
  /** Topbar component rendered in the fixed top slot */
  topbarContent: React.ReactNode;
}
```

---

#### `Sidebar`

Dark (`bg-primary-950`) persistent left navigation panel per DESIGN.md §8 Rule 3. Renders at `w-60` (240px) expanded or `w-14` (56px) collapsed. In collapsed mode, item labels are hidden (`hidden` on the label `<span>`) and each nav icon receives a `Tooltip` (Tier 1) showing the label text. Active nav item carries `bg-primary-700 text-white font-semibold border-l-2 border-warning-500`. Bottom section renders the current user's `AvatarName` (Tier 2, size `md`) with name and role on expanded view. [Confirmed — DESIGN.md §6.1 Sidebar Nav Item; §8 Rule 3]

```typescript
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

---

#### `Topbar`

Fixed top bar spanning the full width above the main content area, positioned to the right of the sidebar. Left-aligned: `Breadcrumb` (Tier 1) — separator is `/` literal per DESIGN.md §6.2. Right-aligned: notification bell icon-only button (with `Tooltip` and `aria-label`) and current user `AvatarName` (Tier 2, size `lg`) opening a `Popover` account menu. The `SidebarUser` type is shared with `Sidebar` above and should be defined once in `packages/ui/src/components/domain/types.ts`. [Confirmed — DESIGN.md §6.1 Topbar; §6.2 Breadcrumb]

```typescript
interface BreadcrumbItem {
  label: string;
  /** Omit for the current (non-linked) final segment */
  href?: string;
}

interface TopbarProps {
  breadcrumbs: BreadcrumbItem[];
  /** Tracks sidebar state to adjust left offset (left-60 vs left-14) */
  sidebarCollapsed: boolean;
  notificationCount?: number;
  onNotificationClick?: () => void;
  currentUser: SidebarUser;
  onUserMenuAction?: (action: 'profile' | 'logout') => void;
}
```

---

#### `PageHeader`

Top section of every routed view inside the main content area, below the topbar. Container: `mb-6 pb-4 border-b border-border-default`. Title: `h1` with `text-2xl font-bold text-text-primary`. Optional subtitle: `text-sm text-text-secondary mt-1`. Right slot (`actions`): primary CTA button and optional secondary actions — the consuming view passes fully constructed `Button` (Tier 2) elements. [Confirmed — DESIGN.md §6.1 Page Header; §9 "Display / Page Heading" specimen]

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Render slot for primary CTA and secondary action Buttons */
  actions?: React.ReactNode;
  className?: string;
}
```

---

## 5. Token Exposure and CSS Consumption Rules

`globals.css` is the single CSS file produced by `packages/ui`. It must be imported exactly once at the app entry point: `import '@batac/ui/styles/globals.css'` in `apps/web/src/main.tsx`. For the Phase 3 portal, the equivalent import is in `apps/portal/src/app/layout.tsx`. Importing it more than once in the same build will double-register all CSS custom properties and `@theme {}` tokens, causing unpredictable Tailwind JIT resolution. [Confirmed — `globals.css` file header; `components.json` `"css": "src/styles/globals.css"`]

The `@theme {}` block is the Tailwind v4 extension point. [Confirmed — `globals.css`] Every token declared there auto-generates a complete set of utility classes with full opacity modifier support: `--color-primary-800` becomes `bg-primary-800`, `text-primary-800`, `border-primary-800`, `ring-primary-800`, and `bg-primary-800/50` etc. No manual `@utility {}` blocks are needed or permitted for tokens already in `@theme {}` — adding them would bypass the opacity modifier pipeline. The only valid use of `@layer utilities {}` or `@variant` in `globals.css` is for utility logic that `@theme {}` cannot express, such as animation keyframes.

Font loading is intentionally split. Inter (weights 400, 500, 600, 700, and italic 400) and JetBrains Mono (weights 400, 500) are loaded globally via the `@import url('https://fonts.googleapis.com/...')` statement at the top of `globals.css`, line 23. [Confirmed — `globals.css` line 23] They are available to every view that imports the stylesheet. Lora is explicitly excluded from this global import — it is loaded on demand by document-render components that display formal legislative text. This is a confirmed decision per `globals.css`: "Lora is deferred — loaded on-demand by document-render components only, not globally. [Proposed default: confirmed]". [Confirmed — `globals.css` comment lines 18–22]

When `apps/portal` is implemented in Phase 3, it must use `next/font/google` in a `fonts.ts` module for font loading rather than the `@import url()` path. If `apps/portal` also imports `@batac/ui/styles/globals.css` which contains `@import url()`, fonts will double-load. The resolution for Phase 3 is either: (a) extract the `@import url()` from `globals.css` and make each app responsible for font loading, or (b) accept the `@import url()` only in `apps/web` and configure `apps/portal` with `next/font/google` for the same faces. This decision is deferred to Phase 3. [Inference — standard Next.js + Tailwind font loading pattern; not yet confirmed in any input file]

**Confirmed install gap — `date-fns-tz`:** `date-locale.ts` references `date-fns-tz`'s `formatInTimeZone()` for server-side timezone-aware formatting (JSDoc at line 15 and the `PH_TIMEZONE` export at line 34). [Confirmed — `date-locale.ts` lines 15, 34] `date-fns-tz` does not appear anywhere in `INSTALL.sh`. [Confirmed — `INSTALL.sh`, full file reviewed] This is a confirmed install gap. The following line must be added to `INSTALL.sh` Step 1:

```bash
pnpm add date-fns-tz --filter @batac/ui
```

All date formatting in components must pass `phLocale` to `date-fns/format`. All server-side timezone-aware formatting must use `formatInTimeZone` from `date-fns-tz` with `PH_TIMEZONE`. Client-side `format()` calls will use the browser's system timezone unless the consuming code explicitly applies `date-fns-tz`. [Confirmed — `date-locale.ts` JSDoc]

---

## 6. Package Export Map

The following `package.json#exports` map defines every public surface of `@batac/ui`. Import paths not listed here are package internals and must not be imported by consumers.

```json
{
  "name": "@batac/ui",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./styles/globals.css": "./src/styles/globals.css",
    "./lib/utils": {
      "types": "./src/lib/utils.ts",
      "default": "./src/lib/utils.ts"
    },
    "./lib/date-locale": {
      "types": "./src/lib/date-locale.ts",
      "default": "./src/lib/date-locale.ts"
    },
    "./components/ui/button": {
      "types": "./src/components/ui/button.tsx",
      "default": "./src/components/ui/button.tsx"
    },
    "./components/ui/tabs": {
      "types": "./src/components/ui/tabs.tsx",
      "default": "./src/components/ui/tabs.tsx"
    },
    "./components/ui/avatar": {
      "types": "./src/components/ui/avatar.tsx",
      "default": "./src/components/ui/avatar.tsx"
    },
    "./components/domain/*": {
      "types": "./src/components/domain/*.tsx",
      "default": "./src/components/domain/*.tsx"
    }
  }
}
```

The `"."` entry resolves to `src/index.ts`, the barrel that re-exports everything a consumer needs without a deep path. Tier 1, Tier 2, and Tier 3 components are all re-exported from the barrel; `"./styles/globals.css"` is the one entry that is never imported via the barrel (it is a CSS file that must be imported directly at the app root). The three explicit Tier 2 deep-path entries (`./components/ui/button`, `./components/ui/tabs`, `./components/ui/avatar`) signal clearly to any developer inspecting the export map that these are batac-dms overrides, not raw shadcn defaults; importing via `"."` or via the deep path resolves to the same file. The `"./components/domain/*"` wildcard pattern covers all sixteen Tier 3 components; each domain component file must use a named export (not a default export) for tree-shaking to work correctly with the wildcard.

The barrel `src/index.ts` re-exports all components:

```typescript
// src/index.ts — barrel (illustrative, not exhaustive)

// Tier 1 — shadcn primitives (all 20)
export * from './components/ui/card';
export * from './components/ui/input';
export * from './components/ui/textarea';
export * from './components/ui/label';
export * from './components/ui/separator';
export * from './components/ui/skeleton';
export * from './components/ui/badge';
export * from './components/ui/dialog';
export * from './components/ui/sheet';
export * from './components/ui/tooltip';
export * from './components/ui/table';
export * from './components/ui/alert';
export * from './components/ui/command';
export * from './components/ui/popover';
export * from './components/ui/select';
export * from './components/ui/checkbox';
export * from './components/ui/calendar';
export * from './components/ui/chart';
export * from './components/ui/breadcrumb';
export * from './components/ui/sonner';

// Tier 2 — CVA overrides (replace CLI-generated versions)
export * from './components/ui/button';
export * from './components/ui/tabs';
export * from './components/ui/avatar';

// Tier 3 — domain compound components (added per feature PR)
// export * from './components/domain/DocumentNumberBadge';  ← added when it ships
// export * from './components/domain/StatusBadge';
// ... etc.

// Utilities
export { cn } from './lib/utils';
export { phLocale, PH_TIMEZONE, DATE_FORMATS } from './lib/date-locale';
```

Tier 3 export lines are added to the barrel in the same PR that introduces each component, not before.

---

## 7. PR Boundary Definition — Foundation vs. Feature

### The `feat: packages/ui foundation` PR

This PR contains all zero-feature setup work that must land before any authenticated view is built. It carries no domain business logic and no Tier 3 component implementations.

The foundation PR delivers, in order:

1. Run the single Step 2 CLI invocation from `INSTALL.sh` (`pnpm dlx shadcn@latest add --cwd packages/ui button card input ...`). Commit all 23 generated files in `src/components/ui/` as produced by the CLI.
2. Overwrite `src/components/ui/button.tsx`, `src/components/ui/tabs.tsx`, and `src/components/ui/avatar.tsx` with the Tier 2 override files confirmed in §4.2. Remove the `"use client"` directive from `tabs.tsx`.
3. Commit `src/styles/globals.css` as specified — the Tailwind v4 `@theme {}` block, `:root` token block, shadcn HSL variable map, and global resets.
4. Commit `src/lib/utils.ts` (`cn()` utility).
5. Commit `src/lib/date-locale.ts` (`phLocale`, `PH_TIMEZONE`, `DATE_FORMATS`).
6. Commit `components.json` (shadcn CLI configuration).
7. Author `src/index.ts` barrel re-exporting all Tier 1 and Tier 2 components plus `cn` and the date-locale exports. Tier 3 stub lines are commented out and added per feature PR.
8. Commit `package.json` with the export map from §6.
9. Add `pnpm add date-fns-tz --filter @batac/ui` to `INSTALL.sh` Step 1 (confirmed gap) and run it.
10. Create `src/components/domain/types.ts` containing shared domain-adjacent types used by multiple Tier 3 components: `SidebarUser`, `BreadcrumbItem`. These are not domain types (which live in `packages/shared`) but layout-utility types owned by this package.

**Acceptance criteria for the foundation PR:**

- All typography specimens from DESIGN.md §9 render correctly against a minimal HTML fixture that imports `@batac/ui/styles/globals.css`: `text-2xl font-bold text-text-primary` for page headings, `font-mono text-xs font-medium` for document numbers, `text-3xl font-bold` for dashboard metrics, `text-xs text-text-muted` for timestamps. The muted colour renders as `#5a6470`, not `#868e96`.
- `cn("bg-red-500", "bg-blue-500")` resolves to `"bg-blue-500"` (tailwind-merge conflict resolution active).
- `cn("px-4", false && "py-2", "py-3")` resolves to `"px-4 py-3"` (clsx conditional handling active).
- `Button` renders without errors in all 8 variants (`default`, `primary`, `secondary`, `destructive`, `ghost`, `ghost-danger`, `link`, `outline`) and all 6 sizes (`xs`, `sm`, `default`, `lg`, `icon`, `icon-sm`).
- `Tabs` with `variant="underline"` and an active trigger renders `border-b-2 border-primary-800 text-primary-800 font-semibold`; an inactive trigger renders `border-b-2 border-transparent text-text-secondary`.
- `AvatarName` with `name="Gladys R. Lagura"` renders initials `"GL"` and produces the same background colour on every render (deterministic hash).
- All 20 Tier 1 components are importable from `@batac/ui` without TypeScript errors under `strict: true`.
- `phLocale` from `@batac/ui/lib/date-locale` produces Monday (`1`) as `weekStartsOn` when inspected.
- TypeScript compilation of `packages/ui` passes with `strict: true` and no implicit `any`.

**Everything in Tier 3 is feature work.** No Tier 3 component belongs in the foundation PR. `AppShell`, `Sidebar`, `Topbar`, and `PageHeader` are the first four Tier 3 components to ship — they are prerequisites for every authenticated view — but they ship in a separate authenticated-shell PR that comes immediately after the foundation PR, not inside it.

---

## 8. Runbook: Adding a Component

### Procedure A — Adding a Tier 1 shadcn Component

1. Run `pnpm dlx shadcn@latest add --cwd packages/ui <component-name>`. The CLI generates the component at `src/components/ui/<component>.tsx` and may update `components.json` and `package.json` peer dependencies.
2. Open the generated file and check for three things: (a) any hardcoded hex or `hsl(var(...))` strings — replace with the equivalent Tailwind token utility class from the `@theme {}` block (e.g., `#1e3d7a` → `text-text-link`, `hsl(var(--primary))` → `bg-primary-800`); (b) the `"use client"` directive at the top of the file — remove it; (c) any reference to shadcn default theme variables that have not been mapped in the batac-dms HSL variable block in `globals.css` — verify the mapping resolves to the intended brand colour.
3. Add a named re-export to `src/index.ts`: `export * from './components/ui/<component>';`.
4. If the component requires a dedicated deep-path import (i.e., consumers need to import it by path rather than via the barrel), add an entry to `package.json#exports` following the Tier 1 pattern.
5. Update the Tier 1 table in §4.1 of this document: confirm the `shadcn add` argument, the export path, and the primary usage context.

### Procedure B — Adding a Tier 3 Domain Component

1. Locate this component's entry in the §4.3 overview table and copy its props interface verbatim as the starting point. If the interface imports a type from `packages/shared` (e.g., `DocumentState`), add `import type { DocumentState } from '@batac/shared'` — do not redefine domain types locally.
2. Create `src/components/domain/<ComponentName>.tsx` with a named export: `export function ComponentName(props: ComponentNameProps) { ... }`. No default export.
3. Build using only Tailwind utility classes from the `@theme {}` block. Zero hardcoded colour values anywhere in the file. Zero inline `style` props with colour or spacing values.
4. Compose only from the Tier 1 and Tier 2 primitives listed in the "Composes" column for this component in the §4.3 overview table. Do not introduce new npm packages into `packages/ui` without an ADR. Do not import a Radix primitive directly if it is already transitively available through an installed shadcn component.
5. Add every ARIA attribute listed in the DESIGN.md §6 subsection for this component. Validate keyboard focus order manually. Specifically: `role="timer"` + `aria-live="polite"` on `SLATimer`; `role="img"` + `aria-label` on `QRCodeDisplay`; `aria-label` on every icon-only button within the component.
6. Apply `.touch-exempt` to every non-actionable chip or badge child per DESIGN.md §8 Rule 11.
7. Use no `<form>` elements. All containers are `<div>` or `<section>`. All interactions are handled via React event handler props. [DESIGN.md §8 Rule 8]
8. Do not add `"use client"`. This package targets a Vite SPA with `rsc: false`.
9. Add `export * from './components/domain/<ComponentName>';` to `src/index.ts`.
10. Update the §4.3 overview table row for this component to read `[Implemented — PR #NNN]` so the table reflects what is shipped vs. what remains spec.
