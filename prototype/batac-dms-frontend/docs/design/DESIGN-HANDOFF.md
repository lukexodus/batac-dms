# Batac City LGU Platform — Design Handoff Notes

**Version:** 0.1 · **Audience:** Development team implementing `/apps/web` and `/packages/ui`
**Companion to:** `DESIGN.md`, `BRAND.md`, `COMPONENT-GUIDELINES.md`, `ACCESSIBILITY.md`

---

## 1. Purpose of This Document

This prototype (`batac-lgu-prototype.jsx`) is a **single-file static UI demo** — it is not the application. This document maps every design decision in the prototype to where and how it should land in the real monorepo described in `tech-stack.md`, and flags everything that is currently mocked and must be made real.

---

## 2. File Manifest (this delivery)

| File | Purpose |
|---|---|
| `DESIGN.md` | Design tokens, layout patterns, component specs, page-specific notes |
| `BRAND.md` | City Seal usage, naming, voice/tone, co-branding hierarchy |
| `ACCESSIBILITY.md` | WCAG target, keyboard/screen-reader patterns, testing checklist |
| `COMPONENT-GUIDELINES.md` | Per-component usage rules (do's/don'ts) |
| `CONTENT-STYLE-GUIDE.md` | Terminology, status vocabulary, copy tone |
| `RESPONSIVE.md` | Breakpoints and responsive behavior per page |
| `DESIGN-HANDOFF.md` | This document |
| `batac-lgu-prototype.jsx` | Single-file React prototype — 7 pages, mock data, all components inline |
| `assets/city-seal-official.jpg` | Official seal artwork (source raster) |

---

## 3. Repository Placement

The prototype is intentionally a **single file** for portability and review. It must be decomposed before merging into `/apps/web`. Suggested mapping to the monorepo structure in `tech-stack.md`:

```
/packages/ui/src/
  components/
    Btn.tsx
    StatusBadge.tsx
    ClassificationBadge.tsx
    PriorityTag.tsx
    StatCard.tsx
    PageHeader.tsx          (PageHdr)
    SectionHeader.tsx       (SectionHdr)
    Timeline.tsx            (DTS timeline pattern, §11 of COMPONENT-GUIDELINES.md)
    QRDisplay.tsx           ⚠ PLACEHOLDER — replace, see §6
  branding/
    CitySeal.tsx            (simplified SVG mark)
    CitySealOfficial.tsx    (img wrapper)
  assets/branding/
    city-seal-official.jpg  → convert to optimized .png/.webp

/apps/web/src/
  layouts/
    AppShell.tsx            (Sidebar + TopBar wrapper, §9 of COMPONENT-GUIDELINES.md)
    PortalShell.tsx         (Citizen Portal header + tabs, separate from AppShell)
  pages/
    dashboard/MayorDashboard.tsx
    dashboard/SPSecretaryDashboard.tsx
    tracking/DocumentTrackingPage.tsx     (DTS)
    workflow/ApprovalPage.tsx             (WMS)
    documents/DocumentRepositoryPage.tsx  (DMS)
  portal/                   (or /apps/portal if split into Next.js per Phase 3)
    TrackPage.tsx
    LibraryPage.tsx
    SubmitPage.tsx

/apps/web/public/branding/
  city-seal-official.png    (production asset, see BRAND.md §8)
```

**The "Design System" kitchen-sink page (`KitchenSinkPage`) is a documentation/QA tool, not a product page.** It should live in a Storybook instance or an internal `/dev/design-system` route gated to developers — it must never ship in the citizen-facing or production staff build's navigation. The "PROTOTYPE" sidebar group exists only in this demo file and must be removed entirely in the real `AppShell`.

---

## 4. Design Tokens → Tailwind Config

The prototype uses inline Tailwind utility classes plus a small set of custom CSS classes (in `GlobalStyles`) for brand-specific colors not in Tailwind's default palette. **Move these into `tailwind.config.ts`** in `/packages/config` so they become first-class utilities (`bg-brand-primary`, `text-brand-dark`, etc.) instead of inline styles/custom classes.

