# ADR-AUTH-007: Account Lockout Policy on Repeated Login Failures

**Status:** Accepted, with one item explicitly deferred to Phase 2

**Context**

D-AUTH-07 asks whether a per-account lockout should supplement the existing per-IP rate limiting (Section 10.4 of B5: 5 attempts per 15 minutes per IP on `/api/auth/login`). The stated concern is that per-IP throttling alone doesn't stop a distributed attack — many IPs each trying a few passwords against the same account.

**Decision**

Add **progressive per-account delays**, not a hard lockout:

| Failures (this account, any IP) | Response                                             |
| ------------------------------- | ---------------------------------------------------- |
| 1–5                             | Normal response time                                 |
| 6                               | 30-second delay before response                      |
| 7                               | 60-second delay                                      |
| 8                               | 2-minute delay                                       |
| 9                               | 5-minute delay                                       |
| 10+                             | 15-minute delay (repeats, does not escalate further) |

The account is never fully locked — a legitimate user can always eventually authenticate, just with increasing delay. This works alongside, not instead of, the existing per-IP rate limiting in Section 10.4.

Additionally: every failure increments an audit-logged counter; an administrator-facing alert fires once a configurable threshold is crossed. **The exact alert threshold is not set by this ADR** — it depends on expected legitimate failure-rate volume (e.g., normal mistyped-password rates among the actual user base), which has not been measured and which this ADR has no basis to invent a number for. [Unverified — no production traffic data exists yet to calibrate this threshold; marking the number as undetermined rather than guessing.] This threshold should be set after Phase 1 launch using observed data, or provisionally set conservatively high and tuned down.

**Explicitly deferred to Phase 2, not part of this decision:** MFA-triggered escalation (e.g., "require TOTP after N failures for privileged roles") is a reasonable future enhancement, but it depends on the MFA hook point described in Section 10.5 of B5, which is explicitly **not active in Phase 1** — TOTP is disabled until `MFA_REQUIRED_ROLES` and `user.totp_enabled` are activated in Phase 2. Writing an MFA-tier escalation into this Phase 1 ADR would describe a control that cannot be enforced yet. This is noted here as a recommended Phase 2 follow-on, to be revisited once Section 10.5's MFA activation lands — it is not a Phase 1 commitment.

**Rationale**

A hard account lockout after N failures is itself a denial-of-service vector: an attacker who only wants to lock a privileged account out of legitimate use (without ever guessing the password) can do so by deliberately triggering the lockout. Progressive delay achieves the same practical goal — making brute force infeasible — without giving an attacker a no-cost way to deny a legitimate user access. [Inference — this is a widely recognized tradeoff in authentication design; it is not specific to this system, and follows from the stated goal of stopping distributed brute force without introducing a new DoS vector.]

**Consequences**

- This requires tracking failure counts and timestamps per-account (not just per-IP as already designed), which is a new piece of state — likely a counter and a last-failure timestamp on `iam.users` or a dedicated table, to be finalized at IAM migration time.
- The delay tiers above are a proposed starting point, not independently validated against this system's actual traffic; like the rate limits in Section 10.4 of B5 (which the document itself already flags as `[Inference]` and tunable), these tiers should be considered tunable after observing real usage, not fixed forever.
- The undetermined alert threshold (above) is **not blocking** for the IAM migration itself — the counter and audit logging can be built now; the threshold is an operational tuning value that can be set or changed later without a schema change.

---
