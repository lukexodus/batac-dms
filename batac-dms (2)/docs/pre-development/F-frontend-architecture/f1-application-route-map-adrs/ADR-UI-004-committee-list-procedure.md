# ADR-UI-004: Committee List/Read Procedure

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #4 (also referenced in F1 §8.5, §12.2)
**Decision owner:** Claude, within delegated discretion (engineering convention, not a product/business decision)

## Context

E1's `organization` router catalogues `organization.createCommittee`, `organization.updateCommittee`, and `organization.assignCommitteeMembership`, but no list or single-record read procedure for committees `[Confirmed — E1, §"organization.createCommittee / organization.updateCommittee"]`. This gap affects two consumers identified in F1: the Multi-Referral Panel's committee picker (§8.2, §8.5), which needs to know which committees exist before an SP Secretary can assign or reassign a referral, and `/admin/committees` (§12.2), which F1 noted was "currently write-only against an unverifiable read state."

This is a missing-procedure gap of the same shape as a missing single-record read (ADR-UI-005) — it is an omission in the original catalog, not a point of product ambiguity requiring a stakeholder decision.

## Decision

**Add `organization.listCommittees`** to the `organization` router.

- **Input:** none required (or optionally an `officeId`/active-only filter, if the team wants to scope the picker — not specified by source, left to implementation).
- **Output:** array of committee records sufficient to populate both the Multi-Referral Panel's picker and the `/admin/committees` list view — at minimum `committeeId`, name, and active status.
- **Callable by:** at minimum `plat_admin` (for `/admin/committees`) and `sp_secretary` (for the Multi-Referral Panel committee picker). `[Inference]` `sp_member` may also need read access if committee-scoped members are expected to see their own committee's name/metadata elsewhere in the UI, but no source row confirms this directly, so it is not included as a default `callable by` here.

## Rationale

This is a standard, low-risk backend addition: a list/read companion to an existing set of write-only procedures (`createCommittee`, `updateCommittee`, `assignCommitteeMembership`). It does not require a product decision because there is no reasonable alternative design — both confirmed consumers (the Multi-Referral Panel picker and `/admin/committees`) cannot function without some form of committee list, and no other procedure in E1 could plausibly substitute.

## Consequences

- `/admin/committees` (F1 §12.2) is no longer write-only against an unverifiable read state; its data dependency becomes `organization.listCommittees` (read) plus the existing three write procedures.
- The Multi-Referral Panel (F1 §8.2) gains `organization.listCommittees` as an additional data dependency alongside its existing procedures.
- F1 §8.5 and §14 gap #4's `[Unverified]` status are superseded by this ADR.

## Traceability

- E1, `organization.createCommittee` / `organization.updateCommittee` / `organization.assignCommitteeMembership`
- F1 §8.2, §8.5, §12.2, §14 gap #4
