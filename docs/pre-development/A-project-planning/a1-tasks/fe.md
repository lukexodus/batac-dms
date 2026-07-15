## Table of Contents

- [L29–L375] TASK-WF-FE-001 — Task inbox page listing all workflow steps currently assigned to the logged-in user.
- [L376–L890] TASK-WF-FE-002 — Workflow step action detail page and prerequisite backend additions for committee list and panel hints.
- [L891–L1374] TASK-WF-FE-003 — Fixes wrong mutation path and gating condition for the secretariat_decision step-completion workflow path.
- [L1375–L1623] TIER 0 — Before Frontend Work Starts — Backend additions, bug fixes, and architecture decisions blocking subsequent frontend work.
  - [L1381–L1482] TASK-PRE-01 — Add `complaints.get` and `documentRequests.get` (ADR-UI-005 was never implemented) — Implement get endpoints for complaints and document requests as specified in ADR-UI-005.
  - [L1483–L1516] TASK-PRE-02 — Fix `organization.listCommittees` role gate (live bug in shipped code) — Widen `organization.listCommittees` role check to include `sp_member` to fix a live authorization bug.
  - [L1517–L1548] TASK-PRE-03 — AUDIT backend/spec reconciliation (decision + implementation) — Resolve discrepancy between actual backend procedures and F1 spec for audit log query endpoints.
  - [L1549–L1575] TASK-PRE-04 — Resolve Designation vs. Delegation (decision, not implementation) — Resolve product decision on automatic vs. manual substitute-officer selection for session attendance.
  - [L1576–L1594] TASK-PRE-04b — Surface `presidedByEmployeeId` in `getAttendanceRecord` (conditional on TASK-PRE-04's outcome) — Expose `presidedByEmployeeId` in the session attendance record query to enable read-only substitute display.
  - [L1595–L1623] TASK-PRE-05 — Add `.output()` Zod schemas to `complaints.router.ts` and `document-requests.router.ts` — Add output schemas to complaints and document requests procedures to ensure client type safety.
- [L1624–L1683] TIER 1 — IAM (no Tier 0 dependency) — Frontend task list for Identity and Access Management views and admin screens.
- [L1684–L1732] TIER 2 — ORG (no Tier 0 dependency, except TASK-PRE-02 lands alongside) — Frontend task list for Organization structures, employees, and committee management views.
- [L1733–L1787] TIER 3 — WF: Order of Business and Sessions — Frontend task list for legislative Order of Business and session attendance tracking.
- [L1788–L1851] TIER 4 — WF: Dashboards — Frontend task list for role-specific landing dashboards (Secretary and Mayor).
- [L1852–L1983] TIER 5 — DOCS: Complaints and Document Requests — Frontend task list for Document management workflows, including complaints and request tracking pages.
  - [L1856–L1875] TASK-FE-DOCS-001 — `/complaints` (ComplaintsListPage) — Paginated list of citizen complaints with status filtering, linked to detail pages.
  - [L1876–L1894] TASK-FE-DOCS-002 — `/complaints/new` (ComplaintIntakeClerkAssistedPage) — Clerk-assisted complaint intake form for SP Secretary, routing to details on success.
  - [L1895–L1919] TASK-FE-DOCS-003 — `/complaints/:complaintId` (ComplaintDetailPage) — Complaint detail page with actions for assignment (Secretary), report entry (SP Member), and outcome resolution (Secretary).
  - [L1920–L1939] TASK-FE-DOCS-004 — `/document-requests` (DocumentRequestsListPage) — Paginated list of document requests with name/number filters and simple dual-approval progress indicators.
  - [L1940–L1958] TASK-FE-DOCS-005 — `/document-requests/new` (DocumentRequestIntakeClerkAssistedPage) — Clerk-assisted document request creation form with repeatable fields and a printable data layout view.
  - [L1959–L1983] TASK-FE-DOCS-006 — `/document-requests/:requestId` (DocumentRequestDetailPage) — Document request detail page showing request details, dual approvals, and copy release actions.
- [L1984–L1993] What's still not attempted, and why — unchanged from last turn, restated for completeness — Summary of unbuilt frontend routes and features that remain blocked on backend or spec decisions.

---

## TASK-WF-FE-001

```
CONTEXT — READ THIS FIRST

You are implementing a new frontend task, informally called TASK-WF-FE-001, that
has no existing entry in wf.md or docs.md — both are closed (wf.md's workflow
engine backend tasks TASK-WF-006 through TASK-WF-009 are done; docs.md's DOCS
module task list is closed at DOCS-022, with DOCS-020/021/022/023 already built
as standalone-document follow-ons). This task follows that same "standalone
document after its module's task-list file closed" precedent, (docs/compressed-exploration-findings/frontend-tasklist-creation-knowledge-base.md).
Everything below is implementation guidance, verified against real code and
docs in a prior session — it is not itself formatted as that template.

Read AGENTS.md before doing anything else if you have not already
internalized it this session. The applicable routing row is "Build a frontend
page or view in /apps/web" → F4 → F1 → F5 → J6 → I2 → E1. All six of those
documents (plus ADR-UI-010, a dependency of F1 §8.2) were already read in full
or in relevant part during discovery; their citations are folded into this
prompt below so you do not need to re-read them from scratch, but spot-check
anything you rely on heavily — this prompt reflects one session's reading, not
infallible ground truth.

────────────────────────────────────────────────────────────────────────────
WHAT TO BUILD

Component: `MyAssignedStepsPage`
Route: `/workflow/steps`
New file, new directory: `apps/web/src/pages/workflow/MyAssignedStepsPage.tsx`
(confirmed during discovery: `apps/web/src/pages/` currently contains only
`dev/` and `documents/` — no `workflow/` directory exists yet; create it,
following the same lowercase-plural-module-name convention as `documents/`)

This is a task-inbox page: one row per workflow step currently assigned to the
logged-in user, linking each row to the (separate, out-of-scope-for-this-task)
step action detail page at `/workflow/steps/:instanceId`.

Do NOT build `/workflow/steps/:instanceId` (`WorkflowStepActionPage`) as part
of this task. That is a separate, larger follow-on task (its panel spec — Generic
Action/Approval, VP Certification, Mayor Decision, Mayor Lapse Confirmation,
Veto Override, Multi-Referral, Secretariat Decision, Docketing, Panlalawigan
Outcome, Publication Date — is documented at
docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md,
lines 341–392, §8.2). This task only needs to link to that route correctly by
`instanceId` (see routing key section below) — it does not need that route to
exist yet to be complete and testable on its own.

────────────────────────────────────────────────────────────────────────────
THE DATA CONTRACT — verified directly against apps/server/src/modules/workflow/workflow.router.ts

Procedure: `workflow.listMyAssignedSteps` (router file, procedure starts line
422, confirmed present at that exact line as of this session)

Input (shared `paginationInput`, router file lines 35–38, confirmed verbatim):
  { cursor: z.string().nullish(), limit: z.number().int().min(1).max(100).default(50) }
  i.e. `cursor?: string | null`, `limit` optional, defaults to 50 server-side if
  omitted.

Output shape, read directly from the procedure body (router file lines 513–541,
field construction at 526–534):
  {
    items: Array<{
      stepInstanceId: string;
      instanceId: string;
      documentId: string;
      documentTitle: string;
      stepType: 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination';
      assignedAt: Date;   // aliases the DB's stepInstances.createdAt column
      dueAt: Date | null; // aliases the DB's stepInstances.slaDeadline column
    }>;
    nextCursor: string | null;
  }

Do not hand-type this. Use the router's own inferred types:
  import type { RouterOutputs } from '../../lib/trpc';
  type AssignedStepRow = RouterOutputs['workflow']['listMyAssignedSteps']['items'][number];
(This exact pattern is already used in apps/web/src/pages/documents/columns.tsx,
line 8, for the analogous Documents list — confirmed by direct reading.)

`stepType` is defensively coerced server-side to `'action'` if the underlying
DB value doesn't match the known set (router lines 514–524, confirmed) — the
frontend does not need its own fallback/validation for this field.

ROLE VISIBILITY (server-enforced, confirmed by direct reading, router lines
429–506): the procedure itself determines which rows a given user can see —
own-user assignment (line 487), own-office assignment for the 10 listed
operational roles (line 491-495 — see note below on the exact 10), unconditional
SP-office visibility for sp_secretary (line 497), and unconditional visibility
for sp_presiding_officer/mayor/auditor as "senior roles" (lines 442-443,
501-503). THE FRONTEND MUST NOT re-implement any of this filtering — every row
in the response is already one the caller is permitted to see. Do not add
client-side row-hiding logic beyond what's specified for pagination below.

PAGE-LEVEL ROLE GATE — who may load this page at all (i.e., who is permitted
to call the procedure regardless of what rows they'd see): the router's actual
allowed-role array (lines 429-440, confirmed verbatim) is:
  dept_encoder, dept_approver, sp_secretary, sp_member, sp_presiding_officer,
  mayor, brgy_encoder, brgy_captain, records_officer, auditor
That is 10 roles. NOTE: three pre-development documents (F1 §8.1 line 337, E1
line 912, I2 Section 16 line 336, and also F4 line 482) currently list only 9 of
these — all four omit `auditor`. This is a KNOWN, ALREADY-FLAGGED discrepancy
being corrected separately by the project owner in a parallel, independent fix
to those four documents (not something you need to resolve or wait for) — build
against the 10-role code list above regardless of what those documents say by
the time you read them; they may already be fixed, or the fix may still be in
flight, either way the code is ground truth here and is not in question.

PAGINATION — confirmed non-trivial, worth understanding precisely rather than
copying blindly:
- `cursor` is a numeric-string OFFSET into an in-memory-filtered array
  (router lines 508–511: `startIndex = input.cursor ? parseInt(input.cursor, 10) : 0`,
  then `.slice(startIndex, startIndex + limit)`). It is NOT a stable
  cursor/pointer into a stable ordering guaranteed by the database — new rows
  inserted between paginated requests can shift indices. This is a backend
  characteristic you cannot and should not fix from the frontend; just be aware
  the "cursor" is best-effort, not a strict guarantee, and don't build UI (e.g.
  a jump-to-page-N control) that assumes stronger guarantees than this.
- This exact same numeric-string-offset shape is used by `documents.list`
  (confirmed identical in kind by direct reading of both procedures) — meaning
  the pagination UI pattern already built for DocumentListPage.tsx works
  UNCHANGED for this page. See "pagination pattern to copy" below.

────────────────────────────────────────────────────────────────────────────
ROUTING KEY — instanceId, not stepInstanceId (settled, not open)

Each row's link/navigation to the detail page must use the row's `instanceId`
field, not `stepInstanceId`, even though both are present on every row.

This is settled by ADR-UI-010
(docs/pre-development/F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-010-workflow-step-route-key.md,
read in full, all 36 lines, Status: Accepted): the detail route
`/workflow/steps/:instanceId` is keyed on `instanceId` because
`workflow.getInstance` (the detail page's loader, out of scope for this task)
takes `{ instanceId: z.string().uuid() }` as input and returns
`currentStepInstanceId` within its payload — routing on `instanceId` lets that
future page load with one read call. `stepInstanceId` exists on this task's row
data only so the (separate, future) detail page's task can consume it later if
needed; this task can and should ignore it for its own row-linking purposes.

Practically: each row's title/link should be
  <Link to={`/workflow/steps/${row.instanceId}`}>...

────────────────────────────────────────────────────────────────────────────
STEPTYPE DISPLAY — genuinely new ground, no existing spec covers this

Searched exhaustively during discovery: J6 (the canonical Tier 3 types/
components reference, 2036 lines) contains ZERO references to `stepType`,
`step_type`, or any of the six literal values ('action', 'approval',
'multi_referral', 'decision', 'notification', 'termination') — confirmed via
direct grep, not just a ToC skim. I2's Section 6 (Workflow Execution
permissions) is action-grant-level, not display-labeling. No document anywhere
in the pre-dev corpus specifies how a raw stepType string should be
human-labeled for a user.

DO NOT reuse `WorkflowStepIndicator` (packages/ui/src/components/domain/
WorkflowStepIndicator.tsx, spec at
docs/pre-development/F-frontend-architecture/f5-ui-component-library-setup-and-package-architecture.md
lines 269–298 and J6 §3.14) for this. It was checked in full and is the wrong
shape: it renders one document's ENTIRE step sequence as a connector bar/
vertical list (props: `steps: WorkflowStep[]`, `currentStepId`), designed for a
single document's detail view (its own "used in" note: "Resolution / Ordinance
detail view") — not a single stepType label for one task-inbox row among many
different documents. There is no clean adapter between these shapes; forcing
one would be worse than building something purpose-built and small.

RECOMMENDATION (not a hard requirement — use your judgment, but this is the
reasonable default given everything checked): build a small, local label/badge
for stepType, either inline in the column's `cell` renderer or as a tiny helper
component colocated in the workflow/ page directory (NOT a new Tier 3
packages/ui component — that's a heavier process per F5 §8's component-addition
runbook, not warranted for a single small label). If you want a concrete
pattern to mirror, `StatusBadge`'s actual shape
(packages/ui/src/components/domain/StatusBadge.tsx, confirmed by direct
reading) is: a small props interface (`{ state: SomeUnion; className?: string }`),
a lookup object keyed by that union, rendered as a `<span>` with token-based
Tailwind classes, returning `null` if unmapped. You do not need STATUS_META or
DocumentState for this — stepType is a different, much smaller union — just the
general shape (typed prop → lookup table → styled span) is the useful part to
borrow.

Whatever human-readable labels you choose for the 6 stepType values (e.g.
"Action", "Approval", "Multi-Referral", "Decision", "Notification",
"Termination", or better ones you judge more appropriate) is genuinely
undecided by any document — pick something reasonable, and note the choice
plainly in your PR description and/or a development-findings-log.md entry
(status: proposed) per AGENTS.md Section 4's handling of unanswerable-by-docs
questions, so a human can confirm or adjust the wording later.

────────────────────────────────────────────────────────────────────────────
CONVENTIONS TO REUSE — all verified by direct reading this session, not assumed

tRPC client: apps/web/src/lib/trpc.ts (54 lines, read in full). Exports `trpc`
(the React-Query-bound hook object) and type helpers `RouterInputs`/
`RouterOutputs`. Has built-in silent-401-refresh in its fetch link — you do not
need to handle 401s yourself. Only one link configured (httpBatchLink) — no
subscription/websocket link exists, so if "live" updates are wanted, that would
mean React Query polling (`refetchInterval`), not a subscription; not required
for this task unless you judge it valuable, in which case flag it as an
addition rather than assuming it's expected.

Auth: apps/web/src/lib/auth-context.tsx (105 lines, read in full).
`useAuth()` returns `{ session, login, logout, refresh }`.
`session.roleCodes: string[]` is the array to check against the 10-role list
above. `session` is `AuthSession | null`. Confirmed: login uses full PKCE flow
(generatePkcePair, code_verifier/code_challenge/S256) — not directly relevant to
this task, just confirms this file's other documented facts hold up.

Query client: apps/web/src/lib/query-client.ts (16 lines, read in full).
Global retry policy already handles UNAUTHORIZED correctly (defers to trpc.ts).
No custom retry config needed in your query call.

ROLE-GATING PATTERN — apps/web/src/pages/documents/DocumentDetailPage.tsx,
lines 55–171 (read in full). Establishes a local helper:
  function hasRole(roles: string[], ...allowed: string[]): boolean {
    return allowed.some((r) => roles.includes(r));
  }
IMPORTANT DISTINCTION (this file's own line-63 comment states it explicitly:
"These are intentionally NOT the blanket 10-role page set"): DocumentDetailPage
needs many fine-grained PER-ACTION gates because it aggregates many different
procedures, each with a different callable-by list, on one screen. Your page is
the OPPOSITE, SIMPLER case: there is exactly one procedure
(listMyAssignedSteps) with exactly one callable-by list (the 10 roles above).
You need one page-level gate, not many per-action gates. Don't over-engineer
this into per-column conditional rendering.
`hasRole` currently exists as a local, un-shared helper in only that one file
(confirmed via repo-wide grep — no shared/extracted version exists yet). Your
choice: copy a small local copy into your new page (consistent with the only
precedent so far), or extract a shared version (e.g.
apps/web/src/lib/auth-helpers.ts) since a second consumer is a natural
deduplication point. Either is reasonable; the codebase doesn't yet force one
answer. State which you chose and why in your PR description.

CLOSEST LIST-PAGE ANALOG (structure + pagination) —
apps/web/src/pages/documents/DocumentListPage.tsx (164 lines, read in full) and
its columns file apps/web/src/pages/documents/columns.tsx (58 lines, read in
full). Concretely:
- Named export `export function XPage()`, not default export — confirmed
  DocumentListPage uses a named export while DocumentIntakePage/
  DocumentDetailPage use default exports (an existing inconsistency in the
  codebase, not something to silently "fix"); match DocumentListPage
  specifically since it's the closer structural analog (paginated, role-scoped
  list), i.e. use a named export: `export function MyAssignedStepsPage() {...}`
- Pagination: a `cursorHistory: string[]` state array acting as a stack of
  previously-seen forward-cursors. `currentCursor = cursorHistory[cursorHistory.length - 1] || undefined`.
  `handleNext` pushes `data.nextCursor` onto the stack when present.
  `handlePrev` pops the last entry off (goes back by re-requesting a
  previously-remembered cursor, never needs the server to support backward
  pagination at all). Confirmed this pattern needs zero adaptation for your
  procedure's cursor shape, since both are the same numeric-string-offset kind.
  No separate filters exist for your procedure (unlike Documents' filter set),
  so you do not need a `useWorkflowFilters`-equivalent hook or any
  useSearchParams-synced filter state — confirmed by direct reading of the
  procedure's input schema (cursor/limit only) and of the closest existing
  filter hook, apps/web/src/hooks/useDocumentFilters.ts (35 lines, read in
  full) which exists specifically to sync filter fields Documents has and yours
  doesn't.
- Table rendering: TanStack Table (`@tanstack/react-table`) with a separate
  `columns.tsx` file defining `ColumnDef<RowType>[]`, imported into the page.
  Follow this same split rather than inlining column markup in the page file.
- Loading state: full-page spinner shown only when `isLoading &&
  cursorHistory.length === 0` (i.e. only on true initial load, not on every
  page-nav) — `<Loader2 className="h-8 w-8 animate-spin ..." />` from
  lucide-react.
- Empty state: `EmptyState` component from `@batac/ui` (confirmed exported and
  used exactly this way), props `icon`, `heading`, `body`, `action`. Shown only
  when `!isLoading && data?.items.length === 0 && cursorHistory.length === 0`.
  Adapt copy to something like heading "No assigned steps", body along the
  lines of "You have no workflow steps currently assigned to you." — no action
  button is obviously needed here (Documents' analog links to document
  creation; there's no equivalent "create a step" action for an inbox), so
  omitting the `action` prop or using a sensible alternative (e.g. a link back
  to /documents) is your call.
- Route registration: apps/web/src/main.tsx (153 lines, read in full).
  Confirmed: NO /workflow/steps route currently exists anywhere in this file's
  route array. Add both a new import line (following the existing import
  block's style — note the file currently mixes named and default imports
  inconsistently for different pages; DocumentListPage specifically is a named
  import, match that since you're using a named export) and a new
  `{ path: "/workflow/steps", element: <MyAssignedStepsPage /> }` entry to the
  `createBrowserRouter([...])` array. No role-guarding wrapper exists at the
  router level for ANY route currently (confirmed: every existing route is a
  bare path/element pair) — role-gating is each page's own internal
  responsibility, consistent with DocumentDetailPage's pattern above; you do
  not need to build or modify any route-wrapper infrastructure, just gate
  inside your own component the same way DocumentDetailPage does.

TYPE FOR THE PROCEDURE'S ROW: confirmed the barrel
(packages/ui/src/index.ts, read in full) actually exports what you'd need if
you reach for StatusBadge-style patterns — `export * from './types/domain';`
and `export { STATUS_META } from './lib/status-meta';` are both live, not just
documented-but-unshipped. You will not need either of these directly for
stepType (a different, smaller union), but if you find yourself needing
DocumentState for any reason (e.g. showing a document's own lifecycle state
somewhere on this page, which is not required but may be a nice-to-have),
import it from '@batac/ui', don't redeclare it locally — a real, live bug
elsewhere in this codebase (apps/web/src/lib/status-mapping.ts, being fixed
separately, not your concern) exists BECAUSE a prior file redeclared its own
incomplete local copy instead of importing the canonical one. Don't repeat that
mistake.

────────────────────────────────────────────────────────────────────────────
THINGS NOTED BUT DELIBERATELY OUT OF SCOPE FOR THIS TASK — do not build these

- Any stepType-based FILTER UI. Two other, not-yet-built dashboard pages
  (SecretaryDashboardPage's "Queue" widget, MayorDashboardPage) are documented
  (F4, lines 356-364 and 397-402) as potential future consumers of this same
  procedure with a client-side or "future server parameter" filter to
  mayor-action-specific steps. That parameter does NOT exist server-side today
  (confirmed: the procedure's input schema is cursor/limit only, nothing else).
  This is not a requirement for your task — just keep your query/hook structure
  reasonably unentangled from page-specific assumptions, so it isn't
  needlessly awkward for someone to add a filter parameter later if the server
  ever grows one. Do not build filtering UI now.
- WorkflowStepActionPage / the /workflow/steps/:instanceId route itself — a
  separate, later task, discussed above.
- Any change to workflow.router.ts, the auditor-role documentation discrepancy,
  or the status-mapping.ts bug — all being handled in entirely separate,
  parallel work. Do not touch any of these files.

────────────────────────────────────────────────────────────────────────────
DELIVERABLE CHECKLIST

1. New directory apps/web/src/pages/workflow/
2. apps/web/src/pages/workflow/MyAssignedStepsPage.tsx — named export, role-
   gated (10 roles above), consumes workflow.listMyAssignedSteps via
   RouterOutputs-derived typing, pagination via the cursorHistory-stack
   pattern, loading/empty states per DocumentListPage's pattern.
3. apps/web/src/pages/workflow/columns.tsx (or your chosen filename, matching
   the existing columns.tsx convention) — column defs for documentTitle
   (linked via instanceId per ADR-UI-010), stepType (new small label, per
   guidance above), assignedAt/dueAt (date-fns formatted, matching
   DocumentListPage's `format(new Date(...), 'PP')` convention).
4. New route registered in apps/web/src/main.tsx.
5. A findings-log entry (status: proposed) for your stepType label-wording
   choice, per AGENTS.md Section 4 — check the log's current header for exact
   format and verify the true next LOG-NNNN number fresh (do not trust any
   number quoted in a different session's prompt; the log has used several
   slightly different heading styles across its history, so scan for all of
   them before concluding what the highest existing number is).
6. State explicitly in your PR description: (a) whether you extracted hasRole
   into a shared location or copied it locally, and why; (b) your chosen
   stepType label wording; (c) confirmation that you did not touch
   workflow.router.ts, any of the 4 role-list documents, or status-mapping.ts.
```

---

## TASK-WF-FE-002

```
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-FE-002: the workflow step action detail page,
Task B in the two-part workflow-frontend sequence following TASK-WF-FE-001
(MyAssignedStepsPage, already built — apps/web/src/pages/workflow/, route
/workflow/steps, registered in main.tsx). This task builds the page that
Task A's rows link to.

Read AGENTS.md before doing anything else if you have not already
internalized it this session. The applicable routing row is "Build a frontend
page or view in /apps/web" -> F4 -> F1 -> F5 -> J6 -> I2 -> E1. This task ALSO
spans "Write a tRPC procedure or router" (E1 -> I1 -> I2) because of the two
backend prerequisites below — read the union of both rows per AGENTS.md
Section 2's instruction for multi-row tasks.

Before starting, check docs/development-findings-log.md for any newly
`confirmed` entries tagged B4, workflow, F1, E1, I2, or organization since
this prompt was written — this session's read ended at LOG-0071 (status:
proposed, about TASK-WF-FE-001's stepType label wording — not directly
relevant to this task, but confirms the log's tail as of now). This prompt
also references LOG-0049, LOG-0064, and LOG-0069 as background; none of them
require action from you, they are cited only for context.

────────────────────────────────────────────────────────────────────────────
SCOPE — TWO PREREQUISITE SUB-TASKS, THEN THE PAGE ITSELF

This task has three parts, in dependency order. Do not skip ahead — the page
cannot be meaningfully built or tested without the first two.

PART 1 (backend, small): Add `organization.listCommittees`
PART 2 (backend, small): Add a `panelHint` field to `workflow.getInstance`
PART 3 (frontend, the main deliverable): `WorkflowStepActionPage`

────────────────────────────────────────────────────────────────────────────
PART 1 — organization.listCommittees

VERIFIED GAP: ADR-UI-004
(docs/pre-development/F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-004-committee-list-procedure.md,
read in full, Status: Accepted) declares this procedure should be added to
organization.router.ts. It was never actually implemented. Confirmed by direct
grep of apps/server/src/modules/organization/organization.router.ts: only
createCommittee (line 504), updateCommittee (line 525), and
assignCommitteeMembership (line 542) exist. No listCommittees anywhere in the
server source (confirmed via repo-wide grep, zero hits).

GOOD NEWS — the underlying data layer already exists, this is not a from-
scratch feature:
apps/server/src/modules/organization/organization.repository.ts already has
a fully implemented `committees.findAll(opts)` method (lines 236-242,
confirmed by direct reading) with a soft-delete-aware filter
(`isNull(committees.deletedAt)` unless `opts.includeDeleted`). This repository
is already wired into organization.router.ts's dependency injection via
`getDeps(ctx).orgRepository` (confirmed pattern used by every existing
procedure in that file, e.g. line 231, 236, 249).

WHAT TO BUILD: A new query procedure in organization.router.ts:
  listCommittees: protectedProcedure
    .input(<see open input-schema note below>)
    .query(async ({ ctx, input }) => {
      const { orgRepository } = getDeps(ctx);
      // role check here — see below
      return orgRepository.committees.findAll(/* opts derived from input */);
    })

INPUT SCHEMA — genuinely open, not specified by ADR-UI-004 or any other
source document (its own text: "none required, or optionally an
officeId/active-only filter... not specified by source, left to
implementation"). Recommendation: start with input `z.object({}).optional()`
or no input at all (matching the "none required" default), since neither of
this procedure's two known consumers (the Multi-Referral Panel picker in Part
3 below, and a future /admin/committees page, out of scope here) has a
confirmed need for filtering yet. Do not build filter UI or a filter parameter
speculatively. If you add one anyway, flag your reasoning explicitly in your
PR description, since this diverges from "none required."

CALLABLE BY (ADR-UI-004's own specification): at minimum `plat_admin` and
`sp_secretary`. The ADR flags `sp_member` as a `[Inference]` maybe-needed role
("no source row confirms this directly") — do not add sp_member unless you
find independent confirmation; if in doubt, leave it out and note the
omission in a findings-log entry rather than guessing it in silently.

OUTPUT: array of committee records. ADR-UI-004 specifies "at minimum
committeeId, name, and active status" — check the actual `committees` table
schema (packages/database/schema/organization.schema.ts or wherever it's
defined — verify path yourself, not assumed here) for the real column names
and confirm what `findAll` actually returns before hand-typing an output
schema; derive it from the repository's actual return type rather than
guessing field names.

DO NOT build /admin/committees (F1 §12.2) as part of this task — it is a
separate, unbuilt page, out of scope here. This procedure serves two future
consumers; you are only building the procedure and this task's own consumer
(Part 3's Multi-Referral Panel).

────────────────────────────────────────────────────────────────────────────
PART 2 — panelHint on workflow.getInstance

WHY THIS IS NEEDED (verified directly against source, not inferred): F1 §8.2
(docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md,
lines 341-365 — NOTE: not "341-392" as a prior working document stated; lines
367-389 are unrelated sections §8.3/§8.4/§8.5, see note at the end of this
section) specifies 10 conditionally-rendered panels, several keyed on
`step.name`. The actual `workflow.getInstance` procedure
(apps/server/src/modules/workflow/workflow.router.ts, lines 198-306, read and
verified directly, matches E1's documented output exactly at
docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md
line 889) returns only: instanceId, documentId, definitionVersionId,
currentStepType, currentStepInstanceId, currentAssigneeUserId, status,
slaDeadline, lapseStatus. There is no step.name, stepKey, or any field
carrying step identity beyond the 8-value currentStepType enum. There is also
no `context` or `metadata` field, both of which several panels' actual
applicability depends on (see per-panel notes below). The frontend cannot
determine which of the 10 panels applies using only what this procedure
returns today.

DECISION (confirmed with the project owner): rather than expose raw stepKey/
context/metadata for the frontend to pattern-match against, compute a single
`panelHint` enum server-side and add it to getInstance's output. This keeps
panel-selection business logic server-side (consistent with how stepType
coercion already happens server-side) rather than duplicating step-key
literals and context-shape assumptions in a frontend switch statement that
could drift from the backend's actual behavior over time.

REQUIRED PANEL HINT VALUES AND THEIR EXACT DETECTION LOGIC — each of the
following was derived by reading the actual mutation procedure or policy
function each panel calls, not by re-deriving from F1's prose alone. Where
F1's language differs from what the code actually checks, the code is
authoritative per AGENTS.md Section 1; F1's wording is noted for comparison
but you should implement the code-derived rule.

  'generic_action'
    - Condition: currentStepType === 'action', AND none of the more specific
      action-type panels below apply.
    - F1 says "step_type = 'action' (default)" — matches.

  'generic_approval'
    - Condition: currentStepType === 'approval', AND none of the more
      specific approval-type panels below apply.
    - F1 says "step_type = 'approval' (excluding the two named panels below)"
      — matches; "the two named panels" are secretariat_decision and
      vp_certification below.

  'secretariat_decision'
    - F1's stated condition ("assignee office is the SP Secretariat") does NOT
      match the actual backend. Verified directly:
      documents.logSecretariatDecision (apps/server/src/modules/documents/
      documents.router.ts, lines 1508-1545) checks ONLY
      `subject.roles.includes('sp_secretary')` — no office-based check
      anywhere in the handler. Implement panelHint detection to match this
      real behavior: this panel applies when currentStepType is 'action' or
      'approval' AND the step is one where sp_secretary is expected to log a
      Secretariat decision. Since there is no server-side stepKey enforcement
      distinguishing this from generic_action/generic_approval, you will need
      to decide the actual detection rule yourself based on which stepKey(s)
      in the seed workflow definition
      (packages/database/src/seeds/workflow/phase1-legislative.ts) are meant
      to trigger this panel — cross-reference against the consolidated
      reference and D3's state machine diagrams for which steps are
      "Secretariat decision" steps, since neither F1 nor the router code
      settles this precisely. Label your choice [Inference] in a
      findings-log entry; this is a genuine gap, not a case where you missed
      an existing rule.
    - Also note: LogSecretariatDecisionInputSchema (packages/shared/src/
      schemas/documents.ts, lines 531-536) accepts `stepInstanceId` but the
      handler never reads it (confirmed: no reference to input.stepInstanceId
      anywhere in the handler body). Send it anyway (matching the schema);
      do not treat its apparent non-use as license to omit it, since a future
      backend fix may start using it.

  'vp_certification'
    - Condition: matches when the underlying step's stepKey ===
      'vp_certification'. Confirmed real value: seed file line 109, and
      confirmed as the exact literal checked by workflow.certifyAsPresidingOfficer
      (workflow.router.ts line 1233: `step.stepType !== 'approval' ||
      step.stepKey !== 'vp_certification'`).
    - F1's `step.name = 'vp_certification'` — same value, different field
      name; use stepKey internally when computing this, per the real schema
      (packages/database/schema/workflow.schema.ts line 209 — the steps
      table has stepKey and label, no column literally named "name").

  'mayor_decision'
    - Condition: stepKey is 'mayor_review' OR 'mayor_signature'.
      'mayor_review' is confirmed present in seed data (line 127).
      'mayor_signature' is NOT present in seed data anywhere (confirmed via
      repo-wide grep) — it exists only as a defensive/forward-compatible
      value in code allow-lists (workflow.router.ts lines 1308, 1388;
      workflow.policy.ts line 147, MAYOR_STEP_KEYS set). Implement detection
      for both values (the code clearly intends to support both), but do not
      be surprised if only 'mayor_review' ever appears in current seeded
      data or tests.

  'mayor_lapse_confirmation'
    - F1's condition ("system-triggered 10-day lapse, pending confirmation")
      does NOT map to a stepKey at all. Verified directly:
      logMayorLapseConfirmation (workflow.router.ts lines 1456-1545) gates on
      `instance.context['mayor_action_deadline']` being present (line 1471)
      — a field inside the workflow instance's context JSONB column, which
      is NOT currently part of getInstance's output. It also checks
      `stepInstance.metadata['lapse_confirmed_at']` for idempotency (line
      1493) — also not currently exposed.
    - REQUIRED for Part 2: since panelHint needs to reflect this, the
      getInstance query must be extended to read instance.context and
      compute panelHint = 'mayor_lapse_confirmation' when
      context['mayor_action_deadline'] is set AND
      currentStep's metadata['lapse_confirmed_at'] is NOT set (i.e., lapse
      detected but not yet confirmed). Trace the full lifecycle before
      implementing: mayor_action_deadline is set by
      apps/server/src/modules/workflow/engine/context-writer.ts (lines
      40-41) when the mayor-review step begins, and read by the scheduled
      job apps/server/src/modules/workflow/jobs/evaluate-mayor-lapse-timers.ts
      (line 39) which detects the actual lapse. Read both files before
      implementing this panelHint branch, since the exact condition for
      "lapse has occurred" (as opposed to merely "a deadline exists but
      hasn't passed yet") lives in that job's logic, not just in the
      presence of the context key. Do NOT naively treat "mayor_action_deadline
      is set" as equivalent to "lapse occurred" — a step with a future
      deadline that hasn't lapsed yet should not show this panel; it should
      show mayor_decision instead (the mayor still has time to act). Get the
      exact distinguishing condition from the scheduler job's own logic.

  'veto_override_recording'
    - No server-side stepKey enforcement exists (confirmed:
      recordVetoOverrideVote, workflow.router.ts lines 1547-1629, gates only
      on `workflowPolicy.canLogSpSecretaryAction(ctx.auth)` — a role check,
      no stepKey comparison anywhere in the handler). The real backing
      stepKey per seed data is 'veto_override_vote' (line 136). Implement
      panelHint detection against this stepKey even though the backend
      itself doesn't enforce it — this makes correct frontend panel
      selection a real safety property: an incorrectly-routed frontend could
      let an SP Secretary record an override vote against the wrong step
      with no server-side guard rail preventing it. Flag this asymmetry
      explicitly in your PR description so reviewers understand the stakes.

  'multi_referral'
    - Condition: currentStepType === 'multi_referral'. Already fully
      supported by the existing currentStepType field — no new detection
      logic needed for this one, unlike the others above.

  'docketing'
    - Condition: stepKey === 'docketing'. CONFIRMED (not merely inferred):
      seed file line 145, `step_key: "docketing"` — this resolves F1 §8.2's
      own [Inference] flag on this value (F1 line 359 called this
      unconfirmed; it is now confirmed against seed data and should be
      corrected in F1, see the documentation-correction prompt below).
      Like veto_override_recording, no server-side stepKey enforcement
      exists in logDocketingCompletion (workflow.router.ts lines 1631-1689)
      — same "frontend routing is the only guard rail" caveat applies here.

  'panlalawigan_outcome'
    - Condition: stepKey === 'panlalawigan_review'. CONFIRMED via
      workflow.policy.ts's canLogPanlalawiganAction (lines 613-635), which
      DOES enforce this server-side (line 621: `attrs.stepKey !==
      'panlalawigan_review'` throws FORBIDDEN) — unlike docketing/veto-
      override, this one has real server-side enforcement backing the
      frontend's own gate. Also gates on stepStatus being 'pending' or
      'active' (line 628) — consider whether panelHint computation should
      also reflect step status, or whether that's left to the panel itself
      to check via a separate mechanism; make an explicit choice and note it.
    - Sub-panels within this hint: resolveValidInPart is used when outcome
      is VALID_IN_PART (read its input/output schema directly,
      workflow.router.ts around line 1783, before building this sub-panel);
      confirmPanlalawiganDeemedApproved is used after the 30-day window
      (check whether lapseStatus === 'panlalawigan_30_day_deemed' from
      getInstance's existing output is the right signal for exposing this
      action — that field already exists, cross-reference against the 30-day
      job logic the same way you did for the mayor lapse).

  'publication_date'
    - F1's condition ("penalty ordinance pending newspaper publication") maps
      to stepKey === 'newspaper_publication' per seed data (line 389:
      `step_key: "newspaper_publication"`) and is confirmed as the literal
      workflow.recordNewspaperPublicationDate checks against (line 2078:
      `eq(steps.stepKey, 'newspaper_publication')` — note this one uses a DB
      query condition rather than an in-handler string comparison; read the
      full procedure, lines 2018+, to confirm exactly how it's enforced
      before assuming the pattern matches the others).

  null / no panel
    - When none of the above apply (e.g., parallel_split/parallel_join —
      confirmed Phase 2, F1 §2.4, currentStepType can technically return
      these two values per E1's 8-value enum even though
      workflow.listMyAssignedSteps's separate 6-value stepType enum never
      does), OR when the instance status is not 'Active' (e.g. Completed/
      Cancelled), panelHint should be null and the page should render a
      read-only summary instead of any action panel. This is also the state
      a plat_admin will see for most instances: verified directly that
      plat_admin IS included in getInstance's own read-permission check
      (checkWorkflowInstanceReadPermission, workflow.router.ts line 61) but
      is NOT part of the panel-acting role set for any panel above — meaning
      a plat_admin can legitimately load this page for any instance and see
      it, with no applicable action panel, purely as a read-only view. Build
      this as a real, expected state, not an error case.

CORRECTION TO A PRIOR CLAIM: a prior working document described F1 §8.2 as
spanning "lines 341-392." The actual boundary of §8.2 (the panel table plus
its two follow-up sentences and "Children: None") is lines 341-365. Lines
367-389 are §8.3 (complaints — unrelated staff-side feature, not in scope
here) and §8.4 (document-requests — same) and §8.5 (committee picker — this
one IS relevant, see Part 1 above, but is properly its own subsection, not
part of §8.2's body). Read lines 341-365 for the panel table itself, and
separately read lines 387-389 (§8.5) for the ADR-UI-004 cross-reference.

────────────────────────────────────────────────────────────────────────────
PART 3 — WorkflowStepActionPage

Component: `WorkflowStepActionPage`
Route: `/workflow/steps/:instanceId`
New file: apps/web/src/pages/workflow/WorkflowStepActionPage.tsx (same
directory as Task A's MyAssignedStepsPage.tsx and columns.tsx)

ROUTING KEY: `:instanceId`, confirmed settled by ADR-UI-010
(docs/pre-development/F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-010-workflow-step-route-key.md,
read in full). Already independently confirmed by a live consumer: Task A's
columns.tsx links via `row.original.instanceId` (line 73), and
DocumentDetailPage.tsx (line 505) already has a
`<Link to={`/workflow/steps/${workflowInstance.instanceId}`}>` pointing at
this exact route (currently a dead link until this task registers the route
— confirm it resolves correctly once you're done, as a natural end-to-end
check).

DATA LOADING: `workflow.getInstance({ instanceId })`, per Part 2's extended
output shape. Use RouterOutputs-derived typing
(`RouterOutputs['workflow']['getInstance']`), matching the pattern already
used in Task A's columns.tsx (RouterOutputs['workflow']['listMyAssignedSteps']
— apps/web/src/lib/trpc.ts exports these type helpers, 54 lines, already read
in a prior session).

CONDITIONAL PANEL RENDERING: switch/lookup on the loaded instance's
`panelHint` field (from Part 2). Ten possible panels, described in F1 §8.2's
table (lines 341-365) with the corrections and enforcement-asymmetry notes
under Part 2 above. Build each panel as a separate, small component
colocated under the workflow/ page directory (e.g.
apps/web/src/pages/workflow/panels/GenericActionPanel.tsx, etc.) rather than
one large inline switch — ten panels is enough to warrant a components/
subdirectory, unlike Task A's single small StepTypeBadge helper.

ROLE GATING: per-panel, not page-level — this is the OPPOSITE case from Task
A. Task A had one procedure with one callable-by list, needing exactly one
page-level gate. This page aggregates many different procedures, each with
its own callable-by list (see the panel table above and each procedure's
Callable-by/role-check as verified). Follow DocumentDetailPage.tsx's pattern
(lines 55-171, already read in a prior session) — many fine-grained per-panel
gates, not one blanket check. The existing local hasRole(roles, ...allowed)
helper is copied locally in both DocumentDetailPage.tsx and Task A's
MyAssignedStepsPage.tsx (two consumers now) — a third consumer here makes
extraction to a shared apps/web/src/lib/auth-helpers.ts a much stronger case
than it was for Task A. Recommend extracting it this time; state your
decision either way and why in your PR description, per the same convention
Task A followed.

READ-ONLY / NO-PANEL STATE: when panelHint is null (see Part 2's "null / no
panel" case) or the instance's status is not 'Active', render a read-only
summary (document title/link via documentId, current step type, status,
assignee if present) instead of any action panel. This is a normal, expected
state — not an error — and needs its own explicit UI treatment, not just a
fallback blank area.

MULTI-REFERRAL PANEL SPECIFICS: needs organization.listCommittees (Part 1)
for the committee picker, plus workflow.submitCommitteeReport,
workflow.manuallyAdvanceMultiReferralStep (SP Secretary only), and
session.enterCommitteeHearingDate (SP Secretary only — confirmed real,
apps/server/src/modules/workflow/session.router.ts; note this lives under
modules/workflow/, not a top-level modules/session/ directory, in case you go
looking for it). Read all four procedures' actual input/output schemas
directly before building the panel's form — do not assume shapes from F1's
prose alone, following the same discipline applied throughout this prompt.

SECRETARIAT DECISION PANEL SPECIFICS: takes documentId (available from
getInstance's existing output) AND stepInstanceId AND decision
('approve'|'reject'|'amended') AND optional remarks (max 2048 chars, per
LogSecretariatDecisionInputSchema, packages/shared/src/schemas/documents.ts
lines 531-536). Send stepInstanceId even though the current handler doesn't
use it (see Part 2's note on this).

VETO OVERRIDE PANEL SPECIFICS: recordVetoOverrideVote takes stepInstanceId,
votesFor (0-12), votesAgainst (0-12), absentCouncilorIds (array of uuid). The
8-of-12 threshold (2/3 of 12 members) is entirely server-computed — the
frontend does not need to replicate this logic, just collect and submit the
three vote-count fields.

PANLALAWIGAN OUTCOME PANEL SPECIFICS: recordPanlalawiganOutcome's outcome
enum is ['VALID', 'VALID_IN_PART', 'RETURNED', 'OPERATIVE_IN_ITS_ENTIRETY']
(confirmed, workflow.router.ts lines 1695-1700) — four values, not fewer;
build the form to support all four. Optional fields: controlNumber,
panlalawiganResolutionNumber, dateReferred, remarks.

TYPE FOR EACH GENERIC PANEL'S MUTATION: completeActionStep/approveStep both
take { stepInstanceId, comment? } (comment optional); rejectStep/
returnStepForRevision both take { stepInstanceId, comment } with comment
mandatory (z.string().min(1) — empty string rejected). Build the comment
field as required-with-validation for the latter two, optional for the
former two. Note completeActionStep's output includes a `nextStepType` field
that is always hardcoded null server-side (workflow.router.ts line 728,
confirmed, never varies) — do not build any frontend logic that depends on
this field carrying information; it does not.

ROUTE REGISTRATION: apps/web/src/main.tsx. Register
{ path: "/workflow/steps/:instanceId", element: <WorkflowStepActionPage /> }
AFTER the existing "/workflow/steps" static-path entry (same reasoning
DocumentDetailPage's route ordering comment already documents for
/documents/new vs /documents/:documentId — static segments before dynamic
ones, even though React Router v6 ranks them correctly by default, for
explicit unambiguous ordering). Match the existing named-vs-default import
convention: Task A's MyAssignedStepsPage is imported as a named import
(confirmed, main.tsx line 14) since it's a named export; decide your own
export style for WorkflowStepActionPage and match your import statement to
it consistently.

────────────────────────────────────────────────────────────────────────────
DEPENDENCIES AND PREREQUISITES (in order)

1. Part 1 (organization.listCommittees) must exist before the Multi-Referral
   Panel can be built or tested.
2. Part 2 (panelHint on getInstance) must exist before ANY of the panel-
   selection logic in Part 3 can be built or tested — without it, the page
   has no way to determine which of the 10 panels to show for a given
   instance, for 8 of the 10 panels (generic_action and multi_referral are
   the only two panelHint values fully derivable from the currentStepType
   field that already exists today).
3. Task A (MyAssignedStepsPage, already built) provides the /workflow/steps
   route and the row-links this page's route depends on for realistic
   end-to-end navigation testing, though this page's route can be built and
   directly navigated to for testing independent of Task A's inbox.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- /admin/committees (F1 §12.2) — a separate, unbuilt page; Part 1 only adds
  the procedure two future consumers need, not the admin page itself.
- Any change to the underlying workflow engine, step-transition logic, or
  JSONLogic evaluation — all separate, out of scope.
- Any fix to the auditor-role documentation discrepancy (already resolved,
  LOG-0069, confirmed — no action needed) or the status-mapping.ts issue
  (already resolved, LOG-0070 — no action needed). Both mentioned here only
  so you don't waste time re-investigating settled matters.
- session.router.ts, documents.router.ts's other procedures, or any backend
  file beyond the two narrowly-scoped additions in Parts 1 and 2 — do not
  touch workflow engine internals, the scheduled lapse-timer job, or
  anything not explicitly named as in-scope above.

────────────────────────────────────────────────────────────────────────────
EDGE CASES AND RISKS TO VALIDATE

- Instance status !== 'Active' (Completed/Cancelled) — read-only state, no
  panel, verified this is a real distinct case (getInstance's own status
  field, three-value enum).
- currentStepType is 'parallel_split' or 'parallel_join' — Phase 2, confirmed
  no panel exists for these; panelHint should be null, page should degrade to
  read-only rather than erroring.
- A role with page-read access but no panel-act access (plat_admin is the
  confirmed real example) — must render read-only gracefully, not error or
  show a blank/broken panel.
- mayor_action_deadline present but not yet lapsed (deadline is in the
  future) — must NOT show mayor_lapse_confirmation; must show mayor_decision
  instead. Get the precise lapsed-vs-not-yet-lapsed condition from
  evaluate-mayor-lapse-timers.ts's actual logic, not assumed from context-key
  presence alone.
- mayor_signature stepKey — code-supported but not present in current seed
  data; do not let its absence from test fixtures cause you to skip building
  support for it.
- logSecretariatDecision's ignored stepInstanceId input — send it per schema
  regardless of current non-use.
- Docketing and Veto Override panels have zero server-side stepKey
  enforcement — frontend panel-routing correctness is a real safety property
  for these two, not just a UX nicety; test these paths particularly
  carefully.

────────────────────────────────────────────────────────────────────────────
VALIDATION / TESTING REQUIREMENTS

- Confirm the /workflow/steps/:instanceId route resolves and that the
  existing dead link in DocumentDetailPage.tsx (line 505) now correctly
  navigates end-to-end from a document's workflow link-out.
- Confirm Task A's MyAssignedStepsPage row links (columns.tsx line 73) also
  resolve correctly now that the target route exists.
- Test each of the 10 panelHint values renders its correct panel, including
  the null case rendering the read-only summary.
- Test role-gating denies access appropriately per-panel (not just per-page)
  for at least one negative case per panel category (e.g., a records_officer
  should not see the Mayor Decision panel's action controls even if they can
  load the page).
- Per AGENTS.md Section 4, any question this prompt has left genuinely open
  (the secretariat_decision stepKey-detection rule, most notably) must be
  implemented as a conservative default, logged as a findings-log entry with
  [Inference] or [Speculation] labeling as appropriate, and NOT presented as
  settled.

────────────────────────────────────────────────────────────────────────────
ACCEPTANCE CRITERIA

1. organization.listCommittees exists, uses the existing
   orgRepository.committees.findAll, is role-gated per ADR-UI-004's minimum
   (plat_admin, sp_secretary), and does not speculatively add filter
   parameters beyond what's justified.
2. workflow.getInstance's output includes a panelHint field computed
   server-side per the exact per-panel rules above, with the
   mayor_lapse_confirmation and secretariat_decision branches specifically
   validated against the cited source files (context-writer.ts,
   evaluate-mayor-lapse-timers.ts) rather than assumed.
3. WorkflowStepActionPage exists at the specified route, renders all 10
   panels conditionally on panelHint, handles the null/read-only case, and
   applies per-panel (not page-level) role gating.
4. PR description states: (a) the secretariat_decision stepKey-detection
   rule you chose and why, with a corresponding findings-log entry; (b)
   whether you extracted hasRole to a shared location and why; (c) your
   organization.listCommittees input-schema choice; (d) confirmation you did
   not touch any file outside the explicit scope of Parts 1-3.
5. A findings-log entry documenting the panelHint addition itself (status:
   proposed), since this is a schema change to an existing procedure's
   output that no pre-development document specifies in this exact shape.
```

## TASK-WF-FE-003

````
# Implementation Prompt for Coding Agent — TASK-WF-FE-003 (Part A)



## Objective



Fix the `secretariat_decision` step-completion path in the Batac DMS workflow module. This has two coupled defects, both must be fixed together:



1. **Wrong mutation / dead code path**: `documents.logSecretariatDecision` is pre-ADR-API-003 code. It is structurally a no-op for every real `secretariat_decision` step in production, yet the frontend unconditionally shows a success toast. Replace it with a Workflow-Router-driven mutation per ADR-API-003.

2. **Wrong gating condition**: `computePanelHint`'s `secretariat_decision` detection uses a role-based proxy that over-fires. Replace it with the already-written, currently-unwired, office-scoped `canLogSecretariatDecision` policy check.



This is a same-tier-document-authorized fix: ADR-API-003 was decided directly by Luke (the project owner), and Luke has now explicitly requested this task, which is being treated as the human greenlight this architecture change needed per `AGENTS.md` §4.5's three-tier hierarchy. You do not need to seek further authorization to implement the routing/gating change itself. You do need to follow the constraints in the "Explicitly Out of Scope" section below regarding *documentation* edits.



---



## Current Behavior (To Be Replaced) — Confirmed Defect



**File:** `apps/server/src/modules/documents/documents.router.ts`, lines 1508–1545 (function `logSecretariatDecision`).

**Input schema:** `LogSecretariatDecisionInputSchema`, `packages/shared/src/schemas/documents.ts` lines 531–536 — confirmed exact shape:

```ts

{ documentId: UuidSchema, stepInstanceId: UuidSchema, decision: z.enum(["approve","reject","amended"]), remarks: z.string().max(2048).optional() }

```

`stepInstanceId` is accepted in the schema but **never read** in the handler body — confirmed by direct reading, independently cross-checked across three separate exploration passes.



Per-branch behavior of the current handler:

- **`approve`**: only transitions state when `lifecycleState === 'submitted'` (line ~1525–1528). This is **structurally unreachable** for all 12 real `secretariat_decision`-tagged steps, because those steps exist only *after* a document has already left the `'submitted'` lifecycle state (confirmed against D3's state machine: the `Submitted → In-Workflow` transition is the intake action itself, conceptually prior to and different in kind from a Secretariat decision *inside* an already-running workflow).

- **`reject`**: gates on `lifecycleState === 'submitted' OR 'in_workflow'`.

- **`amended`**: **no gate at all** — pure log-only no-op, doesn't call `transitionState`.

- **No `workflow.step.completed` emission anywhere in the function.** No `stepInstanceId`-driven step advancement anywhere in the function.



**Confirmed consequence:** `SecretariatDecisionPanel.tsx` line 19 fires `toast.success('Decision logged successfully.')` unconditionally in `onSuccess`. Since the mutation does nothing meaningful for `amended` (always) or `approve` (whenever lifecycle state isn't `'submitted'`, i.e. almost always for these steps), users see "success" while the workflow step silently never advances. Treat this as a confirmed production bug, not a hypothesis to re-verify.



---



## Target Architecture (ADR-API-003 / "ADR-B2-3")



**File:** `docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-003-secretariat-decision-entry-point.md`. Status: Accepted, decided by Luke.



- An `approval`-type step "accepts exactly this action shape" (ADR line 30).

- Outcome routing rule (ADR line 31): **Approve/Amended-accepted → next step; Reject → rejection path.**

- Design: the Secretariat submits the decision directly to the **Workflow Router**, which synchronously drives the document state transition as part of one atomic operation, then emits `workflow.step.completed` (dotted, confirmed to match shipped code — an earlier documentation inconsistency using `workflow.step_completed` with underscore has already been corrected repo-wide).

- Corroborating ABAC rule (I1 §6.8), matches the shipped `canLogSecretariatDecision` guard exactly (see below):

  ```

  step_instance:log_secretariat_decision (action codes: 'approve','reject','amended')

  ALLOW IF: subject.roles CONTAINS 'sp_secretary'

    AND step.step_type IN ('action','approval')

    AND step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID

  ```



**Reference document B2 (v1.1)** is fully and consistently updated to reflect this ADR (changelog, module 3, module 4, events-consumed table, events-emitted table, master registry — all marked `[RESOLVED — ADR-B2-3]`). Treat B2 v1.1 as reliable background reading if useful; do not read the `.bak` version.



---



## Required Changes — Part 1: New Mutation Path



### 1a. The policy guard is ready to wire in as-is



**File:** `apps/server/src/modules/workflow/workflow.policy.ts`, lines 582–600 (method `canLogSecretariatDecision`, on the class instance accessed elsewhere as `workflowPolicy`). Verified directly, exact contents:



```ts

canLogSecretariatDecision(

  subject: SubjectContext,

  attrs: { isSpSecretariatOffice: boolean }

): void {

  if (!subject.roles.includes('sp_secretary')) {

    throw new TRPCError({ code: 'FORBIDDEN', cause: 'secretariat_decision_requires_sp_secretary', ... });

  }

  if (!attrs.isSpSecretariatOffice) {

    throw new TRPCError({ code: 'FORBIDDEN', cause: 'secretariat_decision_wrong_office', ... });

  }

}

```



Properties to respect when wiring this in:

- **`void`-returning, throw-on-deny.** Call it directly for its throwing side effect inside the mutation handler — do not wrap it in `if (!canLogSecretariatDecision(...))`.

- It does **not** resolve the office ID itself — the caller must pre-compute `isSpSecretariatOffice: boolean` and pass it in.

- Its own docstring states it does **NOT** map to `recordVetoOverrideVote` (that uses the simpler `canLogSpSecretaryAction`) and was written anticipating exactly this future use ("Retained in case a future procedure needs step-and-office-scoped secretariat decision logging"). Treat its signature as settled/authoritative — do not redesign it.

- Currently has **zero call sites** anywhere in the codebase (confirmed via direct search) — wiring in this call site is the entire job for this function.



### 1b. How to resolve `isSpSecretariatOffice` on the mutation side



Use **`fetchStepContext(stepInstanceId, ctx)`** — the same entry pattern already used by the two working sibling mutations, `completeActionStep` and `approveStep`, in `apps/server/src/modules/workflow/workflow.router.ts` (call sites around lines 734/739). It returns `{ stepInstance, step, instance, stepAttrs }` in one call.



- **`stepAttrs.assigneeOfficeId` is already extracted and present** inside `fetchStepContext` (confirmed at lines 151–153 and 169–170 of that function) — pulled directly from `stepInstances.assignedTo`'s JSONB `office_id` field. No new query or join is needed for this side.

- Resolve the SP Secretariat office's own ID once via `getOrgService(ctx).getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, subject.cityId)` — office code `'SPS'`. There is a precedent for this exact call in `documents.router.ts` around lines 1490–1491 (variable `isSp`), **but note that precedent checks the acting subject's own office membership, not the step's assignee office** — it's a useful template for *how to call `getOfficeByCode`*, not a template for the actual comparison. The correct comparison for this task is:

  ```

  isSpSecretariatOffice = (stepAttrs.assigneeOfficeId === <resolved SPS office's own ID>)

  ```

- `SP_SECRETARIAT_OFFICE_CODE` (`'SPS'`) is currently **locally redeclared per-file** (confirmed in `tracking.router.ts` line 82 and `documents.router.ts` line 117), not imported from a shared constants module. `workflow.router.ts` currently has none of this machinery — no local constant, no `getOfficeByCode` call, no `getOrgService` import. This must be introduced fresh into that file, following the existing local-redeclaration convention (introducing a shared constant instead is an optional improvement, not a requirement — use judgment, it is not scoped as required by this task).

- The accessor pattern for org-service access elsewhere in the codebase is a small local `getXService(ctx)` factory reading `ctx.req.server.<serviceName>`, repeated per-file rather than shared — follow this same convention in `workflow.router.ts` since it doesn't currently have one.



### 1c. Outcome handling — a real design decision, not a drop-in reuse



**Do not assume `submitStepAction` (`action.handler.ts`) is reusable as-is.** It hardcodes the literal outcome `'DONE'` in three separate internal sites (confirmed exactly):

1. Line 50 — `updateStepInstance(..., { outcome: 'DONE' })`

2. Line 68 — inside the payload passed to `deps.workflowRepository.createWorkflowEvent(...)` (DB-persisted, inside the transaction)

3. Line 79 — `resolveNextStep(instance, updatedStepInstance, 'DONE', deps, trx)`



It has **no `outcome` parameter on its signature at all.** It is a single-outcome "step is done" primitive suited to `generic_action`'s semantics, and is **not** the shared primitive used by both working callers — `completeActionStep` calls `submitStepAction`, but `approveStep` calls a **separate sibling function**, `submitStepApproval` (`approval.handler.ts`, starting line 15). An earlier draft of this analysis incorrectly described `submitStepAction` as shared between both; that claim is superseded by direct re-verification.



**`submitStepApproval` is already outcome-aware and is the better model to mirror:**

- Takes `outcome: string` as an explicit parameter (line 15).

- Validates it against `config['allowed_outcomes']` (lines 37–40) — a **per-step configurable allow-list**, not a hardcoded enum.

- Threads the real outcome through all three equivalent internal sites: `updateStepInstance` (line 111), `createWorkflowEvent`'s payload (line 127), `resolveNextStep` (line 137).

- `approveStep`'s own router-level event payload already correctly sets `outcome: 'APPROVED'` (line 859) — i.e. `approveStep` is already fully outcome-aware end-to-end, unlike `completeActionStep`.



**Design decision for you to make and document (not pre-decided by exploration):** should the new `secretariat_decision` mutation:

- **(a)** route through `submitStepApproval` directly, since it already validates arbitrary string outcomes against per-step `allowed_outcomes`, or

- **(b)** build a new sibling function modeled on `submitStepApproval`'s pattern?



This depends partly on whether `secretariat_decision` steps are conceptually `approval`-type or `action`-type — `computePanelHint`'s branch currently checks `currentStepType === 'action' || currentStepType === 'approval'`, meaning they can currently be either, while `submitStepApproval`'s name and its relationship to `approveStep` suggest it's intended specifically for `approval`-type steps. Make this call explicitly and record the reasoning (e.g. in a code comment and/or commit message) rather than leaving it implicit.



**Do not modify `submitStepAction`'s existing hardcoded behavior** as a byproduct of this work — it has two existing callers (`completeActionStep` is one) whose current behavior must not regress. If you determine `submitStepAction` itself needs an `outcome` parameter as part of your chosen design, that is a shared-primitive change with real blast radius; treat it as a deliberate, explicitly-flagged decision, not an incidental side effect.



**Event-emission split — both layers need the real outcome, not just one:** There are two separate event-recording mechanisms per mutation call, and both currently hardcode `'DONE'` in the `completeActionStep` path you're modeling against:

1. `workflowRepository.createWorkflowEvent` — DB-persisted, written inside the transaction, inside the handler function (`submitStepAction` or `submitStepApproval`).

2. `server.eventBus.emit('workflow.step.completed', { ..., payload: { ..., outcome: ... } })` — in-process, emitted separately at the **router/caller level**, *after* the transaction commits (confirmed for `completeActionStep` at `workflow.router.ts` line 780, hardcoding `outcome: 'DONE'` there too, distinct from and in addition to the internal `createWorkflowEvent` call).



**Fixing only the internal handler-level outcome is not sufficient.** The new `secretariat_decision` mutation's own router-level `eventBus.emit(...)` call must also independently pass the real outcome (`'APPROVED'`/`'REJECTED'`/whatever `'amended'` maps to — see gap below) into its payload construction, mirroring how `approveStep` already does this correctly at line 859. Follow `approveStep`'s pattern here, not `completeActionStep`'s.



`completeActionStep`'s return includes `nextStepType: null` (line 786) — part of the response contract shape a new mutation may need to mirror; it is not yet confirmed whether the frontend actually consumes this field, so mirror it for contract consistency but don't assume it's load-bearing.



### 1d. CONFIRMED GAP requiring a human/product decision before this is fully correct — flag prominently, do not silently resolve



The literal value `"AMENDED"` **does not appear anywhere in the seed workflow file** (`packages/database/src/seeds/workflow/phase1-legislative.ts`) — not in any step's `allowed_outcomes`, confirmed directly, not inferred from a sample. Several of the 12 relevant steps (assigned to `ROLE.SP_SECRETARY`/`ROLE.SECRETARIAT_STAFF`) have `allowed_outcomes` set to exactly `["APPROVED","REJECTED"]` or `["APPROVED","RETURNED_FOR_REVISION","REJECTED"]` (e.g. seed lines 79, 97, 368, 433), paired with `require_comment_on: ["REJECTED"]`.



Under the *current* handler this gap is silently absorbed (`'amended'` is a no-op today, so nothing breaks). **If the new mutation routes through outcome validation** (`allowedOutcomes.includes(outcome)`, mirroring `approval.handler.ts` line 38), a submission mapping `'amended' → 'AMENDED'` will **fail validation outright** for every one of these 12 steps, since `'AMENDED'` is in no seed step's allow-list.



This is a product/data-modeling decision, **not yours to make unilaterally**. Two options exist:

1. Map the frontend's `'amended'` decision value to an already-existing outcome string — `RETURNED_FOR_REVISION` (appears in seed data, e.g. line 79) is the most plausible existing candidate.

2. Add a genuinely new `AMENDED` outcome value to the relevant steps' seed-data `allowed_outcomes` arrays.



**Do not pick one silently and proceed as though it were obvious.** Surface this explicitly — in your PR description, a prominent code comment, and/or by pausing to ask before finalizing this specific piece — before shipping. Shipping a plausible-looking guess here reproduces exactly the "looks done, silently broken" failure class this whole task exists to fix.



---



## Required Changes — Part 2: `computePanelHint` Gating Fix



**Location:** `apps/server/src/modules/workflow/workflow.router.ts`. Signature: `computePanelHint(status: string, currentStepType: string, currentStep: any, instance: any): string | null` — synchronous, pure, no `ctx`, no async, no DB access, currently.



**Current `secretariat_decision` branch (to be replaced):**

```

(currentStepType === 'action' || currentStepType === 'approval')

  && (stepConfigAssignee === 'role:sp_secretary' || stepConfigAssignee === 'role:secretariat_staff')

```



### 2a. Two call sites — both must be patched identically



1. **`getInstance` procedure** — `currentSteps` select at lines 284–291 selects exactly: `stepInstanceId, stepType, assignedTo, stepKey, metadata, config`. Return object has 10 fields including `panelHint`.

2. **`getActiveInstanceForDocument` procedure** — call site at line 464, procedure body from line 361. **Near-identical sibling with an identical `currentSteps` select shape and identical `computePanelHint` call, but the query is duplicated per-procedure, not shared.** Confirmed live consumer: `DocumentDetailPage.tsx` calls this procedure directly (not dead code).



**Critical implementation risk, explicitly confirmed:** because the `currentStep`-gathering query is duplicated (not shared) between these two procedures, patching only one and leaving the other unpatched will cause `computePanelHint` to receive an incomplete `currentStep` object from whichever procedure you missed — producing an inconsistent `secretariat_decision` hint depending on which page/procedure a user happens to hit (e.g. `DocumentDetailPage` showing a stale/wrong hint while `WorkflowStepActionPage`, which uses `getInstance`, shows the correct one, or vice versa). **Both procedures' queries must be updated identically, in the same commit.**



### 2b. No new column or join is needed — the data is already there



`assignee_office_id` is **not currently selected** in either query — this is the office-scoping column the new gate conceptually needs. But: **`assignedTo` (the raw JSONB) is already selected in both queries' `currentSteps` select.** This is the same field `fetchStepContext` already extracts `office_id` from, using shape `Array<{ user_id?: string; office_id?: string }>`. **Neither query needs a new column or join added** — the office ID is already present in the data reaching `computePanelHint`; it just isn't being extracted from the JSONB or compared yet.



This splits into two genuinely separate needs, worth keeping distinct in your implementation:

- **Mutation side** (Part 1 above): office data already available via `fetchStepContext` → `stepAttrs.assigneeOfficeId`. No new query machinery needed.

- **Display side** (`computePanelHint`, this section): the raw JSONB is already selected; the only genuinely new machinery needed is (a) extracting `office_id` from `currentStep.assignedTo[0]` the same way `fetchStepContext` does, and (b) resolving/knowing the SP Secretariat's office ID to compare against.



### 2c. Architectural tension requiring an explicit design choice — do not decide silently



`computePanelHint` is currently synchronous and pure. Extracting `office_id` from JSONB is pure/sync and fine on its own. **But resolving the SP Secretariat office's own *ID* requires an async DB call** (`getOrgService(ctx).getOfficeByCode(...)`). This means one of:

- **(a)** `computePanelHint` becomes `async`, and both call sites (`getInstance`, `getActiveInstanceForDocument`) `await` it, or

- **(b)** the SP Secretariat office ID is resolved once by each caller procedure and passed in as an additional parameter to `computePanelHint`, changing its signature without making it async.



This changes a shared pure function's signature and both its callers. **Make this choice explicitly and document the reasoning** (code comment and/or PR description) — it is a legitimate design decision within your scope to make (unlike the `AMENDED` mapping, which is not), but it should be made deliberately, not as an incidental side effect of "just making it compile."



**Non-blocking performance note:** `getOfficeByCode` has no caching — confirmed plain DB query on every call. Not a blocker; existing `archive`/`publishPortal` mutations already pay this same per-request cost. `getInstance` is presumably a page-load-driving query called more frequently than an occasional action mutation, so it's worth being aware of, but do not over-engineer caching into this task as a hard requirement — it's a judgment call, not a stated acceptance criterion.



### 2d. Expected post-fix behavior (not a regression to prevent)



The corrected, office-scoped gate will likely **still match a broad set of steps** — potentially most or all of the same 12 originally matched by the role-based proxy. That breadth is expected and correct once office-scoping is genuinely applied (all 12 happen to be assigned to the SP Secretariat office in the current seed data) — it is not a symptom indicating the fix is wrong. Do not treat "still matches many steps" as evidence you've done something incorrectly.



---



## Frontend Change



**File:** `SecretariatDecisionPanel.tsx`.

- Already sends `stepInstanceId: instance.currentStepInstanceId` (line 33) and `documentId: instance.documentId` (line 32) at the call site — both already available in scope. The request shape likely needs **minimal** change once the new mutation exists; primarily point it at the new mutation procedure name/router instead of `documents.logSecretariatDecision`.

- Line 19's unconditional `toast.success('Decision logged successfully.')` in `onSuccess` should be re-examined once the real mutation can genuinely fail (e.g. on outcome-validation rejection for the `AMENDED` gap above, or on the office-scope guard throwing) — ensure error states now actually surface as errors rather than being masked by an unconditional success toast, given that was the core symptom of the original bug.

- **Stale comment cleanup**: the comment block at lines 7–11 documents the *old* rationale (`config.assignee` as "the only stable proxy available without an extra office-lookup join," referencing LOG-0077). Once this fix lands, that comment becomes actively misleading — it will describe the old proxy approach as if it were deliberate final design. Update or remove it as part of this change. (Same category of loose-end cleanup as the stale `hasRole` comment previously found and fixed in `MyAssignedStepsPage.tsx` — small, but don't skip it, since a misleading comment here is exactly the kind of thing that causes the *next* agent to reintroduce this bug's reasoning by accident.)



---



## Explicitly Out of Scope



- **Test coverage** for this new path. This is a deliberately separate, later task (candidate: TASK-WF-FE-004), sequenced specifically so tests aren't written against a mutation path about to be replaced. Do not write tests as part of this task; do not leave the codebase in a state where existing tests reference the old `documents.logSecretariatDecision` path in a way that would now be misleading (if any exist — current confirmed state is zero test files for the workflow module specifically; one unrelated Vitest file, `status-mapping.test.ts`, exists elsewhere in `apps/web` and is unrelated to this change).

- **Any edit to Group B–L pre-development governance documents** (F1, E1, ADR-API-003 itself, B2, findings-log entries, etc.) as part of this implementation. Per `AGENTS.md` §4.5, agents may only *append* new findings-log entries (which will default to `status: proposed`) — never directly edit F1/E1/B2/ADRs. Specifically out of scope for *this* task:

  - Reconciling F1 §8.2's stale wording (still says "the assignee office is the SP Secretariat" in a way that doesn't reflect the actual pre-fix role-only check, and still doesn't reference `panelHint` at all in either F1 or E1).

  - Correcting LOG-0079's framing issue (a prior findings-log entry that, despite the correct `status: proposed` tag, asserts ADR-API-003 as settled fact in its body language in a way that pre-empts a human decision it isn't its place to pre-empt).

  - If, in the course of this work, you want to propose either of the above corrections, append a new findings-log entry describing the discrepancy — do not edit the source documents directly, and do not fold a doc-correction prompt into this same implementation pass. Present any such proposal separately for human review.

- **Do not retire or fold the `secretariat_decision` panel into `generic_action`/`generic_approval`.** It represents a real, intentional, office-scoped variant of step completion per ADR-API-003 — the fix is routing + gating correction, not panel elimination.

- **`panlalawigan_outcome`'s missing step-status gate** is a separate, previously-identified, low-severity finding that shares the same `computePanelHint`/`getInstance` code path (relevant only as background confirming query-shape claims above) — it is out of scope for this task. Do not fix it opportunistically as a drive-by change; if you notice it while editing the surrounding code, leave it and note it rather than expanding scope.

- **Do not modify `submitStepAction`'s existing behavior** unless your Part 1c design choice specifically and deliberately requires it, and if so, flag that decision explicitly rather than treating it as incidental.



---



## Key File Reference Table (verified paths)



| Purpose | Path | Notes |

|---|---|---|

| Old mutation to replace | `apps/server/src/modules/documents/documents.router.ts` | Lines 1508–1545, `logSecretariatDecision` |

| Input schema (existing shape, reusable) | `packages/shared/src/schemas/documents.ts` | Lines 531–536, `LogSecretariatDecisionInputSchema` |

| Policy guard to wire in | `apps/server/src/modules/workflow/workflow.policy.ts` | Lines 582–600, `canLogSecretariatDecision`, method on the `workflowPolicy` accessor instance |

| Router to add new mutation to / edit `computePanelHint` in | `apps/server/src/modules/workflow/workflow.router.ts` | 2428 lines total. `getInstance` currentSteps select ~284–291; `getActiveInstanceForDocument` call site ~line 464, body from ~361; `completeActionStep` ~734–786; `approveStep`'s outcome-aware event emit ~line 859 |

| Working action-completion handler (model, not to modify) | `action.handler.ts` — `submitStepAction` | Hardcodes `'DONE'` at lines ~50, ~68, ~79 |

| Working outcome-aware handler (better model) | `approval.handler.ts` — `submitStepApproval`, starting line 15 | Takes `outcome: string`, validates against `config['allowed_outcomes']` lines ~37–40 |

| tRPC app-level router mount | `apps/server/src/trpc/root.ts` | `workflowRouter` imported line 5, mounted under `workflow:` key line 15 — confirms the mutation lives under the `workflow.*` tRPC namespace once added |

| Frontend panel to update | `SecretariatDecisionPanel.tsx` | Lines 7–11 (stale comment), 19 (toast), 32–33 (already-available IDs) |

| Seed data for `allowed_outcomes` / `AMENDED` gap | `packages/database/src/seeds/workflow/phase1-legislative.ts` | e.g. lines 79, 97, 368, 433 |

| Precedent for `getOfficeByCode` call shape (not the comparison logic) | `apps/server/src/modules/documents/documents.router.ts` | ~lines 1490–1491, variable `isSp` |

| `SP_SECRETARIAT_OFFICE_CODE` constant precedent | `tracking.router.ts` line 82, `documents.router.ts` line 117 | Value `'SPS'`, locally redeclared per file, not shared — `workflow.router.ts` has none of this yet |

| ADR source | `docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-003-secretariat-decision-entry-point.md` | Lines 30–31 for outcome shape/routing |



**Caution:** `apps/server/dist/` contains compiled build output mirroring several of these paths (e.g. a `.d.ts` for the policy file and the shared schema). Do not edit anything under `dist/` — it is generated output, not source.



---



## Validation Requirements (manual, since automated tests are explicitly out of scope for this task)



1. Confirm the new mutation, when called for a step assigned to a non-SP-Secretariat office, throws `FORBIDDEN` with `cause: 'secretariat_decision_wrong_office'` (not a silent no-op or generic error).

2. Confirm it throws `FORBIDDEN` with `cause: 'secretariat_decision_requires_sp_secretary'` for a non-`sp_secretary` role attempting the action, even if office-scoped correctly.

3. Confirm a successful `approve`/`reject` submission against a real `secretariat_decision`-tagged step actually advances the step (i.e. `workflow.step.completed` is emitted with the correct outcome, and the next step in the workflow definition becomes current) — this is the core regression check against the original "false success" bug.

4. Confirm `getInstance` and `getActiveInstanceForDocument` return an **identical** `panelHint` value for the same instance/step — directly test both call sites, not just one, given the confirmed duplication risk.

5. Confirm the `AMENDED` decision path either (a) is explicitly blocked/surfaced with a clear error pending the human decision on outcome mapping, or (b) correctly implements whichever mapping option was chosen and confirmed — do not leave it silently passing through to a validation failure the user can't make sense of.

6. Manually re-verify `SecretariatDecisionPanel`'s error states now surface real failures to the user (not masked by the old unconditional success toast).



## Acceptance Criteria



- `documents.logSecretariatDecision` is no longer called by `SecretariatDecisionPanel.tsx`; a new Workflow-Router mutation handles the decision, synchronously driving both the document/step state transition and a correctly-outcome-tagged `workflow.step.completed` emission (both the internal `createWorkflowEvent` call and the router-level `eventBus.emit` call must carry the real outcome, not a hardcoded `'DONE'`).

- `canLogSecretariatDecision` has a real call site, correctly supplied with a caller-resolved `isSpSecretariatOffice: boolean` via `fetchStepContext`'s `stepAttrs.assigneeOfficeId`.

- `computePanelHint`'s `secretariat_decision` branch is office-scoped, not role-based, and both `getInstance` and `getActiveInstanceForDocument` are patched identically in the same change.

- The `AMENDED`-outcome seed-data gap is explicitly surfaced (not silently guessed at) with a clear decision or clear escalation.

- The sync/async design choice for `computePanelHint` is made explicitly and documented, not left as an implicit side effect.

- No edits to any Group B–L governance document land as part of this change.

- The stale rationale comment in `SecretariatDecisionPanel.tsx` is updated or removed.
````

---

# Batac City LGU Platform — Master Frontend Task List

_Each task below is a complete, standalone implementation plan — written so an execution agent could pick up any single task with no other context and build it correctly. Everything here is verified directly against the live `batac-dms` repo this session; where the live code differs from what F1/ADRs state, I've used the live code and flagged the discrepancy rather than silently following the documents._

---

## TIER 0 — Before Frontend Work Starts

These are backend additions, one live bug fix, and two decisions. Nothing in Tier 1+ that depends on one of these should be started until it's resolved — each Tier 1+ task below states its Tier 0 dependency explicitly.

---

### TASK-PRE-01 — Add `complaints.get` and `documentRequests.get` (ADR-UI-005 was never implemented)

**Type:** Backend addition. **Blocks:** `/complaints/:complaintId`, `/document-requests/:requestId`.

**Context:** ADR-UI-005 (`docs/pre-development/F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-005-single-record-read-procedures.md`), Status: Accepted, formally decided adding `complaints.get` and `documentRequests.get`. **Neither exists in the live routers.** Confirmed by direct read of `apps/server/src/modules/documents/complaints.router.ts` (5 procedures: `createComplaintClerkAssisted`, `logAndAssign`, `enterCommitteeReport`, `setOutcome`, `listAllComplaints` — no `get`) and `document-requests.router.ts` (6 procedures: `createDocumentRequestClerkAssisted`, `generatePrintableForm`, `approveAsPresidingOfficer`, `approveAsSecretary`, `releaseCopy`, `listAllDocumentRequests` — no `get`).

**Deliverables:**

- `apps/server/src/modules/documents/complaints.router.ts` — add `get: protectedProcedure`.
- `apps/server/src/modules/documents/document-requests.router.ts` — add `get: protectedProcedure`.
- Test coverage for both, following the existing per-file test convention (see `apps/server/src/modules/documents/__tests__/` if present, otherwise match `organization.router.test.ts`'s shape: one role-enforcement test per new procedure).

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] `complaints.get({ complaintId })` returns the full document row shaped like one item of `listAllComplaints`'s output (`complaintId`, `subjectMatter`, `outcomeState`, `assignedOfficeId`, `createdAt`) **plus** detail-only fields not in the list view: `committeeReport` (from `metadata.committeeReport`), `respondent` (from `metadata.respondent`), `incidentDetails` (from `metadata.incidentDetails`), `routingDecision` (from `metadata.routingDecision`).
- [ ] `complaints.get` called by `sp_secretary`, `sp_presiding_officer`, or `auditor` succeeds unconditionally.
- [ ] `complaints.get` called by `sp_member` succeeds only if `metadata.assignedOfficeId` is in `subject.committeeIds` — same condition already enforced in `enterCommitteeReport` (lines 162–169 of the live file), reuse it rather than reinventing the check.
- [ ] `complaints.get` called by any other role, or by `sp_member` not assigned to the complaint's committee, returns `FORBIDDEN`.
- [ ] `complaints.get` on a nonexistent or wrong-`cityId` complaint returns `NOT_FOUND` — match the existing `!document || document.cityId !== subject.cityId` pattern used in every other procedure in this file.
- [ ] `documentRequests.get({ requestId })` returns the full row shaped like one item of `listAllDocumentRequests`'s output (`requestId`, `title`, `requesterName`, `lifecycleState`, `vmApproved`, `spApproved`, `accessMode`, `createdAt`) **plus** detail-only fields: `documentsRequested` (array), `purpose`, `payment`, `notificationChannel` — same fields `generatePrintableForm` already assembles (lines 212–223), reuse that shape rather than defining a new one.
- [ ] `documentRequests.get` called by `sp_secretary`, `sp_presiding_officer`, `records_officer`, or `auditor` succeeds — same role list as `listAllDocumentRequests` (line 550).
- [ ] `documentRequests.get` called by any other role returns `FORBIDDEN`.

**AI Prompt:**

> You are adding two missing single-record read procedures to the Batac City LGU platform's tRPC backend. ADR-UI-005 (read it first: `docs/pre-development/F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-005-single-record-read-procedures.md`) formally decided to add `complaints.get` and `documentRequests.get`, but neither was ever implemented — this task closes that gap.
>
> For `complaints.get`, add to `apps/server/src/modules/documents/complaints.router.ts`, matching the file's existing style exactly (same `getRepository(ctx)`/`getDb(ctx)` helper pattern, same `TRPCError` usage, same inline role-check style already used in every other procedure in this file — do not introduce a new pattern):
>
> ```ts
> get: protectedProcedure
>   .input(z.object({ complaintId: z.string().uuid() }))
>   .query(async ({ ctx, input }) => {
>     const subject = ctx.auth;
>     const repo = getRepository(ctx);
>     const document = await repo.findDocumentById(input.complaintId);
>     if (!document || document.cityId !== subject.cityId) {
>       throw new TRPCError({ code: 'NOT_FOUND' });
>     }
>     const metadata = document.metadata as Record<string, any>;
>     const hasUnconditionalAccess =
>       subject.roles.includes('sp_secretary') ||
>       subject.roles.includes('sp_presiding_officer') ||
>       subject.roles.includes('auditor');
>     if (!hasUnconditionalAccess) {
>       if (!subject.roles.includes('sp_member')) {
>         throw new TRPCError({ code: 'FORBIDDEN' });
>       }
>       if (!metadata['assignedOfficeId'] || !subject.committeeIds.includes(metadata['assignedOfficeId'] as string)) {
>         throw new TRPCError({ code: 'FORBIDDEN', message: 'Not assigned to this committee' });
>       }
>     }
>     return {
>       complaintId: document.id,
>       subjectMatter: metadata['subjectCategory'] || 'Unknown',
>       outcomeState: metadata['outcomeState'] || 'pending_hearing',
>       assignedOfficeId: metadata['assignedOfficeId'] || null,
>       createdAt: document.createdAt,
>       committeeReport: metadata['committeeReport'] ?? null,
>       respondent: metadata['respondent'] ?? null,
>       incidentDetails: metadata['incidentDetails'] ?? null,
>       routingDecision: metadata['routingDecision'] ?? null,
>     };
>   }),
> ```
>
> This mirrors `enterCommitteeReport`'s exact ABAC condition (lines 162–169) and `listAllComplaints`'s exact list-item shape (lines 306–315) plus the four detail fields named in the Acceptance Criteria — do not invent a different field set.
>
> For `documentRequests.get`, add to `apps/server/src/modules/documents/document-requests.router.ts`, same style conventions:
>
> ```ts
> get: protectedProcedure
>   .input(z.object({ requestId: z.string().uuid() }))
>   .query(async ({ ctx, input }) => {
>     const subject = ctx.auth;
>     const allowedRoles = ['sp_secretary', 'sp_presiding_officer', 'records_officer', 'auditor'];
>     if (!allowedRoles.some((r) => subject.roles.includes(r))) {
>       throw new TRPCError({ code: 'FORBIDDEN' });
>     }
>     const repo = getRepository(ctx);
>     const document = await repo.findDocumentById(input.requestId);
>     if (!document || document.cityId !== subject.cityId) {
>       throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
>     }
>     const meta = document.metadata as Record<string, any>;
>     return {
>       requestId: document.id,
>       title: document.title,
>       requesterName: meta['requester']?.name ?? null,
>       lifecycleState: document.lifecycleState,
>       vmApproved: meta['vm_approved'] ?? false,
>       spApproved: meta['sp_approved'] ?? false,
>       accessMode: meta['accessMode'] ?? null,
>       createdAt: document.createdAt,
>       documentsRequested: meta['documentsRequested'] ?? [],
>       purpose: meta['purpose'] ?? null,
>       payment: meta['payment'] ?? null,
>       notificationChannel: meta['notificationChannel'] ?? null,
>     };
>   }),
> ```
>
> This exact role list matches `listAllDocumentRequests` (line 550) and the field shape matches `generatePrintableForm`'s existing output (lines 212–223) merged with `listAllDocumentRequests`'s list-item shape (lines 625–637) — reuse both rather than defining new field names.
>
> Note for whoever picks up the DOCS frontend detail-page tasks afterward: the real procedure names in this codebase are `listAllComplaints`/`listAllDocumentRequests`, not `complaints.listAll`/`documentRequests.listAll` as F1 and this very ADR both say — F1's naming predates or diverged from the actual implementation. Use the real names.

---

### TASK-PRE-02 — Fix `organization.listCommittees` role gate (live bug in shipped code)

**Type:** Bug fix, not new work. **Blocks:** nothing new — but should land before or alongside `/admin/committees` (Tier 2) since both touch the same procedure, and it's already breaking a real user today.

**Context:** `organization.router.ts`'s `listCommittees` procedure (line 567) is gated to `requireAnyRole(ctx, ['plat_admin', 'sp_secretary'], ...)`. F1 §8.2 documents the Multi-Referral Panel's role set as "SP Secretary; SP Member (committee-scoped)" — and `apps/web/src/pages/workflow/panels/MultiReferralPanel.tsx` (already built, already shipped) calls `trpc.organization.listCommittees.useQuery(undefined, ...)` directly (line 38) with no fallback. **An SP Member opening the Multi-Referral Panel today receives `FORBIDDEN` on this call and cannot see the committee list needed to submit a committee report.** This is a live defect in already-shipped code, found by direct verification this session — not previously flagged in either the findings doc or the fe-handoff doc.

**Deliverables:**

- `apps/server/src/modules/organization/organization.router.ts` — widen `listCommittees`'s role check to include `sp_member`.
- Existing `MultiReferralPanel.tsx` requires no change — it already calls the procedure correctly; only the server-side gate is wrong.
- Update the test asserting `listCommittees` role enforcement, if one exists (check `organization.router.test.ts`).

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] `organization.listCommittees` called by `sp_member` succeeds (currently returns `FORBIDDEN` — this is the regression this task fixes).
- [ ] `organization.listCommittees` called by `plat_admin` or `sp_secretary` still succeeds (no regression on existing access).
- [ ] `organization.listCommittees` called by any role outside `{plat_admin, sp_secretary, sp_member}` still returns `FORBIDDEN`.
- [ ] Manually verify (or add a test replicating) that `MultiReferralPanel.tsx` renders the committee list when loaded as an `sp_member` user with an active multi-referral step assigned.

**AI Prompt:**

> You are fixing a live authorization bug in the Batac City LGU platform. `apps/server/src/modules/organization/organization.router.ts` line 567 currently reads:
>
> ```ts
> listCommittees: protectedProcedure
>   .query(async ({ ctx }) => {
>     requireAnyRole(ctx, ['plat_admin', 'sp_secretary'], 'Access to committees list is not permitted for this role.');
>     ...
> ```
>
> Change the role array to `['plat_admin', 'sp_secretary', 'sp_member']`. Do not change anything else in this procedure — the underlying query logic and output shape are correct and already used successfully by `plat_admin`/`sp_secretary` callers.
>
> Why this matters: `apps/web/src/pages/workflow/panels/MultiReferralPanel.tsx` (already built and shipped) calls this exact procedure with no role branching or fallback on its own side — it assumes any authorized viewer of the panel can call it. F1 §8.2's own role table for the Multi-Referral Panel names `SP Member (committee-scoped)` as a legitimate caller. The panel-level gate already correctly restricts _which_ SP Members can act on a given referral (via `subject.committeeIds`), so widening this procedure's role gate does not open up anything the panel itself doesn't already scope correctly — it just stops blocking a caller the panel was always meant to support.
>
> Do not touch `DESIGNATION_READ_ROLES` (a different constant, a few lines above, gating `getActiveDesignations`/`getDesignationHistory`) — that one is correct as-is and out of scope for this fix.

---

### TASK-PRE-03 — AUDIT backend/spec reconciliation (decision + implementation)

**Type:** Requires a human decision first, then backend implementation. **Blocks:** `/audit`, `/audit/full`, `/sysadmin/audit-integrity` (all three, entirely).

**Context:** `apps/server/src/modules/audit/audit.router.ts` has exactly one procedure: `queryEvents`, gated to `sys_admin`/`auditor` only, taking `{ actorId?, targetId?, eventTypes?, from?, to?, pageSize?, cursor? }` and delegating to `AuditQueryService.queryEvents`. F1 §11 and §13.4 describe five different procedures — `listOwnActions`, `listOwnOfficeDocumentActions`, `listFullLog`, `validateChainIntegrity`, `exportEvents` — with a role split (all 12 internal roles can see their own actions at `/audit`; only Auditor sees the full log at `/audit/full`; only System Administrator gets chain-validation at `/sysadmin/audit-integrity`). None of F1's five names exist. `queryEvents`'s actual gate would reject 10 of the 12 roles F1 says should reach `/audit` at all.

The underlying cryptographic primitives for chain validation **do exist** and work: `computeChainHash`, `canonicalizePayload`, `signHmac`, `verifyHmac` are all real, exported functions in `apps/server/src/modules/audit/audit.crypto.ts`. This is "wire existing crypto into a new gated procedure," not "invent hash-chain verification from scratch."

**This task cannot be scoped further until a human picks one of two paths** — per this repo's own governance rule (confirmed directly in `A1-AGENTS.md` §8 this session: "A human resolves document issues between passes, not during them"), this is exactly that kind of decision, not one an agent should make unilaterally, because it has real security-scoping consequences (who can see whose audit trail).

**Decision needed — pick one:**

**Path A: Build F1's five procedures as specified.**

- `listOwnActions` — query scoped to `actorId = ctx.auth.userId`, callable by all 12 roles. Can likely be implemented as a thin wrapper around the existing `AuditQueryService.queryEvents`, forcing `actorId` server-side rather than trusting a client-supplied value, with the role gate removed (or widened to all 12 roles) for this specific entry point.
- `listOwnOfficeDocumentActions` — needs office-scoping logic; check whether `AuditQueryFilter` (the type `queryEvents` already accepts) has any office-level filter field, or whether this needs a new repository-level query. F1 restricts this variant to a named subset of roles (Records Officer, Department Approver, SP Secretary, SP Presiding Officer, Mayor, Barangay Captain, Auditor) — not all 12.
- `listFullLog` — effectively `queryEvents` with no forced `actorId`, restricted to `auditor` only (tighter than the current `sys_admin`/`auditor` gate — System Administrator explicitly should NOT get this, per F1 §11.2's citation of I2 §15 denying System Administrator on "full log" access).
- `validateChainIntegrity` — new procedure wrapping `computeChainHash`/`verifyHmac` against the actual event chain, restricted to `sys_admin` for `/sysadmin/audit-integrity`'s use, or possibly shared with `auditor` for `/audit/full` — this exact detail isn't settled by F1 and needs to be part of the decision.
- `exportEvents` — new procedure, likely CSV/JSON export of a `queryEvents`-shaped result set, `auditor`-only per F1 §11.2.

**Path B: Correct F1 to describe `queryEvents` as it actually is, and separately decide what (if anything) the other 10 roles get.** This means either accepting that most roles have no own-actions audit visibility in Phase 1 (a real scope reduction from what F1 currently promises), or deciding on a narrower single addition (e.g., just widen `queryEvents`'s existing role gate and let the frontend force `actorId = ctx.auth.userId` for non-privileged callers) rather than building all five named procedures.

**Deliverables (once a path is chosen):**

- Whichever procedures Path A/B settles on, added to `audit.router.ts`.
- A corrected F1 §11/§13.4 reflecting whichever path was chosen — per this repo's rule that agents don't edit pre-dev docs directly (confirmed `A1-AGENTS.md` §8), this correction should be drafted precisely and handed to whoever has write authority, not applied unilaterally, mirroring how the prior session handled the retention-schedule correction (KF-12/KF-15 pattern).

**Acceptance Criteria:** Cannot be written precisely until the path is chosen — write these as part of executing this task, once Path A or B is selected, following the same precision level as TASK-PRE-01's criteria above.

**AI Prompt:**

> Do not attempt to implement this task until a human has chosen Path A or Path B above. If you are an agent that has reached this task and no decision is recorded, stop and surface the choice explicitly rather than picking one yourself — this is a deliberate checkpoint, not an oversight in this task list. Once a path is chosen, this task's Deliverables and Acceptance Criteria sections should be filled in with the same precision as TASK-PRE-01 before any code is written, using the exact existing patterns in `audit.router.ts` (the `queryEvents` procedure) and `audit.crypto.ts` (the four existing crypto functions) as your implementation reference.

---

### TASK-PRE-04 — Resolve Designation vs. Delegation (decision, not implementation)

**Type:** Requires a human decision. **Blocks:** the substitute-officer display on `/sessions/:sessionDate` (Tier 3 below) — but only partially; see below for what's genuinely unblocked regardless.

**Context, sharpened from KF-11 with direct code verification this session:**

`org.md`'s Module Summary defers "delegation management UI (designation logging form, active designation list view)" to Phase 1B. F1 §9 (via ADR-UI-007) says the Designation document type and its "Log Designation document" action are Phase 1.

**What I found this session that neither document states:** `session.router.ts`'s `recordAttendance` mutation (lines 316–528) **already implements substitute-officer resolution automatically**, with no frontend involvement at all. When recording attendance, it checks whether the Vice Mayor/Presiding Officer is among the absences; if so, it queries `organization.schema.ts`'s `delegationGrants` table directly (`positionId`, `isActive`, `startDate`/`endDate`, `revokedAt`) for an active delegation and sets `presidedByEmployeeId` accordingly, falling back to the VM's own ID if no active delegation exists. **The `recordAttendance` input schema has no substitute-officer field at all** — `{ sessionDate, absences: [{ councilorEmployeeId, reason }] }`, nothing else. And **`presidedByEmployeeId` is written to `spSessions` but never read back by any query in this file** — `getAttendanceRecord`'s output has no field for it.

This means F1 §9's claim that "the substitute-officer field on `/sessions/:sessionDate` now has a genuine Designation-document linkage" describes a frontend field that, as the backend currently stands, has nothing to submit and nowhere to display a result. The resolution already happens automatically server-side; there's no manual "select a substitute" interaction for the frontend to build at all, contrary to what both F1 and the ORG/F1 tension implied was still an open UI question.

**Decision needed:** Given that automatic resolution already works, does `/sessions/:sessionDate` need any explicit Designation-related UI at all in Phase 1, or does it only need:
(a) a read-only display of who actually presided (which requires a small backend addition — surfacing `presidedByEmployeeId`, resolved to a display name, from `getAttendanceRecord`'s output), and
(b) nothing else, deferring any explicit "log a designation" _authoring_ UI to ORG's own Phase 1B admin screen, exactly as `org.md` says?

If yes to (a)+(b): this substantially resolves the tension in ORG's favor — the "Log Designation document" action ADR-UI-007 pulls into Phase 1 turns out to not need a dedicated UI surface on this particular page, because the backend already does the substitution transparently. If the intent was genuinely for a _manual_ override (a human explicitly picks a substitute rather than the system picking one from `delegation_grants` automatically), that's a different, larger feature not currently reflected in `recordAttendance`'s schema at all, and would need its own backend change beyond just exposing the read.

**This is a real product/UX decision** (automatic vs. manual substitute selection), not a documentation correction — I'm not picking one, per the same reasoning as TASK-PRE-03.

**Deliverables:** A recorded decision. If (a)+(b) is chosen, a small backend addition — see TASK-PRE-04b below, written to be picked up immediately once the decision lands.

**AI Prompt:**

> Do not implement anything until this decision is recorded. Present both framings above to whoever has decision authority over this repo's pre-dev docs, cite `session.router.ts` lines 368–390 (the automatic delegation lookup) and lines 316–332 (the `recordAttendance` input schema with no substitute field) as your evidence, and record whichever choice is made before proceeding to TASK-PRE-04b or to the `/sessions/:sessionDate` frontend task in Tier 3.

---

### TASK-PRE-04b — Surface `presidedByEmployeeId` in `getAttendanceRecord` (conditional on TASK-PRE-04's outcome)

**Type:** Backend addition. **Only proceed if TASK-PRE-04 resolves toward "read-only display of who presided."**

**Deliverables:**

- `apps/server/src/modules/workflow/session.router.ts` — `getAttendanceRecord`'s query and return object both need `presidedByEmployeeId` added, resolved to a display name via a join against `employees` (the same `employees.firstName`/`employees.lastName` pattern already used for `absences` in this same procedure, lines 100–101, 134).

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] `getAttendanceRecord`'s output includes `presidedByEmployeeId: string | null` and `presidedByDisplayName: string | null`.
- [ ] For a session where the regular Presiding Officer was present, both fields resolve to that officer.
- [ ] For a session where the Presiding Officer was absent and an active `delegationGrants` row covers that date, both fields resolve to the delegate, not the absent officer.
- [ ] For a session with no session row yet (the `!session` early-return branch, lines 86–93), both new fields are `null`, consistent with the existing early-return shape for `presentCouncilors`/`absences`.

**AI Prompt:**

> Add `presidedByEmployeeId` and a resolved `presidedByDisplayName` to `getAttendanceRecord`'s output in `apps/server/src/modules/workflow/session.router.ts`. The `spSessions` row already selected at the top of this procedure (lines 74–84) already includes `presidedByEmployeeId` as a raw column — you're not adding a new column, just selecting it explicitly (the current `.select()` is a bare `select()` with no column list, so it's already present on the `session` object; verify this before assuming a schema change is needed) and joining it to `employees` for a display name, following the exact same join pattern already used for the `absences` array a few lines below (lines 95–104: `innerJoin(employees, eq(sessionAttendances.employeeId, employees.id))`, `firstName`/`lastName` concatenation). Add the corresponding fields to both return branches — the early-return at lines 86–93 (set both to `null`) and the main return at lines 140–145.

---

### TASK-PRE-05 — Add `.output()` Zod schemas to `complaints.router.ts` and `document-requests.router.ts`

**Discovered via:** TASK-FE-DOCS-003, surfaced as a `no-unsafe-call`/`no-unsafe-member-access` lint error on `ComplaintDetailPage.tsx`'s `outcomeState.toUpperCase()` call. Logged as `development-findings-log.md` LOG-0086.

**Role:** backend/server — no frontend changes required.

**Context:** `documents.router.ts`, the third file in this same module, declares `.output(SomeZodSchema)` on essentially every procedure it defines (~26 occurrences across ~27 procedures — e.g. `documents.get` returns `.output(DocumentSelectSchema)`), giving real end-to-end type safety from the Postgres row through tRPC to the React client. `complaints.router.ts` and `document-requests.router.ts` have zero `.output()` calls between them. Both repeatedly cast the `metadata` JSONB column with `document.metadata as Record<string, any>` and return fields read straight off that untyped object, with nothing at the procedure boundary to re-assert a real type. The result: every client-side consumer of every procedure in both files that touches `metadata` receives `any` for those fields, silently — `getComplaint`, `listAllComplaints`, `logAndAssign`, `enterCommitteeReport`, `setOutcome`, and the equivalent `document-requests` procedure set. This has only surfaced visibly once so far, because most consumers don't happen to call a method on the affected fields that trips a lint rule the way `.toUpperCase()` did — the gap itself is much wider than the one line that made it visible.

**Deliverables:**

- `.output()` Zod schemas added to every procedure in `complaints.router.ts` that currently lacks one.
- Same for `document-requests.router.ts`.
- Whatever `metadata`-field typing is needed to support those schemas without re-introducing `Record<string, any>` as the effective ceiling (e.g., typed accessor helpers, narrower per-field Zod parsing at the point of extraction, or a shared `ComplaintMetadata`/`DocumentRequestMetadata` interface — implementer's judgment, but the end state should not still bottom out in an untyped cast at the point where fields are actually read).

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes with no new errors.
- [ ] `RouterOutputs['documents']['getComplaint']` (and the other affected procedures) resolves to a real, field-level type on the client — not `any` — confirmed by checking inferred types, not just the absence of a lint error.
- [ ] `apps/server/src/modules/documents/__tests__/complaints.router.test.ts`'s existing AC-C1 through AC-C6 still pass unmodified. These currently assert `getComplaint`'s return shape structurally (checking specific keys exist), not against a Zod schema — adding `.output()` must not change the actual returned shape in a way that breaks these assertions.
- [ ] Equivalent existing tests for `document-requests.router.ts`, if any, still pass unmodified.
- [ ] `ComplaintDetailPage.tsx`'s local type-narrowing workaround on `outcomeState` (see file comment, references LOG-0086) can be removed once this lands, since the field will carry a real type from the source. Removing it is not part of this task's deliverables, but flag it in your summary as a small frontend follow-up.
- [ ] No change to any procedure's runtime behavior — this is a typing-only change. If adding a schema reveals that a field's _actual_ runtime value doesn't match what the code implies it should be (e.g., a field that's sometimes genuinely `undefined` rather than always present), do not silently loosen the schema to paper over it — flag the discrepancy instead, the same way earlier sessions in this codebase have handled similar mismatches (see LOG-0081, LOG-0085 for precedent on flagging rather than guessing).

**AI Prompt:**

> Add `.output()` Zod schemas to every procedure in `apps/server/src/modules/documents/complaints.router.ts` and `apps/server/src/modules/documents/document-requests.router.ts`, following the exact convention already established in the sibling file `documents.router.ts` in the same directory — check that file for the schema-naming and placement pattern before writing your own (e.g. `DocumentSelectSchema`, `SuccessOutputSchema` — some of these existing shared schemas may be directly reusable rather than needing new ones written from scratch, particularly for simple `{ success: true }` mutation returns). The core problem is that both target files cast `document.metadata as Record<string, any>` and return fields read directly off that cast with nothing re-typing them at the procedure boundary — so adding `.output()` alone closes the client-visible gap, but consider also whether the internal `metadata` extraction itself should be typed more precisely, rather than just wrapping an untyped read in an output schema that happens to match today's shape by coincidence. Run the existing test suites for both files before and after your change and confirm no assertions break — these tests check structural shape, not types, so a passing test suite alone doesn't prove the new schema is correct; read the assertions and confirm the schema you add actually matches what they expect field-by-field.

---

## TIER 1 — IAM (no Tier 0 dependency)

### TASK-FE-IAM-001 — `/admin/roles` (RoleAssignmentPage)

**Role:** Platform Administrator, gated via `ctx.auth.isPlatformAdmin` server-side — the live code uses this boolean flag, not a generic `roles.includes('plat_admin')` check (confirmed in `iam.router.ts`'s `assignRole`/`revokeRole`, lines 164, 187). Mirror this in any client-side conditional rendering that checks the current user's own permissions.

**Deliverables:**

- `apps/web/src/pages/iam/RoleAssignmentPage.tsx`
- `apps/web/src/pages/iam/columns.tsx` (or extend an existing shared columns file if one exists by the time this task runs)
- Route registration in `apps/web/src/main.tsx`: `{ path: "/admin/roles", element: <RoleAssignmentPage /> }`

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Page renders a searchable user directory via `trpc.iam.listUserDirectory.useQuery({ pageSize, officeId?, search? })`.
- [ ] **Output shape note:** `listUserDirectory` returns `{ items: UserRow[], nextCursor: null }` where `UserRow` is Drizzle's raw inferred type from `packages/database/schema/iam.schema.ts`'s `users` table — fields are `id, cityId, username, email, status, mfaEnabled, loginFailureCount, loginLockedUntil, createdAt, updatedAt, deletedAt, deletedBy`. **There is no `displayName`, `officeId`, or `positionTitle` on this output**, even though a different schema block in the same `iam.schemas.ts` file (`userSummaryOutput`) declares those fields — that schema is not what this procedure actually returns. Build the UI against the real `UserRow` fields (`username`, `email`) for display, not the unused `userSummaryOutput` shape.
- [ ] `nextCursor` is always `null` in the current implementation (the router hardcodes it) — pagination beyond the first page isn't functional yet; don't build "load more" UI that expects it to work, or note this as a known limitation if you do.
- [ ] Per-user role assignment control calls `trpc.iam.assignRole.useMutation({ userId, roleCode, officeScopeId? })`. `roleCode` must be one of the 13-value `roleCodeEnum` (`sys_admin, plat_admin, records_officer, dept_encoder, dept_approver, sp_secretary, sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain, auditor, citizen`) — render as a `<select>`, not free text.
- [ ] Handle the `RoleCombinationForbiddenError` case: `assignRole` throws `FORBIDDEN` with a specific message (not a generic one) when a role combination is disallowed — surface `err.message` in the error toast, don't replace it with a generic "failed to assign role" string, since the specific message tells the user which combination was rejected.
- [ ] Role revocation calls `trpc.iam.revokeRole.useMutation({ roleAssignmentId })`. **Known backend quirk, not something to fix from the frontend:** the router's `revokeRole` implementation passes `targetUserId: ''` to the service layer (an empty string, not the actual user's ID) — this is already how the procedure behaves; don't try to pass a `targetUserId` from the frontend since the input schema (`RevokeRoleInput`) only accepts `roleAssignmentId` and has no field for it.
- [ ] Build only role _assignment_, not role _definition_ — no UI for creating new roles or permission sets. Confirmed no such procedure exists anywhere in `iam.router.ts`; F1 §12.3 itself flags this as a known, unresolved gap outside this task's scope.

**AI Prompt:**

> Build `RoleAssignmentPage.tsx` as a searchable user directory with inline role-assignment controls. Use `trpc.iam.listUserDirectory.useQuery` for the list — input is `{ cursor?, pageSize (1-100, default 20), officeId?, search? }`. Each row should show `username` and `email` (the only identifying fields actually present on the raw `UserRow` — do not assume `displayName` exists). For each user, render their current role assignments (if the frontend needs to display _existing_ roles per user, check whether `listUserDirectory`'s `UserRow` includes any join to `roleAssignments` — based on the Drizzle-inferred type, it does not; you may need a separate query or accept that this page can assign/revoke but not display current-state without an additional backend read, which is out of this task's scope to add unless you flag it as a follow-up).
>
> Wire `assignRole` and `revokeRole` mutations with `trpc.useUtils()` invalidation of `listUserDirectory` on success, and toast feedback on both success and error — follow the exact pattern already used in `apps/web/src/pages/workflow/panels/SecretariatDecisionPanel.tsx` (`useMutation({ onSuccess, onError })`, `sonner` toast calls, `utils.<procedure>.invalidate()`). Do not fire a success toast without checking the mutation actually returned a success indicator — both `assignRole` and `revokeRole` return objects with clear success signals (`{ roleAssignmentId }` and `{ success: true }` respectively) to check against.
>
> Register the route as a static path in `main.tsx`'s existing `createBrowserRouter` array — no dynamic segment needed, this is a single page with inline interactions, not a list→detail pair.

---

### TASK-FE-IAM-002 — `/sysadmin`, `/sysadmin/sessions`, `/sysadmin/users`

**Role:** System Administrator, gated via `ctx.auth.isItAdmin` server-side (confirmed in `iam.router.ts` — `listAllActiveSessions`, `forceTerminateSession`, `createUserAccount` all check this exact flag, not a `roles.includes(...)` pattern).

**Deliverables:**

- `apps/web/src/pages/sysadmin/SystemAdminHomePage.tsx` — landing shell, links to the two children below, no data fetching of its own (mirror `/admin`'s existing landing-shell pattern once `/admin` exists, or build as a simple static links page if `/admin` hasn't landed yet).
- `apps/web/src/pages/sysadmin/ActiveSessionsPage.tsx`
- `apps/web/src/pages/sysadmin/UserAccountManagementPage.tsx`
- Route registrations in `main.tsx`: `/sysadmin`, `/sysadmin/sessions`, `/sysadmin/users`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] `ActiveSessionsPage` lists sessions via `trpc.iam.listAllActiveSessions.useQuery({ cursor?, pageSize })`. **Output shape:** `{ items: SessionRow[], nextCursor: null }` — same "always null, no real pagination yet" caveat as `listUserDirectory` above. `SessionRow` is Drizzle-inferred from `sessions` table: `id, cityId, userId, sessionTokenHash, ipAddress, userAgent, lastActivityAt, locked_at, active, createdAt, terminatedAt, terminatedBy, terminationReason, deletedAt, deletedBy`. Do not display `sessionTokenHash` in the UI (it's a hash, not useful to a human, and displaying credential-adjacent hashes is bad practice even for admin tooling) — show `userId`, `ipAddress`, `userAgent`, `lastActivityAt`, `active` instead.
- [ ] Per-row terminate action calls `trpc.iam.forceTerminateSession.useMutation({ sessionId, reason })`. **`reason` is required** (`z.string().min(1)`) — the mutation will reject an empty reason with a Zod validation error before the role check even runs; build the UI to require a non-empty reason input (e.g., a small text field or dropdown of reasons shown before the terminate button is enabled), not an unprompted one-click terminate.
- [ ] `UserAccountManagementPage` provides create/edit/deactivate/reactivate via `trpc.iam.createUserAccount`, `editUserAccount`, `deactivateUserAccount`, `reactivateUserAccount`.
- [ ] `createUserAccount` input is `{ username (3-64 chars), email, employeeId (uuid) }` — note `employeeId` references an ORG employee record, not a free-text field; this page needs an employee picker, which likely means calling ORG's employee-list capability (check whether `organization.router.ts` exposes a plain employee list — as of this session it has `createEmployee`/`updateEmployee` but the read side wasn't verified in this task list; confirm before assuming a picker data source exists, and flag as a blocker if it doesn't).
- [ ] `editUserAccount`'s role gate is more permissive than the others: `ctx.auth.isItAdmin || ctx.auth.isPlatformAdmin || ctx.auth.userId === input.userId` — meaning a regular user could theoretically call this on themselves. This page is System-Administrator-only by route, so this extra self-edit branch is irrelevant here, but don't be surprised if a non-sysadmin caller of this same procedure elsewhere in the app succeeds unexpectedly; that's existing, correct backend behavior, not a bug to fix.
- [ ] `deactivateUserAccount`/`reactivateUserAccount` both take `{ userId }` only and return `{ success: true, newStatus: 'deactivated' | 'active' }` — use the returned `newStatus` to update local UI state optimistically or via invalidation, don't assume the mutation name alone tells you the resulting status matches what you expect (both are literally correct here, but check `newStatus` rather than hardcoding an assumption for consistency with how these procedures are meant to be consumed).

**AI Prompt:**

> Build three pages under `apps/web/src/pages/sysadmin/`. `SystemAdminHomePage` is a minimal landing shell — copy the structural pattern of whatever `/admin`'s landing page ends up being (check if `PlatformAdminHomePage.tsx` exists yet; if not, build a simple page with a `PageHeader` (from `packages/ui/src/components/domain/PageHeader.tsx`) and three link cards to the three sysadmin sub-routes).
>
> `ActiveSessionsPage`: table of active sessions using `trpc.iam.listAllActiveSessions.useQuery`, columns for `userId`, `ipAddress`, `userAgent`, `lastActivityAt`, `active` status (use the `StatusBadge` domain component for the active/inactive indicator). Each row needs a "Terminate" action that opens a small confirmation requiring a `reason` string before calling `trpc.iam.forceTerminateSession.useMutation({ sessionId: row.id, reason })`.
>
> `UserAccountManagementPage`: a form for `createUserAccount` (`username`, `email`, and an employee picker for `employeeId` — confirm a data source for the picker exists in ORG's router before building it; if it doesn't, flag this explicitly as a blocking dependency rather than stubbing it silently) plus a list (reuse `listUserDirectory` from IAM-001 if that task has already landed, or call it fresh here) with per-row edit/deactivate/reactivate actions wired to `editUserAccount`, `deactivateUserAccount`, `reactivateUserAccount` respectively.
>
> All three pages gate on System Administrator only — check `ctx.auth.isItAdmin`-equivalent state on the client (however the session/auth store exposes this flag; check `apps/web/src/lib/auth-context.tsx` for the exact shape before assuming a field name).

---

## TIER 2 — ORG (no Tier 0 dependency, except TASK-PRE-02 lands alongside)

### TASK-FE-ORG-001 — `/organization` (OrganizationPage)

**Role:** View — `sys_admin, plat_admin, records_officer, sp_secretary, sp_member, sp_presiding_officer, mayor, auditor, dept_encoder, dept_approver` (this exact list is `ORG_CHART_VIEW_ROLES` in `organization.router.ts` line 71 — a flat allowlist, not a `PolicyEvaluator` ABAC check, confirmed by the file's own comment). Manage — Platform Administrator only (`requirePlatformAdmin(ctx)` guard on all write procedures).

**Deliverables:**

- `apps/web/src/pages/organization/OrganizationPage.tsx`
- Route registration: `/organization`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Read side calls `trpc.organization.getOfficeHierarchy.useQuery()` — **no input** (the procedure has no `.input(...)` call at all; calling it with any argument is a type error, not just unnecessary).
- [ ] Output shape: `{ offices: OfficeSummary[] }` where each `OfficeSummary` is `{ officeId: string (uuid), name: string, parentOfficeId: string (uuid) | null, type: 'executive' | 'legislative' | 'department' | 'barangay' | 'external' }`. Build the hierarchy view by resolving `parentOfficeId` chains client-side — the backend returns a flat list, not a pre-nested tree, despite the type name `OfficeTree`.
- [ ] Edit controls (visible only when `ctx.auth`-equivalent client state shows Platform Administrator) call `createOffice`, `updateOffice`, `deactivateOffice`, `createPosition`, `updatePosition`, `createEmployee`, `updateEmployee`, `assignEmployeeToPosition`.
- [ ] **`officeType` enum values are `executive, legislative, department, barangay, external`** — confirmed against the live `ck_offices_office_type` DB CHECK constraint, the `organization.schema.ts` comment, seed data, and the shared `OfficeSummarySchema`, all four independently agreeing. Do not use any other plausible-sounding set (e.g., `sp_office`, `mayors_office`, `city_department` — an earlier, incorrect version of this enum that would pass Zod validation on the request but fail the live DB constraint on write, producing an opaque 500 rather than a clean validation error). This is documented explicitly in `organization.schemas.ts`'s file header (lines 10–23) as a known, already-resolved discrepancy — the file header is worth reading in full before building any office CRUD form.
- [ ] `createEmployee`'s `employeeNumber` field is typed `.nullish()` in the Zod schema but is **NOT NULL** in the actual `employees` table — same file header, note 2. The router validates presence explicitly and returns `BAD_REQUEST` rather than letting a DB constraint violation surface as a 500, but the frontend form should still treat `employeeNumber` as effectively required (don't let a user submit without it just because the type allows `undefined`).
- [ ] `createCommittee`'s `chairedByEmployeeId` has the same nullish-in-schema-but-NOT-NULL-in-DB pattern — treat as required in the form.

**AI Prompt:**

> Build `OrganizationPage.tsx` as a single page with a read-only office hierarchy tree (built client-side from the flat `offices` array returned by `getOfficeHierarchy`, resolving `parentOfficeId` links — offices with `parentOfficeId: null` are roots) and, for Platform Administrators only, inline edit controls for offices/positions/employees/assignments.
>
> Before building any create/edit form, read `apps/server/src/modules/organization/organization.schemas.ts` in full — its file header documents two already-resolved discrepancies between an earlier spec and the live database (the `officeType` enum values, and two fields that are typed optional in Zod but are actually required by DB constraints). Both are load-bearing for building a form that won't hit a confusing 500 on submission. Use `officeTypeEnum`'s actual five values (`executive, legislative, department, barangay, external`) for any office-type `<select>`, and treat `employeeNumber` (on employee creation) and `chairedByEmployeeId` (on committee creation) as required fields in the UI even though their Zod types are nullish.
>
> For the read query, call `trpc.organization.getOfficeHierarchy.useQuery()` with no arguments — the procedure takes no input. Gate all write UI behind a Platform Administrator check on the client (check `apps/web/src/lib/auth-context.tsx` for how role state is exposed).

---

### TASK-FE-ORG-002 — `/admin/committees` (CommitteeManagementPage)

**Role:** Platform Administrator (page-level, per F1). **Note:** `listCommittees` itself is gated to `plat_admin, sp_secretary` (and, once TASK-PRE-02 lands, `sp_member`) — wider than just Platform Administrator, but this page is Platform-Administrator-only per F1's route table regardless; the wider procedure gate exists because `MultiReferralPanel.tsx` also calls it, not because this specific page needs to allow those other roles.

**Deliverables:**

- `apps/web/src/pages/organization/CommitteeManagementPage.tsx`
- Route registration: `/admin/committees`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] List view calls `trpc.organization.listCommittees.useQuery()` — no input.
- [ ] Output: array of `{ committeeId, name, code, description, deletedAt }` (confirmed exact shape from the live router, lines 569–578 — note this is a bespoke inline shape built in the router itself, not from the `committeeOutput` schema in `organization.schemas.ts`, which only covers the write side's `{ committeeId }` return).
- [ ] Create/edit call `createCommittee` (`{ name, code, chairedByEmployeeId }` — treat `chairedByEmployeeId` as required per the schema-file note above) and `updateCommittee` (same shape, partial, plus `committeeId`).
- [ ] Membership assignment calls `assignCommitteeMembership` (`{ committeeId, employeeId, committeeRole: 'chairman' | 'vice_chairman' | 'member', startDate }`).
- [ ] This page is the write-side counterpart to data the Multi-Referral Panel (already built) already reads — building this page doesn't change that panel's behavior, only adds a management surface Platform Admin didn't have before.

**AI Prompt:**

> Build `CommitteeManagementPage.tsx`: a list of committees (`listCommittees`) with create/edit forms (`createCommittee`/`updateCommittee`) and a membership-assignment control (`assignCommitteeMembership`). The list output shape is a plain array (not `{ items, nextCursor }` like most other list procedures in this codebase) — don't assume pagination fields exist where they don't. Use `committeeRoleEnum`'s three values (`chairman, vice_chairman, member`) for the membership role selector. `chairedByEmployeeId` on creation needs an employee picker — same open question as TASK-FE-IAM-002 about whether a plain employee-list read exists; confirm before building, and flag rather than stub if it's missing.

---

## TIER 3 — WF: Order of Business and Sessions

### TASK-FE-WF-001 — `/order-of-business` (OrderOfBusinessPage)

**Role:** View — `sp_secretary, sp_member, sp_presiding_officer, mayor, auditor`. Manage — `sp_secretary` only. Both enforced via `session.router.ts`'s `enforceRoles(ctx, [...])` helper (a simple array-includes check against `ctx.auth.roles`/`ctx.auth.effectiveRoles` — different implementation style than IAM's boolean flags or ORG's `requireAnyRole`, worth knowing this codebase has three distinct role-check idioms across three modules, not one shared convention).

**Deliverables:**

- `apps/web/src/pages/workflow/OrderOfBusinessPage.tsx`
- Route registration: `/order-of-business`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Read calls `trpc.session.getOrderOfBusiness.useQuery({ sessionDate? })` — `sessionDate` is optional; omitting it defaults server-side to "next Tuesday" via `getNextTuesday()`. Build the page to work with no `sessionDate` param for the default view, with an optional date picker to view other sessions.
- [ ] Output: `{ sessionDate: Date, items: Array<{ documentId, title, preliminaryNumber, committeeReportStatus: 'not_applicable' | 'all_submitted' | 'red_flagged', assignedCommittees: string[] }> }`. Render `committeeReportStatus === 'red_flagged'` items visibly marked (red), matching F4's documented UX ("items with missing or pending committee reports are marked red").
- [ ] `scheduleDocumentForFirstReading` mutation (`{ documentId, sessionDate }`, `sp_secretary` only) — note the backend has real Tuesday-snapping and Thursday-cutoff logic (if the target date isn't a Tuesday it snaps forward; if past the Thursday-before cutoff it rolls to the following week) — the frontend does not need to replicate this logic, just submit the requested date and let the backend resolve the actual scheduled date; don't pre-validate "must be a Tuesday" client-side in a way that would block a valid submission the backend would otherwise accept and reschedule correctly.
- [ ] `enterCommitteeHearingDate` mutation (`{ stepInstanceId, hearingDate? }`, `sp_secretary` only) — `hearingDate` is nullish (clearing a previously-set date is supported, send `null` explicitly rather than omitting the field if that's the intent).
- [ ] `workflow.manuallyAdvanceMultiReferralStep` (note: this lives in `workflow.router.ts`, not `session.router.ts` — a different file than the other three procedures on this page) — `sp_secretary` only, per F1 requires "mandatory comment" for audit purposes; confirm this procedure's actual input schema in `workflow.router.ts` before building the override UI (not verified in this task-list-writing session; check before assuming a `comment` field name).
- [ ] The `OrderOfBusinessRow` domain component already exists at `packages/ui/src/components/domain/OrderOfBusinessRow.tsx` with an existing dev-showcase route already registered (`/dev/components/order-of-business-row`) — check its actual prop shape against this page's real data before building a custom row component; it was very likely built anticipating this exact page.

**AI Prompt:**

> Build `OrderOfBusinessPage.tsx`. Primary read: `trpc.session.getOrderOfBusiness.useQuery({ sessionDate: selectedDate ?? undefined })`. Render each item using the existing `OrderOfBusinessRow` component from `@batac/ui` if its props match (check `packages/ui/src/components/domain/OrderOfBusinessRow.tsx` first) — don't build a parallel custom row component without checking this.
>
> For the `sp_secretary`-only management actions: "schedule for first reading" is a document-picker plus date submission to `session.scheduleDocumentForFirstReading` — the backend handles Tuesday-snapping and cutoff-rollover automatically, so don't add client-side date validation beyond basic sanity (a real date). "Enter committee hearing date" is a per-item date input calling `session.enterCommitteeHearingDate({ stepInstanceId, hearingDate })` for multi-referral items specifically (only items where `committeeReportStatus !== 'not_applicable'` are multi-referral). "Manually advance" calls `workflow.manuallyAdvanceMultiReferralStep` — before building this control, read that procedure's actual definition in `apps/server/src/modules/workflow/workflow.router.ts` to confirm its exact input shape, since this task list was written without verifying that one specifically and F1 mentions a "mandatory comment" requirement that needs to match the real field name.

---

### TASK-FE-WF-002 — `/sessions` and `/sessions/:sessionDate` (SessionAttendanceOverviewPage, SessionAttendanceDetailPage)

**Role:** Both — `sp_secretary, sp_member, sp_presiding_officer, mayor, auditor` for viewing; recording attendance is `sp_secretary` only.

**Tier 0 dependency:** TASK-PRE-04 (decision) and, conditionally, TASK-PRE-04b (backend addition) should land first if the decision favors displaying who presided. This task can proceed without them, but the "who presided" display sub-item below is blocked until then — build everything else regardless.

**Deliverables:**

- `apps/web/src/pages/workflow/SessionAttendanceOverviewPage.tsx`
- `apps/web/src/pages/workflow/SessionAttendanceDetailPage.tsx`
- Route registrations: `/sessions`, `/sessions/:sessionDate`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Overview calls `trpc.session.getAttendanceStatistics.useQuery({ from?, to? })`. Output: `{ series: Array<{ sessionDate: Date, presentCount: number, absentCount: number }>, printableSummaryUrl: null }`. **`printableSummaryUrl` is hardcoded `null`** in the current implementation — do not build a "print summary" link/button that expects this to resolve to a real URL; either omit that control entirely or visibly disable it with a "not yet available" state.
- [ ] Detail page keys on `sessionDate` from the route param, calls `trpc.session.getAttendanceRecord.useQuery({ sessionDate })`. Output: `{ sessionDate: Date, presentCouncilors: string[] (employee IDs, not names), absences: Array<{ councilorEmployeeId, councilorDisplayName, reason: string (human-readable, e.g. "Official Business", "Sick Leave", "Vacation Leave", "Absent (Unqualified)") }>, quorumMet: boolean }`. Note `presentCouncilors` is bare ID strings with no display name attached in this output — you'll need a separate lookup (e.g., against `organization.getOfficeHierarchy` or an employee list, if TASK-FE-IAM-002's open question about an employee-read procedure gets resolved) to show present-councilor names, or accept showing IDs as a known limitation.
- [ ] Recording attendance calls `trpc.session.recordAttendance.useMutation({ sessionDate, absences: [{ councilorEmployeeId, reason }] })` where `reason` is one of `'official_business' | 'sick_leave' | 'vacation_leave' | 'absent_unqualified'` (note: these are the _input_ enum values, different strings than the _output_ `absences[].reason` human-readable strings above — don't confuse the two when building the recording form vs. the display view).
- [ ] **Substitute-officer display, conditional on TASK-PRE-04's outcome:** if the decision was to expose `presidedByEmployeeId`/`presidedByDisplayName` (TASK-PRE-04b), display it read-only on this page once that backend addition lands. Do not build any input control for manually selecting a substitute — as of this session's verification, `recordAttendance`'s input schema has no field for it, and the backend resolves substitution automatically from `delegation_grants`. If TASK-PRE-04's decision was different (e.g., a genuine manual-override feature was decided), this acceptance criterion needs to be rewritten against whatever backend shape that decision produces — check TASK-PRE-04's recorded outcome before building this part.

**AI Prompt:**

> Build both pages as a standard overview→detail pair, same navigational shape as `/documents` → `/documents/:documentId`.
>
> `SessionAttendanceOverviewPage`: a simple chart or table of `getAttendanceStatistics`'s `series` (session date, present/absent counts) — the `SLATimer` or `StatCard` domain components may not be the right fit here (they're SLA/count-specific), so this may need custom presentation; check `packages/ui`'s available components before assuming one fits. Do not build a working "print summary" control — `printableSummaryUrl` is always `null` server-side right now.
>
> `SessionAttendanceDetailPage`: keyed on `:sessionDate` route param (coerce to `Date` before passing to the query, matching `z.coerce.date()` on the backend). Display `quorumMet` prominently (12-member body, quorum at 7 present, per the backend's own `presentCount >= 7` logic). List absences with their human-readable reasons directly from the query output. For `sp_secretary` users, provide an attendance-recording form: a per-councilor present/absent toggle, with a reason selector (using the four `enforceRoles`-adjacent input enum values: `official_business, sick_leave, vacation_leave, absent_unqualified`) for anyone marked absent, submitting the whole set via one `recordAttendance` call.
>
> **Before building any substitute-officer UI on this page, check whether TASK-PRE-04 has been decided and, if so, what it decided.** If undecided, build everything else and leave a clear placeholder or omit that section entirely rather than guessing at a shape — this task list deliberately does not resolve that decision.

---

## TIER 4 — WF: Dashboards

### TASK-FE-WF-003 — `/secretary` (SecretaryDashboardPage)

**Role:** SP Secretary only. **Sequencing note:** build after TASK-FE-WF-001/002 land, so this page's cross-links (`/order-of-business`, `/sessions`) resolve to real pages rather than stubs.

**Deliverables:**

- `apps/web/src/pages/workflow/SecretaryDashboardPage.tsx`
- Five widget sub-components (can be inline in the page file or extracted, developer's judgment): `QueueWidget`, `PendingItemsWidget`, `SessionCalendarWidget`, `OrderOfBusinessSummaryWidget`, `SlaComplianceWidget`.
- Route registration: `/secretary`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] `QueueWidget` calls `trpc.workflow.listMyAssignedSteps.useQuery({ pageSize: <small number, e.g. 5-10> })` — this is the exact same procedure `MyAssignedStepsPage` already uses; reuse the query hook/pattern from that existing page rather than reimplementing.
- [ ] `PendingItemsWidget` calls `trpc.documents.list.useQuery({ officeId: <SP Secretariat office ID>, limit: <small number> })`. **`officeId` needs to be resolved first** — the SP Secretariat's office ID isn't a hardcoded constant available client-side; resolve it via whatever office-lookup pattern is established (the fe-handoff doc's office-scoping notes describe a `getOfficeByCode`-style backend helper, but that's server-side; on the frontend, either derive it from an already-loaded `getOfficeHierarchy` result by filtering for the SP Secretariat's known code (`'SPS'`, per the fe-handoff doc's office-code notes), or check whether the current user's own session/auth state already carries their office ID directly (SP Secretary's own office IS the SP Secretariat, so `ctx.auth`-equivalent client state may already have it without a lookup at all — check `auth-context.tsx` before building a lookup that isn't needed).
- [ ] `SessionCalendarWidget` and `OrderOfBusinessSummaryWidget` both call `trpc.session.getOrderOfBusiness.useQuery()` (same call, per F4) — consider sharing one query result between both widgets rather than firing it twice.
- [ ] `SlaComplianceWidget` calls `trpc.workflow.getSlaComplianceData.useQuery({ breachedOnly: true })` or similar — optional widget per F1/F4, build it but treat it as non-blocking if `workflowPolicy.canAccessSlaData` denies the caller (check what error shape that policy throws before assuming a generic `FORBIDDEN` — not verified in this session).
- [ ] All four cross-links (`/order-of-business`, `/workflow/steps`, `/sessions`, `/documents`) point to real, already-existing or already-built-by-this-point routes — verify each resolves before considering this task complete.
- [ ] `SLATimer` and `StatCard` domain components (`packages/ui/src/components/domain/`) are likely fits for the SLA widget and queue-count displays respectively — check their prop shapes before building custom equivalents.

**AI Prompt:**

> Build `SecretaryDashboardPage.tsx` composing five widgets, per F4 §4.3. All underlying data comes from procedures already consumed successfully by other, already-built pages — this is a composition task, not new backend integration.
>
> `QueueWidget`: top N rows from `workflow.listMyAssignedSteps`, same procedure as `MyAssignedStepsPage` — check that page's existing query setup and reuse the pattern (React Query key, invalidation behavior) rather than diverging.
>
> `PendingItemsWidget`: `documents.list` filtered by `officeId`. Resolve the SP Secretariat's office ID from client-side auth/session state first (check if it's already available — the logged-in user IS SP Secretary, whose own office is the SP Secretariat, so this may not need a lookup at all) before falling back to filtering `getOfficeHierarchy`'s result for the `'SPS'` office code.
>
> `SessionCalendarWidget` + `OrderOfBusinessSummaryWidget`: both read `session.getOrderOfBusiness` — share one query call between them via a shared parent-level `useQuery` rather than two independent calls.
>
> `SlaComplianceWidget`: `workflow.getSlaComplianceData`. This is gated by `workflowPolicy.canAccessSlaData(ctx.auth)` — a `PolicyEvaluator`-style guard, not a simple role array; check `workflow.policy.ts` around the citation "I2 §16" for the actual allowed-role set before assuming SP Secretary is definitely included (F1 states it is, but this task list didn't independently re-verify that specific policy function's contents this session).
>
> Wire all four cross-links using the routes this same build sequence establishes earlier (Tier 3) — by the time this task runs, `/order-of-business`, `/sessions`, and the already-existing `/workflow/steps`, `/documents` should all be real.

---

### TASK-FE-WF-004 — `/mayor` (MayorDashboardPage)

**Role:** Mayor only. **Sequencing note:** same as WF-003, build after Tier 3.

**Deliverables:**

- `apps/web/src/pages/workflow/MayorDashboardPage.tsx`
- Route registration: `/mayor`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] **Critical constraint, verified directly this session, not previously documented anywhere:** there is no server-side way to filter `listMyAssignedSteps`'s output to "mayor-action steps only" using the fields that procedure actually returns. Its output items are `{ stepInstanceId, instanceId, documentId, documentTitle, stepType, assignedAt, dueAt }` — `stepType` is the coarse category (`action | approval | multi_referral | decision | notification | termination`), not the fine-grained `stepKey` (`mayor_review`, `mayor_signature`, etc.) that actually distinguishes a mayoral step from any other `approval`-type step. `stepKey` is selected internally by `getInstance` (line 298) but **stripped before that procedure's response is returned** (compare the internal query at lines 293–301 against the actual returned object at lines 357–368 — `stepKey` is fetched, used to compute `panelHint` server-side, then dropped). The only externally-visible signal for step identity is `panelHint`, obtainable only via a **separate `getInstance` call per instance**.
- [ ] Given the above, this dashboard has two honest implementation options — pick one and document the choice in a code comment, since neither is a small oversight to silently work around:
  - **Option 1 (N+1, correct but potentially slow):** call `listMyAssignedSteps`, then call `getInstance({ instanceId })` for each returned row, filter client-side on `panelHint === 'mayor_decision'` (or `'mayor_lapse_confirmation'`). Fine for small result sets (a Mayor's own queue is likely small), acceptable for a first build.
  - **Option 2 (requires a backend change, out of this task's scope but worth flagging forward):** add a server-side filter parameter to `listMyAssignedSteps`, or include `stepKey`/`panelHint` directly in its output. If Option 1 proves too slow in practice, this becomes its own small backend task, structured the same way as TASK-PRE-01/02 above.
  - Build Option 1 for this task. Do not attempt to build a client-side filter against `stepKey` directly on `listMyAssignedSteps`'s raw output — that field does not exist there and referencing it will fail to compile against the real inferred type.
- [ ] `SlaComplianceWidget`-equivalent here calls `getSlaComplianceData` — same call as the Secretary dashboard, confirm Mayor is included in the caller's `canAccessSlaData` policy check before assuming it "just works" the same way.
- [ ] Every action item navigates to `/workflow/steps/:instanceId`, which already exists and already renders the Mayor Decision Panel correctly for `mayor_review`/`mayor_signature` steps — this dashboard is purely a filtered entry point into a page that already works, not new panel logic.

**AI Prompt:**

> Build `MayorDashboardPage.tsx`. Start with `trpc.workflow.listMyAssignedSteps.useQuery({ pageSize: <reasonably small> })` to get the Mayor's raw assigned-step list. **Because `stepKey` is not present in that output**, you cannot filter directly on it — for each returned row, issue a `trpc.workflow.getInstance.useQuery({ instanceId: row.instanceId })` call (React Query will handle these as independent parallel queries if you map over the rows and call the hook per-item via a component-per-row pattern, or use `useQueries` for a single batched hook) and filter the combined result down to items where the resolved `panelHint` is `'mayor_decision'` or `'mayor_lapse_confirmation'`. This is an N+1 pattern — acceptable for a first build given a Mayor's queue is likely small, but leave a comment noting that if this list grows large, the better fix is a server-side addition (a new filter param on `listMyAssignedSteps`, or including `stepKey`/`panelHint` in its existing output) rather than optimizing the N+1 pattern itself.
>
> Add `getSlaComplianceData` for an overdue-items indicator, same procedure the Secretary dashboard uses — verify `workflowPolicy.canAccessSlaData` actually permits the Mayor role before building the UI around an assumption it will succeed (check `workflow.policy.ts`).
>
> Every list item, once filtered, links to `/workflow/steps/:instanceId` (already built, already handles the Mayor Decision Panel correctly) — no new panel work needed here, this page is purely a filtered queue view.
>
> **Unrelated minor cleanup, optional, not blocking:** if you're touching `workflow.router.ts` in this session for any reason, `apps/web/src/pages/workflow/panels/SecretariatDecisionPanel.tsx` has a stale code comment (top of file) describing `computePanelHint`'s office-scoping as a role-based "proxy" — the live implementation (line 236–240 of `workflow.router.ts`) genuinely does a direct office-ID comparison now, confirmed this session. The comment predates that fix and was never updated. Not required for this task; flagging since you may be in the neighborhood.

---

## TIER 5 — DOCS: Complaints and Document Requests

_All six tasks below depend on TASK-PRE-01 for the two `:id` detail pages specifically. The three list/new pages per resource have no Tier 0 dependency and can start immediately._

### TASK-FE-DOCS-001 — `/complaints` (ComplaintsListPage)

**Role:** `sp_secretary, sp_presiding_officer, auditor` unconditional; `sp_member` committee-scoped.

**Deliverables:**

- `apps/web/src/pages/documents/ComplaintsListPage.tsx`
- Route registration: `/complaints`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] **Real procedure name is `listAllComplaints`, not `complaints.listAll`** — F1 §8.3 uses the latter name; it does not exist. Call `trpc.documents.listAllComplaints.useQuery(...)` — confirm the actual router mount path (whether it's namespaced under `documents.*` or exposed as a top-level `complaints.*` router in the combined app router) by checking `apps/server/src/modules/documents/documents.app.router.ts`, since `complaints.router.ts`'s procedures are defined in isolation and this task list did not verify their final mount point this session.
- [ ] Input: `PaginationInputSchema` (check `@batac/shared/schemas/common` for its exact shape — not independently re-verified in this session beyond confirming it's imported) extended with `{ outcomeState?: 'pending_hearing' | 'received_seen' | 'dismissed' | 'resolved' }`.
- [ ] Output: `{ items: Array<{ complaintId, subjectMatter, outcomeState, assignedOfficeId, createdAt }>, nextCursor }`.
- [ ] `sp_member` callers see only complaints where `assignedOfficeId` is in their own `committeeIds` — this filtering is entirely server-side; the frontend doesn't need its own committee-scoping logic, just render whatever the query returns.

**AI Prompt:**

> Build `ComplaintsListPage.tsx`: a paginated table of complaints with an `outcomeState` filter dropdown. Before writing the `trpc.*` call, check `apps/server/src/modules/documents/documents.app.router.ts` to confirm exactly how `complaints.router.ts`'s procedures are mounted in the final combined router (the procedure is internally named `listAllComplaints`, but its client-facing path depends on how the parent router nests it — this wasn't independently confirmed this session, so verify before writing the query call). Render `outcomeState` using the `StatusBadge` domain component if its variant set covers these four states, otherwise a plain badge is fine. Link each row to `/complaints/:complaintId` (built in TASK-FE-DOCS-003 below, which depends on TASK-PRE-01).

---

### TASK-FE-DOCS-002 — `/complaints/new` (ComplaintIntakeClerkAssistedPage)

**Role:** `sp_secretary` only.

**Deliverables:**

- `apps/web/src/pages/documents/ComplaintIntakeClerkAssistedPage.tsx`
- Route registration: `/complaints/new` (register before `/complaints/:complaintId` in `main.tsx`'s route array, matching the existing static-before-dynamic convention already used for `/documents/new` vs `/documents/:documentId`).

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Calls `createComplaintClerkAssisted` (real name — not `complaints.createClerkAssisted` as F1 states). Input: `{ complainantName, complainantAddress?, complainantContact?, subjectCategory, incidentNarrative, respondentName?, respondentEmail?, respondentPhone? }`.
- [ ] On success (`{ complaintId }`), navigate to `/complaints/:complaintId` using the returned ID.
- [ ] This is the in-person, clerk-assisted intake mode only — do not build any citizen-facing self-submission UI here; that's REST, lives under `/apps/portal`, and is out of scope until the PORTAL module is built.

**AI Prompt:**

> Build a form matching `createComplaintClerkAssisted`'s exact input fields. `complainantName`, `subjectCategory`, and `incidentNarrative` are required (`min(1)`); the rest are optional. `respondentEmail` needs email format validation client-side to match the Zod `.email()` constraint before submission (not strictly required since the backend validates too, but a client-side check gives faster feedback). On success, navigate to the new complaint's detail page using the returned `complaintId`.

---

### TASK-FE-DOCS-003 — `/complaints/:complaintId` (ComplaintDetailPage)

**Tier 0 dependency: TASK-PRE-01 must land first — this page cannot be built correctly without `complaints.get` existing.**

**Role:** `sp_secretary` (log and assign, set outcome), `sp_member` (committee-scoped report entry), `sp_presiding_officer`/`auditor` (read).

**Deliverables:**

- `apps/web/src/pages/documents/ComplaintDetailPage.tsx`
- Route registration: `/complaints/:complaintId`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Read via the new `complaints.get` (or wherever TASK-PRE-01 mounts it) — do not build this page against client-side filtering of `listAllComplaints`'s already-loaded result; ADR-UI-005 explicitly rejected that approach for exactly this page, and TASK-PRE-01 exists to give this page a real single-record read.
- [ ] `logAndAssign` mutation (`{ complaintId, assignedOfficeId, routingNotes? }`, `sp_secretary` only).
- [ ] `enterCommitteeReport` mutation (`{ complaintId, reportText }`) — callable by `sp_secretary` unconditionally, or by `sp_member` only if `metadata.assignedOfficeId` is in their `committeeIds` (same condition TASK-PRE-01's `get` procedure reuses — the detail page's own visibility and this mutation's writability use the identical committee-membership check, so an `sp_member` who can see this page via `get` can also submit a report on it).
- [ ] `setOutcome` mutation (`{ complaintId, outcome: 'dismissed' | 'resolved', notifyRespondentVia: 'contact_number' | 'email' }`, `sp_secretary` only). This mutation also emits an event bus signal (`complaint.outcome_set`) and an audit log entry server-side — no frontend action needed for either, just be aware the mutation does more than update the record.
- [ ] Per-action role gating on this page should mirror `DocumentDetailPage.tsx`'s existing local `hasRole(roles, ...allowed)` helper pattern (per the fe-handoff doc's noted convention) rather than one page-level gate — this page needs several fine-grained gates (log-and-assign vs. enter-report vs. set-outcome each have different allowed callers), the same situation `DocumentDetailPage` already solved.

**AI Prompt:**

> Build `ComplaintDetailPage.tsx` using the new `complaints.get` procedure from TASK-PRE-01 as the primary read. Structure per-action visibility using the same local `hasRole(roles, ...allowed)` helper pattern already established in `apps/web/src/pages/documents/DocumentDetailPage.tsx` — check that file for the exact helper shape before reimplementing your own version, since the fe-handoff doc notes a second real consumer of this pattern (this page) is a natural point to extract it to a shared `apps/web/src/lib/auth-helpers.ts`, if that seems warranted once you're in the code.
>
> Three write actions, three different caller sets: `logAndAssign` (sp_secretary only), `enterCommitteeReport` (sp_secretary unconditionally, sp_member only if their committeeIds include the complaint's assignedOfficeId — check this client-side to decide whether to even show the control, but rely on the server's own enforcement as the real gate), `setOutcome` (sp_secretary only, and only sensible once a committee report exists — check `committeeReport` isn't empty before enabling this control, though the backend doesn't itself enforce that ordering as a precondition per this session's read of `setOutcome`'s implementation).

---

### TASK-FE-DOCS-004 — `/document-requests` (DocumentRequestsListPage)

**Role:** `sp_secretary, sp_presiding_officer, records_officer, auditor`.

**Deliverables:**

- `apps/web/src/pages/documents/DocumentRequestsListPage.tsx`
- Route registration: `/document-requests`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] **Real procedure name is `listAllDocumentRequests`, not `documentRequests.listAll`.**
- [ ] Input: `PaginationInputSchema.extend({ requesterName?: string, documentNumber?: string })` — two optional text filters, both doing `ILIKE`-style matching server-side.
- [ ] Output: `{ items: Array<{ requestId, title, requesterName, lifecycleState, vmApproved, spApproved, accessMode, createdAt }>, nextCursor }`.
- [ ] `vmApproved`/`spApproved` are the Phase-1-stub dual-approval tracking fields (see TASK-FE-DOCS-006's notes below) — render them as a simple two-step progress indicator (e.g., two checkmarks) rather than anything implying a formal workflow-engine step sequence, since under the hood they're just JSONB booleans right now.

**AI Prompt:**

> Build `DocumentRequestsListPage.tsx`, structurally identical to `ComplaintsListPage` (TASK-FE-DOCS-001) — same list/filter/link-to-detail shape, different fields. Filters are `requesterName` and `documentNumber`, both free-text partial-match. Show `vmApproved`/`spApproved` as a simple two-checkmark approval-progress indicator.

---

### TASK-FE-DOCS-005 — `/document-requests/new` (DocumentRequestIntakeClerkAssistedPage)

**Role:** `sp_secretary` only.

**Deliverables:**

- `apps/web/src/pages/documents/DocumentRequestIntakeClerkAssistedPage.tsx`
- Route registration: `/document-requests/new` (before the `:requestId` dynamic route).

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Calls `createDocumentRequestClerkAssisted` (real name — not `documentRequests.createClerkAssisted`). Input: `{ requesterName, requesterContact?, documentsRequested: Array<{ documentTitle, documentNumber? }> (min 1 item), purpose? }`.
- [ ] `documentsRequested` needs a repeatable field group UI (add/remove rows) since it's a min-1 array, not a single object.
- [ ] `generatePrintableForm` (`{ requestId }`, `sp_secretary` only, query not mutation) — offer a "print" action once a request exists (post-creation, or from the list/detail pages) that calls this and renders its returned structured data (`requestId, title, lifecycleState, createdAt, requester, documentsRequested, purpose, accessMode, payment, notificationChannel`) in a print-friendly layout. **This procedure returns data for the frontend to render, it does not generate a PDF itself** — actual PDF rendering is explicitly out of Phase 1 scope per the procedure's own code comment.

**AI Prompt:**

> Build the intake form with a repeatable `documentsRequested` field group (title + optional document number per row, at least one row required). On success (`{ requestId }`), navigate to the new request's detail page. Separately, build (here or reusable from the detail page) a "print" view that calls `generatePrintableForm` and renders the structured data it returns in a clean, printable layout — remember this procedure hands back data, not a PDF; the print layout itself is the frontend's job.

---

### TASK-FE-DOCS-006 — `/document-requests/:requestId` (DocumentRequestDetailPage)

**Tier 0 dependency: TASK-PRE-01 must land first — this page cannot be built correctly without `documentRequests.get` existing.**

**Role:** `sp_presiding_officer` (first approval), `sp_secretary` (second approval, then release).

**Deliverables:**

- `apps/web/src/pages/documents/DocumentRequestDetailPage.tsx`
- Route registration: `/document-requests/:requestId`.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Read via the new `documentRequests.get` from TASK-PRE-01.
- [ ] `approveAsPresidingOfficer` (`{ requestId }`, `sp_presiding_officer` only) — only meaningful while `lifecycleState` is in `{'draft', 'submitted', 'in_workflow', 'pending_mayor_action'}` (the `PRE_RELEASE_STATES` set); disable this control once the record has moved past that, matching the backend's own guard (`BAD_REQUEST` if attempted outside these states).
- [ ] `approveAsSecretary` (`{ requestId }`, `sp_secretary` only) — check the backend's actual precondition (whether it requires `vmApproved` to already be true) by reading the procedure's full body before assuming an ordering; this task list read `approveAsPresidingOfficer` in full but only partially confirmed `approveAsSecretary`'s exact precondition logic this session.
- [ ] `releaseCopy` (`{ requestId, orNumber?, collectingOfficer?, amountPaid? }`, `sp_secretary` only) — **hard backend precondition:** only allowed when `lifecycleState === 'completed'` (both approvals done), returns `BAD_REQUEST` otherwise with a message naming the actual current state. All three payment fields are optional — **payment does not block release in Phase 1** (explicit code comment, "Q-D04" — payment system is deferred to Phase 2), so build the release action to work with zero payment fields filled in, with payment details as a genuinely optional add-on, not a gate.
- [ ] **Heads-up, not a blocker:** this entire router is explicitly marked "Phase 1 stub" in its own file header — the dual-approval tracking (`vm_approved`/`sp_approved`) is temporary JSONB metadata standing in for real Workflow Engine step instances, with `TODO(WF-INTEGRATION)` comments on both approval procedures marking this for replacement once WF integration lands. This is invisible to the frontend contract (the procedures work correctly as-is, with real role gates and real state transitions) — build against the current procedures normally; this note is context for why the underlying implementation looks the way it does, not something the frontend needs to work around.

**AI Prompt:**

> Build `DocumentRequestDetailPage.tsx` using `documentRequests.get` (TASK-PRE-01) as the primary read. Two sequential approval actions (`approveAsPresidingOfficer`, then `approveAsSecretary`) followed by `releaseCopy`. Before building `approveAsSecretary`'s enable/disable logic, read that procedure's full body in `apps/server/src/modules/documents/document-requests.router.ts` (starting around line 335) to confirm whether it actually requires `vm_approved` to be true first — this task list confirmed `approveAsPresidingOfficer`'s precondition logic in full but did not fully re-verify `approveAsSecretary`'s specific precondition check this session, so don't assume without checking.
>
> `releaseCopy`'s payment fields (`orNumber`, `collectingOfficer`, `amountPaid`) are all optional and must not block the release action if left empty — the code comment is explicit that payment is deferred to Phase 2 and does not gate release in Phase 1. Build the release button enabled whenever `lifecycleState === 'completed'`, regardless of whether any payment field has been filled in.

---

## TASK-WF-FE-004

```
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-FE-004, a new standalone frontend task with no
existing entry in fe.md's Tier 0-5 sections — all of which are closed (every
task in fe.md's own ToC has a corresponding built file, confirmed by direct
repo listing this session: apps/web/src/pages/ contains dev/, documents/,
iam/, organization/, sysadmin/, workflow/, all matching fe.md's deliverables
exactly). This follows the same "standalone document after the existing task
list closed" precedent TASK-WF-FE-001 established.

Read AGENTS.md before doing anything else if you have not already
internalized it this session. The applicable routing row is "Build a frontend
page or view in /apps/web" → F4 → F1 → F5 → J6 → I2 → E1. This task ALSO
touches "Write a Zustand store" (F2 → F1 → E3) because of the AppShell-wiring
work below — read the union of both rows per AGENTS.md Section 2's
instruction for multi-row tasks, though in practice the Zustand store
(useLayoutStore) already exists and needs no new design, just consumption.

Before starting, check docs/development-findings-log.md for any entries
tagged F1, F5, auth-context, or AppShell since this prompt was written — this
session's read ended at LOG-0094. This prompt introduces a new entry,
LOG-0095, for the ADR-UI-012/auth-context.tsx architecture question raised
below — check whether it has moved from `proposed` to `confirmed` before
starting, since that resolution changes this task's scope (see the
"Open architecture question" section).

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS — VERIFIED GAP, NOT SPECULATION

F1 (docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md)
was read in full this session — Sections 1-4 (notation, cross-cutting notes,
route hierarchy diagram, master route table) and Section 16 ("Items
considered and not given a dedicated route") specifically. Neither the master
route table (Section 4, every row checked) nor the route hierarchy Mermaid
diagram (Section 3) contains a row or node for `/` or `/login` in
`/apps/web`. Section 16 lists exactly four items deliberately excluded from a
dedicated route (generic account settings, a notifications inbox, Phase 1B
document types, Phase 2 reporting) — root and login are not among them. This
is a genuine, unflagged specification gap, not a documented exclusion.

Separately confirmed via direct repo inspection this session:
- apps/web/src/main.tsx line 56: the "/" route's element is the literal JSX
  `<div>Batac DMS Home</div>` — a placeholder, not a component import.
- No "/login" path exists anywhere in main.tsx's route array (confirmed by
  full read of the file, 254 lines).
- No wildcard/catch-all route (`path: "*"`) exists anywhere in main.tsx.
- apps/web/src/lib/auth-context.tsx already exports a working `useAuth()`
  hook with `session`, `login(username, password)`, `logout()`, `refresh()`
  — all four already correctly calling real backend endpoints (confirmed
  directly against apps/server/src/modules/iam/iam.routes.ts: POST
  /api/auth/login, /api/auth/refresh, /api/auth/logout all real, working,
  rate-limited, cookie-based). This hook has no consumer anywhere in
  apps/web/src/pages/ — confirmed via repo-wide grep for `useAuth()` outside
  the file itself; every existing page that imports useAuth() (e.g.
  DocumentDetailPage.tsx) uses only `session` for role-gating, never `login`
  or `logout`.

This task does not invent new backend work — the entire auth flow already
works. This task is exclusively about the two missing frontend routes that
call it.

────────────────────────────────────────────────────────────────────────────
WHAT TO BUILD — TWO COMPONENTS, TWO ROUTES

Component: `LoginPage`
Route: `/login`
New file: apps/web/src/pages/auth/LoginPage.tsx
(new directory: apps/web/src/pages/auth/ — no auth/ directory exists yet;
create it, following the same lowercase-module-name convention as documents/,
workflow/, organization/, sysadmin/)

Component: `HomePage`
Route: `/` (replacing the current placeholder div)
New file: apps/web/src/pages/HomePage.tsx
(top-level pages/ file, not in a subdirectory — this page has no natural
module home; DO NOT create a home/ directory for a single file)

────────────────────────────────────────────────────────────────────────────
LOGINPAGE — DATA CONTRACT

Calls `useAuth().login(username, password)` from the existing auth-context.tsx
— do not write a new fetch call or duplicate the PKCE/cookie logic already
inside that hook. This is a thin form wrapping an existing, working function.

Real input shape (confirmed, apps/server/src/modules/iam/iam.schemas.ts
lines 8-14, LoginInputSchema): `{ username: string (min 1), password: string
(min 1), code_verifier, code_challenge, code_challenge_method: 'S256' }`. The
last three fields are already generated and attached inside `login()` itself
(auth-context.tsx lines 62-74, calls `generatePkcePair()` from
apps/web/src/lib/pkce.ts) — LoginPage's form only needs to collect `username`
and `password` and call `login(username, password)`. Do not re-implement
PKCE generation in the page component.

ERROR HANDLING — confirmed real error shapes from iam.routes.ts's actual
implementation (lines 107-134), not guessed:
- Invalid credentials: backend returns 401 `{ code: 'INVALID_CREDENTIALS' }`.
  auth-context.tsx's current `login()` implementation only checks
  `response.ok` and throws a generic `new Error('Login failed')` on any
  non-2xx (line 78) — it does NOT currently surface the specific `code`
  field from the response body. Build LoginPage's error display against
  what `login()` actually throws today (a generic Error with message "Login
  failed") rather than assuming the specific INVALID_CREDENTIALS/
  TOO_MANY_REQUESTS/VALIDATION_ERROR codes are available to the frontend —
  they are not, currently. If you want more specific error messages
  (e.g. distinguishing "wrong password" from "rate limited"), that requires
  first modifying auth-context.tsx's `login()` to parse and rethrow the
  response body's `code` field — a small, in-scope change to make as part of
  this task if you choose to build specific error UI, but state explicitly
  in your PR description whether you did this or built against the generic
  error only.
- Rate limiting: real, confirmed 5 requests / 15 minutes per IP
  (iam.routes.ts lines 74-79). A real user mistyping their password five
  times will hit this. If you do the auth-context.tsx enhancement above,
  surface the 429 case distinctly (e.g. "Too many attempts — try again in a
  few minutes") rather than a generic failure message, since a generic
  "login failed" message on the 6th attempt would be actively misleading.

ON SUCCESS: `login()` sets `session` in the auth context (auth-context.tsx
line 84, `setSession(data)`). Once `session` is populated, navigate to `/`
(the new HomePage from this same task) via `useNavigate()` from
react-router-dom — do not navigate to a role-specific dashboard directly from
LoginPage; that routing decision belongs to HomePage (see below), keeping
LoginPage's own responsibility narrow (authenticate, then hand off).

SESSION-ALREADY-EXISTS CASE: if a user with a valid, unexpired session
navigates directly to /login (e.g. via back-button or a stale bookmark),
redirect them to `/` immediately rather than showing the login form again —
check `session` from `useAuth()` on mount; if non-null, `<Navigate to="/"
replace />` before rendering the form. This avoids a confusing
already-logged-in-but-seeing-a-login-form state.

────────────────────────────────────────────────────────────────────────────
HOMEPAGE — ROLE-BASED LANDING REDIRECT, NOT A NEW DASHBOARD

Do NOT build new dashboard content here. Four role-specific dashboards
already exist and are fully built: SecretaryDashboardPage (/secretary),
MayorDashboardPage (/mayor), SystemAdminHomePage (/sysadmin), and — per F1's
master route table — PlatformAdminHomePage is named at `/admin` but does NOT
appear to exist as a built file (confirmed: no PlatformAdminHomePage.tsx
anywhere in apps/web/src/pages/, and no "/admin" entry in main.tsx's route
array, only "/admin/committees" and "/admin/roles" — the parent landing
shell itself is missing). This is a second, smaller gap this task does NOT
fix — HomePage should treat plat_admin users as a case with no dedicated
landing page yet (see fallback behavior below) rather than linking to a
route that doesn't exist. Flag this second gap explicitly in your PR
description as a follow-up (a natural candidate task: TASK-FE-ORG-003 or
similar, out of scope here).

WHAT HOMEPAGE SHOULD DO:
1. Check `session` from `useAuth()`. If null, this page should not normally
   be reachable (see route-guard note below) — but as a defensive fallback,
   redirect to `/login` if session is null on mount.
2. If session exists, inspect `session.roleCodes` (confirmed field,
   AuthSession interface, auth-context.tsx line 20) and redirect to the
   single most relevant landing page for that role:
   - `sp_secretary` → `/secretary`
   - `mayor` → `/mayor`
   - `sys_admin` → `/sysadmin`
   - all other roles (records_officer, dept_encoder, dept_approver, sp_member,
     sp_presiding_officer, brgy_encoder, brgy_captain, auditor, plat_admin,
     citizen) → no dedicated dashboard exists for any of these roles as of
     this session's verification. Do not guess a redirect target. Render a
     minimal generic landing view instead (see below) rather than picking an
     arbitrary existing page to redirect to.
3. A user can hold multiple roles simultaneously (confirmed:
   `roleCodes: string[]`, plural, not a single role) — if a session's
   roleCodes contains more than one of the three redirect-target roles above
   (e.g. someone is both sp_secretary and mayor, however unlikely in
   practice), pick a deterministic priority order and document it in a code
   comment (recommendation: mayor > sp_secretary > sys_admin, executive
   authority first, but this is your call to make and state explicitly, not
   a settled rule from any source document).

GENERIC LANDING VIEW (for roles with no dedicated dashboard): a minimal page
using the existing `PageHeader` component (@batac/ui, already used
throughout the codebase) with a title along the lines of "Batac DMS" and a
short set of links to routes that role can actually access. Use
`session.roleCodes` to decide which links to show — e.g. a records_officer
should see a link to /documents but not /admin/roles. Cross-reference each
target route's role gate against F1's master route table (Section 4, already
read in full this session) or, more reliably, against the route's own
component file's actual role-check logic, since several of fe.md's existing
tasks note the codebase's role lists don't always match F1's prose exactly.
Do not build this as an elaborate dashboard — it is a fallback for roles
that don't have one yet, not a new feature to over-invest in.

DO NOT hardcode a redirect priority that silently drops a role a session
actually has — if you build the three-role redirect above and a session has
none of those three, the generic landing view is the correct behavior, not
an error state or a blank page.

────────────────────────────────────────────────────────────────────────────
ROUTE GUARD — GENUINELY OPEN, YOUR DESIGN CHOICE TO MAKE

No route-guarding wrapper exists anywhere in this codebase currently
(confirmed: every route in main.tsx is a bare path/element pair, same
finding TASK-WF-FE-001 made for its own route and never contradicted since).
Every existing page does its OWN internal role-gating after rendering
(DocumentDetailPage.tsx's local hasRole pattern, referenced throughout
fe.md's other tasks) — but none of them check whether `session` is non-null
at all before attempting to render. A logged-out user navigating directly to
/documents today would see the page attempt to load with `session === null`,
and downstream behavior depends entirely on how each individual page happens
to handle that (not verified uniformly across all 22 existing pages this
session — out of scope to audit every one here).

This task does not require auditing or fixing every existing page's
null-session behavior — that is a larger, separate undertaking. This task
DOES require building a single reusable guard for LoginPage and HomePage's
own correctness (LoginPage should redirect away if already authenticated;
HomePage should redirect to /login if not). Two honest options:

- (a) A small `<RequireAuth>` wrapper component
  (apps/web/src/components/RequireAuth.tsx or similar), checking
  `useAuth().session`, rendering `<Navigate to="/login" replace />` when
  null, otherwise rendering `children`. Wrap it around HomePage's route
  definition in main.tsx. This is the natural foundation for eventually
  wrapping every authenticated route, though doing so for all 22 existing
  routes is explicitly OUT OF SCOPE for this task — build the wrapper, apply
  it to HomePage only (and optionally the reverse-guard on LoginPage), and
  leave a code comment noting it's intended to be the shared pattern for
  future route-guarding work.
- (b) Inline the check directly inside HomePage/LoginPage's own component
  bodies (matching the existing per-page-responsibility convention).

Pick one and state your reasoning in your PR description — this codebase
doesn't yet have a settled answer, and this task is a reasonable point to
start one, but forcing a full retrofit of all existing routes is scope
creep beyond what this task needs.

────────────────────────────────────────────────────────────────────────────
ROUTE REGISTRATION

apps/web/src/main.tsx:
1. Replace the existing `{ path: "/", element: <div>Batac DMS Home</div> }`
   entry with `{ path: "/", element: <HomePage /> }` (or wrapped in your
   chosen guard from above).
2. Add `{ path: "/login", element: <LoginPage /> }` — register it before
   "/" in the array for readability (not load-bearing for routing
   correctness, React Router v6 doesn't require path-order for non-nested
   static routes, but matches this file's general top-of-file convention for
   entry-point-adjacent routes).
3. Add a wildcard fallback: `{ path: "*", element: <NotFoundPage /> }` at
   the END of the route array. This requires a third new small component,
   apps/web/src/pages/NotFoundPage.tsx — a minimal "page not found" view
   with a link back to `/`. This wasn't originally scoped in this task's
   title but is a natural, small companion gap (confirmed zero wildcard
   route exists anywhere) — build it, it's a five-minute addition once
   you're already touching main.tsx's route array, not a separate task
   worth its own overhead.

────────────────────────────────────────────────────────────────────────────
OPEN ARCHITECTURE QUESTION — DO NOT SILENTLY RESOLVE

ADR-UI-012 (docs/pre-development/F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-012-session-store-rolecodes-shape.md,
read in full, Status: Accepted) mandates a Zustand `useSessionStore` with an
`isHydrated: false | true` state specifically so route guards "don't flash
an incorrect redirect" (ADR's own rationale, point 1). The actual codebase
uses `auth-context.tsx`'s React Context instead — no `useSessionStore`, no
`isHydrated` flag, exists anywhere (confirmed via repo-wide grep, zero
matches for either term outside this ADR document itself). The findings log
was checked in full this session (72 entries, LOG-0001 through LOG-0094) —
no entry addresses this discrepancy.

This matters concretely for THIS task: `auth-context.tsx`'s `refresh()` is
called once on mount (line 100, `useEffect(() => { void refresh(); },
[refresh])`) to silently restore a session after a page reload, but there is
no exposed "is this restoration attempt still in flight" boolean — `session`
starts as `null` and either stays `null` (not logged in) or becomes populated
(logged in), with no third state distinguishing "haven't checked yet" from
"checked, and you're logged out." This means HomePage's route guard, built
naively, WILL flash a redirect to /login on every page reload for an
actually-logged-in user, for the brief window before the silent refresh
resolves — exactly the bug ADR-UI-012 says its `isHydrated` flag exists to
prevent.

Two honest paths, and this task should NOT pick one unilaterally:
1. **Minimal, in-scope-only fix:** add a local `isLoading`/similar boolean to
   auth-context.tsx itself (not a full Zustand migration), set true until
   the initial `refresh()` call resolves, and have your route guard check
   that boolean before deciding to redirect. This is a small, contained
   change to an existing file, directly needed for this task's own
   correctness, and does not require resolving the larger
   Context-vs-Zustand architecture question.
2. **Larger, explicitly out-of-scope fix:** migrate auth-context.tsx to a
   genuine `useSessionStore` Zustand store matching ADR-UI-012/F2 §5's full
   spec. This is a real, separate undertaking — every existing page that
   currently calls `useAuth()` (confirmed multiple consumers via grep) would
   need updating, and F2 itself hasn't been read in full this session to
   scope that migration properly. DO NOT attempt this as part of TASK-WF-FE-004.

Implement path 1 (the minimal fix) as part of this task — it's necessary for
HomePage/LoginPage to work correctly regardless of the larger question. Do
NOT attempt path 2. Append a findings-log entry (LOG-0095, verify this is
still the next free number when you actually write it — do not trust the
number quoted here without checking the log's current tail yourself) stating
plainly that auth-context.tsx's Context pattern has diverged from ADR-UI-012's
Zustand mandate, that this task applied only the minimal in-scope fix, and
that the larger reconciliation is a decision for a human to make, not
something this task resolved. Label it `status: proposed`, per every other
agent-authored entry in this log.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- PlatformAdminHomePage / the missing `/admin` landing shell — a separate,
  smaller gap, flagged above for a future task, not built here.
- Auditing or retrofitting all 22 existing routes with the RequireAuth guard
  — apply it only to the two new routes this task adds.
- The full useSessionStore Zustand migration — explicitly deferred, see
  above.
- Any change to iam.routes.ts, iam.service.ts, or any backend file — the
  entire backend auth flow already works correctly; this task is
  frontend-only.
- "Remember me" / persistent-login checkboxes, password-reset flows, MFA
  entry UI (session.user.mfaEnabled exists as a field but no MFA challenge
  flow is specified anywhere in the source documents reviewed this session)
  — none of these are in scope; build a plain username/password form only.
- The /api/auth/unlock and /api/auth/lock endpoints (confirmed real,
  iam.routes.ts lines 278-407) — these back a session-lock/re-auth flow with
  no corresponding frontend page or context method anywhere (auth-context.tsx
  exposes no `lock`/`unlock` functions). This is a separate, real gap, but
  distinct from plain login — flag it in your PR description as a further
  follow-up candidate, do not attempt to build it here.

────────────────────────────────────────────────────────────────────────────
DELIVERABLE CHECKLIST

1. New directory apps/web/src/pages/auth/
2. apps/web/src/pages/auth/LoginPage.tsx — username/password form calling
   the existing useAuth().login(), generic error display (or enhanced error
   display if you also modify auth-context.tsx's login() to surface response
   codes — your choice, state it), already-authenticated redirect to /.
3. apps/web/src/pages/HomePage.tsx — role-based redirect to /secretary,
   /mayor, or /sysadmin per session.roleCodes with a documented priority
   order for multi-role sessions, generic landing view fallback for all
   other roles, not-authenticated redirect to /login.
4. apps/web/src/pages/NotFoundPage.tsx — minimal 404 view.
5. A route guard (RequireAuth wrapper or inline checks — your choice,
   documented) applied to the two new routes.
6. A minimal isLoading/hydration-tracking addition to auth-context.tsx (the
   "minimal fix" from the Open Architecture Question section) — necessary
   for the route guard to not flash-redirect on reload.
7. Three new route registrations in main.tsx: "/login", updated "/", and a
   wildcard "*" fallback.
8. A findings-log entry (LOG-0095 or the actual next free number — verify
   before writing) documenting the ADR-UI-012/auth-context.tsx divergence,
   status: proposed.
9. State explicitly in your PR description: (a) which route-guard approach
   you chose and why; (b) whether you enhanced auth-context.tsx's error
   surfacing beyond the generic "Login failed" message; (c) confirmation you
   did not touch any backend file; (d) the multi-role redirect priority
   order you chose for HomePage; (e) explicit flagging of the two follow-up
   gaps noted above (missing PlatformAdminHomePage/`/admin` shell, and the
   unbuilt lock/unlock session flow) as candidates for future tasks, not
   silently dropped.
```

---

## TASK-WF-FE-005

````
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-FE-005, a new standalone frontend task. Read
AGENTS.md before doing anything else if you have not already internalized it
this session. The applicable routing row is "Build a frontend page or view
in /apps/web" → F4 → F1 → F5 → J6 → I2 → E1, plus "Write a Zustand store"
(F2 → F1 → E3) since this task consumes an existing Zustand store
(useLayoutStore) though it does not design a new one.

Sequencing note: this task is independent of TASK-WF-FE-004 (LoginPage/
HomePage) and can be built in either order or in parallel — it does not
depend on either of that task's new routes. It DOES touch main.tsx's route
array, the same file TASK-WF-FE-004 touches, so if both are being worked in
parallel by different agents, coordinate on merge order to avoid a
conflicting main.tsx diff — not a design dependency, a mechanical one.

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS — VERIFIED GAP

F5 (docs/pre-development/F-frontend-architecture/f5-ui-component-library-setup-and-package-architecture.md,
§4.3 Tier 3, lines 520-608, read in full) specifies three components —
AppShell, Sidebar, Topbar — plus PageHeader, with AppShell's own description
stating plainly: "Persistent layout frame for ALL authenticated views in
apps/web." All three are confirmed fully built and correctly exported:
`export * from './components/domain/AppShell'` (and Sidebar, Topbar,
PageHeader) all present in packages/ui/src/index.ts lines 37-40, confirmed
by direct read. A working dev showcase exists and renders correctly:
apps/web/src/pages/dev/AppShellPage.tsx, registered at
/dev/components/app-shell.

apps/web/src/stores/layout.store.ts also exists, fully implemented, matching
F5's exact spec for what should drive AppShell's sidebarCollapsed prop
(useLayoutStore, Zustand, persisted to localStorage under key
"batac-dms:layout", confirmed by direct read).

**Neither is used by a single real page.** Confirmed via repo-wide grep this
session: `grep -rl "AppShell" apps/web/src/pages/` returns only the dev/
directory. `grep -rl "useLayoutStore" apps/web/src/` returns only the store's
own definition file — zero consumers anywhere, not even the dev showcase
page (which uses local useState instead, per direct read of
AppShellPage.tsx lines 27, 36). Every one of the 22 real, already-built pages
in apps/web/src/pages/ (documents/, workflow/, organization/, iam/,
sysadmin/) renders as a standalone content block with no shared sidebar,
topbar, or navigation — confirmed by direct read of OrganizationPage.tsx's
imports (PageHeader, Card, Dialog, etc. from @batac/ui — no AppShell,
Sidebar, or Topbar) as a representative sample, and no contradicting example
found in a broader scan of the same import block pattern across the other
21 page files.

This is the single largest concrete gap behind what your prompt described as
"the main pages/components are already made, we just need to complete it" —
the components ARE made, genuinely, to spec, and correctly. They were simply
never assembled into the app frame that wraps the real pages.

────────────────────────────────────────────────────────────────────────────
WHAT TO BUILD

Component: `AuthenticatedLayout`
New file: apps/web/src/components/AuthenticatedLayout.tsx
(new directory: apps/web/src/components/ — confirmed no such directory
exists yet in apps/web/src at the time of this session's exploration, only
pages/, hooks/, lib/, stores/, types/, config/. This is the natural home for
a cross-cutting layout wrapper that isn't itself a routed page — do not put
it under pages/, since it is not a route target itself.)

This is a composing wrapper, not a new visual design — it assembles the
already-built AppShell + Sidebar + Topbar using real session data and real
navigation state, and is meant to wrap every authenticated route via
React Router's nested-route / Outlet pattern.

────────────────────────────────────────────────────────────────────────────
DATA WIRING — EXACT PROP SOURCES, VERIFIED

`sidebarCollapsed` / `onSidebarToggle`: from `useLayoutStore()` — confirmed
shape `{ sidebarCollapsed: boolean, toggleSidebar: () => void,
setSidebarCollapsed: (collapsed: boolean) => void }` (layout.store.ts,
already read in full this session). Use `toggleSidebar` directly as
`onSidebarToggle`.

`currentUser` (shared `SidebarUser` type per F5's spec, `{ name: string,
role: string }`): F5 states this type "should be defined once in
packages/ui/src/components/domain/types.ts" — check whether it already is
(not independently verified this session; check before assuming) and import
it rather than redeclaring locally if it exists.

**Genuinely open, not resolved by any source document checked this
session:** `AuthSession` (auth-context.tsx) has no `name` field at all —
only `user: { id, username, email, cityId, status, mfaEnabled, createdAt,
updatedAt }` and a separate top-level `roleCodes: string[]`. There is no
single human-readable "display name" anywhere in the session shape, and
`roleCodes` is a plural array of role code strings (e.g. 'sp_secretary'),
not a single human-readable role label (e.g. "SP Secretary"). You will need
to make two small mapping decisions:
1. What to show for `SidebarUser.name` — `session.user.username` is the only
   candidate field that exists today. Use it. Do not invent a display-name
   field on the backend as part of this task; that's a separate, larger
   change (would need a new column and a login-response schema change, well
   beyond this task's scope) — flag it in your PR description as a
   possible future enhancement, but ship against `username` for now.
2. What to show for `SidebarUser.role` when `roleCodes` may contain more
   than one code — build a small local role-code-to-label lookup (e.g.
   'sp_secretary' → "SP Secretary", matching the readable names already
   used in F1 §2.2's role reference table, which you should cross-reference
   for the exact 13 label strings rather than inventing your own wording)
   and, for multi-role sessions, pick the first matching role in the same
   priority order you establish in TASK-WF-FE-004 for HomePage's redirect
   logic if that task has already landed (mayor > sp_secretary > sys_admin >
   ...), or a reasonable default ordering of your own if it hasn't — state
   your choice explicitly either way.

`onUserMenuAction`: Topbar's real prop signature accepts
`(action: 'profile' | 'logout') => void` (F5 spec, confirmed). Wire
`'logout'` to `useAuth().logout()` directly — this already works, already
calls the real backend endpoint, already clears the session. Wire
`'profile'` to... nothing meaningful currently exists to navigate to (no
account-settings page exists — confirmed, and F1 §16 explicitly, deliberately
excludes one: "Generic account settings / profile management ... no named F1
view covers this"). Do not build a fake destination for 'profile' — either
omit the action from the menu, disable it with a "coming soon" affordance,
or make it a no-op with a code comment explaining why; your choice, but do
not silently navigate somewhere incorrect.

`breadcrumbs` (Topbar prop, `BreadcrumbItem[]`): genuinely the hardest part
of this task to get right generically, because breadcrumbs are inherently
per-route, not a single fixed value AuthenticatedLayout can hardcode once.
Two honest approaches:
- (a) A route-to-breadcrumb-label lookup table maintained inside
  AuthenticatedLayout itself (or a colocated file), keyed by pathname,
  checked against `useLocation()` from react-router-dom. Simple to build,
  but every new route added in the future requires remembering to add an
  entry here too — a real maintenance cost, worth naming explicitly.
- (b) Each individual page supplies its own breadcrumb trail via a small
  context or a route-data mechanism, with AuthenticatedLayout only rendering
  whatever the active page provides. More correct long-term, meaningfully
  more work, and touches every existing page file to add breadcrumb data —
  a much larger blast radius than this task's stated scope.
Given AppShell/Sidebar/Topbar wiring is already the primary deliverable
here, build option (a) — the lookup table — for this task. Cover, at
minimum, every route currently registered in main.tsx (confirmed 41 real
routes as of this session, not counting /dev/* showcase routes, which do
not need breadcrumbs since they're not part of the authenticated app
experience proper). Document in a code comment that this table needs a new
entry whenever a future route is added, and that option (b) is the more
scalable fix if this becomes a recurring maintenance burden — do not build
option (b) as part of this task.

────────────────────────────────────────────────────────────────────────────
SIDEBAR NAV ITEMS — ROLE-FILTERED, VERIFIED AGAINST REAL ROUTE GATES

Sidebar's `items: NavItem[]` prop needs a curated, not exhaustive, list —
not literally all 41 registered routes (many are detail/edit sub-routes like
/documents/:documentId that don't belong in persistent top-level nav; some,
like /complaints/new, are actions reached from within the /complaints list
page, not top-level destinations).

Build a nav item list covering the genuinely top-level destinations:
/documents, /workflow/steps, /order-of-business, /sessions, /complaints,
/document-requests, /organization, plus the role-specific dashboards
(/secretary, /mayor) and admin sections (/admin/committees, /admin/roles,
/sysadmin) — filtered per-session so a given user only sees items their role
can actually reach. Cross-reference each target route's ACTUAL role gate
(read the target page's own component file, not just F1's prose, since
several of this codebase's existing pages have role lists that diverge from
F1 in confirmed, documented ways — e.g. TASK-WF-FE-001's own finding that
F1/E1/I2 collectively omit `auditor` from a role list the live code
includes) before deciding whether to show a nav item to a given role.

This is real, non-trivial cross-referencing work across ~10 target pages'
actual role checks — budget real time for it rather than copying F1's
role table uncritically, given this codebase's own established pattern of
F1 prose sometimes lagging the live implementation.

────────────────────────────────────────────────────────────────────────────
WIRING INTO ROUTING — NESTED ROUTE PATTERN

main.tsx currently registers all routes as flat, independent path/element
pairs (confirmed, no nesting anywhere). To wrap authenticated pages in
AuthenticatedLayout without individually editing all 22+ existing page
components, use React Router v6's nested-route + `<Outlet />` pattern:

```tsx
// Inside AuthenticatedLayout.tsx
import { Outlet } from 'react-router-dom';
// ... AppShell wiring as described above ...
return (
  <AppShell ...>
    <Outlet />
  </AppShell>
);
```

Then in main.tsx, restructure the relevant routes as children of a single
parent route whose element is `<AuthenticatedLayout />`, rather than each
being a top-level sibling. This is a real, non-trivial restructuring of
main.tsx's route array — every existing authenticated route (all of them
except /login, once TASK-WF-FE-004 lands, and the /dev/* showcase routes,
which should NOT be wrapped in AuthenticatedLayout since they're
development-only tooling, not part of the real app chrome) moves from a
top-level entry to a nested child entry.

**Import statements do not need to change** — moving a route to be a nested
child of a parent route object doesn't change how its element is imported at
the top of the file, only where the `{ path, element }` pair sits inside the
`createBrowserRouter([...])` array structure.

**Do not restructure /dev/* routes into this nesting** — they're
intentionally standalone tooling pages outside the authenticated-user
experience, and AppShellPage itself already demonstrates AppShell usage on
its own terms as a dev showcase; wrapping it in the real
AuthenticatedLayout would be redundant and potentially confusing (a shell
inside a shell).

If TASK-WF-FE-004 has already landed by the time you do this work, `/` and
the new NotFoundPage's wildcard route should also be nested under
AuthenticatedLayout (both are post-login, authenticated-only experiences);
`/login` should NOT be (logging in happens before there's a session to
build a sidebar/topbar around). If TASK-WF-FE-004 has not yet landed, build
this task's nesting around the routes that currently exist, and leave a
code comment noting `/` and any future /login route need to be
slotted into the correct side of this nesting boundary once that task lands.

────────────────────────────────────────────────────────────────────────────
ROLE-GATING INTERACTION — DOES NOT REPLACE EXISTING PER-PAGE CHECKS

AuthenticatedLayout wrapping a route does NOT replace that page's own
internal role/session checks (e.g. DocumentDetailPage's local hasRole
pattern) — it only adds shared visual chrome around it. A page that
currently redirects or shows a FORBIDDEN state internally should continue
to do so exactly as before; AuthenticatedLayout's own responsibility is
narrowly the sidebar/topbar/nav-filtering described above, not a second,
duplicate authorization layer. Do not remove or weaken any existing page's
own role-gating as a side effect of this restructuring — this task changes
WHERE in the component tree a page renders (nested under a layout, instead
of standalone), not WHETHER it renders.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- A route guard checking for `session !== null` before rendering
  AuthenticatedLayout's children at all — that's TASK-WF-FE-004's scope
  (RequireAuth or equivalent), not this task's. This task assumes a session
  already exists by the time AuthenticatedLayout renders; if
  TASK-WF-FE-004 hasn't landed yet, a logged-out user reaching an
  AuthenticatedLayout-wrapped route today will see a sidebar/topbar built
  around a null session (SidebarUser fields would be undefined/empty) —
  a real but narrow rough edge, acceptable as an interim state until
  TASK-WF-FE-004's guard lands, not something to solve twice.
- The notifications bell's actual functionality (Topbar's
  `notificationCount`/`onNotificationClick` props) — F1 §16 explicitly
  defers a dedicated notifications page, "assumed to back a header dropdown
  widget," `[Speculation]` per F1's own notation. No notifications backend
  procedure list was confirmed against this session's reading. Render the
  bell icon with `notificationCount` hardcoded to 0 (or omitted, letting
  Topbar's own default apply if it has one — check the component's actual
  implementation) and `onNotificationClick` as a no-op or a small
  "coming soon" toast, rather than building real notification-fetching
  logic — that's a separate, larger, not-yet-scoped feature.
- Any change to AppShell, Sidebar, or Topbar's own internal implementation
  in packages/ui — they are correctly built to spec; this task only
  consumes them from apps/web, it does not modify packages/ui.
- The missing PlatformAdminHomePage/`/admin` landing shell (same gap
  TASK-WF-FE-004 flags) — if you add an /admin/* nav item, it should point
  at /admin/committees or /admin/roles directly (both real, both already
  built) rather than a non-existent /admin parent route, until that gap is
  separately closed.

────────────────────────────────────────────────────────────────────────────
DELIVERABLE CHECKLIST

1. New directory apps/web/src/components/
2. apps/web/src/components/AuthenticatedLayout.tsx — composes AppShell +
   Sidebar + Topbar using useLayoutStore, useAuth(), a role-filtered nav
   item list, a route-to-breadcrumb lookup table, and an Outlet for nested
   children.
3. A role-code-to-readable-label lookup (colocated or in a small shared
   file) for Sidebar/Topbar's currentUser.role display, sourced from F1
   §2.2's 13-role reference table.
4. main.tsx restructured: authenticated routes nested as children of a
   single AuthenticatedLayout parent route; /dev/* routes and /login (if it
   exists by the time you do this work) left as top-level siblings, not
   nested.
5. Sidebar nav items cross-referenced against each target page's actual
   (not just F1's documented) role gate.
6. State explicitly in your PR description: (a) your breadcrumb-lookup
   approach and its maintenance-cost tradeoff, acknowledged; (b) your
   multi-role priority ordering for currentUser.role display, and whether
   it matches TASK-WF-FE-004's HomePage ordering if that task has landed;
   (c) confirmation /dev/* routes were deliberately excluded from the
   AuthenticatedLayout nesting and why; (d) the interim rough-edge you're
   accepting if TASK-WF-FE-004 hasn't landed yet (null-session rendering
   inside AppShell).
````

---

## TASK-FE-ORG-003

```
CONTEXT

New standalone task, no existing fe.md entry. Read AGENTS.md first if not
already internalized this session — routing row "Build a frontend page or
view in /apps/web" → F4 → F1 → F5 → J6 → I2 → E1.

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS

F1's master route table (Section 4, read in full this session) has a row for
`/admin` — "PlatformAdminHomePage | Platform Administrator | — (landing
shell)" — structurally identical in kind to the already-built `/sysadmin`
row (SystemAdminHomePage, confirmed built and working, apps/web/src/pages/
sysadmin/SystemAdminHomePage.tsx). The route hierarchy diagram (Section 3)
shows `/admin` as the parent of four children: /admin/committees,
/admin/config, /admin/delivery-logs, /admin/roles, plus /admin/announcements
per a later ADR resolution.

Confirmed via direct repo check this session: `/admin/committees` and
`/admin/roles` are both built and registered in main.tsx. `/admin/config`
and `/admin/delivery-logs` are NOT built (blocked separately — see Non-Goals
below, this is expected and not this task's problem). `/admin` itself — the
PARENT landing shell — has no corresponding file anywhere in
apps/web/src/pages/ and no route registration in main.tsx (confirmed: only
"/admin/committees" and "/admin/roles" appear as literal path strings in the
file, never "/admin" alone).

This mirrors SystemAdminHomePage's existing pattern exactly and should be
comparably small — this is not a large task, but it's a real, missing file,
and TASK-WF-FE-004 (LoginPage/HomePage) explicitly flags plat_admin as a
role with nowhere to land, deferring the fix here.

────────────────────────────────────────────────────────────────────────────
WHAT TO BUILD

Component: `PlatformAdminHomePage`
Route: `/admin`
New file: apps/web/src/pages/organization/PlatformAdminHomePage.tsx

Placement note: F1's component name suggests no obvious module home; ORG is
the closest existing directory by convention (CommitteeManagementPage and
OrganizationPage both already live in pages/organization/, and
/admin/committees is ORG-adjacent) but this is a judgment call, not a
settled convention — if you disagree, pick a different placement (e.g. a new
pages/admin/ directory, matching sysadmin/'s own precedent) and state your
reasoning in your PR description. Either is defensible; this task list does
not mandate one.

Mirror SystemAdminHomePage.tsx's existing structure closely — read that file
in full before building this one. It is confirmed to be a minimal landing
shell with no data-fetching of its own (per its own fe.md task's Deliverables
description, "landing shell... no data fetching of its own"), linking out to
its children via a PageHeader plus link cards.

────────────────────────────────────────────────────────────────────────────
CONTENT — LINK OUT TO WHAT ACTUALLY EXISTS, NOT WHAT F1 PROMISES

F1's route hierarchy lists five children under /admin: committees, config,
delivery-logs, roles, announcements. Confirmed this session: only two are
actually built (committees, roles). Build PlatformAdminHomePage to link only
to what's real:
- A card/link to /admin/committees (built, working).
- A card/link to /admin/roles (built, working).
- Do NOT add cards linking to /admin/config, /admin/delivery-logs, or
  /admin/announcements — none of these routes exist, and a landing page
  linking to dead routes is a worse experience than a landing page that
  simply doesn't mention unbuilt features yet. If you want to acknowledge
  they're coming, a plainly-disabled or "coming soon"-labeled card is
  acceptable (matching the `disabled` pattern already supported by the
  Sidebar NavItem type per F5's spec, if you choose to reuse that shape
  here), but do not build them as functional links.

────────────────────────────────────────────────────────────────────────────
ROLE GATE

Platform Administrator only, mirroring F1's own stated gate for this route
and consistent with every other page in this codebase that checks
`ctx.auth.isPlatformAdmin`-equivalent client state rather than a generic
`roles.includes('plat_admin')` array check — confirmed this specific
boolean-flag convention (not array-includes) is used by IAM module
procedures per TASK-FE-IAM-001's own already-completed task notes in fe.md.
Check apps/web/src/lib/auth-context.tsx's actual AuthSession shape (already
read in full this session) — note it currently only exposes `roleCodes:
string[]`, NOT a `isPlatformAdmin` boolean equivalent. This means this page
should check `session.roleCodes.includes('plat_admin')` on the frontend
(array-based, since that's genuinely all the frontend has available), even
though the backend's own internal check uses a different boolean-flag
mechanism — these are two different layers with two different real
implementations, and the frontend should use what's actually available to
it rather than assuming a boolean flag exists client-side that doesn't.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- /admin/config or /admin/delivery-logs themselves — both are separately,
  genuinely blocked (config per F1's own note that "a detailed config-screen
  spec must exist before backend work can even start," delivery-logs on the
  unbuilt NOTIF module) — this task only builds the parent shell, not its
  missing children.
- /admin/announcements — blocked on backend procedures per ADR-UI-006 that
  were not confirmed built this session; do not assume they exist without
  checking apps/server/src/modules for a notifications/announcements router
  first, and do not build this page's frontend if that backend doesn't
  exist yet.
- Any change to AuthenticatedLayout or main.tsx's broader routing structure
  beyond adding this one new route — if TASK-WF-FE-005 has already landed,
  register /admin as a nested child of AuthenticatedLayout matching every
  other authenticated route's pattern; if it hasn't, register it as a
  top-level entry in main.tsx exactly like every other currently-registered
  route, and don't attempt to build the nesting structure yourself as a
  side effect of this smaller task.

────────────────────────────────────────────────────────────────────────────
DELIVERABLE CHECKLIST

1. apps/web/src/pages/organization/PlatformAdminHomePage.tsx (or your chosen
   alternate placement, documented) — minimal landing shell, no data
   fetching, links only to /admin/committees and /admin/roles.
2. Route registration: main.tsx, path "/admin".
3. Role gate: `session.roleCodes.includes('plat_admin')` client-side check,
   with the boolean-flag-vs-array-check discrepancy from the backend noted
   in a code comment.
4. State in your PR description: your placement choice (organization/ vs. a
   new admin/ directory) and reasoning.
```

---

## What's still not attempted, and why — new items this task list surfaces

- **`useSessionStore` (ADR-UI-012 / F2 §5) vs. `auth-context.tsx`'s React Context** — a real, verified architecture divergence, not resolved here. TASK-WF-FE-004 applies a narrow, local fix (an `isLoading` flag) sufficient for its own correctness, and files a findings-log entry rather than migrating the whole app. A full reconciliation is a human decision with real blast radius (every page calling `useAuth()`), same category as TASK-PRE-03/TASK-PRE-04's "not an agent's call to make unilaterally" reasoning.
- **`/api/auth/lock` and `/api/auth/unlock`** — confirmed real, working backend endpoints (session-lock/re-auth-while-locked flow) with zero frontend surface anywhere. Flagged in TASK-WF-FE-004 as a follow-up candidate, not built.
- **`/admin/config`, `/admin/delivery-logs`, `/admin/announcements`** — all three remain blocked exactly as fe.md's own existing "What's still not attempted" section already documented (config needs a spec first; delivery-logs needs NOTIF; announcements needs ADR-UI-006's procedures confirmed). TASK-FE-ORG-003 deliberately does not link to any of them.
- **Retrofitting all 22 existing pages with `AuthenticatedLayout`** — TASK-WF-FE-005 builds the nesting structure and moves every currently-registered route under it, so in practice this does get done as part of that task's main.tsx restructuring — but auditing each of the 22 pages' own internal null-session handling is explicitly out of scope and not verified page-by-page in this session.

---

## TASK-WF-FE-006

````
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-FE-006. This resolves the divergence
TASK-WF-FE-004 deliberately deferred (its "Open Architecture Question"
section, and the LOG-0095 entry it filed) between auth-context.tsx's React
Context and F2/ADR-UI-012's mandated useSessionStore. TASK-WF-FE-004 applied
a narrow local fix (an isLoading flag on auth-context.tsx) sufficient for its
own correctness and explicitly did NOT attempt this migration. This task now
does.

Read AGENTS.md before doing anything else if you have not already
internalized it this session. Applicable rows, union per Section 2's
multi-row instruction: "Write a Zustand store" (F2 → F1 → E3) AND "Build a
frontend page or view in /apps/web" (F4 → F1 → F5 → J6 → I2 → E1), since this
task both designs/builds a new store per spec and rewires every page that
consumes it.

Read F2 in full before starting (docs/pre-development/F-frontend-architecture/f2-zustand-store-design.md,
1038 lines) — Section 1 (the Zustand/TanStack Query boundary), Section 2
(store inventory), and Sections 4-5 (useShellStore, useSessionStore) are
directly load-bearing for this task and were read in full during this
session's discovery; the rest of the document (Stores 3-11) is NOT this
task's concern and does not need re-reading, but skim its ToC so you don't
accidentally step on a different store's territory while touching
apps/web/src/stores/.

Before starting, check docs/development-findings-log.md for status changes
on LOG-0095 (filed by TASK-WF-FE-004, documenting this exact divergence) and
anything newer touching F2, useSessionStore, or iam.getCurrentUser — this
session's read ended at LOG-0094, with LOG-0095 to be filed by this task
itself if TASK-WF-FE-004 has not already done so (check before assuming;
this prompt was written assuming TASK-WF-FE-004 landed first, but if it
hasn't, file LOG-0095 as part of this task instead, using the same content
this prompt would have referenced).

────────────────────────────────────────────────────────────────────────────
WHY THIS IS A RESOLUTION, NOT A DEFERRAL — READ BEFORE OBJECTING TO SCOPE

A prior pass on this task list treated the Context-vs-Zustand question as a
product decision requiring human sign-off, in the same category as
TASK-PRE-03 (audit procedure scoping) and TASK-PRE-04 (designation vs.
delegation). It is not the same category, and F2 itself settles this:

F2's closing paragraph (line 1037, read in full and verbatim): "This document
supersedes any informal or ad-hoc Zustand store definitions that may exist in
/apps/web prior to Phase 1 development start... in full." Section 18 (line
1021): "All items... are resolved... F2 carries zero open items."

auth-context.tsx is exactly the kind of informal, ad-hoc pattern this
sentence describes — it was never itself proposed as an alternative to
useSessionStore in any ADR, findings-log entry, or other document checked
this session; it simply exists, unreconciled, alongside a spec that already
claims supersession over it. This is a code/spec conformance gap (matching
the officeType-enum and stepKey-naming category of fixes fe.md's existing
tasks apply directly), not an open product question. Do not re-litigate
whether useSessionStore is the right design — F2 already made that call, and
ADR-UI-012 through ADR-UI-016 record five rounds of the team explicitly
refining and confirming its exact shape. Your job is conformance, not a
second design pass.

What genuinely IS still open, and is a decision within THIS task's scope for
you to make deliberately (not silently) — see the two subsections below —
is HOW to sequence the migration given that F2's prescribed hydration
mechanism has its own real, separate bug.

────────────────────────────────────────────────────────────────────────────
BLOCKING DISCOVERY — F2'S OWN HYDRATION MECHANISM IS BROKEN

F2 §5's usage notes (line 214) prescribe: "On app mount, /apps/web calls the
auth check endpoint (a tRPC iam.getCurrentUser call...). If the cookie is
valid, the response is used to populate setIdentity."

Confirmed via direct read this session: `iam.getCurrentUser`
(apps/server/src/modules/iam/iam.router.ts, lines 17-32) is real, mounted,
and protected — but its handler calls `service.getUserById(targetId)`
(line 27), and `getUserById` (apps/server/src/modules/iam/iam.service.ts,
line 197) is a literal stub: `getUserById: () => { throw new Error('not
implemented') }`. Calling this procedure today throws unconditionally,
regardless of session validity.

This means a naive migration — swap auth-context.tsx for useSessionStore,
point its hydration at iam.getCurrentUser exactly as F2 prescribes — would
break session restoration on every page reload for every user, replacing a
currently-working flow (auth-context.tsx's refresh() correctly calls the
real, working POST /api/auth/refresh REST endpoint) with a call that always
throws. This is not a reason to abandon the migration; it is a reason to
sequence it correctly. Two real options:

**(a) Fix `getUserById` first, as part of this same task, then hydrate
exactly as F2 prescribes.** `getUserById` needs to return a `UserRow`-shaped
object (same shape `findUserById` in iam.repository.ts already returns,
confirmed real and working, used correctly by `updateOwnProfile` and several
other real call sites in this file) for the target user. This is a small,
contained fix — `getUserById: (id) => iamRepo.findUserById(id)` is very
likely sufficient, though verify `iamRepo`'s exact binding/closure shape in
this file before assuming that one-line change is complete (this session
confirmed the stub's existence and `findUserById`'s real implementation
separately, but did not trace whether `iamRepo` is already in scope at the
stub's exact location — check before writing the fix).

**(b) Keep useSessionStore's hydration source as the existing, working
POST /api/auth/refresh REST call (not iam.getCurrentUser), diverging from
F2's literal usage note on this one implementation detail while keeping
everything else — the store shape, the actions, isHydrated, hasRole — exactly
as spec'd.** This works today with zero backend changes, but means
useSessionStore's setIdentity is populated from a REST response shape
(AuthResponseSchema, confirmed real) rather than a tRPC iam.getCurrentUser
response shape (UserRow, a different shape entirely — no roleCodes,
officeScopeId, or officeCode on UserRow at all, confirmed by direct
comparison of the two schemas this session). These two response shapes are
NOT interchangeable — AuthResponseSchema is exactly what ADR-UI-012 was
about (roleCodes/officeScopeId/officeCode added specifically for this
purpose); UserRow is the raw user table row with none of that. Option (b) is
therefore the ONLY viable choice if you don't also fix getUserById, since
iam.getCurrentUser's actual current output cannot populate
ActiveUserIdentity's required fields at all.

**Recommendation for this task: do (a), fixing `getUserById`, BUT populate
`setIdentity` from the SAME already-working POST /api/auth/refresh call's
response for the actual hydration path (matching option (b)'s data source),
while ALSO fixing getUserById as a small, independently-valuable, low-risk
correctness fix (it's a stub throwing on every call — a real defect
regardless of this migration, and iam.getCurrentUser has at least one other
real call site's worth of value once fixed: a future profile page, per F1
§16's own note that iam.getCurrentUser is "assumed... cross-cutting app-shell
plumbing"). This gets you a working migration today without waiting on or
blocking on the hydration-endpoint question, while also not leaving a known
stub unfixed when the fix is this contained. State this choice, or your own
different one, explicitly in your PR description — this task list is
recommending, not mandating, a specific sequencing, and if you find a reason
mid-implementation that changes the calculus, document it rather than
silently overriding the recommendation without a trace.**

Do NOT block this entire task on getUserById's fix if you choose differently
— that would replicate exactly the kind of unnecessary blocking TASK-PRE-03/
04 correctly avoid for decisions that ARE genuinely undecidable pre-dev; this
one is not undecidable, it just has two reasonable sequencings, and you
should pick one and move.

────────────────────────────────────────────────────────────────────────────
SECOND, SEPARATE BUG FOUND ALONG THE WAY — FLAG, DO NOT FIX HERE

`updateOwnProfile` (apps/server/src/modules/iam/iam.service.ts, lines
914-918) accepts `displayName`/`phoneNumber` via its input type but its body
is exactly:
```ts
async updateOwnProfile(input: { userId: string; displayName?: string; phoneNumber?: string }): Promise<UserRow> {
  const user = await iamRepo.findUserById(input.userId);
  if (!user) throw new NotFoundError('User', input.userId);
  return user;
},
```
It reads the user back unchanged and returns it — neither field is ever
written anywhere. Confirmed separately: no `displayName`/`display_name`
column exists anywhere in packages/database/schema/iam.schema.ts's `users`
table (repo-wide grep, zero matches) — so even a correct write
implementation would need a new migration first, this isn't just a missing
`UPDATE` statement.

This is directly relevant to THIS task because F2's `ActiveUserIdentity`
shape requires `displayName: string` (line 187, "computed from employee
first+last, or username fallback") as a REQUIRED field, not optional. Since
no real displayName source exists today (no column, no working write path,
and — separately — no confirmed join to an `employees` table's first/last
name either, not verified this session), this task's useSessionStore
implementation should populate `displayName` with the username fallback
ONLY (`identity.displayName = session.user.username`, matching what
TASK-WF-FE-004's HomePage/AuthenticatedLayout work already settled on as an
interim choice for SidebarUser.name, if that task has landed) — do not
attempt to build the employee-first+last computation F2's comment describes
as the primary source; that requires backend work (a real join, or a real
displayName column with a real write path) well beyond this task's scope.

Do NOT fix updateOwnProfile's no-op bug as part of this task — it's a real,
separate defect but touches a different code path (profile editing, not
session hydration) that this task doesn't otherwise need. File a
findings-log entry for it (see Deliverable Checklist) and leave it for a
future task explicitly scoped around profile management — which, per F1
§16, doesn't have a page to attach to yet anyway (profile settings is one of
F1's own confirmed, deliberate exclusions).

────────────────────────────────────────────────────────────────────────────
WHAT TO BUILD

1. apps/web/src/stores/session.store.ts — new file, matching F2 §5's exact
   spec: `ActiveUserIdentity` interface, `SessionState` (`identity`,
   `isHydrated`), `SessionActions` (`setIdentity`, `clearIdentity`,
   `setHydrated`). Match field names EXACTLY as F2 specifies —
   `userId` not `id`, `roleCodes` not `roles`, etc. — since these will be
   referenced throughout the 14 consumer files being migrated and a naming
   drift here just relocates the Context-vs-spec divergence one level down
   instead of closing it.

2. apps/web/src/stores/shell.store.ts — new file, matching F2 §4's exact
   spec: `ShellState` (`sidebarOpen`, `sidebarCollapsed`, `activeNavItem`),
   `ShellActions` (six actions per spec). This REPLACES the existing
   apps/web/src/stores/layout.store.ts, which is confirmed real but
   incomplete against F2's spec — it has only `sidebarCollapsed` (no
   `sidebarOpen` for the mobile drawer variant F2 describes, no
   `activeNavItem`). Do not keep both files; layout.store.ts's one existing
   field and its localStorage persistence pattern (name: "batac-dms:layout",
   version: 1 — reasonable to carry forward unchanged) should inform
   shell.store.ts's implementation, then layout.store.ts should be deleted.
   Confirmed zero real consumers of layout.store.ts exist yet (repo-wide
   grep, this session) — so this replacement has zero migration cost beyond
   the file itself; nothing downstream needs updating for this specific
   swap. If TASK-WF-FE-005 (AuthenticatedLayout) has already landed and
   DOES consume layout.store.ts by the time you do this work, that file's
   AppShell-wiring code needs updating to shell.store.ts's field names as
   part of this task too — check before assuming zero consumers still holds.

3. apps/web/src/stores/index.ts — barrel file per F2 §3's spec, re-exporting
   both new hooks (and any other stores that may exist by the time this task
   runs — check apps/web/src/stores/ for ui.store.ts, confirmed to already
   exist and cover a different concern (modals/toasts) not touched by this
   task; include it in the barrel too if a barrel doesn't already exist, or
   extend the existing one if it does).

4. apps/web/src/lib/auth-helpers.ts (or wherever hasRole currently lives —
   confirmed a local, un-shared pattern per TASK-WF-FE-001's own findings;
   check whether a later task already extracted it to this exact path) — add
   or update a `hasRole(identity: ActiveUserIdentity | null, ...roles:
   string[])` helper matching F2's own recommended pattern (line 216:
   "hasRole(store.identity, 'sp_secretary')... not inline string comparisons
   scattered across components"). If hasRole already exists locally per-file
   in multiple places (confirmed pattern across DocumentDetailPage,
   MyAssignedStepsPage, WorkflowStepActionPage per fe.md's own prior task
   notes), this migration is the natural point to consolidate all of them
   into one shared, session-store-aware version — do this as part of this
   task rather than leaving N separate local copies each needing their own
   signature update.

5. apps/web/src/lib/auth-context.tsx — DELETE. Every real consumer migrates
   to useSessionStore directly (see below). Do not leave it in place
   "just in case" — a codebase with two competing session-state mechanisms
   after this task is a worse outcome than either one alone.

────────────────────────────────────────────────────────────────────────────
MIGRATION — ALL 14 REAL CONSUMERS, CONFIRMED UNIFORM PATTERN

Confirmed via repo-wide grep this session: exactly 14 files outside
auth-context.tsx itself call `useAuth()`, and every single one uses the
identical pattern `const { session } = useAuth();` — none calls `login`,
`logout`, or `refresh` directly (those three are only ever called from
inside auth-context.tsx itself, or — once TASK-WF-FE-004/005 land — from
LoginPage and AuthenticatedLayout's Topbar wiring respectively, which this
task also needs to update, see below). This is good news: the migration is
mechanical, not 14 bespoke integrations.

The 14 files (confirmed exact list, this session):
- apps/web/src/pages/documents/ComplaintDetailPage.tsx
- apps/web/src/pages/documents/DocumentDetailPage.tsx
- apps/web/src/pages/documents/DocumentRequestDetailPage.tsx
- apps/web/src/pages/iam/RoleAssignmentPage.tsx
- apps/web/src/pages/organization/OrganizationPage.tsx
- apps/web/src/pages/sysadmin/ActiveSessionsPage.tsx
- apps/web/src/pages/sysadmin/SystemAdminHomePage.tsx
- apps/web/src/pages/sysadmin/UserAccountManagementPage.tsx
- apps/web/src/pages/workflow/MayorDashboardPage.tsx
- apps/web/src/pages/workflow/MyAssignedStepsPage.tsx
- apps/web/src/pages/workflow/OrderOfBusinessPage.tsx
- apps/web/src/pages/workflow/SecretaryDashboardPage.tsx
- apps/web/src/pages/workflow/WorkflowStepActionPage.tsx
- apps/web/src/pages/workflow/panels/MultiReferralPanel.tsx

For each: replace `import { useAuth } from '.../auth-context'` +
`const { session } = useAuth();` with `import { useSessionStore } from
'.../stores/session.store'` (or the barrel, `'.../stores'`, per your
barrel-import convention choice) + `const identity = useSessionStore((s) =>
s.identity);`. Then update every downstream reference in that file from
`session.<field>` to `identity.<field>` PER FIELD, since field names are not
identical between AuthSession and ActiveUserIdentity — confirm each
individually rather than a blind find-replace:
- `session.user.id` → `identity.userId` (note: nested under `.user` in the
  old shape, flat in the new one)
- `session.user.username` → `identity.username`
- `session.roleCodes` → `identity.roleCodes` (unchanged name, still present)
- `session.officeScopeId` → `identity.officeScopeId` (unchanged)
- `session.officeCode` → `identity.officeCode` (unchanged)
- `session.committeeIds` → **NO EQUIVALENT FIELD EXISTS on ActiveUserIdentity
  per F2's spec as written.** Confirmed: F2 §5's ActiveUserIdentity interface
  (lines 184-193) has no committeeIds field, and no ADR-UI-012 through
  ADR-UI-016 adds one. This is a real gap in F2 itself, not something this
  task invented — but it's directly load-bearing: LOG-0085 (confirmed, this
  session's log read) documents committeeIds being added to AuthSession
  specifically to fix ComplaintDetailPage's sp_member committee-scoping
  check. ComplaintDetailPage.tsx (confirmed a real consumer above) reads
  `session.committeeIds` directly. A literal migration to F2's spec as
  written would silently regress this already-fixed, already-logged bug.
  **Do not silently drop this field.** Add `committeeIds: string[]` to your
  session.store.ts's ActiveUserIdentity interface as a deliberate,
  documented DEVIATION from F2's literal text — state this explicitly in
  your PR description and file a findings-log entry (see checklist) noting
  that F2 §5 is missing a field its own downstream consumer (ComplaintDetailPage,
  fixed via LOG-0085) genuinely needs; this is exactly the kind of
  spec-lags-implementation gap AGENTS.md Section 1 says to flag rather than
  silently follow the (incomplete) document over the (correct, tested)
  code.
- `session.expiresAt` → `identity.expiresAt` (unchanged)
- `session.sessionId` → `identity.sessionId` (unchanged)
- `session.user.email`, `session.user.status`, `session.user.mfaEnabled`,
  `session.user.createdAt`, `session.user.updatedAt` → **NO EQUIVALENT on
  ActiveUserIdentity**, and per F2's own explicit design (line 218: "The
  store does NOT hold a full UserSelectSchema object... The full user
  profile... is fetched by TanStack Query via iam.getCurrentUser when a
  profile page or settings view needs it"), this is INTENTIONAL, not a gap
  to fix. Before assuming this is safe to drop for a given consumer, grep
  that specific file for whether it actually reads any of these five fields
  (not verified per-file individually this session, only that `session.`
  appears in each) — if one does, that specific usage needs its own TanStack
  Query call added (`trpc.iam.getCurrentUser.useQuery()`, once the
  getUserById stub is fixed per the "Blocking Discovery" section above) as
  part of migrating that file, rather than assuming the field simply isn't
  used anywhere.

For the small number of files with additional useAuth() usage beyond a bare
session read — none confirmed this session, but verify per-file rather than
trusting this summary — apply the same field-by-field reasoning above rather
than a mechanical search-replace.

────────────────────────────────────────────────────────────────────────────
HYDRATION WIRING — WHERE setHydrated/setIdentity/clearIdentity GET CALLED

This logic currently lives inside auth-context.tsx's AuthProvider
(useEffect calling refresh() once on mount, lines 98-101). Once
auth-context.tsx is deleted, this needs a new home. Recommendation: a small
new component, apps/web/src/components/SessionHydrator.tsx, mounted once at
the top of the app (in main.tsx, wrapping <RouterProvider>, replacing the
current <AuthProvider> wrapper) — a component with no visible UI, whose only
job is: on mount, call the chosen hydration source (per the Blocking
Discovery section's sequencing decision), then call `setIdentity` +
`setHydrated` on success or `clearIdentity` + `setHydrated` on failure/401.
This mirrors auth-context.tsx's existing working logic almost exactly, just
relocated from a Context provider's effect to a small standalone mount-once
component talking to the Zustand store instead of Context state.

login()/logout() also currently live inside auth-context.tsx. These need a
new home too — NOT inside session.store.ts itself (per F2's own boundary
rule and store-independence note, §3: "Stores do not call each other's
setters directly... cross-store coordination is done in component event
handlers or custom hooks," and login/logout are side-effecting async
operations against a REST endpoint, not pure state transitions, which is a
different category of code than a Zustand action per F2's whole document's
own pattern — every store's own "Actions" section is synchronous setters
only, confirmed by scanning all 11 stores' Actions interfaces in F2's ToC
during this session's skim). Recommendation: a small standalone hook,
apps/web/src/hooks/useAuthActions.ts, exporting `login(username, password)`
and `logout()` functions that internally call the same PKCE-generating
fetch logic auth-context.tsx already has (this logic itself does not need to
change, just relocate) and then call `useSessionStore.getState().setIdentity(...)`
/ `.clearIdentity()` directly (using the imperative `.getState()` API rather
than the hook form, since these are called from event handlers, not
rendered reactively) on success.

TASK-WF-FE-004's LoginPage (if landed) needs updating to import from
useAuthActions instead of useAuth. TASK-WF-FE-005's AuthenticatedLayout (if
landed) needs its Topbar onUserMenuAction 'logout' wiring updated the same
way.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- Fixing updateOwnProfile's no-op bug, or adding a displayName column — flag
  only, per the "Second, Separate Bug" section above.
- Any of Stores 3-11 from F2 (useModalStore, useNotificationDrawerStore,
  useDocumentIntakeStore, etc.) — entirely out of scope, this task only
  touches useShellStore and useSessionStore.
- A profile/account-settings page — F1 §16 explicitly, deliberately excludes
  this; do not build one as a side effect of now having a real
  iam.getCurrentUser path (if you chose to fix getUserById).
- Retrofitting hasRole's consolidation into every file that has its own
  local copy if that turns out to be a large, unbounded set — do the
  consolidation for the confirmed cases only (DocumentDetailPage,
  MyAssignedStepsPage, WorkflowStepActionPage, per fe.md's own prior
  findings), and flag rather than silently expand scope if you discover
  more local copies mid-task.

────────────────────────────────────────────────────────────────────────────
DELIVERABLE CHECKLIST

1. apps/web/src/stores/session.store.ts — new, matching F2 §5's spec plus
   the deliberate committeeIds deviation, documented in a code comment
   pointing at this task and at LOG-0085.
2. apps/web/src/stores/shell.store.ts — new, matching F2 §4's spec, replacing
   layout.store.ts (deleted).
3. apps/web/src/stores/index.ts — barrel, extended or created.
4. Consolidated hasRole helper, session-store-aware.
5. apps/web/src/hooks/useAuthActions.ts — login/logout, relocated from
   auth-context.tsx.
6. apps/web/src/components/SessionHydrator.tsx — mount-once hydration,
   wired into main.tsx replacing <AuthProvider>.
7. apps/web/src/lib/auth-context.tsx — deleted.
8. All 14 consumer files migrated, field-by-field, per the mapping above.
9. TASK-WF-FE-004's LoginPage and TASK-WF-FE-005's AuthenticatedLayout
   updated if either has landed.
10. getUserById fixed (if you chose sequencing option (a) from the Blocking
    Discovery section) or explicitly left stubbed with a code comment citing
    this task if you chose (b) — either way, state which in your PR.
11. A findings-log entry (next free LOG number — verify against the log's
    actual current tail, do not trust any number quoted in this prompt)
    documenting: (a) this migration itself as the resolution to LOG-0095;
    (b) the getUserById-stub discovery and your sequencing choice;
    (c) the updateOwnProfile no-op discovery, flagged for a future task;
    (d) the committeeIds deviation from F2's literal spec text.
12. State explicitly in your PR description: all four items above, plus
    confirmation every one of the 14 listed files was actually migrated
    (not just a representative sample), plus confirmation auth-context.tsx
    no longer exists anywhere in the repo.
````

## TASK-WF-FE-007

```
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-FE-007, a new standalone task with two parts:
a required backend fix, then the frontend it unblocks. This follows the same
two-part shape as TASK-WF-FE-002 (backend prerequisite, then the page it
serves) — do not skip Part 1 to get to Part 2 sooner; Part 2 is not
meaningfully testable without it.

Read AGENTS.md before doing anything else if you have not already
internalized it this session. Routing rows, union per Section 2's multi-row
instruction: "Write a tRPC procedure or router" (E1 → I1 → I2) for Part 1,
"Build a frontend page or view in /apps/web" (F4 → F1 → F5 → J6 → I2 → E1)
for Part 2.

Before starting, read B5 §4.4-4.7 in full (docs/pre-development/B-architecture-documents/b5-authentication-and-authorization-architecture.md,
lines 379-424) and ADR-AUTH-010 in full
(docs/pre-development/B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-010-session-locked_at-behavior-when-access-token-expires-while-locked.md,
52 lines) — both were read in full this session and are directly load-bearing
for both parts below. Both are Status: Accepted / Confirmed; this task does
NOT reopen either document's decisions, it implements what they already
settled.

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS — TWO SEPARATE VERIFIED GAPS, NOT ONE

Gap 1 (backend, blocking): B5 §4.6 ("Shared Workstation Lock") specifies
that while a session is locked, "all protected routes reject requests with
locked session status" (line 411). The actual enforcement
(apps/server/src/modules/iam/iam.middleware.ts, lines 167-172, confirmed by
direct read: `if (session.locked_at !== null && request.url !==
'/api/auth/unlock') { return reply.code(423).send({ code: 'SESSION_LOCKED'
...}) }`) is real and correctly implemented — but it is only wired into
Fastify inside iam.routes.ts's own nested protected sub-app (`fastify.register(async
(protectedApp) => { await protectedApp.register(authMiddlewarePlugin); ...
})`, confirmed at iam.routes.ts line 369), which covers exactly three REST
routes: /api/auth/lock, /api/auth/logout, /api/admin/sessions/:id/terminate.

tRPC is registered entirely separately (apps/server/src/app.ts line 125,
`fastify.register(fastifyTRPCPlugin, { prefix: '/api/trpc', ... })`) as a
sibling top-level plugin, not nested inside iam.routes.ts's protected
sub-app. tRPC's own auth gate (apps/server/src/trpc/trpc.ts,
`protectedProcedure`, lines 19-32) only checks whether `ctx.auth` is
truthy — it never re-checks `locked_at`. Confirmed via repo-wide grep this
session: zero references to `locked_at`, `SESSION_LOCKED`, or `isLocked`
exist anywhere under apps/server/src/trpc/ or in any of the seven tRPC
router files under apps/server/src/modules/*/,*.router.ts.

**Concrete consequence:** as the backend stands today, locking a session via
POST /api/auth/lock sets `locked_at` correctly, but every tRPC call —
meaning nearly all real application traffic, since every page in this
codebase (confirmed: all 22 built pages) uses `trpc.*` calls, not REST —
continues to succeed exactly as if the session were not locked. B5's own
stated guarantee ("all protected routes reject requests with locked session
status") is false for tRPC routes as currently wired. This is not a
frontend gap to work around; it is a real backend enforcement hole that must
close before a lock-screen frontend would mean anything.

Gap 2 (frontend, this task's main deliverable): zero frontend surface exists
for locking, the lock screen itself, or unlocking — confirmed via repo-wide
search of apps/web/src for "lock"/"unlock" (case-insensitive), matching only
unrelated string fragments ("block", "unlocked" in unrelated contexts), no
real consumer of POST /api/auth/lock or /api/auth/unlock anywhere. Also
confirmed: no frontend idle-timer exists for B5 §4.4's "25-minute warning is
frontend-driven" requirement — this task's Part 2 also builds this, since
it's tightly coupled to the lock flow (the idle timer is what triggers the
lock in the first place, per the natural reading of "Switch User / Lock
Screen action" in §4.6 combined with §4.4's warning-then-inactivity-timeout
design — no source document makes this coupling fully explicit, this is an
`[Inference]` this task list is making, flagged here rather than silently
assumed).

────────────────────────────────────────────────────────────────────────────
PART 1 — CLOSE THE tRPC ENFORCEMENT GAP (REQUIRED, DOES NOT BLOCK ON A DECISION)

Unlike TASK-PRE-03/04, this is not a product decision — B5 §4.6's rule is
already Confirmed, and the fix is mechanical: extend the SAME check
iam.middleware.ts already correctly implements to also cover tRPC's request
path. Two honest implementation shapes; pick one, this task does not mandate
which:

**(a) A global Fastify onRequest/preHandler hook**, registered before
fastifyTRPCPlugin in app.ts's registration order (currently line 125), that
performs the same locked_at check against any request whose auth is already
resolved — this would need `req.auth` to already be populated by the point
this hook runs, which means it needs to run after whatever currently
populates `req.auth` for tRPC requests today. **Open sub-question you need
to resolve by tracing the code, not guessing:** confirm exactly what
currently populates `req.auth` for a tRPC request before Hook 1
(verifyAccessToken) or an equivalent check ever runs — trpc.ts's
createContext (line 8) reads `(req as any).auth || null`, implying
SOMETHING already sets `req.auth` for tRPC requests to work at all today
(protectedProcedure's `ctx.auth` checks clearly succeed for real users
right now, confirmed by every existing built page's data loading working).
Trace this fully — likely a separate, currently-undiscovered global hook
already runs Hook 1-3's equivalent logic (JWT verification, session lookup,
RLS context-setting) for tRPC requests, just without Hook 1's step 4 (the
locked check specifically) or without being the exact same function. Do not
assume iam.middleware.ts's verifyAccessToken is literally unused for tRPC
without confirming what IS used instead — find that mechanism first.

**(b) Add the locked_at check directly inside trpc.ts's protectedProcedure
middleware** (the `t.procedure.use(async (opts) => {...})` block, lines
19-32), immediately after the existing `if (!opts.ctx.auth)` check. This
requires `ctx.auth` to already carry a `sessionId` (confirmed present on
every real session — the `AuthSession`/JWT payload structures already
carry `sid`/`sessionId` throughout this codebase) and a way to look up that
session's current `locked_at` value — either a fresh DB query per-request
(matching the REST middleware's own approach, real per-request cost, but
consistent with the existing pattern) or, if `ctx.auth`'s existing resolved
shape already carries a locked boolean somehow (not confirmed this
session — check before assuming), reuse that instead of a new query.

Whichever you choose, the tRPC-side response for a locked session should
throw a `TRPCError` — tRPC does not have a native way to send a raw HTTP 423
the way the REST middleware does (`TRPCError`'s `code` field is drawn from
a fixed set of standard codes: UNAUTHORIZED, FORBIDDEN, etc., none of which
map to "423 Locked" natively). Recommendation: throw `TRPCError({ code:
'UNAUTHORIZED', message: 'SESSION_LOCKED' })` or, if this codebase's tRPC
error-shape conventions support a custom `cause` field (check an existing
precedent — workflow.policy.ts's `canLogSecretariatDecision`, read in a
prior session's TASK-WF-FE-003, throws `TRPCError({ code: 'FORBIDDEN',
cause: 'secretariat_decision_wrong_office' })` — the same `cause`-string
pattern is directly reusable here: `TRPCError({ code: 'UNAUTHORIZED', cause:
'SESSION_LOCKED' })`), use that, since it gives the frontend a distinguishable
signal without inventing a new tRPC error code. State your choice explicitly
in your PR description — this is a real design decision within this task's
scope to make, not a pre-settled convention.

**Exclude the unlock path itself from this check**, mirroring the REST
middleware's own `request.url !== '/api/auth/unlock'` exclusion — but
unlock is a REST endpoint, not tRPC, so this exclusion is likely automatic
(no tRPC procedure should ever need to bypass this check, since unlocking
doesn't go through tRPC at all) — confirm this holds for your chosen
implementation shape rather than assuming.

────────────────────────────────────────────────────────────────────────────
PART 2 — FRONTEND: IDLE WARNING, LOCK SCREEN, UNLOCK FLOW

Three pieces, all coupled, build together:

**2a. Idle timer + 25-minute warning** (B5 §4.4). A new hook,
apps/web/src/hooks/useIdleTimer.ts — monitors keyboard/mouse/touch events
(matching §4.4's "keyboard/mouse events" language; touch is a reasonable
addition for tablet use in a government-office context, not contradicted by
any source document, your call whether to include it). At 25 minutes of no
detected activity, surface a warning (a Dialog/Modal — check whether
useModalStore, F2 §6, already exists and is the right home for this modal's
open/closed state per this codebase's established Zustand/TanStack Query
boundary rule; if useModalStore doesn't exist yet as a built store, a local
component-level state is an acceptable fallback for just this one modal,
document which you chose). The warning should offer "I'm still here" (which
should, per B5 §4.4's own note that "the frontend sends a keepalive request
... when the user resumes activity," simply make ANY authenticated request —
confirmed this session that iam.middleware.ts's Hook 4 (updateLastActivity)
already runs on every authenticated REST request and, once Part 1 above is
implemented, should be extended to run for tRPC requests too if it doesn't
already — check whether it currently does before assuming a new dedicated
"keepalive" endpoint needs to be built; B5's phrase "designated endpoint"
does not necessarily mean a NEW endpoint, since any lightweight existing
authenticated call, e.g. a cheap existing query already used elsewhere,
would satisfy this if Hook 4 already covers tRPC. Trace this as part of Part
1's investigation into what currently populates req.auth for tRPC — the
answer likely resolves both questions together.) or "Lock now" (triggers
2b immediately).

**2b. Lock screen.** At 30 minutes total idle (or on explicit user action,
e.g. a "Lock" item in Topbar's account menu — TASK-WF-FE-005's
AuthenticatedLayout, if landed, has an `onUserMenuAction` prop supporting
only `'profile' | 'logout'` per F5's spec; this task needs to extend that
union to include `'lock'` if AuthenticatedLayout has already landed, or
build the menu item directly if it hasn't), call POST /api/auth/lock (a
plain fetch, matching auth-context.tsx's or useAuthActions.ts's existing
fetch pattern for /api/auth/login — no request body needed per
iam.routes.ts's real implementation, confirmed a bare `protectedApp.post`
with no input schema). On success, render a full-screen lock overlay —
NOT a route change (the user's in-progress work/scroll position/form state
underneath should be preserved, not navigated away from) — showing the
current user's display context (name/username — same source as
TASK-WF-FE-005/006's SidebarUser.name resolution, if either has landed) and
a password-only re-entry field. Do not show a full login form (username
field, PKCE flow) — B5 §4.6 is explicit: "Re-authentication (password only;
no full login flow)."

**2c. Unlock.** Submit calls POST /api/auth/unlock with `{ password }`
(confirmed real input shape, `UnlockInputSchema`, iam.schemas.ts line 18-20:
`z.object({ password: z.string().min(1) })`). Confirmed real response
handling from iam.routes.ts (lines 288-367, already read in full this
session):
- Success: `{ unlocked: true }`, 200. Dismiss the lock overlay, resume
  normal app state (no reload/re-navigation needed — the underlying page
  was never unmounted).
- Wrong password: 401 `{ code: 'INVALID_PASSWORD' }` (or, per the service
  layer's actual thrown codes, confirmed this session as `INVALID_PASSWORD`
  for both a missing credential row and a failed argon2 verify — same
  external code either way, do not attempt to distinguish these two cases
  in the UI, since the backend deliberately doesn't either, avoiding a
  user-enumeration signal). Show an inline "incorrect password" error,
  keep the lock overlay up, allow retry.
- Session's refresh token itself invalid (expired past 14 days,
  revoked, or reused): 401 `{ code: 'REFRESH_REQUIRED', message: "Your
  session has expired. Please log in again." }` (confirmed exact shape,
  iam.routes.ts lines 337-340; also confirmed this response includes a
  `clearAuthCookies(reply)` call server-side per line 338, meaning cookies
  are already cleared by the time this response reaches the frontend). This
  is the one case where the lock overlay should NOT simply retry — redirect
  to /login instead (once TASK-WF-FE-004 has landed; if it hasn't,
  redirect to whatever the eventual login route will be, or handle this
  case as a full page reload to "/" as an interim fallback, documented as
  such).
- Note per ADR-AUTH-010 and this section's own read of unlockSession's
  implementation (apps/server/src/modules/iam/iam.service.ts lines
  1020-1030): a silent refresh happens transparently inside a successful
  unlock when the access token had expired — the frontend does not need to
  detect or handle this specially; a 200 `{ unlocked: true }` (or whatever
  fields the full success response carries beyond that — check the
  remainder of unlockSession's implementation past line 1050, not fully
  re-read to its end in this session, before assuming the response shape
  stops at `{ unlocked: true }`) means the frontend can simply proceed as
  though nothing about token freshness needed handling — this is B5 §4.6's
  and ADR-AUTH-010's own explicit design intent ("invisible to them").

────────────────────────────────────────────────────────────────────────────
DETECTING AN ALREADY-LOCKED SESSION MID-APP-USE (NOT JUST SELF-INITIATED LOCK)

A session can become locked two ways: the current tab locks it
(2b above, straightforward — the tab that called /api/auth/lock already
knows to show the overlay), or — genuinely possible, not yet handled by
anything this task has described — a DIFFERENT tab or device locked the
SAME session (sessions are server-side state, not per-tab; nothing in B5 or
the schema ties a session to a single browser tab). If a locked session
makes a tRPC call from a tab that did NOT itself trigger the lock, Part 1's
new check will reject it with the `SESSION_LOCKED`-cause error — this
tab's frontend needs a global handler (a tRPC error link /
onError interceptor, check apps/web/src/lib/trpc.ts's existing client setup
for the right place to add this) that recognizes this specific error and
shows the SAME lock overlay from 2b, reactively, rather than letting the
error surface as a generic failed-query toast on whatever page happened to
be open. This is a real, non-optional case — do not build 2b as something
only reachable via the Topbar "Lock" menu item.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- Step-up (re-)authentication for high-risk actions — explicitly, twice,
  deferred to Phase 2 by both B5 §4.6 and ADR-AUTH-010 itself. Do not build
  any "confirm your password before approving this document" style
  challenge as part of this task.
- A "maximum session age" hard ceiling shorter than the 14-day refresh
  token lifetime — explicitly, twice, NOT adopted by ADR-AUTH-010. Do not
  add one as a "safety improvement" while you're in this code.
- Any change to the REST /api/auth/lock, /api/auth/unlock route handlers
  themselves, or the argon2/password-verification logic inside
  unlockSession — all confirmed correct and complete already; Part 1 only
  extends WHERE the locked_at check runs (tRPC's path too), it does not
  change the check's logic or the unlock service's own implementation.
- Building a NEW dedicated "keepalive" REST/tRPC endpoint before confirming
  one is actually needed — trace Hook 4's actual tRPC coverage first (Part
  1's investigation), per the note in 2a above; only build a new endpoint if
  that trace confirms none of the app's existing authenticated calls would
  serve the purpose.

────────────────────────────────────────────────────────────────────────────
DELIVERABLE CHECKLIST

1. Part 1: locked-session check extended to cover tRPC requests, using
   either shape (a) or (b) above, with the "what currently populates
   req.auth for tRPC" question traced and documented (code comment and/or
   PR description) rather than assumed.
2. Confirmation (from the same trace) of whether Hook 4's updateLastActivity
   already covers tRPC requests or needs the same extension as Part 1's
   locked check — if it needs the same fix, apply it in the same PR, since
   it's the identical wiring gap.
3. apps/web/src/hooks/useIdleTimer.ts — 25-minute warning, 30-minute
   auto-lock (or your own justified variant of these two numbers if B5's
   stated figures don't survive contact with your implementation —
   document any deviation explicitly).
4. Lock screen overlay component (not a route) — full-screen, password-only,
   preserves underlying app state.
5. Unlock flow wired to POST /api/auth/unlock with all three real response
   cases (success, INVALID_PASSWORD, REFRESH_REQUIRED) handled per their
   actual confirmed shapes above.
6. A global tRPC error interceptor recognizing the SESSION_LOCKED signal
   from Part 1 and showing the lock overlay reactively, for the
   different-tab/device case.
7. Topbar's onUserMenuAction extended to include 'lock' (if
   TASK-WF-FE-005 has landed) or an equivalent manual-lock trigger built
   directly (if it hasn't).
8. State explicitly in your PR description: (a) which Part 1 implementation
   shape you chose (a vs. b) and why; (b) what you found actually populates
   req.auth for tRPC requests today; (c) whether Hook 4/updateLastActivity
   needed the same tRPC-coverage fix; (d) your useModalStore-vs-local-state
   choice for the idle-warning dialog; (e) confirmation this task did not
   touch the REST lock/unlock handlers' own logic, only tRPC's enforcement
   path.
9. A findings-log entry (next free LOG number — verify against the log's
   actual current tail before writing, do not trust a number quoted here)
   documenting the tRPC-enforcement-gap discovery from Part 1 as the primary
   finding, status: proposed.
```

---
