## TASK-WF-BE-004 — Add `.output()` Zod Schema to `recordAttendance`

````
CONTEXT — READ THIS FIRST

You are implementing TASK-WF-BE-004, a new standalone backend task with no
existing entry in wf.md's Tier structure. Read AGENTS.md before doing
anything else if you have not already internalized it this session. The
applicable routing row is "Write a tRPC procedure or router" → E1 → I1 → I2.

This task closes a specific, narrow gap: `recordAttendance` in
apps/server/src/modules/workflow/session.router.ts has no `.output()` Zod
schema — its return type is TypeScript-inferred only. This is being fixed
now specifically because a related question (whether `absentCount` in this
procedure's return shape is intentional or unauthorized scope drift) was
just resolved by direct human decision — see
docs/development-findings-log.md, LOG-0097, for the full record of that
decision. LOG-0097 documents that `absentCount`'s presence was accepted as
intentional, and flags the missing `.output()` schema as the natural
follow-up to formally lock that decision in. Read LOG-0097 in full before
proceeding, but note: this task is scoped narrowly to adding the schema
itself. It is not a re-litigation of whether `absentCount` belongs — that
question is already closed.

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS — VERIFIED GAP, NOT SPECULATION

Confirmed via direct repo inspection this session:
- apps/server/src/modules/workflow/session.router.ts, line 430:
  `recordAttendance: protectedProcedure` — has `.input(...)` but no
  `.output(...)` call anywhere in its chain.
- Confirmed via grep: zero `.output(` calls exist anywhere in this file, on
  any of its 10 procedures. There is no in-file precedent to copy.
- The procedure's actual return statement (confirmed at line 703, but
  re-verify this line number yourself before editing — files shift):
  `return { success: true as const, presentCount, absentCount, quorumMet };`
- This is the ONLY successful return path in the procedure. Confirmed via
  grep for every `return`/`throw` in the procedure's body: every other exit
  is a `throw new TRPCError(...)` or `throw new Error(...)`, handled by
  tRPC's error channel, not the success output. Your `.output()` schema only
  needs to describe this one shape.
- Field types, confirmed by reading the procedure's body directly:
  - `success`: always the literal `true` (note the `as const` in the source
    — this should be `z.literal(true)`, not `z.boolean()`, to match the
    existing literal-type precision already present in the code).
  - `presentCount`: `number`, always a non-negative integer. Computed as
    `Math.max(0, totalActiveSpMembers - absentCount)` (line 496) — the
    `Math.max(0, ...)` guarantees non-negativity, so `z.number().int()` is
    correct without needing `.nonnegative()` to be defensive; use
    `.nonnegative()` anyway if you want the schema to document that
    guarantee explicitly, your call, but do not use `z.number()` alone
    without `.int()`, since this value is always a whole count.
  - `absentCount`: `number`, `absences.length` (line 454) — same integer
    reasoning as `presentCount`. Array `.length` is always a non-negative
    integer.
  - `quorumMet`: `boolean`. Computed as `presentCount >=
    Math.ceil(totalActiveSpMembers / 2) + 1` (line 497) — a plain boolean
    comparison result, `z.boolean()` is correct with no further
    qualification needed.
