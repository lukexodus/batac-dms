
## Table of Contents

- [L23–L78] Prerequisite Table — Dependency matrix mapping each planned document (A1 to L4) to its direct prerequisite documents.
- [L79–L95] Generation Waves — Parallelizable document creation phases grouped into seven sequential execution waves based on dependency requirements.
- [L96–L113] Existing Reference Documents — Three pre-existing inputs the planning document set is built from: the consolidated requirements reference, the technology stack decisions, and the design system reference.
- [L114–L125] Group A — Project Planning — Summaries of project planning documents A1 (Master Phased Task List) and A2 (Risk Register) detailing checklists and risk categories.
- [L126–L149] Group B — Architecture Documents — Core architecture documents (B1–B5) defining C4 models, module boundaries, event schemas, workflow engine logic, and auth rules.
- [L150–L173] Group C — Database — Database design documents (C1–C5) specifying schema DDL, Mermaid ERDs, RLS policies, indexing strategy, and migration conventions.
- [L174–L201] Group D — UML and Diagrams — Visual blueprints (D1–D6) detailing actor use cases, sequence flows, state machines, class diagrams, deployment setups, and data flows.
- [L202–L217] Group E — API Design — API interface specifications (E1–E3) detailing tRPC routers, OpenAPI REST endpoints, and shared Zod validation schemas.
- [L218–L265] Group F — Frontend Architecture — Frontend specifications (F1–F7) covering routing maps, Zustand stores, query keys, component trees, package setups, WCAG accessibility, and implementation plans.
- [L266–L273] Group G — End-to-End Type Safety — Single document mapping type propagation from Drizzle ORM through tRPC and Fastify down to React client components.
- [L274–L295] Group H — Domain Configuration Documents — Configuration specs (H1–H4) outlining workflow seed data, document metadata schemas, numbering formats, and multilingual notification templates.
- [L296–L311] Group I — Security and Authorization — Security documents (I1–I3) specifying ABAC policy attributes, role-permission matrix cells, threat models, and audit hash-chaining.
- [L312–L339] Group J — Software Design Patterns and Standards — Development standards (J1–J6) defining design patterns, error normalization, style guides, module templates, the master ADR index, and the domain component reference.
- [L340–L355] Group K — Testing — Testing strategies (K1–K3) defining coverage priorities, workflow state machine tests, and critical Playwright E2E user journeys.
- [L356–L375] Group L — Infrastructure and DevOps — Operations documents (L1–L4) detailing environment variables, Docker/Compose setups, Turborepo CI/CD pipelines, and backup recovery runbooks.
- [L376–L389] What Can Only Be Determined During Development — Inventory of development-time issues and runtime edge cases that cannot be pre-decided in planning documentation.

---

## Prerequisite Table

| ID  | Document                                       | Prerequisites from this list |     |
| --- | ---------------------------------------------- | ---------------------------- | --- |
| A1  | Master Phased Task List                        | All other documents          |     |
| A2  | Risk Register                                  | None                         |     |
| B1  | System Architecture Document (C4 L1–L3)        | None                         |     |
| B2  | Module Boundary and Internal API Contracts     | B1                           |     |
| B3  | Internal Domain Event Catalog                  | B2, B4                       |     |
| B4  | Workflow Engine Specification                  | None                         |     |
| B5  | Authentication and Authorization Architecture  | None                         |     |
| C1  | Full Database Schema DDL                       | B2, B4, D4, H2, H3           |     |
| C2  | Entity-Relationship Diagrams                   | C1                           |     |
| C3  | PostgreSQL RLS Policy Specifications           | C1, I1                       |     |
| C4  | Index Strategy Document                        | C1, E1                       |     |
| C5  | Migration Strategy and Conventions             | None                         |     |
| D1  | Use Case Diagrams                              | None                         |     |
| D2  | Sequence Diagrams — All Phase 1 Workflows      | B2, B4, H1                   |     |
| D3  | State Machine Diagrams                         | B4                           |     |
| D4  | Domain Class Diagram                           | None                         |     |
| D5  | Deployment Diagram                             | None                         |     |
| D6  | Data Flow Diagrams — Key Operations            | B4, H1                       |     |
| E1  | tRPC Router and Procedure Catalog              | C1, B2, I1, I2               |     |
| E2  | REST API Specification (OpenAPI 3.0)           | C1, B2                       |     |
| E3  | Shared Zod Schema Catalog                      | C1                           |     |
| F1  | Application Route Map                          | I2, E1                       |     |
| F2  | Zustand Store Design                           | F1, E3                       |     |
| F3  | TanStack Query Key Factory                     | E1                           |     |
| F4  | Component Hierarchy Specification              | F1, F5                       |     |
| F5  | UI Component Library Setup and Package Architecture | None                    |     |
| F6  | Accessibility Compliance Checklist (WCAG 2.1 AA)   | F5                       |     |
| F7 | Frontend Implementation Plans | F4, F5, F6, J6 | |
| G1  | End-to-End Type Safety Chain                   | C1, E1, E3                   |     |
| H1  | Phase 1 Workflow Definitions (Structured Data) | B4, D3                       |     |
| H2  | Document Type Catalog with JSONB Schemas       | B4, H3                       |     |
| H3  | Numbering Series Configuration                 | None                         |     |
| H4  | Notification Event and Template Catalog        | B3, I2, H1                   |     |
| I1  | ABAC Policy Specification                      | B5, I2, H2                   |     |
| I2  | Role-Permission Matrix                         | None                         |     |
| I3  | Security Design Document                       | B5, I1                       |     |
| J1  | Software Design Patterns Document              | B2                           |     |
| J2  | Error Handling and Response Normalization      | None                         |     |
| J3  | Coding Standards and Conventions               | None                         |     |
| J4  | Module Structure Template                      | B2, J1                       |     |
| J5  | ADR Master Index                               | None                         |     |
| J6  | Kitchen-Sink Migration and Domain Component Catalog | F5                      |     |
| K1  | Test Strategy Document                         | B4                           |     |
| K2  | Workflow Engine Test Suite Design              | B4, D3, H1                   |     |
| K3  | Critical E2E Test Scenarios                    | F1, H1                       |     |
| L1  | Environment Variables Catalog                  | None                         |     |
| L2  | Docker and Docker Compose Specification        | D5, L1                       |     |
| L3  | CI/CD Pipeline Specification                   | K1, L2                       |     |
| L4  | Backup and DR Runbooks                         | C1, D5                       |     |

