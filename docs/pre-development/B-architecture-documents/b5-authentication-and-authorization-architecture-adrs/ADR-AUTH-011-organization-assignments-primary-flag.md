# ADR-AUTH-011 — Organization Assignments: Primary Office Flag

**Status:** Accepted  
**Date:** 2026-06-26  
**Domain:** Authentication / Authorization (B5)  
**Closes:** Office-assignment-uniqueness open item in B5 §12 and I3 §18.2 (logged 2026-06-25); ADR-UI-012 "Open Follow-Up" on `officeScopeId`/`officeCode` selection when multiple assignments exist for one employee.

---

## Context

`organization.assignments` has no database constraint preventing two simultaneous `is_active = true` rows for the same `employee_id`. This contradicts B5 §5.6 point 3's statement that "every user has a primary record in `organization.assignments` linking them to one office," and leaves the IAM module's `getPrimaryOfficeForUser` resolver without a defined tie-break rule for when multiple active assignments exist.

The gap was surfaced during the IAM module's `oid`/`cid` JWT claim resolution pass (2026-06-25) and was independently flagged in ADR-UI-012's "Open Follow-Up." Three options were laid out in `iam.md`'s Module Summary without a recommendation, pending the organizational fact of whether any Batac City LGU employee genuinely holds two concurrent active position assignments. The project owner confirmed (2026-06-26) that concurrent active assignments are possible for Batac City LGU staff, ruling out option (a).

## Decision

**Option (c) adopted:** add an explicit `is_primary BOOLEAN NOT NULL DEFAULT false` column to `organization.assignments`. The application layer is responsible for maintaining the invariant that exactly one `is_primary = true` row exists per `employee_id` among active, non-deleted assignments. A partial unique index provides a database-level safety net.

### DDL change (C1)

```sql
-- Column added to organization.assignments:
is_primary  BOOLEAN     NOT NULL DEFAULT false,

-- Partial unique index — safety net to prevent data corruption if the
-- application layer fails to maintain the one-primary-per-employee invariant:
CREATE UNIQUE INDEX uq_assignments_one_primary_per_employee
    ON organization.assignments (employee_id)
    WHERE is_primary = true AND is_active = true AND deleted_at IS NULL;
```

### Application-layer contract

A dedicated "set primary assignment" operation in the ORG module service layer must, in a single transaction:

1. `UPDATE organization.assignments SET is_primary = false WHERE employee_id = :employeeId AND is_primary = true AND deleted_at IS NULL`
2. `UPDATE organization.assignments SET is_primary = true WHERE id = :assignmentId`

Neither a generic `CreateAssignmentInput` nor a generic `UpdateAssignmentInput` operation may set `is_primary = true` without also executing step 1 above in the same transaction.

## Rationale

**Why not option (a) — DB unique constraint (one active assignment per employee)?**  
A hard constraint mirrors `delegation_grants`' `uq_delegation_one_active_per_delegatee` pattern but blocks legitimate concurrent position holding (e.g., an officer temporarily filling a vacancy in a second office while retaining their primary assignment). The project owner confirmed concurrent assignments are a real use-case for Batac City LGU staff.

**Why not option (b) — implicit tie-break rule (e.g., most recent `start_date`, or lowest `authority_level`)?**  
An implicit tie-break produces non-deterministic results when two assignments share the same `start_date`, and produces surprising behavior when the longer-tenured assignment is the one the user considers their primary office. An explicit flag is transparent and auditable — both the user and the system can determine which assignment is primary without inspecting derived orderings.

**Why option (c) — explicit `is_primary` flag with application-layer invariant?**  
This gives the ORG module full control over which assignment is primary. The pattern matches how other "one active entity per person" invariants are maintained in the codebase (e.g., `iam.sessions`' single-active-session invariant is enforced at the service layer, not solely by a DB constraint). The partial unique index at the DB level provides corruption protection without blocking multi-assignment data.

## Consequences

- **C1 DDL** (`c1-full-database-schema-ddl-v3.md`): `is_primary BOOLEAN NOT NULL DEFAULT false` column added to `organization.assignments`; `uq_assignments_one_primary_per_employee` partial unique index added. See C1 Part 4.
- **C2 ERD** (`c2-entity-relationship-diagrams-per-schema.md`): `bool is_primary` field added to `ASSIGNMENTS` entity.
- **E3 schema** (`e3-shared-zod-schema-catalog.md`): `isPrimary: z.boolean()` added to `AssignmentSelectSchema`. `CreateAssignmentInputSchema` is unchanged — the primary flag is managed by a dedicated service-layer operation, not via generic assignment creation.
- **B2 Published API** (`b2-module-boundary-and-internal-api-contracts-v1.1.md`): `getPrimaryOfficeForUser` doc-comment updated — the `[Inference]` open-question note replaced with `[RESOLVED — ADR-AUTH-011, 2026-06-26]`. The method contract is otherwise unchanged: it returns the office from the `is_primary = true AND is_active = true` row, or `null` if none exists.
- **B5** (`b5-authentication-and-authorization-architecture.md`): Added to §11 as D-AUTH-11; removed from §12 open-items table; closing paragraph updated.
- **I3** (`i3-security-design-document.md`): Added to §18.1 as row 16 (D-AUTH-11); removed from §18.2 open-items table; §18 status header and §18.2 intro updated.
- **ADR-UI-012** (`f2-zustand-store-design-adrs/ADR-UI-012-session-store-rolecodes-shape.md`): "Open Follow-Up" section closed with `[RESOLVED]` note.
- **iam.md** (`a1-tasks/iam.md`): Open question 1 replaced with `[RESOLVED — ADR-AUTH-011, 2026-06-26]` record; "Forward note for the ORG module" updated to reflect the resolved tie-break rule.
