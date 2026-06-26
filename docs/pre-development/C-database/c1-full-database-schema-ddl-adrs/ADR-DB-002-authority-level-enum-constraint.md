# ADR-DB-002 — Authority Level Enum Constraint on organization.positions

**Status:** Accepted  
**Date:** 2026-06-26  
**Domain:** Database (C1)  
**Closes:** `[Gap-fill]` inline note on `authority_level TEXT NULL` in C1 Part 4; `[Unverified values]` tag in C2 ERD.

---

## Context

`organization.positions.authority_level` was left as unconstrained `TEXT NULL` in C1 with the comment:

> "authority_level is left unconstrained TEXT: D4 declares Position.level as AuthorityLevel but gives no value list in any source. [Gap-fill]"

This comment is factually incorrect. E3 (`e3-shared-zod-schema-catalog.md`, Part 3) defines:

```typescript
export const AuthorityLevelSchema = z.enum(["executive", "managerial", "staff", "support"]);
```

and uses it as a **required, non-nullable** field in both `PositionSelectSchema` and `CreatePositionInputSchema`. C2's ERD also documents the same four values (flagged `[Unverified values]` only due to the C1 gap, not because E3 was unknown). D4's class diagram declares `Position.level: AuthorityLevel` with no nullability marker, consistent with a required field.

### Impact of the inconsistency

1. A value inserted via direct SQL (migration or seed script) that does not match the four known values would be stored without error at the DB level but would throw a Zod `ZodError` when read back through the API layer (`PositionSelectSchema` parse — strict enum, no `.catch()`).
2. A `NULL` value in the column would fail to parse against `authorityLevel: AuthorityLevelSchema` (not `.nullable()`), causing runtime errors on any `PositionSelectSchema` parse that encounters a legacy or seeded null.
3. C1's own stated global enum convention (documented in C2, "Enums defined in this schema: TEXT CHECK strategy") is violated by leaving the column unconstrained.

The gap was discovered during the IAM module's spec-gap resolution pass (2026-06-25 / 2026-06-26) while cross-checking C1 column definitions against E3 Zod schemas.

## Decision

Apply the project's documented **"TEXT CHECK strategy"** for `authority_level`, making it:

```sql
authority_level TEXT NOT NULL CHECK (authority_level IN ('executive', 'managerial', 'staff', 'support'))
```

The value list is taken verbatim from E3's `AuthorityLevelSchema` (canonical source). The preceding comment in C1 is replaced with a corrected note referencing E3 as the canonical source and crediting this ADR as the resolution.

## Rationale

**Why `NOT NULL`?**  
E3's `PositionSelectSchema` and `CreatePositionInputSchema` both declare `authorityLevel: AuthorityLevelSchema` as required (neither `.nullable()` nor `.optional()`). The DB column must match to prevent null read-back from causing runtime parse failures.

**Why `TEXT CHECK` and not a PostgreSQL `ENUM` type?**  
Per the project-wide convention stated in C2 ("TEXT CHECK strategy") and consistently used for `office_type`, `committee_role`, and all other non-workflow enum-like columns in the `organization` schema: PostgreSQL native `ENUM` types require a DDL `ALTER TYPE` statement to add new values and a data migration to remove them; `TEXT CHECK` constraints are altered with a simple `ADD CONSTRAINT` / `DROP CONSTRAINT` pair. All callers already treat the value as a validated string (Zod enum), not as a PostgreSQL `ENUM` object.

**Why not leave unconstrained until the ORG module is built?**  
No migration files or seed scripts exist yet (pre-development baseline). Fixing the DDL now costs nothing operationally — there are no existing rows to migrate — and it prevents a class of silent write / noisy read bugs that would otherwise only appear when real data is inserted via migrations.

## Consequences

- **C1 DDL** (`c1-full-database-schema-ddl-v3.md`): `authority_level TEXT NULL` → `TEXT NOT NULL CHECK (authority_level IN ('executive', 'managerial', 'staff', 'support'))`. Preceding comment updated: `[Gap-fill]` removed; corrected note added, referencing E3 §3 as the canonical source and this ADR as the decision record.
- **C2 ERD** (`c2-entity-relationship-diagrams-per-schema.md`): `[Unverified values]` tag on `authority_level` enum in the schema introduction replaced with `[Confirmed — E3 §3, AuthorityLevelSchema; ADR-DB-002]`.
- No change to E3 (already correct), D4 (already correct), or I2.