---

## Generation Waves

Documents within the same wave have no dependency on each other and can be generated in parallel.

| Wave | Documents                                              | Count |
| ---- | ------------------------------------------------------ | ----- |
| 1    | A2, B1, B4, B5, C5, D1, D4, D5, H3, I2, J2, J3, J5, L1, F5 | 15    |
| 2    | B2, D3, H2, K1, L2, F6, J6                                  | 7     |
| 3    | B3, C1, H1, I1, J1, L3                                 | 6     |
| 4    | C2, C3, D2, D6, E1, E2, E3, H4, I3, J4, K2, L4         | 12    |
| 5    | C4, F1, F3, G1                                         | 4     |
| 6    | F2, F4, K3                                             | 3     |
| 6.5 | F7           | 1 | 
| 7    | A1                                                     | 1     |

---

## Existing Reference Documents

These three documents pre-exist the planning document set (A1–M1) and are not generated by it. They are inputs that the prerequisite table's documents cite, implement, or are downstream of. They have no prerequisites of their own and are not part of the Generation Waves.

**consolidated-architecture-and-requirements-reference-iteration-3.md** — Source of truth (located in /docs/requirement-gathering)

The stakeholder-confirmed ground truth for what the system must do. Status: Post-Interview 2 (June 15), Developer Decisions Resolved, Pre-Development Baseline. Covers Parts 1–14: project identity and scope, Phase 1 scope decisions, confirmed stakeholders, all 18 confirmed document types and workflows (SP Resolution, SP Ordinance, Panlalawigan Review, Barangay Resolution/Budget, internal memos, letters, hearing notices, designations, citizen complaints, document requests, certification of urgency, order of business), the numbering system, standing committees, confirmed operational context, the multi-committee referral architectural finding, technology stack, architecture pattern and module boundaries, 21 consolidated key design decisions, 16 architectural invariants, the five-phase roadmap, and a historical record of resolved open questions (Part 14). Per AGENTS-v2.md Section 1, this document outranks all Group B–L architecture documents when they conflict with it — those documents are downstream interpretations of this one and can be wrong; this document is the thing they're implementing.

**tech-stack.md** — Source of truth (located in /docs/pre-development)

Confirmed for *how* the system is built: stack, libraries, and conventions. Covers: monorepo structure (pnpm workspaces, Turborepo), the full stack decisions table (Fastify, tRPC, Vite + React, PostgreSQL, Drizzle ORM, Zod, TanStack Query, Zustand, shadcn/ui, and other library choices with their hard constraints), the tRPC/REST hybrid architecture, the end-to-end type safety chain, PostgreSQL non-negotiables, the search strategy (PostgreSQL FTS → Meilisearch), file storage strategy, OCR strategy, audit log integrity approach, authentication architecture, testing priorities, migration rules, and deployment constraints. One open decision remains as of this version: the OCR library choice (`tesseract.js` preferred vs. a self-hosted cloud alternative) is explicitly marked unresolved — per AGENTS-v2.md Section 1, this item is not to be treated as decided until tech-stack.md itself is updated. Per AGENTS-v2.md Section 1, this document is outranked only by the consolidated reference; any pre-development document under Groups B–L that contradicts it has a bug.

**DESIGN.md** — Living; pending J6 update (located in /docs/design)