- `presidedByEmployeeId` (a `string | null` variable used internally in the
  procedure's write logic, first declared around line 499) is NOT part of
  the return object — confirmed via direct read of the return statement and
  via grep for every return/throw in the procedure. Do not add it to the
  schema. It is used only to decide what gets written to
  `spSessions.presidedByEmployeeId` in the database; it never appears in
  what the client receives back from this call.

────────────────────────────────────────────────────────────────────────────
EXISTING CONVENTION TO FOLLOW — CHECK BEFORE WRITING A NEW SCHEMA

apps/server/src/modules/documents/documents.router.ts, in the same monorepo
(different module, same general codebase), declares `.output()` on
essentially every procedure it defines and is the established pattern for
this. TASK-PRE-05 (docs/pre-development/A-project-planning/a1-tasks/fe.md,
search for "TASK-PRE-05") previously extended this same convention to
complaints.router.ts and document-requests.router.ts, and specifically notes
that a shared `SuccessOutputSchema` may already exist in the codebase for
simple `{ success: true }`-only mutation returns.

Before writing a new schema from scratch:
1. Check documents.router.ts for its schema-naming and placement convention
   (e.g. where schemas are defined — inline above the procedure, in a
   separate schemas file, etc.).
2. Search the codebase for an existing `SuccessOutputSchema` or similarly
   named shared schema. If one exists and matches a `{ success:
   z.literal(true) }` shape, you may still need a NEW schema for
   recordAttendance specifically, since this procedure's return shape has
   three additional fields (`presentCount`, `absentCount`, `quorumMet`)
   beyond bare `{ success: true }` — a shared bare-success schema will not
   fit as-is. Do not force-fit an existing schema that doesn't actually
   match; write a new one for this procedure if the existing shared schema
   only covers the bare-success case.
3. Confirm whether session.router.ts (this file) already imports `z` from
   'zod' before adding a new import — confirmed at the top of the file,
   line 1, `import { z } from 'zod';` — it already does, so no new import
   line is needed for basic Zod schema construction.

────────────────────────────────────────────────────────────────────────────
WHAT TO BUILD

Add a `.output()` call to `recordAttendance`'s procedure chain in
apps/server/src/modules/workflow/session.router.ts, between the existing
`.input(...)` block and the `.mutation(...)` block, describing exactly this
shape:

```typescript
z.object({
  success: z.literal(true),
  presentCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  quorumMet: z.boolean(),
})
```

Whether you inline this object literal directly in the `.output()` call, or
extract it to a named schema constant (e.g.
`RecordAttendanceOutputSchema`) placed near the top of the file alongside
the existing `dateRangeInput` constant (line 25), is your choice — match
whichever convention documents.router.ts predominantly uses for procedures
with multi-field, non-reused output shapes. If documents.router.ts mostly
inlines single-use shapes and only names schemas that are reused across
multiple procedures, inline this one too, since it's used by exactly one
procedure and there noted no evidence of reuse. State which you chose and
why in your PR description.

────────────────────────────────────────────────────────────────────────────
NON-GOALS — DO NOT BUILD

- Do not add `.output()` schemas to any other procedure in
  session.router.ts. This task is scoped to `recordAttendance` only. The
  other 9 procedures in this file (getAttendanceRecord,
  getAttendanceStatistics, getEligibleSubstituteOfficers,
  getOrderOfBusiness, scheduleDocumentForFirstReading, and others) each
  have their own return shapes and are not part of this task's scope.
- Do not change `recordAttendance`'s actual runtime behavior. This is a
  typing-only change. The values returned (`presentCount`, `absentCount`,
  `quorumMet`) must be computed exactly as they are today — do not touch
  the computation logic at lines 454, 496, or 497.
- Do not rename `quorumMet` to `quorumAchieved` or otherwise try to
  reconcile this procedure's field names against wf.md's TASK-WF-023 spec
  (which uses `quorumAchieved` — a pre-existing, separate discrepancy,
  independently noted in LOG-0097, out of scope for this task). Match what
  the LIVE CODE currently returns (`quorumMet`), not what the original spec
  document says it should be called. Renaming is a separate decision this
  task does not make.
- Do not touch wf.md or any other Group B–L architecture document. If you
  believe wf.md's TASK-WF-023 output spec should be updated to reflect
  `absentCount` and the actual `quorumMet` naming, do not edit wf.md
  directly — flag it as a new, separate findings-log entry instead, per
  this project's standing convention that agents append findings rather
  than editing architecture documents.
- Do not touch the `presidedByEmployeeIdOverride` handling logic, the VM
  lookup, the delegation-grant logic, or anything else in this procedure's
  body beyond adding the `.output()` call itself.

────────────────────────────────────────────────────────────────────────────
ACCEPTANCE CRITERIA

- [ ] `recordAttendance` has a `.output()` call in its procedure chain,
      between `.input(...)` and `.mutation(...)`.
- [ ] The output schema requires exactly four fields: `success` (literal
      `true`), `presentCount` (non-negative integer), `absentCount`
      (non-negative integer), `quorumMet` (boolean) — no more, no fewer.
- [ ] `pnpm typecheck` passes monorepo-wide with no new errors.
- [ ] Any existing test in session.router.test.ts that asserts on
      `recordAttendance`'s return value still passes unmodified. Before
      concluding this is satisfied, check whether existing tests use
      object-equality/snapshot-style assertions (which an added `.output()`
      schema should not break, since it doesn't change the actual runtime
      values, only validates them) versus something more fragile. Run the
      actual test suite (`pnpm --filter server test:unit` or equivalent —
      confirm the correct command from package.json if unsure) and confirm
      pass/fail directly; do not assume from reading test code alone.
- [ ] No change to `recordAttendance`'s actual returned values in any test
      or manual verification — this must be confirmed empirically (run the
      procedure, or its existing tests, and confirm the values match
      pre-change behavior), not just assumed because the change "should" be
      typing-only.
- [ ] A findings-log entry is appended documenting that the `.output()`
      schema was added, referencing LOG-0097 as the decision that motivated
      it. Verify the actual next-free LOG number yourself by checking the
      log's current tail before writing your entry — do not assume a
      specific number without checking, since other work may have appended
      entries between when this prompt was written and when you execute it.
      Label your entry `status: proposed`, per every other agent-authored
      entry in this log.
- [ ] State explicitly in your PR description: (a) whether you inlined the
      schema or extracted it to a named constant, and why; (b) confirmation
      that documents.router.ts's convention was checked before writing the
      schema, and what that check found; (c) confirmation that no other
      procedure in session.router.ts was touched; (d) confirmation that no
      Group B–L document (including wf.md) was edited as part of this task.
````

## STANDALONE PROMPT — Part 1 (Backend)

````
TASK-WF-FE-007-A — Close the tRPC session-enforcement gap (locked_at
and inactivity checks) and consolidate the two protectedProcedure
definitions

═══════════════════════════════════════════════════════════════
CONTEXT — READ THIS FULLY BEFORE STARTING
═══════════════════════════════════════════════════════════════

This is a TypeScript monorepo (Fastify, tRPC v11, Drizzle ORM,
PostgreSQL) for a Philippine city government document management
system. You have live, direct access to the repository. Everything
below has been independently verified against the current repository
state as of this prompt being written — file paths, line numbers, and
function names are exact, not approximate.

═══════════════════════════════════════════════════════════════
STEP 0 — MANDATORY FIRST STEP: EMPIRICALLY CONFIRM THE BUG EXISTS
═══════════════════════════════════════════════════════════════

Do this before writing or changing any code.

Static analysis of this repository shows the following chain:
- `request.auth` / `req.auth` is assigned in exactly one place codebase-
  wide: `apps/server/src/modules/iam/iam.middleware.ts`, inside the
  function `verifyAccessToken` (Hook 1 of `authMiddlewarePlugin`).
- `authMiddlewarePlugin` is registered in exactly one place:
  `apps/server/src/modules/iam/iam.routes.ts`, inside a scoped
  `fastify.register(async (protectedApp) => { await
  protectedApp.register(authMiddlewarePlugin); ... })` block that covers
  exactly 3 REST routes: `POST /api/auth/lock`, `POST /api/auth/logout`,
  `POST /api/admin/sessions/:id/terminate`.
- `apps/server/src/trpc/trpc.ts`'s `createContext` reads
  `auth: (req as any).auth || null` — meaning, if the above is complete,
  every tRPC request's `ctx.auth` should be `null`.
- Every `protectedProcedure` (both instances — see Step 1) immediately
  throws `TRPCError({ code: 'UNAUTHORIZED' })` when `ctx.auth` is falsy.

If this chain is accurate, EVERY tRPC call in the running application —
authenticated or not — should currently fail with UNAUTHORIZED. This
was not empirically confirmed against a running instance; it is a static
trace from an uploaded snapshot.

**Action required:**
1. Start the dev server (`pnpm dev` or the project's equivalent).
2. Log in through the actual UI (or via `POST /api/auth/login` +
   inspecting cookies) as any real seeded user.
3. Make one authenticated tRPC call from an actual browser session
   (e.g., load any page under `/` that fetches data via `trpc.*` — the
   DocumentListPage at `/documents` is a reasonable choice) and observe
   whether it succeeds or fails.

**If it FAILS (returns UNAUTHORIZED for a logged-in user):**
This confirms the static trace. This is a more severe, more foundational
bug than what the rest of this prompt describes — the application is
currently non-functional for all tRPC-backed pages, not merely
under-protected on locked sessions. STOP. Do not proceed with the rest
of this prompt. Report back: "Confirmed — tRPC calls fail with
UNAUTHORIZED for authenticated users. The static trace was correct.
Requesting scope guidance before proceeding, since this is broader than
session-lock enforcement alone." Do not attempt to fix this yourself
without further instruction — the fix might be exactly what Steps 1-3
below describe, or the root cause might be something this trace missed
entirely, and that needs to be determined before deciding scope.

**If it SUCCEEDS (a logged-in user's tRPC calls work normally):**
Then something not found in this trace is populating `req.auth` for
tRPC requests. Before proceeding to Step 1, find that mechanism — add
temporary logging inside `verifyAccessToken` (Hook 1) and inside
`createContext` (`apps/server/src/trpc/trpc.ts`) to see whether Hook 1
is in fact running on tRPC requests via some registration path not
caught by static grep (for example, check whether Fastify's plugin
encapsulation rules cause a hook registered in one scope to leak into a
sibling scope under some configuration this trace didn't account for —
this is not expected Fastify behavior by default, but must be ruled out
directly, not assumed). Document what you find precisely (which
function actually runs, and how it's wired) — this becomes part of the
PR description's required trace writeup (see Deliverable 8 equivalent
below). Only once you know the real mechanism should you proceed to
Step 1, since Steps 1-3 assume you know where the auth-population logic
actually lives.

Do not skip Step 0. Do not assume either outcome. Test it.

═══════════════════════════════════════════════════════════════
STEP 1 — CONSOLIDATE THE TWO protectedProcedure DEFINITIONS
═══════════════════════════════════════════════════════════════

**Current state (verified):** Two separate `initTRPC.context<Context>()
.create()` calls exist:

1. `apps/server/src/trpc.ts` (root-level, 42 lines). Defines its own
   `router`, `publicProcedure`, `protectedProcedure`. Its
   `protectedProcedure` maps `ctx.auth` into an additional `ctx.session`
   shape (`{ roles, userId, sessionId }`). Used by exactly one file:
   `apps/server/src/modules/audit/audit.router.ts` (imports `{ router,
   protectedProcedure } from '../../trpc.js'` at line 5).

2. `apps/server/src/trpc/trpc.ts` (nested, 32 lines). Defines its own
   `createContext`, `router`, `publicProcedure`, `protectedProcedure`.
   Used by all 10 other router files (`iam.router.ts`,
   `tracking.router.ts`, `workflow.router.ts`, `session.router.ts`,
   `organization.router.ts`, `panlalawigan.router.ts`,
   `complaints.router.ts`, `document-requests.router.ts`,
   `documents.router.ts`, `signatures.router.ts`). This is also the file
   whose `createContext` is actually imported and wired into
   `fastifyTRPCPlugin` in `apps/server/src/app.ts` (line 117:
   `const { createContext } = await import('./trpc/trpc.js')`).

`audit.router.ts`'s router (`createAuditTrpcRouter()`, 6 procedures:
`queryEvents`, `listOwnActions`, `listOwnOfficeDocumentActions`,
`listFullLog`, `validateChainIntegrity`, `exportEvents`) IS genuinely
mounted into the live `appRouter` (`apps/server/src/trpc/root.ts` line
18: `audit: createAuditTrpcRouter()`), reachable at `trpc.audit.*`.

**`ctx.session`'s only consumer:** `audit.router.ts` line 158, inside
the legacy `queryEvents` procedure:
```
const hasRole = ctx.session?.roles.some((r) =>
  (ALLOWED_ROLES as readonly string[]).includes(r),
) ?? ctx.auth?.roles.some((r) =>
  (ALLOWED_ROLES as readonly string[]).includes(r),
);
```
This already falls back to `ctx.auth?.roles` if `ctx.session` is absent.
No other file anywhere in the codebase references `ctx.session`.

**Decision (made by the project owner, not open for reinterpretation):**
Consolidate to one `protectedProcedure`. Specifically:

1. Delete `apps/server/src/trpc.ts` (the root-level file) entirely.
2. In `apps/server/src/modules/audit/audit.router.ts` line 5, change the
   import from `'../../trpc.js'` to `'../../trpc/trpc.js'` — i.e. use
   the same nested-file `router`/`protectedProcedure` every other router
   already uses.
3. `ctx.session` will no longer exist after this change. Line 158's
   `ctx.session?.roles.some(...)` will need its `ctx.session?.` branch
   removed, leaving just the `ctx.auth?.roles.some(...)` fallback (which
   was already there and already correct):
   ```
   const hasRole = ctx.auth?.roles.some((r) =>
     (ALLOWED_ROLES as readonly string[]).includes(r),
   );
   ```
   Verify this compiles and that `ctx.auth` is accessible with the
   correct type after the import change (it should be, since both files'
   `Context` type was `apps/server/src/modules/iam/iam.types.ts`'s
   `Context` — identical in both — but confirm directly rather than
   assume).
4. Search the whole repo one more time for any other reference to
   `ctx.session` or to `apps/server/src/trpc.ts` / `'../../trpc.js'` /
   `'./trpc.js'` (as opposed to `'../../trpc/trpc.js'` /
   `'./trpc/trpc.js'`) that this prompt's investigation might have
   missed, given time has passed since it was written. If you find any,
   stop and report them rather than silently updating them — they were
   not in scope for the trace this prompt is based on, and a
   discrepancy here means something changed after this prompt was
   written.
5. Confirm the full audit test suite (if one exists —
   check `apps/server/src/modules/audit/__tests__/` or equivalent) still
   passes after this change.

═══════════════════════════════════════════════════════════════
STEP 2 — ADD THE locked_at AND INACTIVITY CHECKS TO THE (NOW SINGLE)
protectedProcedure
═══════════════════════════════════════════════════════════════

**Target file:** `apps/server/src/trpc/trpc.ts` (the surviving file
after Step 1's deletion).

**Current content of the relevant block (verify this is still accurate
before editing — re-view the file first):**
```typescript
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.auth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource.',
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      auth: opts.ctx.auth,
    },
  });
});
```

**What to add, immediately after the `if (!opts.ctx.auth)` block, before
`return opts.next(...)`:**

Two checks, both against the current session row, matching exactly what
`iam.middleware.ts`'s `verifyAccessToken` already does for REST (Hook 1,
Steps 4-5 — read that function in full before writing this, at
`apps/server/src/modules/iam/iam.middleware.ts` lines 134-217, since
your new code must replicate its behavior, not merely approximate it):

1. **Session lookup.** `opts.ctx.auth.sessionId` is available (confirmed
   present on `AuthContext`,
   `apps/server/src/modules/iam/iam.types.ts` line 76). Look up the
   session via the repository: this file does not currently have
   `iamRepository` injected into its context — check how other parts of
   this codebase access `fastify.iamRepository` from inside a tRPC
   procedure (e.g. `opts.ctx.req.server.iamRepository`, mirroring the
   pattern already used in `audit.router.ts`'s
   `(ctx.req.server as any).auditService` — confirm the exact equivalent
   for `iamRepository` before writing this, do not assume the property
   name matches without checking `apps/server/src/modules/iam/iam.plugin.ts`
   for what's actually decorated onto the Fastify instance).

   Use `findSessionById(sessionId): Promise<SessionRow | null>` (already
   exists, `apps/server/src/modules/iam/iam.types.ts` line 323;
   `SessionRow = InferSelectModel<typeof sessions>`, line 25). This
   performs a fresh DB query per tRPC call, matching the REST
   middleware's own approach (per this task's original design note:
   "real per-request cost but consistent with existing pattern" — this
   is an accepted tradeoff, not something to optimize away in this PR).

2. **Locked check.** If the session is not found, or `session.active`
   is false, throw `TRPCError({ code: 'UNAUTHORIZED', message: 'Session
   not found or inactive' })` — matching Hook 1 Step 3's REST behavior
   exactly (same message string).

   If `session.locked_at !== null`, throw:
   ```
   throw new TRPCError({
     code: 'UNAUTHORIZED',
     message: 'SESSION_LOCKED',
   });
   ```
   Use exactly this `message` value, not `cause`. This is a deliberate
   choice, not the task's originally-proposed default — see the
   rationale note below. Do NOT also set `cause` for this specific
   error; consistency with the `message`-based signal matters more here
   than matching the `cause`-string convention used elsewhere in this
   codebase for a different purpose (ABAC denials in
   `workflow.policy.ts`), since this error needs to be reliably
   detectable client-side without any additional server-side plumbing
   (see Step 3 note on why `cause` alone isn't visible to the client by
   default in this codebase's current tRPC configuration).

   **No unlock-path exclusion is needed here.** Unlike the REST
   middleware (which excludes `request.url !== '/api/auth/unlock'`
   because `/api/auth/unlock` is itself a route the middleware would
   otherwise gate), `/api/auth/unlock` is a REST endpoint, not a tRPC
   procedure — this check runs only inside `protectedProcedure`, which
   `/api/auth/unlock` never passes through. Confirm this holds (it
   should, given the two-endpoint types are structurally distinct in
   this codebase) but do not add an unlock-path bypass unless you find
   a reason one is actually needed.

3. **Inactivity check.** Fold this in as part of the same fix — do not
   treat it as a separate follow-up PR, since it is the identical root
   cause (same missing enforcement, same function, same session lookup
   you've already performed for the locked check above). Reuse the
   session row already fetched in step 1 above; do not query twice.

   Match Hook 1 Step 5's exact logic
   (`apps/server/src/modules/iam/iam.middleware.ts` lines 174-194):
   compute `idleMs = Date.now() - session.lastActivityAt.getTime()`;
   if `idleMs > INACTIVITY_TIMEOUT_MS` (import this constant — check
   whether it's exported from `iam.middleware.ts` already, or whether
   you need to export it there first; it is currently defined as a
   module-level `const` at line 48 of that file and is NOT currently
   exported — you will need to add `export` to that declaration, since
   both the REST and tRPC paths must use the identical timeout value,
   not two independently-maintained copies of the same number):
   - Best-effort terminate the session
     (`iamRepository.terminateSession(sessionId, 'inactivity', null)`)
     and best-effort revoke refresh tokens
     (`iamRepository.revokeRefreshTokensBySessionId(sessionId,
     'logout')`), matching Hook 1's try/catch-and-continue pattern
     exactly (non-fatal failures on these two calls should not prevent
     the 401 from being returned).
   - Throw `TRPCError({ code: 'UNAUTHORIZED', message: 'SESSION_EXPIRED'
     })`. Note: the REST version also clears cookies
     (`clearAuthCookies(reply)`) — a tRPC procedure does not have direct
     access to `reply` the way a REST handler does. Check whether
     `opts.ctx.req` or an equivalent gives you access to the Fastify
     `reply` object inside a tRPC procedure context (it does not, by
     tRPC's context shape, unless something has been specifically wired
     for this — check `CreateFastifyContextOptions`'s available fields,
     imported at the top of `trpc/trpc.ts`, which does include both
     `req` AND `res` — note `createContext`'s current destructuring,
     `{ req, res }`, only uses `req` in its return value; `res` is
     received but discarded). If `res` (the Fastify reply) is available
     via `CreateFastifyContextOptions`, thread it into `Context` (add a
     `res` field alongside the existing `auth`/`db`/`req` fields, update
     `Context`'s type in `iam.types.ts` accordingly) so cookie-clearing
     can happen here too, matching REST behavior exactly. If this
     turns out to be more involved than a small addition, stop and flag
     it rather than shipping a version that leaves cookies stale on a
     tRPC-detected expiry — a partial fix here (throwing the error
     without clearing cookies) is a real, worth-flagging gap, not a
     minor omission, since it would leave the browser holding cookies
     the server considers invalid.

**Rationale for using `message` instead of `cause` for the
SESSION_LOCKED signal (do not second-guess this in the PR, it was a
deliberate decision, but the reasoning is included here so you
understand why, in case you hit an unexpected obstacle implementing
it):**

`apps/server/src/app.ts`'s `fastifyTRPCPlugin` registration (lines
125-134) does not currently configure a custom `errorFormatter`. On
tRPC v11, `TRPCError`'s `cause` property is not serialized to the client
by default — it's a server-side-only field, visible in the `onError`
server log callback (which `app.ts` does configure, line 130-132) but
not in the JSON error envelope the browser receives. `message`, by
contrast, IS part of the default client-visible shape (confirmed via
`apps/web/src/lib/query-client.ts` line 10, which already reads
`error.data?.code` today — `error.data.message` is available via the
identical mechanism). Using `message` as the discriminant means Part 2
(frontend) can detect this signal with zero additional server-side
work. Adding a custom `errorFormatter` to expose `cause` instead was
considered and rejected for this specific case — it's the more
"correct" long-term pattern in the abstract, but it's more moving parts
for a single specific signal, and this prompt intentionally keeps Part 1
and Part 2 decoupled: Part 2 should not have to wait on a server-side
`errorFormatter` addition to be testable.

═══════════════════════════════════════════════════════════════
STEP 3 — VERIFY THE 401-TO-HTTP-STATUS INTERACTION WITH EXISTING
FRONTEND CODE (read-only check, no frontend changes in this prompt)
═══════════════════════════════════════════════════════════════

This step does not require you to change any frontend code — Part 2
(a separate prompt) owns the frontend. But you must verify one thing
before considering Part 1 done, because it affects whether Part 2 is
buildable on top of what you ship:

`apps/web/src/lib/trpc.ts`'s `httpBatchLink` has a custom `fetch`
implementation that checks `response.status === 401` at the raw HTTP
level (lines 42-49) and, on a 401, attempts a silent refresh via
`POST /api/auth/refresh` before retrying the original request. Since
tRPC's default HTTP-status mapping sends `UNAUTHORIZED`-coded errors as
raw HTTP 401, your new `SESSION_LOCKED` error (Step 2) will ALSO be a
raw HTTP 401 — meaning, without Part 2's changes, the existing frontend
code will currently try to silently refresh and retry a locked-session
error, rather than showing anything related to locking. This is
expected and is Part 2's problem to solve (it will need to distinguish
`message === 'SESSION_LOCKED'` from other 401s before deciding whether
to attempt a refresh-and-retry). Do not attempt to fix this from the
Part 1 / backend side — do not, for example, change the HTTP status
code your error returns to something other than 401 to avoid the
collision. Confirm you understand this interaction exists and note it
explicitly in your PR description so whoever picks up Part 2 knows the
backend's error is real HTTP 401 and Part 2 must therefore inspect the
body, not the status code, to tell it apart from other 401s.

═══════════════════════════════════════════════════════════════
NON-GOALS — DO NOT DO ANY OF THE FOLLOWING
═══════════════════════════════════════════════════════════════

- Do not add step-up (re-)authentication for high-risk actions —
  explicitly deferred to Phase 2 by both B5 §4.6 and ADR-AUTH-010.
- Do not add a "maximum session age" ceiling shorter than the 14-day
  refresh token lifetime — explicitly NOT adopted by ADR-AUTH-010.
- Do not change any logic inside the REST `/api/auth/lock`,
  `/api/auth/unlock` route handlers (`iam.routes.ts`) or inside
  `unlockSession`'s argon2/password-verification logic
  (`iam.service.ts`) — these are confirmed correct and complete. You are
  only adding an equivalent check to the tRPC request path; the
  underlying session-locking mechanism itself does not change.
- Do not "fix" the `locked_at` (snake_case) vs. `lastActivityAt`
  (camelCase) naming inconsistency in
  `packages/database/schema/iam.schema.ts` (lines 111 vs. 114) or
  anywhere it's referenced. This is a real, pre-existing inconsistency,
  confirmed at the schema-definition source, not a typo introduced by
  this task. Use `locked_at` exactly as it currently exists. If you
  believe it should be renamed, do not do so in this PR — flag it
  separately (see Findings Log instruction below).
- Do not add ABAC policy Gate 1-5 evaluation to `protectedProcedure`.
  This is a related but genuinely separate gap, already flagged in
  `docs/development-findings-log.md` as LOG-0067 (`status: proposed`).
  Do not fold LOG-0067's fix into this PR — it is a different kind of
  check (authorization/policy, not session-state) and conflating the two
  PRs would make LOG-0067's eventual review harder, not easier.
- Do not modify `apps/web` in this task. Part 2 is a separate,
  standalone prompt.

═══════════════════════════════════════════════════════════════
FINDINGS LOG
═══════════════════════════════════════════════════════════════

The entry documenting this investigation's discovery has already been
written and should be appended to `docs/development-findings-log.md` as
`[LOG-0097]` — the exact text is provided below. Verify the log's
current tail still shows LOG-0096 as the highest entry before appending
(if a newer entry already exists with a higher number, time has passed
since this prompt was written and something else was appended first —
in that case renumber this entry to the next free number instead of
0097, and note in your PR description that you renumbered it and why).
Append it verbatim (adjusting only the number if needed) as the final
step of this task, appended below the existing last entry, keeping
chronological order:

### [LOG-0097] tRPC requests have no auth/session enforcement path — locked_at and inactivity checks (B5 §4.4, §4.6) both silently skip tRPC; two separate protectedProcedure instances exist server-side

- date: 2026-07-13
- task_id: TASK-WF-FE-007
- status: proposed
- affects: B5 (§4.4, §4.6), ADR-AUTH-010, trpc.ts, apps/server/src/trpc/trpc.ts, apps/server/src/modules/audit/audit.router.ts

**What was found:**
`iam.middleware.ts`'s Hook 1 (`verifyAccessToken`) is the only place in the
server codebase that ever assigns to `request.auth` (confirmed via
repo-wide grep, excluding tests). This hook — which contains both the
`locked_at` check (B5 §4.6) and the 30-minute inactivity/expiry check
(B5 §4.4) — is only ever registered via `authMiddlewarePlugin`, which is
only ever `.register()`-ed once, inside `iam.routes.ts`'s scoped
protected sub-app covering exactly 3 REST routes
(`/api/auth/lock`, `/api/auth/logout`,
`/api/admin/sessions/:id/terminate`). No global hook, no alternate JWT
verification path, and no `decorateRequest` default exists anywhere else.
`trpc/trpc.ts`'s `createContext` reads `(req as any).auth || null`, which
by this trace should evaluate to `null` on every tRPC request.

Separately: two independent `protectedProcedure` definitions existed, from
two separate `initTRPC...create()` calls — `apps/server/src/trpc.ts`
(root-level) and `apps/server/src/trpc/trpc.ts` (nested). 10 of 11
routers used the nested one, which is also the one `app.ts` wires to
`fastifyTRPCPlugin`'s `createContext`. `audit.router.ts` alone used the
root-level one, and its router (6 procedures, including a mutation) is
genuinely mounted into `appRouter` under `trpc.audit.*`. A fix applied
only to the nested file's `protectedProcedure` would have left
`trpc.audit.*` completely unaddressed.

Related but distinct: LOG-0067 (`proposed`) separately flags that
`protectedProcedure` doesn't run ABAC policy Gates 1-5. That is a
different gap (authorization-level, not session-state-level) in the same
function; this entry does not supersede or duplicate it.

**What was implemented:**
[Fill in after this task completes — describe: (1) the Step 0 empirical
result, i.e. whether tRPC calls worked before this fix or not, (2)
whether consolidation went as planned or hit an obstacle, (3) whether
the inactivity-check cookie-clearing addition (Step 2, item 3) was
completed as described or left partial, and if partial, why.]

═══════════════════════════════════════════════════════════════
BEFORE SUBMITTING THIS PR, CONFIRM EACH ITEM:
═══════════════════════════════════════════════════════════════

- [ ] Step 0 was performed and its result (success or failure) is
      stated explicitly in the PR description, before any code changes
      are described.
- [ ] The two `protectedProcedure` definitions have been consolidated
      into one (root-level `apps/server/src/trpc.ts` deleted;
      `audit.router.ts` repointed; `ctx.session` reference removed with
      `ctx.auth` fallback preserved).
- [ ] `locked_at` check added to the single surviving
      `protectedProcedure`, using `message: 'SESSION_LOCKED'` (not
      `cause`).
- [ ] Inactivity/expiry check added to the same `protectedProcedure`,
      reusing the same session lookup, matching Hook 1 Step 5's exact
      timeout constant (now exported) and termination/revocation
      behavior.
- [ ] Cookie-clearing on tRPC-detected expiry was either implemented
      (via a `res` field threaded into `Context`) or explicitly flagged
      as incomplete with a clear explanation of the obstacle — not
      silently omitted.
- [ ] PR description states plainly: what Step 0 found; what the actual
      mechanism populating `req.auth` for tRPC turned out to be (if
      Step 0 succeeded and required further investigation) or confirms
      no tRPC calls worked before this fix (if Step 0 failed);
      confirmation that REST route handlers and `unlockSession` were not
      touched; and the 401-collision note from Step 3 for whoever picks
      up Part 2.
- [ ] `docs/development-findings-log.md` entry appended (LOG-0097 or
      renumbered per the instructions above), with "What was
      implemented" filled in.
A reviewer will verify each one independently.
````

---

## STANDALONE PROMPT — Part 2 (Frontend)

````
TASK-WF-FE-007-B — Idle warning, lock screen, and unlock flow

═══════════════════════════════════════════════════════════════
PREREQUISITE — DO NOT START UNTIL THIS IS TRUE
═══════════════════════════════════════════════════════════════

This prompt assumes TASK-WF-FE-007-A (Part 1) has already shipped and
merged. Specifically, it assumes:
- A single `protectedProcedure` exists at
  `apps/server/src/trpc/trpc.ts`, which now throws
  `TRPCError({ code: 'UNAUTHORIZED', message: 'SESSION_LOCKED' })` when
  a tRPC call is made against a locked session.
- This error is visible client-side as `error.data.code === 'UNAUTHORIZED'`
  combined with `error.message === 'SESSION_LOCKED'` (or the equivalent
  path through `error.shape.message` — confirm which one your tRPC
  client version actually surfaces by triggering the error once and
  inspecting it directly, do not assume without checking, since minor
  version differences in `@trpc/client`/`@trpc/react-query` sometimes
  change exactly where a formatted error message ends up in the client-
  side error object shape).

Before writing any code: confirm this is true by checking git log /
recent merges, or by locking a session (`POST /api/auth/lock` via
curl/Postman with valid cookies) and making one tRPC call, and
inspecting the actual error shape received client-side. If Part 1 has
not landed, STOP and report this rather than building against a backend
error shape that doesn't exist yet.

═══════════════════════════════════════════════════════════════
CONTEXT — CONFIRMED CURRENT STATE OF THE FRONTEND
═══════════════════════════════════════════════════════════════

React Router DOM v6, TanStack Query v5, tRPC v11 (`@trpc/react-query
^11.18.0`), React Hook Form + Zod, TanStack Table v8, Zustand.

**Auth state:** lives in `apps/web/src/stores/session.store.ts`
(`useSessionStore`, Zustand). There is NO `auth-context.tsx` file
anywhere in this codebase — do not create one, do not look for one, and
if you find any comment or reference to one elsewhere in the codebase
that seems to imply it should exist, that reference is stale; ignore it
in favor of what's described here.

`useSessionStore`'s shape (verified,
`apps/web/src/stores/session.store.ts`):
```typescript
export interface ActiveUserIdentity {
  userId: string;
  username: string;
  displayName: string;
  sessionId: string;
  expiresAt: string;
  roleCodes: string[];
  officeScopeId: string | null;
  officeCode: string | null;
  committeeIds: string[];
}

interface SessionState {
  identity: ActiveUserIdentity | null;
  isHydrated: boolean;
}

interface SessionActions {
  setIdentity: (identity: ActiveUserIdentity) => void;
  clearIdentity: () => void;
  setHydrated: () => void;
}

export const useSessionStore = create<SessionState & SessionActions>(...)
```
Use `identity.displayName` (or `identity.username` as fallback — note
`displayName` is CURRENTLY set to a copy of `username` at both hydration
and login time, per existing code, so in practice they're identical
today; use `displayName` anyway, since it's the semantically correct
field and this may change independently later) for the lock screen's
"current user" display.

**Auth actions:** `apps/web/src/hooks/useAuthActions.ts` (`useAuthActions`
hook) is the existing pattern for auth-related fetches. Current content:
```typescript
import { useCallback } from 'react';
import { generatePkcePair } from '../lib/pkce.js';
import { useSessionStore } from '@/stores';

interface AuthResponse {
  user: { id: string; username: string; };
  sessionId: string;
  expiresAt: string;
  roleCodes: string[];
  officeScopeId: string | null;
  officeCode: string | null;
  committeeIds: string[];
}

export function useAuthActions() {
  const login = useCallback(async (username: string, password: string) => {
    /* ... POST /api/auth/login, sets identity via useSessionStore ... */
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      useSessionStore.getState().clearIdentity();
    }
  }, []);

  return { login, logout };
}
```
Extend this file with `lock` and `unlock` functions, following the exact
same pattern as `logout` (fetch with `credentials: 'include'`, using
`import.meta.env.VITE_API_URL` as the base). Do not create a separate
new hook file for these — add them to this existing hook and export them
alongside `login`/`logout`.

**Layout / routing:** `apps/web/src/main.tsx` defines the router.
Authenticated routes are wrapped: `<RequireAuth><AuthenticatedLayout />
</RequireAuth>`, with all authenticated pages as children rendered via
`<Outlet />` inside `AuthenticatedLayout`
(`apps/web/src/components/AuthenticatedLayout.tsx`). `RequireAuth`
(`apps/web/src/components/RequireAuth.tsx`) redirects to `/login` if
`!identity`, after checking `isHydrated`. `/login` is a real, working
route (confirmed, `main.tsx` line 62,
`apps/web/src/pages/auth/LoginPage.tsx`).

`SessionHydrator` (`apps/web/src/components/SessionHydrator.tsx`) mounts
once at the very top of the app (`main.tsx`, inside `trpc.Provider` /
`QueryClientProvider`, above `RouterProvider`) and calls
`POST /api/auth/refresh` on mount to hydrate `useSessionStore` on page
load.

**Modal/overlay state:** `apps/web/src/stores/ui.store.ts`
(`useUIStore`) is the established pattern for modal/dialog open state in
this codebase (per its own header doc-comment: "Zustand store for UI
overlay state — modals, sheets, command palette, toasts... Stateless
shadcn Dialog/Sheet primitives in @batac/ui receive open/onOpenChange
from this store at the page level. No component in packages/ui manages
its own open state."). IMPORTANT — confirmed fact you must know before
using this: **`useUIStore` currently has zero consumers anywhere in
`apps/web/src`.** It is fully defined and exported but not yet used by
any page or component. You are choosing to use it anyway, per explicit
direction, BECAUSE it's the documented intended pattern and this task is
a good opportunity to validate it with a real feature — not because
there's already a working precedent to copy from. Follow its existing
internal shape exactly (see current content below) when adding to it;
do not restructure the file.

Current `useUIStore` content (add to this, following the exact same
`openX`/`closeX` pattern already used for `sheetOpen`/`dialogOpen`/
`paletteOpen`):
```typescript
interface UIState {
  sheetOpen: boolean;
  sheetDocId: string | null;
  dialogOpen: boolean;
  dialogDocId: string | null;
  paletteOpen: boolean;
  toast: ToastState;
  openSheet: (docId: string) => void;
  closeSheet: () => void;
  openDialog: (docId: string) => void;
  closeDialog: () => void;
  openPalette: () => void;
  closePalette: () => void;
  showToast: (variant: ToastVariant, title: string, body?: string) => void;
  dismissToast: () => void;
}
```
Add: `idleWarningOpen: boolean`, `openIdleWarning: () => void`,
`closeIdleWarning: () => void` — same shape as `paletteOpen`/
`openPalette`/`closePalette` (boolean with no associated ID, since there's
only ever one idle warning, unlike `sheetOpen`/`dialogOpen` which carry a
`docId`).

Do NOT put the lock-screen overlay's own open/closed state in
`useUIStore`. The lock screen is not a dismissible modal in the normal
sense (it can't be closed by clicking outside or pressing Escape, and it
needs to be triggerable from a context — the cross-tab tRPC error
interceptor — that isn't a typical "user clicked something" UI action).
Give the lock screen its own boolean in `useSessionStore` instead (see
below) — it's fundamentally session state, not transient UI state, and
belongs alongside `identity`/`isHydrated` rather than alongside
`dialogOpen`/`sheetOpen`.

**Existing tRPC client (`apps/web/src/lib/trpc.ts`) — read this fully,
it is NOT a typical tRPC "links" error handler:**
```typescript
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/src/trpc/root.js';

export const trpc = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function performSilentRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) { return refreshPromise; }
  isRefreshing = true;
  refreshPromise = fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => { isRefreshing = false; refreshPromise = null; });
  return refreshPromise;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/api/trpc`,
      async fetch(url, options) {
        const fetchOptions = { ...options, credentials: 'include' as const } as RequestInit;
        let response = await fetch(url, fetchOptions);
        if (response.status === 401) {
          const success = await performSilentRefresh();
          if (success) {
            response = await fetch(url, fetchOptions);
          } else {
            window.location.href = '/login';
          }
        }
        return response;
      },
    }),
  ],
});
```

**Why this matters for you:** this custom `fetch` inspects the raw HTTP
response status BEFORE the body is parsed into a tRPC result. Your new
`SESSION_LOCKED` backend error (Part 1) IS a raw HTTP 401 (tRPC's
default status mapping for `UNAUTHORIZED`-coded errors), so it WILL
currently be caught by `response.status === 401` on line 42 above — and,
without your changes, would be misrouted into the silent-refresh-and-
retry path, which is wrong for a locked session (the refresh token is
still valid per B5 §4.6/ADR-AUTH-010, so `performSilentRefresh()` would
likely succeed, and the code would retry the original request — which
would fail with `SESSION_LOCKED` again, since refreshing the access
token does nothing to clear `locked_at`).

**You must modify this function** to distinguish a `SESSION_LOCKED` 401
from a normal expired-token 401, BEFORE deciding whether to attempt
`performSilentRefresh()`. To do this: after getting a 401 response,
clone and parse the response body (use `response.clone().json()` so the
original response can still be returned/re-read downstream if needed)
and check whether the parsed body indicates `SESSION_LOCKED` — the exact
JSON path depends on tRPC's standard error envelope shape combined with
whatever `message` string Part 1 set; confirm the exact shape by
triggering the real error once (lock a session, make a tRPC call,
inspect the actual JSON body in dev tools) rather than guessing the path
from tRPC's general documentation, since the exact envelope shape can
vary slightly by tRPC minor version and by whether the request was
batched (this client uses `httpBatchLink`, so a single logical call may
arrive as an array-wrapped batch response — check whether the body is an
array before indexing into it as if it were a single error object).

If the 401 is a `SESSION_LOCKED` error: do NOT call
`performSilentRefresh()`. Instead, trigger the lock overlay (call
`useSessionStore.getState().<whatever action you add for this — see
below>` directly, since this is a module-level function outside React
component context, matching how `performSilentRefresh` itself is
already written as a plain async function outside any component). Then
return the original 401 `response` as-is (do not retry) — the calling
`useQuery`/`useMutation` will see a failed request, which is fine, since
the lock overlay will now be covering the screen and the underlying page
does not need this particular call to have succeeded.

If the 401 is NOT `SESSION_LOCKED` (a normal expired/invalid token):
proceed exactly as the existing code already does (attempt silent
refresh, retry on success, redirect to `/login` on failure). Do not
change this path's behavior.

**Also check `apps/web/src/lib/query-client.ts`** — it already special-
cases `UNAUTHORIZED`-coded tRPC errors to disable TanStack Query's retry
logic:
```typescript
retry: (failureCount, error) => {
  if (isTRPCClientError<AppRouter>(error) && error.data?.code === 'UNAUTHORIZED') {
    return false;
  }
  return failureCount < 3;
},
```
This already covers your new `SESSION_LOCKED` error too (since it's also
`UNAUTHORIZED`-coded) — no change needed here, but confirm this remains
true after your changes (i.e., a locked-session tRPC call should not be
silently retried 3 times by TanStack Query while the lock overlay is
showing).

═══════════════════════════════════════════════════════════════
2a. IDLE TIMER + 25-MINUTE WARNING
═══════════════════════════════════════════════════════════════

New file: `apps/web/src/hooks/useIdleTimer.ts`

- Monitor keyboard, mouse, AND touch events (touch is a deliberate,
  reasonable addition for tablet use in a government-office context —
  not contradicted by any source document, include it).
- At 25 minutes of no detected activity: call
  `useUIStore.getState().openIdleWarning()`.
- Warning modal (build as a new component,
  `apps/web/src/components/IdleWarningModal.tsx`, using the `Dialog`
  primitive from `@batac/ui` — confirmed to exist at
  `packages/ui/src/components/ui/dialog.tsx`, built on
  `@radix-ui/react-dialog` — wire its `open` prop to
  `useUIStore((s) => s.idleWarningOpen)` and `onOpenChange` to
  `useUIStore.getState().closeIdleWarning`):
  - **"I'm still here"** button: make any lightweight authenticated
    request to reset server-side activity tracking. Use
    `trpc.iam.getCurrentUser` (or whichever existing, cheap, already-
    authenticated tRPC query this codebase has — check `iam.router.ts`
    for the lightest-weight existing query procedure; do not create a
    new dedicated keepalive endpoint, per the Non-Goals section below).
    On completion, call `closeIdleWarning()` and reset the idle timer's
    internal clock back to zero.
  - **"Lock now"** button: call `closeIdleWarning()`, then trigger the
    same lock action described in 2b below.
- At 30 minutes total idle (5 minutes after the warning, if not
  dismissed): automatically trigger the same lock action as 2b, and
  close the warning modal if still open.

═══════════════════════════════════════════════════════════════
2b. LOCK SCREEN
═══════════════════════════════════════════════════════════════

**State:** Add to `useSessionStore`
(`apps/web/src/stores/session.store.ts`) — NOT `useUIStore`, per the
reasoning above:
```typescript
interface SessionState {
  identity: ActiveUserIdentity | null;
  isHydrated: boolean;
  isLocked: boolean;          // ADD
}
interface SessionActions {
  setIdentity: (identity: ActiveUserIdentity) => void;
  clearIdentity: () => void;
  setHydrated: () => void;
  setLocked: () => void;      // ADD
  setUnlocked: () => void;    // ADD
}
```
(`isLocked: false` as the initial state, alongside the existing
`identity: null` / `isHydrated: false`.)

**Trigger paths (there are three — all three must call
`setLocked()`):**
1. User explicitly clicks "Lock" in the Topbar account menu (see the
   Topbar change below).
2. `useIdleTimer`'s 30-minute auto-lock (2a above).
3. The tRPC client interceptor (in `lib/trpc.ts`, described above)
   detecting a `SESSION_LOCKED` error from a DIFFERENT tab/device having
   locked the same session. This is a REQUIRED path, not optional — the
   lock overlay must be reachable this way, not only via the Topbar menu
   item. A session is server-side state; nothing ties it to one browser
   tab (confirmed: nothing in the schema or B5 does this), so a second
   tab or device locking the session must be detected and reflected here
   reactively.

**Actual lock action** (add to `useAuthActions.ts`, alongside
`login`/`logout`):
```typescript
const lock = useCallback(async () => {
  await fetch(`${import.meta.env.VITE_API_URL}/api/auth/lock`, {
    method: 'POST',
    credentials: 'include',
  });
  useSessionStore.getState().setLocked();
}, []);
```
No request body needed (confirmed: `POST /api/auth/lock` takes none).
Do not check the response for success/failure in any special way beyond
what `logout`'s existing pattern already does (i.e., none) — if the
fetch itself throws (network error), let it propagate; do not add retry
logic here.

**Rendering:** the overlay must NOT be a route change. Mount it inside
`AuthenticatedLayout.tsx`, as a sibling to `<Outlet />` (not replacing
it), so the underlying page's React tree, scroll position, and any
in-progress form state are preserved, not unmounted. Render
conditionally based on `useSessionStore((s) => s.isLocked)`. Use a
full-screen `Dialog` (or a plain fixed-position overlay div, if `Dialog`
proves awkward for a non-dismissible full-screen case — a lock screen
must NOT be dismissible by clicking outside or pressing Escape, unlike a
normal `Dialog`; check `DialogContent`'s props for a way to disable
outside-click/Escape dismissal, likely via `onInteractOutside`/
`onEscapeKeyDown` preventDefault, before falling back to a plain div if
`Dialog` can't be made non-dismissible cleanly).

**Content:**
- Current user's `displayName` (from `useSessionStore`, see above).
- Password-only field (React Hook Form + Zod, matching this codebase's
  established form pattern — check `LoginPage.tsx` for the existing Zod
  schema style used for password fields, reuse the same validation
  rules rather than inventing new ones).
- Submit button.
- **Do NOT include:** a username field, any PKCE flow, or anything
  resembling a full login form. This is a hard requirement from B5
  §4.6: "Re-authentication (password only; no full login flow)."

═══════════════════════════════════════════════════════════════
2c. UNLOCK
═══════════════════════════════════════════════════════════════

Add to `useAuthActions.ts`:
```typescript
const unlock = useCallback(async (password: string): Promise
  { ok: true } | { ok: false; code: 'INVALID_PASSWORD' | 'REFRESH_REQUIRED'; message?: string }
> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });

  if (response.ok) {
    useSessionStore.getState().setUnlocked();
    return { ok: true };
  }

  const data = await response.json().catch(() => ({}));
  if (data.code === 'REFRESH_REQUIRED') {
    return { ok: false, code: 'REFRESH_REQUIRED', message: data.message };
  }
  return { ok: false, code: 'INVALID_PASSWORD' };
}, []);
```
(Confirmed response shapes, `apps/server/src/modules/iam/iam.routes.ts`
lines 288-367 and `apps/server/src/modules/iam/iam.service.ts` lines
986-1118: success → `{ unlocked: true }`, 200; wrong password → 401
`{ code: 'INVALID_PASSWORD' }`; invalid refresh token → 401
`{ code: 'REFRESH_REQUIRED', message: '...' }` with cookies already
cleared server-side via `clearAuthCookies(reply)` before this response
is sent — you do not need to clear cookies client-side, they're already
gone by the time this response arrives.)

**Wire this into the lock screen's submit handler:**
- On `{ ok: true }`: call nothing further (the `unlock` function already
  called `setUnlocked()`). The overlay disappears (since it's rendered
  conditionally on `isLocked`, which is now `false`), and the underlying
  page resumes exactly where it was — no reload, no re-navigation, no
  refetch triggered by you specifically (if TanStack Query naturally
  refetches stale queries on window refocus or similar, that's existing
  behavior, not something to add here).
- On `{ ok: false, code: 'INVALID_PASSWORD' }`: show an inline
  "Incorrect password" error message directly on the form field, keep
  the overlay showing, allow the user to retry. **Important — do not
  attempt to distinguish this from any other reason unlock might fail
  with this same code** (the backend deliberately returns the identical
  `INVALID_PASSWORD` code whether the credential row is missing or the
  password itself was wrong, specifically to avoid a user-enumeration
  signal — confirmed, `iam.service.ts` lines 1008-1028). Your UI must
  not attempt to guess or display a different message for either case.
- On `{ ok: false, code: 'REFRESH_REQUIRED' }`: do NOT retry via the
  lock overlay. Immediately redirect to `/login` (confirmed to exist as
  a real route). A `window.location.href = '/login'` full navigation is
  acceptable here (matching the existing pattern already used in
  `lib/trpc.ts` line 47 for the equivalent case) — this does not need to
  be a React Router `navigate()` call, since the whole point is a full
  reset of client state (the session this tab knew about is gone).

═══════════════════════════════════════════════════════════════
TOPBAR — ADD 'lock' MENU ITEM
═══════════════════════════════════════════════════════════════

**Confirmed current state:**
`packages/ui/src/components/domain/Topbar.tsx` line 24:
```typescript
onUserMenuAction?: (action: "profile" | "logout") => void;
```
Change to:
```typescript
onUserMenuAction?: (action: "profile" | "logout" | "lock") => void;
```

Add a third menu button, following the exact same structure as the
existing `"profile"`/`"logout"` buttons (lines 148-161 of the current
file — copy the pattern, not the exact styling classes, since "Lock"
should probably use neutral styling like "Profile" rather than the
danger-red styling used for "Logout"):
```tsx
<button
  type="button"
  onClick={() => onUserMenuAction?.("lock")}
  className="w-full text-left px-2 py-1.5 text-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary rounded-md transition-colors touch-exempt"
