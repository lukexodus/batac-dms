# Git Workflow Guide

## Table of Contents

- [L19–L103] Repository Structure — Naming conventions for main, feature, fix, and research branches.
- [L104–L131] Initial Setup — Cloning the repo, installing pnpm workspaces, and tracking task branches.
- [L132–L178] Daily Workflow — Commands to pull main, merge conflicts, and commit progress daily.
- [L179–L202] Pull Request Workflow — Requirements for PR titles, checklists, testing gates, and special tags.
- [L203–L237] Suggested Commit Format — Standardized prefixes and task ID integration rules for clean history.
- [L238–L273] Merge Conflict Resolution — Step-by-step resolve markers, post-conflict validation, and pushing fixes.
- [L274–L297] Important Collaboration Rules — Rules on task boundaries, secrecy, schema isolation, and accessibility.
- [L298–L310] Project Roadmap Phases — Description of Phase 1 through 5 capabilities and timeline.
- [L311–L339] Useful Workspace Commands — Common scripts for dev servers, testing, typechecking, and building.
- [L340–L356] Module & Code Ownership — The 13 exhaustive modules defining system division and prefixes.

---

## Repository Structure

### Branches

```text
master
├── feature/TASK-INFRA-NNN (e.g., feature/TASK-INFRA-001-setup)
├── feature/TASK-UI-NNN    (e.g., feature/TASK-UI-015-status-badge)
├── feature/TASK-IAM-NNN   (e.g., feature/TASK-IAM-002-abac-rules)
├── feature/TASK-AUDIT-NNN (e.g., feature/TASK-AUDIT-003-hash-chaining)
├── feature/TASK-ORG-NNN   (e.g., feature/TASK-ORG-001-offices-crud)
├── feature/TASK-DOCS-NNN  (e.g., feature/TASK-DOCS-003-ocr-service)
├── feature/TASK-WF-NNN    (e.g., feature/TASK-WF-008-cutoff-logic)
├── feature/TASK-TRACK-NNN (e.g., feature/TASK-TRACK-002-qr-generator)
├── feature/TASK-REC-NNN   (e.g., feature/TASK-REC-001-schema-reservation)
├── feature/TASK-NOTIF-NNN (e.g., feature/TASK-NOTIF-002-sse-notifications)
├── feature/TASK-PORTAL-NNN(e.g., feature/TASK-PORTAL-003-status-lookup)
├── feature/TASK-SEARCH-NNN (Phase 2)
└── feature/TASK-REPORT-NNN (Phase 2/4)
```

### Branch Types

#### Master Branch

```text
master
```

Rules:

- Protected branch
- No direct commits to `master`
- Only merged through Pull Requests
- Always contains stable, buildable, and production-ready code

---

#### Feature Branches

Used for implementing tasks defined in the Master Phased Task List (A1). Each task maps to a single Pull Request ("one task produces one PR").

Naming Convention:

```text
feature/TASK-{MODULE}-{NNN}-{short-description}
```

Examples:

- `feature/TASK-UI-015-status-badge`
- `feature/TASK-WF-011-lapse-timer`
- `feature/TASK-DOCS-005-schema`

---

#### Bug Fix Branches

Used for addressing bugs in merged code or hotfixes in production.

Naming Convention:

```text
fix/TASK-{MODULE}-{NNN}-{short-description}
or
fix/{issue-description}
```

Examples:

- `fix/TASK-IAM-005-login-cookie`
- `fix/workflow-cutoff-check`

---

#### Research / Prototype Branches

Used for experiments, spikes, or testing alternative implementation pathways (e.g., OCR libraries, SSE connections).

Naming Convention:

```text
research/{topic-description}
```

Examples:

- `research/ocr-library-evaluation`
- `research/sse-reconnection-behavior`

---

## Initial Setup

Each team member must set up the project locally utilizing `pnpm` workspaces:

```bash
# Clone the repository
git clone <repo-url>
cd batac-dms

# Install monorepo dependencies
pnpm install

# Check out master and pull latest changes
git checkout master
git pull origin master

# Create your task-specific branch
git checkout -b feature/TASK-UI-001-foundation
```

Push and track your branch on the remote:

```bash
git push -u origin feature/TASK-UI-001-foundation
```

---

## Daily Workflow

### Start of Session

Update your local repository and merge the latest master changes:

```bash
git checkout master
git pull origin master
git checkout feature/TASK-UI-001-foundation
git merge master
```

---

### During Development

Check local changes:

```bash
git status
```

Stage modified and new files:

```bash
git add .
```

Commit changes using the standardized format (see commit format guidelines):

```bash
git commit -m "feat(ui): [TASK-UI-001] install Tier 1 primitives and styles"
```

---

### End of Session

Push your work to the remote repository:

```bash
git push
```

---

## Pull Request Workflow

When a task's implementation is complete:

1. Push all code to the remote branch:
   ```bash
   git push origin feature/TASK-UI-001-foundation
   ```
2. Open a Pull Request targeting `master`.

### PR Requirements

