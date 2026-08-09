# ADR-UI-008: System Administrator — Dedicated Views Built in Phase 1

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #8 (also referenced in F1 §12.8, §11.2)
**Decision owner:** Luke (product/architecture owner)

## Context

I2's matrix and E1's procedure catalog both confirm several Tier-1, System-Administrator-level capabilities with no Platform-Administrator overlap: `iam.listAllActiveSessions`, `iam.forceTerminateSession`, `iam.createUserAccount`/`editUserAccount`/`deactivateUserAccount`/`reactivateUserAccount`, audit hash-chain validation (`audit.validateChainIntegrity`), and read access to system health/infrastructure metrics, encryption key management, schema migrations, and backup/restore `[Confirmed — F1-Context §1.4, Tier 1; I2 §12 Architectural Invariants]`. F1's task scope named "Platform Administrator views," not "System Administrator views," and I2 itself raised — without resolving — whether System Administrator needs distinct views at all. F1 declined to build a System Administrator section, naming the relevant procedures in §12.8 without confident paths or component names, and noted the audit-log asymmetry separately in §11.2: I2's matrix shows full-log viewing restricted to Auditor only, with System Administrator explicitly excluded from that specific permission even though System Administrator separately holds chain-validation rights.

## Decision

**Build a minimal System Administrator section in Phase 1**, covering session management, user account CRUD, and audit chain-validation — distinct from the Platform Administrator views.

## Rationale

The underlying procedures already exist and are already role-gated to System Administrator with no Platform Administrator overlap; the only missing piece was a frontend section to expose them. Architectural invariant #12 — Platform Administrator cannot be combined with any document-processing role `[Confirmed — I2 §12]` — does not on its own resolve whether System Administrator needs separate views, but the absence of any procedure overlap between the two roles' Tier-1/Tier-2 capabilities makes a shared admin shell awkward; a dedicated section is the more direct fit for what the data already supports.

## Consequences

- New top-level section, parallel in structure to §12's Platform Administrator views, gated to `sys_admin` only:
  - **Session management** — list and force-terminate active sessions. Data: `iam.listAllActiveSessions`, `iam.forceTerminateSession`.
  - **User account management** — create, edit, deactivate, reactivate user accounts. Data: `iam.createUserAccount`, `iam.editUserAccount`, `iam.deactivateUserAccount`, `iam.reactivateUserAccount`.
  - **Audit chain validation** — a narrow integrity-status indicator distinct from the Auditor-only full-log view. Data: `audit.validateChainIntegrity`. `[Confirmed — I2 §15]` This does **not** grant System Administrator the full audit log itself — I2's matrix explicitly denies System Administrator on "View audit log — all entries (full log)," a distinction this ADR preserves rather than overrides.
- `[Inference]` System health/infrastructure metrics, encryption key management, schema migrations, and backup/restore are confirmed Tier-1 System Administrator capabilities `[Confirmed — F1-Context §1.4]`, but no corresponding tRPC procedures were catalogued in E1 for any of these four. This ADR does not invent procedure names for them and does not include them in the Phase 1 build; they remain a separate, not-yet-scoped gap. `[Speculation]` These may be intended to live in an operations console outside this web app's scope entirely, consistent with I2's own speculation on this point — not resolved here.
- This is one of six scope items pulled into Phase 1 in this decision pass (see ADR-UI-002 consequences, corrected in this same pass, for the combined cumulative-scope note). `[Corrected — previously said "four"]`
- F1 §12.8 and §14 gap #8's `[Speculation]` status are superseded by this ADR for the session-management, user-account, and chain-validation capabilities specifically; the four infrastructure-tier capabilities listed above remain unresolved and should be tracked as a distinct follow-up item.

## Alternatives considered

- **No dedicated views; System Administrator reaches these tools outside this web app** (ops console, CLI, etc.). Lower scope, avoids building a parallel admin section, but leaves confirmed, role-gated procedures (`iam.listAllActiveSessions`, etc.) with no frontend surface at all in Phase 1. Not selected.
- **Defer the decision**, recording it as an open item for a future addendum. Matches F1's original position. Not selected.

## Traceability

- F1-Context §1.4 (Authorization tiers, Tier 1 list)
- I2 §12 (Architectural Invariants, #12); I2 §15 (Audit Log permission rows)
- E1, `iam.listAllActiveSessions`, `iam.forceTerminateSession`, `iam.createUserAccount`/`editUserAccount`/`deactivateUserAccount`/`reactivateUserAccount`, `audit.validateChainIntegrity`
- F1 §11.2, §12.8, §14 gap #8