Version 1.1. The authoritative reference for the `batac-dms` design system. Covers: Brand DNA observed from batac.gov.ph (§1), the public-site-to-internal-app adaptation rationale (§2), the complete CSS token dictionary (§3), Tailwind v4 `@theme` config (§4), shadcn/ui theme overrides (§5), component usage guidelines for layout, navigation, data display, forms, feedback, and specialized components (§6), the State Color Map for 17 legislative and complaint statuses (§7), twelve UI Do/Don't rules (§8), a typography specimen (§9), and a running log of known implementation gaps (§10). §7 is the authoritative source for STATUS_META; its own §10 (Gap 2) notes that reconciliation against the `kitchen-sink.jsx` prototype's STATUS_META table is deferred to J6, and that until J6 is complete, `kitchen-sink.jsx`'s table is prototype-only. Status: will be updated again once J6 (Domain Component Engineering Reference) is generated, per the DESIGN.md Delta section J6 is required to produce.

---

## Group A — Project Planning

**A1. Master Phased Task List** — Blocking

The primary AI-assisted development driver. Covers all phases (1 through 5) but fully specifies only Phase 1. Each task contains: phase, module, human-readable description, explicit list of prerequisite task IDs, deliverables checklist, acceptance criteria, and a self-contained AI prompt to execute the task. Tasks must be granular enough that one task produces one PR. Input: the consolidated reference in its entirety.

**A2. Risk Register** — Pre-dev

A concise table of identified risks (technical, organizational, legal), their likelihood/impact ratings, and mitigation strategies. Primary sources: the "what can only be determined during development" category, the LMITS migration uncertainty, the sp.batac.gov.ph coexistence decision, and the COA/DILG compliance gap.

---

## Group B — Architecture Documents

**B1. System Architecture Document (C4 Model, Levels 1–3)** — Pre-dev

Level 1: system context showing Batac City LGU Platform and its external actors (citizens, Panlalawigan, Ilocos Times, LMITS, sp.batac.gov.ph). Level 2: container diagram (web SPA, Fastify server, PostgreSQL, S3-compatible, Meilisearch, pgboss, SSE). Level 3: component diagrams for each of the 11 modules listed in Part 10.2 of the consolidated reference. Mermaid format for portability.

**B2. Module Boundary and Internal API Contracts Document** — Blocking

For each of the 11 modules (iam, organization, documents, workflow, tracking, records, notifications, audit, search_meta, portal, reporting): the published interface it exposes to other modules, the domain events it emits, and the domain events it consumes. This is the enforcement spec for Architectural Law #2. No module may call another module's schema; this document defines the only legal communication paths.

**B3. Internal Domain Event Catalog** — Blocking

Every domain event in the system listed with: event name, producing module, consuming modules, payload schema (as Zod), and the business reason it exists. Examples: `document.logged`, `workflow.step_assigned`, `preliminary_number.assigned`, `final_number.assigned`, `certification_of_urgency.attached`, `panlalawigan_timer.expired`, `designation.activated`, `designation.expired`. This catalog is the foundation of the in-process event bus implementation.

**B4. Workflow Engine Specification Document** — Blocking

Detailed spec for the custom workflow engine. Covers: the execution model (step resolution, transition evaluation, event emission), all Phase 1 step types (`action`, `approval`, `multi_referral`, `decision`, `notification`, `termination`) and Phase 2 reserved types (`parallel_split`, `parallel_join`) with full behavior contracts for each. Covers: Certified Urgent bypass path logic, Thursday cutoff enforcement and Second Reading delay logic, 10-day Mayor lapse timer, 30-day Panlalawigan timer with RA 7160 Section 56(d) deemed-approval transition, version pinning at instance creation, Option A/B in-flight migration, and SLA clock behavior during outages.

**B5. Authentication and Authorization Architecture Document** — Blocking

Full specification of: JWT structure and claims, refresh token rotation, HTTP-only cookie setup, PKCE for SPA, session management rules (single active session, concurrent login handling, forced logout). ABAC policy model: resource types, actions, policy evaluation order, how office scoping works. RLS: which tables have RLS enabled and what the policies enforce. IT admin data isolation. Platform Admin role exclusion invariant. Future SSO migration path.

---

## Group C — Database

**C1. Full Database Schema DDL — All Phase 1 Schemas** — Blocking