```ts
// packages/config/tailwind.config.ts (extend block)
theme: {
  extend: {
    colors: {
      brand: {
        primary: '#00A651',
        dark:    '#0D3D20',
        mid:     '#1A6B35',
        light:   '#E8F5ED',
        50:      '#F0FAF4',
      },
      accent: {
        gold:      '#F59E0B',
        goldDark:  '#92400E',
        goldLight: '#FEF3C7',
      },
      seal: {
        navy:      '#1E3A8A',
        red:       '#DC2626',
        gold:      '#FBBF24',
        sky:       '#7DB8F0',
        field:     '#1A7A36',
      },
    },
    fontFamily: {
      sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      mono: ['IBM Plex Mono', 'monospace'],
    },
    borderRadius: {
      card: '12px',
      input: '8px',
      tag: '4px',
    },
  },
}
```

After this, replace:
- `.sidebar-bg`, `.brand-btn`, `.brand-text`, `.brand-bg-light`, `.brand-bg-50`, `.nav-active`, `.nav-hover`, `.brand-ring` (all defined in `GlobalStyles` in the prototype) → with Tailwind utilities (`bg-brand-dark`, `bg-brand-primary hover:bg-brand-dark`, `text-brand-primary`, `bg-brand-light`, `bg-brand-50`, `focus:ring-2 focus:ring-brand-primary focus:ring-offset-2`, etc.)
- The `seal-*` colors are **only** consumed inside `CitySeal.tsx` — do not expose them as general-purpose utilities elsewhere (per `BRAND.md` §2.3 and `DESIGN.md`'s note on Seal vs Platform colors).

`GlobalStyles` (the `<style>` block + Google Fonts `@import`) should become a proper font loading strategy: self-host IBM Plex Sans/Mono via `next/font` (if `/apps/portal` is Next.js) or `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` packages for `/apps/web` (Vite) — the `@import` from Google Fonts CDN is a prototype convenience only and should not ship to production (privacy/performance).

---

## 5. shadcn/ui Mapping

Where the prototype hand-rolls a component, the real implementation should prefer the equivalent shadcn/ui primitive (already in the approved stack per `tech-stack.md`):

| Prototype component | shadcn/ui equivalent | Notes |
|---|---|---|
| `Btn` | `Button` | Map `variant`/`size` props directly; extend shadcn's variant config with `warning` (not in default shadcn set) |
| `StatusBadge`, `ClassificationBadge`, `PriorityTag` | `Badge` | Extend with custom color variants per `statusConfig`/`classConfig` — shadcn `Badge` supports custom variants via `cva` |
| Filter `<select>` elements | `Select` | DMS filter bar, Citizen Portal form selects |
| DMS table | `Table` (shadcn) + **TanStack Table** for sort/filter/pagination logic, per `tech-stack.md` | The prototype's manual `.filter()` logic should become TanStack Table column filters |
| WMS action selector cards | `RadioGroup` (styled as cards) | This gives the required `role="radiogroup"` semantics flagged in `ACCESSIBILITY.md` §3.2/§8 for free |
| Comment `<textarea>` | `Textarea` + React Hook Form + `@hookform/resolvers/zod` | Validation (required-on-Reject/Return) should be a Zod conditional schema, not inline JS |
| Citizen Portal tabs | `Tabs` | Gives `role="tablist"`/`aria-selected`/arrow-key nav per `ACCESSIBILITY.md` §3.2 automatically |
| Checkbox (privacy consent) | `Checkbox` | |
| Cards (`StatCard`, panels) | `Card` | |

---

## 6. What's Mocked — Must Become Real

| Prototype element | Current state | Required for production |
|---|---|---|
| `QRDisplay` | Deterministic SVG pattern, **not a real QR code** | Replace with `qrcode` library (server-generated) per `tech-stack.md` — encodes only the tracking ID per `DESIGN.md` §13 / `consolidated-architecture-and-requirements-reference.md` §4.2 (QR/Barcode rule) |
| All mock data arrays (`mockPendingSignatures`, `mockRoutingHistory`, `mockDocuments`, etc.) | Hardcoded JS arrays | TanStack Query hooks against tRPC procedures (`/web`) or REST endpoints (`/portal`) per `tech-stack.md` |
| WMS PDF viewer | Static styled `<div>` mimicking a document | `react-pdf` per stack decision, rendering the actual uploaded file from S3-compatible storage |
| WMS action submission | Local `useState` + fake "done" screen | Real tRPC mutation → workflow engine `approval` step transition, with optimistic UI via TanStack Query |
| Citizen Portal "Track" search | Returns a hardcoded result for any non-empty query | Real lookup against `tracking.tracking_records` by tracking ID (public REST endpoint, no auth) |
| Citizen Portal "Submit" | Fake tracking number `DTS-2026-000099` | Real submission creates a `CitizenRequest`/`CitizenComplaint` record, assigns tracking number per numbering rules, sends OTP-gated confirmation (per `consolidated-architecture-and-requirements-reference.md` §11.18) |
| Sidebar user profile ("Mark Christian R. Chua / Mayor") | Hardcoded | Real session/auth context — and **the same `AppShell` must render correctly for every role**, not just Mayor. See §7. |
| Notification bell | Static red dot, no content | Real SSE-backed notification feed per `tech-stack.md` |

---

## 7. Role-Based Rendering — Important Architectural Note

The prototype's sidebar **always shows all 7 pages** (including both dashboards) regardless of role — this is intentional **for this demo only**, so reviewers can see every page from one shell.

**In production, the sidebar nav must be role-filtered**:

- A `Department Approver` should not see "Mayor's Dashboard" or "SP Secretary's Dashboard" in their nav.
- A `Citizen` never sees the internal sidebar at all — only `PortalShell`.
- `Platform Administrator` should not see operational/document-processing pages at all, per the invariant in `consolidated-architecture-and-requirements-reference.md` §11.8 ("Platform Administrator role cannot be combined with any document-processing role" — this extends to navigation visibility, not just permissions).

The grouping structure (`DASHBOARDS` / `OPERATIONS` / `PUBLIC`) should remain, but each group's *contents* are a function of the logged-in user's role(s) — implement as a config-driven nav (role → array of nav item IDs) rather than a static array.

---

## 8. Naming Conventions

- **Components:** PascalCase, matching the prototype names where reasonable (`StatusBadge`, `ClassificationBadge`, `PageHdr` → rename to `PageHeader` for clarity in the real codebase, `SectionHdr` → `SectionHeader`).
- **Status/Classification string values:** Treat the exact strings in `statusConfig`/`classConfig` (e.g., `"Pending Approval"`, `"In Committee"`) as a **controlled vocabulary** — these should become a shared Zod enum in `/packages/shared`, consumed by both the DB layer (Drizzle enum) and the UI (for the badge color lookup). Do not let the UI and DB drift into different string casings/spellings.
- **Mock data → real data shape:** The mock objects (e.g., `mockDocuments[i]`) closely follow the `Document`/`TrackingRecord` entity shapes in `1-domain-context.md` §9 — use these mock shapes as a starting point for the Drizzle schema's TypeScript types, but they are **illustrative, not authoritative**. Confirm field names against the finalized `documents`/`tracking` schema migrations.

---

## 9. Page-by-Page Implementation Notes

### Mayor's Dashboard
- The SLA breach alert banner at the top is **conditional** — it should not render when there are zero overdue items. The prototype always shows it; the real component needs an empty/healthy state (e.g., a green "All caught up" banner or simply nothing).
- `mockSLAData` and `mockDeptWorkload` map to a future `reporting` module (Phase 2 per `consolidated-architecture-and-requirements-reference.md` Part 10.2) — in Phase 1, these charts may need to be computed ad-hoc from `workflow`/`audit` schema queries until `reporting` exists.

### SP Secretary's Dashboard
- `mockSessionCalendar` should connect to a real session-scheduling entity — not currently in the Part 1 domain model as a first-class entity. **Flag for schema discussion**: sessions need their own table (date, type [regular/special], agenda items → linked `WorkflowInstance`s).
- The "Log New Document" quick action should deep-link into the Document Core intake flow (assigns QR tracking number at secretariat formal intake, per `consolidated-architecture-and-requirements-reference.md` §11.6).

### DTS Timeline
- The routing history (`mockRoutingHistory`) maps directly to `tracking.routing_entries` (per `1-domain-context.md` §9 — `RoutingEntry`: from, to, actor, timestamp, action). Each prototype timeline entry's `detail` free-text field should map to a `notes`/`remarks` column.
- **Open question carried from `consolidated-architecture-and-requirements-reference.md` Part 14, Q-02**: timeline ordering and QR-assignment timing depend on unresolved stakeholder questions. The prototype assumes chronological oldest-first with QR assigned at secretariat intake (the recommended default) — **do not treat this as confirmed** until Q-02/Q-03 are resolved.

### WMS Approval Interface
- The "Workflow Position" stepper is currently a hardcoded 5-step list specific to a Purchase Request. In production this must be **generated from the document's actual `WorkflowInstance` + pinned `WorkflowDefinition` version** (per `consolidated-architecture-and-requirements-reference.md` §11.3) — step labels, current-step pointer, and completed/pending states all come from the workflow engine, not a static array.
- The mandatory-comment-on-reject/return pattern directly implements the requirement in `1-domain-context.md` (referenced in project memory as "a defined UX requirement, not optional").

### DMS Repository
- The four filters (Type, Office, Status, Classification) plus search are the Phase 1 baseline. `DESIGN.md` §14 notes column-visibility toggling as a Phase 2 enhancement — don't build it now, but don't architect the table in a way that blocks adding it later (TanStack Table's column visibility API handles this natively when needed).
- Bulk selection (checkboxes on row hover, mentioned in `DESIGN.md` §14) is **not yet in this prototype** — when implemented, it is Records-Officer-only per `consolidated-architecture-and-requirements-reference.md` §11.4 ("Bulk operations (Records Officers only)") and requires confirmation dialog + dry-run preview + no bulk-delete.

### Citizen Portal
- This page deliberately has **no shared layout** with the internal app (`PortalShell` ≠ `AppShell`) — confirm this separation is preserved in routing (likely a separate Next.js app per `tech-stack.md`, `/apps/portal`, Phase 3).
- The "Submit" flow's OTP verification (phone + email, per `consolidated-architecture-and-requirements-reference.md` §11.18) is entirely absent from the prototype — the success screen with a fake tracking number stands in for what will be a multi-step verified submission flow.

---

## 10. Open Questions Carried Forward

The following unresolved stakeholder questions from `consolidated-architecture-and-requirements-reference.md` Part 14 directly affect UI decisions made in this prototype. **Do not treat the prototype's choices as final** for these areas:

| Prototype assumption | Source question | Impact if answer differs |
|---|---|---|
| DTS timeline shows a single "preliminary number" concept (the tracking ID) | Q-01 (preliminary vs. final series number) | May need a second number field displayed on the cover sheet/timeline header |
| QR assigned at secretariat intake (first workflow step shown in timeline) | Q-02 (QR assignment timing) | If QR is assigned at physical receipt (before system logging), the timeline's first entry needs a "pre-system" state |
| Resolution shown with Mayor signature + no lapse-into-law timer | Q-03 (10-day lapse rule for Resolutions) | If lapse applies to Resolutions too, the WMS Workflow Position stepper needs an SLA countdown on the Mayor step, matching the Ordinance pattern |
| Multi-committee referral shown as a single committee per item in `mockLegislativeQueue` | Q-04 (multi-committee referral design) | SP Secretary's Dashboard queue table may need a second "Co-Referred Committee" column |
| Certified Urgent items not visually distinguished in the queue | Q-05 (certified urgent authorization) | May need a `PriorityTag`-style "CERTIFIED URGENT" flag once authorization rules are confirmed |

---

## 11. Versioning

| Version | Date | Notes |
|---|---|---|
| 0.1 | June 2026 | Initial handoff alongside `DESIGN.md` v0.1 and the 7-page prototype. Seal corrected to match official artwork (navy/red/gold heraldry) — see `BRAND.md`. |

---

*City Government of Batac · Ilocos Norte, Philippines*
*Design handoff notes for internal development use only — pre-production prototype.*
