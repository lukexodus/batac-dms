# ADR-AUTH-002: Argon2id Parameters


**Status:** Accepted

**Context**

D-AUTH-02 requires Argon2id parameters (memory cost `m`, time cost `t`, parallelism `p`) that meet OWASP's password-hashing guidance (≥19ms per hash) without degrading login throughput on target hardware. The source document proposes `m=65536 (64 MB), t=2, p=1` as a starting point but does not confirm it.

**Decision**

Adopt the proposed starting values — `m=65536 (64 MB), t=2, p=1` — as the Phase 1 default, exposed via environment variables (`ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`) rather than hardcoded.

**Rationale**

These values are OWASP's own published baseline recommendation for Argon2id as of recent guidance, and are a reasonable default in the absence of hardware-specific benchmarking. [Inference — this reasoning assumes the target deployment hardware is broadly comparable to typical commodity server hardware; this has not been benchmarked and is not confirmed.]

**Consequences**

- These values **must be benchmarked on the actual target server hardware** before production traffic. Benchmarking is not optional — it is a precondition this ADR explicitly defers, not waives. The acceptance criterion is ≥19ms per hash on the production-equivalent host without unacceptable login latency under expected concurrent load.
- If benchmarking shows these values produce hash times below 19ms (e.g., on stronger hardware) or unacceptable latency (e.g., on constrained hardware), the environment variables allow adjustment without a code change.
- This ADR does not guarantee these parameters are secure for all future hardware or attack-cost models; Argon2id parameter guidance evolves, and this default should be revisited periodically, not treated as permanent.

---