- **PR Title**: Starts with the task ID (e.g., `[TASK-UI-001] Foundation PR`) and prepends special tags (`[MIGRATION]`, `[ABAC]`, `[AUDIT]`) where relevant.
- **Pre-Merge Validation**: Code must pass `pnpm typecheck`, `pnpm lint`, and tests (`pnpm test`).
- **PR Checklist**:
  - Summary of changes and why they were made.
  - Screenshots or video recordings for UI changes.
  - Link to the mandatory dev route (e.g., `/dev/{component-name}`) showing the component in all states (UI component PRs only).
  - Proof of accessibility compliance auditing (F6) (UI component PRs only).
  - Testing details (vitest outputs for unit/integration tests).
  - Verification steps for reviewers.

---

## Suggested Commit Format

Commit titles must be prefixed with the module scope and include the task ID to ensure clear traceabilty.

### New Features

```text
feat(ui): [TASK-UI-015] implement StatusBadge component
feat(wf): [TASK-WF-008] enforce Thursday cutoff in workflow transitions
feat(docs): [TASK-DOCS-003][MIGRATION] add metadata_schema column to document_types
```

### Bug Fixes

```text
fix(iam): [TASK-IAM-005] resolve duplicate session cookie bug
fix(track): [TASK-TRACK-002] fix QR scanning target alignment
```

### Refactoring

```text
refactor(wf): simplify step transition evaluation logic
```

### Documentation

```text
docs: update system architecture diagram in B1
```

### Maintenance

```text
chore: update date-fns-tz dependency in packages/ui
chore: configure Turborepo pipelines
```

---

## Merge Conflict Resolution

When merging `master` into your feature branch:

```bash
git merge master
```

If conflicts occur:

```bash
git status
```

Open the conflicted files and resolve the differences within the markers:

```text
<<<<<<< HEAD
your task code
=======
merged master code
>>>>>>> master
```

Verify your fixes before committing:

```bash
pnpm typecheck
pnpm test
git add .
git commit -m "chore: resolve merge conflicts with master"
git push
```

---

## Important Collaboration Rules

### Rule 1: One Task = One Branch = One PR

Do not combine tasks. Each task is a granular, atomic, independently reviewable unit of delivery.

### Rule 2: Never Commit Secrets or Build Outputs

Ensure local credentials (`.env`, `.env.local`), vendor packages (`node_modules/`), and compiler assets (`dist/`, `.turbo/`, `build/`) are ignored by `.gitignore`.

### Rule 3: Commit Frequently and Atomically

Avoid dumping days of work into a single commit. Make small, logical commits that represent a single unit of progress.

### Rule 4: Strictly Adhere to Schema Boundaries

Per Architectural Law #1, do not import databases or schemas across module boundaries. Communication must happen via event bus (`AUDIT`, `NOTIF`) or published module APIs.

### Rule 5: UI Accessibility & Testing Gate

Every Tier 3 component PR must feature its own `/dev/{component-name}` route rendering all states, and must be audited against F6 WCAG 2.1 AA checklist (focus rings, contrast ratios, text scaling).

---

## Project Roadmap Phases

We structure development around the project's actual roadmap phases:

- **Phase 1: Core DMS & Legislative Workflows** — Infrastructure setup, custom workflow engine transitions, core tracking, notification SSE channel, IAM logic, and public-portal search subset.
- **Phase 1B: Expanded Workflows** — Committee referral configurations, standing committee schemas, and legislative metadata extensions.
- **Phase 2: Search & Reporting** — Meilisearch metadata indexing and sync, and ARTA compliance report generation.
- **Phase 3: Public Portal Expansion & Data Privacy Compliance** — Interactive citizen accounts, request tracking, and DPA (Data Privacy Act) compliance logs and policies.
- **Phase 4: Builders & End-User Configuration** — Visual workflow template builder and custom query/report designer.
- **Phase 5: Scaling & Migration** — Multi-tenant scale validation, payroll/HRIS external API gateways, and production on-premise migration scripting.

---

## Useful Workspace Commands

Run commands from the monorepo root using `pnpm` workspaces:

```bash
# Run development server for apps/web and packages/ui dev route
pnpm dev

# Run development server specifically for the internal app
pnpm --filter @batac/web dev

# Install dependencies for packages/ui
pnpm add <package-name> --filter @batac/ui

# Run full project typechecking in strict mode
pnpm typecheck

# Run Vitest test suites across the entire codebase
pnpm test

# Run tests specifically for a package
pnpm --filter @batac/ui test

# Build all applications for production
pnpm build
```

---

## Module & Code Ownership

The codebase is structured around 13 modules, each mapping to task codes and folder areas:

- `INFRA` — DevOps, Docker Compose, CI/CD, backup/DR runbooks.
- `UI` — Shared `@batac/ui` component library (Tailwind v4 tokens, Tier 2, Tier 3 components).
- `IAM` — Identity & Access Management (JWTs, RBAC/ABAC rules, auth cookie handling).
- `AUDIT` — Audit log, SHA-256 hash chaining, HMAC tamper-proofing.
- `ORG` — LGU office structure, designations, position assignments.
- `DOCS` — Document intake, OCR service, document type schemas, metadata.
- `WF` — Custom workflow engine, step transitions, review timers.
- `TRACK` — QR code generation, document scan-to-lookup, tracking routing history.
- `REC` — Records Management, retention schedules, archive/disposal.
- `NOTIF` — In-app notifications (SSE) for priority workflow events.
- `PORTAL` — Public-facing no-auth endpoints, citizen portal requests.
- `SEARCH` (Phase 2) — Meilisearch metadata indexing and sync.
- `REPORT` (Phase 2/4) — ARTA report generator, custom reports.
