## TASK-WF-FE-001

````
CONTEXT — READ THIS FIRST

You are implementing a new frontend task, informally called TASK-WF-FE-001, that
has no existing entry in wf.md or docs.md — both are closed (wf.md's workflow
engine backend tasks TASK-WF-006 through TASK-WF-009 are done; docs.md's DOCS
module task list is closed at DOCS-022, with DOCS-020/021/022/023 already built
as standalone-document follow-ons). This task follows that same "standalone
document after its module's task-list file closed" precedent, (docs/compressed-knowledge-base/frontend-tasklist-creation-knowledge-base.md).
Everything below is implementation guidance, verified against real code and
docs in a prior session — it is not itself formatted as that template.

Read docs/AGENTS.md before doing anything else if you have not already
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
````

---

## TASK-WF-FE-002

````
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-FE-002: the workflow step action detail page,
Task B in the two-part workflow-frontend sequence following TASK-WF-FE-001
(MyAssignedStepsPage, already built — apps/web/src/pages/workflow/, route
/workflow/steps, registered in main.tsx). This task builds the page that
Task A's rows link to.

Read docs/AGENTS.md before doing anything else if you have not already
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
````