Complete PostgreSQL DDL for all tables in schemas: `iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, `audit`. Includes: all columns with types, all constraints (NOT NULL, UNIQUE, CHECK for state transitions), all foreign keys (within schema only — cross-schema FKs prohibited per Invariant #1), all sequences for numbering series, soft-delete columns (`deleted_at`, `deleted_by`) on every table, `city_id UUID NOT NULL` on all core entity tables, `TIMESTAMPTZ` on all timestamp columns, UUID v4 primary keys everywhere. This is the most critical document — the schema is the foundation everything else is built on.

**C2. Entity-Relationship Diagrams — Per Schema** — Pre-dev

One ERD per schema (not one flat ERD for everything — that would be unreadable at this scale). Mermaid ER diagram syntax. Must include cardinality, optionality, and annotated column lists for complex join tables. Critical schemas for Phase 1: `documents`, `workflow`, `tracking`.

**C3. PostgreSQL Row-Level Security Policy Specifications** — Blocking

For every table where RLS is enabled: the SQL CREATE POLICY statements with their USING and WITH CHECK expressions. Must cover office-level isolation (employees can only see documents where `owning_office_id` matches their office or where they are a step assignee), classification level enforcement, and the IT admin exclusion (IT admin DB user bypasses RLS but cannot access `confidential`/`restricted` content by ABAC at the application layer).

**C4. Index Strategy Document** — Pre-dev

For each schema: the indexes beyond primary keys that are needed for the expected query patterns. Covers: GIN indexes on JSONB metadata columns, indexes on `owning_office_id`, `document_type_id`, `status`, `deleted_at` (partial), `city_id`, sequence fields for numbering queries, the partial unique index for active designations per user. Marking which indexes are Phase 1 vs. Phase 2 (Meilisearch takes over some full-text load).

**C5. Migration Strategy and Conventions Document** — Pre-dev

Rules for the Drizzle Kit migration workflow: naming conventions for migration files, review checklist before applying (the "review the SQL before applying" rule from tech-stack.md, formalized), what constitutes a breaking migration and how to handle it in a zero-downtime context, the prohibition on reset-and-regenerate in production, and the linting rules that enforce Invariants #1, #6, #7 automatically.

---

## Group D — UML and Diagrams

**D1. Use Case Diagrams — Per Actor** — Pre-dev

One diagram per primary actor: SP Secretary, SP Member/Councilor, Vice Mayor, Mayor, Records Officer, Platform Administrator, System Administrator, Citizen (portal user). Each diagram shows all use cases that actor can initiate or participate in within Phase 1 scope. Mermaid format.

**D2. Sequence Diagrams — All Phase 1 Workflows** — Pre-dev

One sequence diagram per workflow showing the exact message sequence between actors, system components, and modules. Required diagrams: SP Resolution (standard path), SP Resolution (Certified Urgent path), SP Resolution (veto path), SP Ordinance (standard path), SP Ordinance (Certified Urgent path), Appropriation Ordinance, Panlalawigan review (all four outcome paths), Citizen Complaint (full lifecycle), Designation grant and auto-expiry, QR code assignment and scan-to-lookup, Document Request Form (all three access modes), Control number deferred assignment flow. Mermaid sequence diagram syntax.

**D3. State Machine Diagrams** — Blocking

Three separate diagrams: (1) Document lifecycle states (`Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed`, with `Cancelled` as terminal from any active state). (2) Workflow instance states (`Created → Running → Paused → Completed → Cancelled`). (3) Workflow step instance states (`Pending → Active → Completed → Skipped → Returned → Cancelled`). All valid transitions labeled with the triggering event and any guard conditions.

**D4. Domain Class Diagram** — Pre-dev

A UML class diagram of the core domain model covering the entities listed in Part 9 of the domain context document plus all entities identified in the consolidated reference. Shows relationships, key attributes, and multiplicity. Not a DB schema diagram — this is the domain model. Separate from the ERDs. Mermaid class diagram syntax.

**D5. Deployment Diagram** — Pre-dev

Shows: Nginx/Caddy serving the static SPA bundle, Fastify server process (tRPC + REST in same process), PostgreSQL primary + streaming replication standby, S3-compatible object storage (Cloudflare R2 for Phase 1, MinIO path for on-premise migration), pgboss workers, Meilisearch container (Phase 2, reserved slot in diagram), SSE connections. Labels which traffic goes over which protocol. Marks the on-premise migration path.

**D6. Data Flow Diagrams — Key Operations** — Pre-dev

DFDs for the four operations with the most complex data movement: (1) Document intake and QR assignment at secretariat logging. (2) Final number assignment after last reading vote. (3) Panlalawigan 30-day timer expiry and deemed-approval transition. (4) Certification of Urgency multi-measure attachment and workflow bypass. These are not sequence diagrams — they show data stores, processes, and data flows.

---

## Group E — API Design

**E1. tRPC Router and Procedure Catalog** — Blocking

Full catalog of all tRPC routers and every procedure within each router for Phase 1. For each procedure: name, input schema (Zod reference), output schema (Zod reference), which role(s) can call it, any ABAC conditions beyond role, and the business operation it performs. Organized by module. This document is the contract between `/server` and `/web`. It must be complete enough that frontend and backend developers can work in parallel.

**E2. REST API Specification (OpenAPI 3.0)** — Pre-dev

OpenAPI 3.0 YAML spec for all public REST endpoints. Phase 1 public endpoints are limited: public document status lookup by tracking number (no auth), published documents listing and first-page preview (no auth), citizen complaint submission (no auth), Document Request Form submission (no auth). Format compatible with `@fastify/swagger` auto-generation — the spec and the route schemas must stay in sync.

**E3. Shared Zod Schema Catalog** — Blocking

The catalog of every Zod schema that lives in `/packages/shared`. Organized by domain. Each entry: schema name, fields, types, validation rules, and which layers consume it (backend validation, tRPC input, form validation, response type). This document enforces that the shared package is the single source of truth per the type safety chain in tech-stack.md.

---

## Group F — Frontend Architecture

**F1. Application Route Map** — Pre-dev

All pages/views in `/apps/web` for Phase 1, organized by route path. Each route: path, component name, required role(s) to access, primary data dependencies (which tRPC procedures it calls), and whether it has child routes. Covers: SP Secretary dashboard, Order of Business view, document intake form, workflow step action views, session attendance tracking, Mayor dashboard, audit log viewer, Platform Administrator views, and the Phase 1 public portal subset.

**F2. Zustand Store Design Document** — Pre-dev

All Zustand stores for Phase 1, each with: store name, state shape (TypeScript interface), actions, and which UI concerns it manages (modals, sidebar state, multi-step form state, active session context, notification drawer state). Explicit boundary from server state (which lives in TanStack Query, not Zustand).

**F3. TanStack Query Key Factory Specification** — Pre-dev

The complete key factory for all TanStack Query cache keys in the application. Follows the standard factory pattern (e.g., `documentKeys.all`, `documentKeys.list(filters)`, `documentKeys.detail(id)`). Required for correct cache invalidation — incorrect key structures cause stale data bugs that are hard to trace. One factory per module.

**F4. Component Hierarchy Specification** — Early-dev

Top-down breakdown of the React component tree for Phase 1's primary views: the SP Secretary dashboard, the document detail view (with routing history, step timeline, QR cover sheet preview), the Order of Business view with red-flagging logic, and the Mayor dashboard. For each view, specifies the three-tier decomposition: (1) which shadcn Tier 1 primitives are used directly, (2) which Tier 2 CVA-overridden components (`Button`, `Tabs`, `Avatar`) are used, and (3) which Tier 3 domain compound components from `packages/ui` (`StatusBadge`, `DocumentNumberBadge`, `SLATimer`, `WorkflowStepIndicator`, etc.) are placed. Specifies which components live in `/packages/ui` (reusable across views) vs. `/apps/web` (page-specific compositions). Prerequisite: F5 must be complete before F4 is written, since the Tier 3 component inventory in F5 is what F4 places into the tree. This can be refined during development but the top two levels must be settled before view implementation begins.

**F5. UI Component Library Setup and Package Architecture** — Blocking

Complete specification of the `packages/ui` library: its scope, what it owns, and what it does not own (no business logic, no tRPC types, no Zod schemas). A locked technology table for decisions now irrevocable: Tailwind v4 (`@theme` block in `globals.css` — no `tailwind.config.ts`), shadcn/ui with `rsc: false`, CVA for variant management, `clsx` + `tailwind-merge` via `cn()`, Lucide icons exclusively, Sonner for toasts, Radix UI primitives as the accessibility layer. A confirmed deviations table documenting every place the implementation files diverge from DESIGN.md, including the WCAG-required `text-muted` correction (`#868e96` → `#5a6470`) and the extended token scale stops (`danger-50/200/700`, `success-300`) added from kitchen-sink.jsx usage. The core section: a three-tier component inventory — Tier 1 (shadcn primitives, used as-is: Card, Input, Textarea, Label, Separator, Skeleton, Badge, Dialog, Sheet, Tooltip, Table, Alert, Command, Popover, Select, Checkbox, Calendar, Chart, Breadcrumb, Sonner); Tier 2 (shadcn primitives with CVA overrides, already implemented: `Button`, `Tabs`, `Avatar`); Tier 3 (domain compound components to be built: `DocumentNumberBadge`, `StatusBadge`, `WorkflowStepIndicator`, `SLATimer`, `ScanQualityIndicator`, `RoutingHistoryTimeline`, `StatCard`, `EmptyState`, `OrderOfBusinessRow`, `CommitteeReferralBlock`, `DocumentPreviewCard`, `QRCodeDisplay`, `AppShell`, `Sidebar`, `Topbar`, `PageHeader`) — each Tier 3 entry includes the props interface, which DESIGN.md section defines its visual behavior, and which Tier 1 primitives it composes. Token exposure and CSS consumption rules. The `package.json` exports map. The PR boundary definition between foundation setup (Tier 1 + Tier 2, single PR) and feature work (each Tier 3 component ships in its own PR). A runbook for adding components. Source documents: DESIGN.md, `globals.css`, `button.tsx`, `tabs.tsx`, `avatar.tsx`, `components.json`, `INSTALL.sh`, `date-locale.ts`, `utils.ts`, `kitchen-sink.jsx`.

