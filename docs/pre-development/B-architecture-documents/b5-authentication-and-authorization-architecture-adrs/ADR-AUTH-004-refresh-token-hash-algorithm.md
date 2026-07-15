# ADR-AUTH-004: Refresh Token Hash Algorithm

**Status:** Accepted

**Context**

D-AUTH-04 asks whether refresh tokens stored in `iam.refresh_tokens.token_hash` should be hashed with Argon2id (slow, brute-force-resistant) or SHA-256 (fast, sufficient given adequate token entropy). Per Section 1.2 of B5, the raw token is 32 random bytes from `crypto.randomBytes(32)`.

**Decision**

**SHA-256, with a per-token random salt**, not Argon2id.

**Rationale**

Argon2id's brute-force resistance is valuable specifically when the secret being hashed has _low entropy_ relative to guessing — for example, a human-chosen password. A 32-byte (256-bit) cryptographically random token has no guessing-feasible search space; an attacker who has obtained the `token_hash` column gains no practical advantage from the hash being fast versus slow, because brute-forcing a 256-bit random value is infeasible regardless of hash speed. [Inference — this is a standard cryptographic argument about entropy-appropriate hashing, not a claim specific to this system; it follows directly from the token generation method already confirmed in B5 Section 1.2, and is not chained to any other unconfirmed assumption.] Using Argon2id here would add meaningful CPU cost to every refresh-token validation (which happens far more frequently than password validation) for no corresponding security benefit.

**Consequences**

- Every refresh-token lookup is now cheap relative to an Argon2id-based design, which matters given Section 10.4's rate limit allows up to 20 refresh requests per minute per session.
- The salt must be stored alongside the hash (or derived deterministically, e.g., HMAC-SHA256 with a server-side secret key instead of a per-row salt — this ADR does not mandate which variant, only that a per-token-unguessable component is present so that a raw token cannot be reconstructed from the hash alone via precomputed tables). The exact construction (salted SHA-256 vs. HMAC-SHA256) is left to implementation and is not re-litigated here.
- This decision applies only to refresh tokens, not to user passwords (`iam.credentials`), which remain Argon2id per the document's existing, already-confirmed design.

---
