# ADR-AUTH-010: Session `locked_at` Behavior When Access Token Expires While Locked

**Status:** Accepted, with one item explicitly deferred to Phase 2

**Context**

D-AUTH-10 asks what happens when a user locks their screen (Section 4.6 of B5: sets `iam.sessions.locked_at`, does not terminate the session) and the access token expires before they return. Section 4.6 already confirms the refresh token cookie continues rotating in the background while locked, so the refresh token itself does not go stale during a lock — the open question is purely whether that still-valid refresh token is used silently or whether the person must re-enter credentials anyway.

**Decision**

**Silent refresh on unlock**, gated only on the existing refresh-token validity check already described in Section 1.2 of B5 (not found / already used / revoked / expired). If the refresh token is valid, unlocking re-authenticates via password (per Section 4.6's existing "password only; no full login flow" unlock behavior) and the access token is silently refreshed in the background — the person is not separately asked to do anything about token expiry; it's invisible to them.

**Explicitly deferred to Phase 2, not part of this decision:** A separate "step-up authentication" pattern — requiring fresh password or TOTP confirmation specifically before high-risk actions (approvals, signing, role changes) regardless of how recently the user authenticated — is a reasonable enhancement, but it requires an in-session reauthentication challenge mechanism that does not exist anywhere in the current B5 design. Section 10.5 only designs a _login-time_ MFA hook; it does not design a _per-action_ challenge. Adding this now would be a meaningfully larger scope addition than this single deferred decision asked for, and it depends on TOTP infrastructure that, per Section 10.5, isn't active until Phase 2. Flagged here as a recommended Phase 2 follow-on, not a Phase 1 decision.

**Note on an idea raised but not adopted:** A separate "maximum session age" ceiling (distinct from the refresh token's 14-day lifetime per ADR-AUTH-003) — e.g., forcing full re-login after some shorter absolute duration even while the refresh token is still valid — was raised during discussion of this item. **This ADR does not introduce that concept.** It would directly cut against the rationale for the 14-day refresh lifetime in ADR-AUTH-003 (chosen specifically to minimize re-login friction for infrequent users), and the source document defines no such mechanism today. If the team wants a hard ceiling shorter than the refresh token lifetime, that is a new policy axis requiring its own deliberate decision — it is not adopted by default here.

**Rationale**

Section 4.6 of B5 already made the relevant architectural choice — keep the refresh token alive during a lock specifically "to maintain token freshness when the user unlocks" — so silent refresh is simply using the mechanism the document already built for this exact purpose, rather than introducing new behavior. [Inference — Section 4.6's stated purpose for the rotating-refresh-during-lock design implies silent refresh was the intended consumer of that mechanism; the document describes the mechanism but doesn't explicitly say "and therefore unlock should use it silently," so this ADR makes that connection explicit rather than treating it as already stated.]

**Consequences**

- No new token-validity concept is introduced; the unlock flow reuses the exact validity checks already specified in Section 1.2 of B5's refresh token rotation flow.
- Because the refresh token can live up to 14 days (ADR-AUTH-003), an unattended-but-locked shared workstation can, in principle, be silently unlocked via password re-entry for up to 14 days without a full credential challenge for the token itself — the password re-entry at unlock (already required by Section 4.6) remains the actual security control here, not token expiry. This is a direct consequence of combining ADR-AUTH-003 and this ADR and should be understood as a deliberate joint tradeoff, not an oversight.
- Frontend lock/unlock implementation does not need to handle a "your session fully expired, please log in again" state as a normal-path outcome of token expiry alone — only as a result of the refresh token itself being invalid (revoked, reused, past 14 days), which is a pre-existing code path.

---

## D-AUTH-05: Full List of Document-Processing Roles (Not a full ADR — see caveat)

**Status:** Resolved for seeding purposes, with one accuracy flag

**Decision**

Per direction, the following roles are mapped to `type_code = 'document_processor'` for the Platform Administrator exclusion trigger (Section 8.4 of B5), using Section 8.3's category list verbatim:

SP Secretary, Administrative Officer II, Clerk III, Records Officer, Councilor, Committee Chair, Committee Member, Mayor, Vice Mayor, Acting Mayor, OIC (any), Encoder, Records Aide, Librarian, Citizen.

**Flag — not a deviation, a risk note for whoever does the seeding**

Two entries in this list are not, on their face, literal role names with stable database identity in the way the others are:

- **"Acting Mayor"** and **"OIC (any)"** read as _role-category descriptions_ in Section 8.3 of B5 (which itself marks the whole list `[Inference — role list not formally defined]`), not confirmed literal rows for `iam.roles.name`. "OIC (any)" in particular looks like shorthand for "an OIC designation for any office," not one fixed role. [Unverified — whether "OIC (any)" corresponds to a single `iam.roles` row or to a pattern matched across multiple office-specific OIC roles was not confirmed in either this document or the source materials reviewed.]
- This was carried through verbatim as instructed. It is flagged here so it isn't silently lost — whoever writes the actual `iam.roles` seed data should confirm whether "OIC (any)" needs to become several literal seeded roles (one per office an OIC can cover) or a single role with a different enforcement mechanism, rather than seeding a literal row named "OIC (any)".

**Why this isn't a full ADR**

D-AUTH-05's "why it matters" column in Section 11 of B5 ties this specifically to IAM seed data, not to a migration-blocking schema decision — the schema for `iam.roles.type_code` already exists per Section 8.4's trigger design; this is data, not architecture. It's recorded here for completeness of this document's resolution of Section 11, not because it required an architectural decision.

---