**F6. Accessibility Compliance Checklist (WCAG 2.1 AA)** — Blocking

The engineering accessibility specification and PR gate for all frontend work. Compliance target: WCAG 2.1 AA. Primary environment: Windows 11 workstations at City Hall (keyboard + mouse); secondary: personal phones for barangay users (touch). Screen reader target: NVDA + Chrome (primary), VoiceOver + Safari on iOS (secondary). Sections: universal rules applicable to every PR (focus ring, touch targets, no color-alone meaning, reduced motion, page title, language attribute); component-specific ARIA contracts for every Tier 3 domain component with non-trivial requirements (`SLATimer`: `role="timer"` + `aria-live="polite"` + progress bar `role="progressbar"`; `WorkflowStepIndicator`: `<ol>` with `aria-current="step"` on active node; `QRCodeDisplay`: `role="img"` + `aria-label`; `OrderOfBusinessRow`: red-flag icon `role="img"` + `aria-label`; `Sidebar`: `aria-current="page"` + `aria-expanded` on collapse toggle; command palette: focus trap + Escape return; Dialog: focus trap + `aria-describedby`; DataTable: `<table>` required, `aria-sort`; file upload: `role="region"` + `aria-live`; Sonner toasts: `aria-live` variant by severity); form accessibility rules (every field must have an associated `<label>` via `htmlFor`; error messages in `role="alert"`; `aria-required="true"` on required fields — the no-`<form>`-element rule does not exempt fields from label association); keyboard navigation contract (Tab, Enter, Space, Arrow, Escape, `⌘K`/`Ctrl+K`); color contrast reference table for every foreground/background token pair with computed ratios and AA pass/fail; a one-page markdown checklist version of all rules for direct paste into PR review comments. Source documents: DESIGN.md, `globals.css`, F5.

