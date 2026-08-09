# ADR-TST-005: workflow_events` Immutability Test (K2 §21, item 5)


**Decision:** Add a dedicated test that attempts a direct SQL `UPDATE` and a direct SQL `DELETE` against a `workflow.workflow_events` row (inserted via normal engine operation in the test's Given step) and asserts both are rejected by the database itself — not merely by the application layer.

**Decided by:** Claude — this item has no remaining design ambiguity; B4 invariant 13 fully specifies the behavior (`REVOKE UPDATE, DELETE ON workflow.workflow_events FROM workflow_app_user`) and §21 itself only flagged "no test case verifies this is actually enforced," which is a test-coverage gap, not a behavior question.

**Rationale:** Application-level guards can be bypassed by a bug or a future code path that talks to the DB directly; the DB-level `REVOKE` is the actual safety net B4 specifies, so the test needs to exercise the DB connection's privileges directly (using the `batac_app` role, not a superuser/migration role) rather than only testing through `engine.*` methods, which would never attempt an UPDATE/DELETE on this table anyway and so would not actually exercise the constraint being tested. `[Corrected — this ADR previously named the role workflow_app_user throughout; the real migration (0006_workflow_create_workflow_schema.sql: REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app) revokes from batac_app. A test connecting as a role named workflow_app_user would fail to even connect, since no such role exists.]`

**Consequence for K2:** New test, proposed ID `INV13-01`, added to §20's invariant map in place of the current `[Inference]` placeholder:

> **INV13-01:** A `workflow_events` row exists (created via normal `engine.submitStepAction` or similar). Test connects as `batac_app` (the same role the application uses) and attempts `UPDATE workflow.workflow_events SET ... WHERE id = ...`. **Expected:** Database rejects with a permissions error (e.g., Postgres `42501 insufficient_privilege`), not an application-level error. **Companion case:** same setup, `DELETE FROM workflow.workflow_events WHERE id = ...` attempted. **Expected:** same rejection.

---
