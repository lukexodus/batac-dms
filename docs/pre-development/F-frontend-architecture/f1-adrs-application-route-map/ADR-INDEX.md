# ADR Index — F1 Known Gaps Resolution

**Date:** 2026-06-19
**Source document resolved:** `f1-application-route-map.md` §14, "Known gaps and open questions"

This index tracks the ten ADRs produced to resolve every item in F1 §14. Each ADR's full context, decision, rationale, consequences, and traceability live in its own file; this index is a navigation aid only.

| ADR | Gap # | Title | Decided by |
|---|---|---|---|
| [ADR-001](./ADR-001-public-portal-hosting-app.md) | 1 | Public Portal Hosting App | Luke |
| [ADR-002](./ADR-002-tier2-config-crud-scope.md) | 2 | Tier-2 Platform Admin Config CRUD — Pulled Into Phase 1 | Luke |
| [ADR-003](./ADR-003-retention-schedule-crud-scope.md) | 3 | Retention Schedule Creation/Activation — Pulled Into Phase 1 | Luke |
| [ADR-004](./ADR-004-committee-list-procedure.md) | 4 | Committee List/Read Procedure | Claude (engineering convention) |
| [ADR-005](./ADR-005-single-record-read-procedures.md) | 5 | `complaints`/`documentRequests` Single-Record Read Procedures | Claude (engineering convention) |
| [ADR-006](./ADR-006-public-portal-announcements.md) | 6 | Public Portal Announcements — Built in Phase 1 | Luke |
| [ADR-007](./ADR-007-designation-document-type-phase1.md) | 7 | Designation Document Type — Pulled Into Phase 1 | Luke |
| [ADR-008](./ADR-008-system-administrator-views.md) | 8 | System Administrator — Dedicated Views Built in Phase 1 | Luke |
| [ADR-009](./ADR-009-portal-form-no-login.md) | 9 | No Authenticated Account Required for Portal Request/Complaint Forms | Luke |
| [ADR-010](./ADR-010-workflow-step-route-key.md) | 10 | Workflow Step Detail Route Keys on `instanceId` | Claude (engineering convention) |

## Net effect on Phase 1 scope

`[Inference]` Four items previously deferred or placed in a later phase are now pulled into Phase 1 by these ADRs:

- ADR-001 — `/apps/portal` (Next.js), originally Phase 3, built now
- ADR-002 — Tier-2 config CRUD (6 entities), originally deferred by E1 pending a config-screen spec
- ADR-003 — Retention schedule creation/activation, originally unbacked by any procedure
- ADR-006 — Public-portal announcements, originally an orphaned permission with no procedure or page
- ADR-007 — Designation document type, originally Phase 1B
- ADR-008 — System Administrator dedicated views, originally unscoped/undecided

`[Unverified]` This is a substantial scope expansion compressed into a single decision pass. Whether the team's current timeline and resourcing can absorb six additional or accelerated work items cannot be determined from the documents reviewed for this exercise. This should be assessed separately, ideally before the IAM module's first database migration proceeds, since several of these items (ADR-002, ADR-003, ADR-007) touch schemas that migration may need to account for.

## What remains genuinely open after these ten ADRs

- ADR-007's consequences note: whether "Designation scope confirmation by Platform Admin — not required" still holds once Designation moves to Phase 1, given that decision was made when Designation was a later-phase item.
- ADR-008's consequences note: four Tier-1 System Administrator capabilities (system health/infrastructure metrics, encryption key management, schema migrations, backup/restore) have no catalogued procedure and were not pulled into this ADR's Phase 1 build — separate, not-yet-scoped gap.
- ADR-009's consequences note: whether a citizen who registers an account after a no-login submission can retroactively link that submission to their account — not addressed by any source document or by this ADR.
- ADR-006's consequences note: no specific citizen-facing route path was assigned for the announcements listing page itself — left to the F1 update pass.