---

**F7. Frontend Implementation Plans** — Pre-dev

AI-agent–ready implementation plans for the entire `packages/ui` build sequence.
Synthesizes DESIGN.md, F4, F5, F6, and J6 into three self-contained plan
templates: Plan 0 (Foundation PR — Tier 1 install, Tier 2 replacement,
`/dev/components` smoke test, token verification), Plan 1 (Tier 3 Component
Template — a reusable AI Agent Prompt template with a per-component fill-in
table covering all 16 Tier 3 domain components, each row specifying the
DESIGN.md section, J6 types, composing primitives, Tier 3 dependencies, and
dev-route states to render), and Plan 2 (Cross-Component Integration Page —
the `/dev/all-components` task that catches proportion and composition issues
invisible when reviewing components individually). Includes a reconciliation
notes section recording deviations corrected against F5 §4.3 (the authoritative
Tier 3 composition source). The canonical input for the A1 UI module pass;
replaces any informal "Frontend Foundation Plans" conversation artifact. Source
documents: DESIGN.md, F4, F5, F6, J6, `globals.css`, `button.tsx`, `tabs.tsx`,
`avatar.tsx`, `components.json`, `INSTALL.sh`.

---

## Group G — End-to-End Type Safety

**G1. End-to-End Type Safety Chain Document** — Blocking

A single document that traces the full type inference chain from database to UI for this specific stack. Shows exactly how a Drizzle schema column becomes a Zod schema via `drizzle-zod`, how that Zod schema flows into a tRPC procedure input/output, how `fastify-type-provider-zod` uses it for route validation, and how TanStack Query (via tRPC v11) surfaces inferred types in React components. Includes: how to handle nullable fields correctly at each layer, the pattern for extending `drizzle-zod` schemas with application-layer validations, and the one-way rule (types always flow from DB schema outward, never the reverse). Also covers the `@hookform/resolvers/zod` integration for forms.

---

## Group H — Domain Configuration Documents

These are not code — they are the seed data and configuration that the system is initialized with. Without them, the Platform Administrator cannot configure the system on day one.

**H1. Phase 1 Workflow Definitions — Structured Data** — Blocking

The actual workflow definition data structures (JSON or TypeScript constants) for: SP Resolution (standard + Certified Urgent paths), SP Ordinance (standard + Certified Urgent paths), Appropriation Ordinance. Each definition includes: all steps with their types, all transition rules with their conditions, the multi-referral step with its all-committees-must-sign constraint, the 10-day Mayor timer transition, the Thursday cutoff enforcement rule, and the legally mandated minimum step guards. These are the seed records that go into the `workflow.definitions` table.

**H2. Document Type Catalog with JSONB Metadata Schemas** — Blocking

For each Phase 1 document type: `document_type_id` (UUID), `name`, `code`, `owning_module`, the `metadata_schema` JSONB definition (what configurable fields exist beyond the standard columns), `retention_schedule_id`, `number_series_id`, whether preliminary numbering applies, and the `public_visibility_rule`. Covers: SP Resolution, SP Ordinance, Appropriation Ordinance, Certification of Urgency (no standalone number — attached), Citizen Complaint, Document Request Form, Transmittal Letter, Designation (Phase 1B but schema should be reserved).

**H3. Numbering Series Configuration Specification** — Blocking

The seed configuration for every `number_series` record. Each entry: `series_id`, `document_type_code`, `prefix`, `delimiter` (space, per Q-A01), `year_format`, `sequence_padding` (how many digits for NN), the PostgreSQL sequence name it maps to, `resets_annually` (true for all Phase 1 series), `authority_office_id` (SP Secretariat for all SP document types), `preliminary_format` (where applicable: `Draft {prefix} {YEAR}-{NN}`), and `final_format` (`{prefix} {YEAR}-{NN}`). Covers all 11 confirmed series from Part 5.1 of the consolidated reference.

**H4. Notification Event and Template Catalog** — Pre-dev

