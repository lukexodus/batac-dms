# ADR-AUTH-003: Refresh Token Lifetime

**Status:** Accepted

**Context**

D-AUTH-03 asks for a refresh token lifetime balancing security against usability for staff on a government intranet with infrequent access. The source document's own starting suggestion was 7 days.

**Decision**

**14 days.**

**Rationale**

This was a direct stakeholder decision favoring convenience over the document's 7-day starting point, on the stated basis that staff access is infrequent and shared-workstation friction from frequent re-login was judged a bigger practical cost than the marginal security loss from a longer-lived token. [Inference — "infrequent access" as a justification for a longer token lifetime assumes the threat model here is primarily opportunistic/external rather than insider misuse of an unattended shared terminal; this tradeoff was not independently re-derived in this ADR, it reflects the stakeholder's explicit choice.]

**Consequences**

- `iam.refresh_tokens.expires_at` is set to `created_at + 14 days` at issuance and at every rotation.
- Reuse detection (token families, Section 1.2 of B5) remains the primary mitigation against a stolen refresh token being used for up to 14 days, since the lifetime itself does not change the existing rotation/reuse-detection design.
- Because Section 4.6 of B5 already keeps the refresh token rotating in the background during a screen lock, this 14-day window is the effective ceiling on how long an unattended, never-fully-logged-out shared workstation session can be revived without re-entering credentials — this is a direct interaction with ADR-AUTH-010 below and should be read together with it.
- This value is not validated against any specific incident-response or compliance requirement for the platform; if such a requirement exists or emerges, it supersedes this ADR.

---
