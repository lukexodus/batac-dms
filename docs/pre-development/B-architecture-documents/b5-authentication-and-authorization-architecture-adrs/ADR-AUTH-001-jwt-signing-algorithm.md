# ADR-AUTH-001: JWT Signing Algorithm


**Status:** Accepted

**Context**

D-AUTH-02 in the source document frames this as a tradeoff between RS256 (asymmetric, enables public-key verification by external relying parties) and HS256 (symmetric, simpler key management). The deciding factor named in the source document is whether SSO (Section 9 of B5) is a near-term priority.

**Decision**

The team has confirmed SSO integration is a near-term priority, not a "someday" migration. **RS256** is selected.

**Consequences**

- A key pair must be generated and the private key secured before the first IAM migration (it is needed to sign tokens from day one, not introduced later at SSO cutover).
- Key rotation policy is not addressed by this ADR and should be defined separately before production.
- The public key must be exposed via a JWKS endpoint or equivalent mechanism ahead of any external relying party onboarding (Section 9 of B5 describes the token exchange flow but does not specify a key-distribution endpoint — this is a gap the SSO migration work will need to close, not something resolved here).
- This decision has no impact on Phase 1 functionality; RS256 and HS256 are interchangeable from the application's own perspective since no external party verifies tokens in Phase 1.

---
