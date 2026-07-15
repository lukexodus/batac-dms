# ADR-AUTH-006: delegation_grant.scope` Field Schema

**Status:** Accepted

**Context**

D-AUTH-06 requires a structure for `organization.delegation_grants.scope` that the ABAC evaluator can interpret at request time. Section 5.7 of B5 already establishes that the evaluator expands a user's effective roles and office scope for the duration of an active delegation, and that Step 7d of the policy cascade checks the requested action against this scope.

**Decision**

```json
{
  "roles": ["<role-uuid>", "..."],
  "office_ids": ["<office-uuid>", "..."],
  "actions": ["<action-string>", "..."]
}
```

All three keys are required arrays (empty array, not null, when a dimension grants nothing extra). `roles` and `office_ids` reference existing `iam.roles.id` and `organization.offices.id` values respectively. `actions` uses the same action vocabulary already defined in Section 5.4 of B5 (e.g., `approve`, `advance`, `revoke_delegation`).

**Rationale**

This shape directly mirrors the three dimensions Section 5.7 already says the evaluator must check — effective roles, effective office scope, and the specific action — so the schema doesn't introduce a new conceptual model, it encodes the one the document already committed to. [Inference — the document describes the _behavior_ (expand roles and office scope, check the action) but never specified the field's literal JSON shape; this ADR is the first place that shape is fixed.] Constraining `actions` to the existing vocabulary (rather than allowing arbitrary strings) keeps Step 7d's check a simple set-membership test rather than requiring new parsing logic in the evaluator.

**Consequences**

- A delegation that should extend authority across _all_ actions for a given role (rather than an enumerated subset) is not directly expressible without listing every action — this ADR does not add a wildcard convention. If that use case arises in practice (e.g., "delegate everything the Mayor can do while on leave"), a follow-up decision is needed; this is flagged here rather than silently resolved, since inventing a wildcard convention now would be speculative.
- The Organization module schema migration must define `organization.delegation_grants.scope` as `JSONB` with this shape, and the ABAC evaluator's Step 7d implementation should validate incoming scope objects against it (e.g., with a Zod schema, consistent with the Zod usage already described elsewhere in B5 for config validation).
- This schema is not yet validated against a real-world delegation scenario beyond the single example already in B5 (Mayor → Vice Mayor type delegation); if Organization module design surfaces a scenario this shape can't express, this ADR should be revisited rather than worked around ad hoc.

---
