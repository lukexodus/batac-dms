# TASK-DOCS-LINT-003: `main.tsx` Import-Order Fix + `DocumentDetailPage.tsx` Full `any`-Cast Remediation

## Context

This is a lint-remediation task for the `batac-dms` monorepo, `apps/web` package. ESLint config lives at `apps/web/eslint.config.cjs` (extends `packages/config/eslint.base.js`). Governing coding standard: `docs/pre-development/J-software-design-patterns-and-standards/j3-coding-standards-and-conventions.md` — `any` is prohibited with no configured exceptions (§1.3); the type-assertion carve-out requires the assertion be followed immediately by a comment explaining why the narrowing is safe.

Run all verification commands from the repo root using `pnpm --filter <package>`.

---

## Unit 1 — `main.tsx`: Correct the `import/order` Fix

**File**: `apps/web/src/main.tsx`

**Background, so you don't need outside context**: this file's imports were previously reordered based on a wrong assumption about how the `import/order` rule groups things. The real rule (`packages/config/eslint.base.js`, the `import/order` block) is:

```js
groups: ['builtin', 'external', ['internal', 'parent', 'sibling', 'index'], 'type'],
pathGroups: [{ pattern: '@batac/**', group: 'internal', position: 'before' }],
pathGroupsExcludedImportTypes: ['type'],
'newlines-between': 'always',
alphabetize: { order: 'asc', caseInsensitive: true },
```

Three groups matter here: `external` (all `node_modules` packages, alphabetized together), the combined `internal`/`parent`/`sibling`/`index` group (this pulls in `@batac/**` imports and all relative `./` imports into **one single alphabetized block**, not separate blocks), and `type`. Everything within a group is alphabetized ascending, case-insensitive, by the import source string.

**Task**: Run

```
pnpm --filter @batac/web exec eslint src/main.tsx --fix
```

This command is known to complete reliably when scoped to this single file (typed-linting on this file's cross-package type surface is slow — expect roughly 15-55 seconds — but it does complete; do not interrupt it early and do not treat a long wait as a hang).

**What the fix should produce** (for your own verification after running `--fix` — do not hand-edit to match this, just confirm the tool's output matches this shape): `@tanstack/react-query` sorts to the top of the `external` block, before `react`, `react-dom/client`, `react-router-dom` (because `@` sorts before letters). All the relative `./pages/...` route-component imports collapse into one alphabetized block sorted by full path, not grouped by their prior subdirectory ordering (dev pages, then documents, then workflow, etc. — that manual grouping goes away; alphabetical-by-path replaces it).

**Verify**:

```
pnpm --filter @batac/web exec eslint src/main.tsx
```

must report zero errors. Then confirm this didn't touch anything semantic:

```
pnpm --filter @batac/web typecheck
```

must be clean (an import reorder cannot change runtime behavior since none of these are side-effecting imports besides the already-present `@batac/ui/styles/globals.css`, which must remain exactly where it is, immediately after the `@batac/ui` named import — confirm it wasn't moved).

**What NOT to touch**: nothing else in this file. Do not reorder or touch the `router` array, the route paths, or the render tree at the bottom of the file.

---

## Unit 2 — `DocumentDetailPage.tsx`: Remove Three Dead/Unused Declarations

**File**: `apps/web/src/pages/documents/DocumentDetailPage.tsx`

Three separate, unrelated dead declarations, each confirmed to have zero usage anywhere else in the file:

**2a.** Line 43: `Separator,` inside the `@batac/ui` import block (lines 37-53). Delete this line. Do not touch any other name in that import block.

**2b.** Line 71: `const SP_ROLES = ['sp_secretary', 'sp_member', 'sp_presiding_officer'];` — delete the entire line.

**2c.** Lines 73-78:

```tsx
/** documents.update: callable-by dept_encoder, dept_approver, sp_secretary,
 *  sp_presiding_officer, mayor, brgy_encoder, brgy_captain, sp_member */
function canUpdate(roles: string[], lifecycleState: string): boolean {
  if (
    !hasRole(
      roles,
      'dept_encoder',
      'dept_approver',
      'sp_secretary',
      'sp_presiding_officer',
      'mayor',
      'brgy_encoder',
      'brgy_captain',
      'sp_member',
    )
  )
    return false;
  return lifecycleState === 'draft';
}
```

Delete this entire function including its doc comment. Do not delete any of the other similarly-shaped ABAC helper functions before or after it in the file (there are several — this task removes only `canUpdate`, because it alone is unused; the others are called elsewhere in the file and must stay untouched).

**Verify**: after 2a-2c, `pnpm --filter @batac/web exec eslint src/pages/documents/DocumentDetailPage.tsx` must show zero remaining `@typescript-eslint/no-unused-vars` errors for `Separator`, `SP_ROLES`, or `canUpdate` specifically (other errors will still be present until Units 3-5 below are also done — that's expected, don't treat it as a failure).

---

## Unit 3 — `routingEntries` Mapping: Type the Callback Parameter

**File**: `apps/web/src/pages/documents/DocumentDetailPage.tsx`, currently at lines 399-411:

```tsx
// ── Routing history → RoutingHistoryTimeline entries ──────────────────────
// The tracking.getRoutingHistory output uses snake_case / different shape from
// RoutingEntry (the UI type). Map defensively.
const routingEntries: RoutingEntry[] = (routingHistory ?? []).map((e: any) => ({
  id: e.entryId,
  actorName: e.actorDisplayName ?? e.actorId,
  actorOfficeName: e.fromOfficeName ?? '',
  action: 'Logged' as const, // actionDescription is free text; map to nearest RoutingAction
  timestamp: new Date(e.timestamp),
  notes: e.actionDescription,
  ...(e.fromOfficeName && { fromOfficeName: e.fromOfficeName }),
  ...(e.toOfficeName && { toOfficeName: e.toOfficeName }),
}));
```

**Root cause**: the map callback's parameter `e` is explicitly typed `any`. This is the sole source of all 19 `no-unsafe-*`/`no-explicit-any` errors on these 11 lines. This is a genuine type mismatch, not a leftover — the comment above the block is correct that `RoutingEntry` (the UI type) and this query's real output shape differ, so the mapping itself must stay a mapping. The fix is to type `e` as the _actual_ source type, not to make the two types match.

**The real source type**, confirmed against `apps/server/src/modules/tracking/tracking.router.ts`, the `RoutingEntryOutputSchema` backing `tracking.getRoutingHistory`'s `.output()`:

```ts
{
  entryId: string; // uuid, non-nullable
  fromOfficeId: string | null; // uuid
  toOfficeId: string | null; // uuid
  fromOfficeName: string | null;
  toOfficeName: string | null;
  actorId: string;
  actorDisplayName: string;
  actionDescription: string;
  timestamp: Date;
}
```

(Note: `fromOfficeName`/`toOfficeName` now exist on this schema — a prior office-ID/office-name resolution fix already landed server-side. This task is unrelated to that fix and must not touch it.)

**Find where `routingHistory` itself comes from** in this file (the query that produces the array being mapped) and use tRPC's inferred output type directly rather than hand-writing a duplicate interface — check the file for how `routingHistory` is declared (likely a `trpc.tracking.getRoutingHistory.useQuery(...)` call, with `data: routingHistory` destructured) and derive `e`'s type from that query's inferred element type (e.g. via `RouterOutputs['tracking']['getRoutingHistory'][number]`, following the same `RouterOutputs` pattern already used elsewhere in this codebase for other panel components — check `apps/web/src/lib/trpc.ts` for how `RouterOutputs` is exported, and follow that exact existing pattern; do not invent a new mechanism for exposing router output types).

**What NOT to touch in this block**:

- The `action: 'Logged' as const` line and its comment — a separate, already-understood, deliberate simplification, out of scope.
- The `notes: e.actionDescription` mapping.
- `timestamp: new Date(e.timestamp)`.
- Do not change `id: e.entryId` to anything else — it's already correct as written (this was cleaned up in a prior fix; leave it as-is).
- Do not touch `RoutingEntry`'s own definition in `packages/ui/src/types/domain.ts`.

**Verify**: `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-return`, `no-explicit-any` errors on lines 402-410 must all be gone. Report the before/after count specifically for this line range.

---

## Unit 4 — File Upload: Type-Predicate Function for MIME Type Narrowing

**File**: `apps/web/src/pages/documents/DocumentDetailPage.tsx`

**Two separate locations, same root cause.** First, the existing runtime check at lines 439-446:

```tsx
const VALID = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
if (!VALID.includes(selected.type)) {
  setUploadFileError('Unsupported file type');
  setUploadFile(null);
  return;
}
```

Second, the two casts at lines 455 and 467, inside `handleUpload`:

```tsx
const handleUpload = async () => {
  if (!uploadFile || !documentId) return;
  const { uploadUrl, s3Key } = await requestUploadUrlMutation.mutateAsync({
    documentId,
    mimeType: uploadFile.type as any,
  });
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: uploadFile,
    headers: { 'Content-Type': uploadFile.type },
  });
  if (!res.ok) {
    toast.error('File upload to storage failed');
    return;
  }
  await confirmUploadMutation.mutateAsync({
    documentId,
    s3Key,
    originalFilename: uploadFile.name,
    mimeType: uploadFile.type as any,
    fileSizeBytes: uploadFile.size,
  });
};
```

**Root cause, confirmed**: `uploadFile` is `useState<File | null>`. The native DOM `File.type` property is typed `string`. Both `requestUploadUrlMutation` (`trpc.documents.requestUploadUrl`) and `confirmUploadMutation` (`trpc.documents.confirmUpload`) have `mimeType` typed via `AllowedMimeTypeSchema` server-side (`packages/shared/src/schemas/common.ts`):

```ts
export const AllowedMimeTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);
```

— a 5-value literal union, exactly matching the `VALID` array above. A plain `string` is not assignable to this literal-union type, hence the casts.

**Important, already-verified constraint**: simply changing `VALID`'s declaration to a `readonly`/`as const` tuple (which would make `.includes()` narrow correctly at line 442) is **not sufficient by itself** to remove the two `as any` casts in `handleUpload`. This was tested directly: the narrowing performed inside `handleFileChange` does not survive being written into `uploadFile` (component state) and read back in a different function (`handleUpload`) later. TypeScript's control-flow narrowing does not persist across that kind of state round-trip. The fix must re-assert the narrowing at the point of use in `handleUpload`, not only at the point of the original check in `handleFileChange`.

**Also confirmed**: `AllowedMimeTypeSchema` currently has no accompanying exported TypeScript type (`z.infer<typeof AllowedMimeTypeSchema>`) in `packages/shared/src/schemas/common.ts` — every other schema in that file has a matching `export type X = z.infer<typeof XSchema>;` immediately below it; this one is a gap. Fix this as part of this task, matching the existing convention:

```ts
export const AllowedMimeTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);
export type AllowedMimeType = z.infer<typeof AllowedMimeTypeSchema>;
```

`AllowedMimeTypeSchema` is already re-exported from the package root (`packages/shared/src/index.ts` does `export * from './schemas/common.js';`), so this new type will be immediately importable as `import type { AllowedMimeType } from '@batac/shared';` — no other change needed in `packages/shared` or its `index.ts`.

**In `DocumentDetailPage.tsx`**, add the import (alongside the existing `import type { LifecycleState } from '@batac/shared';` at line 57 — extend that same import statement, don't add a second `@batac/shared` import line) and add a type-predicate function near `handleFileChange`/`handleUpload` (module scope, not inside either function, so both can use it):

```tsx
function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (
    [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ] as const satisfies readonly AllowedMimeType[]
  ).includes(value as AllowedMimeType);
}
```

(The `as AllowedMimeType` cast inside this one function is acceptable and expected — this is the single, narrow, well-contained place where the unsafe-to-safe boundary conversion has to happen; J3 §1.3's carve-out for assertions "followed immediately by a comment explaining why the narrowing is safe" applies here specifically. Add a one-line comment above the function explaining this, e.g. `// Runtime type guard bridging File.type (string) to the AllowedMimeType literal union.`)

Then:

- Replace the inline `VALID` array at line 439-441 with a call to `isAllowedMimeType(selected.type)`, replacing line 442's `if (!VALID.includes(selected.type))` with `if (!isAllowedMimeType(selected.type))`. Delete the now-unused `VALID` declaration.
- In `handleUpload`, before either mutation call, add a narrowing check:

```tsx
const handleUpload = async () => {
  if (!uploadFile || !documentId) return;
  if (!isAllowedMimeType(uploadFile.type)) {
    toast.error('Unsupported file type');
    return;
  }
  const { uploadUrl, s3Key } = await requestUploadUrlMutation.mutateAsync({
    documentId,
    mimeType: uploadFile.type, // now narrowed to AllowedMimeType, no cast
  });
  // ... rest unchanged ...
  await confirmUploadMutation.mutateAsync({
    documentId,
    s3Key,
    originalFilename: uploadFile.name,
    mimeType: uploadFile.type, // now narrowed to AllowedMimeType, no cast
    fileSizeBytes: uploadFile.size,
  });
};
```

This second check is technically redundant given `handleFileChange` already validated the file before it ever reached state — but it's what makes the type genuinely safe at the point of use without a cast, and it's a legitimate defensive check (state could theoretically be stale between the two functions in edge cases). Do not skip it and reach for a cast instead.

**What NOT to touch**: the 25 MiB size check (`MAX`/`selected.size > MAX`) immediately above, the `fetch(uploadUrl, ...)` PUT call and its own `headers: { 'Content-Type': uploadFile.type }` (this one stays as plain `string` — it's calling the browser `fetch` API directly, not a typed tRPC procedure, so there's no type mismatch there and nothing to fix).

**Verify**: zero `no-explicit-any`/`no-unsafe-assignment` errors remain on lines that were 455 and 467 (line numbers will shift after this edit — report the new locations). Run `pnpm --filter @batac/web typecheck` and `pnpm --filter server typecheck` (the server side changed too, via the shared package) — both must be clean. Manually confirm or run existing tests to ensure file upload still works: `isAllowedMimeType` must accept exactly the same 5 MIME types the old `VALID` array did and reject everything else, with identical behavior to before this change.

---

## Unit 5 — QR Cover Sheet Print: Remove Unnecessary Casts

**File**: `apps/web/src/pages/documents/DocumentDetailPage.tsx`, currently at lines 644-656:

```tsx
                onClick={async () => {
                  // printQrCoverSheet is typed as a query but issues a side-effecting
                  // presigned URL request — call via trpc utility client directly.
                  try {
                    const result = await utils.tracking.printQrCoverSheet.fetch({
                      documentIds: [documentId],
                      layout: 'single',
                    });
                    window.open((result as any).pdfPresignedUrl, '_blank');
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
```

**Confirmed via direct removal-and-typecheck test**: both casts here are unnecessary. `utils.tracking.printQrCoverSheet.fetch(...)` is already correctly typed by tRPC's own inference (the procedure has `.output(z.object({ pdfPresignedUrl: z.string().url() }))` server-side) — `result.pdfPresignedUrl` works with no cast. The `catch (e: any)` doesn't need `any` either.

Change to:

```tsx
                onClick={async () => {
                  // printQrCoverSheet is typed as a query but issues a side-effecting
                  // presigned URL request — call via trpc utility client directly.
                  try {
                    const result = await utils.tracking.printQrCoverSheet.fetch({
                      documentIds: [documentId],
                      layout: 'single',
                    });
                    window.open(result.pdfPresignedUrl, '_blank');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to print QR cover sheet');
                  }
                }}
```

Keep the existing explanatory comment exactly as-is — it documents real, still-relevant context about why `.fetch()` is used instead of a normal query hook.

**What NOT to touch**: `documentIds: [documentId]`, `layout: 'single'`, the surrounding `Button` JSX, the `canPrintQrCoverSheet(roles)` conditional wrapping this whole block.

**Verify**: `pnpm --filter @batac/web typecheck` clean. Zero lint errors on the new line numbers corresponding to this block.

---

## Unit 6 — Tracking Record Display: Remove Unnecessary Casts

**File**: `apps/web/src/pages/documents/DocumentDetailPage.tsx`, currently at lines 751-768 (inside the `{trackingRecord && (...)}` conditional block):

```tsx
            <div className="w-40 shrink-0">
              <QRCodeDisplay
                trackingId={(trackingRecord as any).qrCodeS3Key ?? (trackingRecord as any).trackingId}
                documentNumber={displayNumber ?? (trackingRecord as any).trackingNumber}
                title={document.title}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-text-muted">Tracking Number:</span>{' '}
                <span className="font-mono">{(trackingRecord as any).trackingNumber}</span>
              </div>
              {(trackingRecord as any).physicalLocation && (
                <div>
                  <span className="font-medium text-text-muted">Physical Location:</span>{' '}
                  {(trackingRecord as any).physicalLocation}
                </div>
              )}
            </div>
```

**Confirmed via direct removal-and-typecheck test**: all five casts here are unnecessary. `trackingRecord` comes from `trpc.tracking.getTrackingRecord.useQuery(...)` (confirmed at this file's line 208), which is already correctly typed via that procedure's `.output(TrackingRecordOutputSchema)` server-side (`apps/server/src/modules/tracking/tracking.router.ts`). Removing every `as any` here compiles clean with no other changes needed.

**Separate finding to note but not act on differently**: `qrCodeS3Key ?? trackingId` at the first line — `qrCodeS3Key` is typed `z.string()` server-side with no `.nullable()`/`.optional()`, so this `??` fallback can structurally never fire in a schema-conformant response. This is the same _category_ of dead-fallback pattern found and removed elsewhere in this file previously (`entryId ?? id`), but it is NOT identical: here, both `qrCodeS3Key` and `trackingId` are real, valid fields on the schema (unlike the earlier case, where the fallback referenced a field that didn't exist on the schema at all). Do not delete the `?? trackingRecord.trackingId` fallback as part of this task — leave the logic exactly as-is, only remove the `as any` casts around it. This dead-fallback observation is informational; resolving it is out of scope here and would need its own decision about which value should be considered primary.

Change to:

```tsx
            <div className="w-40 shrink-0">
              <QRCodeDisplay
                trackingId={trackingRecord.qrCodeS3Key ?? trackingRecord.trackingId}
                documentNumber={displayNumber ?? trackingRecord.trackingNumber}
                title={document.title}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-text-muted">Tracking Number:</span>{' '}
                <span className="font-mono">{trackingRecord.trackingNumber}</span>
              </div>
              {trackingRecord.physicalLocation && (
                <div>
                  <span className="font-medium text-text-muted">Physical Location:</span>{' '}
                  {trackingRecord.physicalLocation}
                </div>
              )}
            </div>
```

**What NOT to touch**: the `{trackingRecord && (...)}` guard wrapping this whole section, the `QRCodeDisplay` component itself (`packages/ui/src/components/domain/QRCodeDisplay.tsx`) — its `trackingId` prop expecting the QR-encodable value (which is why `qrCodeS3Key` is preferred over `trackingId` in the `??` chain) is intentional per that component's own internal comment about what the QR code encodes; do not "fix" this ordering, it is correct as written.

**Verify**: `pnpm --filter @batac/web typecheck` clean. Zero lint errors on the new line numbers corresponding to this block.

---

## Final Verification (run once, after all 6 units are complete)

1. `pnpm --filter server typecheck` — must be clean (Unit 4 touches `packages/shared`, which the server also depends on).
2. `pnpm --filter @batac/web typecheck` — must be clean.
3. `pnpm --filter @batac/web exec eslint src/main.tsx` — zero errors.
4. `pnpm --filter @batac/web exec eslint src/pages/documents/DocumentDetailPage.tsx` — zero errors. Confirmed pre-task count for this file alone was **44 errors** (3 `no-unused-vars` + 19 on the `routingEntries` block + 4 on the upload block + 4 on the QR-print block + 14 on the tracking-record block); this should now read 0.
5. `pnpm --filter @batac/web lint` (full project) — report the new total and full category breakdown (rule name + count for every distinct rule still firing, not just the aggregate number). Confirmed pre-task total was **164 problems** (12 `import/order`, all in `main.tsx`, plus 152 elsewhere: 59 `no-unsafe-member-access`, 42 `no-unsafe-assignment`, 30 `no-explicit-any`, 13 `no-unused-vars`, 5 `no-unsafe-call`, 1 `react-hooks/exhaustive-deps`, 1 `no-console`, 1 `no-unsafe-return`). Expected post-task: `import/order` at 0 (Unit 1), and the `DocumentDetailPage.tsx`-attributable share of the remaining categories reduced by exactly what Units 2-6 removed — report the actual resulting numbers rather than assuming they match this prediction exactly, since other files' errors are untouched by this task and remain in the total.
6. Confirm no category outside what these 6 units target changed at all — if any rule's count moved in a file this task didn't touch, stop and report it rather than treating it as a side effect of this task.

# TASK-ORG-LINT-001

## Context (self-contained — no reference to any prior conversation needed)

This repo is `batac-dms`, a TypeScript monorepo (Fastify/tRPC/Drizzle/PostgreSQL backend, React frontend). This task fixes a type-safety gap in the `organization` module's repository interface, and a related but independent cleanup in two frontend files that consume it. The two parts are bundled into one prompt because they were investigated together, but they touch different files and can be verified independently — do not skip verifying either one just because the other passed.

Before making any change, re-view every file listed below in its current state on disk. Do not assume the line numbers or exact text given here are still accurate — they were correct as of the investigation that produced this prompt, but you have live repo access and this document does not. If anything below doesn't match what you find on disk, stop and report the mismatch rather than guessing which one is right.

---

## Part 1 — Fix `OrgRepository`'s interface typing

### File: `apps/server/src/modules/organization/organization.repository.ts`

**Problem:** The `OrgRepository` interface (currently lines 13–68) declares every method across all 7 sub-objects (`offices`, `positions`, `employees`, `assignments`, `delegationGrants`, `committees`, `committeeMemberships`) with explicit `any` on both inputs and outputs. The actual implementations inside `createOrgRepository` (currently lines 70–291) are correctly-typed Drizzle query-builder code with no `any` anywhere in the logic — the `any` typing exists solely because `createOrgRepository`'s function signature (`export function createOrgRepository(db: DbClient | DbTransaction): OrgRepository`) has an explicit `: OrgRepository` return-type annotation, which forces every implementation body to widen to match the interface's `any`-laden shape.

This `any` leaks all the way to the frontend through tRPC's type inference wherever a procedure returns a repository value without an intervening `.output()` Zod schema or without re-typing the value some other way — confirmed directly for `organization.listCommittees` via a disposable sandbox test: assigning that procedure's `useQuery().data` to an unrelated object shape produced zero type error, which is only possible if the value is genuinely `any` end-to-end.

**Fix:** Replace the interface's `any` usage with real types derived from Drizzle, using the row types already exported from `apps/server/src/modules/organization/organization.types.ts` (`OfficeRow`, `PositionRow`, `EmployeeRow`, `AssignmentRow`, `DelegationGrantRow`, `CommitteeRow`, `CommitteeMembershipRow` — all already present via `InferSelectModel`, currently lines 22–28 of that file; do not create new row types, these already exist and are the correct ones to use).

For **`create`/`update`** input types, do not use the same `XRow` output types — use `InferInsertModel` from `drizzle-orm`, applied to the Drizzle table objects already imported at the top of `organization.repository.ts` (`offices`, `positions`, `employees`, `assignments`, `delegationGrants`, `committees`, `committeeMemberships`). Add `InferInsertModel` to the existing `drizzle-orm` import at the top of the file. `create` should take the full `InferInsertModel<typeof X>` shape (Drizzle already marks columns with defaults or nullable columns as optional within that inferred type — you do not need to hand-adjust optionality). `update` should take `Partial<InferInsertModel<typeof X>>`, since callers only pass the fields being changed.

Apply this uniformly across all 7 sub-objects and all their methods, using this exact mapping:

- `findById(id: string): Promise<any>` → `findById(id: string): Promise<XRow | null>`
- `findAll(opts?: { includeDeleted?: boolean }): Promise<any>` → `findAll(opts?: { includeDeleted?: boolean }): Promise<XRow[]>`
- `create(input: any): Promise<any>` → `create(input: InferInsertModel<typeof x>): Promise<XRow>`
- `update(id: string, input: any): Promise<any>` → `update(id: string, input: Partial<InferInsertModel<typeof x>>): Promise<XRow>`
- `softDelete(id: string, deletedBy: string): Promise<any>` → `softDelete(id: string, deletedBy: string): Promise<void>` (every implementation body already resolves `void` — none of them have a `return` statement — this is a correction to match actual behavior, not a behavior change)

Additional sub-object-specific methods, same treatment:

- `employees.findByUserId(userId: string): Promise<any>` → `Promise<EmployeeRow | null>`
- `assignments.setPrimaryAssignment(...): Promise<void>` — already correctly typed, no change needed, but confirm it still reads this way after your edit (it should be unaffected by the changes around it)
- `delegationGrants.findActiveByUserId(userId: string): Promise<any>` → `Promise<DelegationGrantRow[]>` (the implementation does `return rows.map(r => r.grant)` — an array, not a nullable single value; do not type this as `DelegationGrantRow | null`)
- `delegationGrants.findByIdAndActive(id: string): Promise<any>` → `Promise<DelegationGrantRow | null>`
- `committeeMemberships.findActiveByUserId(userId: string): Promise<any>` → `Promise<CommitteeMembershipRow[]>` (same reasoning as `delegationGrants.findActiveByUserId` — the implementation does `return rows.map(r => r.membership)`)

After editing the interface, you also need to import the row types into `organization.repository.ts` (they currently live in `organization.types.ts`, which `organization.repository.ts` does not yet import from for this purpose — check the current imports and add what's missing; do not duplicate the `InferSelectModel` declarations, import the already-exported `XRow` type aliases instead).

**Do not touch:** `createOrgRepository`'s implementation bodies (lines ~70–291) should need zero changes — every implementation was verified during investigation to already produce correctly-typed values on its own; the interface was the only thing forcing the widening. If you find you need to change an implementation body to make this compile, stop and report which one and why, rather than pushing a workaround through — that would mean the investigation's verification of that specific method was wrong and needs to be revisited, not silently patched around.

### Verification for Part 1 (do all of these, in order, before moving to Part 2)

1. Run `pnpm --filter server typecheck`. It must pass clean. If it doesn't, do not silently add `as any` or similar casts to force it through — report the specific error.
2. Specifically confirm these call sites, which were individually checked during investigation and should require **zero changes**, still compile without modification:
   - `organization.router.ts`: `createCommittee` (currently ~lines 539–558, the object literal at `orgRepository.committees.create({...})`), `updateCommittee` (~560–575), `assignCommitteeMembership` (~577–600), `createOffice`/`updateOffice` (~211–242), `createPosition`/`updatePosition` (~259–287), `createEmployee`/`updateEmployee` (~326–365), `assignEmployeeToPosition` (~369–412, including the existing `(allAssignments as Array<{ positionId: string; isActive: boolean }>)` cast at ~line 386 — leave this cast in place; removing it is out of scope for this task even though it will likely become redundant once `assignments.findAll` returns `AssignmentRow[]`).
   - `delegation.service.ts`: the `orgRepo.delegationGrants.create({...})` call (currently ~lines 223–236, including the existing `as DelegationGrantRow` cast at the end — leave this cast in place for the same reason as above; it becomes redundant but removing it is out of scope here).
   - `organization.router.ts`'s `listCommittees` procedure specifically (currently ~lines 602–614): this procedure will still compile after this fix, but its return type will now be inferred as `any` no more — it will resolve to whatever the inline `.map()`'s return object literal infers. Do not change this procedure in Part 1; it's addressed only implicitly (its output stops being `any` as a side effect of the interface fix, since `orgRepository.committees.findAll()` will no longer return `any`, so the `.map()` call on a genuinely-typed array will produce a genuinely-typed result). Confirm this is actually true after your fix — check that `listCommittees`'s inferred return type is no longer `any` — but do not add an explicit `.output()` schema or otherwise restructure this procedure; that's out of scope for this task.
3. Run `pnpm --filter server test` (or the project's equivalent vitest invocation for the `server` package) and confirm `organization.router.test.ts` and any other test file touching `orgRepository` still passes. This was assessed as low-risk during investigation (the test file's mock construction uses `as unknown as OrgRouterDeps['orgRepository']`, and individual mock reassignments like `deps.orgRepository.assignments.findAll = vi.fn().mockResolvedValue([...])` were confirmed via a real installed-vitest compiler test not to fail typecheck even with partial-shape mock data) — but "assessed as low-risk" is not the same as "run and confirmed," and running the actual test suite is a required step here, not optional.
4. Run `pnpm --filter @batac/web typecheck`. This should also remain clean (it was clean before this fix, per a fresh run earlier this session, and this fix only touches `apps/server`) — but confirm it, since a backend interface fix flowing into frontend-consumed tRPC types is exactly the kind of change that could surface a frontend typecheck issue that wasn't visible before.

---

## Part 2 — Remove unnecessary `any` annotations in `CommitteeManagementPage.tsx` and `OrganizationPage.tsx`

This part is independent of Part 1 in the sense that it does not require Part 1 to be done first or in the same commit — but do Part 1 first anyway, in this same session, since Part 2's `employeesData`-related fixes assume `trpc.organization.listEmployees` is already correctly typed (which it already is, independent of Part 1 — see note below), and it's cleaner to verify both together.

**Important scoping note:** `trpc.organization.listEmployees` is **already correctly typed today**, independent of Part 1. It flows through `OrgService.listEmployees` (declared in `organization.types.ts`, implemented in `organization.service.ts` with its own direct, correctly-typed Drizzle query), not through `OrgRepository.employees.findAll`. This was directly verified during investigation — do not assume Part 1's fix is what makes Part 2 possible; the two are unrelated fixes that happen to touch overlapping files. If you find `listEmployees` is _not_ cleanly typed when you get to this file, stop and report it — that would mean something changed since this prompt was written.

### File: `apps/web/src/pages/organization/CommitteeManagementPage.tsx`

Five separate issues, all confirmed present as of the investigation. Re-verify each against the current file before fixing — line numbers given are from that investigation and may have shifted if anything else has touched this file since.

1. **`listCommittees`-sourced `any` (lines 36, 42, 89, 90, 92–94, 99, 121, 131, 172, 179–183, 265 as of investigation):** `const { data: committees } = trpc.organization.listCommittees.useQuery();` is currently typed `any` because of the Part 1 bug. Once Part 1 is fixed, `committees` will be typed as whatever `listCommittees`'s `.map()` callback infers — check what that actually resolves to after Part 1's fix (it was `{ committeeId: string; name: string; code: string | null; description: string | null; deletedAt: Date | string | null }[]` as of investigation, matching the inline `.map()` callback's explicit parameter annotation on the backend, but confirm this is still accurate rather than assuming it). Once `committees` has a real inferred type:
   - Remove the explicit `: any` from `const [selectedCommittee, setSelectedCommittee] = useState<any>(null);` (line 42) and replace with the real committee item type (either name it inline as a type alias derived from the query's data type, e.g. via `NonNullable<typeof committees>[number]`, or declare a small local interface matching the shape — match whichever pattern is more consistent with how `OrganizationPage.tsx` already handles its local `OfficeSummary`/`OfficeNode` types, since that file already establishes the project's convention of locally-declared frontend interfaces rather than importing backend types for this kind of view-shape).
   - Remove the explicit `any` annotations on `openEdit = (committee: any) =>` (line 89) and `openAssign = (committee: any) =>` (line 99); type both parameters with the same type used for `selectedCommittee` above.
   - Remove the explicit `: any` on the `.map((committee: any) =>` callback (line 179); once `committees` itself is properly typed, this annotation is unnecessary and TypeScript will infer the correct callback parameter type on its own — do not just add a different explicit type here, remove the annotation and let inference work, unless removing it produces a compile error, in which case report what error and add back an explicit type only as a fallback.

2. **`employeesData`-sourced `any`, unrelated to Part 1 (lines 243, 278 as of investigation):** `const { data: employeesData } = trpc.organization.listEmployees.useQuery(...)` (line 85) is already correctly typed as `{ items: EmployeeSummary[]; nextCursor: string | null } | undefined` — `EmployeeSummary` has fields `employeeId: string; userId: string; displayName: string; positionId: string | null; positionTitle: string | null; officeId: string | null;` (declared in `apps/server/src/modules/organization/organization.types.ts`, not currently imported into this frontend file, and there is no shared-package export of this shape — `packages/shared/src/schemas/organization.ts` only exports `OfficeSummary`, nothing employee-shaped). Despite this, both `.map()` callbacks that iterate `employeesData?.items` (lines 243 and 278) have an explicit, unnecessary `(emp: any) =>` annotation. Remove both explicit `any` annotations and let TypeScript infer the parameter type from `employeesData.items`'s already-correct type; do not add an explicit type here at all, since inference from the already-typed array should work without one. If it doesn't (unexpected — report if this happens), fall back to declaring a small local interface with exactly the three fields actually read in this file's JSX (`employeeId`, `displayName`, `positionTitle` — confirm these are still the only fields read at both sites before doing this, do not add fields speculatively).

3. **`committeeRole: assignData.committeeRole as any` (line 133):** This is a different kind of issue from the other four — it's a type _assertion_ (bypassing the type system for one expression), not a variable/parameter _annotation_. It exists because `assignData` is initialized via `useState({ ..., committeeRole: 'member', ... })` (lines 51–55), which TypeScript infers as `{ ...; committeeRole: string; ... }` — a plain `string`, not narrowed to the literal union — while `assignCommitteeMembership`'s mutation input expects `committeeRole: z.enum(['chairman','vice_chairman','member'])`. Fix this by typing `assignData`'s state explicitly to narrow `committeeRole` to the literal union, rather than removing the assertion and leaving the mismatch unresolved. Concretely: change the `useState` call to `useState<{ employeeId: string; committeeRole: 'chairman' | 'vice_chairman' | 'member'; startDate: string }>({ employeeId: '', committeeRole: 'member', startDate: new Date().toISOString().split('T')[0]! })` (or equivalent — the goal is `assignData.committeeRole`'s declared type being the literal union, not `string`), then remove the `as any` at line 133 entirely, since it should no longer be needed once the state itself is correctly typed. Confirm the `<Select onValueChange={(val) => setAssignData({ ...assignData, committeeRole: val })}>` at line ~290 still compiles after this change — `onValueChange`'s `val` parameter is typed `string` by the underlying `Select` component (from `@batac/ui`), so assigning it into a field now typed as the narrower literal union may itself produce a new type error; if it does, cast `val` at that specific call site (`committeeRole: val as 'chairman' | 'vice_chairman' | 'member'`) rather than reverting the state's type — narrowing the assertion to this one, more precise site is preferable to the current broad `as any` on the whole object, but only do this if actually needed; check first.

4. **Unused import `Users` (line 2):** `import { Users, Plus, Edit, UserPlus } from 'lucide-react';` — `Users` does not appear anywhere else in the file (confirmed via full-file search during investigation). Remove `Users` from this import, keep `Plus, Edit, UserPlus` (all three are genuinely used in JSX).

5. **Unused variable `queryClient` (line 34):** `const queryClient = useQueryClient();` — the `queryClient` variable is never referenced anywhere else in the file (the file uses `trpc.useUtils()` — a separate `utils` variable — for its actual cache invalidation, at lines 61, 70). Remove this line entirely, and remove the now-unused `useQueryClient` import from `@tanstack/react-query` at line 1 if it's not used for anything else in the file (confirm first — it appeared to be used only for this one call as of investigation, but re-check before removing the import).

6. **Unused import `React` (line 3):** `import React, { useState } from 'react';` — `React` (the default import / namespace) is never referenced via `React.` anywhere in the file (confirmed via full-file search). This project's ESLint config has `'react/react-in-jsx-scope': 'off'` (modern JSX transform), so the bare namespace import is not required for JSX to work. Change to `import { useState } from 'react';`. **This is a new finding from this investigation, not something previously confirmed as a lint error the way `Users`/`queryClient` were** — it was identified by the same pattern-match (unused import) but not independently run through the actual linter, since no working lint environment was available during investigation. Make this change, but if the actual lint run afterward shows `React` was not, in fact, flagged (e.g., if some other rule or plugin configuration makes the bare import acceptable), that's fine — just don't be surprised if this particular one has zero effect on the error count, and don't treat that as a sign anything else in this prompt was wrong.

### File: `apps/web/src/pages/organization/OrganizationPage.tsx`

Same general pattern as `CommitteeManagementPage.tsx`'s issue #2 above — four sites, all involving `employeesData` (from `trpc.organization.listEmployees.useQuery`, already correctly typed, unrelated to Part 1), plus one unused import.

1. **`useState<any>(null)` for `selectedEmployee` (line 221):** `const [selectedEmployee, setSelectedEmployee] = useState<any>(null);`. Replace with a properly-typed state. `selectedEmployee` is set from items in `employeesData.items` (an `EmployeeSummary[]`, per the same type described above) via `openEditEmployee` (line 298), and its fields are read at lines 300 (`emp.displayName`) and 357 (`selectedEmployee.employeeId`) — both match `EmployeeSummary`'s actual shape. Type this as `EmployeeSummary | null` using the same approach decided for `CommitteeManagementPage.tsx` above (local type alias or small interface — use the same pattern in both files for consistency, don't use two different approaches for the same underlying type shape across the two files).

2. **`openEditEmployee = (emp: any) =>` (line 298):** Remove the explicit `any`, type the parameter with the same `EmployeeSummary`-shaped type used for `selectedEmployee` above.

3. **`.map((emp: any) =>` at line 458 and line 734 (two separate sites):** Same fix as `CommitteeManagementPage.tsx`'s issue #2 — remove the explicit `any` annotation at both sites and let inference flow from `employeesData.items`'s already-correct type. Do not add an explicit type unless removal produces a compile error; report if it does.

4. **Unused import `React` (line 12):** `import React, { useState, useMemo } from 'react';` — same situation as `CommitteeManagementPage.tsx`'s issue #6 above (never referenced via `React.` anywhere in this file, confirmed via full-file search, same "not independently run through the actual linter" caveat applies). Change to `import { useState, useMemo } from 'react';`.

**Do not touch anything else in either file.** Both files were read in full during investigation; nothing beyond what's listed above was identified as an issue. In particular, do not touch: `OfficeSummary`/`OfficeNode`/`OfficeType`/`AuthorityLevel`'s local interface declarations in `OrganizationPage.tsx` (these are correctly typed and are the file's existing convention for local view-shape types — follow this same pattern for the new `EmployeeSummary`-shaped type rather than introducing a different pattern), the `OfficeTreeNode` component, any of the mutation `.useMutation()` calls, or any JSX/rendering logic not directly touched by the specific line-level fixes listed above.

### Verification for Part 2

1. Run `pnpm --filter @batac/web typecheck`. Must pass clean.
2. Run `pnpm --filter @batac/web lint`. Report the new total error count and a fresh per-file breakdown for at least `CommitteeManagementPage.tsx` and `OrganizationPage.tsx` — do not assume it matches any number implied elsewhere in this prompt. This prompt's investigation explicitly could not run the real linter (no working `node_modules`/lint environment was available), so every fix above was derived from manual code tracing, not from watching an error disappear — the actual post-fix lint numbers are the first real confirmation either way.
3. **Specifically expect `OrganizationPage.tsx` to still have a substantial number of lint errors remaining after this fix.** This prompt's fixes account for what was traced and confirmed as independent, mechanical issues in that file (4 `any` sites + 1 unused import) — investigation explicitly could not account for the rest of that file's previously-reported 30-error total (only ~4–7 errors were traceable to confirmed causes, by hand, without a real linter to confirm exact per-line error counts). **Do not treat a smaller-than-expected reduction in `OrganizationPage.tsx`'s count as a sign this prompt's fixes are wrong** — it was already known and stated, going into this prompt, that this file has unresolved errors beyond what's listed here. Report the actual new count plainly; if there's a large remaining error count in this file, that confirms the known gap rather than indicating a problem with this specific fix, and is expected follow-up work, not a regression.
4. If any fix in this prompt produces a _new_ lint error that wasn't there before (as opposed to just failing to remove an existing one), treat that as a real problem with this prompt and report it specifically — that would be a genuine regression, distinct from the "known remaining errors" case in point 3.

# TASK-ORG-LINT-002

## Context (read this before making any changes)

This is a standalone follow-up to `TASK-ORG-LINT-001`, which has already been implemented. This prompt has three independent parts. Do them in order, but they do not depend on each other's code changes — Part 3 is documentation-only and can be done last regardless.

## Part 1 — Add `chairedByEmployeeId` to `listCommittees`'s return shape

**File**: `apps/server/src/modules/organization/organization.router.ts`

**Current state** (verify this matches before editing — re-locate by searching for `listCommittees` in the file, since line numbers shift after edits and should not be trusted from this prompt):

```typescript
listCommittees: protectedProcedure
  .query(async ({ ctx }) => {
    requireAnyRole(ctx, ['plat_admin', 'sp_secretary', 'sp_member'], 'Access to committees list is not permitted for this role.');
    const { orgRepository } = getDeps(ctx);
    const rows = await orgRepository.committees.findAll({ includeDeleted: false });
    return rows.map((r: { id: string; name: string; code: string | null; description: string | null; deletedAt: Date | string | null }) => ({
      committeeId: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      deletedAt: r.deletedAt,
    }));
  }),
```

**Bug this fixes**: `apps/web/src/pages/organization/CommitteeManagementPage.tsx`'s `openEdit` function reads `committee.chairedByEmployeeId` to pre-populate the Chairperson field when opening the edit dialog for an existing committee. Because `listCommittees` never returns this field, the value is always `undefined` at runtime, so the Chairperson field silently resets to empty every time the edit dialog opens, and saving without manually re-selecting a chairperson clears the committee's actual chair. `chairedByEmployeeId` is a `.notNull()` column on the `committees` table (`packages/database/schema/organization.schema.ts`) and is already present on every row returned by `orgRepository.committees.findAll(...)` — it's being explicitly excluded by the object-literal mapping shown above, not missing from the data.

**Change required**: add `chairedByEmployeeId` to both the callback parameter's inline type annotation and the returned object:

```typescript
listCommittees: protectedProcedure
  .query(async ({ ctx }) => {
    requireAnyRole(ctx, ['plat_admin', 'sp_secretary', 'sp_member'], 'Access to committees list is not permitted for this role.');
    const { orgRepository } = getDeps(ctx);
    const rows = await orgRepository.committees.findAll({ includeDeleted: false });
    return rows.map((r: { id: string; name: string; code: string | null; description: string | null; chairedByEmployeeId: string; deletedAt: Date | string | null }) => ({
      committeeId: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      chairedByEmployeeId: r.chairedByEmployeeId,
      deletedAt: r.deletedAt,
    }));
  }),
```

`chairedByEmployeeId` is typed as `string`, not `string | null` — the column is `.notNull()` in the Drizzle schema, so it is never null on a real row.

**What NOT to do as part of this fix**: do not change this procedure to return the `{ items: T[], nextCursor: string | null }` envelope shape that other `list` procedures in this codebase use. This procedure's non-conformance to that pattern is a known, separate, already-logged gap (`docs/development-findings-log.md`, entry `LOG-0087`) that is explicitly out of scope here — fixing it would be a larger, separate design decision about pagination on this endpoint, not part of closing the chairperson-prefill bug. Do not add an `.output()` Zod schema to this procedure either, for the same reason — that's also part of the larger, deliberately-deferred restructuring, not this fix.

**Frontend verification required, not just assumed**: `apps/web/src/pages/organization/CommitteeManagementPage.tsx`'s local `CommitteeSummary` interface already declares `chairedByEmployeeId?: string | null`, and `openEdit` (search for `const openEdit = (committee: CommitteeSummary)`) already reads `committee.chairedByEmployeeId || ''` to populate `formData.chairedByEmployeeId`. Based on reading the current file, no frontend code change should be needed once the backend returns the real value — but do not assume this holds without checking. After making the backend change, actually re-read `CommitteeManagementPage.tsx`'s current state and confirm the interface and `openEdit` still line up correctly with the now-populated field. If they don't line up cleanly for some reason not visible from this description, stop and report the specific mismatch rather than silently patching around it.

## Part 2 — Remove Two Unnecessary Type Assertions from `TASK-ORG-LINT-001`

**File**: `apps/server/src/modules/organization/organization.router.ts`

Two `as string` casts were added during `TASK-ORG-LINT-001` at call sites that were verified (via direct testing against this project's pinned `drizzle-orm@0.45.2` and `zod@4.4.3`, using the actual schema and input shapes) to not need a cast — TypeScript's control-flow narrowing already handles both cases correctly without one. These are safe as written (they're narrowing casts to the type TS already infers, not `any`-related), but they're unnecessary. Remove them:

1. In `createEmployee`, find:

```typescript
employeeNumber: input.employeeNumber as string,
```

and change to:

```typescript
employeeNumber: input.employeeNumber,
```

This works because of the preceding guard `if (!input.employeeNumber) { throw ... }`, which narrows `input.employeeNumber` (declared as `string | null | undefined` via `z.string().nullish()`) down to `string` for the rest of the function.

2. In `createCommittee`, find:

```typescript
chairedByEmployeeId: input.chairedByEmployeeId as string,
```

and change to:

```typescript
chairedByEmployeeId: input.chairedByEmployeeId,
```

Same mechanism — the preceding guard `if (!input.chairedByEmployeeId) { throw ... }` already narrows it to `string`.

**What NOT to touch**: do not touch `updateEmployee`'s or `updateCommittee`'s `Parameters<typeof orgRepository.X.update>[1]` assertions, or the `as string` casts inside their conditional-spread blocks (e.g. `{ employeeNumber: rest.employeeNumber as string }`). Those exist for a different, confirmed-necessary reason — the conditional-spread pattern they're part of does not preserve TypeScript's narrowing the way a direct guard-then-object-literal assignment does, so removing those would likely produce a real compile error. Only the two casts named above in `createEmployee`/`createCommittee` are affected by this part of the task.

**Verification**: after both removals, run `pnpm --filter server typecheck` and confirm it's still clean. If removing either cast produces a compile error, that means my analysis of the narrowing behavior doesn't hold for the code as it currently exists — stop and report the exact error rather than restoring the cast silently, since that would indicate something about this codebase's actual types differs from what was tested.

## Part 3 — Append a Findings-Log Entry

**File**: `docs/development-findings-log.md`

Append the following as a new entry at the end of the file (after the current last entry, `LOG-0088`), formatted to match the existing entries' structure exactly. Do not edit any existing entry, including `LOG-0087` — this file is append-only.

```
### [LOG-0089] `listCommittees` now returns `chairedByEmployeeId`, closing a chairperson-prefill bug — LOG-0087's broader envelope-shape question remains open

- date: 2026-07-12
- task_id: TASK-ORG-LINT-002
- status: proposed
- affects: apps/server/src/modules/organization/organization.router.ts
- refines: LOG-0087

**What was found:**
While reviewing `TASK-ORG-LINT-001`'s implementation, `CommitteeManagementPage.tsx`'s `openEdit` function was found to read `committee.chairedByEmployeeId` when pre-populating the Chairperson field on the edit-committee dialog, but `organization.listCommittees` explicitly excluded this field from its returned object (via a hand-written 5-field object literal that omitted a field otherwise present on every row). The `committees` table's `chaired_by_employee_id` column is `.notNull()` and was already present on every row `orgRepository.committees.findAll(...)` returned post-`TASK-ORG-LINT-001` — the field was being dropped by `listCommittees`'s own mapping logic, not missing from the underlying data. Practical effect: opening the edit dialog for any committee always showed an empty Chairperson field regardless of the committee's actual chair, and saving without manually re-selecting one would silently clear the real chairperson on that committee.

**What was implemented:**
`listCommittees` now includes `chairedByEmployeeId: r.chairedByEmployeeId` in its returned object, typed as `string` (matching the column's non-nullable constraint). No frontend changes were required — `CommitteeManagementPage.tsx`'s local `CommitteeSummary` interface already declared this field, and `openEdit` was already written to read it correctly; it simply had never been receiving a real value.

**[Inference]** This is a narrow, targeted fix for the one field needed to close the observed bug. It does not address the broader gap `LOG-0087` describes — `listCommittees` still does not conform to this codebase's `{ items: T[], nextCursor: string | null }` list-procedure envelope convention, and still has no `.output()` Zod schema. Whether E1/I2 should be updated to document this procedure (and whether it should be restructured to match the standard envelope as part of that), as `LOG-0087` already asks, is unchanged by this fix and remains a question for a human.
```

## Final Reporting Requirement

After completing all three parts, report back with: (1) confirmation of whether the frontend verification in Part 1 found any mismatch, (2) the result of `pnpm --filter server typecheck` after Part 2's removals, and (3) confirmation the Part 3 entry was appended without modifying any existing entry.

---

That's the standalone prompt. A few things I want to flag directly to you, separate from the prompt text itself, since you're the one deciding what happens next and I don't want these buried:

- I did not re-run any of this through a real linter or the real TypeScript compiler in the actual monorepo context — everything above rests on manual tracing plus the isolated, faithful-but-narrow compiler repros I ran (pinned versions, real schema/input shapes copied verbatim). That's the same caveat that's applied throughout this project's manual-verification approach, but it's worth restating here specifically because this prompt makes claims ("no frontend changes should be needed") with real confidence behind them that I still want the executor to independently check rather than take on faith.
- This prompt doesn't touch `OrganizationPage.tsx`'s ~23 untraced errors or any of the other unstarted files — that's still open and unscoped, exactly as before. When you're ready to sequence that, it's a fresh investigation, not a continuation of this prompt.

# TASK-DOCS-LINT-004

## Context

This is a fresh, standalone investigation of two previously-untouched files from the `batac-dms` lint-remediation effort: `apps/web/src/pages/documents/DocumentIntakePage.tsx` (6 known lint errors) and `apps/web/src/pages/documents/DocumentRequestIntakeClerkAssistedPage.tsx` (5 known lint errors). This prompt is self-contained; you do not need context from any other task in this effort to execute it.

## Part 1 — `apps/web/src/pages/documents/DocumentIntakePage.tsx`

**Finding 1 & 2: Two `as any` casts on `mimeType`, lines 97 and 118**

Current code:

```typescript
// line 97, inside requestUploadUrl.mutateAsync(...)
mimeType: file.type as any,

// line 118, inside confirmUpload.mutateAsync(...)
mimeType: file.type as any,
```

`file.type` comes from the native browser `File` API and is typed as plain `string`. Both `requestUploadUrl` and `confirmUpload`'s tRPC input schemas expect `mimeType` to be `AllowedMimeTypeSchema` (defined in `packages/shared/src/schemas/common.ts`), a 5-value Zod enum: `'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'image/png' | 'image/jpeg'`. A plain `string` cannot be assigned to this narrower type without either a runtime check or a cast — `as any` currently bypasses this rather than performing the check.

This file already has partial, informal runtime validation of `file.type` in `handleFileChange` (lines 60-72, a `validTypes.includes(selected.type)` check) — but that check happens in a separate function from `onSubmit`, so it does not (and cannot, given the function boundary) narrow the type at the two call sites where the casts currently are.

**Fix**: import `AllowedMimeTypeSchema` from `@batac/shared`, and add a real type-narrowing check inside `onSubmit`, immediately after the existing `if (!file) { ... return; }` guard (do not remove or alter that existing guard):

```typescript
const mimeTypeCheck = AllowedMimeTypeSchema.safeParse(file.type);
if (!mimeTypeCheck.success) {
  setFileError('Unsupported file type');
  setIsUploading(false); // only needed if this check is placed after setIsUploading(true) — see placement note below
  return;
}
```

Then replace both `file.type as any` occurrences with `mimeTypeCheck.data`.

**Placement note**: place this new check _before_ the existing `setIsUploading(true)` call (i.e., right after the `if (!file)` guard, before the `try` block), not inside the `try` block, so that a mimetype failure doesn't need to reset `isUploading` back to `false` in a `finally` — it simply returns before that state is ever set. This was verified structurally sound against the file's current control flow, but re-read the current `onSubmit` function before applying this to confirm the guard ordering still matches this description.

**Known, deliberately out-of-scope observation**: `handleFileChange`'s `validTypes` array (line 67) only lists 3 of the 5 MIME types `AllowedMimeTypeSchema` actually accepts (missing the two Office document types: `.docx`/`.xlsx`). This means a user attempting to upload a Word or Excel document — which the backend is built to accept — would currently be blocked by this earlier, stricter client-side check before ever reaching the new check added above. Do not change `validTypes` as part of this task; whether the intake form should accept Office documents is a product decision outside a lint-remediation task's scope. Leave a `// TODO:` comment at the `validTypes` declaration noting the discrepancy, but do not otherwise touch it.

**Finding 3: `catch (err: any)`, line 124**

Current code:

```typescript
} catch (err: any) {
  toast.error(err.message || 'An error occurred during upload');
}
```

**Fix**: remove the `: any` annotation (the binding will default to `unknown` under this project's `strict: true` config) and narrow at the point of use, matching the exact pattern already established and confirmed lint-clean in `apps/web/src/pages/documents/DocumentDetailPage.tsx` (line 653):

```typescript
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'An error occurred during upload');
}
```

**Confirmed non-issue, do not touch**: the file's `import React, { useState } from 'react';` (line 2) is used for the explicit `React.ChangeEvent<HTMLInputElement>` type annotation on `handleFileChange`'s parameter (line 52) — this is a genuine usage, not dead weight, and this exact pattern (`React.ChangeEvent` with a default `React` import) is already present in `DocumentDetailPage.tsx`, which is independently confirmed lint-clean. Do not remove this import.

## Part 2 — `apps/web/src/pages/documents/DocumentRequestIntakeClerkAssistedPage.tsx`

**Finding 1: `catch (err: any)`, line 86**

Identical pattern and identical fix to Part 1's Finding 3:

```typescript
// current
} catch (err: any) {
  toast.error(err.message || 'Failed to create document request');
}

// fix
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'Failed to create document request');
}
```

**Finding 2: `data={printableFormData.data as any}`, line 111**

Current code:

```tsx
{
  printableFormData.data && <PrintableFormView data={printableFormData.data as any} />;
}
```

This cast was checked against the real backend and frontend types and confirmed unnecessary — `documentRequests.generatePrintableForm` (the procedure backing `printableFormData`) already has a real `.output(PrintableFormOutputSchema)` schema whose field shape matches `PrintableFormView`'s `PrintableFormData` prop type closely enough (one extra field on the server side, `requester.citizenUserId`, which does not block the assignment) that no cast should be needed.

**Fix**: remove the cast:

```tsx
{
  printableFormData.data && <PrintableFormView data={printableFormData.data} />;
}
```

**Verification required, not just assumed**: after making this change, run `pnpm --filter @batac/web typecheck`. This specific removal was verified via an isolated compiler test using hand-copied schema definitions, not by running this project's actual build — if it produces a real error, stop and report the exact error rather than restoring the cast silently, since that would mean something about the real, fully-resolved types (as opposed to the isolated test's approximation) differs from what was checked.

**Confirmed non-issue, do not touch**: same as Part 1 — `import React, { useState } from 'react';` (line 3) is not flagged; leave as-is.

## Final Reporting Requirement

After completing both parts, report: (1) the result of `pnpm --filter server typecheck` and `pnpm --filter @batac/web typecheck`, (2) whether the Part 2 Finding 2 removal compiled clean against the real project types or required reverting, (3) a fresh `pnpm --filter @batac/web lint` count for these two specific files, since the fixes here were derived from manual tracing plus isolated compiler tests, not from the real linter — the resulting count should be reported plainly rather than assumed to match the 6-and-5 figures cited above.

---

# TASK-DOCS-LINT-005 — Remove unused `React` import is NOT included; scope below is exactly 3 findings

**File**: `apps/web/src/pages/documents/ComplaintIntakeClerkAssistedPage.tsx`

Fix the two lint errors below. Do not touch anything else in this file, including the `React` import at line 2 (it is currently unused but is NOT flagged by ESLint in this file for reasons not fully determined in a prior investigation — leave it as-is, out of scope for this task).

**Finding 1 — `catch (err: any)` at lines 70–71:**

Current code (lines 59–73):

```typescript
const onSubmit = async (data: ComplaintIntakeValues) => {
  try {
    const payload = {
      ...data,
      respondentEmail: data.respondentEmail || undefined, // send undefined if empty string
    };

    const result = await createComplaint.mutateAsync(payload);

    toast.success('Complaint logged successfully');
    navigate(`/complaints/${result.complaintId}`);
  } catch (err: any) {
    toast.error(err.message || 'An error occurred while logging the complaint');
  }
};
```

Replace the `catch` block:

```typescript
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred while logging the complaint');
    }
```

This resolves both `@typescript-eslint/no-explicit-any` (line 70) and `@typescript-eslint/no-unsafe-member-access` (line 71) — both errors stem from the single `err: any` annotation.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/documents/ComplaintIntakeClerkAssistedPage.tsx` and confirm zero errors are reported for this file.

---

# TASK-DOCS-LINT-006

**File**: `apps/web/src/pages/documents/DocumentListPage.tsx`

**Finding**: line 75 has a `console.log` inside the empty-state's "New Document" button `onClick` handler, currently the button's only behavior — clicking it does nothing visible. This is a `no-console` ESLint error (configured as `'error'` in `packages/config/eslint.base.js`).

Current code (lines 66–78):

```tsx
<EmptyState
  icon={FileText}
  heading="No documents available"
  body="There are no documents to display at this time. This could be due to your current access permissions or active filters."
  action={{
    label: 'New Document',
    onClick: () => {
      // Placeholder action for New Document
      console.log('New Document clicked');
    },
  }}
/>
```

This file already has a working `<Link to="/documents/new">` pattern used elsewhere for the same semantic action (creating a new document) — locate it in this same file and use the identical navigation target. Replace the `onClick` handler so the button actually navigates to `/documents/new`, matching whatever component/pattern (`Link`, `useNavigate`, etc.) this file already uses elsewhere for that same destination. Do not introduce a new navigation pattern if one already exists in this file — match the existing one.

**Scope**: only this one `onClick` handler. Do not touch any other part of `EmptyState`'s props, and do not touch anything outside this component.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/documents/DocumentListPage.tsx` and confirm zero errors.

---

# TASK-DOCS-LINT-007

**File**: `apps/web/src/pages/documents/DocumentRequestsListPage.tsx`

**Finding**: line 22 imports a type-only `DocumentState` that is never used anywhere in this file.

Current import block (lines 18–22):

```typescript
import { mapLifecycleStateToDocumentState } from '../../lib/status-mapping';
import { trpc } from '../../lib/trpc';

import type { RouterOutputs } from '../../lib/trpc';
import type { DocumentState } from '@batac/ui/types/domain';
```

Delete the line `import type { DocumentState } from '@batac/ui/types/domain';` entirely. Do not touch the other three import lines in this block — `mapLifecycleStateToDocumentState` (line 18) IS used (line 56 in the current file, `mapLifecycleStateToDocumentState(info.getValue())`) and must remain.

**Scope**: only this one import line. This resolves `@typescript-eslint/no-unused-vars` at line 22:15.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/documents/DocumentRequestsListPage.tsx` and confirm zero errors.

---

# TASK-ORG-LINT-004

**File**: `apps/web/src/pages/organization/CommitteeManagementPage.tsx`

**Finding**: line 41 declares a local `EmployeeSummary` interface (3 fields: `employeeId`, `displayName`, `positionTitle`) that is never used anywhere in this file — confirmed via full-file search, only the declaration exists.

Current code (lines 32–45):

```typescript
interface CommitteeSummary {
  committeeId: string;
  name: string;
  code: string | null;
  description: string | null;
  chairedByEmployeeId?: string | null;
  deletedAt: Date | string | null;
}

interface EmployeeSummary {
  employeeId: string;
  displayName: string;
  positionTitle: string | null;
}
```

Delete the entire `EmployeeSummary` interface block (lines 41–45, including the blank line that separates it from `CommitteeSummary` above — leave exactly one blank line after `CommitteeSummary`'s closing brace, matching the file's existing spacing convention elsewhere). Do not touch `CommitteeSummary` — it is actively used throughout this file, including its `chairedByEmployeeId` field, and must remain exactly as-is.

**Scope**: only the `EmployeeSummary` interface declaration. This resolves `@typescript-eslint/no-unused-vars` at line 41:11.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/organization/CommitteeManagementPage.tsx` and confirm zero errors.

---

# TASK-ORG-LINT-005

**File**: `apps/web/src/pages/organization/OrganizationPage.tsx`

**Finding**: lines 216–217 have an `react-hooks/exhaustive-deps` warning. The `useMemo` at line 217 correctly lists `offices` as a dependency, but `offices` itself (line 216) is not a stable reference across renders — `hierarchy?.offices ?? []` creates a brand-new empty-array literal on every render where `hierarchy.offices` is falsy, defeating the memoization.

Current code (lines 216–217):

```tsx
const offices = hierarchy?.offices ?? [];
const tree = useMemo(() => buildTree(offices), [offices]);
```

Replace with:

```tsx
const offices = useMemo(() => hierarchy?.offices ?? [], [hierarchy]);
const tree = useMemo(() => buildTree(offices), [offices]);
```

This wraps `offices`'s own initialization in a `useMemo` keyed on `hierarchy` (the tRPC query result, a stable dependency), so `offices` only produces a new array reference when `hierarchy` itself actually changes. `hierarchy` comes from `trpc.organization.getOfficeHierarchy.useQuery()` a few lines above this block — do not change that query call. `buildTree` is a module-level function declared earlier in this file and does not need to appear in any dependency array.

**Scope**: only these two lines. Do not touch anything else in this file.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/organization/OrganizationPage.tsx` and confirm zero warnings or errors reported for this file, and specifically confirm the `react-hooks/exhaustive-deps` warning at line 216 no longer appears.

---

# TASK-SYS-LINT-001

**File**: `apps/web/src/pages/sysadmin/UserAccountManagementPage.tsx`

Two independent findings in this file. Fix both.

**Finding 1 — unused `Badge` import (line 14):**

Confirmed genuinely unused throughout the file via full-file search. Locate the import statement that includes `Badge` (part of a multi-line import from `@batac/ui`) and remove `Badge` from that import list. Do not remove or alter any other named import in that same import statement — only the `Badge` entry.

**Finding 2 — dead `onRefresh` prop, three locations:**

`UserRow` (a component defined in this same file) accepts a required `onRefresh: () => void` prop but never calls it anywhere in its body — internally, `UserRow`'s own mutation handlers already call `void utils.iam.listUserDirectory.invalidate()` directly on success, which is the correct, more robust mechanism (tRPC/TanStack Query's `.invalidate()` marks all active queries under that key as stale and triggers refetch automatically for every subscriber, regardless of how many components are mounted — more robust than a single parent's `refetch` callback).

Current state, three locations:

Location A — the `UserRowProps` interface (around line 230–236):

```typescript
interface UserRowProps {
  userId: string;
  username: string;
  email: string;
  status: string;
  onRefresh: () => void;
}
```

Remove the `onRefresh: () => void;` line from this interface.

Location B — the destructured function parameter (around line 238):

```typescript
function UserRow({ userId, username, email, status, onRefresh }: UserRowProps) {
```

Remove `onRefresh` from the destructuring, leaving:

```typescript
function UserRow({ userId, username, email, status }: UserRowProps) {
```

Location C — the call site (around line 402–409):

```tsx
<UserRow
  key={user.id}
  userId={user.id}
  username={user.username}
  email={user.email}
  status={user.status}
  onRefresh={() => directoryQuery.refetch()}
/>
```

Remove the `onRefresh={() => directoryQuery.refetch()}` line, leaving:

```tsx
<UserRow
  key={user.id}
  userId={user.id}
  username={user.username}
  email={user.email}
  status={user.status}
/>
```

**All three locations must be changed together.** Removing `onRefresh` from only the lint-reported site (the destructured parameter) while leaving it in the interface or call site would leave the codebase in a worse, inconsistent state. `directoryQuery` (referenced at the call site) is a separate variable elsewhere in this file that is used for other purposes — do not remove or alter `directoryQuery` itself, only the specific `onRefresh={...}` prop line that references it.

**Scope**: exactly these two findings (the `Badge` import, and the three-location `onRefresh` removal). Do not touch the `Array.from({ length: 3 })` loading-skeleton code elsewhere in this file — that has already been fixed in a prior session and should not be modified.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/sysadmin/UserAccountManagementPage.tsx` and confirm zero errors.

---

# TASK-WF-LINT-001

**File**: `apps/web/src/pages/workflow/OrderOfBusinessPage.tsx`

Two independent findings in this file. Fix both. Read the whole prompt before starting — Finding 2 involves a component and variable name (`sessionDate`) that also appears, completely unrelated, in a different component later in this same file, and you must not touch that unrelated usage.

**Finding 1 — dead `isAllSubmitted` variable (line 257):**

Inside the `OobItemRow` component:

```tsx
const isRedFlagged = item.committeeReportStatus === 'red_flagged';
const isAllSubmitted = item.committeeReportStatus === 'all_submitted';
```

`isAllSubmitted` is never referenced anywhere else in `OobItemRow`'s body — confirmed via full-component search. (The visual "all submitted" state is already independently handled by the `CommitteeStatusBadge` component a few lines later via its own internal status check; `isAllSubmitted` is unconnected leftover.) Delete the `const isAllSubmitted = item.committeeReportStatus === 'all_submitted';` line entirely. Do not touch the `isRedFlagged` line above it — that variable IS used elsewhere in this component and must remain.

**Finding 2 — dead `sessionDate` prop chain, four locations:**

`sessionDate` is passed down through a chain of four locations into `SecretaryItemActions`, where it is received but never read, and not forwarded to either of the two dialog components `SecretaryItemActions` renders. The server-side mutation this component eventually calls (`enterCommitteeHearingDate`) has no `sessionDate` field in its input schema at all — there is no legitimate destination for this value in this component tree. This is dead prop-drilling, not a wiring bug with a missing consumer to restore.

**Do NOT confuse this with a separate, unrelated, and genuinely live `sessionDate` usage** in a different component in this same file, `ScheduleForFirstReadingPanel` (defined later, uses `sessionDate?: Date` as an optional initial value for a date-picker `useState`, and re-submits it in a mutation payload). That usage is correct, working code and must not be touched by this task. The two usages share a variable name but are otherwise unconnected.

The four locations to change, all in the dead chain:

Location A — `OobItemRowProps` interface (around line 239–245):

```typescript
interface OobItemRowProps {
  item: OobItem;
  agendaNumber: number;
  isSecretary: boolean;
  sessionDate: Date;
  onMutationSuccess: () => void;
}
```

Remove the `sessionDate: Date;` line.

Location B — `OobItemRow`'s destructured parameters (around line 247–253):

```typescript
function OobItemRow({
  item,
  agendaNumber,
  isSecretary,
  sessionDate,
  onMutationSuccess,
}: OobItemRowProps) {
```

Remove `sessionDate,` from the destructuring.

Location C — the forward-call to `SecretaryItemActions` inside `OobItemRow`'s body (around line 342–346):

```tsx
<SecretaryItemActions item={item} sessionDate={sessionDate} onSuccess={onMutationSuccess} />
```

Remove the `sessionDate={sessionDate}` line.

Location D — `SecretaryItemActions`'s own signature (around line 396–404):

```typescript
function SecretaryItemActions({
  item,
  sessionDate,
  onSuccess,
}: {
  item: OobItem;
  sessionDate: Date;
  onSuccess: () => void;
}) {
```

Remove `sessionDate,` from the destructuring AND remove `sessionDate: Date;` from the inline type. Result:

```typescript
function SecretaryItemActions({
  item,
  onSuccess,
}: {
  item: OobItem;
  onSuccess: () => void;
}) {
```

Location E (the top-level pass-in that supplies `sessionDate` to `OobItemRow` in the first place, around line 211–219):

```tsx
{
  data.items.map((item, idx) => (
    <OobItemRow
      key={item.documentId}
      item={item}
      agendaNumber={idx + 1}
      isSecretary={isSecretary}
      sessionDate={new Date(data.sessionDate)}
      onMutationSuccess={() => void refetch()}
    />
  ));
}
```

Remove the `sessionDate={new Date(data.sessionDate)}` line.

**All five locations (A through E) must be changed together** — removing `sessionDate` from only the lint-reported site (`SecretaryItemActions`'s signature, Location D) would just relocate the unused-variable error one level up to `OobItemRow`'s own destructuring (Location B), producing a new, different lint error instead of resolving anything.

**Explicitly out of scope, do not touch**: the `ScheduleForFirstReadingPanel` component (including its own `sessionDate` prop, its `useState` initial value, and its mutation call) — this is a separate, correct, unrelated usage sharing only a variable name. Also do not touch the `{...(data ? { sessionDate: new Date(data.sessionDate) } : {})}` line that feeds `ScheduleForFirstReadingPanel` — that is the live usage's own data source, not part of the dead chain.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/workflow/OrderOfBusinessPage.tsx` and confirm zero errors reported for `isAllSubmitted` or `sessionDate` in this file. Also run `pnpm --filter @batac/web typecheck` (or `pnpm --filter @batac/web exec tsc --noEmit` if that script name doesn't exist — check `apps/web/package.json` first) to confirm no new type errors were introduced by removing `sessionDate` from `OobItemRowProps` and `SecretaryItemActions`'s inline type — since these are prop-chain removals across multiple call sites, a stale reference at any of the five locations would surface as a type error, not just a lint error.

---

# TASK-WF-LINT-002

**Files**: `apps/server/src/modules/workflow/workflow.router.ts` (the actual fix) and `apps/web/src/pages/workflow/columns.tsx` (where the lint error is reported, but which should require zero changes if the server-side fix is correct).

**Finding**: `apps/web/src/pages/workflow/columns.tsx` line 85 has a `@typescript-eslint/no-unsafe-assignment` error at `row.original.stepType`. `AssignedStepRow` (this file's row type, declared at line 7: `type AssignedStepRow = RouterOutputs['workflow']['listMyAssignedSteps']['items'][number];`) is a real inferred tRPC type, not a hand-written interface — so the `any` leak originates upstream, at the server.

**Root cause, confirmed in `apps/server/src/modules/workflow/workflow.router.ts`**: the `listMyAssignedSteps` procedure (starts at line 516 in the current file — re-verify this line number before editing, since this is a 2551-line file and other work may have shifted it) has no `.output()` Zod schema at all. Inside its `.map()` callback (currently around lines 607–629), the specific leak is:

```typescript
const items = paginated.map((item) => {
  const validStepTypes = new Set([
    'action',
    'approval',
    'multi_referral',
    'decision',
    'notification',
    'termination',
  ]);
  const stepType = validStepTypes.has(item.stepType) ? (item.stepType as any) : 'action';

  return {
    stepInstanceId: item.stepInstanceId,
    instanceId: item.instanceId,
    documentId: item.documentId,
    documentTitle: item.documentTitle,
    stepType,
    assignedAt: item.createdAt,
    dueAt: item.slaDeadline,
  };
});
```

`Set<string>.has()` does not narrow the checked value's type the way `Array.includes()` sometimes can — so the ternary's true-branch needed an `as any` to compile.

**Fix**: type the `Set` itself as a literal union, so `.has()`'s narrowing is unnecessary. Replace:

```typescript
const validStepTypes = new Set([
  'action',
  'approval',
  'multi_referral',
  'decision',
  'notification',
  'termination',
]);
const stepType = validStepTypes.has(item.stepType) ? (item.stepType as any) : 'action';
```

with:

```typescript
const validStepTypes = new Set<
  'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination'
>(['action', 'approval', 'multi_referral', 'decision', 'notification', 'termination']);
const stepType = validStepTypes.has(item.stepType) ? item.stepType : 'action';
```

**Note on the resulting type — do not "improve" this further**: this removes the `any`, but the resulting type of `stepType` is `string`, not the tight 6-value literal union — `Set.has()`'s return type is plain `boolean` and does not narrow the checked argument afterward, regardless of how the `Set` itself is typed. This is fine and does not need further work: `StepTypeBadge` (in `columns.tsx`, the frontend consumer) already types its own `stepType` prop as plain `{ stepType: string }`, so no mismatch is introduced. Do not attempt to force a tighter literal-union return type here — it is unnecessary and not what this task is asking for.

**Explicitly out of scope for this task — do not do this as part of this fix**: adding a `.output()` Zod schema to `listMyAssignedSteps`. That is a separate, larger documentation/contract-safety improvement (the procedure currently has no output schema at all, which is a broader gap than just this one `as any`). If you believe this is worth doing, stop and report it rather than folding it into this task — do not silently expand scope.

**Frontend file**: after making the server-side change above, do NOT make any changes to `apps/web/src/pages/workflow/columns.tsx`. TypeScript's inference should flow through automatically once the `as any` cast is removed server-side, resolving the lint error at line 85 with zero frontend changes. If, after making the server-side change, the frontend lint error at `columns.tsx:85` does NOT resolve on its own, stop and report this — do not make a frontend-side workaround (such as adding a cast or annotation in `columns.tsx`) without checking back first, since that would indicate the root-cause diagnosis above was incomplete.

**Verification**: run `pnpm --filter server typecheck` and confirm no new errors. Then run `pnpm --filter @batac/web exec eslint src/pages/workflow/columns.tsx` and confirm the `no-unsafe-assignment` error at line 85 is gone, without having touched this file.

---

# TASK-WF-LINT-003

**File**: `apps/web/src/pages/workflow/panels/PanlalawiganOutcomePanel.tsx`

Three independent findings in this file. Fix all three.

**Finding 1 — unused `Input` import (line 7):**

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
} from '@batac/ui';
```

`Input` is imported but never used anywhere in this file's JSX or logic (confirmed via full-file search — only `Select`, `Textarea`, `Button`, and the `Card` family are actually rendered). Remove `Input,` from this import list. Do not remove or alter any other name in this import statement.

**Finding 2 & 3 — two `onValueChange={(val: any) => ...}` sites (lines 62 and 94):**

```tsx
          <Select value={outcome} onValueChange={(val: any) => setOutcome(val)}>
```

and, further down:

```tsx
          <Select value={resolutionPath} onValueChange={(val: any) => setResolutionPath(val)}>
```

`outcome` and `resolutionPath` are `useState` values declared earlier in this file (lines 19 and 22 respectively) with specific narrow literal-union types:

```typescript
  const [outcome, setOutcome] = useState<'VALID' | 'VALID_IN_PART' | 'OPERATIVE_IN_ITS_ENTIRETY' | 'RETURNED' | ''>('');
  ...
  const [resolutionPath, setResolutionPath] = useState<'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly'>('resolve_as_is');
```

**Do not simply change `(val: any)` to `(val: string)`** — this will produce a NEW type error at the `setOutcome(val)`/`setResolutionPath(val)` call, because `string` is wider than the state setters' expected literal-union types. The correct fix is to type each callback parameter with the exact same literal union already declared at the corresponding `useState` call.

Replace:

```tsx
          <Select value={outcome} onValueChange={(val: any) => setOutcome(val)}>
```

with:

```tsx
          <Select value={outcome} onValueChange={(val: 'VALID' | 'VALID_IN_PART' | 'OPERATIVE_IN_ITS_ENTIRETY' | 'RETURNED' | '') => setOutcome(val)}>
```

Replace:

```tsx
          <Select value={resolutionPath} onValueChange={(val: any) => setResolutionPath(val)}>
```

with:

```tsx
          <Select value={resolutionPath} onValueChange={(val: 'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly') => setResolutionPath(val)}>
```

This compiles cleanly because `Select` (re-exported from `@radix-ui/react-select`) declares its `onValueChange` prop using TypeScript method-shorthand syntax (`onValueChange?(value: string): void;`), which TypeScript checks bivariantly rather than contravariantly — a narrower-parameter callback is permitted here in a way it would not be for an ordinary function-property-typed prop. You do not need to understand or verify this mechanism to apply the fix; the literal unions above are copied exactly from the existing `useState` declarations in this same file, so there is no separate typing decision to make.

**Scope**: only these three findings, all within this one file. Do not touch anything else, including the `useState` declarations themselves (they are already correct and are the source of the literal unions used above).

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/workflow/panels/PanlalawiganOutcomePanel.tsx` and confirm zero errors. Also run `pnpm --filter @batac/web typecheck` (or the equivalent `tsc --noEmit` invocation — check `apps/web/package.json` for the exact script name) and confirm no new type errors, since a mismatched literal union between the callback and the `useState` declaration would surface as a type error, not a lint error.

---

# TASK-DOCS-LINT-008

**File**: `apps/web/src/pages/documents/DocumentRequestIntakeClerkAssistedPage.tsx`

**Context confirmed before this task was written, so the executor doesn't need to re-derive it**: this page's governing spec, `TASK-FE-DOCS-005` (`docs/pre-development/A-project-planning/a1-tasks/fe.md`, lines 1939–1954), states the intake form's submit flow should navigate to the new request's detail page on success — full stop — and that the print-preview feature is a **separate** capability meant to live on the detail page or list page ("offer a 'print' action once a request exists (post-creation, **or from the list/detail pages**)"), not inside this intake form's own flow. Confirmed directly: `DocumentRequestDetailPage.tsx` does not currently implement this print action either (it's simply not built yet, on either page it was spec'd for) — so the print-related state below is not a partial wire-up of a feature this file is supposed to have; it's leftover state for a feature that was never meant to live here at all.

**Finding**: `setCreatedRequestId` (from `useState<string | null>(null)` at line 45) is never called anywhere in this file. `onSubmit` (lines 75–89) receives a real `requestId` from the mutation response at line 77 and discards it, navigating away immediately at line 85. As a direct consequence, the entire print-preview branch (lines 93–113) is permanently unreachable dead code — `showPrintView` (line 44) is likewise never set to `true` anywhere in the file.

**Fix — remove the dead print-preview state and branch entirely.** This is a straightforward deletion; there is no design decision left to make, since the spec already places this feature elsewhere and it isn't built there yet either.

1. Delete these two `useState` declarations (lines 44–45):

```typescript
const [showPrintView, setShowPrintView] = useState(false);
const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
```

2. Delete the `printableFormData` query (lines 50–53):

```typescript
const printableFormData = trpc.documents.generatePrintableForm.useQuery(
  { requestId: createdRequestId! },
  { enabled: !!createdRequestId && showPrintView },
);
```

3. Replace the conditional render (currently lines 91–253):

```tsx
return (
  <div className="container mx-auto max-w-2xl py-8">
    {showPrintView && createdRequestId ? (
      <div className="space-y-4">
        <div className="no-print flex items-center justify-between">
          <h2 className="text-lg font-semibold">Print Preview</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPrintView(false)}>
              Back to Form
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
        {printableFormData.data && <PrintableFormView data={printableFormData.data} />}
      </div>
    ) : (
      <Card>{/* ... the actual form, unchanged ... */}</Card>
    )}
  </div>
);
```

with just the `Card` branch's content, unconditionally rendered — remove the ternary and the entire print-preview true-branch:

```tsx
return (
  <div className="container mx-auto max-w-2xl py-8">
    <Card>
      {/* ... the actual form, exactly as it currently exists in the false-branch, completely unchanged ... */}
    </Card>
  </div>
);
```

Do not change anything inside the `Card` block itself — its contents (the form, all fields, the field array, the footer buttons) are unaffected by this task and must be preserved exactly as they currently are. This step only removes the outer ternary and its now-dead true-branch, keeping the `Card` and un-indenting it one level.

4. Two imports become unused as a direct result of steps 1–3 and must also be removed, or this task will trade one lint error for two new ones:
   - `Printer` — remove it from the `lucide-react` import at line 2 (`import { Plus, Trash2, Printer } from 'lucide-react';` → `import { Plus, Trash2 } from 'lucide-react';`). Do not remove `Plus` or `Trash2` — both are used elsewhere in the form (the "Add Document" and per-row delete buttons).
   - `PrintableFormView` — remove the entire import line: `import { PrintableFormView } from './PrintableFormView';` (currently line 21). Do not delete the `PrintableFormView.tsx` file itself — only this file's import of it. (`PrintableFormView.tsx` is not otherwise part of this task's scope.)

**Do not touch**: `onSubmit`, the mutation calls, the Zod schema, `useFieldArray`, or any form field — none of these are affected by removing the dead print-preview state.

**Verification**: after the change, run `pnpm --filter @batac/web exec eslint src/pages/documents/DocumentRequestIntakeClerkAssistedPage.tsx` and confirm zero errors — specifically confirm the `no-unused-vars` error on `setCreatedRequestId` is gone, and that no new `no-unused-vars` errors appear for `Printer` or `PrintableFormView`. Also run `pnpm --filter @batac/web typecheck` to confirm the JSX restructuring didn't introduce a type error.

---

# TASK-DOCS-LINT-006-FOLLOWUP

**File**: `apps/web/src/pages/documents/DocumentListPage.tsx`

**Context**: this file's empty-state "New Document" button was recently fixed to navigate to `/documents/new` instead of doing nothing (it previously only ran `console.log`). The fix works correctly, but used `useNavigate()` inside the `onClick` handler, introducing a second, different navigation mechanism into a file that already uses `<Link to="/documents/new">` elsewhere for the exact same destination (the header "New Document" button, a few lines below). This task brings the two into alignment on the existing pattern.

Current code (around lines 1-4 and 66-81):

```tsx
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { FileText, Loader2, Plus } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
```

```tsx
export function DocumentListPage() {
  const navigate = useNavigate();
  const { filters } = useDocumentFilters();
```

```tsx
<EmptyState
  icon={FileText}
  heading="No documents available"
  body="There are no documents to display at this time. This could be due to your current access permissions or active filters."
  action={{
    label: 'New Document',
    onClick: () => {
      navigate('/documents/new');
    },
  }}
/>
```

**Fix**: `EmptyState`'s `action` prop takes an `onClick` handler, not a `to`/`href`, so this can't be swapped for a bare `<Link>` directly — the fix is to keep the `onClick` shape but call `navigate()` from inside it only as a last resort if `EmptyState`'s API genuinely offers no link-based alternative. Before making any change, check `EmptyState`'s prop type (it's exported from `@batac/ui` — find its definition, likely under `packages/ui/src`) for whether `action` supports a `to`/`href`-style prop in addition to or instead of `onClick`.

- If `EmptyState`'s `action` prop supports a link-style target (e.g. `to: string`) as an alternative to `onClick`, use that instead: replace `onClick: () => { navigate("/documents/new"); }` with the equivalent link-target prop pointing at `/documents/new`, matching whatever prop name `EmptyState` actually defines.
- If `EmptyState`'s `action` prop only supports `onClick` and offers no link-based alternative, then `useNavigate()` is in fact the only mechanism available for this specific component, and no code change is needed — stop and report this back rather than guessing, since it would mean the original instruction to "match the existing pattern" wasn't achievable given this component's actual API, not that the fix was done wrong.

If you do make a change and `navigate`/`useNavigate` becomes unused as a result, remove the `useNavigate` import (keep `Link`, which is still used by the header button elsewhere in this file) and remove the `const navigate = useNavigate();` line. Do not touch anything else in this file — the table, the pagination handlers, the loading state, or the header's existing `<Link to="/documents/new">` button are all out of scope and already correct.

**Verification**: after the change (or after confirming no change is possible per the above), run `pnpm --filter @batac/web exec eslint src/pages/documents/DocumentListPage.tsx` and confirm zero errors, and `pnpm --filter @batac/web typecheck` to confirm no new type errors from any import changes.

---

# TASK-PRE-04c — Add manual presiding-officer override to `recordAttendance`; surface resolved value via `getAttendanceRecord`

**Type:** Backend addition. **Depends on:** TASK-PRE-04's decision, recorded as [LOG-0082] in `docs/development-findings-log.md` (status: `proposed` as of this writing — see the design-authority note below before treating this task's premise as final).

**Design-authority note, read before starting:** [LOG-0082]'s recorded decision is **"Implement a manual override selection UI (requiring schema/router input changes)."** That entry's `status` field is `proposed`, not `confirmed` — per this project's findings-log rules, a `proposed` entry is informative but not yet the same level of settled as a `confirmed` one. This task proceeds on the basis of that recorded decision because the user directing this work has explicitly chosen to proceed now rather than wait for `confirmed` status. If, by the time this task is picked up, a human reviewer has since set this entry's status to something other than `confirmed` (e.g. `superseded`), stop and re-check with the user before implementing — do not treat the mere presence of this task document as re-confirmation that the decision still stands.

**Two design choices below are this task's author's interpretation of "manual override," not independently verified facts from any document — both are flagged as such and should be confirmed with whoever has decision authority (per [LOG-0082], that's Luke) if this task is picked up by someone other than the person who commissioned it:**

1. **[Interpretation, not confirmed]** "Manual override" is read as: the automatic `delegationGrants`-based resolution remains the default behavior; a new optional input field lets the caller (the SP Secretary, via the frontend) explicitly override that resolution when submitting attendance. This reading is based on [LOG-0082]'s own phrasing — "instead of relying **solely** on automatic server-side lookup" — which implies supplementing, not replacing, the automatic path. The alternative reading — manual selection is mandatory on every submission, with no automatic fallback at all — was not chosen for this task's design, but is flagged here explicitly as the thing to re-check if this interpretation turns out to be wrong.
2. **[Interpretation, not confirmed]** The override is only meaningful when the regular Vice Mayor/Presiding Officer is marked absent in the same `recordAttendance` call — mirroring the existing automatic logic's own conditional structure (the automatic lookup only runs when the VM is absent; when present, `presidedByEmployeeId` is simply the VM's own ID, unconditionally). This task does not add override support for overriding who presided when the regular officer was actually present, since no scenario in this system's existing logic models that case.

**Context, confirmed directly against the current upload (`apps/server/src/modules/workflow/session.router.ts`):**

- `recordAttendance`'s current input schema (lines 316–332): `{ sessionDate: z.coerce.date(), absences: z.array(z.object({ councilorEmployeeId: z.string().uuid(), reason: z.enum(['official_business', 'sick_leave', 'vacation_leave', 'absent_unqualified']) })) }`. No substitute-officer field exists.
- The automatic resolution logic (lines 344–413, inside the `ctx.db.transaction` block): looks up the VM/Presiding-Officer position via `positions`/`assignments` (matching on title/code ILIKE patterns, `isPrimary: true`), checks whether that employee is in the submitted `absences` array, and if so queries `delegationGrants` (filtered on `positionId`, `isActive: true`, `startDate`/`endDate` bracketing the session date, `revokedAt IS NULL`) for an active delegation, falling back to the VM's own employee ID if none is found. If the VM position lookup itself returns nothing, it falls further back to the logged-in user's own employee record, then the first employee row, then `ctx.auth.userId` as a last resort (lines 393–413) — this fallback chain is unrelated to the override and should not be touched.
- `getAttendanceRecord`'s current output (lines 67–146): `{ sessionDate: Date, presentCouncilors: string[], absences: Array<{ councilorEmployeeId, councilorDisplayName, reason }>, quorumMet: boolean }`. No `presidedByEmployeeId`/`presidedByDisplayName` field exists. The early-return branch for a session that doesn't exist yet (lines 86–93) returns `presentCouncilors: []`, `absences: []`, `quorumMet: false` — any new fields need a corresponding `null` value added to this same branch.
- `spSessions` already has a `presidedByEmployeeId` column (used and written to at line 435 and line 453 in the existing code) — this is not a new column; it already exists on the table and is already being written to in both `recordAttendance` and `scheduleDocumentForFirstReading`. This task does not need a DB migration.
- The existing test at `apps/server/src/modules/workflow/session.router.test.ts`, lines 128–153 (`'records attendance when VM is absent and delegation is active'`), calls `recordAttendance` without any override field and asserts on `result.success`, `result.presentCount`, `result.quorumMet` — it does not assert on `presidedByEmployeeId` directly. Because this task's schema change is additive/optional (see below), this existing test should continue to pass unmodified when the new field is omitted from the call. Confirm this remains true after your change; do not modify this test's expectations unless it actually breaks, in which case treat that as a signal to re-examine your implementation rather than adjusting the test to match.

**Deliverables:**

- `apps/server/src/modules/workflow/session.router.ts` — modify `recordAttendance`'s input schema and mutation body; modify `getAttendanceRecord`'s output shape and both return branches.

**Scope boundary — do NOT touch:**

- The VM/Presiding-Officer position lookup logic itself (lines 346–362) — unchanged.
- The `delegationGrants` query (lines 369–381) — unchanged; it still runs as the default/fallback path when no override is supplied.
- The final fallback chain (lines 393–413, logged-in employee → first employee → `ctx.auth.userId`) — unchanged.
- `scheduleDocumentForFirstReading` (lines 530–717) — this procedure has its own, separate `presidedByEmployeeId`-resolution logic (lines 578–619) for a different purpose (setting an initial presiding officer when a session is first created via document scheduling, before any attendance is recorded). Do not modify this procedure or its resolution logic; it is out of scope for this task. If a genuine inconsistency between the two procedures' resolution behavior becomes apparent while working on this task, log it to `docs/development-findings-log.md` rather than fixing it here.
- `enterCommitteeHearingDate`, `getOrderOfBusiness`, `getAttendanceStatistics` — unrelated procedures in the same file; do not modify.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] `recordAttendance`'s input schema gains one new optional field: `presidedByEmployeeIdOverride: z.string().uuid().nullish()`. This field is optional and nullable/nullish — omitting it entirely must produce identical behavior to the current implementation (fully backward compatible with all existing callers, including the existing test at lines 128–153).
- [ ] When `presidedByEmployeeIdOverride` is provided (non-null) AND the VM/Presiding Officer is among the submitted `absences` (per the existing `isVmAbsent` check at line 366): use the override value directly as `presidedByEmployeeId`, skipping the `delegationGrants` query entirely for that call. Do not run the `delegationGrants` query at all when a valid override is supplied — it would be wasted work and could theoretically produce a value that's then discarded, which is confusing to reason about even if functionally harmless.
- [ ] When `presidedByEmployeeIdOverride` is provided but the VM/Presiding Officer is NOT among the submitted `absences` (i.e., the regular officer is present): ignore the override value entirely and proceed with the existing unconditional "VM's own ID" assignment at line 389. This is a deliberate rule per interpretation (2) above — the override only has an effect when it's covering an actual absence. Do not throw an error in this case (a stray/leftover override value from a previous form state being present without the VM being absent should be silently ignored, not treated as a client error) — but do add a code comment explaining why the value is ignored here, so a future reader isn't confused about why an input field appears to do nothing in this branch.
- [ ] When `presidedByEmployeeIdOverride` is provided and non-null, validate that it corresponds to an existing, non-deleted employee in the same city before using it: query `employees` for `eq(employees.id, input.presidedByEmployeeIdOverride)`, `eq(employees.cityId, ctx.auth.cityId)`, `isNull(employees.deletedAt)`. If no matching employee is found, throw `TRPCError({ code: 'BAD_REQUEST', message: 'The selected substitute presiding officer could not be found.' })` rather than silently proceeding with an invalid ID that would produce a dangling reference in `spSessions.presidedByEmployeeId`.
- [ ] This task does NOT implement any restriction on _which_ employees are eligible to be selected as an override (e.g., "must be a current SP member," "must be the subject of an active delegation grant") beyond the existence/not-deleted/same-city check above. Whether such a restriction is needed is an open product question — see "Open question requiring a decision" below. Do not add such a restriction speculatively.
- [ ] `getAttendanceRecord`'s output gains two new fields: `presidedByEmployeeId: string | null` and `presidedByDisplayName: string | null`.
- [ ] In the early-return branch (currently lines 86–93, for a session that doesn't exist yet), set both new fields to `null`, consistent with the existing `presentCouncilors: []`/`absences: []` pattern in that same branch.
- [ ] In the main return path: the `session` object already selected via the existing bare `.select()` at line 74 already includes `presidedByEmployeeId` as a raw column (it's a `select()` with no column list, so every column on `spSessions` is already present on the `session` object — this does not require a new query or a schema change, only using a value that's already being fetched). Resolve this to a display name via a join against `employees`, following the exact same pattern already used for the `absences` array a few lines below (lines 100–101, 104: `innerJoin(employees, eq(sessionAttendances.employeeId, employees.id))`, then `firstName`/`lastName` concatenation as done at line 134). If `session.presidedByEmployeeId` is `null` (this can happen for a session that exists but was never assigned a presiding officer through either `recordAttendance` or `scheduleDocumentForFirstReading`), both new output fields should be `null` rather than attempting a join against a null ID.
- [ ] Add or update tests in `apps/server/src/modules/workflow/session.router.test.ts` covering: (a) `recordAttendance` with the override field omitted still resolves automatically exactly as before — reuse/adapt the existing test at lines 128–153, confirming it doesn't need changes when the field is omitted; (b) `recordAttendance` with a valid override provided while the VM is absent uses the override value, not the `delegationGrants` result — construct a case where both an active delegation AND an override are present, and assert the override wins; (c) `recordAttendance` with an override provided while the VM is NOT absent ignores it; (d) `recordAttendance` with an override pointing at a non-existent/deleted/wrong-city employee throws `BAD_REQUEST`; (e) `getAttendanceRecord` returns the new fields correctly resolved, and returns `null` for both in the no-session-yet early-return case.

**Open question requiring a decision — do not resolve silently, flag to whoever picks this up:**
Should the override be restricted to a specific eligible set of employees (e.g., current SP members only, or employees with an active `delegationGrants` row for the VM/Presiding-Officer position specifically), or should any valid employee in the city be selectable? The existing/not-deleted/same-city check above is the minimum viable validation to prevent a broken reference, but doesn't answer whether the frontend's picker should show "any employee" or a scoped subset. This is a genuine product-scope decision (who is allowed to preside over a legislative session), not a technical implementation detail — it affects both this backend task (whether an additional eligibility check belongs here) and the frontend task (what the picker's candidate list should be sourced from). Recommend logging this as its own findings-log entry if it can't be resolved in-conversation before this task is picked up, tagged to both this task and the frontend task below.

**AI Prompt:**

> In `apps/server/src/modules/workflow/session.router.ts`, add an optional field `presidedByEmployeeIdOverride: z.string().uuid().nullish()` to `recordAttendance`'s existing input schema (currently at lines 316–332 — re-verify these line numbers against the file as it exists when you start, since line numbers shift). Inside the mutation body's existing `ctx.db.transaction` block, after the existing VM-position lookup (lines 346–362) confirms `vmPos[0]` exists and after the existing `isVmAbsent` check (line 366): if `input.presidedByEmployeeIdOverride` is provided and `isVmAbsent` is true, validate it against the `employees` table (must exist, `cityId` matching `ctx.auth.cityId`, `deletedAt IS NULL`) — throw `TRPCError({ code: 'BAD_REQUEST', message: 'The selected substitute presiding officer could not be found.' })` if invalid — and if valid, set `presidedByEmployeeId` to that value directly, skipping the existing `delegationGrants` query (lines 369–381) entirely for this call. If `input.presidedByEmployeeIdOverride` is provided but `isVmAbsent` is false, ignore the override value and fall through to the existing unconditional `presidedByEmployeeId = vmEmployeeId` assignment at line 389 (add a code comment explaining the override is intentionally ignored in this branch). Do not modify the fallback chain at lines 393–413, the `delegationGrants` query itself, or the VM-position lookup logic — those stay exactly as they are for every path except "valid override supplied while VM absent."
>
> In the same file's `getAttendanceRecord` procedure, add `presidedByEmployeeId: string | null` and `presidedByDisplayName: string | null` to the output. In the early-return branch (currently lines 86–93), set both to `null`. In the main return path, the `session` object (from the existing bare `.select()` at line 74) already has `presidedByEmployeeId` as a raw column — no new query needed for the ID itself. Resolve it to a display name via a join against `employees`, reusing the exact join pattern already used for the `absences` array (lines 100–101, 104, and the `firstName`/`lastName` concatenation at line 134). If `session.presidedByEmployeeId` is `null`, both new fields should be `null` — do not attempt to join against a null ID.
>
> Do not touch `scheduleDocumentForFirstReading`, `enterCommitteeHearingDate`, `getOrderOfBusiness`, or `getAttendanceStatistics` in this same file — none of them are in scope for this task.
>
> Add test coverage in `apps/server/src/modules/workflow/session.router.test.ts` for: the override field omitted (existing automatic behavior unchanged — verify the existing test at lines 128–153 still passes as-is), a valid override while VM is absent (override wins over an active delegation), an override supplied while VM is present (override is ignored, no error), an override pointing at an invalid/deleted/wrong-city employee (throws `BAD_REQUEST`), and `getAttendanceRecord` correctly returning the two new fields including the `null`/`null` case for a session that doesn't exist yet.
>
> This task deliberately does not implement any restriction on which employees are eligible to be selected as an override beyond existence/not-deleted/same-city — if you find yourself wanting to add an eligibility restriction (e.g., "must be a current SP member"), stop and flag it as an open product question rather than deciding it, per the "Open question requiring a decision" section of this task's parent spec.

---

# TASK-FE-WF-002 — `/sessions` and `/sessions/:sessionDate` (SessionAttendanceOverviewPage, SessionAttendanceDetailPage)

**Role:** Both — `sp_secretary, sp_member, sp_presiding_officer, mayor, auditor` for viewing; recording attendance is `sp_secretary` only.

**Tier 0 dependency — UPDATED:** TASK-PRE-04's decision has been recorded (see `docs/development-findings-log.md`, entry [LOG-0082], status `proposed` as of this writing): the decision was to implement a **manual override** for presiding-officer selection, not the read-only-display path this task's acceptance criteria previously assumed. The corresponding backend work is specified in a new task, **TASK-PRE-04c**, which has not been implemented yet as of this writing. TASK-PRE-04c must land before the substitute-officer sub-item below can be built — this is now a hard prerequisite for that specific sub-item, not an optional enhancement. Everything else on this page has no dependency on TASK-PRE-04c and can proceed regardless.

**Deliverables:**

- `apps/web/src/pages/workflow/SessionAttendanceOverviewPage.tsx`
- `apps/web/src/pages/workflow/SessionAttendanceDetailPage.tsx`
- Route registrations: `/sessions`, `/sessions/:sessionDate`.

**Confirmed current state as of this writing:** neither page file exists yet; neither route is registered in `apps/web/src/main.tsx`. This task has not been started at any layer.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] Overview calls `trpc.session.getAttendanceStatistics.useQuery({ from?, to? })`. Output: `{ series: Array<{ sessionDate: Date, presentCount: number, absentCount: number }>, printableSummaryUrl: null }`. **`printableSummaryUrl` is hardcoded `null`** in the current implementation — do not build a "print summary" link/button that expects this to resolve to a real URL; either omit that control entirely or visibly disable it with a "not yet available" state.
- [ ] Detail page keys on `sessionDate` from the route param, calls `trpc.session.getAttendanceRecord.useQuery({ sessionDate })`. Current confirmed output (before TASK-PRE-04c lands): `{ sessionDate: Date, presentCouncilors: string[] (employee IDs, not names), absences: Array<{ councilorEmployeeId, councilorDisplayName, reason: string (human-readable, e.g. "Official Business", "Sick Leave", "Vacation Leave", "Absent (Unqualified)") }>, quorumMet: boolean }`. Once TASK-PRE-04c lands, this output additionally includes `presidedByEmployeeId: string | null` and `presidedByDisplayName: string | null` — see the substitute-officer display sub-item below for how to use these.
- [ ] **`presentCouncilors` display-name limitation, UPDATED:** `presentCouncilors` is still bare employee-ID strings with no display name attached in this output, with no change to this specific limitation. **An employee-list-read procedure now exists** (`organization.listEmployees` and `organization.listEmployeesForSysAdmin`, confirmed present in `apps/server/src/modules/organization/organization.router.ts`), but both are gated to `plat_admin`/`isItAdmin` respectively — **neither is callable by any of the roles that use this page** (`sp_secretary, sp_member, sp_presiding_officer, mayor, auditor`). This means the limitation described in the original version of this task is still real and unresolved for this specific page: either accept showing bare IDs for `presentCouncilors` as a known limitation, or use `organization.getOfficeHierarchy` (which is not role-restricted beyond being a `protectedProcedure`, per prior confirmed usage elsewhere in this task list) if it happens to expose employee names in a way that can be cross-referenced against these IDs — check its actual output shape before assuming this works, since that hasn't been independently re-verified in this task-writing session specifically for this purpose.
- [ ] Recording attendance calls `trpc.session.recordAttendance.useMutation({ sessionDate, absences: [{ councilorEmployeeId, reason }] })` where `reason` is one of `'official_business' | 'sick_leave' | 'vacation_leave' | 'absent_unqualified'` (note: these are the _input_ enum values, different strings than the _output_ `absences[].reason` human-readable strings above — don't confuse the two when building the recording form vs. the display view). **Once TASK-PRE-04c lands,** this same mutation additionally accepts an optional `presidedByEmployeeIdOverride: string (uuid) | null | undefined` field — see the substitute-officer sub-item below.
- [ ] **Substitute-officer display and selection — REWRITTEN, was previously written for the wrong branch of TASK-PRE-04's decision:**
  - **If TASK-PRE-04c has not yet landed:** build everything else on this page. For the substitute-officer piece specifically, do not build any UI for it yet — omit it entirely or show a clearly-labeled "not yet available" placeholder, matching the same pattern used elsewhere on this page for `printableSummaryUrl`. Do not build a read-only display expecting `presidedByEmployeeId`/`presidedByDisplayName` to be present in `getAttendanceRecord`'s output, since they are not present in the current implementation — confirm this directly against the live `getAttendanceRecord` output before building, don't assume TASK-PRE-04c has landed just because this updated task text exists.
  - **Once TASK-PRE-04c has landed:** display `presidedByDisplayName` (falling back to showing `presidedByEmployeeId` if the display name is somehow null but the ID isn't) read-only, prominently, on the detail page. Additionally, build a manual-override selection control as part of the attendance-recording form (`sp_secretary` only): when the regular Vice Mayor/Presiding Officer is marked absent in the form, show a control to optionally select a substitute presiding officer, submitted as `presidedByEmployeeIdOverride` on the same `recordAttendance` call. This control should only be shown/enabled when the VM/Presiding Officer is actually marked absent in the current form state — per TASK-PRE-04c's own design, the backend ignores the override value if the regular officer isn't absent, so showing an always-visible control would be misleading about when it actually has an effect. **The specific list of candidate employees to show in this selection control is an open product question that TASK-PRE-04c explicitly does not resolve** (see that task's "Open question requiring a decision" section) — do not build a full "any employee in the system" picker without confirming this is the intended scope, since the backend doesn't restrict eligibility beyond existence/not-deleted/same-city, and building a scoped picker (e.g., "current SP members only") would require additional data-fetching decisions not yet specified anywhere. Flag this to the user rather than guessing at the candidate list's source if it hasn't been resolved by the time this sub-item is picked up.

**AI Prompt:**

> Build both pages as a standard overview→detail pair, same navigational shape as `/documents` → `/documents/:documentId`.
>
> `SessionAttendanceOverviewPage`: a simple chart or table of `getAttendanceStatistics`'s `series` (session date, present/absent counts) — the `SLATimer` or `StatCard` domain components may not be the right fit here (they're SLA/count-specific), so this may need custom presentation; check `packages/ui`'s available components before assuming one fits. Do not build a working "print summary" control — `printableSummaryUrl` is always `null` server-side right now.
>
> `SessionAttendanceDetailPage`: keyed on `:sessionDate` route param (coerce to `Date` before passing to the query, matching `z.coerce.date()` on the backend). Display `quorumMet` prominently (12-member body, quorum at 7 present, per the backend's own `presentCount >= 7` logic). List absences with their human-readable reasons directly from the query output. For `sp_secretary` users, provide an attendance-recording form: a per-councilor present/absent toggle, with a reason selector (using the four input enum values: `official_business, sick_leave, vacation_leave, absent_unqualified`) for anyone marked absent, submitting the whole set via one `recordAttendance` call.
>
> **Before building any substitute-officer UI on this page, check the live `getAttendanceRecord` output directly to confirm whether TASK-PRE-04c has actually landed** (i.e., whether `presidedByEmployeeId`/`presidedByDisplayName` are actually present in the response, not just whether this task document says it should have). If it hasn't landed, omit the substitute-officer section entirely or show a clearly-labeled placeholder — do not guess at a shape. If it has landed, display the resolved name read-only, and add a substitute-selection control to the recording form that's only shown/enabled when the regular Vice Mayor/Presiding Officer is marked absent in the current form state, submitting the selection as `presidedByEmployeeIdOverride` on the same `recordAttendance` call. Before building the candidate list for that selection control, confirm with the user what the intended source/scope of eligible candidates is — TASK-PRE-04c's backend does not restrict this beyond basic existence checks, and this task list deliberately does not resolve what the frontend picker's candidate list should be.
>
> For the `presentCouncilors` display-name limitation: `organization.listEmployees`/`listEmployeesForSysAdmin` now exist but are gated to roles this page's users don't have — this is still an open limitation, not a resolved one. Either show bare employee IDs as a known limitation, or check whether `organization.getOfficeHierarchy`'s actual output can be cross-referenced to resolve names (verify its real shape first; this task list does not confirm that it can).

---

# TASK-WF-BE-001 — Rework `recordAttendance`'s quorum calculation to use actual SP membership roster size instead of a hardcoded constant

**Type:** Backend rework, resolving part of [LOG-0091]'s divergence findings (specifically point 3 — the quorum formula). **Scope note:** this task deliberately does NOT address [LOG-0091]'s points 1, 2, or 4 (procedure split/merge between `logSpSession`/`logAttendance`/`recordAttendance`, the missing standalone `generateOrderOfBusiness` procedure, or the mandatory-vs-automatic `presidedByEmployeeId` input question). Those remain open, separate decisions — do not fold them into this task even if they seem related while you're in this file.

**Context, confirmed directly against the current upload:**

TASK-WF-023's spec (`docs/pre-development/A-project-planning/a1-tasks/wf.md`, lines 2218–2220) requires: `presentCount = count of attendance entries where isPresent = true`, and `quorumAchieved computed server-side: presentCount >= ceil(totalActiveSpMembers / 2) + 1 ... confirm exact quorum formula against Organization module's SP membership roster rather than hardcoding the count of 12, since membership can change`.

The live `recordAttendance` (`apps/server/src/modules/workflow/session.router.ts`, lines 339–341) currently computes:

```typescript
const absentCount = absences.length;
const presentCount = Math.max(0, 12 - absentCount);
const quorumMet = presentCount >= 7;
```

Both the `12` (assumed total roster size, used to derive `presentCount`) and the `7` (quorum threshold) are hardcoded constants, independently of each other and independently of any roster lookup.

**The existing SP-roster query already in this same procedure is directly reusable for this fix.** Confirmed at lines 462–474, currently positioned _after_ the quorum calculation (it currently exists only to build the list of employee IDs for attendance-row upserting, not for a headcount):

```typescript
const spMembers = await tx
  .select({ id: employees.id })
  .from(employees)
  .innerJoin(assignments, eq(assignments.employeeId, employees.id))
  .innerJoin(offices, eq(assignments.officeId, offices.id))
  .where(
    and(
      eq(offices.code, 'SP'),
      eq(offices.cityId, ctx.auth.cityId),
      isNull(employees.deletedAt),
      isNull(assignments.deletedAt),
    ),
  );

let councilorIds = spMembers.map((m) => m.id);
if (councilorIds.length === 0) {
  const fallbackMembers = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        ilike(employees.employeeNumber, 'SP-%'),
        eq(employees.cityId, ctx.auth.cityId),
        isNull(employees.deletedAt),
      ),
    );
  councilorIds = fallbackMembers.map((m) => m.id);
}
```

`councilorIds.length` (after the fallback resolves) is exactly `totalActiveSpMembers` as the spec names it.

**Deliverables:**

- `apps/server/src/modules/workflow/session.router.ts` — modify `recordAttendance`'s body only.

**Scope boundary — do NOT touch:**

- `getAttendanceRecord`, `getOrderOfBusiness`, `scheduleDocumentForFirstReading`, `enterCommitteeHearingDate` — unrelated procedures in the same file, out of scope.
- **`getAttendanceStatistics` (lines 148–191) is explicitly OUT OF SCOPE for this task, even though it has its own independent hardcoded-12 (`absentCount = Math.max(0, 12 - presentCount)`, line 178).** This is deliberate, not an oversight: `getAttendanceStatistics`'s `absentCount` is derived from `spSessions.presentCount` — a value already stored from whenever a past session's attendance was originally recorded. `spSessions` (confirmed via its Drizzle definition, `packages/database/schema/workflow.schema.ts` lines 539–569) has no column storing roster size, `absentCount`, or quorum threshold as they existed at the time of that session — only `presentCount` and `quorumAchieved` are persisted. This means fixing this task's `recordAttendance` calculation does not retroactively fix `getAttendanceStatistics`'s ability to correctly derive `absentCount` for historical sessions, because the roster size at the time of each historical session isn't recoverable from stored data. There are two genuinely different ways to fix `getAttendanceStatistics` (store `absentCount` as a new column at write-time for full historical accuracy, vs. compute it dynamically against _current_ roster size and accept it will be inaccurate for any session recorded under a different roster size) — this is a real trade-off, not a mechanical fix, and is being left for a separate, explicitly-scoped follow-up task once that trade-off is decided. Do not touch `getAttendanceStatistics` in this task, even though its bug is adjacent to the one being fixed here.
- The VM/Presiding-Officer lookup and `delegationGrants` logic (lines 344–413) — unrelated to the quorum fix, do not modify.
- The session upsert logic (lines 415–460) — unmodified in structure; only the _values_ being passed into it (`presentCount`, `quorumAchieved`) change as a consequence of this fix, not the upsert logic itself.

**Acceptance Criteria:**

- [ ] `pnpm typecheck` passes.
- [ ] The existing `spMembers`/fallback-query block (currently lines 462–489) is moved to execute _before_ the quorum calculation, so its result is available when `presentCount`/`quorumMet` are computed. Do not duplicate the query — compute the roster-size list once and use its result both for the quorum calculation and for the existing attendance-row-target-list purpose (`allTargetIds`, currently line 492) it already serves.
- [ ] `presentCount` is computed as `Math.max(0, totalActiveSpMembers - absentCount)`, where `totalActiveSpMembers` is `councilorIds.length` from the (now-relocated) roster query — replacing the hardcoded `12`.
- [ ] `quorumMet` is computed as `presentCount >= Math.ceil(totalActiveSpMembers / 2) + 1` — replacing the hardcoded `7`. Use `Math.ceil`, matching this file's existing style of using plain `Math.*` calls without a separate utility import (consistent with the existing `Math.max` usage at the current line 340).
- [ ] If `totalActiveSpMembers` resolves to `0` (both the primary `offices.code === 'SP'` query and the `employeeNumber ILIKE 'SP-%'` fallback return nothing) — an edge case the current hardcoded-12 logic can't hit but a roster-driven calculation can — do not let this produce a nonsensical result (e.g., `Math.ceil(0/2) + 1 = 1`, meaning `quorumMet` would require at least 1 present out of a 0-member body, which is a paradox, not a real quorum). Add an explicit early check: if `totalActiveSpMembers === 0`, throw `TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No active SP membership roster could be resolved; cannot compute quorum.' })` rather than silently proceeding with a formula that assumes a nonzero denominator context. This is a defensive check for a data-integrity problem (no active SP members exist in this city), not a scenario the spec anticipates or resolves — flag it as such in a code comment rather than presenting it as spec-mandated behavior.
- [ ] Confirm this change does not alter the `absences.length`-derived `absentCount` calculation itself (line 339) — that stays as `absences.length`, unchanged; only what it's subtracted _from_ (`totalActiveSpMembers` instead of `12`) and the quorum comparison threshold change.
- [ ] Existing tests in `apps/server/src/modules/workflow/session.router.test.ts` must still pass, updated as needed for the new roster-query-relocation and mock-response-sequence changes this introduces (moving the `spMembers` query earlier in execution order changes the sequence of mocked DB calls in tests that use `mockDb.mockResponse(...)` in call order — re-verify and reorder each existing test's mock sequence against the new actual call order rather than assuming the old sequence still lines up). Specifically re-check the test at lines 97–127 (`'successfully records attendance with quorum met'`) and lines 128–153 (`'records attendance when VM is absent and delegation is active'`) — both currently assert `result.presentCount`/`result.quorumMet` against values that assumed a hardcoded 12-member/7-quorum body; update their mocked roster-size response and expected assertions to reflect an explicit, stated roster size in the test setup (do not leave the test relying on an implicit "12" that no longer means anything once the code no longer hardcodes it).
- [ ] Add new test coverage for: a roster size other than 12 (e.g., a hypothetical 10-member body, confirming both `presentCount` and `quorumMet` compute correctly against `ceil(10/2)+1 = 6`, not against the old hardcoded values); and the `totalActiveSpMembers === 0` case throwing the new `INTERNAL_SERVER_ERROR`.

**Explicitly flagged, not resolved by this task — surface to the user before starting any follow-up work on it:** `getAttendanceStatistics`'s independent hardcoded-12 and its `absentCount`-is-not-stored problem, described in the scope-boundary section above. This needs a decision (store `absentCount` at write-time via a schema addition, vs. compute dynamically against current roster size and accept historical inaccuracy) before a follow-up task can be written for it.

**AI Prompt:**

> In `apps/server/src/modules/workflow/session.router.ts`, inside the `recordAttendance` mutation (currently starting at line 316), relocate the existing `spMembers` query and its `employeeNumber ILIKE 'SP-%'` fallback block (currently at lines 462–489, inside the same `ctx.db.transaction` callback) to execute before the quorum calculation (currently at lines 339–341) — re-verify these line numbers against the file as it exists when you start, since line numbers will have shifted from the LOG-0091/TASK-PRE-04c work if that's already landed. Do not duplicate this query; its result must serve both the quorum calculation and its existing purpose of building `allTargetIds` for the attendance-row upsert loop further down. Compute `totalActiveSpMembers` as the resolved `councilorIds.length` (after the fallback logic runs, if the primary query returns empty).
>
> Replace the hardcoded `const presentCount = Math.max(0, 12 - absentCount);` with `const presentCount = Math.max(0, totalActiveSpMembers - absentCount);`. Replace the hardcoded `const quorumMet = presentCount >= 7;` with `const quorumMet = presentCount >= Math.ceil(totalActiveSpMembers / 2) + 1;`. Before either calculation, add a guard: if `totalActiveSpMembers === 0`, throw `TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No active SP membership roster could be resolved; cannot compute quorum.' })` — this is a defensive check for a data-integrity edge case, not something the spec (TASK-WF-023, wf.md lines 2218–2220) directly addresses, so add a code comment noting it's a defensive addition rather than a spec-mandated rule.
>
> Do not touch `getAttendanceStatistics` (a separate procedure in this same file, lines 148–191) even though it has its own, structurally different hardcoded-12 problem — that procedure derives its `absentCount` from an already-stored historical `presentCount` value with no way to recover the roster size that was actually in effect at the time, which is a distinct data-durability question requiring its own decision (a schema addition vs. an accepted-inaccuracy tradeoff) before it can be fixed; flag this to the user rather than attempting a fix here.
>
> Do not touch `getAttendanceRecord`, `getOrderOfBusiness`, `scheduleDocumentForFirstReading`, `enterCommitteeHearingDate`, the VM/Presiding-Officer/`delegationGrants` resolution logic (lines 344–413), or the session upsert logic's structure (lines 415–460) — only the values passed into the upsert change as a consequence of this fix, not the upsert code itself.
>
> Update `apps/server/src/modules/workflow/session.router.test.ts`: the existing tests at (originally) lines 97–127 and 128–153 mock a sequence of DB responses in call order, and relocating the `spMembers` query changes that order — re-derive each test's correct mock sequence against the new actual execution order rather than assuming the old ordering still applies, and update their expected `presentCount`/`quorumMet` assertions to be explicit about whatever roster size the test's mocked `spMembers` response represents (don't leave an implicit, no-longer-meaningful "12" baked into the assertions). Add new test cases for: a non-12 roster size computing both values correctly against the real formula, and the `totalActiveSpMembers === 0` case throwing the new error.
>
> Confirm `pnpm typecheck` passes and all tests in this file pass before considering this task complete.

---

# TASK-FE-WF-004 — `/mayor` (MayorDashboardPage) — Corrected & Completed Standalone Prompt

**Role:** Mayor only. **Sequencing note:** build after Tier 3 components exist (same sequencing as WF-003).

## Deliverables

1. `apps/web/src/pages/workflow/MayorDashboardPage.tsx` — new file.
2. Route registration for `/mayor` in `apps/web/src/main.tsx`.
3. A findings-log entry appended to `docs/development-findings-log.md` (exact text specified below — this is content to append verbatim, not something to paraphrase).
4. Optional, separately-scoped: a one-line comment correction in `apps/web/src/pages/workflow/panels/SecretariatDecisionPanel.tsx` (see "Optional cleanup" section at the end — do this only if convenient in the same session; it is unrelated to the dashboard itself).

## Background context (verified facts you need — do not re-derive these, they are confirmed against the current repo)

`apps/server/src/modules/workflow/workflow.router.ts` (2551 lines total) contains two procedures relevant here:

**`listMyAssignedSteps`** (starts line 516): input is `{ cursor?: string, limit?: number }` (Zod schema `paginationInput`, defined at line 35 — `limit` defaults to 50, max 100; **the input field is named `limit`, not `pageSize`**). It has no `.output()` Zod schema — its returned shape is inferred purely from the TypeScript object literal at lines 620–628, which is:

```ts
{
  stepInstanceId: string;
  instanceId: string;
  documentId: string;
  documentTitle: string;
  stepType: 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination';
  assignedAt: Date;
  dueAt: Date | null;
}
```

wrapped in `{ items: [...], nextCursor: string | null }`. **This confirmed shape has no `stepKey` and no `panelHint` field.** The fine-grained step identity needed to distinguish a mayoral step (`mayor_review` / `mayor_signature`) from any other `action`/`approval`-type step is not present here — `stepType` is only the coarse 6-value category shown above.

**`getInstance`** (starts line 254): internally selects `stepKey` from the database at line 310 (`stepKey: steps.stepKey`), as part of a query spanning lines 305–323. `stepKey` is passed into `computePanelHint` (called at line 367) to compute a `panelHint` enum value, but `stepKey` itself is **not included** in the object this procedure actually returns (lines 369–380). The only externally visible signal for step identity is `panelHint`, obtainable only via a separate `getInstance` call per instance. `getInstance`'s confirmed full return type (matching its `.output()` schema at lines 256–267) is:

```ts
{
  instanceId: string; // uuid
  documentId: string; // uuid
  definitionVersionId: string; // uuid
  currentStepType: 'action' |
    'approval' |
    'multi_referral' |
    'decision' |
    'notification' |
    'termination' |
    'parallel_split' |
    'parallel_join';
  currentStepInstanceId: string; // uuid
  currentAssigneeUserId: string | null;
  status: 'Active' | 'Completed' | 'Cancelled';
  slaDeadline: Date | null;
  lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null;
  panelHint: 'multi_referral' |
    'vp_certification' |
    'mayor_decision' |
    'mayor_lapse_confirmation' |
    'veto_override_recording' |
    'docketing' |
    'panlalawigan_outcome' |
    'publication_date' |
    'secretariat_decision' |
    'generic_action' |
    'generic_approval' |
    null;
}
```

`computePanelHint`'s mayor-relevant branch (lines 218–227) returns `'mayor_lapse_confirmation'` when the current step's `stepKey` is `mayor_review` or `mayor_signature` AND a stored deadline (`instance.context['mayor_action_deadline']`) has passed without `stepMetadata['lapse_confirmed_at']` being set; otherwise, for the same two step keys, it returns `'mayor_decision'`. These are the only two `panelHint` values tied to mayoral steps.

## Critical constraint #1 — N+1 is required, this is a deliberate, accepted tradeoff

Given the above, there is no server-side way to filter `listMyAssignedSteps` to "mayor-action steps only" using the fields that procedure actually returns. This dashboard must:

1. Call `trpc.workflow.listMyAssignedSteps.useQuery({ limit: 30 })` to get the Mayor's raw assigned-step list. (Use `limit: 30`, not `pageSize` — that field name does not exist on this procedure's input. 30 is a reasoned default, not a spec'd number: large enough to avoid ending up with a near-empty filtered result purely from under-fetching, small enough to keep the N+1 fan-out modest for what should be a small per-Mayor queue.)
2. For each returned row, call `trpc.workflow.getInstance.useQuery({ instanceId: row.instanceId })` to resolve `panelHint` (and, usefully, `lapseStatus` and `slaDeadline` — see Critical constraint #2 below).
3. Filter the combined result down to items where the resolved `panelHint` is `'mayor_decision'` or `'mayor_lapse_confirmation'` — **but see constraint #2, these two groups are NOT treated identically in the UI.**

Do not attempt to filter directly on `stepKey` against `listMyAssignedSteps`'s raw output — that field does not exist there and referencing it will fail to compile against the real inferred type.

**Implementation approach for the batched per-row fetch — try this first:** this project's tRPC client (`apps/web/src/lib/trpc.ts`) uses `createTRPCReact<AppRouter>()` from `@trpc/react-query` (pinned `^11.18.0`). The generated proxy exposes its own `useQueries` helper, callable as:

```ts
const instanceQueries = trpc.useQueries((t) =>
  assignedRows.map((row) => t.workflow.getInstance({ instanceId: row.instanceId })),
);
```

This returns an array of query results in the same order as `assignedRows`, and is the idiomatic way to batch multiple procedure calls through this specific tRPC setup (distinct from raw `@tanstack/react-query`'s `useQueries({ queries: [...] })`, which needs manually-constructed `queryKey`/`queryFn` pairs that tRPC's proxy would otherwise generate for you — do not use the raw TanStack form here).

**[Inference, not directly verified against this pinned version's type definitions]** — if `trpc.useQueries` is not available on the generated proxy in this exact setup (e.g. a type error saying the property doesn't exist), fall back to a component-per-row pattern instead: extract a small child component that takes a single `row` prop and calls `trpc.workflow.getInstance.useQuery({ instanceId: row.instanceId })` directly (the same call shape used in `WorkflowStepActionPage.tsx` line 28), then map over `assignedRows` rendering one child per row, with each child independently deciding whether to render itself (returning `null` if its resolved `panelHint` doesn't match) rather than trying to aggregate results back up to a parent list. Whichever path you take, leave a comment noting: if this list grows large in practice, the better long-term fix is a server-side addition (a new filter param on `listMyAssignedSteps`, or including `stepKey`/`panelHint` directly in its existing output) rather than optimizing the N+1 pattern itself — this would be its own small backend task, out of scope here.

## Critical constraint #2 — `mayor_decision` and `mayor_lapse_confirmation` are NOT interchangeable in this UI

This is a resolved design decision, not something left to your judgment — **do not deviate from it**:

- **`mayor_decision`** items are fully actionable by the Mayor. Render these as clickable rows linking to `/workflow/steps/:instanceId` (via `<Link>`, matching the existing convention in `SecretaryDashboardPage.tsx`'s `QueueWidget`), exactly as originally planned. Clicking through renders `MayorDecisionPanel` correctly today — this route and that panel already exist and already work; you are not building any new panel logic.

- **`mayor_lapse_confirmation`** items must be rendered **read-only** — as plain, non-interactive rows (a `<div>`, not a `<Link>`), not clickable, with no navigation on click. **Do not change `apps/web/src/pages/workflow/WorkflowStepActionPage.tsx` and do not change anything about the Mayor's ability to invoke `logMayorLapseConfirmation`.** This is intentional, not an oversight to work around:
  - `WorkflowStepActionPage.tsx` (lines 84–87) gates the `mayor_lapse_confirmation` case on `hasRole(roles, 'sp_secretary')`, not `'mayor'` — confirmed directly in the current file.
  - The backend mutation, `logMayorLapseConfirmation` (`workflow.router.ts` line 1636), independently enforces the same restriction via `workflowPolicy.canLogSpSecretaryAction(ctx.auth)` (called at line 1647; policy function at `workflow.policy.ts` line 671), which throws `FORBIDDEN` for any caller without the `sp_secretary` role.
  - This is backed by the source-of-truth permission matrix: `docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md`, Section 6 ("Workflow Execution"), line 189 — _"Log 10-day Mayor lapse (system-triggered; manual confirmation)"_ — explicitly marks the Mayor column as ❌ and SP Secretary as ✅.
  - In short: a Mayor is deliberately not permitted to confirm their own action lapse (a third party — the SP Secretary — attests that the Mayor's window elapsed). The frontend gate and backend policy are both correctly mirroring this rule. Do not "fix" this gate as part of this task.

**Layout instruction for these two groups (a stated default for an otherwise-undocumented UI-composition question — reasonable to revisit later, but do not leave it ambiguous in your implementation):** render the widget with two clearly labeled sub-sections rather than one undifferentiated list — e.g., "Awaiting Your Decision" (the clickable `mayor_decision` rows) and "Lapse Notices" or similar (the read-only `mayor_lapse_confirmation` rows, perhaps with a small "Pending SP Secretary confirmation" caption per row). Do not mix both types into a single list where some rows are clickable and others silently aren't — that would be confusing without any visual or structural distinction. For the read-only rows' content, you have everything you need already fetched — no additional calls required: `documentTitle` comes from the original `listMyAssignedSteps` row, and `lapseStatus` / `slaDeadline` come from the same per-row `getInstance` call already being made for filtering. Use these to write a short, factual line (e.g., referencing the elapsed deadline) rather than inventing copy with no backing data.

## Critical constraint #3 — SLA widget

Add an `SlaComplianceWidget`-equivalent. This is **not a shared component to import** — `apps/web/src/pages/workflow/SecretaryDashboardPage.tsx` (lines 341–411) defines its own local, page-specific `SlaComplianceWidget` function; there is no exported version in `@batac/ui`. Write a new local component in `MayorDashboardPage.tsx` following that exact same pattern: call `trpc.workflow.getSlaComplianceData.useQuery({ breachedOnly: true })`, use the same loading/error/empty-state structure, and reuse `StatCard` from `@batac/ui/components/domain/StatCard` the same way. This has already been verified to work for the Mayor role — `workflowPolicy.canAccessSlaData` (`workflow.policy.ts` line 740) checks membership in `SLA_READ_ROLES` (line 142–144), and `'mayor'` is confirmed present in that set. You do not need to re-verify this; it will succeed for the Mayor role as implemented today.

## Deliverable: whole-page role gate and route registration

Follow the exact pattern in `SecretaryDashboardPage.tsx` (lines 21, 23–36):

```ts
const PAGE_ALLOWED_ROLES = ["mayor"] as const;

export function MayorDashboardPage() {
  const { session } = useAuth();
  const roleCodes = session?.roleCodes ?? [];

  if (!hasRole(roleCodes, ...PAGE_ALLOWED_ROLES)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-text-muted">
        You do not have permission to view this page.
      </div>
    );
  }

  return <MayorDashboardContent />;
}
```

(`useAuth` from `@/lib/auth-context`, `hasRole` from `@/lib/auth-helpers` — both existing imports, matching every other dashboard/panel file in this directory.)

In `apps/web/src/main.tsx`:

- Add `import { MayorDashboardPage } from "./pages/workflow/MayorDashboardPage";` — the import block (lines 30–50) is alphabetically sorted by imported name; this line belongs immediately **before** the existing `import { MyAssignedStepsPage } from "./pages/workflow/MyAssignedStepsPage";` line (comparing "Mayor" vs "MyAssigned" — 'a' < 'y' at the second character).
- Add a route object `{ path: "/mayor", element: <MayorDashboardPage /> }` to the `router` array. There is no strict ordering convention evident across the existing route array (e.g. `/secretary` at line 90 does not sit in any obvious alphabetical or hierarchical position relative to its neighbors) — place it near the other dashboard/`/workflow`-adjacent routes (e.g. near line 90–92, alongside `/secretary`) for readability; exact position in the array has no functional effect.

## What NOT to touch (explicit scope boundary)

- Do not modify `apps/web/src/pages/workflow/WorkflowStepActionPage.tsx` in any way.
- Do not modify `apps/server/src/modules/workflow/workflow.router.ts`, `workflow.policy.ts`, or any backend file — this is a frontend-only, read/query-only task. No new procedures, no changes to `listMyAssignedSteps` or `getInstance`.
- Do not add a "pending documents" widget, session calendar, or order-of-business widget — those are Secretary-dashboard-specific concerns not requested for this task. Keep scope to: filtered step queue (two sub-sections) + SLA widget, nothing else.
- Do not touch any Table of Contents line numbers in any `.md` document you read while doing this work.

## Acceptance criteria

- [ ] `pnpm typecheck` passes.
- [ ] `MayorDashboardPage.tsx` created at the exact path above, gated to the `mayor` role using the pattern shown.
- [ ] `/mayor` route registered in `main.tsx` with the import correctly placed.
- [ ] Assigned-step widget correctly implements the N+1 `listMyAssignedSteps` → per-row `getInstance` pattern (via `trpc.useQueries` or the component-per-row fallback), with a comment noting the server-side alternative for future optimization.
- [ ] `mayor_decision` items render as clickable rows linking to `/workflow/steps/:instanceId`.
- [ ] `mayor_lapse_confirmation` items render as non-interactive, read-only rows in a visually distinct sub-section — not linked, not clickable.
- [ ] `WorkflowStepActionPage.tsx` is untouched.
- [ ] SLA widget added, following `SecretaryDashboardPage.tsx`'s `SlaComplianceWidget` pattern exactly, using `getSlaComplianceData({ breachedOnly: true })`.
- [ ] The findings-log entry below is appended verbatim to the bottom of `docs/development-findings-log.md` (after the current final line, which ends `...not a naming cleanup.` — add a leading `---` separator before the new entry, matching the file's existing separator-before-each-entry convention).

## Findings-log entry to append (exact text — do not paraphrase, do not renumber)

```
---

### [LOG-0092] computePanelHint's Secretariat Decision routing has moved past LOG-0078's role-based-proxy description; also stale in SecretariatDecisionPanel.tsx's comment

- date: 2026-07-13
- task_id: TASK-FE-WF-004
- status: proposed
- affects: F1
- supersedes: LOG-0078

**What was found:** LOG-0078 (status: proposed) describes `computePanelHint`'s Secretariat Decision detection as routing on `currentStepType` being 'action' or 'approval' AND the step configuration's assignee (`config.assignee`) being `role:sp_secretary` or `role:secretariat_staff` — "the most stable proxy available without an extra office-lookup join." The live implementation in `apps/server/src/modules/workflow/workflow.router.ts` (confirmed lines 236-240) no longer matches this description: it performs a direct office-ID comparison instead — `(currentStepType === 'action' || currentStepType === 'approval') && spsOfficeId && (currentStep.assignedTo?.[0]?.office_id === spsOfficeId)` — where `spsOfficeId` is resolved via an office lookup (`getOrgService(ctx).getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, ...)`, line 366) and passed into `computePanelHint` as a parameter (line 367). The role-based `config.assignee` check LOG-0078 describes is not present anywhere in the current function body.

The same drift is separately visible in a code comment: `apps/web/src/pages/workflow/panels/SecretariatDecisionPanel.tsx` (lines 9-13) still documents the old role-based-proxy behavior and cites LOG-0077 (not LOG-0078, though both describe the same underlying mechanism) as its source. That comment has not been updated to reflect the office-ID-comparison implementation either.

**What was implemented:** No code change from this task — this entry is a documentation correction only, recording that the mechanism has evolved since LOG-0078 without a superseding entry ever being filed. Whether the office-lookup join LOG-0078 called out as the reason to avoid a direct comparison was later added deliberately (i.e., an intentional design evolution) or the two changed independently without either author cross-referencing the other is not something this task investigated and is left for human review.
```

## Optional cleanup (separate from the above, do only if convenient)

If you are touching this area of the codebase anyway, `apps/web/src/pages/workflow/panels/SecretariatDecisionPanel.tsx` lines 9–13 currently read:

```ts
// logSecretariatDecision requires sp_secretary role + stepInstanceId.
// The server-side auth check is roles-only (subject.roles.includes('sp_secretary')).
// The panelHint='secretariat_decision' is computed server-side via step config.assignee,
// which is the only stable proxy available without an extra office-lookup join.
// See LOG-0077 for the full reasoning.
```

This can be updated to describe the current, confirmed behavior:

```ts
// logSecretariatDecision requires sp_secretary role + stepInstanceId.
// The server-side auth check is roles-only (subject.roles.includes('sp_secretary')).
// The panelHint='secretariat_decision' is computed server-side in computePanelHint
// (workflow.router.ts) via a direct comparison of the step's assigned office_id
// against the SP Secretariat office's ID (resolved via getOfficeByCode).
// See LOG-0092 for the correction (supersedes LOG-0077/LOG-0078's role-based-proxy description).
```

Not required for this task's acceptance criteria — skip it if it's inconvenient this session.

---

# TASK-WF-BE-002: Replace fabricated session-creation defaults with `null`, surface "not yet recorded" in stats and UI

**Context for the executor (no prior conversation reference needed):** In `apps/server/src/modules/workflow/session.router.ts`, the `scheduleDocumentForFirstReading` procedure creates a new `spSessions` row as a side effect of scheduling a document for a future session date, before that session has actually occurred. Its session-creation branch currently hardcodes `presentCount: 12` and `quorumAchieved: true` on that new row — these are fabricated values, not derived from any real data, since attendance for a not-yet-occurred session cannot be known at this point. Separately, `getAttendanceStatistics` (a different procedure in the same file) reads `presentCount` from every `spSessions` row in a date range to build a chart data series, and currently treats a `null` `presentCount` the same as `0` via `r.presentCount ?? 0`, which is its own instance of the same problem: silently asserting a specific numeric fact ("zero people present") in place of "we don't know yet."

**File 1 — `apps/server/src/modules/workflow/session.router.ts`:**

In `scheduleDocumentForFirstReading`, locate the `.insert(spSessions).values({...})` call inside the `else` branch of the session-existence check (currently reads `presentCount: 12, quorumAchieved: true` among its inserted values — re-verify the exact surrounding lines against the file as it exists when you start, since line numbers may have shifted). Change these two fields to `presentCount: null, quorumAchieved: null`. Do not add a roster-size lookup or any other computation to this branch — the correct behavior is to leave these fields genuinely unknown at creation time, not to compute a plausible-looking substitute. Do not touch the other branch of this same `if (session) {...} else {...}` check (the one that runs when a session row already exists for the date) — it already doesn't touch these two fields, and must continue not to.

In the same file, in `getAttendanceStatistics`, locate the row-mapping logic that currently reads `const presentCount = r.presentCount ?? 0;` followed by `const absentCount = Math.max(0, 12 - presentCount);`. Replace this so that:

- If `r.presentCount` is `null`, the mapped series entry should have `presentCount: null` and `absentCount: null` (do not coerce to `0` and do not compute an `absentCount` from a coerced value).
- If `r.presentCount` is a real number, keep the existing computation exactly as-is: `absentCount = Math.max(0, 12 - presentCount)`. (Note: this hardcoded `12` in the non-null branch is a separate, already-logged issue — [LOG-0091] point 3 / [LOG-0092] discuss it; do not attempt to fix it as part of this task. This task's job is only the null-vs-coerced-to-zero distinction, not the roster-size formula for rows that do have a real `presentCount`.)

This changes the inferred return type of `getAttendanceStatistics`'s `series` entries from `{ sessionDate: Date, presentCount: number, absentCount: number }` to `{ sessionDate: Date, presentCount: number | null, absentCount: number | null }`. This is expected and required — do not add a Zod output schema or any other mechanism to force it back to non-nullable.

**File 2 — `apps/server/src/modules/workflow/session.router.test.ts`:**

Add test coverage for:

- `scheduleDocumentForFirstReading`'s session-creation branch inserting `presentCount: null, quorumAchieved: null` (verify via the mocked `insert().values()` call arguments, following the existing test's mocking pattern for this procedure — see the existing `'schedules on next Tuesday and rolls forward...'` test for the established mock sequence to extend).
- `getAttendanceStatistics` returning `presentCount: null, absentCount: null` for a row where the mocked `presentCount` is `null`, alongside at least one row in the same test with a real numeric `presentCount` to confirm the existing non-null computation path still works unchanged (the existing `'returns computed stats series within date range'` test already covers two non-null rows — extend it with a third `null`-`presentCount` row, or add a new adjacent test, whichever fits more naturally into the existing test's structure without disrupting its current assertions on the first two rows).

**File 3 — `apps/web/src/pages/workflow/SessionAttendanceOverviewPage.tsx`:**

The table currently renders `item.presentCount` and `item.absentCount` directly as numbers in two `TableCell`s (with `text-success-600`/`text-danger-600` styling respectively). Add a check: when `item.presentCount === null` (equivalently, `item.absentCount === null` — both will be `null` together per the backend change above, never independently), render a "Not Yet Recorded" label spanning both the Present and Absent cells instead of two separate numeric cells, styled with `text-muted-foreground` (matching the existing muted styling already used elsewhere on this same page for the empty-state row, e.g. "No session attendance records found."). Do not remove or alter the `Link to={`/sessions/${dateStr}`}` "View Details" action in the Actions column for these rows — a not-yet-recorded row should still link to its detail page, since a secretary may want to go record attendance for it from there. Do not add any other new UI elements (no icons, no tooltips, no additional badges) beyond the text label — keep this consistent with the existing plain-text muted-color pattern already on this page.

**Scope boundary — do not touch:**

- The presiding-officer resolution logic in `scheduleDocumentForFirstReading` (the `vmPos` lookup and its fallback chain, lines 769–809 as last confirmed) — unrelated to this task, leave exactly as-is.
- `recordAttendance`, `getAttendanceRecord`, `getEligibleSubstituteOfficers`, `getOrderOfBusiness`, `enterCommitteeHearingDate` — none of them are in scope for this task.
- The hardcoded `12` inside `getAttendanceStatistics`'s non-null branch (`Math.max(0, 12 - presentCount)`) — already logged separately as [LOG-0091]/[LOG-0092], explicitly out of scope for this task, which only addresses the null-coercion issue, not the roster-size formula.
- `SessionAttendanceDetailPage.tsx` — not touched by this change; the "not yet recorded" state is specific to the overview/statistics page, since `getAttendanceRecord` (which the detail page calls) already independently returns an honest empty/default shape (`presentCouncilors: [], absences: [], quorumMet: false`, confirmed in its own early-return branch) for a session that doesn't exist yet, which is a different code path from this task's changes.

**Acceptance criteria:**

- [ ] `pnpm typecheck` passes across the whole monorepo (this task changes an inferred return type consumed by the frontend, so both `apps/server` and `apps/web` must typecheck cleanly against the new nullable shape).
- [ ] All existing tests in `session.router.test.ts` continue to pass unmodified except where explicitly extended above.
- [ ] New test coverage added per File 2 above.
- [ ] `SessionAttendanceOverviewPage.tsx` renders "Not Yet Recorded" (exact label) for any `series` row where `presentCount` is `null`, with muted styling consistent with the page's existing empty-state pattern, while preserving the "View Details" link for that row.
- [ ] No migration file is created — both `presentCount` and `quorumAchieved` are already nullable columns; confirm this directly against `packages/database/schema/workflow.schema.ts` before starting, rather than assuming a migration is needed.

**Not part of this task, explicitly deferred:** the roster-size-based quorum formula still hardcoded in `getAttendanceStatistics`'s non-null branch (tracked separately, [LOG-0091]/[LOG-0092]); points 1 and 2 of the broader `wf.md`/live-code procedure-shape drift (procedure split, missing `generateOrderOfBusiness`); the `isVMAbsent`-checkbox/actual-absences-list sync gap on `SessionAttendanceDetailPage.tsx` (flagged in the prior session's review, still awaiting your decision on which fix approach); the unrequested eligibility-restriction addition in `recordAttendance`/`getEligibleSubstituteOfficers` (still awaiting your accept/revert/modify decision).

---

# TASK-WF-BE-XXX — Server-side `stepKeyIn` filter for `listMyAssignedSteps` (unblocks Mayor Dashboard N+1 removal)

**Note on task numbering:** this project follows a `TASK-<MODULE>-<NUMBER>` convention. This is a backend workflow-engine task; assign it the next unused number in the `TASK-WF-BE-*` (or plain `TASK-WF-*`, matching whatever numbering the rest of the WF backend tasks use) sequence — check `docs/pre-development/A-project-planning/a1-tasks/wf.md` for the last-used number before finalizing the ID, since this prompt was not generated with live access to that file's current state.

## Why this task exists

`apps/web/src/pages/workflow/MayorDashboardPage.tsx` currently resolves which of a Mayor's assigned steps are mayor-actionable by calling `trpc.workflow.listMyAssignedSteps` (limited to a fixed page size) and then firing one `trpc.workflow.getInstance` call per returned row to read each row's `panelHint`. This has two confirmed problems, not one:

1. **N+1 network cost** — one extra round-trip per row.
2. **A pagination-order bug, more serious than the N+1 cost alone**: `listMyAssignedSteps` includes **every active/pending workflow step in the city** for any caller with a "senior" role (`mayor`, `sp_presiding_officer`, `auditor` — confirmed in `apps/server/src/modules/workflow/workflow.router.ts`, `seniorRoles` set at line 536, unconditional inclusion at lines 595–597, no office- or assignment-scoping applied for this branch). The procedure then takes only the `limit` most-recently-created matching rows (default 50, dashboard currently requests 30) **before** any mayor-specific relevance is known. On a city with routine legislative/administrative activity, the 30 most-recently-created steps across the entire city may contain few or zero mayor-relevant ones, even when older mayor-relevant items exist further back in the full queue — meaning the dashboard can show an empty or near-empty queue to a Mayor who genuinely has pending decisions.

Removing only the N+1 calls (e.g. by adding `stepKey`/`panelHint` as extra fields to the existing response) would **not** fix problem 2, since pagination would still be applied before any relevance filtering. This task fixes both by moving the filter to before the pagination slice, server-side.

## Files involved (all paths and line numbers confirmed directly against the current repo)

- `apps/server/src/modules/workflow/workflow.router.ts` (2551 lines total) — contains both `computePanelHint` (lines 201–249) and `listMyAssignedSteps` (lines 516–635). Both need changes.
- `apps/server/src/modules/workflow/workflow.policy.ts` — contains `MAYOR_STEP_KEYS` (line 147, currently module-private) and `canListAssignedSteps` (starts line 761, unchanged by this task — mentioned only so you know it exists and is not what you're modifying).
- `apps/web/src/pages/workflow/MayorDashboardPage.tsx` — the consumer of this change; needs updating once the backend change lands (see "Frontend follow-up" section at the end — included in this same task since it's a small, mechanical consequence of the backend change, not separate scope creep).

## Part 1 — Export `MAYOR_STEP_KEYS`

In `apps/server/src/modules/workflow/workflow.policy.ts`, line 147 currently reads:

```ts
const MAYOR_STEP_KEYS: ReadonlySet<string> = new Set(['mayor_review', 'mayor_signature']);
```

Change to:

```ts
export const MAYOR_STEP_KEYS: ReadonlySet<string> = new Set(['mayor_review', 'mayor_signature']);
```

This is the only change to this line — do not alter its value, its type, or anything else about it. This constant is already used internally at line 452 (`if (!MAYOR_STEP_KEYS.has(attrs.stepKey))`) — confirm that internal usage still compiles unchanged after adding `export` (it will; adding `export` to a `const` never changes its local usability).

## Part 2 — Extract the mayor deadline/lapse check out of `computePanelHint` into its own named function

`computePanelHint` (lines 201–249) currently inlines the mayor-specific deadline/lapse logic directly in its `stepKey === 'mayor_review' || stepKey === 'mayor_signature'` branch (lines 218–227):

```ts
} else if (stepKey === 'mayor_review' || stepKey === 'mayor_signature') {
    const deadlineStr = instanceContext['mayor_action_deadline'];
    if (deadlineStr) {
      const deadline = new Date(deadlineStr);
      const lapseConfirmed = !!stepMetadata['lapse_confirmed_at'];
      if (Date.now() > deadline.getTime() && !lapseConfirmed) {
        return 'mayor_lapse_confirmation';
      }
    }
    return 'mayor_decision';
  }
```

Extract this into a standalone, exported function in the same file (`workflow.router.ts`), placed just above `computePanelHint`'s own definition (i.e., before line 201):

```ts
export function computeMayorPanelHint(
  mayorActionDeadline: string | null | undefined,
  lapseConfirmedAt: unknown,
): 'mayor_decision' | 'mayor_lapse_confirmation' {
  if (mayorActionDeadline) {
    const deadline = new Date(mayorActionDeadline);
    const lapseConfirmed = !!lapseConfirmedAt;
    if (Date.now() > deadline.getTime() && !lapseConfirmed) {
      return 'mayor_lapse_confirmation';
    }
  }
  return 'mayor_decision';
}
```

Then update `computePanelHint`'s branch to call it instead of inlining the logic:

```ts
} else if (stepKey === 'mayor_review' || stepKey === 'mayor_signature') {
    return computeMayorPanelHint(instanceContext['mayor_action_deadline'], stepMetadata['lapse_confirmed_at']);
  }
```

**Why this extraction matters, stated explicitly so it isn't mistaken for unnecessary refactoring:** this exact business rule (a mayor action lapses 10 days after its deadline unless confirmed) will now be needed in two call sites — `computePanelHint` (unchanged behavior, just delegated) and the new filtering logic in `listMyAssignedSteps` (Part 3 below). Duplicating the rule instead of extracting it would recreate the exact kind of drift already documented in `docs/development-findings-log.md` LOG-0092 (two copies of the same business rule silently diverging over time because nobody updates both when one changes). Extracting it once here prevents that from happening to _this_ rule. Do not skip this extraction and separately reimplement the deadline check inline inside `listMyAssignedSteps` — that would be exactly the anti-pattern this refactor exists to avoid.

Confirm `computePanelHint`'s behavior is unchanged after this edit — it should produce identical output to before for every existing call site, since this is a pure delegation, not a logic change.

## Part 3 — Add `stepKeyIn` input filter and new output fields to `listMyAssignedSteps`

**3a. Input schema.** `listMyAssignedSteps`'s input is currently just `paginationInput` (line 517: `.input(paginationInput)`, schema defined at lines 35–38: `{ cursor: z.string().nullish(), limit: z.number().int().min(1).max(100).default(50) }`). Do not modify `paginationInput` itself, since it's likely used by other procedures too (confirm this by checking other `.input(paginationInput)` usages in this file before touching it — if it turns out to be used only here, it's still cleaner to leave the shared schema alone and extend at the call site). Instead, change line 517 to merge in a new optional field:

```ts
.input(paginationInput.extend({ stepKeyIn: z.array(z.string()).optional() }))
```

(Zod's `.extend()` on an object schema; confirm `paginationInput` is a `z.object(...)` — it is, per lines 35–38 — so `.extend()` is valid here.)

This makes the new parameter fully optional and backward-compatible: any existing caller of `listMyAssignedSteps` that doesn't pass `stepKeyIn` gets byte-identical behavior to today. Do not make this parameter required.

**3b. Base query — select the two new raw fields needed for the lapse computation.** The base query (lines 539–563) currently selects from `stepInstances`/`instances`/`documents`/`steps` but does not select `instances.context` or `stepInstances.metadata` — both needed to run `computeMayorPanelHint`. Add them to the `.select({...})` object at lines 540–550:

```ts
.select({
  stepInstanceId: stepInstances.id,
  instanceId: stepInstances.instanceId,
  documentId: instances.documentId,
  documentTitle: documents.title,
  stepType: steps.stepType,
  stepKey: steps.stepKey,
  assignedTo: stepInstances.assignedTo,
  createdAt: stepInstances.createdAt,
  slaDeadline: stepInstances.slaDeadline,
  documentOfficeId: documents.ownedByOfficeId,
  instanceContext: instances.context,
  stepMetadata: stepInstances.metadata,
})
```

(Two additions: `stepKey: steps.stepKey` — already joined via the existing `innerJoin(steps, ...)` at line 554, just not currently selected — and the two new fields, `instanceContext: instances.context`, `stepMetadata: stepInstances.metadata`.) No changes to the `.from()`/`.innerJoin()`/`.where()` clauses are needed — all four tables involved (`stepInstances`, `instances`, `documents`, `steps`) are already joined.

**3c. Apply the `stepKeyIn` filter to `filtered`, before pagination — this is the critical ordering fix.** After the existing role/assignment filter (the `.filter()` call at lines 578–600, which produces `filtered`), and **before** the pagination logic (currently lines 602–605), insert a second filter step:

```ts
const stepKeyFiltered =
  input.stepKeyIn && input.stepKeyIn.length > 0
    ? filtered.filter((row) => input.stepKeyIn!.includes(row.stepKey))
    : filtered;

const limit = input.limit ?? 50;
const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
const paginated = stepKeyFiltered.slice(startIndex, startIndex + limit);
const nextCursor = startIndex + limit < stepKeyFiltered.length ? String(startIndex + limit) : null;
```

(This replaces the current lines 602–605, which sliced `filtered` directly — every reference to `filtered` in the pagination math must become `stepKeyFiltered`, including inside the `nextCursor` calculation. Do not slice `filtered` directly anymore once this change lands; `filtered` is now an intermediate value, `stepKeyFiltered` is what gets paginated.)

**3d. Compute and return the new output fields.** In the final `.map()` (currently lines 607–629), add `stepKey` (pass-through) and a scoped `panelHint` field, computed only for mayor step keys:

```ts
const items = paginated.map((item) => {
  const validStepTypes = new Set<
    | 'action'
    | 'approval'
    | 'multi_referral'
    | 'decision'
    | 'notification'
    | 'termination'
    | 'parallel_split'
    | 'parallel_join'
  >(['action', 'approval', 'multi_referral', 'decision', 'notification', 'termination']);
  const stepType = validStepTypes.has(item.stepType) ? item.stepType : 'action';

  const context = (item.instanceContext as Record<string, any>) || {};
  const metadata = (item.stepMetadata as Record<string, any>) || {};
  const panelHint = MAYOR_STEP_KEYS.has(item.stepKey)
    ? computeMayorPanelHint(context['mayor_action_deadline'], metadata['lapse_confirmed_at'])
    : null;

  return {
    stepInstanceId: item.stepInstanceId,
    instanceId: item.instanceId,
    documentId: item.documentId,
    documentTitle: item.documentTitle,
    stepType,
    stepKey: item.stepKey,
    assignedAt: item.createdAt,
    dueAt: item.slaDeadline,
    panelHint,
  };
});
```

Note: `panelHint` here is deliberately typed `'mayor_decision' | 'mayor_lapse_confirmation' | null` — a **narrower** type than `getInstance`'s 11-value `panelHint` union. This is intentional, not an inconsistency to fix: this procedure has no reason to compute the other 9 panel-hint values (that would require the SP-Secretariat office lookup and full `computePanelHint` machinery, which this filtered, list-oriented procedure doesn't need). The shared field name is deliberate too — it signals "same concept as `getInstance`'s field, narrower scope" to a future reader, rather than inventing an unrelated name for the same idea.

You will need `import { MAYOR_STEP_KEYS } from './workflow.policy.js';` added to this file's import block (it already imports `workflowPolicy` and types from the same path at lines 26–27 — add `MAYOR_STEP_KEYS` as an additional named import from the same module, either combined into the existing import statement or as its own line, whichever keeps the import block most readable to you).

**3e. Output schema.** `listMyAssignedSteps` currently has no `.output()` Zod schema at all (confirmed — it goes directly from `.input(...)` to `.query(...)`). Do not add one as part of this task unless you judge it trivial to do correctly alongside everything else above — this task's primary goal is the filter and new fields; adding output validation to a procedure that's never had it is a separate, judgment-call-shaped improvement (whether to add strict runtime validation now, and what happens to any existing caller if the inferred shape shifts). If you do add one, it must include the new `stepKey: z.string()` and `panelHint: z.enum(['mayor_decision', 'mayor_lapse_confirmation']).nullable()` fields alongside every existing field, and must not narrow or change any existing field's type. If you're not confident this is a clean, low-risk addition in the time you have, skip it and leave the procedure exactly as un-typed on output as it is today — that's an acceptable outcome for this task, not a shortfall.

## What NOT to touch

- Do not change `paginationInput`'s own definition (lines 35–38) — extend at the call site via `.extend()`, as shown.
- Do not change anything about the existing role/assignment filtering logic in the first `.filter()` (lines 578–600) — the `stepKeyIn` filter is a second, independent, additive filter applied after that one, not a replacement or modification of it.
- Do not touch `getInstance`, `getActiveInstanceForDocument`, or any other procedure in this file.
- Do not touch `canListAssignedSteps` or any other function in `workflow.policy.ts` besides adding the single `export` keyword to `MAYOR_STEP_KEYS`.
- Do not touch any frontend panel file (`MayorDecisionPanel.tsx`, `MayorLapseConfirmationPanel.tsx`, `WorkflowStepActionPage.tsx`) — none of those need any change for this task.

## Frontend follow-up (same task, small mechanical consequence of the backend change)

Once the above lands, update `apps/web/src/pages/workflow/MayorDashboardPage.tsx`'s `QueueWidget` to use the new server-side filter instead of the N+1 pattern:

Replace the current implementation (the `trpc.useQueries` block and the `combinedItems`/`decisions`/`lapses` derivation built from it) with:

```ts
import { MAYOR_STEP_KEYS } from 'server/src/modules/workflow/workflow.policy.js'; // adjust the import path to match however this monorepo's TS path-aliasing resolves cross-package server imports elsewhere in apps/web — check an existing example of apps/web importing a type or value from apps/server before assuming this exact path works; if apps/web cannot import server-side runtime values at all (only types, via `RouterInputs`/`RouterOutputs`-style inference), fall back to inlining the two literal strings ['mayor_review', 'mayor_signature'] directly in this file with a comment noting they must stay in sync with MAYOR_STEP_KEYS in workflow.policy.ts, and flag this constraint in a findings-log entry since it means the "single source of truth" goal from Part 2 is only partially achieved across the frontend/backend boundary.

const { data, isLoading } = trpc.workflow.listMyAssignedSteps.useQuery({
  limit: 30,
  stepKeyIn: [...MAYOR_STEP_KEYS],
});

const assignedRows = data?.items ?? [];
const decisions = assignedRows.filter((item) => item.panelHint === 'mayor_decision');
const lapses = assignedRows.filter((item) => item.panelHint === 'mayor_lapse_confirmation');
```

Remove the `trpc.useQueries` block, the `instanceQueries`/`isInstancesLoading`/`combinedItems` variables, and the now-unneeded `RouterOutputs`-based type derivation if it was solely supporting the removed N+1 logic (check whether `AssignedStepRow` — or whatever the current type alias is named — is still referenced elsewhere in the file before deleting it). The rendering JSX below (the "Awaiting Your Decision" / "Lapse Notices" two-section layout) does not need to change — it already consumes `decisions`/`lapses` arrays with `documentTitle`, `stepType`, `dueAt`, `assignedAt`, `slaDeadline` fields, all of which remain present in the new response shape. Double check `slaDeadline` specifically — the read-only lapse rows currently render `step.slaDeadline` (sourced from the old per-row `getInstance` call's `slaDeadline` field); in the new response, the equivalent field is `dueAt` (from `stepInstances.slaDeadline`, already present in the base `listMyAssignedSteps` row, same underlying DB column) — update the JSX reference from `step.slaDeadline` to `step.dueAt` accordingly, since the new combined row no longer has a field literally named `slaDeadline`.

**I could not resolve the cross-package import path for `MAYOR_STEP_KEYS` from `apps/web` without live access to this monorepo's actual TS path-alias configuration (tsconfig paths, package exports map, or build tooling) — verify this specifically rather than guessing at the import string, and use the stated fallback (inline the two strings with a sync-comment, log the gap) if a clean cross-package runtime import isn't already an established pattern elsewhere in `apps/web`.**

## Acceptance criteria

- [ ] `pnpm typecheck` passes.
- [ ] `MAYOR_STEP_KEYS` exported from `workflow.policy.ts` with no other change to that line.
- [ ] `computeMayorPanelHint` extracted as its own function, `computePanelHint` delegates to it, behavior unchanged for all existing call sites.
- [ ] `listMyAssignedSteps` accepts optional `stepKeyIn`, applies it to `filtered` **before** the pagination slice (verify this ordering specifically — it's the entire point of this task, not an incidental detail).
- [ ] New `stepKey` and `panelHint` fields present in every returned item, `panelHint` correctly `null` for non-mayor step keys and correctly computed via `computeMayorPanelHint` for `mayor_review`/`mayor_signature` steps.
- [ ] Existing callers of `listMyAssignedSteps` that don't pass `stepKeyIn` see no behavior change.
- [ ] `MayorDashboardPage.tsx` updated to use the new filter, N+1 `getInstance` calls removed, `slaDeadline` reference corrected to `dueAt`.
- [ ] If the cross-package import for `MAYOR_STEP_KEYS` isn't cleanly resolvable, the stated fallback (inline strings + sync comment) is used and a findings-log entry is appended noting the partial single-source-of-truth gap — do not silently pick the fallback without logging it, since a future reader needs to know these two lists can drift.

---

# TASK-WF-BE-002b

**Context for executor:** `session.router.ts`'s `scheduleDocumentForFirstReading` mutation already correctly inserts `presentCount: null, quorumAchieved: null` (instead of previously-fabricated `12`/`true`) when creating a new `spSessions` row for a session date that doesn't yet have one. This is implemented correctly and already verified via `pnpm typecheck` passing monorepo-wide. What's missing is automated test coverage for this specific insert path — the current test suite for `scheduleDocumentForFirstReading` (in `apps/server/src/modules/workflow/session.router.test.ts`) contains exactly one test, and that test's mock sequence simulates a session that _already exists_ for the target date, which routes execution through a different branch (`if (session) { sessionId = session.id; }`) that never reaches the insert in question. As a result, nothing in the test suite currently guards against a regression of this fix (e.g., if a future edit reintroduced a hardcoded default here, no test would fail).

**File to edit:** `apps/server/src/modules/workflow/session.router.test.ts`

**What to do:** Add a **new** `it(...)` block inside the existing `describe('scheduleDocumentForFirstReading', ...)` block (which currently starts at line 367 and contains one test, ending at line 391 — confirm these line numbers directly before editing, in case they've shifted). Do not modify the existing test. The existing test's mock sequence simulates "session already exists" (see its `mockDb.mockResponse([{ id: 'session-id' }]); // session check -> exists` call) and provides valid, working coverage for that branch — it must be left exactly as-is.

The new test should simulate "session does not yet exist for the target date," which is the branch that performs the insert this task is meant to cover. Based on tracing `scheduleDocumentForFirstReading`'s current implementation (`apps/server/src/modules/workflow/session.router.ts`, the transaction body starting at line 773), the sequence of DB calls that fire, in order, for this scenario is:

1. `vmPos` select (VM/presiding-officer position lookup) — no VM position found
2. `loggedInEmployee` select (fallback: current user as employee) — not found
3. `firstEmp` select (fallback: any employee) — return one, to resolve `presidedByEmployeeId` cleanly without exercising deeper fallback logic unrelated to this test's purpose
4. `session` select (the check this test exists to exercise) — **empty**, forcing the session-creation branch
5. `numRow` select (max existing session number, for computing the next session number) — return some existing max
6. `insert(spSessions).returning()` — **this is the call under test.** Return a new session row (e.g. `{ id: 'new-session-id' }')
7. `oob` select (Order of Business lookup for the new session) — return an existing OoB row, so this test does not also re-exercise OoB-creation logic (already covered elsewhere/not this test's concern)
8. `existingItem` select (check if this document is already on the OoB) — empty, forcing the item-insert branch
9. `orderRow` select (max existing item order) — return some value
10. `insert(orderOfBusinessItems)` (item insert; note this call in the source has no `.returning()`, but the mock's shared `then()` still consumes one queued response for it, exactly as the existing test's own `mockDb.mockResponse([]); // insert item` comment demonstrates) — empty response

Use `mockDb.mockResponse(...)` calls in exactly this order, each with an inline comment describing what it corresponds to, following the existing test's established commenting style (see its lines 375–381 for the pattern to match).

**Assertion requirement — this is the actual point of the test:** the mock DB's `insert`/`values`/`returning` chain in this test file is currently a pass-through spy (`vi.fn().mockReturnThis()`) with no argument capture, so simply running the mutation to completion does not, by itself, prove `null`/`null` was passed to the insert. To make this test actually verify the fix (not just verify the mutation doesn't throw), read `values` off the shared mock db object and assert on its call arguments after the mutation resolves — e.g. `expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ presentCount: null, quorumAchieved: null }))`. Confirm the exact mock object's field name for the values spy (`mockDb.values`) against the current `makeMockDb()` implementation (lines 30–58 of this test file) before writing the assertion, since this prompt is describing it from a prior read and it should be re-confirmed at execution time. If `toHaveBeenCalledWith` on a shared spy that's called multiple times across the transaction doesn't cleanly isolate this specific call (since `values` is called multiple times in this code path — for the session insert, and potentially the OoB/item inserts too, depending on how the scenario above plays out), use `toHaveBeenNthCalledWith` or inspect `mock.calls` directly to isolate the specific invocation corresponding to the `spSessions` insert, rather than asserting loosely and risking a false pass.

**Scope boundary — do not touch:** the existing test in this describe block; any other describe block in this file; `session.router.ts` itself (already correct, not part of this task); any other file.

**Acceptance criteria:**

- [ ] New test added, existing test unchanged.
- [ ] New test asserts specifically on the `spSessions` insert call receiving `presentCount: null, quorumAchieved: null` — not just on the mutation's return value or absence of a thrown error.
- [ ] `pnpm --filter server test:unit` (or equivalent vitest invocation for this file) passes, including both the existing and new test.
- [ ] `pnpm typecheck` still passes monorepo-wide (should be a no-op here since no production code changes, but confirm rather than assume).

**Explicitly deferred, not part of this task:** everything already deferred by the original TASK-WF-BE-002 prompt (roster-size-based quorum formula, `wf.md` drift points 1 and 2, the `isVMAbsent` sync gap, the unrequested eligibility-restriction addition) — none of that changes here.

---

# TASK-WF-BE-003 (Presiding-Officer Substitute Eligibility — Revert to Spec-Literal)

**Context for executor:** `apps/server/src/modules/workflow/session.router.ts` currently determines who is eligible to substitute as presiding officer (when the Vice Mayor is absent from an SP session) using a two-population check: (1) any employee currently assigned to the SP office, or (2) any employee holding an active `delegationGrants` row for the VM position. Population (1) — bare SP-office membership, with no requirement for any formal designation — was added without being requested by the original task spec for this feature, and was never authorized. The project's consolidated requirements reference (`docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md`, §7.3, line 1032) states: _"If VM is absent, a presiding officer is designated beforehand (requires Designation document)"_ — this system uses `delegationGrants` as its representation of that designation. Population (1) has no textual support in this requirement and is being removed. Population (2) — the active-delegation-grant check — is correct per spec and must be preserved unchanged in its own logic (date-range check, `isActive`, `revokedAt` null check, etc.).

This task touches three files. Do not skip any — they currently describe/enforce the same (soon-to-be-wrong) two-population rule in three different ways, and must move together or the system will be internally inconsistent (e.g., backend rejecting someone the frontend picker still offers).

---

## File 1 — `apps/server/src/modules/workflow/session.router.ts`

### Change 1a: `getEligibleSubstituteOfficers` (currently lines 218–307)

Remove the SP-office-membership query and its seeding of the candidate list entirely. Specifically:

- Delete the `spMembers` query (currently lines 245–261) and the loop that seeds `candidateMap` from it (currently lines 263–270).
- The `activeGrants` query (currently lines 272–300) becomes the **sole** source of candidates. Keep its logic exactly as-is — do not modify the delegation-grant query conditions.
- **Explicit edge case, state this plainly, do not let it surface as a surprise:** after this change, if `vmPositionId` is undefined (no VM/Presiding-Officer position record found at all — the `if (vmPositionId)` guard, currently line 272), the procedure will return an **empty array**, with no fallback population to fall back to. This is a real behavior change from the current implementation (which would still return the full SP-member list in this case). This is the correct behavior per spec-literal (no designation possible without a VM position to be designated a substitute _for_), not a bug to guard against — do not add a fallback for this case.
- The resulting procedure body should reduce to: get `vmPositionId`, if present query `delegationGrants` joined to `employees` for active grants against that position for the given date, map to `{ id, displayName }`, sort by `displayName`, return. If `vmPositionId` is absent, return `[]`.

### Change 1b: `recordAttendance`'s override-path eligibility check (currently lines 546–584, inside the `if (presidedByEmployeeIdOverride)` block)

Remove the `spMember` (SP-office-assignment) query and its role in determining `isEligible`. Specifically:

- Delete the `spMember` query (currently lines 546–558).
- `isEligible` should be determined solely by the delegation-grant check (currently lines 561–577) — this becomes the only check, not a fallback triggered by `!isEligible`.
- The two existing `BAD_REQUEST` throws (currently lines 539–544 for "employee not found," lines 579–584 for "not eligible to preside") both stay exactly as-is, including their exact message text — only the eligibility _determination_ logic changes, not the error-handling shape around it.

### Change 1c: `recordAttendance`'s no-override-path fallback (currently lines 587–607, the `else` branch when no override was provided but VM is absent)

**Do not change this block's structure.** This is a genuinely different case from 1a/1b: it doesn't offer a second _population_ of eligible people to choose from — it's what happens when the system needs to pick _a_ value for `presidedByEmployeeId` because a secretary didn't provide an explicit override, and no active delegation grant exists either. The existing fallback (currently lines 604–606: fall back to `vmEmployeeId` itself, i.e., the absent VM's own ID) is untouched by this task. This was confirmed via the current test suite: no test exercises this specific sub-case (no override, VM absent, no active grant) either before or after this task, so there is no existing behavior contract being broken either way — this task is scoped to removing the _unauthorized SP-office-membership population_, not to auditing every fallback-of-last-resort in the file. If you believe this fallback also needs to change, stop and flag it rather than changing it as part of this task — it was not part of what was decided.

---

## File 2 — `apps/server/src/modules/workflow/session.router.test.ts`

Three existing tests need updates because their mock sequences currently exercise the population being removed. Confirm current line numbers directly before editing, since they may have shifted from what's cited below (drawn from a read earlier in this task's investigation, not guaranteed current at execution time).

### Test: `'records attendance when VM is absent and valid override is provided (override wins)'` (currently ~line 156)

This test's mock sequence currently has, as step 4: `mockDb.mockResponse([{ id: 'assignment-id' }]); // 4. override eligibility (SP member)` — this is exactly the population being removed, and this test's success path currently depends on it. Rewrite this mock step to instead simulate a successful delegation-grant lookup (matching the shape used by the `'records attendance when VM is absent and delegation is active'` test's own grant-mock, e.g. `{ delegatedToEmployeeId: '...' }` — check that test's exact mock shape and column selection to match it precisely, since the two code paths query different things: the no-override path selects `delegatedToEmployeeId`, this override path's grant check currently only selects `{ id: delegationGrants.id }`, confirm which shape is correct for the post-change code before writing the mock). Update the inline comment accordingly. The test's name, its `presidedByEmployeeIdOverride` input value, and its final assertions should not need to change — only the mock step representing how eligibility is established.

### Test: `'throws BAD_REQUEST if override is provided, VM is absent, but override employee is not eligible'` (currently ~line 237)

This test currently mocks two separate failing checks — step 4 `// 4. override eligibility (NOT an SP member)` and step 5 `// 5. override eligibility (NO active delegation)`. After this change there is only one eligibility check, so remove one of these two `mockResponse([])` calls (there should be exactly one fewer mocked response in this test after the edit) and update the remaining comment to reflect that it's now the only eligibility check being tested, not one of two. The test's assertions (still expecting the "not eligible to preside" error) should not need to change.

### `getEligibleSubstituteOfficers` — no existing test coverage

This procedure currently has zero test coverage in this file (confirmed via search — no `getEligibleSubstituteOfficers` describe block exists). This task changes its behavior in two ways: removing an entire candidate population, and introducing the empty-array-on-no-VM-position edge case described in Change 1a. **Do not add test coverage for this procedure as part of this task** — adding a new describe block and its first tests is a larger, separate scope decision (what should be covered, how thoroughly) than "revert an unauthorized eligibility population," and folding it in here would be scope creep beyond what was decided. If you believe this gap should be closed, stop and flag it as a separate follow-up rather than adding it here.

---

## File 3 — `apps/web/src/pages/workflow/SessionAttendanceDetailPage.tsx`

Line 237 currently reads: `Select a substitute from eligible SP members or those with an active delegation grant.` This sentence describes the two-population rule being removed and will be factually incorrect the moment File 1's changes land. Update it to describe the single remaining population accurately — for example, `Select a substitute from those with an active delegation grant for this position.` (exact wording is not prescribed beyond "must accurately describe the delegation-grant-only rule and not reference SP membership as a separate eligibility path" — use your judgment on phrasing, but it must not claim SP membership alone is sufficient).

No other changes to this file. Specifically do not touch: the `isVMAbsent` checkbox and its independence from the `absences` array (a separate, already-flagged, not-yet-decided issue — Open Decision 2 from prior findings, out of scope here), the `substituteCandidates` query call itself (unchanged — it calls the same procedure, which now simply returns a different/smaller result set), or any other part of the form.

---

## Scope boundary — do not touch, full list

- `recordAttendance`'s no-override fallback logic (File 1, Change 1c — explicitly preserved, see above).
- The `absentCount` field in `recordAttendance`'s return shape (separate open item, not part of this task).
- The `isVMAbsent` checkbox / actual-absences-list sync gap (separate open item, Open Decision 2).
- `getAttendanceStatistics`, `scheduleDocumentForFirstReading`, `enterCommitteeHearingDate`, `getOrderOfBusiness`, `getAttendanceRecord` — none of these are touched by this task.
- Any migration or schema file — this is a pure logic change against existing tables/columns; no schema changes are needed or expected. Confirm this against `packages/database/schema/organization.schema.ts` (for `delegationGrants`) before starting rather than assuming, in case something has shifted since this prompt was written.
- Do not add test coverage for `getEligibleSubstituteOfficers` (see File 2 above — explicitly deferred as a separate decision).

## Acceptance criteria

- [ ] `getEligibleSubstituteOfficers` returns only active-delegation-grant holders; returns `[]` when no VM position is found.
- [ ] `recordAttendance`'s override-path eligibility check is delegation-grant-only; both existing `BAD_REQUEST` error messages unchanged.
- [ ] `recordAttendance`'s no-override fallback logic (lines ~587–607 pre-edit) is byte-identical to its current state — this task does not touch it.
- [ ] `SessionAttendanceDetailPage.tsx` line 237's copy no longer references SP membership as an eligibility path.
- [ ] `pnpm --filter server test:unit` (or equivalent vitest invocation) passes — including the two updated tests, with the rest of the suite unmodified and passing.
- [ ] `pnpm typecheck` passes monorepo-wide.
- [ ] No new test file/describe block added for `getEligibleSubstituteOfficers` (explicitly deferred).

**Explicitly deferred, not part of this task:** Location 1c's fallback-of-last-resort behavior; the `isVMAbsent` sync gap (Open Decision 2); `absentCount` in the return shape (Open Decision 3); TASK-PRE-04b retirement (Open Decision 4); `[LOG-0082]` status (Open Decision 5); `wf.md` drift Points 1 and 2; test coverage for `getEligibleSubstituteOfficers`.

---

# TASK-WF-FE-004 (Derive VM-Absence State from Absences List, Remove Manual Checkbox)

**Context for executor:** `apps/web/src/pages/workflow/SessionAttendanceDetailPage.tsx` currently has a manually-checked `isVMAbsent` checkbox (independent `useState`, currently at line 45) that a secretary must check to reveal the substitute-presiding-officer picker. This checkbox has no connection to the `absences` array the secretary is separately building on the same form. The backend (`apps/server/src/modules/workflow/session.router.ts`, `recordAttendance`) only honors a submitted `presidedByEmployeeIdOverride` when its own independently-computed `isVmAbsent` (line 500: `absences.some((a) => a.councilorEmployeeId === vmEmployeeId)`) is true — meaning if a secretary checks the box and picks a substitute but forgets to also add the VM to the absences list, the backend silently discards the override with no error and no indication to the user, while the frontend still shows a success message. This task removes the possibility of that desync entirely by deriving VM-absence status from the same signal the backend uses (presence in the `absences` array), rather than from separate manual UI state.

This task touches two files, in this order (backend first, since the frontend change depends on the new field existing).

---

## File 1 — `apps/server/src/modules/workflow/session.router.ts`

Add the VM's employee ID to `getAttendanceRecord`'s return shape (currently the procedure starting at line 67).

**In the `!session` early-return branch (currently lines 86–95):** This branch currently returns immediately with no VM lookup. Add the VM-position/assignment lookup here — VM identity is a standing fact about the current position/assignment, not something contingent on a session existing yet, so this lookup must run in this branch too, not be skipped. Use the identical query pattern already used in `recordAttendance` (currently lines 480–496 of this same file): select `{ employeeId: assignments.employeeId }` from `positions` inner-joined to `assignments`, filtering on `or(ilike(positions.title, '%Vice Mayor%'), ilike(positions.code, '%VM%'), ilike(positions.title, '%Presiding%'))` plus the standard `isNull(deletedAt)` and `eq(assignments.isPrimary, true)` conditions, limit 1. Add the resulting employee ID (or `null` if no VM position/assignment is found) as a new field `vmEmployeeId: string | null` in this branch's returned object.

**In the main body (after the existing session lookup, before the final return statement currently at lines 158–165):** Add the same VM-position/assignment lookup here as well, and include `vmEmployeeId` in the final returned object alongside the existing fields.

**Note on duplication, not part of this task's required scope:** this exact query pattern (the `or(ilike(...), ilike(...), ilike(...))` VM-position lookup) already exists in three other places in this file — `getEligibleSubstituteOfficers` (line 232), `recordAttendance` (line 487), and `scheduleDocumentForFirstReading` (line 743). Adding it to `getAttendanceRecord` makes a fourth inline copy. **Do not extract this into a shared helper function as part of this task** — that is a separate refactor decision (touching four call sites, no behavior change) that was not requested and should not be bundled in here. If you believe it should happen, flag it as a separate follow-up rather than doing it as part of this change.

**Type/schema note:** check whether this procedure's output has an explicit Zod output schema or relies on TypeScript inference from the `return` statements. If there's an explicit output schema anywhere in this file or a shared location it imports from, it needs the new `vmEmployeeId: z.string().nullable()` field added too — confirm this directly rather than assuming inferred typing is sufficient, since a missed explicit schema would silently strip the new field at runtime even if TypeScript compiles.

---

## File 2 — `apps/web/src/pages/workflow/SessionAttendanceDetailPage.tsx`

**Remove:**

- The `isVMAbsent` state declaration (currently line 45: `const [isVMAbsent, setIsVMAbsent] = useState(false);`).
- The checkbox UI block entirely (currently lines 206–215: the `Checkbox` with `id="isVMAbsent"`, its `Label`, and the surrounding `div` — but keep the outer wrapping `div` at line 205 (`className="space-y-4 rounded-md border p-4"`) since the substitute-picker block still needs a container; only the checkbox-specific inner block goes).

**Add:**

- A derived (not stateful) value computed from `record?.vmEmployeeId` and the current `absences` state: `isVMAbsent` should now be `record?.vmEmployeeId ? absences.some(a => a.councilorEmployeeId === record.vmEmployeeId) : false`. This does not need `useMemo` given the component's scale and render frequency, but use your judgment on whether the existing codebase conventions in this file favor computing it inline versus memoizing — check how other derived values in this file or sibling page components in the same directory are typically handled, and match that convention rather than introducing a new pattern.
- Keep the existing conditional rendering of the substitute-picker block (currently `{isVMAbsent && (...)}`, line 217) — this now reads the derived value instead of the removed state variable, no other change needed to this block's contents (the `Select`, its options mapped from `substituteCandidates`, and the explanatory text at line 236–238 all stay exactly as they are).
- Line 72's mutation payload (`presidedByEmployeeIdOverride: isVMAbsent && substituteId ? substituteId : null`) needs no change beyond referencing the now-derived `isVMAbsent` instead of the removed state variable — the expression itself is already correct.

**Confirmed non-issue, do not add handling for this:** `substituteId` state (line 46) is not reset when the derived `isVMAbsent` flips back to `false` (e.g., if a secretary adds the VM to absences, picks a substitute, then removes the VM from the absences list again via the existing "remove absence" button). This is not a new problem introduced by this change — the current code has the identical latent characteristic with the manual checkbox — and the submit logic at line 72 already only uses `substituteId` when the (now-derived) condition is true, so a stale `substituteId` value sitting in state while `isVMAbsent` is `false` has no effect on submission. Do not add a `useEffect` or other reset logic for this as part of this task; it was not part of what was decided and the behavior is unchanged from before this task.

**Scope boundary — do not touch:** the `substituteCandidates` query call itself (unchanged — same procedure, same input); the `Select`/`SelectItem` rendering of substitute candidates; the explanatory text at line 236–238 (already correctly updated by a prior task, describes the delegation-grant rule, unrelated to this change); the `absences` array's own add/update/remove handlers (lines 48–62); the `handleSubmit` function's overall structure beyond the `isVMAbsent` reference already covered above; any other page or component.

---

## Acceptance criteria

- [ ] `getAttendanceRecord` returns `vmEmployeeId` in both the early-return (`!session`) branch and the main-body return, using the identical VM-lookup query pattern already established elsewhere in this file.
- [ ] `SessionAttendanceDetailPage.tsx` has no `isVMAbsent` `useState` — it is now a derived value.
- [ ] The manual checkbox UI is fully removed; the substitute-picker block's visibility is now driven entirely by whether the VM's employee ID appears in the current `absences` array.
- [ ] `pnpm typecheck` passes monorepo-wide.
- [ ] Existing tests for `getAttendanceRecord` (in `session.router.test.ts`) still pass — check whether any existing test asserts on the exact shape of this procedure's return value (an object-equality or snapshot-style assertion) in a way that would need updating to account for the new `vmEmployeeId` field, versus tests that only check specific named fields (which would be unaffected by an additive field). Confirm which kind exists before assuming either way.
- [ ] No shared-helper extraction for the VM-lookup query (explicitly deferred, see File 1 note above).

**Explicitly deferred, not part of this task:** extracting the VM-position-lookup query into a shared helper (four inline copies would exist after this task, unchanged from the three that exist before it, plus this task's one addition); `absentCount` in `recordAttendance`'s return shape (separate open item); TASK-PRE-04b retirement; `[LOG-0082]` status; `wf.md` drift Points 1 and 2; any changes to the empty-candidates-but-required-picker edge case noted during investigation (confirmed to be a pre-existing characteristic, not introduced by this task, and not part of what was decided here).

---

# TASK-WF-FE-006

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

---

# TASK-WF-FE-007

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

# TASK-WF-FE-007 Reference: Session Lock/Unlock Implementation

## Task Overview

Two-part task: a required backend enforcement fix (Part 1), followed by the frontend it unblocks (Part 2). Same shape as TASK-WF-FE-002. Part 1 must not be skipped — Part 2 is not meaningfully testable without it.

**Prerequisite reading before starting:**

- AGENTS.md (Section 2 routing: Part 1 = "Write a tRPC procedure or router" → E1 → I1 → I2; Part 2 = "Build a frontend page or view in /apps/web" → F4 → F1 → F5 → J6 → I2 → E1)
- B5 §4.4-4.7 (`docs/pre-development/B-architecture-documents/b5-authentication-and-authorization-architecture.md`, lines 379-424)
- ADR-AUTH-010 in full (`docs/pre-development/B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-010-session-locked_at-behavior-when-access-token-expires-while-locked.md`, 52 lines)

Both source documents are Status: Accepted/Confirmed. This task implements their existing decisions; it does not reopen them.

---

## Verified Gaps Motivating This Task

### Gap 1 — Backend (blocking, Part 1 target)

B5 §4.6 ("Shared Workstation Lock") states that while a session is locked, "all protected routes reject requests with locked session status" (line 411).

**What's actually implemented:**

- `apps/server/src/modules/iam/iam.middleware.ts`, lines 167-172: correctly checks `if (session.locked_at !== null && request.url !== '/api/auth/unlock') { return reply.code(423).send({ code: 'SESSION_LOCKED' ...}) }`
- This check is only wired into Fastify inside `iam.routes.ts`'s own nested protected sub-app (`fastify.register(async (protectedApp) => { await protectedApp.register(authMiddlewarePlugin); ... })`, confirmed at `iam.routes.ts` line 369)
- This sub-app covers exactly three REST routes: `/api/auth/lock`, `/api/auth/logout`, `/api/admin/sessions/:id/terminate`

**What's missing:**

- tRPC is registered separately (`apps/server/src/app.ts` line 125: `fastify.register(fastifyTRPCPlugin, { prefix: '/api/trpc', ... })`) as a sibling top-level plugin, not nested inside `iam.routes.ts`'s protected sub-app
- tRPC's auth gate (`apps/server/src/trpc/trpc.ts`, `protectedProcedure`, lines 19-32) only checks whether `ctx.auth` is truthy — never re-checks `locked_at`
- Repo-wide grep confirmed: zero references to `locked_at`, `SESSION_LOCKED`, or `isLocked` exist anywhere under `apps/server/src/trpc/` or any of the seven tRPC router files under `apps/server/src/modules/*/,*.router.ts`

**Consequence:** locking a session via `POST /api/auth/lock` sets `locked_at` correctly, but every tRPC call — nearly all real application traffic, since all 22 built pages use `trpc.*` calls, not REST — continues to succeed as if unlocked. B5's stated guarantee is currently false for tRPC routes.

### Gap 2 — Frontend (Part 2 target)

Repo-wide search of `apps/web/src` for "lock"/"unlock" (case-insensitive) confirmed:

- No frontend surface for locking, the lock screen, or unlocking exists
- No real consumer of `POST /api/auth/lock` or `POST /api/auth/unlock` anywhere
- No frontend idle-timer exists for B5 §4.4's "25-minute warning is frontend-driven" requirement

**[Inference], not explicitly stated in any source document:** the idle timer (which triggers the 25-min warning) and the lock trigger are coupled — the idle timer is what fires the lock. Based on combining §4.6's "Switch User / Lock Screen action" language with §4.4's warning-then-inactivity-timeout design. Flagged as an inference this task list is making, not a confirmed requirement.

---

## Part 1 — Close the tRPC Enforcement Gap

Not a product decision — B5 §4.6's rule is already Confirmed. The fix is mechanical: extend the same locked_at check to cover tRPC's request path. Two valid implementation shapes; either is acceptable, choice must be stated explicitly in the PR description.

### Shape (a): Global Fastify hook

Register an `onRequest`/`preHandler` hook before `fastifyTRPCPlugin` in `app.ts`'s registration order (currently line 125), performing the same `locked_at` check against any request whose auth is already resolved.

**Requires resolving first:** `req.auth` must already be populated by the time this hook runs. `trpc.ts`'s `createContext` (line 8) reads `(req as any).auth || null`, implying something already sets `req.auth` for tRPC requests today (since `protectedProcedure`'s `ctx.auth` checks currently succeed for real users, confirmed by all existing pages' data loading working). This must be traced by reading code, not assumed — likely a separate, currently-undiscovered global hook already runs Hook 1-3's equivalent logic (JWT verification, session lookup, RLS context-setting) for tRPC requests, just without Hook 1's step 4 (the locked check) or without being the exact same function as `iam.middleware.ts`'s `verifyAccessToken`. Do not assume `verifyAccessToken` is unused for tRPC without confirming what mechanism is actually used instead.

### Shape (b): Inline in protectedProcedure middleware

Add the `locked_at` check directly inside `trpc.ts`'s `protectedProcedure` middleware (the `t.procedure.use(async (opts) => {...})` block, lines 19-32), immediately after the existing `if (!opts.ctx.auth)` check.

Requires:

- `ctx.auth` to carry a `sessionId` (confirmed present on every real session — `AuthSession`/JWT payload structures already carry `sid`/`sessionId`)
- A way to look up that session's current `locked_at` value: either a fresh DB query per-request (matches the REST middleware's own approach; real per-request cost but consistent with existing pattern), or, if `ctx.auth`'s resolved shape already carries a locked boolean (not confirmed — check before assuming), reuse that instead of a new query.

### Error response format

tRPC has no native way to send raw HTTP 423 (`TRPCError`'s `code` field only supports fixed standard codes: UNAUTHORIZED, FORBIDDEN, etc.).

Recommended: `TRPCError({ code: 'UNAUTHORIZED', cause: 'SESSION_LOCKED' })`, following the existing `cause`-string precedent from `workflow.policy.ts`'s `canLogSecretariatDecision` (from a prior session's TASK-WF-FE-003), which throws `TRPCError({ code: 'FORBIDDEN', cause: 'secretariat_decision_wrong_office' })`. This gives the frontend a distinguishable signal without inventing a new tRPC error code. Alternative: plain `TRPCError({ code: 'UNAUTHORIZED', message: 'SESSION_LOCKED' })`. Choice must be stated explicitly in the PR description.

### Unlock path exclusion

The REST middleware excludes `request.url !== '/api/auth/unlock'` from the lock check. Since unlock is a REST endpoint, not tRPC, this exclusion should be automatic for the tRPC-side check (no tRPC procedure should need to bypass it, since unlocking doesn't go through tRPC at all) — but this must be confirmed to hold for whichever implementation shape is chosen, not assumed.

---

## Part 2 — Frontend: Idle Warning, Lock Screen, Unlock Flow

Three coupled pieces, built together.

### 2a. Idle timer + 25-minute warning (B5 §4.4)

New hook: `apps/web/src/hooks/useIdleTimer.ts`

- Monitors keyboard/mouse/touch events (touch matches "keyboard/mouse events" language loosely; adding touch for tablet use in a government-office context is a reasonable, uncontradicted addition — discretionary)
- At 25 minutes of no detected activity, surface a warning modal
  - Check whether `useModalStore` (F2 §6) already exists as the established home for modal open/closed state, per this codebase's Zustand/TanStack Query boundary rule
  - If `useModalStore` doesn't exist yet, local component-level state is an acceptable fallback for this one modal — document which was chosen
- Warning offers two actions:
  - **"I'm still here"** — per B5 §4.4's note that "the frontend sends a keepalive request ... when the user resumes activity," this should simply make ANY authenticated request. `iam.middleware.ts`'s Hook 4 (`updateLastActivity`) already runs on every authenticated REST request; once Part 1 is implemented, it should also run for tRPC requests if it doesn't already. Check whether it currently does before assuming a new dedicated "keepalive" endpoint is needed — B5's phrase "designated endpoint" does not necessarily mean a NEW endpoint; any lightweight existing authenticated call could satisfy this if Hook 4 already covers tRPC. **This should be resolved as part of Part 1's `req.auth` trace — the two questions likely resolve together.**
  - **"Lock now"** — triggers 2b immediately

### 2b. Lock screen

Triggered at 30 minutes total idle, OR on explicit user action (e.g. "Lock" item in Topbar's account menu):

- TASK-WF-FE-005's `AuthenticatedLayout`, if landed, has an `onUserMenuAction` prop currently supporting only `'profile' | 'logout'` per F5's spec — extend this union to include `'lock'` if it has landed, or build the menu item directly if it hasn't.

On trigger: call `POST /api/auth/lock` (plain fetch, matching `auth-context.tsx`'s or `useAuthActions.ts`'s existing fetch pattern for `/api/auth/login`). No request body needed (confirmed: bare `protectedApp.post` with no input schema in `iam.routes.ts`).

On success: render a full-screen lock overlay — **NOT a route change**. Underlying app state (in-progress work, scroll position, form state) must be preserved, not navigated away from. Show:

- Current user's display context (name/username — same source as TASK-WF-FE-005/006's `SidebarUser.name` resolution, if either has landed)
- Password-only re-entry field

**Do not show a full login form** (no username field, no PKCE flow). B5 §4.6 is explicit: "Re-authentication (password only; no full login flow)."

### 2c. Unlock

Submit calls `POST /api/auth/unlock` with `{ password }`.

Confirmed input schema (`iam.schemas.ts` lines 18-20): `UnlockInputSchema = z.object({ password: z.string().min(1) })`

Confirmed response handling (`iam.routes.ts` lines 288-367):

| Case                                                             | Response                                                                                                                      | Frontend behavior                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success                                                          | `{ unlocked: true }`, 200                                                                                                     | Dismiss overlay, resume normal app state. No reload/re-navigation — underlying page was never unmounted.                                                                                                                                                                                                                                                                      |
| Wrong password                                                   | 401 `{ code: 'INVALID_PASSWORD' }`                                                                                            | Show inline "incorrect password" error, keep overlay up, allow retry. Note: this same code is used for both a missing credential row and a failed argon2 verify — the backend deliberately does not distinguish these to avoid a user-enumeration signal; the UI must not attempt to distinguish them either.                                                                 |
| Refresh token invalid (expired past 14 days, revoked, or reused) | 401 `{ code: 'REFRESH_REQUIRED', message: "Your session has expired. Please log in again." }` (`iam.routes.ts` lines 337-340) | Do NOT retry via the lock overlay. Redirect to `/login` (once TASK-WF-FE-004 has landed; if not, redirect to the eventual login route, or use a full page reload to `/` as a documented interim fallback). Note: this response includes a server-side `clearAuthCookies(reply)` call (line 338) — cookies are already cleared by the time this response reaches the frontend. |

**Silent refresh note (per ADR-AUTH-010 and `unlockSession`'s implementation, `apps/server/src/modules/iam/iam.service.ts` lines 1020-1030):** if the access token had expired, a silent refresh happens transparently inside a successful unlock. The frontend does not need to detect or handle this specially — a 200 `{ unlocked: true }` response means the frontend can proceed as though nothing about token freshness needed handling. This is B5 §4.6's and ADR-AUTH-010's explicit design intent ("invisible to them"). **Caveat:** the full response shape beyond `{ unlocked: true }` was not fully re-verified past line 1050 of `unlockSession` in the source session — check the remainder of the implementation before assuming the success response contains nothing else.

---

## Cross-Tab/Device Lock Detection

A session can become locked two ways:

1. The current tab locks it (2b handles this directly — the tab that called `/api/auth/lock` already knows to show the overlay)
2. A **different tab or device** locked the same session. Sessions are server-side state, not per-tab; nothing in B5 or the schema ties a session to a single browser tab.

If a tab that did NOT itself trigger the lock makes a tRPC call against an already-locked session, Part 1's new check rejects it with the `SESSION_LOCKED`-cause error. This tab's frontend needs a **global handler** — a tRPC error link / `onError` interceptor (check `apps/web/src/lib/trpc.ts`'s existing client setup for the right insertion point) — that recognizes this specific error and shows the same lock overlay from 2b reactively, rather than letting it surface as a generic failed-query toast.

This is a required case, not optional. 2b must not be built as something only reachable via the Topbar "Lock" menu item.

---

## Non-Goals (Do Not Build)

- **Step-up (re-)authentication for high-risk actions** — explicitly deferred to Phase 2 by both B5 §4.6 and ADR-AUTH-010. No "confirm your password before approving this document" style challenge.
- **A "maximum session age" hard ceiling shorter than the 14-day refresh token lifetime** — explicitly NOT adopted by ADR-AUTH-010. Do not add one as an incidental "safety improvement."
- **Any change to the REST `/api/auth/lock`, `/api/auth/unlock` route handlers or the argon2/password-verification logic inside `unlockSession`** — all confirmed correct and complete. Part 1 only extends WHERE the `locked_at` check runs (tRPC's path too), not the check's logic or the unlock service's implementation.
- **A new dedicated "keepalive" REST/tRPC endpoint** — do not build before confirming one is actually needed. Trace Hook 4's actual tRPC coverage first (Part 1's investigation); only build a new endpoint if that trace confirms no existing authenticated call would serve the purpose.

---

## Deliverable Checklist

1. Part 1: locked-session check extended to cover tRPC requests (shape a or b), with the "what currently populates `req.auth` for tRPC" question traced and documented (code comment and/or PR description), not assumed.
2. Confirmation (from the same trace) of whether Hook 4's `updateLastActivity` already covers tRPC requests or needs the same extension as Part 1's locked check — if it needs the fix, apply it in the same PR (identical wiring gap).
3. `apps/web/src/hooks/useIdleTimer.ts` — 25-minute warning, 30-minute auto-lock (or a justified variant of these numbers if they don't survive contact with implementation — document any deviation explicitly).
4. Lock screen overlay component (not a route) — full-screen, password-only, preserves underlying app state.
5. Unlock flow wired to `POST /api/auth/unlock` with all three response cases (success, INVALID_PASSWORD, REFRESH_REQUIRED) handled per their confirmed shapes.
6. Global tRPC error interceptor recognizing the SESSION_LOCKED signal from Part 1, showing the lock overlay reactively for the different-tab/device case.
7. Topbar's `onUserMenuAction` extended to include `'lock'` (if TASK-WF-FE-005 has landed) or an equivalent manual-lock trigger built directly (if it hasn't).
8. PR description must state explicitly:
   - (a) which Part 1 implementation shape was chosen (a vs. b) and why
   - (b) what was found to actually populate `req.auth` for tRPC requests today
   - (c) whether Hook 4/`updateLastActivity` needed the same tRPC-coverage fix
   - (d) the `useModalStore`-vs-local-state choice for the idle-warning dialog
   - (e) confirmation this task did not touch the REST lock/unlock handlers' own logic, only tRPC's enforcement path
9. A findings-log entry (next free LOG number — verify against the log's actual current tail before writing; do not trust any number quoted elsewhere) documenting the tRPC-enforcement-gap discovery from Part 1 as the primary finding, status: proposed.

---

# TASK-WF-BE-004 — Add `.output()` Zod Schema to `recordAttendance`

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

# TASK-WF-FE-007-A — Part 1 (Backend)

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

# TASK-WF-FE-007-B — Part 2 (Frontend)

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

# STANDALONE PROMPT — TASK-WF-FE-007-C: Formalize `app.ts` session-lock enforcement, resolve the RLS/pooling question, and rebuild the frontend lock/idle-timer flow against the real HTTP 423 contract

```
═══════════════════════════════════════════════════════════════
CONTEXT — READ THIS FULLY BEFORE STARTING. THIS SUPERSEDES TWO
EARLIER PROMPTS (TASK-WF-FE-007-A, TASK-WF-FE-007-B). DO NOT FOLLOW
THOSE EARLIER PROMPTS' Step 2/Step 3 (Part A) OR ITS 401-BASED
ASSUMPTIONS (Part B) — THEY DESCRIBE A CONTRACT THAT WAS NOT BUILT
AND HAS BEEN SUPERSEDED BY THIS PROMPT.
═══════════════════════════════════════════════════════════════

This is a TypeScript monorepo (Fastify, tRPC v11.18, Drizzle ORM,
PostgreSQL) for a Philippine city government document management
system. You have live, direct access to the repository.

BACKGROUND — what actually happened, confirmed by direct repo
inspection immediately before this prompt was written:

TASK-WF-FE-007-A originally specified adding native `locked_at` and
inactivity checks directly inside tRPC's `protectedProcedure`
(`apps/server/src/trpc/trpc.ts`), signaling a locked session as a
tRPC `UNAUTHORIZED` error with `message: 'SESSION_LOCKED'` (raw HTTP
401). That specific mechanism was never built — `protectedProcedure`
in that file is unmodified from its pre-task baseline (confirmed:
no session lookup, no locked_at check, no inactivity check, no
SESSION_LOCKED message anywhere in it).

TASK-WF-FE-007-A's Step 1 (consolidating the two `protectedProcedure`
definitions into one, deleting the root-level `apps/server/src/trpc.ts`,
repointing `audit.router.ts`'s import) WAS completed correctly — confirmed:
`apps/server/src/trpc.ts` does not exist; `audit.router.ts` line 5 imports
`{ router, protectedProcedure }` from `'../../trpc/trpc.js'`; no
`ctx.session` references remain anywhere in the codebase. Do not redo
this work. Do not touch this again unless you find it's been reverted —
if you find it has been reverted, STOP and report that before doing
anything else in this prompt, since that would mean something more
has changed than this prompt accounts for.

Instead of building the native tRPC check, `app.ts` was modified to wrap
the EXISTING REST-side `authMiddlewarePlugin` (the same plugin/hook chain
that already protects `/api/auth/lock`, `/api/auth/logout`,
`/api/admin/sessions/:id/terminate`) around the entire tRPC route
registration. Confirmed, `apps/server/src/app.ts` lines 125-139:

  await fastify.register(async (trpcApp) => {
    const { authMiddlewarePlugin } = await import('./modules/iam/iam.middleware.js');
    await trpcApp.register(authMiddlewarePlugin);

    await trpcApp.register(fastifyTRPCPlugin, {
      prefix: '/api/trpc',
      trpcOptions: { router: appRouter, createContext, onError: ... },
    });
  });

This means `authMiddlewarePlugin`'s full four-hook chain (verifyAccessToken,
loadDelegationContext, setDatabaseSessionVars, updateLastActivity) —
confirmed at `apps/server/src/modules/iam/iam.middleware.ts` lines 359-367 —
now runs on every tRPC request, as a Fastify preHandler, BEFORE
`fastifyTRPCPlugin`'s own request handling ever begins. Because this is a
Fastify-level preHandler and not something tRPC's batch-processing logic
is aware of, this happens once per HTTP request regardless of whether that
request is a single tRPC call or an `httpBatchLink`-coalesced batch of
several — confirmed no `preHandler`/`onRequest` hooks exist anywhere that
would cause per-tRPC-call (rather than per-HTTP-request) re-execution.

A locked session (confirmed, `iam.middleware.ts` line 170-171) produces:

  if (session.locked_at !== null && request.url !== '/api/auth/unlock') {
    return reply.code(423).send({ code: 'SESSION_LOCKED', message: 'Session is locked' });
  }

This is a bare `reply.code().send()` call from inside a Fastify
preHandler — it terminates the request before `fastifyTRPCPlugin`'s
handler, and therefore before tRPC's own batch-array response
construction, ever runs. The response body is the flat object shown
above, NOT wrapped in a JSON array, NOT wrapped in tRPC's
`{ result: {...} } | { error: {...} }` envelope — this holds true
regardless of whether the original request was a single call or an
`httpBatchLink`-coalesced multi-call batch, because the entire request
is rejected as one unit before tRPC ever sees it. [Inference, reasoned
from Fastify's documented preHandler-runs-before-route-handler lifecycle
and from direct reading of iam.middleware.ts and app.ts — NOT yet
empirically confirmed against a running instance with a real multi-call
batch. Step 1 of this prompt requires you to confirm this directly
before writing any frontend code against it.]

This project's decision-maker (Luke) has reviewed this discovery and
made a decision: KEEP the `app.ts` wrapping as the permanent, intended
mechanism. Do not revert it. Do not additionally build a second,
tRPC-native `locked_at`/inactivity check inside `protectedProcedure` —
that would create two independent enforcement points for the same rule,
which is the same category of problem TASK-WF-FE-007-A's Step 1 was
originally written to eliminate (there, two `protectedProcedure`
definitions; here, it would be two lock-check implementations). One
enforcement point, in `app.ts`/`iam.middleware.ts`, is correct and final.

This decision was made specifically because the wrapping approach reuses
already-tested REST-side logic rather than duplicating the check in a
second place, and because it incidentally also closes a separate,
previously-unaddressed gap: Hook 3 (`setDatabaseSessionVars`) — which
sets PostgreSQL session-local GUC variables used by RLS policies — now
also runs on tRPC requests, which it never did before (confirmed via
repo-wide grep: no tRPC procedure or `createContext` ever independently
set these vars; tRPC-originated queries previously ran with NO RLS
session context set at all). The tradeoff accepted knowingly: the
resulting error shape (423, flat JSON, no tRPC envelope) is foreign to
tRPC's normal client-side error-handling conventions and requires the
frontend to detect and parse it differently than a standard tRPC error.
This prompt's job is to build that frontend handling correctly, and to
resolve one specific open question about whether Hook 3's benefit is
actually reliable (see Step 0 below) before this is treated as fully
settled.

═══════════════════════════════════════════════════════════════
STEP 0 — MANDATORY FIRST: EMPIRICALLY RESOLVE THE CONNECTION-POOLING /
RLS QUESTION BEFORE DOING ANYTHING ELSE IN THIS PROMPT
═══════════════════════════════════════════════════════════════

This question is NOT new to this prompt or to the tRPC change — it is a
pre-existing question about whether the REST path's RLS enforcement
via Hook 3 has ever actually been reliable. It is being surfaced now
because the tRPC wrapping newly exposes tRPC-originated queries to
whatever this behavior actually is, and because this prompt's design
decision (Step 0 background above) was partly justified by Hook 3 now
covering tRPC traffic too — a justification that only holds if Hook 3
actually works.

**The concern, precisely:** `apps/server/src/infrastructure/database.plugin.ts`
constructs a single `postgres(env.DATABASE_URL_APP)` client (confirmed,
line 38) with no `max` option specified, meaning it uses the `postgres-js`
library's default connection pool size (NOT a single connection — no
`max: 1` or equivalent is configured anywhere in this codebase, confirmed
via grep of `env.ts` and this file). This client is decorated once onto
`fastify.db` (line 41) and shared by both `iam.middleware.ts`'s Hook 3
(`this.db.execute(sql\`SELECT set_config(..., true) ...\`)`, using
`is_local=true` for `SET LOCAL` semantics) and every downstream
query run via `ctx.db` inside procedure bodies.

`SET LOCAL` (via `set_config(..., true)`) only persists for the duration
of the CURRENT TRANSACTION on the CONNECTION that executed it. If Hook 3's
`db.execute()` call and a subsequent query inside a procedure body are
each independently checked out from the pool (rather than explicitly
sharing one transaction/connection across the whole request), they could
run on two different physical connections — meaning the session vars set
by Hook 3 would never actually be visible to the later query, and any
RLS policy gated on `current_setting('app.current_office_id')` etc. would
silently evaluate against an unset (NULL) GUC rather than the intended
value, for that later query.

**What "correct" behavior would fail-closed to:** per Hook 3's own doc
comment (`iam.middleware.ts` lines 282-289), a NULL `app.current_office_id`
causes RLS policies to exclude rows (fail-closed) rather than error —
so if this IS happening, the practical symptom would likely be
over-restrictive results (a user seeing fewer rows than they should,
or seemingly-empty results) rather than a crash or an obvious security
hole in the "leaking data" direction. This makes it a class of bug that
is easy to miss in casual manual testing (a mostly-empty list might just
look like "no documents yet" rather than "RLS is silently discarding
everything") — do not treat the absence of an obvious symptom as
confirmation this isn't happening.

**Action required — in this order:**

1. Read `postgres-js`'s actual behavior for `is_local=true` `set_config`
   calls executed via a bare `.execute()` outside an explicit
   `db.transaction(...)` block, specifically regarding whether a single
   `.execute()` call implicitly runs in its own auto-committed
   single-statement transaction (in which case the `SET LOCAL` value
   would be scoped to, and lost at the end of, that one statement,
   regardless of pooling) — this is a DIFFERENT and potentially even
   worse problem than the pooling question above: if this is what's
   happening, the session vars would never persist past Hook 3's own
   call, on ANY connection, pooled or not. Determine which of these two
   distinct failure modes (if either) is real: (a) vars lost after Hook
   3's own statement regardless of connection reuse, or (b) vars
   surviving Hook 3's statement but lost if a later query in the same
   request happens to land on a different pooled connection.

2. Empirically test this against a real running instance with real data
   set up to distinguish the two scenarios: create two offices, two
   users each scoped to a different office, seed at least one document
   in each office's scope. Log in as the office-A user, make a REST
   request that depends on RLS-scoped visibility (find an existing
   endpoint that queries a table with an office-scoped RLS policy —
   check `packages/database` migration files for `CREATE POLICY`
   statements referencing `app.current_office_id` to find one). Confirm
   the office-A user sees ONLY office-A's document, not office-B's. Run
   this multiple times in succession (at least 10 requests) to rule out
   the pooling question being concurrency-dependent (i.e., "happens to
   work" because the pool keeps handing back the same connection under
   low load) — if possible, fire several concurrent requests (e.g. via a
   quick script hitting the endpoint 10x in parallel) to increase the
   chance of exercising a genuinely different pooled connection if the
   pooling failure mode is real.

3. If you confirm RLS scoping is NOT working correctly (either failure
   mode from step 1): STOP. Do not proceed to Step 1 of this prompt. This
   is a security-relevant gap significantly bigger than session-lock UX,
   predates this task, and needs its own dedicated fix (likely: wrapping
   each request's full auth-context-dependent work, both Hook 3's
   set_config call AND all subsequent queries in that request, inside a
   single `db.transaction(...)` block, so they're guaranteed to share one
   connection — but do not implement that fix as part of this prompt
   without further direction, since it's a broader architectural change
   than what this prompt was scoped for). Report back with your empirical
   findings (which failure mode, if either, you confirmed) and stop.

4. If you confirm RLS scoping IS working correctly: proceed to Step 1.
   State explicitly in your PR description what you tested (the two-office
   setup, the number of requests, whether you tested concurrent requests)
   and the result. Do not simply state "it works" without describing the
   test — the whole point of this step is that a superficial test (one
   request, one connection, low concurrency) would not actually rule out
   the pooling failure mode, only the "lost immediately regardless of
   connection" failure mode.

Append a findings-log entry regardless of outcome (success or failure) —
see the FINDINGS LOG section near the end of this prompt for the required
entry for the `app.ts` decision itself; if you find a genuine problem in
this step, that is a SEPARATE, additional findings-log entry (not the one
described later in this prompt), since it is a different discovery
requiring its own record independent of whether you also completed the
rest of this task. Use the next free LOG number after whatever you find
the log's actual tail to be at that point — do not assume LOG-0099 is
free without checking, since other work may append entries between when
this prompt was written and when you execute it.

═══════════════════════════════════════════════════════════════
STEP 1 — CONFIRM THE 423 RESPONSE SHAPE EMPIRICALLY, INCLUDING THE
BATCHED-REQUEST CASE
═══════════════════════════════════════════════════════════════

Do this before writing any frontend code. The reasoning in this prompt's
background section about the 423 response bypassing tRPC's batch-array
envelope is labeled [Inference] — confirm it directly.

1. Start the dev server. Log in as a real user through the actual UI.
2. Navigate to a page that fires multiple simultaneous `useQuery` calls
   likely to batch together — `apps/web/src/pages/documents/DocumentDetailPage.tsx`
   is a confirmed example (fires 5 separate `useQuery` calls on mount:
   `documents.get`, `documents.getVersionHistory`, `tracking.getRoutingHistory`,
   `tracking.getTrackingRecord`, `workflow.getActiveInstanceForDocument` —
   confirmed at that file's lines 179, 186, 200, 206, 213). Open browser
   dev tools' Network tab, confirm these actually coalesce into one
   `POST /api/trpc/...` batched request (check the request URL — a batched
   `httpBatchLink` request typically includes multiple procedure paths
   joined in the URL, or check the request payload for an array of
   inputs) before proceeding — if they do NOT batch for some reason
   (e.g. a `batch: false` config was added somewhere this prompt's
   investigation missed, or some other reason), note that and adjust
   this test to find a page that does batch, since testing the batch
   case specifically is the point of this step.
3. In a SEPARATE tab or via `curl`/Postman with the same session's
   cookies, call `POST /api/auth/lock` to lock that session.
4. Reload the `DocumentDetailPage` (or otherwise re-trigger its batched
   query) in the original tab. Inspect the actual raw HTTP response in
   dev tools: status code, and the exact response body (view it as raw
   text/JSON, not through any parsed/formatted view that might mask
   whether it's an array or a flat object).
5. Confirm or correct this prompt's stated expectation: status 423,
   body is a flat JSON object `{ code: 'SESSION_LOCKED', message: 'Session
   is locked' }`, NOT a JSON array, NOT wrapped in a `result`/`error`
   tRPC envelope. If what you observe differs from this in ANY way
   (different status code, array-wrapped body, different field names,
   anything), STOP and report the actual observed shape before writing
   any of Step 2 or Step 3's frontend code — those steps are written
   against this specific, stated shape, and if it's wrong, the code
   needs to be adapted to match reality, not the other way around.

═══════════════════════════════════════════════════════════════
STEP 2 — REWRITE `apps/web/src/lib/trpc.ts`'S INTERCEPTOR FOR 423,
NOT 401
═══════════════════════════════════════════════════════════════

**Current confirmed content of this file (verify this is still accurate
before editing — re-view the file first, in case something has changed
since this prompt was written):**

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

This file is confirmed completely unmodified from this exact baseline as
of this prompt being written — TASK-WF-FE-007-B's originally-planned
changes to it were never made.

**What to change:** add a check for `response.status === 423`, evaluated
BEFORE the existing `response.status === 401` check (the two are
mutually exclusive status codes, so order between them doesn't functionally
matter, but checking 423 first reads more naturally given it's now the
primary lock-detection path this file needs to handle):

  async fetch(url, options) {
    const fetchOptions = { ...options, credentials: 'include' as const } as RequestInit;
    let response = await fetch(url, fetchOptions);

    if (response.status === 423) {
      // Locked session. This response bypasses tRPC's normal error
      // envelope entirely — it's a flat JSON object written directly by
      // a Fastify preHandler before fastifyTRPCPlugin's own request
      // handling runs, confirmed via apps/server/src/modules/iam/iam.middleware.ts
      // line 171 and apps/server/src/app.ts lines 125-139. Do NOT attempt
      // to parse this as a tRPC batch response — it is not one, whether
      // the original request was a single call or a batch of several.
      useSessionStore.getState().setIsLocked(true);
      return response;
    }

    if (response.status === 401) {
      const success = await performSilentRefresh();
      if (success) {
        response = await fetch(url, fetchOptions);
      } else {
        window.location.href = '/login';
      }
    }

    return response;
  }

Notes on this specific implementation, read before writing it:

- Do NOT call `response.clone().json()` to inspect the body before
  deciding what to do — Step 1's empirical test already establishes that
  423 uniquely and unambiguously means "locked session" in this codebase
  (confirmed: only one call site anywhere sends a 423, `iam.middleware.ts`
  line 171 — grep the codebase yourself to confirm no other 423 response
  exists anywhere before relying on this). The status code alone is a
  sufficient and simpler signal than parsing the body; parsing the body
  would only be necessary if 423 could mean more than one thing, which
  it currently does not. If your own grep finds a second 423 call site
  this prompt's investigation missed, STOP and report it — do not
  silently write body-parsing logic to disambiguate without flagging
  that the premise changed.
- `useSessionStore.getState()` is the correct way to reach the store from
  this module-level (non-component, non-hook) function — this matches the
  existing pattern already used for `performSilentRefresh` in this same
  file (a plain async function outside any component). You will need to
  import `useSessionStore` at the top of this file — confirm the correct
  import path (`@/stores/session.store` or `@/stores`, check which one
  the rest of this codebase's `lib/` files use for consistency — e.g.
  `apps/web/src/hooks/useAuthActions.ts` currently imports it via
  `'@/stores'`) before adding the import.
- Return the original `response` as-is after triggering the lock (do not
  retry, do not attempt any further handling) — the calling
  `useQuery`/`useMutation` will see a failed request, which is
  acceptable, since the lock screen will now be covering the UI and the
  underlying page's specific data does not need to have loaded
  successfully while locked.
- Do NOT change the existing `401` handling path's behavior in any way —
  it remains exactly as it was, for the genuinely separate case of an
  expired/invalid access token needing silent refresh.

═══════════════════════════════════════════════════════════════
STEP 3 — FIX `apps/web/src/lib/query-client.ts`'S RETRY LOGIC (NOT
COVERED BY EITHER EARLIER PROMPT — NEW FINDING FROM THIS PROMPT'S OWN
INVESTIGATION, VERIFY IT YOURSELF BEFORE TRUSTING IT)
═══════════════════════════════════════════════════════════════

**Current confirmed content:**

  import { QueryClient } from '@tanstack/react-query';
  import { isTRPCClientError } from '@trpc/client';
  import type { AppRouter } from 'server/src/trpc/root.js';

  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isTRPCClientError<AppRouter>(error) && error.data?.code === 'UNAUTHORIZED') {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  });

**The problem, and why the earlier plan document's "no change needed
here" conclusion for this file does not hold:** `isTRPCClientError<AppRouter>(error)`
checks whether `error` is specifically a `TRPCClientError` instance — the
type tRPC's client machinery constructs when it successfully parses a
tRPC-shaped error response (a JSON array/envelope it recognizes). A 423
response with a flat, non-tRPC-enveloped body will NOT produce a
`TRPCClientError` when it propagates up through `httpBatchLink` — it will
more likely cause tRPC's internal batch-response-parsing logic to throw
some other kind of error when it tries and fails to parse the flat object
as the array it expects. `isTRPCClientError` would evaluate `false` for
that thrown error, meaning it falls through to `return failureCount < 3`
— i.e., TanStack Query would retry the failing query up to 3 times by
default, even though Step 2's interceptor has already correctly
triggered the lock screen. This does not break the lock screen itself
(it's already showing, since `setIsLocked(true)` already ran inside the
`fetch` override, independent of what the query's own retry behavior
does afterward) but it does mean 2-3 unnecessary duplicate requests fire
against a session that's already known to be locked, each of which will
independently re-trigger Step 2's `setIsLocked(true)` call (harmless —
setting the same boolean to `true` repeatedly has no adverse effect —
but wasteful).

**Verify this reasoning yourself before implementing the fix** — put a
`console.log(error)` inside the `retry` function temporarily, trigger a
locked-session query, and inspect what the actual thrown `error` object
looks like and whether `isTRPCClientError` actually returns `false` for
it as this prompt predicts. If it turns out `isTRPCClientError` DOES
return `true` for this case (meaning tRPC's client is more lenient about
malformed responses than this prompt assumes), then no change is needed
here after all — but confirm this directly rather than trusting either
this prompt's reasoning or the earlier plan document's "no change needed"
conclusion at face value. State in your PR description which one you
found to be correct and how you confirmed it.

**If the problem is confirmed as this prompt describes, the fix:** since
the interceptor in Step 2 already handles setting `isLocked` and returns
the response without retrying at the fetch level, the simplest correct
fix is to also stop TanStack Query's own retry logic on ANY error while
`isLocked` is true, since the query is guaranteed to keep failing until
the user unlocks:

  import { QueryClient } from '@tanstack/react-query';
  import { isTRPCClientError } from '@trpc/client';
  import type { AppRouter } from 'server/src/trpc/root.js';
  import { useSessionStore } from '@/stores/session.store';

  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (useSessionStore.getState().isLocked) {
            return false;
          }
          if (isTRPCClientError<AppRouter>(error) && error.data?.code === 'UNAUTHORIZED') {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  });

Confirm the import path convention (`@/stores/session.store` vs `@/stores`)
matches this file's existing import style and the rest of the codebase's
convention before finalizing. Do not remove the existing
`isTRPCClientError`/`UNAUTHORIZED` check — that remains valid and
necessary for the separate, still-functioning 401/silent-refresh path;
this is an ADDITION, not a replacement.

═══════════════════════════════════════════════════════════════
STEP 4 — COMPLETE THE MISSING FRONTEND PIECES
═══════════════════════════════════════════════════════════════

The following were specified in TASK-WF-FE-007-B but were not built, or
were built differently than specified, confirmed by direct inspection
immediately before this prompt was written. None of these are affected
by the 401-vs-423 question — they are independent gaps.

--- 4a. Extract `lock`/`unlock` into `useAuthActions.ts` ---

Confirmed current state of `apps/web/src/hooks/useAuthActions.ts`:
exports only `{ login, logout }`. The `lock` action currently exists
ONLY as an inline `fetch` call inside `apps/web/src/hooks/useIdleTimer.ts`
(confirmed, lines 24-36 of that file). The `unlock` action currently
exists ONLY as an inline `fetch` call inside
`apps/web/src/pages/auth/SessionLockScreen.tsx`'s `handleUnlock`
function (confirmed, lines 17-55 of that file).

Move both into `useAuthActions.ts`, following the exact existing pattern
of `logout` (a `useCallback` with an empty dependency array, using
`import.meta.env.VITE_API_URL`, `credentials: 'include'`):

  const lock = useCallback(async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/lock`, {
      method: 'POST',
      credentials: 'include',
    });
    useSessionStore.getState().setIsLocked(true);
  }, []);

  const unlock = useCallback(async (
    password: string
  ): Promise
    | { ok: true }
    | { ok: false; code: 'INVALID_PASSWORD' | 'REFRESH_REQUIRED'; message?: string }
  > => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      useSessionStore.getState().setIsLocked(false);
      return { ok: true };
    }
    const data = await response.json().catch(() => ({}));
    if (data.code === 'REFRESH_REQUIRED') {
      return { ok: false, code: 'REFRESH_REQUIRED', message: data.message };
    }
    return { ok: false, code: 'INVALID_PASSWORD' };
  }, []);

  return { login, logout, lock, unlock };

Note this uses `setIsLocked(true)`/`setIsLocked(false)` — the actual
current action name on `useSessionStore`, confirmed at
`apps/web/src/stores/session.store.ts` line 28 (`setIsLocked: (locked:
boolean) => void`) — NOT `setLocked()`/`setUnlocked()` as
TASK-WF-FE-007-B's original text specified. The single-boolean-argument
version already exists and is already in use by `useIdleTimer.ts` and
`SessionLockScreen.tsx` — do not rename it to the two-zero-argument-action
version the earlier prompt described; that would require also updating
every existing call site, which is unnecessary churn for a naming
preference with no functional difference. Keep `setIsLocked` as-is.

Then update `useIdleTimer.ts` (remove its inline fetch, call `lock()`
from `useAuthActions()` instead) and `SessionLockScreen.tsx` (remove its
inline fetch, call `unlock()` from `useAuthActions()` instead, keeping
the same response-handling logic — success/`INVALID_PASSWORD`/
`REFRESH_REQUIRED` — that already exists and is already confirmed
correct in `SessionLockScreen.tsx`; only the fetch call itself moves,
not the logic around it).

Verify after this change: `useIdleTimer.ts` and `SessionLockScreen.tsx`
each import `useAuthActions` and destructure `lock`/`unlock` from it
respectively (in addition to whatever else they already import from it,
e.g. `SessionLockScreen.tsx` already imports `useAuthActions` for
`logout` — add `unlock` to that same destructuring, don't add a second
import).

--- 4b. Build the two-stage idle warning (25-min warning, 30-min
auto-lock) — currently only a single-stage 30-minute-flat timer exists ---

Confirmed current state: `useIdleTimer.ts` has ONE `setTimeout` at a
single `INACTIVITY_TIMEOUT_MS` (defaulting to 30 minutes via
`VITE_AUTH_SESSION_INACTIVITY_TIMEOUT_MS` env var) that calls
`handleLock` directly. No warning stage exists. No `IdleWarningModal.tsx`
file exists anywhere in the codebase (confirmed via find). `useUIStore`
(`apps/web/src/stores/ui.store.ts`) has no `idleWarningOpen` field or
related actions (confirmed via grep).

Rebuild `useIdleTimer.ts` with two timers instead of one:

  import { useEffect, useRef } from 'react';
  import { useSessionStore } from '@/stores/session.store';
  import { useUIStore } from '@/stores/ui.store';
  import { useAuthActions } from '@/hooks/useAuthActions';

  const WARNING_AT_MS = Number(
    import.meta.env['VITE_AUTH_SESSION_WARNING_MS'] || 25 * 60 * 1000
  );
  const LOCK_AT_MS = Number(
    import.meta.env['VITE_AUTH_SESSION_INACTIVITY_TIMEOUT_MS'] || 30 * 60 * 1000
  );

  export function useIdleTimer() {
    const identity = useSessionStore((state) => state.identity);
    const isLocked = useSessionStore((state) => state.isLocked);
    const { lock } = useAuthActions();
    const openIdleWarning = useUIStore((state) => state.openIdleWarning);
    const closeIdleWarning = useUIStore((state) => state.closeIdleWarning);

    const warningTimerRef = useRef<number | null>(null);
    const lockTimerRef = useRef<number | null>(null);

    useEffect(() => {
      if (!identity || isLocked) {
        if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
        if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
        warningTimerRef.current = null;
        lockTimerRef.current = null;
        return;
      }

      const resetTimers = () => {
        if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
        if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
        closeIdleWarning();
        warningTimerRef.current = window.setTimeout(() => {
          openIdleWarning();
        }, WARNING_AT_MS);
        lockTimerRef.current = window.setTimeout(() => {
          closeIdleWarning();
          void lock();
        }, LOCK_AT_MS);
      };

      const handleActivity = () => {
        resetTimers();
      };

      resetTimers();

      window.addEventListener('mousemove', handleActivity, { passive: true });
      window.addEventListener('mousedown', handleActivity, { passive: true });
      window.addEventListener('keydown', handleActivity, { passive: true });
      window.addEventListener('scroll', handleActivity, { passive: true });
      window.addEventListener('touchstart', handleActivity, { passive: true });

      return () => {
        if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
        if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('scroll', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
      };
    }, [identity, isLocked, lock, openIdleWarning, closeIdleWarning]);
  }

Note: `handleActivity` resetting BOTH timers on any detected activity
means that dismissing the warning by moving the mouse/typing implicitly
counts as "I'm still here" — this is intentional and matches typical
idle-timer UX (activity itself is evidence of presence), but the modal
also needs an explicit "I'm still here" BUTTON per the original spec,
for the case where the warning is showing and the user wants to
dismiss it via an explicit action without necessarily continuing
whatever mouse/keyboard activity triggered the warning's dismissal
implicitly — build both: implicit dismissal via any detected activity
(already covered by `resetTimers` inside `handleActivity` above) AND an
explicit button in the modal that calls the same `resetTimers`-equivalent
behavior. Since `resetTimers` is defined inside the `useEffect` closure
and not currently exposed outside it, you have two options: (a) lift
`resetTimers` out of the effect and expose it via the hook's return value
so `IdleWarningModal` can call it directly, or (b) have the "I'm still
here" button simply call `closeIdleWarning()` and separately make a
lightweight authenticated request (see below) whose success naturally
counts as activity — but only if that request path itself flows through
something `handleActivity`'s listeners would observationally catch
(a `fetch()` call does NOT fire any of the mousemove/mousedown/keydown/
scroll/touchstart events being listened for, so option (b) as stated
would NOT actually reset the timers, only close the warning modal,
leaving the lock timer still counting down toward LOCK_AT_MS from
whenever it was last actually reset by real user interaction). Choose
option (a) — lifting `resetTimers` out and exposing it — since option
(b) as naively described does not actually achieve the stated goal.
State which option you implemented and confirm your reasoning for why in
your PR description, since this is a subtle enough interaction that it's
worth demonstrating you traced it through rather than assumed it works.

Build `apps/web/src/components/IdleWarningModal.tsx` using the `Dialog`
primitive from `@batac/ui` (confirmed to exist at
`packages/ui/src/components/ui/dialog.tsx`), wired to `useUIStore`'s new
`idleWarningOpen` state:

- "I'm still here" button: calls the lifted `resetTimers` function (per
  the option-(a) resolution above) AND makes one lightweight
  already-authenticated tRPC query call to reset server-side activity
  tracking — check `iam.router.ts` for the lightest-weight existing query
  procedure available (do not create a new dedicated keepalive endpoint).
  Note: per this prompt's Step 3 addition, if `isLocked` were somehow
  true when this fires, the query would be blocked by the new retry
  guard — but this button is only reachable while the warning modal is
  open, which only happens while NOT locked, so this should not be a
  live concern; note it in your PR description as a check performed
  rather than an assumption.
- "Lock now" button: calls `closeIdleWarning()`, then `lock()` (from
  `useAuthActions()`).

Add to `apps/web/src/stores/ui.store.ts` (confirmed current shape:
`sheetOpen`, `sheetDocId`, `dialogOpen`, `dialogDocId`, `paletteOpen`,
`toast`, plus their actions — this store currently has ZERO consumers
anywhere in `apps/web/src`, confirmed via grep, so you are its first real
user; follow its exact existing `openX`/`closeX` boolean pattern, e.g.
matching `paletteOpen`/`openPalette`/`closePalette`, since there's no
associated ID needed, unlike `sheetOpen`/`dialogOpen`):

  idleWarningOpen: boolean;
  openIdleWarning: () => void;
  closeIdleWarning: () => void;

Mount `<IdleWarningModal />` inside `AuthenticatedLayout.tsx`, as a
sibling to the existing `{isLocked && <SessionLockScreen />}` line
(confirmed at line 229) — e.g. `{isLocked && <SessionLockScreen />}
<IdleWarningModal />` (the modal's own `open` prop, wired to
`idleWarningOpen`, controls its own visibility, so it doesn't need the
same conditional-render guard `SessionLockScreen` uses).

--- 4c. Add the Topbar "Lock" menu item — currently does not exist at
all ---

Confirmed current state of `packages/ui/src/components/domain/Topbar.tsx`
line 24: `onUserMenuAction?: (action: "profile" | "logout") => void;` —
no `"lock"` member. Only two `onClick` buttons exist (profile, logout) —
confirmed no third button anywhere in the file.

Change line 24 to:

  onUserMenuAction?: (action: "profile" | "logout" | "lock") => void;

Add a third button, matching the existing two buttons' structure
(confirmed pattern at lines ~148-161 of the current file — read that
exact block yourself before writing this, since line numbers may have
drifted since this prompt was written):

  <button
    type="button"
    onClick={() => onUserMenuAction?.("lock")}
    className="w-full text-left px-2 py-1.5 text-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary rounded-md transition-colors touch-exempt"
  >
    Lock
  </button>

Place it between the existing "Profile" and "Logout" buttons.

Then, in `apps/web/src/components/AuthenticatedLayout.tsx`, extend the
`onUserMenuAction` handler (confirmed current state, lines 217-223):

  onUserMenuAction={(action) => {
    if (action === 'logout') {
      void logout();
    } else if (action === 'profile') {
      // No-op per F1 specification - no profile page exists yet.
    }
  }}

to:

  onUserMenuAction={(action) => {
    if (action === 'logout') {
      void logout();
    } else if (action === 'lock') {
      void lock();
    } else if (action === 'profile') {
      // No-op per F1 specification - no profile page exists yet.
    }
  }}

`lock` needs to be destructured from `useAuthActions()` in this file —
confirmed this file currently destructures only `{ logout }` from it
(line 66); add `lock` to that same destructuring.

**Note on task routing (carried forward from the original prompt,
still applicable):** `Topbar.tsx` lives in `packages/ui`, which per this
project's `AGENTS.md` Section 2 routing table falls under Tier 3 domain
component rules, including the requirement that every Tier 3 PR include
a `/dev/{component-name}` dev route as a mandatory deliverable. Check
whether `/dev/components/topbar` (if it exists — search for it, e.g. via
`main.tsx`'s route definitions) already exercises `onUserMenuAction`'s
states; if so, verify the new `'lock'` action's button renders correctly
there too. If no such dev page exists, or it exists but doesn't cover
`onUserMenuAction`, flag this as a gap in your PR description rather than
building out full dev-page coverage as part of this prompt — that would
be a scope expansion beyond what this prompt asks for.

--- 4d. Confirm the cross-tab detection path now actually works ---

This is not new code beyond Steps 2-3 above — it's verification that the
combination of Step 2's interceptor change and the existing
`{isLocked && <SessionLockScreen />}` rendering in
`AuthenticatedLayout.tsx` actually produces the intended cross-tab
behavior end-to-end. Test: open the app in two separate browser tabs,
logged in as the same user in both. In Tab A, click the new "Lock" menu
item (built in 4c). In Tab B, without manually locking anything, trigger
any tRPC query (e.g. navigate to a new page, or wait for an existing
page's query to refetch/poll if applicable). Confirm Tab B's lock screen
appears automatically, without requiring a manual page reload in Tab B.

═══════════════════════════════════════════════════════════════
NON-GOALS — DO NOT DO ANY OF THE FOLLOWING
═══════════════════════════════════════════════════════════════

- Do not build a native tRPC-side `locked_at`/inactivity check inside
  `protectedProcedure`. This was the original TASK-WF-FE-007-A Step 2
  design; it has been explicitly superseded by the `app.ts` wrapping
  decision described in this prompt's background section. Building both
  would create duplicate enforcement — do not do this.
- Do not revert or modify `app.ts`'s lines 125-139 wrapping, unless Step
  0 of this prompt reveals a genuine problem requiring it (in which case,
  stop and report per Step 0's own instructions — do not silently revert
  it as a workaround).
- Do not touch `iam.middleware.ts`'s actual lock/inactivity check logic
  (lines 167-194) — this is confirmed correct, tested (via the REST
  path, which has presumably exercised it already), and unrelated to
  this prompt's frontend-focused scope, EXCEPT for whatever Step 0 might
  require if a genuine RLS/pooling problem is found there (and even
  then, per Step 0's own instructions, that's a "stop and report,"
  not a "fix it yourself as part of this prompt," outcome).
- Do not add step-up (re-)authentication for high-risk actions —
  explicitly deferred to Phase 2 per B5 §4.6 and ADR-AUTH-010 (per the
  original TASK-WF-FE-007-A/B context).
- Do not attempt to distinguish the two reasons `INVALID_PASSWORD` can
  occur — confirmed the backend already sends an identical response
  `{ code: 'INVALID_PASSWORD' }` with NO `message` field for both
  underlying reasons (missing credential row vs. wrong password,
  confirmed at `iam.service.ts` lines 1008-1028 and the route handler at
  `iam.routes.ts` line 341, which omits `message` entirely for this
  case). `SessionLockScreen.tsx`'s existing `throw new Error(data.message
  || 'Invalid password')` on line 44 already produces the correct
  generic message as an emergent property of the backend never sending
  a `message` for this case — this is confirmed correct behavior, do not
  change it, but do not assume it's robust against a FUTURE backend
  change that might add a `message` field for some other reason; that's
  a risk to note in your PR description, not something to fix now.
- Do not build any new keepalive REST/tRPC endpoint for the "I'm still
  here" action — use an existing lightweight authenticated query.
</br>
═══════════════════════════════════════════════════════════════
FINDINGS LOG — TWO SEPARATE POTENTIAL ENTRIES
═══════════════════════════════════════════════════════════════

Check `docs/development-findings-log.md`'s actual current tail before
writing either entry — do not assume specific numbers without checking,
since other work may append entries between when this prompt was written
and when you execute it. As of this prompt being written, the log's
highest entry is LOG-0098, making LOG-0099 the next free number — but
verify this yourself.

**Entry 1 (required regardless of Step 0's outcome):** formalizing the
`app.ts` wrapping decision as the final, intended session-lock
enforcement mechanism for tRPC — noting that TASK-WF-FE-007-A's
originally-specified native tRPC check (Step 2 of that task) was
superseded by this decision and was never built, that this decision was
made by Luke after review, and cross-referencing LOG-0097 (which
documented the original discovery of the gap this decision resolves).

**Entry 2 (only if Step 0 finds a genuine problem):** a separate entry
documenting whatever Step 0 actually found about the connection-pooling/
RLS question — do not fold this into Entry 1, since it's a distinct
discovery with its own significance regardless of whether this prompt's
other steps are completed.

Label both `status: proposed`, per every agent-authored entry in this
log. Do not set `status: confirmed` yourself.

═══════════════════════════════════════════════════════════════
BEFORE SUBMITTING THIS PR, CONFIRM EACH ITEM:
═══════════════════════════════════════════════════════════════

- [ ] Step 0 was performed, its result (RLS/pooling working correctly,
      or a genuine problem found) is stated explicitly in the PR
      description, and if a genuine problem was found, you stopped
      there per Step 0's own instructions rather than proceeding.
- [ ] Step 1's empirical confirmation of the 423 response shape
      (including the batched-request case) was performed, and its
      result is stated in the PR description — including confirmation
      that a genuinely batched request (not just a single call) was
      tested.
- [ ] `lib/trpc.ts` checks `response.status === 423` and correctly
      triggers `setIsLocked(true)` without attempting to parse the
      response as a tRPC batch envelope.
- [ ] `query-client.ts`'s retry logic was investigated per Step 3's
      instructions (console.log verification of the actual thrown error
      shape), and either fixed (if the problem was confirmed) or
      explicitly noted as unnecessary (if `isTRPCClientError` turned out
      to already handle this case) — with the reasoning stated either
      way, not just the conclusion.
- [ ] `lock`/`unlock` moved into `useAuthActions.ts`; `useIdleTimer.ts`
      and `SessionLockScreen.tsx` updated to call them from there instead
      of their own inline `fetch` calls.
- [ ] `useIdleTimer.ts` rebuilt with two separate timers (25-min warning,
      30-min lock), with the "I'm still here" button's timer-reset
      behavior implemented via the lifted-`resetTimers` approach (option
      (a) from Step 4b), not the non-functional option (b).
- [ ] `IdleWarningModal.tsx` created and wired to `useUIStore`'s new
      `idleWarningOpen` state, mounted inside `AuthenticatedLayout.tsx`.
- [ ] `Topbar.tsx`'s `onUserMenuAction` union extended to include
      `'lock'`; a third "Lock" button added between "Profile" and
      "Logout"; `AuthenticatedLayout.tsx`'s handler extended to call
      `lock()` for that action.
- [ ] Cross-tab lock detection manually tested end-to-end (two tabs, lock
      in one, confirm the other shows the lock screen without a manual
      reload) and the result stated in the PR description.
- [ ] `/dev/components/topbar`'s coverage of `onUserMenuAction` checked;
      either confirmed adequate, updated if it was a small addition, or
      explicitly flagged as a gap rather than silently expanded into.
- [ ] Finding-log Entry 1 appended (formalizing the `app.ts` decision);
      Entry 2 appended if Step 0 found a genuine problem.
- [ ] PR description states explicitly, as separate line items: (a)
      Step 0's result, (b) Step 1's result, (c) whether Step 3's
      `query-client.ts` problem was confirmed real or not and how you
      checked, (d) confirmation the cross-tab test passed, (e)
      confirmation no native tRPC-side lock check was added alongside
      the existing `app.ts` mechanism.

A reviewer will verify each one independently.
```

---

# TASK-IAM-041 — Investigate and Fix Hook 3 (`setDatabaseSessionVars`) RLS Session-Variable Persistence Gap

```
CONTEXT — READ THIS FIRST

Read AGENTS.md before doing anything else if you have not already internalized
it this session. This task's row union: "Implement RLS policies" (C3 → C1 →
I1) plus, because the fix touches request-lifecycle plumbing rather than a
policy definition itself, read iam.middleware.ts and database.plugin.ts
directly as primary sources — no pre-dev document describes this specific
request-scoped-connection problem, since it is a runtime/implementation
question of the kind AGENTS.md Section 4 describes as "not answerable by any
pre-development document."

Also read docs/development-findings-log.md's entry [LOG-0100] in full before
starting — it is the finding this task exists to resolve, written by an
earlier session. Do not re-derive its reasoning from scratch; verify it
against the current repo state (this task's Step 0) and build on it.

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS

setDatabaseSessionVars (apps/server/src/modules/iam/iam.middleware.ts,
function body at lines 297-326, confirmed by direct read this session) sets
six PostgreSQL session-local GUC variables via:

  await this.db.execute(sql`
    SELECT
      set_config('app.current_user_id',   ${auth.userId},   true),
      set_config('app.current_office_id', ${auth.officeId}, true),
      set_config('app.city_id',           ${auth.cityId},   true),
      set_config('app.current_role_tier', ${roleTier},      true),
      set_config('app.is_ita',            ${String(auth.isItAdmin)},      true),
      set_config('app.is_pa',             ${String(auth.isPlatformAdmin)}, true)
  `);

All six calls use is_local=true (SET LOCAL semantics — PostgreSQL discards
these values when the current transaction ends). This is a bare, standalone
db.execute() call — no db.transaction() wrapper, no connection pinning.

This function runs as a Fastify preHandler hook (registered at
iam.middleware.ts lines 361-364, part of the four-hook chain inside
authMiddlewarePlugin) on every protected REST request AND, since a recent
change (apps/server/src/app.ts lines 125-139, confirmed this session — wraps
authMiddlewarePlugin around the entire tRPC route registration), every tRPC
request as well.

LOG-0100 (status: proposed, not yet human-confirmed) documents a prior
session's finding: because db.execute() runs via drizzle-orm/postgres-js in
auto-commit mode, each statement is its own implicit transaction that commits
immediately, discarding the SET LOCAL values before any subsequent query in
the same request can observe them. LOG-0100's own empirical test (a psql
session: set_config(...) in one statement, current_setting(...) in a separate
statement, returns NULL) supports this, though the entry itself notes the
dev database's near-zero row counts mean this cannot be fully distinguished
from "no data exists" through application-level testing alone.

CONFIRMED IMPACT (independently re-verified this session, not just LOG-0100's
own claim): documents.documents has RLS enabled (migration 0004, line 435)
with a FOR SELECT-only policy (documents_office_isolation, lines 439-444)
comparing owned_by_office_id against
current_setting('app.current_office_id', true)::uuid. No FORCE ROW LEVEL
SECURITY exists on this table (confirmed: zero matches for that string
anywhere under packages/database/migrations/). batac_app has no BYPASSRLS
(confirmed: tools/db/init/01-create-roles.sh line 64 creates it with WITH
LOGIN only). iam.sessions has an equivalent FOR SELECT-only RLS policy
(migration 0002, line 233, sessions_own_or_admin). If the GUC values are
genuinely lost as LOG-0100 claims, every SELECT against these two tables
through batac_app runs with the relevant current_setting(...) call returning
NULL, and — per PostgreSQL's NULL-comparison rules — the policy's USING
clause evaluates to NULL/false, excluding all rows. This is a fail-closed
gap (wrongly denying legitimate reads), not a cross-tenant data leak, because
the affected policies are SELECT-only — they do not gate INSERT/UPDATE/DELETE
the same way. Still confirm this precisely for your own fix rather than
assuming from this summary; the severity characterization matters for how
you report your results (Step 4).

────────────────────────────────────────────────────────────────────────────
STRUCTURAL FACTS CONFIRMED THIS SESSION — READ BEFORE DESIGNING YOUR FIX

These bound the design space and were traced directly, not inferred from
LOG-0100's prose:

1. apps/server/src/infrastructure/database.plugin.ts line 38-41: a SINGLE
   postgres(env.DATABASE_URL_APP) client and a single drizzle(client)
   instance are constructed once, at plugin-registration time
   (databasePlugin runs once at server startup, not per-request), and
   decorated onto the Fastify instance as fastify.db. This is the same `db`
   Hook 3 calls via `this.db`.

2. apps/server/src/trpc/trpc.ts line 9: createContext reads
   `db: (req.server as any).db as AppDb` — i.e., EVERY tRPC procedure's
   ctx.db is this same single, un-transactioned, app-lifetime Drizzle
   instance. createContext runs AFTER all four preHandler hooks complete
   (Fastify request lifecycle: preHandlers, then the route/adapter handler).
   There is no mechanism today by which a transaction opened inside Hook 3
   could reach ctx.db for the procedure that runs afterward in the same
   request — Hook 3's transaction, if you added one, would go out of scope
   the moment Hook 3's own async function returns, before createContext
   ever runs.

3. apps/server/src/modules/documents/documents.plugin.ts lines 42-48: this
   is representative of the REST-side pattern too — `const db = fastify.db`
   is read ONCE at plugin-registration time and closed over by long-lived
   service/repository objects (`new DocumentsRepository(db)`) for the
   server's entire lifetime, not re-acquired per-request. This is NOT a
   per-request handle either.

4. db.transaction(async (tx) => {...}) IS a well-established pattern
   elsewhere in this codebase (12 non-seed source files use it, e.g.
   apps/server/src/modules/iam/iam.service.ts lines 210, 378, 580, 644,
   5) — but in every existing usage, the transaction is opened AND
   consumed within a single function's own scope (e.g. a service method),
   never threaded across a preHandler-hook/request-handler boundary the way
   this fix would require. There is no existing precedent in this codebase
   for a request-scoped transaction or connection handle that survives from
   a preHandler hook into a downstream route/procedure handler. You are not
   just wrapping one function's db.execute() call — you need some mechanism
   for making Hook 3's connection/transaction context reachable by whatever
   queries the eventual route or tRPC procedure handler issues, and no such
   mechanism currently exists anywhere in this codebase for you to reuse.

────────────────────────────────────────────────────────────────────────────
STEP 0 — RE-VERIFY BEFORE TOUCHING ANYTHING (REQUIRED, DO NOT SKIP)

This task was planned against a specific uploaded snapshot of the repo. Before
writing any code:

1. Re-read iam.middleware.ts's Hook 3 (setDatabaseSessionVars) and confirm
   the line numbers and code shown above still match. If they don't, STOP
   and report the discrepancy rather than proceeding against a stale
   description.
2. Re-read apps/server/src/trpc/trpc.ts's createContext and confirm the
   `db: (req.server as any).db as AppDb` line still matches.
3. Confirm LOG-0100's current status field in
   docs/development-findings-log.md — if a human has since moved it to
   `confirmed` or `superseded`, that changes how much of its reasoning you
   should treat as settled vs. still-to-verify; report which you found.
4. Run the actual empirical test yourself against the local dev Postgres
   (docker compose up -d postgres, or whatever the current equivalent
   command is — check compose.yml if unsure) rather than trusting
   LOG-0100's own psql-session description secondhand. Confirm independently:
   does set_config(..., true) issued via a bare, standalone
   drizzle db.execute() call (not wrapped in db.transaction()) genuinely
   fail to be visible to a SEPARATE, subsequent db.execute() or query call
   against the same shared Drizzle/postgres-js client instance? This is the
   one link in the whole chain that cannot be confirmed from a static
   repo read — confirm it with a real, running database before designing
   anything further. If your result contradicts LOG-0100, stop and report
   the contradiction rather than either silently trusting LOG-0100 or
   silently trusting your own new result over it — this needs a human's
   attention either way.

────────────────────────────────────────────────────────────────────────────
STEP 1 — DESIGN DECISION (YOU MUST CHOOSE AND JUSTIFY; NOT PRE-SETTLED)

Two candidate fix shapes. This task does not mandate which — choose one,
state your reasoning explicitly in your report (Step 4), and do not silently
default to whichever seems easier without weighing both:

(a) CONNECTION-AFFINITY APPROACH: investigate whether postgres-js's
    reserve() API (confirmed: this codebase currently has zero usages of
    reserve() anywhere — grep apps/server/src for it yourself to verify this
    still holds) can pin a single physical connection for the duration of
    one request, such that Hook 3's set_config() call and all subsequent
    queries in that same request run on the SAME connection. Note: postgres-js
    is pinned at ^3.4.4 in apps/server/package.json (confirmed this session)
    — check reserve()'s actual documented behavior against this version
    specifically before assuming any particular API shape; do not assume
    from general familiarity with the postgres npm package without checking
    the installed version's actual docs/types. This approach gives
    connection affinity WITHOUT necessarily wrapping the whole request in a
    single SQL transaction (i.e., individual statements could still
    auto-commit independently) — reason carefully about whether SET LOCAL
    values persist under this scheme even without an explicit transaction
    wrapper, since SET LOCAL's persistence rule is specifically
    "transaction-scoped," not "connection-scoped" — if reserve() alone
    doesn't solve it without also wrapping in a transaction, say so plainly
    rather than shipping something that looks fixed but isn't.

(b) FULL REQUEST-SCOPED TRANSACTION: wrap Hook 3's set_config call and make
    that same transaction's `tx` handle reachable by every subsequent
    query in the request — for the tRPC path, this means changing
    createContext (apps/server/src/trpc/trpc.ts line 9) to supply a
    request-scoped `tx` instead of the app-lifetime `fastify.db`; for the
    REST path, an equivalent change wherever route handlers currently read
    `fastify.db` directly (documents.plugin.ts line 43 is one confirmed
    instance; there are likely others in other *.plugin.ts files — you
    must find and enumerate them, do not assume documents.plugin.ts is the
    only one). This is the architecturally "complete" fix but has a real,
    non-mechanical side effect you must flag explicitly if you pursue it:
    wrapping an entire request in one SQL transaction changes error-handling
    semantics — a failure partway through a request would now roll back
    every write that request made, where today (with per-call auto-commit)
    it would not. Confirm whether this is a desired behavior change or an
    unintended one before committing to this approach; if you cannot
    determine this from documented rules, flag it as a question for a human
    rather than deciding it yourself.

Whichever you choose, if it turns out to require touching more than 2-3
files beyond iam.middleware.ts, database.plugin.ts, and trpc/trpc.ts (for
example, if every *.plugin.ts file's fastify.db capture needs individual
updating), STOP after enumerating the full list of affected files and
report back before making all the changes — this task authorizes
investigating and fixing the core mechanism, not a mechanical sweep across
every module's plugin file without a checkpoint. This mirrors LOG-0100's own
note that the full fix is "a broader architectural change than this task's
scope" — this task is explicitly testing whether that's still true once you
have concrete file counts, not assuming it away.

────────────────────────────────────────────────────────────────────────────
STEP 2 — IMPLEMENT

Implement your chosen approach. Non-goals — do not do these as part of this
task, even if you notice them along the way:

- Do not change any RLS policy definition itself (documents_office_isolation,
  sessions_own_or_admin, or any other) — this task fixes the mechanism that
  populates the GUC values the policies already correctly read from, not the
  policies' own logic.
- Do not add FORCE ROW LEVEL SECURITY to any table — its absence is a
  separate, independent fact (batac_app is confirmed non-owning, so RLS
  already fully applies without FORCE) and not something this task's
  findings implicate.
- Do not touch the REST /api/auth/lock, /api/auth/unlock handlers or the
  locked_at check itself (iam.middleware.ts lines 170-171) — unrelated to
  this task, already correct and confirmed working.
- Do not modify AGENTS.md, any Group B-L document, or document-list.md, even
  if you find something in them that looks stale relative to what you learn
  — log a findings-log entry instead per Section 4.5's rules.

────────────────────────────────────────────────────────────────────────────
STEP 3 — VERIFY

- pnpm typecheck must pass monorepo-wide.
- Run the existing test suite (pnpm test or the equivalent — check
  package.json scripts for the exact current command). Note that
  iam.middleware.test.ts's existing Hook 3 tests (mocking db.execute,
  asserting call-count only — confirmed lines 133, 515, 530, 545, 558 this
  session) CANNOT detect whether your fix actually works, by design — they
  will pass whether or not the underlying persistence bug is fixed. Do not
  treat their passing as evidence of success.
- Write and run a NEW verification against the real local dev Postgres
  (not a mock) that actually proves GUC values set by something equivalent
  to Hook 3 ARE visible to a subsequent, separate query using your fixed
  mechanism. This can be a small standalone script, a new integration test,
  or a manual psql-adjacent check — your call on format — but it must
  exercise the real fix end-to-end, not just assert a function was called.
  State clearly in your report what you actually ran and what it showed.
- If practical, seed at least one row in documents.documents scoped to a
  known office_id and confirm a query as that office's user now returns it
  (previously would have returned 0 rows regardless of correctness, per
  LOG-0100's own noted limitation of the empty dev database) — this is the
  strongest possible confirmation but only do this if it doesn't require a
  disproportionate amount of unrelated seed-data setup; if it does, say so
  and rely on the GUC-visibility check above instead.

────────────────────────────────────────────────────────────────────────────
STEP 4 — REPORT AND LOG

State explicitly in your report:
(a) What Step 0's re-verification found — did the repo match this task's
    description, and did your own empirical test confirm or contradict
    LOG-0100's claim?
(b) Which Step 1 approach you chose ((a) connection-affinity via reserve(),
    or (b) full request-scoped transaction) and your reasoning, including
    how you resolved the SET LOCAL transaction-scope question if you chose
    (a), or how you resolved the error-rollback-semantics question if you
    chose (b).
(c) The complete list of files you touched, and — if you chose (b) — the
    complete list of *.plugin.ts (or equivalent) files you found that
    directly capture fastify.db at registration time, whether or not you
    ended up modifying all of them.
(d) What you ran in Step 3 and what it showed, in enough detail that a
    reviewer doesn't have to re-run it themselves to believe it worked.
(e) The corrected severity characterization from your own re-verification
    (fail-closed SELECT-only gap vs. something broader) — confirm or correct
    this task's own framing above.

Append a findings-log entry to docs/development-findings-log.md. Verify the
actual current next-free LOG number against the file's own tail before
writing — do not assume it continues from LOG-0100 sequentially, since other
work may have appended entries since this task was written. status: proposed.
Cross-reference LOG-0100 explicitly (this entry supersedes or confirms it —
state which). Do not mark LOG-0100 itself as superseded/confirmed in its own
entry — per AGENTS.md Section 4.5, only a human promotes a status field; add
your new entry alongside it instead.

Before submitting this PR, confirm each item:
- [ ] pnpm typecheck passes monorepo-wide
- [ ] Existing test suite passes (and you've noted which Hook 3 tests
      cannot meaningfully validate this fix, per Step 3)
- [ ] A new, real-database verification (not a mock) demonstrates GUC
      persistence across the hook-to-handler boundary
- [ ] Step 1's design choice and its resolved sub-question are stated
      explicitly in your report, not left implicit
- [ ] If your fix touched more than 2-3 files, you stopped and reported
      the full file list before proceeding, per Step 1's instruction
- [ ] A new findings-log entry exists, status: proposed, cross-referencing
      LOG-0100, using the log's actual verified next-free number
- [ ] No RLS policy definitions, the locked_at check, or any Group B-L /
      AGENTS.md document were modified
A reviewer will verify each one independently.
```

---

TASK-IAM-XXX — Add atomic guard to markRefreshTokenUsed to close a
concurrent-refresh-token-rotation race condition

[NOTE: "XXX" is a placeholder. Before running this task, check the project's
task list / PR history for the next free TASK-IAM-NNN number and substitute
it — this was not verified against a master task list from this planning
session.]

## Background

`apps/server/src/modules/iam/iam.repository.ts`'s `markRefreshTokenUsed`
function (currently at lines 105-107) performs an unconditional UPDATE with
no guard against concurrent execution:

```typescript
    markRefreshTokenUsed: async (id, replacedById) => {
      await db.update(refreshTokens).set({ usedAt: new Date(), replacedBy: replacedById }).where(eq(refreshTokens.id, id));
    },
```

This function is called from two places in
`apps/server/src/modules/iam/iam.service.ts`, both inside a
`db.transaction(...)` block, both as part of refresh-token rotation:

1. Inside the `refresh` method (method starts at line 543), at line 656:
   `await txRepo.markRefreshTokenUsed(tokenId, newTokenId);` — this is the
   main token-refresh flow, triggered by `POST /api/auth/refresh`.

2. Inside the `unlockSession` method (method starts at line 986), at line
   1057: `await txRepo.markRefreshTokenUsed(latestRt.id, newTokenId);` —
   this fires during session-unlock when the access token has also expired
   and needs rotating alongside the unlock.

Because this UPDATE has no `WHERE ... usedAt IS NULL` (or equivalent)
guard, if two concurrent requests both present the same refresh token
before either has written to it, BOTH requests' prior reuse-detection
checks (which read `usedAt` before this UPDATE runs) can pass, and BOTH
requests can then successfully call `markRefreshTokenUsed` for the same
`id`, each creating a distinct new token. Whichever response's `Set-Cookie`
header the browser processes last "wins" and becomes the client's actual
refresh-token cookie; the other newly-created token becomes a valid,
unused, orphaned row in the database that the client will never present
(since it never received that response's cookie). This is a data-integrity
and defense-in-depth gap: it does not, by itself, cause requests to fail
outright, but it silently creates unreachable, still-valid tokens and
provides no signal that a concurrent-write race occurred.

This task closes that gap by making the UPDATE conditional and atomic
(`WHERE id = ? AND usedAt IS NULL`), and by making the losing request (the
one whose UPDATE affects zero rows) receive the EXACT SAME response as the
codebase's existing, established reuse-detection handling — not a
different, softer failure. This is a deliberate security decision: the
existing reuse-detection branch treats "a token with non-null `usedAt` was
presented again" as a potential token-theft signal and responds by
revoking the entire token family and terminating the session. A request
that loses this new race is, from the server's perspective, presenting
proof of exactly that same fact (the token was already marked used by the
time this request's UPDATE ran) — so it must receive the identical
response. Do not implement a softer "just don't create a second token and
quietly return the winner's token" behavior for the losing request; that
would create a second, inconsistent policy for the same observable
condition and would be weaker, not more defensive, since it would apply
identical soft treatment to a genuine attacker racing a stolen token
against the legitimate user's request.

## Scope of this task

Fix ONLY the `markRefreshTokenUsed` guard and its two call sites' handling
of the new no-match case, described exactly below. Do NOT:

- Touch anything under `apps/web/src` — this is a server-only,
  defense-in-depth fix. It does not fix the user-visible symptom of a
  redirect loop on sidebar clicks; that is fixed by a separate,
  already-completed task addressing `packages/ui/src/components/domain/
Sidebar.tsx`. Do not treat this task as needing to also address that.
- Touch `iam.middleware.ts`, `iam.routes.ts`, or any other file in the
  `iam` module besides the three listed below.
- Change the EXISTING reuse-detection branch in `refresh` (the `if
(tokenRow.usedAt !== null) { ... }` block starting at line 578) — that
  logic is correct and unaffected by this task; you are adding a NEW
  branch elsewhere that, when triggered, performs the identical actions,
  not modifying the existing one.
- Change `AUTH_MAX_CONCURRENT_SESSIONS` or any session-limiting logic —
  unrelated to this task.

## Files to change, and exact current state to verify before editing (if

what you find does not match, STOP and report the discrepancy rather than
proceeding)

### 1. `apps/server/src/modules/iam/iam.types.ts`

Current interface declaration (line 333):

```typescript
  markRefreshTokenUsed(id: string, replacedById: string): Promise<void>;
```

Change to:

```typescript
  markRefreshTokenUsed(id: string, replacedById: string): Promise<boolean>;
```

(Returns `true` if a row was matched and updated — i.e., the token was
genuinely unused before this call — and `false` if zero rows were matched,
meaning some other writer had already set `usedAt` on this token first.)

### 2. `apps/server/src/modules/iam/iam.repository.ts`

Current implementation (lines 105-107):

```typescript
    markRefreshTokenUsed: async (id, replacedById) => {
      await db.update(refreshTokens).set({ usedAt: new Date(), replacedBy: replacedById }).where(eq(refreshTokens.id, id));
    },
```

Change to add the `usedAt IS NULL` guard and return whether a row was
matched. This codebase's established convention in this exact file for
detecting whether a conditional mutation matched a row is `.returning()`
followed by checking the result array (see, for example, the existing
`updateCredentialHash`-adjacent patterns and `createRefreshToken` at line
97-100, which also use `.returning()`) — follow that same convention here
rather than introducing `.rowCount`-based detection, which is not used
elsewhere in this file:

```typescript
    markRefreshTokenUsed: async (id, replacedById) => {
      const updated = await db.update(refreshTokens)
        .set({ usedAt: new Date(), replacedBy: replacedById })
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.usedAt)))
        .returning();
      return updated.length > 0;
    },
```

Verify `and` and `isNull` are already imported at the top of this file
(they are used elsewhere in this same file, e.g. in
`revokeRefreshTokenFamily` at line 111-113, which uses both) — if for any
reason they are not already imported in the actual current file, add them
to the existing import statement from `drizzle-orm` rather than creating a
new import line.

### 3. `apps/server/src/modules/iam/iam.service.ts` — TWO call sites

#### 3a. Inside `refresh` (method starting at line 543), at line 656

Current code:

```typescript
await txRepo.markRefreshTokenUsed(tokenId, newTokenId);
```

This is the only statement between the transaction's opening (`await
db.transaction(async (tx) => {` and its body) and `await
txRepo.createRefreshToken({...})`. Change it to capture the boolean
return, and — if `false` — perform the SAME sequence of actions that the
method's existing reuse-detection branch performs (the `if
(tokenRow.usedAt !== null) {...}` block starting at line 578), which is:
revoke the token family, terminate the session if active, write an audit
event, and throw an `UNAUTHORIZED`/401 error. Because this new check
happens INSIDE the already-open `db.transaction` (unlike the existing
reuse-detection branch, which opens its OWN separate transaction before
the rotation transaction even begins), the family-revocation and
session-termination calls here should use the SAME transactional `txRepo`
already in scope in this block — do not open a second nested transaction.

Concretely, replace:

```typescript
await txRepo.markRefreshTokenUsed(tokenId, newTokenId);
```

with:

```typescript
const wasMarkedUsed = await txRepo.markRefreshTokenUsed(tokenId, newTokenId);
if (!wasMarkedUsed) {
  // Another concurrent request already marked this token as used
  // between this request's step-4 reuse check and this rotation
  // step. Treat identically to the step-4 reuse-detection branch:
  // this is the same observable fact (a used token was presented)
  // discovered at a different point in the flow.
  await txRepo.revokeRefreshTokenFamily(tokenRow.familyId, 'reuse_detected');
  const raceSession = await txRepo.findSessionById(tokenRow.sessionId);
  if (raceSession && raceSession.active) {
    await txRepo.terminateSession(raceSession.id, 'reuse_detected', null);
  }
  throw Object.assign(new Error('Session security event detected'), {
    code: 'UNAUTHORIZED',
    statusCode: 401,
  });
}
```

Note: `tokenRow` and `session` are both already in scope at this point in
the method (from steps 2 and 6 respectively) — reuse `tokenRow.familyId`
and `tokenRow.sessionId` exactly as the existing branch does; the local
variable is named `raceSession` above only to avoid shadowing the
outer-scope `session` variable already declared earlier in the method (do
not reuse the name `session` for this inner lookup, to avoid confusing
future readers about which `session` is being referred to — verify the
outer method does have a variable literally named `session` in scope at
this point before finalizing the variable name choice; if it's named
something else, match this new code's variable name to whatever avoids
actual shadowing).

The audit event write (`void auditService.writeEvent({...})`) that the
existing step-4 branch performs is NOT required to be duplicated here —
omit it for this new branch. This is a deliberate scope reduction, not an
oversight: leave a one-line code comment at the point of omission stating
that the audit write was intentionally left out of this branch and should
be added in a follow-up if audit coverage for this specific race path is
needed, so a future reader doesn't mistake the omission for a bug. Do not
silently skip this comment.

Because this throw now happens INSIDE the `db.transaction(...)` callback
(not after it, like the existing step-4 branch, which throws after its own
transaction completes), throwing here will cause the ENCLOSING rotation
transaction (the one this code is inside) to roll back automatically —
this is correct and desired: it means `createRefreshToken` and
`updateLastActivity`, which come after this point in the same transaction
block, will correctly NOT execute for the losing request. Do not add any
additional try/catch around this throw; let it propagate and roll back the
transaction naturally, consistent with how `db.transaction` callbacks in
this codebase are expected to behave on a thrown error (confirmed via
`iam.middleware.ts`'s `onResponse` hook comments, which describe drizzle's
transaction wrapper rolling back on a rejected/thrown callback).

#### 3b. Inside `unlockSession` (method starting at line 986), at line 1057

Current code:

```typescript
await txRepo.markRefreshTokenUsed(latestRt.id, newTokenId);
```

Apply the same pattern. In this method, the equivalent in-scope variables
are `latestRt` (in place of `refresh`'s `tokenRow`) and `sessionId` (a
plain local variable already destructured from `input` at the top of the
method, in place of `refresh`'s `session.id`) — use `latestRt.familyId` and
`sessionId` directly. Replace:

```typescript
await txRepo.markRefreshTokenUsed(latestRt.id, newTokenId);
```

with:

```typescript
const wasMarkedUsed = await txRepo.markRefreshTokenUsed(latestRt.id, newTokenId);
if (!wasMarkedUsed) {
  // Same rationale as the equivalent guard in refresh() — see
  // that method for the full explanation.
  await txRepo.revokeRefreshTokenFamily(latestRt.familyId, 'reuse_detected');
  const raceSession = await txRepo.findSessionById(sessionId);
  if (raceSession && raceSession.active) {
    await txRepo.terminateSession(raceSession.id, 'reuse_detected', null);
  }
  throw Object.assign(new Error('Session security event detected'), {
    code: 'UNAUTHORIZED',
    statusCode: 401,
  });
}
```

Same note on omitting the audit-event write and leaving an explanatory
comment applies here.

## Test files that WILL need updating as a direct consequence of this

change — update these, do not leave them broken

The following three test files currently mock `markRefreshTokenUsed` with
`vi.fn().mockResolvedValue(undefined)`. Once the real function's return
type changes from `Promise<void>` to `Promise<boolean>`, these mocks must
be updated to `mockResolvedValue(true)` so that existing tests continue to
exercise the intended happy path (a token successfully marked used, not
the new race-detected path) rather than accidentally testing the new
`false`/no-match branch by default:

1. `apps/server/src/modules/iam/__tests__/iam.role-assignment.test.ts`,
   line 118: `markRefreshTokenUsed: vi.fn().mockResolvedValue(undefined),`
   → change to `mockResolvedValue(true)`.
2. `apps/server/src/modules/iam/__tests__/iam.login.test.ts`, line 214:
   `markRefreshTokenUsed:       vi.fn().mockResolvedValue(undefined),` →
   change to `mockResolvedValue(true)` (preserve the existing alignment
   spacing style used in this file if it is intentional formatting rather
   than incidental).
3. `apps/server/src/modules/iam/__tests__/iam.refresh.test.ts`, line 159:
   `markRefreshTokenUsed: vi.fn().mockResolvedValue(undefined),` → change
   to `mockResolvedValue(true)`. This same file has a separate assertion
   at line 208 (`expect(txRepoStub.markRefreshTokenUsed).toHaveBeenCalled
With(tokenId, expect.any(String));`) which only checks call arguments,
   not the return value — this assertion should not need to change, but
   verify it still passes after your edit.

Before making any of these three test-mock edits, verify each file's
current content still matches what's shown above — test files can drift
between planning and execution just like source files. If a file's content
around these lines doesn't match, report the discrepancy rather than
editing blindly.

## New test coverage to add

Add new test case(s) to
`apps/server/src/modules/iam/__tests__/iam.refresh.test.ts` (this is the
existing, correctly-scoped test file for the `refresh` method) covering:

1. **The race-detected branch fires correctly**: mock
   `markRefreshTokenUsed` to resolve to `false` (simulating a losing
   concurrent request), and assert that: `revokeRefreshTokenFamily` was
   called with the correct `familyId`; `terminateSession` was called
   (assuming the mocked session is active); the method throws/rejects with
   `code: 'UNAUTHORIZED'` and `statusCode: 401`; `createRefreshToken` and
   `updateLastActivity` were NOT called (confirming the early-throw
   correctly short-circuits the rest of the transaction body).
2. **The happy path is unaffected**: with `markRefreshTokenUsed` mocked to
   resolve to `true` (the default happy-path value after your test-mock
   updates above), confirm the method completes successfully exactly as
   it did before this change — this should already be covered by existing
   tests in this file continuing to pass, but explicitly confirm this
   rather than assuming it.

Do not add equivalent new test coverage for `unlockSession` unless an
existing test file for `unlockSession` already exists and has an
established pattern you can extend consistently — search for a test file
covering `unlockSession` first (likely under the same `__tests__`
directory) and report whether one exists before deciding whether to add
coverage there. If none exists, do not create a new test file for this
task alone; note this as a gap in your report instead.

## Verification steps

1. Run the monorepo's typecheck (check `package.json`'s `scripts` for the
   exact command) and confirm it passes with no new errors.
2. Run the full existing test suite for the `iam` module (all files under
   `apps/server/src/modules/iam/__tests__/`) and confirm everything passes,
   including your new test(s).
3. Do NOT attempt to empirically reproduce the original concurrent-refresh
   race against a running server/database as part of this task — that
   reproduction is being done separately, outside this task's scope.

## What "done" looks like

- `markRefreshTokenUsed` returns `Promise<boolean>`, guards its UPDATE with
  `usedAt IS NULL`, in both the type declaration and the implementation.
- Both call sites (`refresh` and `unlockSession`) check the return value
  and, on `false`, perform the family-revocation + session-termination +
  401-throw sequence described above, using the already-open transaction's
  `txRepo` (no nested transaction).
- The three identified test-mock files are updated to `mockResolvedValue
(true)`.
- New test coverage exists in `iam.refresh.test.ts` for both the
  race-detected and happy-path cases as described above.
- Typecheck and the full `iam` module test suite pass.
- No file outside `apps/server/src/modules/iam/` has been touched.

Report back: what you changed (diff or summary) for each of the three
source files, the test-mock updates, the new test cases added, the
typecheck result, and the full `iam` test suite result. Explicitly confirm
whether a test file for `unlockSession` existed and whether you added
coverage there or noted it as a gap.

---

# TASK-IAM-042 — Justify or Replace the TASK-IAM-041 AsyncLocalStorage Fix, Then Empirically Verify Whatever Survives

```
CONTEXT — READ THIS FIRST

Read AGENTS.md before doing anything else if you have not already internalized
it this session. Row union: "Implement RLS policies" (C3 → C1 → I1).

This task is a direct follow-up to TASK-IAM-041, whose PR has already landed
(commits 80f9c86, ab86968, per that task's own report — this task does not
independently verify those commit hashes exist, since no .git history was
available in the snapshot this follow-up was planned against; verify git log
yourself if you have live repo access and flag it if either commit is
missing or doesn't match what's described below). Read
docs/development-findings-log.md's [LOG-0100] and [LOG-0101] in full before
starting — LOG-0101 documents what TASK-IAM-041 actually built. Do not
re-derive the mechanism from scratch; the summary below is a verified
account of the CURRENT code, given directly so you don't have to.

Also re-read TASK-IAM-041's own original prompt if it's still present
anywhere in this repo's task-list artifacts (check a1-tasks/ under
docs/pre-development/A-project-planning/, or wherever this project's
standalone prompts are archived) — it offered two named design options,
(a) postgres-js reserve()-based connection affinity, and (b) a full
request-scoped transaction threaded through createContext. Neither was
built. This task exists because that choice was never justified against the
two named alternatives, and the resulting third design has not been
empirically proven against a real database.

────────────────────────────────────────────────────────────────────────────
WHAT WAS ACTUALLY BUILT — VERIFIED AGAINST THE CURRENT REPO, NOT TAKEN ON
TRUST FROM TASK-IAM-041'S OWN REPORT

Three pieces, all confirmed present in the current codebase by direct read:

1. apps/server/src/infrastructure/database.plugin.ts — fastify.db is now a
   Proxy (constructed at line 72) wrapping the base Drizzle client. Its get
   trap (lines 52-69) checks a module-level AsyncLocalStorage instance,
   `rlsStore` (exported at line 37), for an active request-scoped
   transaction handle. When present, method calls delegate to that handle;
   when absent, they fall through to the base client.

2. apps/server/src/modules/iam/iam.middleware.ts — Hook 3
   (setDatabaseSessionVars, function body lines 319-399) now calls
   `this.db.transaction(async (tx) => {...})` at line 361 WITHOUT awaiting
   the returned promise (only `.catch()` is attached, line 384). Inside the
   callback: the six set_config calls run against `tx` directly, then
   `rlsStore.run({ tx }, async () => { resolveGucs(); await txOpen; })`
   (line 378) establishes the AsyncLocalStorage scope and immediately
   signals a `gucsReady` promise before suspending on a second promise,
   `txOpen`, that isn't resolved until later. Hook 3 itself `await
   gucsReady` (line 395), then stores the OTHER promise's resolver function
   — not the transaction handle — on the request object as
   `(request as any)._resolveRlsTx` (line 398), and returns. A separate
   onResponse hook, `commitRlsTx` (registered inside authMiddlewarePlugin,
   lines 447-453), reads `_resolveRlsTx` off the request after the response
   has been sent and calls it, which resolves `txOpen`, which lets the
   `db.transaction()` callback return, which commits the transaction and
   releases the connection.

3. apps/server/src/modules/iam/iam.types.ts line 404 — a `_rlsTx?:
   DbTransaction` field was added to the FastifyRequest interface
   augmentation. CONFIRMED THIS SESSION: this field is never read or
   written anywhere in the non-test codebase (grep for `\b_rlsTx\b`
   codebase-wide — the only match is its own declaration). The actual
   runtime mechanism uses a completely different, untyped property,
   `_resolveRlsTx`, accessed exclusively via `(request as any)` casts at
   iam.middleware.ts lines 398, 448, and 451 — with no interface
   declaration anywhere. `pnpm typecheck` passing is not evidence this is
   fine — the `as any` casts are precisely what exempt the load-bearing
   property from type-checking. You must resolve this inconsistency as
   part of Step 2 below regardless of which design survives Step 0/Step 1.

────────────────────────────────────────────────────────────────────────────
WHY THIS TASK EXISTS — TWO SEPARATE GAPS IN TASK-IAM-041'S OWN DELIVERY

Gap 1 — no justification was given for building this AsyncLocalStorage/
split-wait design instead of either of the two options TASK-IAM-041's
original prompt offered. TASK-IAM-041's report does not mention option (a)
or (b) at all, does not explain why a third, more architecturally novel
approach (this codebase's first use of AsyncLocalStorage anywhere, confirmed
by TASK-IAM-041's own database.plugin.ts doc comment framing it as new) was
preferred, and does not address the specific sub-questions the original
prompt flagged for each option — e.g. whether reserve() alone (without a
full transaction wrapper) would have been sufficient for SET LOCAL's
transaction-scoped persistence rule, which is a genuinely relevant question
for evaluating whether option (a) was actually ruled out for a real reason
or simply not considered.

Gap 2 — the original task's Step 0 (empirically confirm the failure mode
against a real database BEFORE designing a fix) and Step 3 (a NEW,
real-database verification that the fix actually works, not just that
mocked unit tests pass) were both explicitly, repeatedly required and
neither was completed. TASK-IAM-041's own verification table states "Real
PostgreSQL with RLS: Not yet tested" — this is an honest, accurate report of
an incomplete task, not a claim of success, and is being treated as such
here; this task is not accusing TASK-IAM-041 of misrepresenting its work.

Separately, and more specific to this task: the existing Hook 3 unit tests
(apps/server/src/modules/iam/__tests__/iam.middleware.test.ts) were updated
just enough to prevent a type error, NOT to exercise the new mechanism.
CONFIRMED THIS SESSION: makeMockDb() (lines 132-139) returns a `transaction`
mock (line 134) that immediately invokes its callback with a synchronous
fake `tx = { execute }` and does not implement anything resembling the
split-wait promise bridge, the AsyncLocalStorage scope, or the onResponse
commit hook. Grep confirms zero references anywhere in this test file to
`onResponse`, `_resolveRlsTx`, `txOpen`, `gucsReady`, or `rlsStore` by name.
The four existing Hook 3 tests (lines 510-564) are byte-for-byte unchanged
from before this fix — same `expect(db.execute).toHaveBeenCalledOnce()`
assertions, same comments acknowledging they only check the call happened.
"All 21 tests pass" is true but is not evidence the split-wait mechanism, or
the onResponse commit path specifically, works correctly — it is evidence
the mock doesn't throw when called the way Hook 3 now calls it.

────────────────────────────────────────────────────────────────────────────
STEP 0 — RE-VERIFY BEFORE TOUCHING ANYTHING (REQUIRED, DO NOT SKIP)

This task was planned against a specific uploaded snapshot. Before writing
any code:

1. Re-read database.plugin.ts, iam.middleware.ts's Hook 3 and onResponse
   hook, and iam.types.ts's _rlsTx field. Confirm the line numbers and code
   shown above still match. If they don't, STOP and report the discrepancy.
2. Confirm LOG-0100 and LOG-0101's current status fields — if either has
   been moved to `confirmed` or `superseded` by a human, that changes how
   much you should treat as settled; report which you found.
3. This is the step TASK-IAM-041 skipped and should not be skipped again:
   confirm, against a REAL, running local Postgres instance (docker compose
   up -d postgres, or the current equivalent — check compose.yml), whether
   LOG-0100's original claim (bare, unwrapped set_config via db.execute()
   does not survive to a subsequent query) still reproduces. This
   establishes your baseline before you evaluate whether the AsyncLocalStorage
   fix actually resolves it.

────────────────────────────────────────────────────────────────────────────
STEP 1 — JUSTIFY OR REPLACE (REQUIRED — DO NOT SKIP TO VERIFICATION)

You must do ONE of the following. Both are legitimate outcomes of this task;
neither is presumed correct in advance:

EITHER (1a): Write a genuine justification for the AsyncLocalStorage/
split-wait design against BOTH originally-offered options, specifically:
  - Against option (a) (reserve()-based connection affinity): does
    reserve() alone, without a full transaction wrapper, actually fail to
    preserve SET LOCAL values (since SET LOCAL's persistence rule is
    transaction-scoped, not connection-scoped, as TASK-IAM-041's own
    original prompt flagged as a sub-question to resolve)? If reserve()
    genuinely can't work without also wrapping in a transaction, and
    wrapping the reserved connection in a transaction has the SAME
    deadlock hazard the split-wait pattern exists to solve, that is real
    justification. State whether you actually checked this against
    postgres-js's documented behavior for the ^3.4.4 version pinned in
    apps/server/package.json, or are asserting it from general familiarity
    with the package — label accordingly.
  - Against option (b) (full request-scoped transaction reaching
    createContext): does the split-wait pattern avoid the error-rollback-
    semantics change that option (b) would introduce (an entire request's
    writes rolling back on any failure, which the original prompt flagged
    as a real behavior change requiring explicit sign-off)? If yes, is that
    actually true of the AsyncLocalStorage approach too — trace whether a
    failure partway through a request's route-handler logic, under the
    CURRENT split-wait design, still commits Hook 3's transaction via the
    onResponse hook regardless of whether the route handler itself threw
    (i.e., does an error in the route handler skip onResponse, or does
    Fastify still fire onResponse hooks on error responses)? This is
    directly relevant to Gap 2 in "Open items for human review" from
    TASK-IAM-041's report (silent absorption of late transaction failures)
    — confirm whether it also applies to the ordinary case of "route
    handler threw a normal application error," not just late connection
    failures, since if onResponse still fires and still commits on an
    application-level error, the split-wait design has NOT avoided the
    rollback-semantics question, it has just relocated it to always-commit
    regardless of error, which is its own explicit behavior worth stating
    plainly rather than leaving implicit.

OR (1b): If Step 1a's investigation reveals the AsyncLocalStorage design is
NOT actually justified against one or both alternatives (e.g., you find
option (a) would have worked fine and is simpler, or you find the current
design's error-handling behavior is worse than either original option's),
replace it with whichever of (a) or (b) is actually justified, following
the same non-goals from TASK-IAM-041's original prompt (do not touch RLS
policy definitions, the locked_at check, or Group B-L documents).

State your Step 1 outcome (1a or 1b) and full reasoning explicitly in your
report (Step 3 below) — do not proceed to Step 2 without this being
resolved and written down first.

────────────────────────────────────────────────────────────────────────────
STEP 2 — FIX THE _rlsTx / _resolveRlsTx TYPING INCONSISTENCY (REQUIRED
REGARDLESS OF STEP 1's OUTCOME)

Whichever design survives Step 1, resolve the confirmed inconsistency
between the declared, unused `_rlsTx?: DbTransaction` field (iam.types.ts
line 404) and the actually-used, untyped `_resolveRlsTx` property (accessed
via `as any` at iam.middleware.ts lines 398, 448, 451). This is not
mechanical in the sense of having only one correct fix — decide, and state
in your report, whether the request-scoped property should hold the
transaction handle itself (matching `_rlsTx`'s current name and type,
requiring the onResponse hook to interact with the transaction differently
than it does today) or the resolver function (matching what's actually
used today, requiring `_rlsTx` to be renamed/retyped to a function type, or
removed if genuinely redundant). Either is acceptable; leaving the
inconsistency in place, or fixing it by adding a second, differently-named
typed field alongside the untyped one, is not.

────────────────────────────────────────────────────────────────────────────
STEP 3 — VERIFY (WHATEVER DESIGN SURVIVES STEP 1)

- pnpm typecheck must pass monorepo-wide.
- Run the existing test suite. As with TASK-IAM-041's own report, do not
  treat these tests passing as evidence the mechanism works — extend
  makeMockDb() (or write a new, separate test) so that at least one test
  ACTUALLY exercises: (i) the split-wait/promise-bridge behavior if 1a was
  chosen (i.e., a mock transaction() that genuinely suspends until an
  external signal, not one that resolves synchronously through the
  callback), or the equivalent mechanism if 1b replaced it; and (ii) the
  onResponse commit hook specifically — confirm it fires, confirm it
  triggers whatever release/commit action the design requires, under BOTH
  a normal successful response and a route-handler error, given Step 1's
  finding about whether onResponse fires on error responses.
- Write and run a NEW verification against the real local dev Postgres (not
  a mock) that proves GUC values set at the start of a request are visible
  to a subsequent, separate query later in the SAME request, using whatever
  design survives Step 1. This is the same requirement TASK-IAM-041's
  original prompt stated and that was not completed — it is being restated
  here because it remains the single most important unverified claim in
  this entire fix.
- If practical, seed at least one row in documents.documents scoped to a
  known office_id and confirm a query as that office's user now returns it.
  If disproportionate setup effort, rely on the GUC-visibility check above
  instead and say so.

────────────────────────────────────────────────────────────────────────────
STEP 4 — REPORT AND LOG

State explicitly:
(a) Step 0's re-verification findings, including whether LOG-0100's
    original claim reproduced against a real database.
(b) Step 1's full outcome — 1a (justified, kept) or 1b (replaced) — and the
    complete reasoning against both original options, including the
    onResponse-fires-on-error question.
(c) How you resolved the _rlsTx/_resolveRlsTx inconsistency and why.
(d) What you ran in Step 3 and what it showed — specifically, what the new
    test(s) actually exercise that the existing ones didn't, and what the
    real-database verification showed.
(e) Whether the connection-pool-pressure and silent-error-absorption items
    from TASK-IAM-041's "Open items for human review" are still open,
    resolved, or no longer applicable given whatever Step 1 concluded.

Append a findings-log entry. Verify the actual current next-free LOG number
against the file's own tail before writing — do not assume it continues
sequentially from LOG-0101. status: proposed. Cross-reference LOG-0100 and
LOG-0101 explicitly, stating whether this entry supersedes, confirms, or
extends each.

Before submitting this PR, confirm each item:
- [ ] pnpm typecheck passes monorepo-wide
- [ ] Step 1 is explicitly resolved (1a or 1b) with reasoning against both
      original options, not left implicit or skipped
- [ ] The onResponse-fires-on-error question is explicitly answered, not
      assumed
- [ ] The _rlsTx/_resolveRlsTx inconsistency is resolved, one way, with no
      untyped as-any-cast property remaining for whichever mechanism is
      load-bearing
- [ ] At least one test genuinely exercises the split-wait or replacement
      mechanism's suspend/resume behavior, not just that a mock doesn't throw
- [ ] A new, real-database verification (not a mock) demonstrates GUC
      persistence across the hook-to-handler boundary — the single item
      restated from TASK-IAM-041 that most needs to stop being deferred
- [ ] A new findings-log entry exists, status: proposed, cross-referencing
      LOG-0100 and LOG-0101 by name, using the log's actual verified
      next-free number
- [ ] No RLS policy definitions, the locked_at check, or any Group B-L /
      AGENTS.md document were modified
A reviewer will verify each one independently.
```

---

# TASK-IAM-INV-001 — Investigation Only, No Fix

## Task ID: TASK-IAM-INV-001

## Type: Investigation only. Do not modify any code as part of this task. Produce a written report.

## Background you need (you have no access to any prior conversation — this is everything relevant)

This project (`batac-dms`) recently fixed a bug where sidebar navigation used plain HTML `<a>` tags instead of React Router `Link` components, causing full-page reloads that raced a session-hydration component. That fix has been verified as correctly implemented and is not in question here. This is a **new, separate** investigation into a **different, still-open** redirect-to-login symptom that surfaced in a network capture taken _after_ that sidebar fix was already in place.

Read `AGENTS.md` at the repo root before doing anything else, per this project's standing convention — it governs which documents to consult for different task types and defines the findings-log process referenced below.

## The evidence: a HAR (network capture) file

A browser network capture contains the following relevant entries, in this exact order, all within a 27-millisecond window:

**Page metadata:**

```
page_3: http://localhost:5173/       started 2026-07-13T04:11:21.535Z
page_4: http://localhost:5173/login  started 2026-07-13T04:11:48.211Z
```

**Entry [0]:**

```
GET http://localhost:5173/batac-seal.png
Status: 304
Started: 2026-07-13T04:11:48.182Z
Referer: http://localhost:5173/documents
Sec-Fetch-Dest: image
Sec-Fetch-Mode: no-cors
```

**Entry [1]:**

```
GET http://localhost:3000/api/trpc/documents.list?batch=1&input=%7B%220%22%3A%7B%22limit%22%3A20%7D%7D
Status: 401
Started: 2026-07-13T04:11:48.187Z
Referer: http://localhost:5173/          <-- NOTE: this is root "/", NOT "/documents", unlike entries [0] and [2]
Origin: http://localhost:5173
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-site
Response content-length: 56
Response body: NOT CAPTURED (this HAR export did not record response bodies — the content object has no "text" field, only size/mimeType/compression)
No Cookie header present in the request (see caveat below)
No Set-Cookie header present in the response
```

**Entry [2]:**

```
GET http://localhost:5173/login
Status: 304
Started: 2026-07-13T04:11:48.209Z
Referer: http://localhost:5173/documents
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-User: ?1
```

**Important interpretive notes, stated explicitly so you don't have to re-derive them:**

1. **Zero `Cookie` or `Set-Cookie` headers appear anywhere in the entire 26-entry HAR**, not just in these three entries. This is ambiguous between two explanations and this investigation should try to resolve which: (a) the browser genuinely sent no `batac_at` cookie on the `documents.list` request, or (b) this particular HAR-export tool/setting strips cookie headers from view even though the browser sent them over the wire. Do not assume either explanation without evidence — try to find a way to test which one is true (e.g., capture a fresh HAR yourself with a tool/setting known to preserve cookie headers, and compare).

2. **Entry [2]'s `Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: document`, plus its presence as a new "page" (`page_4`) in the HAR's page list, indicate a genuine full browser document navigation to `/login`** — not a React Router client-side route change (client-side navigation via `<Navigate>` or `useNavigate()` would not produce a fresh top-level document-mode network request or a new HAR "page" entry).

3. **Entry [1]'s `Referer` value (`http://localhost:5173/`) does not match entries [0] and [2] (`http://localhost:5173/documents`).** This is unexplained and should not be assumed to be a capture artifact or dismissed without investigation — it may be a real, meaningful signal about what actually triggered the `documents.list` call.

4. **No `POST /api/auth/refresh` call appears anywhere in the full 26-entry HAR** (this was checked exhaustively across all entries, not just the three shown above). Two files in this codebase can independently trigger a request to this endpoint: `apps/web/src/components/SessionHydrator.tsx` (fires its own `fetch` directly, on mount) and `apps/web/src/lib/trpc.ts`'s `performSilentRefresh()` function (fires only in response to a 401 from a tRPC call). Given entry [1] is a 401, `performSilentRefresh()` should have fired if `apps/web/src/lib/trpc.ts`'s logic (reproduced in full below) executed as written — but no such request is visible. This absence is not explained and is part of what this investigation should try to resolve.

## The specific code path under suspicion

**File:** `apps/web/src/lib/trpc.ts` (74 lines total as of this snapshot). Full current content:

```typescript
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/src/trpc/root.js';
import { useSessionStore } from '@/stores';

export const trpc = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function performSilentRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/api/trpc`,
      async fetch(url, options) {
        const fetchOptions = {
          ...options,
          credentials: 'include' as const,
        } as RequestInit;
        let response = await fetch(url, fetchOptions);

        if (response.status === 401) {
          const success = await performSilentRefresh();
          if (success) {
            response = await fetch(url, fetchOptions);
          } else {
            window.location.href = '/login';
          }
        }

        if (response.status === 423) {
          useSessionStore.getState().setIsLocked(true);
          return new Response(
            JSON.stringify({
              error: {
                message: 'Session is locked',
                code: -32001,
                data: {
                  code: 'UNAUTHORIZED',
                  httpStatus: 401,
                },
              },
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return response;
      },
    }),
  ],
});
```

**Line 48 (`window.location.href = '/login'`)** is a genuine, hard browser navigation — this is the specific line under suspicion as the source of the `/login` document-mode request seen in the HAR at entry [2].

## What this investigation needs to determine

Work through these questions in order. For each, state your finding as one of: **Confirmed** (you verified it directly against running code/a live request), **Inference** (reasoned from confirmed facts, not directly observed), or **Unresolved** (you could not determine this and are saying so explicitly rather than guessing).

1. **Reproduce the symptom.** Run the dev server (both frontend `:5173` and backend `:3000`), log in as any seeded demo user, navigate to `/documents` successfully via the sidebar (confirming the sidebar fix works as a precondition), then find a way to trigger a `documents.list` 401 the same way the HAR shows (this may require letting the access token expire naturally, or find another reliable way to produce a 401 from an authenticated-feeling state — do not simply log out first, since that's a different, uninteresting case). Capture your own HAR or use browser DevTools' Network tab with "Preserve log" enabled and cookies visible, and confirm whether you see the same pattern: `documents.list` → 401 → hard navigation to `/login`.

2. **Resolve the cookie-visibility question (interpretive note 1 above).** Using your own reproduction, determine definitively whether the `batac_at` cookie is actually being sent on the failing `documents.list` request or not. This is answerable directly in DevTools (check the "Cookies" tab of the request, not just headers, since some browsers show cookies separately even when the raw header view is filtered).

3. **Resolve the missing-refresh-call question (interpretive note 4 above).** In your reproduction, does `performSilentRefresh()` actually fire when a tRPC call gets a 401? Add a temporary `console.log` at the top of `performSilentRefresh()` (function starts at line 14 of `apps/web/src/lib/trpc.ts`) if needed to confirm it's being called, then remove the log before finishing — do not leave debug logging in the codebase as part of this investigation's output. If it does fire, why might it not appear in a HAR capture? If it does not fire, why not — trace the actual condition at line 43 (`response.status === 401`) against what status code the initial `fetch` at line 41 actually returns in your reproduction.

4. **Resolve the Referer discrepancy (interpretive note 3 above).** In your own reproduction, check what `Referer` header value gets sent on the `documents.list` request compared to on adjacent requests from the same page. If you can reproduce the same root-vs-`/documents` mismatch, try to determine why — check whether `documents.list`'s `useQuery` (in `apps/web/src/pages/documents/DocumentListPage.tsx`, confirm the current line number of the call yourself rather than assume it hasn't moved) has any `refetchOnMount`, `refetchOnWindowFocus`, or similar TanStack Query v5 option set that could cause it to fire at an unexpected time relative to page navigation, and whether the app has any other code path that calls `documents.list` from a context other than that page (search the whole `apps/web/src` tree for other call sites of `trpc.documents.list`, not just the one this project's prior investigation already found).

5. **Determine whether `SessionHydrator.tsx` is involved in this specific symptom or not.** The prior sidebar-bug investigation found `SessionHydrator.tsx` (67 lines, at `apps/web/src/components/SessionHydrator.tsx`) has no dedup guard on its own `/api/auth/refresh` call and races under React Strict Mode's double-effect-firing. Since that investigation's root cause (full-page reloads from sidebar `<a>` tags) is now fixed, does `SessionHydrator` still mount fresh in the scenario you're reproducing here, or does it only mount once now (at the initial page load) and stay mounted through subsequent client-side navigation? This matters for whether the previously-identified refresh-race is even reachable via this new symptom, or whether this is a genuinely distinct mechanism.

6. **Once 1-5 are answered, state a root-cause hypothesis for why `documents.list` returns 401 in the first place** in this scenario (natural token expiry during the session? something to do with how the page was reached? a different bug entirely?), and trace what happens after line 48's `window.location.href = '/login'` fires — specifically, does this then trigger a _fresh_ mount of `SessionHydrator` (since it's a full page reload), and does that fresh mount succeed or fail, and does its outcome matter given the user is already being sent to `/login` regardless by that point?

## What NOT to do

- **Do not modify `apps/web/src/lib/trpc.ts`, `SessionHydrator.tsx`, `RequireAuth.tsx`, or any other application code as a permanent change.** Temporary debug logging added during reproduction (per step 3) must be removed before you finish.
- **Do not propose or write a fix.** This task is investigation and reporting only. If your investigation reveals an obvious, narrow, low-risk fix, you may mention it as a suggestion in your report, clearly labeled as a suggestion, but do not implement it.
- **Do not assume the prior sidebar-bug investigation's conclusions transfer to this symptom without checking.** That investigation was about full-page reloads triggered by `<a>` tags on sidebar clicks. This symptom's trigger (whatever it turns out to be) may be entirely different, even though the visible end state (landing on `/login`) looks similar.
- **Do not touch `AGENTS.md`, `A1-AGENTS.md`, `document-list.md`, or any Group B-L document**, per this project's standing convention.
- **Do not read any `.bak` file**, per this project's standing convention.

## What to produce

A written report (not a code diff) containing:

- Your answer to each of the 6 numbered questions above, each labeled Confirmed / Inference / Unresolved as specified.
- Any raw evidence you gathered (HAR excerpts, DevTools screenshots described in text, console output) that supports your answers.
- If you determine this genuinely is a new, distinct bug requiring a fix, do not fix it — instead, describe what you found in enough detail that a follow-up standalone fix-specification prompt could be written from your report alone, the same way this investigation itself was specified in enough detail to run without any other context.
- If you believe this finding warrants an entry in `docs/development-findings-log.md`, read that file's own header (top of the file, before the entries begin) for its exact required format and rules before writing one — do not guess the format from skimming existing entries alone, since the header documents constraints (like required fields and numbering rules) that aren't always obvious from the entries themselves. Use `task_id: TASK-IAM-INV-001` for this entry if you add one, since that's this task's actual identifier, not a fabricated `TASK-XXX-NNN`-style number.

---

# TASK-UI-042

## Task ID: TASK-UI-042

## File: `packages/ui/src/components/domain/Sidebar.tsx`

## Background you need (you have no access to any prior conversation — this is everything relevant)

This file was recently changed so that enabled sidebar nav items render as React Router `Link` components instead of plain HTML `<a>` tags (fixing a full-page-reload bug). That change works correctly at runtime, but it introduced a `Tag = ... as any` cast to work around a TypeScript structural-typing conflict. This task removes that cast by restructuring the code, without changing any rendered output, styling, or behavior.

## Current exact content of the relevant block (lines 69–116 of the current file — verify this matches before editing; if it doesn't, stop and report the mismatch rather than proceeding)

```tsx
{
  items.map((item) => {
    const isActive = item.id === activeItemId;
    const Tag = (item.href && !item.disabled ? Link : 'button') as any;
    const itemProps = Tag === Link ? { to: item.href } : { type: 'button' as const };

    const element = (
      <Tag
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        tabIndex={item.disabled ? -1 : undefined}
        className={cn(
          'duration-fast focus-visible:outline-warning-500 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          isActive
            ? 'bg-primary-700 border-l-warning-500 border-l-2 font-semibold text-white'
            : 'text-primary-200 hover:bg-primary-800 hover:text-white',
          item.disabled && 'pointer-events-none cursor-not-allowed opacity-40',
          collapsed && 'mx-auto h-10 w-10 justify-center px-0',
        )}
        {...itemProps}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={cn(collapsed ? 'sr-only' : 'truncate')}>{item.label}</span>
        {!collapsed && item.badge !== undefined && item.badge > 0 ? (
          <span className="bg-danger-500 touch-exempt ml-auto min-h-0 min-w-0 rounded-full px-1.5 py-0.5 text-xs font-medium text-white">
            {item.badge}
          </span>
        ) : null}
      </Tag>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{element}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <React.Fragment key={item.id}>{element}</React.Fragment>;
  });
}
```

## Why the cast exists (so you understand what you're removing, not just replacing text blindly)

`Tag` is assigned either the `Link` component reference or the string literal `"button"`. `itemProps` is a union of `{ to: string }` and `{ type: "button" }`. Spreading a union-typed props object (`{...itemProps}`) onto a variable holding a union of a component reference and a string literal (`<Tag ...>`) is a pattern TypeScript's structural checker cannot reliably resolve on its own — it needs the "which tag" and "which props" halves correlated, and a plain union of two independently-declared variables doesn't carry that correlation. The `as any` cast was added specifically to suppress the resulting type error. It works at runtime but disables type-checking on this entire JSX element, including for any future edits.

## Required replacement

Replace the block above with:

```tsx
{
  items.map((item) => {
    const isActive = item.id === activeItemId;
    const isLink = Boolean(item.href) && !item.disabled;

    const sharedClassName = cn(
      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500',
      isActive
        ? 'bg-primary-700 text-white font-semibold border-l-2 border-l-warning-500'
        : 'text-primary-200 hover:bg-primary-800 hover:text-white',
      item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
      collapsed && 'justify-center px-0 w-10 h-10 mx-auto',
    );

    const sharedChildren = (
      <>
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={cn(collapsed ? 'sr-only' : 'truncate')}>{item.label}</span>
        {!collapsed && item.badge !== undefined && item.badge > 0 ? (
          <span className="bg-danger-500 touch-exempt ml-auto min-h-0 min-w-0 rounded-full px-1.5 py-0.5 text-xs font-medium text-white">
            {item.badge}
          </span>
        ) : null}
      </>
    );

    const element = isLink ? (
      <Link
        to={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        tabIndex={item.disabled ? -1 : undefined}
        className={sharedClassName}
      >
        {sharedChildren}
      </Link>
    ) : (
      <button
        type="button"
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        tabIndex={item.disabled ? -1 : undefined}
        className={sharedClassName}
      >
        {sharedChildren}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{element}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <React.Fragment key={item.id}>{element}</React.Fragment>;
  });
}
```

## Design reasoning, so you understand what NOT to "improve" while implementing this

- **`isLink`'s definition (`Boolean(item.href) && !item.disabled`) preserves the exact original condition** (`item.href && !item.disabled`) that previously decided `Tag`. Do not simplify or alter this condition.
- **`tabIndex={item.disabled ? -1 : undefined}` appears identically on both branches even though it will always evaluate to `undefined` on the `Link` branch** (since `isLink` is only true when `!item.disabled`). This is not a mistake to "clean up" — the original code had this same redundancy (the original `Tag === Link` branch was reached under the identical condition), and this task is a pure typing refactor, not a behavior audit. Leave it exactly as specified above.
- **An alternative approach — a typed discriminated union with a single shared render call — was considered and deliberately not used**, because narrowing a discriminated union correctly through a JSX spread is not something that can be verified without running a real TypeScript compiler, and getting it wrong would likely reproduce the same class of error this task is meant to eliminate. The explicit two-branch approach above trades a small amount of duplication (six shared attributes appear twice) for having every JSX element be a plain, non-polymorphic tag that TypeScript can check directly with no cast anywhere. If you have a way to verify a discriminated-union approach actually narrows cleanly in this exact codebase's TS/JSX configuration and prefer it, you may use it instead — but only if you can verify it compiles cleanly with zero `any`/`as any` anywhere in the result; otherwise use the version specified above exactly as written.
- **Do not extract `sharedClassName` or `sharedChildren` any further** (e.g., into a separate component or a hook) — keep them as local `const`s inside the `.map()` callback exactly as shown, so the diff stays narrowly scoped to this one block.

## Out of scope — do not touch

- Any file outside `packages/ui/src/components/domain/Sidebar.tsx`.
- The `Tooltip`/`TooltipTrigger`/`TooltipContent` wrapping logic (the `if (collapsed) { ... }` block and the `React.Fragment` fallback) — these consume `element` as an opaque value and require no changes.
- The `NavItem` or `SidebarProps` interfaces.
- Any import statement other than what's already present (no new imports should be needed — `Link` is already imported at the top of the file).
- Any className, ARIA attribute value, or piece of child JSX — every one of these must produce byte-identical rendered output to the current code for a given `item`/`isActive`/`collapsed` combination. This task changes TypeScript's ability to check the code, not what the code renders.

## Verification steps (required, in this order)

1. **Run the monorepo typecheck** (`pnpm typecheck` at the repo root, or whatever the current `package.json` `typecheck` script resolves to — check `package.json`'s `scripts` field for the exact command rather than assuming). Confirm zero `any`/`as any` remain anywhere in `Sidebar.tsx` (search the file directly: `grep -n "any" packages/ui/src/components/domain/Sidebar.tsx` and manually confirm every remaining match, if any, is unrelated to this change — e.g. a comment or an unrelated identifier containing the substring "any" — not a reintroduced cast).
2. **Confirm the typecheck passes with no new errors** anywhere in the monorepo, not just in this file — a change to a shared `packages/ui` component can surface type errors in any consumer.
3. **Visually verify via the dev-preview route** `/dev/components/sidebar` (file: `apps/web/src/pages/dev/SidebarPage.tsx`) if you can run the dev server: check collapsed state, expanded state, active-item highlighting, disabled items, and badges all still render identically to before this change. Do not modify `SidebarPage.tsx` unless you find it's genuinely broken by this change (it should not be, since `element`'s consumers are unchanged) — if you do need to modify it, stop and report why rather than proceeding silently.
4. **Search for and run any existing tests covering `Sidebar.tsx`** under any `__tests__` directory in `packages/ui` or `apps/web`. If none exist, do not add new tests as part of this task unless you find the typecheck or visual verification reveals a real behavioral difference from before — this task's scope is a typing refactor with no intended behavior change, not new test coverage.

## Definition of done

- `Sidebar.tsx`'s nav-item rendering block contains zero `any`/`as any` casts.
- Every className, ARIA attribute, and piece of child content is unchanged from before this task for every combination of `item`, `isActive`, and `collapsed`.
- Monorepo typecheck passes with zero errors.
- No file other than `packages/ui/src/components/domain/Sidebar.tsx` is modified, unless step 3's dev-preview check reveals a genuine break, in which case report that finding explicitly rather than silently fixing it in a second file.

---

# TASK-DOCS-XXX: Wire up drizzle-zod for documents.ts Select schemas

## Context (why this task exists — no external references needed)

`packages/shared/src/schemas/documents.ts` contains hand-written Zod
schemas. Some of these are tagged "Select" schemas (per the type
conventions documented in
`docs/pre-development/E-api-design/e3-shared-zod-schema-catalog.md`,
Conventions → Schema Type Tags) — meaning they represent the full
row-shape of a database table, minus a documented set of exclusions, and
are used as API response types.

Right now these Select schemas are maintained entirely by hand, with no
mechanical link back to the actual Drizzle table definitions in
`packages/database/schema/documents.schema.ts`. This has already caused
one real, confirmed incident: `LifecycleStateSchema` in `documents.ts`
was defined with 9 enum values that did not match the actual 11-value
`documents_lifecycle_state_check` constraint in the database. It was
caught by manual review, not by the type system (see
`docs/development-findings-log.md`, entry `[LOG-0027]`, `status:
proposed`, for the full history — do not edit that log entry, it is
already accurate).

This task closes that gap using the `drizzle-zod` package, which
generates Zod schemas directly from Drizzle table definitions so a
database column change becomes a TypeScript compile error in the Zod
layer, instead of a silent runtime mismatch.

**Scope of this task, explicitly:** this task converts ONLY the Select
schemas currently defined in `packages/shared/src/schemas/documents.ts`
that map to the `documents` and `versions` tables specifically
(`DocumentSelectSchema` and `VersionSelectSchema`). It does NOT touch:

- Any other file in `packages/shared/src/schemas/` (`common.ts`,
  `document-metadata.ts`, `organization.ts`) — these are out of scope
  for this pass and must be left exactly as they are.
- Any Select schema in `documents.ts` other than `DocumentSelectSchema`
  and `VersionSelectSchema` — specifically, do NOT touch
  `DocumentTypeSelectSchema`, `AttachmentSelectSchema`,
  `DocumentNumberSelectSchema`, `SignatureSelectSchema`, or
  `PanlalawiganReviewSelectSchema` in this pass, even though they have
  the same underlying gap. They are intentionally deferred to a
  follow-up task (see "What to log" below for how to record this).
- Any Input, Filter, Response, or Params-tagged schema anywhere in the
  file (e.g. `LogDocumentInputSchema`, `CreateDocumentInputSchema`,
  `ListDocumentsOutputSchema`, etc.). Per E3's own Schema Type Tags
  convention, only Select schemas are required to be Drizzle-derived;
  Input/Filter/Response schemas are documented as intentionally custom
  and often differing from the DB row shape. Do not modify any of these.
- `packages/database/schema/*.ts` (the Drizzle table definitions
  themselves) — this task consumes those definitions, it does not
  change them.

If you find yourself wanting to touch a file or schema not listed above,
stop and flag it rather than proceeding — it's out of scope even if it
looks like the same category of fix.

---

## Part 1 — Add the `drizzle-zod` dependency

Add `drizzle-zod` version `^0.8.3` as a dependency (not devDependency) to
`packages/shared/package.json`. This is the first version of
`drizzle-zod` compatible with the Zod version already resolved in this
package (`zod@3.25.76`, confirmed via `pnpm-lock.yaml` at the time this
task was written — re-confirm the currently-resolved version before
proceeding, in case it has changed since). Do not add `drizzle-zod` to
any other package's `package.json` — this task only needs it in
`packages/shared`.

After adding it, run `pnpm install` at the repo root so the lockfile
picks up the new dependency, then confirm via `pnpm why drizzle-zod
--filter @batac/shared` (or equivalent) that it resolved against
`zod@3.25.76` and not a different Zod instance.

**Do not add `drizzle-zod` to `apps/web`** or attempt to reconcile it
against `apps/web`'s `zod@4.4.3`. That is a separate, already-identified
issue (the Zod 3/4 split across the monorepo) and is explicitly out of
scope for this task.

---

## Part 2 — Give `packages/shared` a way to import from `packages/database`

Today, `packages/shared/package.json` does not declare `@batac/database`
as a dependency at all, and `packages/database/package.json` has no
`exports`, `main`, or `types` field defined. `apps/server` currently
imports from `packages/database` using deep subpath imports that work
because there is no `exports` field to restrict them — for example:

```typescript
import { auditEvents } from '@batac/database/schema/audit.schema.js';
```

This pattern must keep working after this task. **Do not add an
`exports` field to `packages/database/package.json`** as part of this
task — doing so would require enumerating every subpath `apps/server`
currently imports (there are many, across `audit.schema.js`,
`iam.schema.js`, `documents.schema.js`, `organization.schema.js`,
`tracking.schema.js`, `workflow.schema.js`, `shared.schema.js`, and
possibly others — grep `apps/server/src` for
`from '@batac/database/schema/` to see the current full set before
touching anything here if you are ever tempted to add an `exports`
field), and getting that enumeration wrong would silently break
`apps/server`'s existing imports. Leave `packages/database/package.json`
resolution mechanism (no `exports` field) exactly as it is.

What you DO need to do:

1. Add `"@batac/database": "workspace:*"` as a dependency in
   `packages/shared/package.json`, matching the exact same version
   specifier style already used for this in `apps/server/package.json`.
2. In `packages/shared/src/schemas/documents.ts`, import the two
   specific Drizzle table objects you need using the same deep-import
   pattern already established in `apps/server`:

```typescript
import { documents, versions } from '@batac/database/schema/documents.schema.js';
```

3. Run `pnpm install` again after this change, then run `pnpm --filter
@batac/shared typecheck` (this runs `tsc --noEmit` per the script
   already defined in `packages/shared/package.json`). Confirm this
   import resolves with zero errors before proceeding to Part 3. If it
   does not resolve, stop and report the exact error — do not attempt
   workarounds (e.g. relative-path imports crossing the package
   boundary, or copying the schema file) without checking back in
   first, since a resolution failure at this step likely means an
   assumption in this prompt about the existing module resolution setup
   was wrong and needs to be revisited, not patched around.

---

## Part 3 — Convert `DocumentSelectSchema`

Current code (`packages/shared/src/schemas/documents.ts`, lines 114–138
as of this task being written — re-locate by content if line numbers
have shifted):

```typescript
export const DocumentSelectSchema = z.object({
  id: UuidSchema,
  documentTypeId: UuidSchema,
  documentType: DocumentTypeSummarySchema,
  title: z.string().min(1),
  lifecycleState: LifecycleStateSchema,
  classificationLevel: ClassificationLevelSchema,
  qrTrackingNumber: UuidSchema,
  preliminaryNumber: z.string().nullable(),
  finalNumber: z.string().nullable(),
  controlNumber: z.string().nullable(),
  originatingOfficeId: UuidSchema,
  originatingOffice: OfficeSummarySchema,
  ownedByOfficeId: UuidSchema,
  createdBy: UuidSchema,
  workflowInstanceId: UuidSchema.nullable(),
  versionNumber: z.number().int().min(1),
  metadata: z.record(z.unknown()),
  supersededBy: UuidSchema.nullable(),
  supersededAt: TimestampSchema.nullable(),
  closureReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type DocumentSelect = z.infer<typeof DocumentSelectSchema>;
```

The actual `documents` Drizzle table
(`packages/database/schema/documents.schema.ts`) has MORE columns than
this schema exposes: `cityId`, `numberSeriesId`, `draftedByEmployeeId`,
`retentionScheduleId`, `tsv`, `deletedAt`, `deletedBy` all exist on the
table but are absent from this schema. **This is confirmed intentional,
not something to fix** — this exact set of fields, in this exact
schema, already matches what
`docs/pre-development/E-api-design/e3-shared-zod-schema-catalog.md`
itself specifies at its own `DocumentSelectSchema` entry (search that
file for `#### \`DocumentSelectSchema\` — Select` to see it). Do not add
these columns to the schema. Part 5 of this task adds a written rule to
E3 explaining why fields like these are excluded, so this stops being
an implicit, undocumented pattern — but the fields themselves stay
excluded here.

Two fields on `DocumentSelectSchema` are NOT raw columns from the
`documents` table at all — `documentType` (a
`DocumentTypeSummarySchema`) and `originatingOffice` (an
`OfficeSummarySchema`). These are joined/enriched objects assembled by
whatever repository or router code currently populates this schema
(check `apps/server/src/modules/documents/documents.router.ts` and
`documents.repository.ts` for where `DocumentSelectSchema`-shaped
objects are constructed, to see the existing join pattern — you do not
need to change that join logic, only understand it well enough to know
these two fields cannot come from `createSelectSchema()` directly).

**What to do:**

Rewrite `DocumentSelectSchema` to be built from `createSelectSchema()`
on the `documents` table, using field-level refinement overrides for:

- Every column that needs to be entirely excluded (the ones listed
  above: `cityId`, `numberSeriesId`, `draftedByEmployeeId`,
  `retentionScheduleId`, `tsv`, `deletedAt`, `deletedBy`) — use `.omit()`
  after generation, e.g. `createSelectSchema(documents).omit({ cityId:
true, numberSeriesId: true, draftedByEmployeeId: true,
retentionScheduleId: true, tsv: true, deletedAt: true, deletedBy: true
})`.
- Every column whose auto-generated type needs a refinement to match
  the existing hand-written schema's validation behavior exactly (for
  example, `title` currently has `.min(1)` and `versionNumber` currently
  has `.min(1)` — check whether `createSelectSchema()`'s default
  generated type for these columns already includes equivalent
  constraints, and if not, add them back via the refinement-callback
  syntax: `createSelectSchema(documents, { title: (schema) =>
schema.min(1), versionNumber: (schema) => schema.min(1) })`. Do not
  assume the defaults match — check the actual generated type, e.g. by
  temporarily logging or inspecting `._def` in a scratch script, or by
  writing the equality check described in Part 4 below and letting a
  failing test tell you.)
- Then `.extend()` the two composite fields onto the result:
  `documentType: DocumentTypeSummarySchema` and `originatingOffice:
OfficeSummarySchema` (these keep their exact current definitions,
  unchanged — only their surrounding schema's construction mechanism
  changes).

The final exported `DocumentSelectSchema` must produce the exact same
`z.infer` shape as the current hand-written version — same field names,
same optionality/nullability, same set of fields. This is a mechanical
refactor of _how_ the schema is constructed, not a change to _what_ it
validates. If your refactor changes the inferred type in any way (a
field becomes optional that wasn't before, a nullable becomes optional
or vice versa, a validation constraint is lost or gained), that is a
bug in this task's execution, not an intentional improvement — fix it
to match the current behavior exactly, or if you believe the current
behavior is itself wrong, stop and flag that as a separate finding
rather than silently changing it as part of this refactor.

---

## Part 4 — Convert `VersionSelectSchema`, and fix the `s3Key`/`fileKey` naming mismatch

Current code (`packages/shared/src/schemas/documents.ts`, around lines
269–284 as of this task being written):

```typescript
export const VersionSelectSchema = z.object({
  id: UuidSchema,
  documentId: UuidSchema,
  versionNumber: z.number().int().min(1),
  s3Key: z.string(),
  originalFilename: z.string().nullable(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().positive(),
  pageCount: z.number().int().positive().nullable(),
  scanQualityScore: z.number().min(0).max(1).nullable(),
  scanQualityCategory: ScanQualityCategorySchema.nullable(),
  ocrProcessed: z.boolean(),
  uploadedBy: UuidSchema,
  createdAt: TimestampSchema,
});
export type VersionSelect = z.infer<typeof VersionSelectSchema>;
```

**Confirmed naming/type mismatch:** the actual `versions` Drizzle table
column is named `fileKey`, typed `uuid('file_key')` — not `s3Key`, and
not a plain string. This is not accidental drift on the database side:
`docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md`,
Part 14 (Invariant and Non-Negotiable Compliance Checklist), invariant
#5, states explicitly: "S3 file keys are UUIDs, never original
filenames," with the stated mechanism being `versions.file_key UUID`,
`attachments.file_key UUID`. The database-side naming and typing is the
one to keep; the Zod schema's `s3Key: z.string()` is what needs to
change, to `fileKey: UuidSchema` (using the existing `UuidSchema` from
`./common.js`, already imported in this file).

**Also confirmed:** the table has an `uploadedBy`-equivalent mismatch —
the actual column is named `createdBy`, not `uploadedBy`, and the table
also has `verifiedBy`/`verifiedAt` columns not present in this schema at
all. Per this task's scope, only fix the `s3Key`/`fileKey` mismatch (that
was the specifically-decided fix for this task). Leave
`uploadedBy`/`createdBy` and the missing `verifiedBy`/`verifiedAt` fields
alone for now — record them as a follow-up finding per "What to log"
below, do not fix them in this pass. (Rationale for not fixing them now:
unlike `s3Key`/`fileKey`, there is no equivalent invariant-level
documentation confirming which name/shape is correct, so unlike the
`fileKey` case this needs its own decision, not a mechanical fix
bundled into this task.)

**What to do:**

1. Convert `VersionSelectSchema` to be built from `createSelectSchema()`
   on the `versions` table, following the same approach as Part 3:
   `.omit()` for columns to exclude entirely (`cityId`, `ocrText` — this
   one is on E3's explicit Sensitive Field Policy exclusion list, see
   Conventions → Sensitive Field Policy — `tsv`, `verifiedBy`,
   `verifiedAt`, `requiresManualVerification`), refinement callbacks or
   field overrides for anything that needs a specific constraint added
   back (check `versionNumber` needs `.min(1)`, `fileSizeBytes` needs
   `.positive()`, `pageCount` needs `.positive()`, `scanQualityScore`
   needs `.min(0).max(1)` — verify each against the current
   hand-written schema and the actual generated defaults, the same way
   as Part 3).
2. Rename the field from `s3Key` to `fileKey` in the resulting schema,
   and change its type from `z.string()` to `UuidSchema`. If you're
   using `createSelectSchema()`'s native field naming (which will
   already produce `fileKey` since that's the actual column name), this
   rename may happen automatically as a side effect of the conversion —
   confirm the final schema has a `fileKey: UuidSchema`-shaped field
   and does NOT have an `s3Key` field at all.
3. Update the one live consumer of this schema:
   `apps/server/src/modules/documents/documents.router.ts`, inside the
   `getVersionHistory` procedure (search for `.output(z.array(VersionSelectSchema))`
   to find it). The `.query()` handler currently does:

```typescript
const versions = await repo.findVersionsByDocument(input.documentId);
return versions.map((v) => ({
  id: v.id,
  documentId: v.documentId,
  versionNumber: v.versionNumber,
  s3Key: v.fileKey,
  originalFilename: v.originalFilename,
  mimeType: v.mimeType,
  fileSizeBytes: v.fileSizeBytes ?? 0,
  pageCount: v.pageCount,
  scanQualityScore: v.scanQualityScore ? Number(v.scanQualityScore) : null,
  scanQualityCategory: v.scanQualityCategory as any,
  ocrProcessed: v.ocrProcessed,
  // ...(there may be more fields after this in the actual file —
  // read the full mapping before editing, this excerpt may not be
  // complete)
}));
```

Change `s3Key: v.fileKey,` to `fileKey: v.fileKey,`. Do not change
anything else in this handler, including the pre-existing `as any`
cast on `scanQualityCategory` — that is a separate, unrelated issue
and is out of scope for this task. Do not attempt to simplify or
remove this manual field-mapping object entirely (e.g. by having the
repository return an already-correctly-shaped object and just
passing it through) — that would be a larger refactor than this task
asks for; the minimal fix is the one field rename. 4. Search the rest of the codebase for any other place that constructs
an object intended to satisfy `VersionSelectSchema`'s shape (as
opposed to the many OTHER, unrelated `s3Key` usages that belong to
different schemas and different tables entirely — see the warning
below) and apply the same one-field rename if you find any. As of
this task being written, the `getVersionHistory` handler above is
the only one — but re-verify this, since the codebase may have
changed since this prompt was written.

**Important warning — do not rename `s3Key` anywhere else.** A repo-wide
search for `s3Key` will turn up many results that are NOT part of this
fix and must NOT be touched:

- `s3Key` fields in Input/Output schemas (`UploadNewVersionInputSchema`,
  `UploadAttachmentInputSchema`, `RequestUploadUrlOutputSchema`,
  `ConfirmUploadInputSchema`, and others in this same file) — these are
  Input/Response-tagged schemas, not Select schemas, and are explicitly
  out of scope per this task's Context section above.
- `s3Key` in `packages/shared/src/schemas/document-metadata.ts` — this
  is inside JSONB metadata sub-schemas, which validate the shape of
  arbitrary JSON content stored in a `jsonb` column, not a set of typed
  SQL columns. There is no Drizzle table structure to derive this from;
  leave it untouched.
- `s3Key` in `apps/server/src/modules/documents/signatures.router.ts`
  (and the `signatures` table's actual `signatureImageS3Key` /
  `signature_image_s3_key` column, which is a `text` column, genuinely
  named with "s3_key" in the database itself, and correctly typed as a
  string already) — this is a different table, a different column, and
  the current naming is already correct. Do not touch it.
- `s3Key` variables and parameters inside
  `apps/server/src/modules/documents/documents.router.ts` (the
  `requestUploadUrl` procedure, around where `crypto.randomUUID()` is
  called) and `ocr.service.ts` — these represent the presigned-upload-URL
  flow's request/response naming, which is a legitimate, separate
  naming choice at a different point in the data flow (before the value
  is ever persisted as `versions.fileKey`). Do not rename these.
- `s3Key` in `apps/web/src/pages/documents/DocumentDetailPage.tsx` and
  `DocumentIntakePage.tsx` — frontend consumers of the
  upload-flow schemas mentioned above, not of `VersionSelectSchema`. Do
  not touch these files at all in this task.

If you are unsure whether a given `s3Key` occurrence is in scope, it is
not — the only two edits described above (the schema definition itself,
and the one `documents.router.ts` line inside `getVersionHistory`) are
the full extent of this rename.

---

## Part 5 — Add a governance rule to E3 documenting the field-exclusion convention

`docs/pre-development/E-api-design/e3-shared-zod-schema-catalog.md` has
a "Part 16 — Schema Enforcement Rules" section (currently 8 numbered
rules, ending around line 3243 as of this task being written — locate
by heading text, not line number, since E3's line numbers may have
shifted; it is followed immediately by a closing italicized paragraph
starting "This document supersedes any locally-defined schema
definitions..." — insert your new rule before that closing paragraph).

Add a new numbered rule (rule 9, following rule 8's numbering) with
this content:

```markdown
9. **Session-derived and internal-mechanism columns are excluded from
   Select schemas by default.** The following categories of column are
   omitted from every Select schema in this catalog, even though they
   exist on the underlying table, unless a specific consumer has an
   explicit, documented need to read them:
   - `city_id` — inferred from the authenticated session; never a value
     the client needs to read back (see the existing note on
     `UserSelectSchema` at Part 2 for the precedent this generalizes).
   - `tsv` (and any other full-text-search vector column) — an internal
     search-indexing artifact, not meaningful to any API consumer.
   - `deleted_at` / `deleted_by` — soft-delete bookkeeping columns
     present on every table per ADR-GEN-008. Active-record queries
     already filter `WHERE deleted_at IS NULL`, so these columns are
     `NULL` for every row a normal Select schema would ever describe.
     A future admin-facing "show deleted records" feature may need a
     schema that explicitly includes them — if so, that should be a
     distinctly-named schema (e.g. `DocumentSelectWithDeletionMetadataSchema`),
     not a change to the default Select schema.

   When using `drizzle-zod`'s `createSelectSchema()` as the basis for a
   Select schema, apply `.omit()` for these columns explicitly rather
   than relying on the schema author to remember to leave them out by
   hand. This rule does not create new exclusions — it documents a
   pattern already followed by `DocumentSelectSchema`,
   `VersionSelectSchema`, and `AttachmentSelectSchema` prior to this
   rule being written down.
```

Do not renumber or otherwise edit rules 1–8. Do not touch any other part
of E3 — specifically, do not update the `DocumentSelectSchema` or
`VersionSelectSchema` documentation entries elsewhere in E3 (around the
"Core Document Schemas" section) to reflect the `drizzle-zod`-based
construction from Parts 3–4 above; E3 documents the _target shape_
schemas must produce, and that target shape is unchanged by this task
— only _how_ the code produces that shape has changed. Updating E3's
code samples to show the new `createSelectSchema()`-based construction
is a reasonable follow-up but is not part of this task; note it in the
findings log instead (see below).

**Do not touch the Table of Contents at the top of E3** — per project
convention, ToC line numbers are maintained manually by a human and must
never be recalculated or edited by an agent, even incidentally as a
side effect of adding content elsewhere in the document.

---

## Verification steps (all required, in this order)

1. `pnpm --filter @batac/shared typecheck` — must pass with zero errors.
   This is the primary correctness check, since `packages/shared` has no
   existing test suite (confirmed: no `.test.ts`/`.spec.ts` files exist
   under `packages/shared`, and there is no `test` script in its
   `package.json` as of this task being written).
2. Write a small, standalone verification script (does not need a test
   framework — `packages/shared` has none installed, and this task does
   not add one) that:
   - Imports `DocumentSelectSchema` and `VersionSelectSchema` from the
     updated `documents.ts`.
   - Constructs one realistic, fully-populated mock object per schema
     (matching every field's real type) and calls `.parse()` on it,
     confirming it succeeds.
   - Constructs one intentionally-invalid object per schema (e.g. an
     invalid `lifecycleState` value, a non-UUID `fileKey`) and confirms
     `.parse()` throws.
     Run this script with `tsx` (already a devDependency in
     `packages/database`, may need adding to `packages/shared` — check
     first) or `node --loader` equivalent, save it as a throwaway script
     in `/tmp` or similar, and delete it after confirming it passes. Do
     not commit this script to the repo — it is a manual verification
     step, not a permanent test file. (Setting up a real, permanent test
     suite for `packages/shared` using `vitest`, matching the convention
     already established in `apps/server`, is a reasonable follow-up but
     is out of scope for this task — note it as a finding instead of
     doing it here.)
3. `pnpm --filter server typecheck` (or the equivalent workspace filter
   for `apps/server` — confirm the exact filter name from
   `apps/server/package.json`'s `name` field before running) — must
   pass with zero errors, confirming the `documents.router.ts` change in
   Part 4 didn't break anything downstream.
4. Confirm via `grep -rn "s3Key" packages/shared/src/schemas/documents.ts`
   that it returns zero results (the field has been fully renamed out
   of this file) — this is a simple, mechanical way to confirm Part 4
   was applied completely.

If any of these steps fail, stop and report the exact failure rather
than attempting speculative fixes beyond what this prompt specifies.

---

## What to log

Append an entry to `docs/development-findings-log.md` (append-only,
bottom of file, following the exact format already used by existing
entries — read the log file's own header for the format spec before
writing, per AGENTS.md Section 4.5) recording:

- That this task added `drizzle-zod` and converted
  `DocumentSelectSchema` and `VersionSelectSchema` to be
  Drizzle-derived, as a deliberately narrow first pass.
- That `DocumentTypeSelectSchema`, `AttachmentSelectSchema`,
  `DocumentNumberSelectSchema`, `SignatureSelectSchema`, and
  `PanlalawiganReviewSelectSchema` in the same file still need the same
  conversion, as follow-up work.
- That the same drizzle-zod plumbing gap (no schemas at all yet, not
  even hand-written ones) exists for the IAM, workflow, tracking,
  records, notifications, audit, attendance, and dashboard domains
  referenced in E3's own "File Organization" section — those files
  (`schemas/iam.ts`, `schemas/workflow.ts`, etc.) do not exist yet in
  `packages/shared/src/schemas/` at all. Separately, note that IAM
  schemas currently live in
  `apps/server/src/modules/iam/iam.schemas.ts`, which is a
  locally-defined schema file inside `apps/server` — this appears to
  violate E3's own Rule 1 ("No locally-defined entity schemas... A
  locally-defined entity schema in `/apps/web` or `/apps/server` fails
  review"), but resolving that is a separate, likely larger task and is
  not part of this one.
- That `VersionSelectSchema`'s `uploadedBy`/`createdBy` naming mismatch
  and its missing `verifiedBy`/`verifiedAt` fields (found during this
  task but explicitly not fixed, per Part 4 above) still need a
  decision and a fix.
- Status: `proposed` (per AGENTS.md Section 4.5 — only a human moves
  entries to `confirmed`).

This is informative context for whoever picks up the follow-up work — it
is not a request for you to do any of the follow-up items listed above
in this same task.

---

# TASK-DOCS-SHARED-001

```
TASK-DOCS-SHARED-001

Title: Fix runtime-crashing DocumentSelectSchema/VersionSelectSchema; remove
scratch debris from packages/shared root

═══════════════════════════════════════════════════════════════════════════
BACKGROUND (for your own context — not something to re-verify, but included
so you understand why this is urgent)
═══════════════════════════════════════════════════════════════════════════

packages/shared/src/schemas/documents.ts exports DocumentSelectSchema and
VersionSelectSchema, both built with z.intersection() combining a
drizzle-zod-derived schema (cast `as any`) with a hand-written z.object().
This construction currently crashes unconditionally, synchronously, on
every single call to .parse()/.safeParse()/.parseAsync() — including via
.safeParse(), which is specifically designed to never throw. The error is:

    TypeError: this._def.left._parseSync is not a function
        at ZodIntersection._parse

Root cause: the installed drizzle-zod@0.8.3's type declarations statically
import from the 'zod/v4' compatibility branch, while this file imports `z`
from plain 'zod' (the classic v3 branch). Both branches run against the
same physical zod@3.25.76 package at runtime, but are structurally
incompatible Zod schema types. The `as any` cast silences the resulting
TypeScript error but does not fix the underlying runtime shape mismatch —
the object z.intersection() receives at runtime is not shaped the way its
internals expect, so it throws.

This directly breaks three live tRPC procedures, all in
apps/server/src/modules/documents/documents.router.ts: documents.get
(line 430), documents.update (line 612), and documents.getVersionHistory
(line 862, via z.array(VersionSelectSchema)). tRPC's output-validation
middleware wraps the parse call in try/catch and converts the throw into a
TRPCError (code: INTERNAL_SERVER_ERROR, message: "Output validation
failed") — so this will not crash the server process, but it means these
three procedures return a 500 error to every caller, on every single
invocation, unconditionally. This is a live, deterministic, 100%-reproduction
production bug, not an edge case.

═══════════════════════════════════════════════════════════════════════════
PART 1 — THE FIX
═══════════════════════════════════════════════════════════════════════════

Two independent changes are both required. Do not do one without the other
— either alone leaves either the runtime crash or the drift-detection defeat
unresolved.

--- 1a. Pin drizzle-zod to a classic-branch-compatible version ---

File: packages/shared/package.json

Current (line 25):
    "drizzle-zod": "^0.8.3",

Change to:
    "drizzle-zod": "0.7.1",

(Exact pin, not a caret range — 0.8.0 through 0.8.3+ all carry the same
zod/v4-branch typing that causes this bug; pinning without a caret prevents
an automatic bump back into that range.)

Confirmed compatible: drizzle-zod@0.7.1's peer dependency range for
drizzle-orm is ">=0.36.0" (checked directly against the npm registry),
which the project's installed drizzle-orm@0.45.2 satisfies.

After editing package.json, run from the repo root:
    pnpm install --filter @batac/shared

Then verify the resolved version:
    pnpm why drizzle-zod --filter @batac/shared
(Confirm it resolves to 0.7.1, not 0.8.x.)

--- 1b. Replace the z.intersection() constructions with .shape-spread ---

File: packages/shared/src/schemas/documents.ts

Replace the ENTIRE current DocumentSelectSchema declaration (currently
lines 116–150, from `export const DocumentSelectSchema = z.intersection(`
through the closing `);`) with:

    export const DocumentSelectSchema = z.object({
      ...createSelectSchema(documents).omit({
        cityId: true,
        numberSeriesId: true,
        draftedByEmployeeId: true,
        retentionScheduleId: true,
        tsv: true,
        deletedAt: true,
        deletedBy: true,
      }).shape,
      id: UuidSchema,
      documentTypeId: UuidSchema,
      documentType: DocumentTypeSummarySchema,
      title: z.string().min(1),
      lifecycleState: LifecycleStateSchema,
      classificationLevel: ClassificationLevelSchema,
      qrTrackingNumber: UuidSchema,
      preliminaryNumber: z.string().nullable(),
      finalNumber: z.string().nullable(),
      controlNumber: z.string().nullable(),
      originatingOfficeId: UuidSchema,
      originatingOffice: OfficeSummarySchema,
      ownedByOfficeId: UuidSchema,
      createdBy: UuidSchema,
      workflowInstanceId: UuidSchema.nullable(),
      versionNumber: z.number().int().min(1),
      metadata: z.record(z.unknown()),
      supersededBy: UuidSchema.nullable(),
      supersededAt: TimestampSchema.nullable(),
      closureReason: z.string().nullable(),
      createdAt: TimestampSchema,
      updatedAt: TimestampSchema,
    });

Every field name and every field-level schema (UuidSchema,
LifecycleStateSchema, z.string().nullable(), etc.) is UNCHANGED from the
current file — only the outer construction (z.intersection(...) with two
operands) is replaced with z.object({ ...derivedShape, ...overrides }) (one
operand, spread first, overrides listed after so they take precedence).
Do not add, remove, or rename any field in this schema as part of this
change — the field list above is a straight transcription of what already
exists at documents.ts lines 126–149 today.

Then similarly replace the ENTIRE current VersionSelectSchema declaration
(currently lines 283–308, from `export const VersionSelectSchema =
z.intersection(` through the closing `);`) with:

    export const VersionSelectSchema = z.object({
      ...createSelectSchema(versions).omit({
        cityId: true,
        ocrText: true,
        tsv: true,
        verifiedBy: true,
        verifiedAt: true,
        requiresManualVerification: true,
        createdBy: true,
      }).shape,
      id: UuidSchema,
      documentId: UuidSchema,
      versionNumber: z.number().int().min(1),
      fileKey: UuidSchema,
      originalFilename: z.string().nullable(),
      mimeType: z.string(),
      fileSizeBytes: z.number().int().positive(),
      pageCount: z.number().int().positive().nullable(),
      scanQualityScore: z.number().min(0).max(1).nullable(),
      scanQualityCategory: ScanQualityCategorySchema.nullable(),
      ocrProcessed: z.boolean(),
      uploadedBy: UuidSchema,
      createdAt: TimestampSchema,
    });

Same rule: every field is a straight transcription from the current file
(lines 293–307). Do not add, remove, or rename fields.

NOTE on the `createdBy` omission in VersionSelectSchema: the underlying DB
column on the `versions` table really is named `createdBy`
(packages/database/schema/documents.schema.ts), but this hand-written
schema exposes it under the name `uploadedBy` instead. Omitting `createdBy`
from the derived side avoids a duplicate-key collision with the
hand-written `uploadedBy` field. This is a pre-existing, deliberate mismatch
between the DB column name and this schema's public field name — NOT
something to fix or rename as part of this task. Leave it exactly as
written above.

--- 1c. Remove the now-unnecessary custom InferOutput helper ---

File: packages/shared/src/schemas/documents.ts

Currently, line 151 defines:

    type InferOutput<T> = T extends { _output: infer O } ? O : never;

and it is used at line 152 (`export type DocumentSelect =
InferOutput<typeof DocumentSelectSchema>;`) and line 309 (`export type
VersionSelect = InferOutput<typeof VersionSelectSchema>;`). This helper
exists only because z.intersection()'s standard z.infer<T> output was
unreliable under the old construction. Once both schemas are plain
z.object() (per 1b above), standard z.infer<T> works correctly and produces
an identical type. As part of this task:

  - Delete the `type InferOutput<T> = ...` line entirely.
  - Change `export type DocumentSelect = InferOutput<typeof
    DocumentSelectSchema>;` to `export type DocumentSelect =
    z.infer<typeof DocumentSelectSchema>;`
  - Change `export type VersionSelect = InferOutput<typeof
    VersionSelectSchema>;` to `export type VersionSelect = z.infer<typeof
    VersionSelectSchema>;`

Confirmed: InferOutput is not exported and has no other usages anywhere in
the repo outside these two lines, so this is a safe, self-contained
removal.

--- 1d. Add a code-comment caveat about the enum-column gap ---

Both LifecycleStateSchema and ClassificationLevelSchema are the ONLY places
in the TypeScript-visible layer of this codebase that express the
lifecycle_state (11-value) and classification_level (4-value) constraints.
This is not new — it was true before this fix, and remains true after it.
The reason: on the actual Drizzle table
(packages/database/schema/documents.schema.ts), both columns are declared
as plain `text('lifecycle_state')` / `text('classification_level')` (lines
208–209) with the value constraints living ONLY in raw SQL CHECK
constraints (lines 246–251) — Drizzle's type system does not model CHECK
constraints, so createSelectSchema() has no enum information to derive for
either field; it produces plain ZodString for both. No Zod-merge
construction (z.intersection, .extend, .merge, .shape-spread — all were
tested) can recover this, because the derived side never has the
information to check against. Concretely: if a future engineer accidentally
misspells or drops the `lifecycleState:` or `classificationLevel:` override
key in this file, TypeScript will NOT flag it — the field will silently
fall back to an unconstrained string type, exactly reproducing the original
incident (referenced in the file's existing top-of-schema comment as
LOG-0027) this schema was built to prevent.

Add this as a code comment directly above the `lifecycleState:
LifecycleStateSchema,` line inside the new DocumentSelectSchema
construction (and a shorter cross-reference above `classificationLevel:
ClassificationLevelSchema,` pointing to the same comment, to avoid
duplicating the full explanation twice):

    // [KNOWN GAP — see docs/development-findings-log.md] The underlying
    // Drizzle column (lifecycle_state) is plain text() with the 11-value
    // constraint living only in a raw SQL CHECK — Drizzle's type system
    // has no way to derive an enum from that. This means TypeScript CANNOT
    // catch it if this override key is ever misspelled, renamed, or
    // dropped — it would silently fall back to an unconstrained string
    // with zero compile error. This override is the ONLY place this
    // constraint is enforced at the type level. Do not remove it without
    // first giving the underlying column a real Drizzle-level type (native
    // pgEnum or .$type<LifecycleState>() narrowing) — a schema-level
    // change outside the scope of this file.
    lifecycleState: LifecycleStateSchema,

    // classificationLevel has the identical gap — see the comment above
    // lifecycleState.
    classificationLevel: ClassificationLevelSchema,

═══════════════════════════════════════════════════════════════════════════
PART 2 — DELETE SCRATCH FILES FROM packages/shared/ ROOT
═══════════════════════════════════════════════════════════════════════════

The following 14 files currently sit at the ROOT of packages/shared/
(sibling to package.json and tsconfig.json — NOT inside src/). They are
exploratory scratch files from investigating this exact bug, are not
imported by anything in src/, are not part of the package's build (outside
the tsconfig.json include scope of "src/**/*.ts"), and should be deleted as
part of this task:

    packages/shared/patch.js
    packages/shared/test-compile.ts
    packages/shared/test-compile2.ts
    packages/shared/test-compile3.ts
    packages/shared/test-compile4.ts
    packages/shared/test-compile5.ts
    packages/shared/test-compile6.ts
    packages/shared/test-compile7.ts
    packages/shared/test-compile8.ts
    packages/shared/test-compile9.ts
    packages/shared/test-drizzle-zod.ts
    packages/shared/test-intersection.js
    packages/shared/test-parse.js
    packages/shared/test-schemas.js

Delete exactly these 14 files. Do not delete anything else from
packages/shared/ root (package.json, tsconfig.json must remain).

Before deleting, confirm none of them are referenced anywhere outside
packages/shared/ root itself:

    grep -rn "test-compile\|test-schemas\|test-parse\|test-intersection\|test-drizzle-zod\|patch\.js" --include="*.json" --include="*.ts" --include="*.js" --include="*.yaml" --include="*.yml" . | grep -v "packages/shared/test-\|packages/shared/patch.js"

If this grep returns any result outside packages/shared/'s own root files
(e.g. a reference from turbo.json, a CI workflow, another package's
package.json), STOP and report it rather than deleting — do not delete a
file something else depends on.

═══════════════════════════════════════════════════════════════════════════
PART 3 — VERIFICATION (all of these must pass before this task is done)
═══════════════════════════════════════════════════════════════════════════

1. Typecheck must pass cleanly with ZERO `as any` remaining in
   DocumentSelectSchema or VersionSelectSchema:

       cd packages/shared && pnpm typecheck

   (Confirm the output has zero errors. Also grep the file to confirm no
   `as any` remains anywhere in the DocumentSelectSchema/VersionSelectSchema
   declarations: `grep -n "as any" packages/shared/src/schemas/documents.ts`
   — this should return nothing, or only unrelated matches elsewhere in the
   file if any exist. Confirmed as of this writing: there were no other
   `as any` usages in this file outside these two schemas, so this grep
   should return zero matches after the fix.)

2. Runtime test — write a temporary standalone script (delete it after
   confirming, do not commit it) that imports DocumentSelectSchema and
   VersionSelectSchema and calls .safeParse() on a realistic object for
   each (matching the field lists in Part 1b above), confirming:
     a. Neither call throws.
     b. result.success is true for a valid, correctly-shaped object.
     c. As an additional check, confirm result.success is FALSE (not a
        throw) when a required field is missing or wrong-typed — i.e.
        confirm this is now a normal, working Zod schema that validates
        input rather than crashing regardless of input shape.

3. Deliberate-drift regression check — confirm the fix genuinely restores
   type-level protection where the underlying column type supports it.
   Temporarily (in a scratch .ts file under src/, delete after testing) add
   a field to the DocumentSelectSchema's hand-written override list with a
   WRONG Zod type for an existing field (e.g. change `classificationLevel:
   ClassificationLevelSchema` to a differently-valued z.enum([...])
   temporarily) and confirm `pnpm typecheck` now DOES report an error at
   that location. This confirms override-shadowing genuinely works post-fix
   (it did not, reliably, under the old z.intersection() construction).
   Revert this temporary change before finishing.

4. Confirm the three live procedures are unaffected in shape — this task
   changes only the schema module, not documents.router.ts. Do not modify
   documents.router.ts. Confirm with:

       git diff --stat apps/server/src/modules/documents/documents.router.ts

   This should show NO changes (the file should not appear in the diff at
   all, or show zero changes if it does appear).

5. Confirm exactly 14 files were deleted from packages/shared/ root and
   nothing else changed there:

       git status packages/shared/

   Expect: package.json and src/schemas/documents.ts modified; the 14 files
   listed in Part 2 deleted; nothing else in packages/shared/ touched.

Before submitting, confirm each item:
- [ ] drizzle-zod pinned to exactly "0.7.1" (no caret) in
      packages/shared/package.json, pnpm install run, resolution verified
      via `pnpm why`
- [ ] DocumentSelectSchema rewritten as z.object({ ...derivedShape,
      ...overrides }) with zero `as any`, all fields unchanged from before
- [ ] VersionSelectSchema rewritten the same way, zero `as any`, all fields
      unchanged, `createdBy` still omitted for the documented reason (not
      renamed or otherwise altered)
- [ ] InferOutput helper deleted; both DocumentSelect and VersionSelect
      type exports now use plain z.infer<typeof ...>
- [ ] Code comment explaining the lifecycleState/classificationLevel
      known-gap added above both fields inside DocumentSelectSchema
- [ ] All 14 named scratch files deleted from packages/shared/ root; grep
      confirmed no external references before deletion; nothing else in
      packages/shared/ root touched
- [ ] pnpm typecheck passes cleanly in packages/shared
- [ ] Runtime .safeParse() test confirms no throw, correct success/failure
      behavior on valid/invalid input (test script deleted after use)
- [ ] Deliberate-drift regression check confirms override-shadowing works
      for a real type mismatch (temporary test reverted after use)
- [ ] documents.router.ts shows zero diff
- [ ] git status on packages/shared/ shows only the expected file changes
A reviewer will verify each one independently.
```

---

# TASK-INFRA-025: Integrate `@fastify/helmet` for HTTP security headers

## Objective

Add `@fastify/helmet` to `apps/server` and register it in the Fastify plugin chain in `apps/server/src/app.ts`, configured to satisfy the specific header requirements below. `@fastify/helmet` is currently absent from this codebase — not in any `package.json`, not imported anywhere in `apps/server/src`, and not referenced anywhere else in the monorepo.

## Step 1 — Install the dependency

In `apps/server/package.json`, add to `dependencies` (not `devDependencies`):

```json
"@fastify/helmet": "^13.1.0"
```

Run the monorepo's normal install command afterward so the lockfile picks it up. Do not install any version below `^12.x` — the current `apps/server/package.json` has `"fastify": "^5.8.5"`, and `@fastify/helmet` versions before `12.x` target Fastify `^4.x`, which is a genuine compatibility mismatch, not just a stylistic preference.

## Step 2 — Register the plugin in `apps/server/src/app.ts`

Current relevant imports at the top of `apps/server/src/app.ts` (as of this task's writing) are:

```ts
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type PgBoss from 'pg-boss';
import { env } from './config/env.js';
import { nanoid } from 'nanoid';
import pino from 'pino';
import { registerHealthRoute } from './routes/health.route.js';
import databasePlugin from './infrastructure/database.plugin.js';
import eventBusPlugin from './infrastructure/event-bus.plugin.js';
import auditPlugin from './modules/audit/audit.plugin.js';
import iamPlugin from './modules/iam/iam.plugin.js';
import organizationPlugin from './modules/organization/organization.plugin.js';
import documentsPlugin from './modules/documents/documents.plugin.js';
import trackingPlugin from './modules/tracking/tracking.plugin.js';
import { workflowPlugin } from './modules/workflow/index.js';
import rateLimit from '@fastify/rate-limit';
```

Add a static top-level import for helmet, in the same style as the existing `rateLimit` import (a default import, no destructuring):

```ts
import helmet from '@fastify/helmet';
```

Place this new import line immediately after the `import rateLimit from '@fastify/rate-limit';` line, so all the third-party Fastify plugin imports stay grouped together at the bottom of the import block.

Inside `buildApp()`, the current registration sequence (as of this task's writing) is:

```ts
await registerHealthRoute(fastify);

// Wave B infrastructure + module plugins, in dependency order.
await fastify.register(databasePlugin);
await fastify.register(eventBusPlugin);
await fastify.register(auditPlugin);
await fastify.register(rateLimit, {
  max: env.RATE_API_MAX,
  timeWindow: env.RATE_API_WINDOW_MS,
  allowList: [env.HEALTH_CHECK_PATH],
});
await fastify.register(iamPlugin);
```

Insert the helmet registration immediately after `await registerHealthRoute(fastify);` and immediately before `await fastify.register(databasePlugin);` — i.e., helmet must be the very first plugin registered after the health route, before `databasePlugin` and everything that follows it. Do not place it anywhere else in the sequence (not alongside `rateLimit`, not at the end near `cors`).

The exact call and options object to register:

```ts
await fastify.register(helmet, {
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
});
```

Do not pass any other keys in this options object — specifically, do not add `contentSecurityPolicy`, `xContentTypeOptions`, `xXssProtection`, or `xssFilter` keys of any kind, including `false`. Leaving these unconfigured is intentional: `@fastify/helmet`'s underlying `helmet` package (confirmed against the installed `helmet@8.3.0` source, not assumed) runs `contentSecurityPolicy` and `xContentTypeOptions` by default when the options object omits them, and separately runs `xXssProtection` by default, which sets `X-XSS-Protection: 0` (telling the browser to disable its legacy XSS auditor — the current safe value, not the older unsafe default some tooling still associates with that header name). Do not add a `false` value for any of these three keys; that would actively disable behavior this task wants left on its default.

So the full modified sequence should read:

```ts
await registerHealthRoute(fastify);

await fastify.register(helmet, {
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
});

// Wave B infrastructure + module plugins, in dependency order.
await fastify.register(databasePlugin);
await fastify.register(eventBusPlugin);
await fastify.register(auditPlugin);
await fastify.register(rateLimit, {
  max: env.RATE_API_MAX,
  timeWindow: env.RATE_API_WINDOW_MS,
  allowList: [env.HEALTH_CHECK_PATH],
});
await fastify.register(iamPlugin);
```

## Explicit scope boundaries — what NOT to touch

- **Do not modify `apps/server/src/config/env.ts` or `apps/server/src/config/env.server.ts`.** No new environment variables should be added for any helmet configuration (no HSTS max-age env var, no CSP directive env var, nothing). All helmet configuration in this task is hardcoded directly in `app.ts` as shown above.
- **Do not modify `.env.example`** (at repo root) or any other `.env*` file. Since no env vars are being added, none of these files need a corresponding entry.
- **Do not touch the existing `cors` registration** (the dynamic `await import('@fastify/cors')` block later in `app.ts`, right before the tRPC registration) or the existing `rateLimit` registration shown above. Leave both exactly as they are — do not change their position, their import style, or their options.
- **Do not add any new test file for this task.** (See "Testing" section below for why, and what to verify manually instead.)
- **Do not modify any file under `docs/`** as part of implementing this task. A findings-log entry for the underlying documentation gap and cross-document discrepancy that this task's configuration choices are resolving has already been written and appended separately, outside this prompt's scope. Do not write a new findings-log entry duplicating it, and do not edit `AGENTS.md`, `document-list.md`, or any pre-development document.
- **Do not add CSP directive configuration of any kind**, even though `Content-Security-Policy` is a header this task cares about satisfying. It is satisfied by leaving `contentSecurityPolicy` unset (see Step 2 above) — do not add a `contentSecurityPolicy: {...}` block with custom directives. That would be a different, larger task than what's specified here.

## Why this specific configuration (context, not something to second-guess or re-derive)

This project has two pre-development documents that both describe which headers `@fastify/helmet` should set, and they disagree with each other (`i3-security-design-document.md` §11.6 vs. `e2-rest-api-specification-openapi3.md`'s "Security Headers" section) — neither is a code file, so there's nothing to reconcile in the codebase itself, but this note explains why the options object above looks the way it does, in case it looks arbitrary:

- `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Strict-Transport-Security: max-age=31536000; includeSubDomains` are all explicitly required, so they're passed explicitly, even where they happen to match what `helmet`'s own defaults would already produce (confirmed: `Referrer-Policy: no-referrer` and `Strict-Transport-Security: max-age=31536000; includeSubDomains` are both already `helmet`'s current defaults — the explicit config here is intentional self-documentation, not a correction of a wrong default. `X-Frame-Options`'s default is `SAMEORIGIN`, not `DENY`, so that one genuinely does need the override).
- `Content-Security-Policy` and `X-Content-Type-Options` are left to helmet's defaults rather than configured, per the instructions in Step 2.
- `X-XSS-Protection` is deliberately not configured at all — no `xXssProtection` or `xssFilter` key — per the instructions in Step 2.

None of this requires further investigation or a different decision from the executor — it's settled; implement exactly as specified in Step 2.

## Testing

No existing test in this codebase exercises `buildApp()`'s real Fastify instance via `fastify.inject()` with response-header assertions — the only two test files that reference `buildApp` (`apps/server/src/modules/iam/__tests__/iam.plugin.verification.test.ts` and `apps/server/src/modules/iam/__tests__/iam.middleware.test.ts`) both define their own local stub/helper functions named `buildApp`, unrelated to the real one in `app.ts`. This means:

- Adding helmet should not cause any existing test to fail due to unexpected headers.
- Do not write a new automated test for this task — it's out of scope. Instead, after implementing Steps 1–2, verify manually that the server still starts cleanly (`pnpm dev` or equivalent, run from `apps/server` or the monorepo root as this project's existing dev workflow requires) with no plugin-registration errors, and that a request to any route (e.g. the health-check route) returns the following headers in its response, matching the values specified in Step 2:
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy` present with some non-empty value (exact directive content doesn't need to be checked — its presence at all confirms the default is active)
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 0`

If any of these headers are missing or have a different value than listed, that's a signal the registration in Step 2 was not applied correctly (e.g., helmet registered in the wrong position, or an unwanted key like `contentSecurityPolicy: false` was accidentally included) — fix the registration to match Step 2 exactly rather than adding a workaround elsewhere.

## Acceptance criteria

1. `apps/server/package.json` lists `@fastify/helmet` at `^13.1.0` (or a version satisfying `^12.x` or higher) under `dependencies`.
2. `apps/server/src/app.ts` imports `helmet` statically from `@fastify/helmet`, grouped with the other third-party Fastify plugin imports.
3. `helmet` is registered in `buildApp()` immediately after `registerHealthRoute(fastify)` and immediately before `databasePlugin`, with exactly the three-key options object specified in Step 2 — no more, no fewer keys.
4. The server starts with no plugin-registration errors.
5. A manual request to any route shows all six headers listed under "Testing" above, with the exact values specified.
6. No file outside `apps/server/package.json` and `apps/server/src/app.ts` (plus the lockfile, updated automatically by the install command) has been modified.