Every notification event in Phase 1: the triggering domain event, the recipient(s) (by role or specific office), the delivery channel (in-app SSE, email — Phase 2), and the template content in all three languages (Filipino, English, Ilocano). Priority events: workflow step assigned, step overdue, Thursday cutoff approaching, committee report missing (red-flag), Mayor 10-day lapse approaching, Panlalawigan 30-day timer milestone, Certification of Urgency logged and bypassing committee, designation auto-expiry.

---

## Group I — Security and Authorization

**I1. ABAC Policy Specification** — Blocking

For every resource type (Document, WorkflowInstance, StepInstance, TrackingRecord, AuditEvent, etc.) and every action (create, read, update, transition, assign, archive, dispose): the exact ABAC policy expressed as conditions on subject attributes (role, office, position) and resource attributes (owning_office_id, classification, current workflow step). This is the spec that the policy evaluation engine is implemented from. Must also include the negative policies: IT admin cannot read document content, encoder and final approver cannot be the same user (Invariant #13).

**I2. Role-Permission Matrix** — Blocking

A complete matrix: all system roles (rows) × all discrete permissions (columns). Mark each cell: Allow, Deny, or Conditional (with condition reference to I1). Roles from Part 10 of the domain context: System Administrator, Platform Administrator, Records Officer, Department Encoder, Department Approver, SP Secretary, SP Member, SP Presiding Officer, Mayor, Barangay Encoder, Barangay Captain, Auditor, Citizen. This matrix is the single source of truth for IAM configuration on day one.

**I3. Security Design Document** — Pre-dev

Covers: threat model (who are the adversaries, what do they want, what assets are at risk), security controls per threat, audit log tampering detection procedure, the hash-chaining and HMAC implementation approach for the audit schema, the backup encryption key custody procedure, the break-glass envelope procedure, the RA 10173 erasure request handling workflow (legal review required before any PII erasure), and the IT admin zero-content-access enforcement mechanism at the PostgreSQL grant level.

---

## Group J — Software Design Patterns and Standards

**J1. Software Design Patterns Document** — Pre-dev

Documents the specific patterns used in this codebase and how they are applied: Repository Pattern (data access abstraction per module — how Drizzle queries are wrapped, not exposed directly to procedure handlers), Service Layer Pattern (business logic between tRPC/REST handlers and repositories — no business logic in route handlers), Domain Event Pattern (how events are emitted and consumed in the in-process event bus — the EventEmitter wrapper and type-safe event registration), the Module Plugin Pattern (how each module is registered as a Fastify plugin with its own scope), and the Query Key Factory Pattern for TanStack Query. For each: the canonical implementation structure and what is prohibited.

**J2. Error Handling and Response Normalization Strategy** — Pre-dev

The standard error shape for tRPC (TRPCError codes and how each maps to HTTP status when called via REST), the standard error shape for REST routes, how Zod validation errors are serialized, how domain errors (e.g., `NumberSeriesExhausted`, `DuplicateControlNumber`, `ActiveDesignationExists`) are typed and surfaced to the frontend, and the Sentry integration points (which errors are captured, what context is attached).

**J3. Coding Standards and Conventions Document** — Pre-dev

TypeScript strictness settings (`strict: true`, no `any`, explicit return types on exported functions), import ordering rules, naming conventions (PascalCase for types/interfaces/components, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants, kebab-case for file names in `/packages` and `/apps`), the prohibition on cross-module schema imports, comment conventions (JSDoc for all exported functions in `/packages/shared`), and Prettier/ESLint config decisions.

**J4. Module Structure Template** — Pre-dev

The canonical folder and file layout for a server-side module. Example for `documents`: `documents/index.ts` (Fastify plugin registration), `documents/router.ts` (tRPC router), `documents/service.ts` (business logic), `documents/repository.ts` (Drizzle queries), `documents/events.ts` (domain event definitions and emitters), `documents/types.ts` (module-private types), `documents/schemas.ts` (Zod schemas not shared externally). This template is used for all 11 modules. Deviations require an ADR.

**J5. ADR Master Index** — Pre-dev

A master index of all Architectural Decision Records (ADRs) across the platform, linking to specific decision documents for APIs, authentication, database schemas, events, general architecture, testing, and UI decisions.

**J6. Domain Component Engineering Reference** — Blocking

The single engineering source of truth for all Tier 3 domain compound components in `packages/ui`. Serves three purposes: (1) defines all shared TypeScript types consumed across Tier 3 components — `DocumentState`, `NumberVariant`, `SLAStatus`, `ScanQualityLevel`, `RoutingAction`, `CommitteeReportStatus`, `RoutingEntry`, `WorkflowStep`, `CommitteeReferral`, `OrderOfBusinessItem`, `DocumentPreview`, `StatusMetaEntry` — in `packages/ui/src/types/domain.ts`, exported from the `@batac/ui` barrel; (2) produces the canonical `STATUS_META` constant as `Record<DocumentState, StatusMetaEntry>`, reconciled line-by-line against DESIGN.md §7 (authoritative on conflict), with every class an existing Tailwind utility from `globals.css`'s `@theme` block and missing tokens flagged; (3) provides a per-component spec — props interface, Tier 1/2 dependencies, visual behavior, ARIA-affecting props (cross-referenced to F6), a usage example with real domain mock data, and one anti-pattern — for all 16 Tier 3 components in build-dependency order, sufficient for an AI agent to implement any one correctly in a single PR. Source documents: DESIGN.md §6–8; `globals.css`; F5; F6; consolidated reference Parts 4.1, 4.2, 4.14, 4.17, 4.18, 5.1, 11.4–11.6; `d2-sequence-diagrams.md` Diagrams 1, 2, 7B, 7C, 7D.

---

## Group K — Testing

**K1. Test Strategy Document** — Pre-dev

Testing priorities (from tech-stack.md, formalized): (1) Workflow engine state machine — every valid and invalid state transition, (2) API integration tests for all ABAC-protected routes using Fastify's `.inject()`, (3) E2E tests for critical journeys. Defines: what belongs in Vitest unit tests (service layer pure functions, state machine transitions, Zod schema validations), what belongs in Vitest integration tests (database operations with a test PostgreSQL instance, full tRPC procedure calls), what belongs in Playwright E2E (see K3). Explicitly notes: no coverage targets for CRUD modules.

**K2. Workflow Engine Test Suite Design** — Pre-dev

The complete test case specification for the workflow engine before any engine code is written. Covers: all valid step transitions, all invalid step transitions (must throw), the multi-referral completion conditions (all committees signed vs. SP Secretary manual override), the Thursday cutoff enforcement, the Certified Urgent bypass path, the 10-day lapse timer transition, the 30-day Panlalawigan timer transition, version pinning behavior (instance resolves steps from pinned version, not current version), and the one-active-designation-per-person constraint enforcement.

**K3. Critical E2E Test Scenarios** — Early-dev

The five or six Playwright E2E scenarios that cover the highest-risk user journeys. Recommended: (1) Full SP Resolution lifecycle from secretariat logging to Panlalawigan VALID outcome. (2) Certified Urgent path from logging through same-session second reading. (3) Mayor 10-day lapse-into-law path. (4) Citizen Complaint submission through all three access modes to resolution. (5) QR code scan from a mobile device resolving to the correct document status page. (6) SP Secretary manual override of a missing committee report with mandatory audit log entry. These can be detailed during development but the scenario list must be settled pre-dev so they are not written as an afterthought.

---

## Group L — Infrastructure and DevOps

**L1. Environment Variables Catalog** — Blocking

Every environment variable the application requires: name, type, whether it is required or optional, which apps/packages consume it, and the value format. Covers: database connection strings, S3 credentials and bucket names, JWT secrets, cookie secrets, SMTP config, Sentry DSN, Meilisearch keys, pgboss schema name, CORS allowed origins, SLA thresholds (configurable at env level), the city UUID seed value. This is the spec that the `dotenv + Zod schema` startup validation is implemented from. Without it, the "fail fast on missing vars" guarantee cannot be built correctly.

**L2. Docker and Docker Compose Specification** — Pre-dev

The Docker Compose file design for local development (PostgreSQL, MinIO for local S3, pgboss, Meilisearch placeholder container) and the Dockerfile designs for the Fastify server and the Vite build. Includes: health check configurations, volume mounts for local development, the environment variable injection strategy, and the seed/migration entrypoint.

**L3. CI/CD Pipeline Specification** — Early-dev

The pipeline stages: lint → typecheck → unit tests → integration tests (against a test DB spun up in CI) → build → E2E tests → deploy (staging) → deploy (production, manual gate). Which pipeline stages are required to pass before merge to main. The Turborepo remote caching setup. Can be implemented in the first week of development rather than pre-dev.

**L4. Backup and DR Runbooks** — Early-dev

Operational runbooks for: daily encrypted `pg_dump` to S3, WAL-based PITR archiving configuration, streaming replication setup and lag monitoring, the monthly restoration test procedure, the quarterly DR drill procedure, and the break-glass procedure (physical sealed envelope, who opens it, what is logged). These must exist before any production data is written.

---

## What Can Only Be Determined During Development

To set realistic expectations: even with all 30+ documents above complete, these items cannot be pre-decided and will require decisions during development:

- Exact Drizzle ORM schema syntax for complex constraints (some PostgreSQL features require raw SQL within Drizzle — discovered at implementation time)
- PostgreSQL sequence configuration edge cases (e.g., behavior when a year rolls over mid-transaction)
- Fastify plugin registration order for the tRPC + REST hybrid (ordering bugs surface at runtime)
- SSE reconnection behavior under intermittent connectivity (Barangay context — must be tested empirically)
- pgboss job retry and dead-letter behavior for the 10-day and 30-day timers under failure conditions
- Specific query performance issues (identified once real data volumes and query patterns are observable)
- The OCR library selection and its quality threshold calibration for Filipino documents
- Any new organizational or workflow information that surfaces once staff begin using the system (per the "operational source of truth" framing in Part 1 of the domain context)

The documents above represent everything that can be pre-decided. The items in this last section are not gaps in the documentation — they are legitimate development-time decisions.
