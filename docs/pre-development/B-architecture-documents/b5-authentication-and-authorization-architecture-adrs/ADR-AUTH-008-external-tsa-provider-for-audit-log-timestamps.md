# ADR-AUTH-008: External TSA Provider for Audit Log Timestamps


**Status:** Blocked — cannot be resolved by this ADR set

**Context**

D-AUTH-08 requires selecting a specific RFC 3161 Time-Stamping Authority (TSA) provider for the monthly audit log export, which Section 10.3 / Part 11.11 of the source materials already confirm as a requirement.

**Decision**

**No decision is made here.** This is a vendor/procurement selection, not an architectural design choice. I do not have verified, current information about available TSA providers, their pricing, jurisdictional compliance, or suitability for a Philippine local government unit's audit requirements, and I am not going to present a guess as a recommendation. [Unverified — no research into current TSA vendor offerings was performed for this ADR, and any name provided without that research would be an unverified claim presented as fact, which directly contradicts the standard this document is held to.]

**Required next step**

A team member with procurement authority should research current RFC 3161 TSA providers (this is a well-established, narrow vendor category — DigiCert, GlobalSign, and Sectigo are commonly cited as operating in this space, but **that list itself is offered here only as a starting point for research, not a vetted recommendation** — verify current offerings, pricing, and any government-procurement constraints directly with each vendor before selecting). This decision is marked "Pre-production" per the source document's own deadline and does not block the IAM migration.

---