>
  Lock
</button>
```
Place it between "Profile" and "Logout" (logical grouping: account
actions, then a destructive session-ending action last).

Then, in `apps/web/src/components/AuthenticatedLayout.tsx`, extend the
existing `onUserMenuAction` handler (currently lines 212-218):
```typescript
onUserMenuAction={(action) => {
  if (action === 'logout') {
    void logout();
  } else if (action === 'profile') {
    // No-op per F1 specification - no profile page exists yet.
  }
}}
```
to:
```typescript
onUserMenuAction={(action) => {
  if (action === 'logout') {
    void logout();
  } else if (action === 'lock') {
    void lock();
  } else if (action === 'profile') {
    // No-op per F1 specification - no profile page exists yet.
  }
}}
```
(`lock` destructured from `useAuthActions()` alongside the existing
`logout`.)

**Note on task routing:** `Topbar.tsx` lives in `packages/ui`, which per
this project's `AGENTS.md` Section 2 routing table would normally fall
under "Build a Tier 3 domain component in `packages/ui`" (requiring
F5 → J6 → F6 → DESIGN.md → F7 reading) rather than "Build a frontend
page or view in `/apps/web`" (F4 → F1 → F5 → J6 → I2 → E1) — since you
are modifying, not building, an existing Tier 3 component, and the
modification is small (one new union member, one new button matching an
exact existing pattern), this prompt treats it as in-scope for this task
rather than a separate task. If your read of AGENTS.md's Tier 3 rules
(specifically the note on every Tier 3 PR requiring a `/dev/{component-
name}` route as a mandatory deliverable) suggests this small addition
should still trigger that requirement, check whether `/dev/components/
topbar` (confirmed to exist, `main.tsx` line 184-186,
`TopbarPage.tsx`) already exercises `onUserMenuAction` and its states —
if so, verify the new `'lock'` action's button renders correctly there
too, since that dev page may be the actual visual acceptance gate for
this specific change per that convention. If it does not already cover
`onUserMenuAction`'s states, flag this as a gap rather than building out
full dev-page coverage as part of this prompt — that would be a scope
expansion beyond what this prompt asked for.

═══════════════════════════════════════════════════════════════
NON-GOALS — DO NOT DO ANY OF THE FOLLOWING
═══════════════════════════════════════════════════════════════

- Do not build a new dedicated keepalive REST/tRPC endpoint. Use an
  existing, already-authenticated, lightweight tRPC query for the "I'm
  still here" action.
- Do not add step-up (re-)authentication for high-risk actions.
- Do not add a "maximum session age" ceiling.
- Do not touch the REST `/api/auth/lock`/`/api/auth/unlock` handlers or
  `unlockSession`'s implementation — Part 1 already confirmed these are
  correct and untouched; this prompt only consumes them.
- Do not attempt to distinguish the two reasons `INVALID_PASSWORD` can
  occur (missing credential row vs. wrong password) — display one
  generic message for both, as instructed above.
- Do not create `auth-context.tsx` or reference it anywhere — it does
  not exist in this codebase and should not be introduced by this task.
- Do not add the lock-screen's own visibility state to `useUIStore` —
  it belongs on `useSessionStore`, per the reasoning given above.

═══════════════════════════════════════════════════════════════
PR DESCRIPTION MUST STATE EXPLICITLY:
═══════════════════════════════════════════════════════════════

(a) Confirmation that Part 1 had already landed before this task began,
    and what the actual client-visible error shape for `SESSION_LOCKED`
    turned out to be (exact field path — e.g. `error.message` vs.
    `error.shape.message` vs. something else — confirmed by triggering
    the real error, not assumed).
(b) Confirmation the `lib/trpc.ts` custom-fetch change correctly
    distinguishes a `SESSION_LOCKED` 401 from a normal-expiry 401 before
    deciding whether to attempt silent refresh — describe how you
    verified this (e.g., manually locked a session in one tab, confirmed
    the SECOND tab's next tRPC call shows the lock overlay rather than
    silently refreshing and looping).
(c) Confirmation this is `useUIStore`'s first real consumer in the
    codebase, and that its existing `sheetOpen`/`dialogOpen`/
    `paletteOpen` pattern was followed exactly for the new
    `idleWarningOpen` addition.
(d) Which existing tRPC query was used for the "I'm still here"
    keepalive action, and confirmation it's lightweight (not a large
    data-fetching query being repurposed just because it was
    convenient).
(e) Whether the lock overlay was built as a non-dismissible `Dialog` (and
    how outside-click/Escape were disabled) or as a plain overlay div
    (and why `Dialog` didn't work cleanly for this case, if that's the
    path taken).
(f) Whether `/dev/components/topbar` already covered `onUserMenuAction`'s
    states, and if not, that this was flagged rather than silently
    expanded into.

Before submitting this PR, confirm each item:
- [ ] `useIdleTimer.ts` created — 25-minute warning via `useUIStore`,
      30-minute auto-lock, keyboard/mouse/touch monitored.
- [ ] Lock screen overlay built inside `AuthenticatedLayout.tsx` as a
      sibling to `<Outlet />` — not a route, not unmounting underlying
      page state — full-screen, password-only, non-dismissible.
- [ ] Unlock flow wired to `POST /api/auth/unlock`, all three response
      cases (success / `INVALID_PASSWORD` / `REFRESH_REQUIRED`) handled
      exactly as specified, including the no-distinguishing-reasons rule
      for `INVALID_PASSWORD`.
- [ ] `lib/trpc.ts`'s custom fetch modified to detect `SESSION_LOCKED`
      before attempting silent refresh, verified against a real
      cross-tab test.
- [ ] Topbar's `onUserMenuAction` union extended to include `'lock'`;
      `AuthenticatedLayout.tsx`'s handler extended to call `lock()`.
- [ ] All three lock-trigger paths (menu item, 30-min auto-lock,
      cross-tab detection) verified to actually show the overlay.
- [ ] PR description items (a) through (f) above all addressed
      explicitly.
A reviewer will verify each one independently.
````

---

That's both prompts, plus the log entry. A few things worth flagging plainly rather than letting sit implicit: I made two calls on your behalf inside these prompts that go slightly beyond what you approved above — the `message`-not-`cause` decision in Step 2 of Part 1 (which falls out of the #6 reasoning but is a specific technical choice I had to make to make #6 concrete), and treating the Topbar change as in-scope for Part 2 rather than spinning it into its own Tier-3-component task. Both are explained inline in the prompts with my reasoning, but they're real decisions, not things I verified against the repo the way everything else here is — worth a look before you hand these off.