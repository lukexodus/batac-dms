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
