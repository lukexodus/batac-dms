# ADR-AUTH-009: RLS Policy Expression for Cross-Office Read Grants

**Status:** Accepted

**Context**

D-AUTH-09 notes that `has_cross_office_read_grant()` is referenced in the example RLS policy in Section 6.5 of B5 but is never defined, and no backing table exists for it. Section 5.6 of B5 separately confirms which roles receive cross-office access and what kind (Records Officer: metadata only, read-only, all offices; SP Secretary: read-and-act, SP Secretariat scope; Platform Administrator: org structure and workflow definitions only, no document content; IT Admin: audit/session data only, no document content).

**Decision**

Add a dedicated table rather than deriving cross-office access purely from role membership:

```sql
CREATE TABLE organization.cross_office_grants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES iam.roles(id),
  office_scope    TEXT NOT NULL,   -- 'all' | specific office_id list via join table, see note below
  access_level    TEXT NOT NULL,   -- 'metadata_only' | 'full'
  resource_types  TEXT[] NOT NULL, -- e.g. ARRAY['document'], ARRAY['workflow_step_instance']
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION has_cross_office_read_grant(
  p_user_id UUID,
  p_office_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization.cross_office_grants g
    JOIN iam.role_assignments ra ON ra.role_id = g.role_id
    WHERE ra.user_id = p_user_id
      AND ra.revoked_at IS NULL
      AND (g.office_scope = 'all')
      -- specific-office-scope branch intentionally omitted; see consequence below
  );
$$ LANGUAGE sql STABLE;
```

**Rationale**

A dedicated grants table — rather than hardcoding role names inside the RLS policy or the function — keeps the cross-office rule data-driven and consistent with Tier 2 of the authorization model (Section 5.2 of B5), where Platform Administrators configure role-level capabilities rather than developers hardcoding them. [Inference — Section 5.2 establishes Tier 2 as Platform-Admin-configurable in general; this ADR extends that principle to cross-office grants specifically, which the source document does not explicitly say must be Tier 2, but is consistent with how the rest of the Tier 2 list is structured (role definitions, permission assignments).] The four roles and access levels already confirmed in Section 5.6 give a starting seed dataset for this table, so the function has real data to operate against immediately.

**Consequences**

- The function signature above only handles the `office_scope = 'all'` case cleanly (which covers all four roles currently listed in Section 5.6, since none of them are scoped to a specific _subset_ of offices). If a future role needs cross-office access to _some but not all_ offices, the table's `office_scope` column and the function both need a real "specific office list" branch — this is not built out here because no confirmed role currently needs it, and building it speculatively risks guessing the wrong shape. This is a known limitation, not an oversight.
- `access_level = 'metadata_only'` is referenced in the table schema but **not yet enforced by the function itself** — the function only answers "can this user read across offices at all," not "metadata or full content." The actual metadata-vs-content distinction must be enforced by a second condition in the calling RLS policy (similar to how Section 6.5's existing `p_it_admin_content_block` policy separately gates content access by classification level). This ADR defines the grants table and the existence check; wiring `access_level` into the policy that calls this function is implementation work for the Documents module migration, not resolved here.
- Seed data for this table (one row per role in Section 5.6) should be added as part of IAM seed data, alongside the D-AUTH-05 role mapping.

---
