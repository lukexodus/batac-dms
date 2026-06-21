# B5 — Authentication and Authorization Architecture

**Status:** Pre-Development Baseline — Blocking Document **Last Updated:** June 2026 **Audience:** Development team (internal reference) **Source authority:** Consolidated Architecture & Requirements Reference (Iteration 3, June 2026); Stack Context document

## Table of Contents

- [L54–L91] Document Notes — Rules for confirmed/inferred content labels and lists of covered and out-of-scope security topics.
- [L92–L227] 1. Token Architecture
  - [L94–L152] 1.1 Access Token (JWT) — Specifications for RS256 signing, TTL configuration, cookie storage, registered/private claims, and immediate revocation rules.
  - [L153–L227] 1.2 Refresh Token — Requirements for opaque string format, SHA-256 server-side hashing, family-wide reuse-detection flow, and table schema.
- [L228–L265] 2. Cookie Configuration — HttpOnly, Secure, and SameSite attributes, scoping access/refresh tokens, expiration behavior, and development environment config.
- [L266–L310] 3. PKCE for the SPA — Client-side code verifier/challenge generation flow, token exchange protocol, and memory-only storage rules.
- [L311–L425] 4. Session Management
  - [L315–L326] 4.1 Session Lifecycle — Core lifecycle events and rules for inactivity, concurrent sessions, forced logout, and shared workstation locking.
  - [L327–L354] 4.2 Session Table Schema [Inference — not confirmed] — PostgreSQL schema for iam.sessions with partial unique index to enforce single active session.
  - [L355–L376] 4.3 Concurrent Session Enforcement — Step-by-step logic for terminating existing sessions and notifying users during concurrent login attempts.
  - [L377–L383] 4.4 Inactivity Detection — Server-side route handler hook checks, UI-driven 25-minute warnings, and keepalive logic.
  - [L384–L404] 4.5 Forced Logout [Inference for implementation; rule is CONFIRMED] — Step-by-step API endpoint execution sequence, role requirements, and mandatory audit log reasoning.
  - [L405–L416] 4.6 Shared Workstation Lock [Inference for implementation] — Lock screen suspension flow, credential checks, and silent token refresh mechanics during unlock.
  - [L417–L425] 4.7 Administration Transition Sessions [CONFIRMED] — Graceful expiration rules, soft-deletion handling, and fallback step assignment during mayoral transitions.
- [L426–L646] 5. Authorization Model
  - [L428–L439] 5.1 ABAC with RBAC as Entry Point — Rationale for combining ABAC and RBAC to support office-scoped rules, and binary evaluation outcome.
  - [L440–L451] 5.2 Authorization Tiers — Definitions and examples of system-level, platform-level, and instance-level access tiers.
  - [L452–L473] 5.3 Resource Types — Reference table mapping core resource types to their key attributes used in authorization policies.
  - [L474–L503] 5.4 Actions — List of operational actions defining permissions for LGU workflows, document management, and administration.
  - [L504–L568] 5.5 Policy Evaluation Order — Sequence of the deny-first cascade checking tenant isolation, IT admin limits, RBAC, and ABAC scopes.
  - [L569–L604] 5.6 Office Scoping — Office-scoped restriction mechanisms, cross-office read permissions, and multi-referral step logic.
  - [L605–L646] 5.7 Delegation Scope in ABAC — Evaluation-time scope expansion, required JSONB schema structure, and single-active-delegation database index.
- [L647–L831] 6. Row-Level Security
  - [L649–L663] 6.1 Principle — Dual-layer defense philosophy using PostgreSQL RLS as a database-level backstop behind application-level ABAC.
  - [L664–L675] 6.2 Database Roles — Purpose and key privileges for specific database accounts including runtime, audit, and IT admin.
  - [L676–L690] 6.3 Session Context Variables — Transaction-scoped PostgreSQL session variables set by Fastify middleware to inform RLS policies.
  - [L691–L739] 6.4 Tables with RLS Enabled — Mapping of tables in all five schemas to their specific RLS policy intent.
  - [L740–L831] 6.5 Example RLS Policy Patterns [Inference] — SQL patterns for city isolation, office scope, IT admin block, and has_cross_office_read_grant logic.
- [L832–L900] 7. IT Admin Data Isolation — Invariant blocking IT Admin access to Confidential/Restricted document content via three-layer enforcement.
- [L901–L1009] 8. Platform Administrator Role Exclusion Invariant
  - [L905–L908] 8.1 Rule — Prohibition of combining the Platform Administrator role with any operational document-processing role on one account.
  - [L909–L912] 8.2 Rationale — Fraud prevention reasoning based on avoiding conflicts of interest between rule definitions and operational execution.
  - [L913–L928] 8.3 Definition of Document-Processing Roles [Resolved for seeding — ADR/D-AUTH-05; see flag below] — Incompatible role categories, compatible technical roles, and seed data decisions.
  - [L929–L1009] 8.4 Enforcement — TypeScript application-level validations and database-level trigger code to block illegal role combinations.
- [L1010–L1083] 9. Future SSO Migration Path — Design choices for OAuth/OIDC compatibility, external identity mapping column additions, and token exchange flow.
- [L1084–L1239] 10. Implementation Notes
  - [L1086–L1120] 10.1 Fastify Plugin Structure [Inference] — Verification hooks, database session variable setup, and public route configurations.
  - [L1121–L1148] 10.2 tRPC Context [Inference] — Definition of AuthContext and Context TypeScript types used to supply information to ABAC evaluators.
  - [L1149–L1175] 10.3 Audit Events for Authentication and Authorization Actions — Payload fields for 17 auditable events covering logins, logouts, role changes, and ABAC denials.
  - [L1176–L1191] 10.4 Rate Limiting — IP-based and session-based request limits per minute/hour for login, logout, and password resets.
  - [L1192–L1212] 10.4.1 Account-Level Lockout Policy [Resolved — [ADR-AUTH-007](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-007-account-lockout-policy-on-repeated-login-failures.md); one value still open] — Progressive delays (up to 15 minutes) for repeated login failures instead of hard lockout.
  - [L1213–L1239] 10.5 MFA Readiness: Phase 1 Design, Phase 2 Activation — Phase 1 flow structure supporting environment-gated TOTP validation in Phase 2.
- [L1240–L1258] 11. Deferred Decisions (Must Resolve Before IAM Module Migration) — Summary of resolutions for the 10 deferred decisions; open follow-ups are superseded by Section 12.
- [L1259–L1272] 12. Remaining Open Items — Four unresolved or follow-up items not blocking IAM migration, detailing what is open and when resolution is required.

---

## Document Notes

### Confirmed vs. Inferred Content

This document draws from two confirmed sources: the Consolidated Architecture & Requirements Reference (Post-Interview 2 + Developer Decisions) and the Stack Context document. Where the confirmed sources are silent on an implementation detail, this document proposes a design and marks it explicitly:

- **[CONFIRMED]** — Stated directly in the consolidated reference or stack context.
- **[Inference]** — Logically derived from confirmed facts; not yet formally decided. Each inference is a distinct step; none are chained into further inferences without re-labeling.
- **[Unresolved]** — Must be decided before the IAM module's first migration. Listed in Section 9.

Do not treat `[Inference]` items as decisions. They are proposals requiring team review.

### Scope

This document covers:

- JWT structure and claims
- Refresh token rotation and reuse detection
- HTTP-only cookie configuration
- PKCE for the SPA
- Session management rules (inactivity, concurrent sessions, forced logout, shared workstations)
- ABAC policy model: resource types, actions, evaluation order, office scoping, delegation scope
- Row-Level Security: tables covered and policy intent
- IT Admin data isolation
- Platform Administrator role exclusion invariant
- Future SSO migration path
- Implementation notes: Fastify hooks, tRPC context, audit events, rate limiting, MFA readiness

This document does **not** cover:

- MFA implementation detail (Phase 2 scope; hook point designed in Phase 1 — see Section 8.5)
- Citizen portal authentication (Phase 3 scope)
- PhilSys integration (Phase 5, feature-flagged)
- Workflow engine authorization (covered in the Workflow Engine Architecture document)
- Records Officer bulk operation authorization (covered in the Document Management Architecture document)

---

## 1. Token Architecture

### 1.1 Access Token (JWT)

**Sources:** Stack Context ("Short-lived JWT access tokens (15–60 min)"); Consolidated Reference Part 11.1, Part 11.17.

|Property|Value|Source|
|---|---|---|
|Format|Signed JWT (JWS compact serialization)|[CONFIRMED]|
|Lifetime|15–60 minutes — configurable per environment via `JWT_ACCESS_TTL_SECONDS`|[CONFIRMED]|
|Storage|HTTP-only cookie exclusively|[CONFIRMED]|
|Client-side localStorage / sessionStorage|**Never** — architectural prohibition|[CONFIRMED]|
|Signing algorithm|RS256|[Resolved — [ADR-AUTH-001](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-001-jwt-signing-algorithm.md). SSO integration confirmed as a near-term priority; RS256 selected to support public-key verification by external relying parties. Key pair generation and secure private-key storage required before first IAM migration.]|

#### JWT Payload — Registered Claims

```json
{
  "iss": "batac-lgu-platform",
  "sub": "<user-uuid>",
  "iat": 1751234567,
  "exp": 1751238167,
  "jti": "<token-uuid>"
}
```

- `sub` holds the internal `iam.users.id` UUID. It is never an external identifier or username.
- `jti` is a UUID v4 generated per token; stored in `iam.sessions` for revocation checking.

#### JWT Payload — Private Claims

[Inference — claim names and structure not confirmed in source documents. The following is a proposed design.]

```json
{
  "uid":     "<user-uuid>",
  "oid":     "<primary-office-uuid>",
  "rid":     ["<role-uuid-1>", "<role-uuid-2>"],
  "perm":    ["documents:read", "documents:approve", "workflow:advance"],
  "dg":      "<delegation-grant-uuid | null>",
  "city":    "<batac-city-uuid>",
  "sid":     "<session-uuid>",
  "is_ita":  false,
  "is_pa":   false
}
```

|Claim|Purpose|Notes|
|---|---|---|
|`uid`|User identity for downstream lookups|Redundant with `sub` but avoids casting ambiguity|
|`oid`|Primary office assignment for office scoping in ABAC|The office this user belongs to in `organization.assignments`|
|`rid`|Role IDs for RBAC entry-point check|Array; populated at token issue from active role assignments|
|`perm`|Resolved permission codes|Derived from `rid` at token issue; format: `<resource>:<action>`|
|`dg`|Active delegation grant UUID|Null if user is not currently acting under a delegation; populated if active `delegation_grant` exists with `delegated_to_user_id = uid`|
|`city`|`city_id` for tenant isolation|Always `batac-city-uuid` in Phase 1; multi-tenancy path for future|
|`sid`|Session UUID from `iam.sessions`|Used for concurrent session enforcement at every authenticated request|
|`is_ita`|Boolean: is this an IT Admin session|Shortcircuits to content access denial in ABAC evaluation step 2|
|`is_pa`|Boolean: is this a Platform Administrator session|Shortcircuits to operational denial in ABAC evaluation step 3|

**Critical timing note [Inference]:** `perm` and `rid` are resolved at token issue time. A role assignment change during an active token's lifetime does not take effect until the next token refresh. Role changes that must take effect immediately (e.g., employee termination, emergency revocation) require a forced session termination. The forced logout mechanism (Part 11.17) covers this case.

### 1.2 Refresh Token

**Sources:** Stack Context ("Long-lived refresh tokens stored server-side in PostgreSQL; rotated on every refresh"). Consolidated Reference Part 11.1.

|Property|Value|Source|
|---|---|---|
|Format|Cryptographically random opaque string|[CONFIRMED intent; format is [Inference]]|
|Generation|32 bytes from `crypto.randomBytes(32)`, base64url-encoded|[Inference]|
|Server-side storage|PostgreSQL `iam.refresh_tokens`, hashed with SHA-256 + per-token salt|[Resolved — [ADR-AUTH-004](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-004-refresh-token-hash-algorithm.md). Argon2id is unnecessary here: the raw token is a 32-byte (256-bit) cryptographically random value with no guessing-feasible search space, so a slow hash adds CPU cost on every refresh (up to 20/min/session per Section 10.4) with no corresponding security benefit. Argon2id remains the algorithm for `iam.credentials` password hashing, which is unaffected by this decision.]|
|Client-side storage|HTTP-only cookie|[CONFIRMED]|
|Rotation policy|One-time use — rotated on every use|[CONFIRMED]|
|Lifetime|14 days|[Resolved — [ADR-AUTH-003](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-003-refresh-token-lifetime.md). Chosen over the document's original 7-day starting point to prioritize convenience for staff with infrequent access; offset by the existing reuse-detection design (token families) as the primary mitigation against a stolen token's 14-day usability window. Interacts directly with the Section 4.6 shared-workstation lock behavior — see that section.]|
|Reuse detection|Token families; family-wide revocation on reuse|[Inference]|

#### Refresh Token Table Schema [Inference — not confirmed]

```sql
CREATE TABLE iam.refresh_tokens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES iam.users(id),
  session_id        UUID        NOT NULL REFERENCES iam.sessions(id),
  token_hash        TEXT        NOT NULL,          -- SHA-256(token + salt); see [ADR-AUTH-004](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-004-refresh-token-hash-algorithm.md)
  salt              TEXT        NOT NULL,           -- Per-token random salt for token_hash
  family_id         UUID        NOT NULL,           -- Groups all tokens in one auth chain
  used_at           TIMESTAMPTZ,                    -- NULL = not yet used; set on first (and only) use
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  revocation_reason TEXT,                           -- 'logout' | 'reuse_detected' | 'forced' | 'family_revoked'
  replaced_by       UUID        REFERENCES iam.refresh_tokens(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  city_id           UUID        NOT NULL
);

CREATE INDEX idx_rt_user_id    ON iam.refresh_tokens(user_id);
CREATE INDEX idx_rt_family_id  ON iam.refresh_tokens(family_id);
CREATE INDEX idx_rt_expires_at ON iam.refresh_tokens(expires_at)
  WHERE revoked_at IS NULL AND used_at IS NULL;
```

#### Token Rotation Flow [Inference]

```
Client presents refresh token cookie → /api/auth/refresh

  1. Hash the presented token value
  2. Lookup matching row in iam.refresh_tokens WHERE token_hash = ?
  3. If not found → 401 Unauthorized

  4. If found AND used_at IS NOT NULL:
     → REUSE DETECTED
     → Revoke entire family: UPDATE iam.refresh_tokens
         SET revoked_at = NOW(), revocation_reason = 'reuse_detected'
         WHERE family_id = ? AND revoked_at IS NULL
     → Terminate session: UPDATE iam.sessions SET active = false, ...
     → Audit log: token_reuse_detected event (user_id, family_id, ip, action_taken)
     → 401 Unauthorized with "Session security event detected" message

  5. If found AND revoked_at IS NOT NULL:
     → 401 Unauthorized

  6. If found AND expires_at < NOW():
     → 401 Unauthorized

  7. Valid token:
     → Mark current token used: UPDATE ... SET used_at = NOW(), replaced_by = <new-id>
     → Generate new raw token (32 bytes, base64url)
     → Insert new refresh token row (same family_id, new id)
     → Update iam.sessions.last_activity_at
     → Issue new access token JWT
     → Set both cookies
     → Return 200
```

---

## 2. Cookie Configuration

**Sources:** Stack Context ("HTTP-only, Secure, SameSite=Strict cookies — never localStorage"); Consolidated Reference Part 11.1.

Both the access token and refresh token are delivered exclusively as HTTP-only cookies. No token material is ever sent in a response body or accessible from JavaScript.

### 2.1 Cookie Attributes

|Cookie|Name|Path|Attributes|
|---|---|---|---|
|Access token|`batac_at`|`/`|`HttpOnly; Secure; SameSite=Strict`|
|Refresh token|`batac_rt`|`/api/auth/refresh`|`HttpOnly; Secure; SameSite=Strict`|

**Attribute rationale:**

- **`HttpOnly`** — Cookie is inaccessible from JavaScript. XSS attacks cannot read the token.
- **`Secure`** — Cookie is transmitted only over HTTPS. Development environments may relax to HTTP on `localhost` only, controlled by `COOKIE_SECURE=false` env flag.
- **`SameSite=Strict`** — Cookie is not sent on cross-site requests. Provides CSRF protection without requiring a separate CSRF token on any endpoint.
- **Refresh token path scoped to `/api/auth/refresh`** — The refresh token cookie is not sent to any other endpoint. If the access token expires mid-session, only the designated refresh endpoint receives the refresh cookie.

### 2.2 Expiry

- Both cookies carry an explicit `Expires` attribute (absolute timestamp) in addition to `Max-Age`, for cross-browser compatibility. [Inference]
- Cookie `Expires` is set to match the respective token's `exp` or `expires_at`.
- On logout or forced logout: both cookies are cleared by setting `Expires` to a past date and `Max-Age=0`.

### 2.3 Secure Flag in Development [Inference]

Development environments run on `http://localhost`. The `Secure` attribute blocks cookies over plain HTTP in most browsers. Controlled via:

```
COOKIE_SECURE=false   # Only in development; never in staging or production
```

Production and staging always have `COOKIE_SECURE=true`. This is enforced at startup via Zod config validation (fail-fast if `NODE_ENV=production` and `COOKIE_SECURE=false`).

---

## 3. PKCE for the SPA

**Sources:** Stack Context ("PKCE for the SPA (public client)"). Consolidated Reference Part 11.1.

The web SPA (`/apps/web`) is a public client — it cannot hold a client secret. PKCE (Proof Key for Code Exchange, RFC 7636) is used to bind the token request to the initiating party.

### 3.1 PKCE Flow

```
1. SPA generates code_verifier:
   - 32 bytes from crypto.getRandomValues()
   - base64url-encoded (no padding)
   - 43–128 characters

2. SPA computes code_challenge:
   - SHA-256(code_verifier)
   - base64url-encoded result

3. Login request includes:
   - code_challenge
   - code_challenge_method = "S256"

4. Server stores (code_challenge, user_id, expiry) temporarily.
   Issues an authorization code (short-lived opaque string).

5. SPA sends token exchange:
   - authorization_code
   - code_verifier

6. Server verifies:
   - SHA-256(code_verifier) === stored code_challenge
   - If mismatch: 400 Bad Request
   - If match: issue access token + refresh token via cookies
```

### 3.2 Phase 1 Context

In Phase 1, the server is both the authorization server and the resource server — there is no external OAuth provider. PKCE applies to the SPA's login exchange with the Fastify backend. This is correct behavior for a first-party SPA even without a third-party IdP, and it positions the architecture for the SSO migration path (Section 8).

### 3.3 `code_verifier` Storage [Inference]

The `code_verifier` is generated in the browser and held in memory (JavaScript variable) for the duration of the login flow. It is never written to localStorage, sessionStorage, or a cookie. It is discarded after the token exchange completes.

---

## 4. Session Management

**Sources:** Consolidated Reference Part 11.17 (confirmed session rules).

### 4.1 Session Lifecycle

|Event|Action|Source|
|---|---|---|
|Successful login|New row in `iam.sessions`; access + refresh token cookies set|[CONFIRMED]|
|Inactivity at 25 minutes|Warning displayed to user in UI; countdown visible|[CONFIRMED]|
|Inactivity at 30 minutes|Session terminated; cookies cleared; redirect to login|[CONFIRMED]|
|User-initiated logout|Session terminated; both cookies cleared; refresh token revoked|[CONFIRMED]|
|New login from different device|Existing active session terminated; new session created; notification sent to user|[CONFIRMED]|
|Forced logout (IT/Security Admin)|Session forcibly terminated; audit-logged with mandatory reason; user sees "Session ended by administrator" message on next request|[CONFIRMED]|
|Shared workstation lock|Session suspended (not terminated); screen locked; re-authentication required to resume|[CONFIRMED]|

### 4.2 Session Table Schema [Inference — not confirmed]

```sql
CREATE TABLE iam.sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES iam.users(id),
  active               BOOLEAN     NOT NULL DEFAULT true,
  ip_address           INET,
  user_agent           TEXT,
  last_activity_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at            TIMESTAMPTZ,                    -- Set when "Switch User / Lock Screen" is used
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at        TIMESTAMPTZ,
  termination_reason   TEXT
    CHECK (termination_reason IN
      ('logout', 'inactivity', 'forced', 'replaced', 'expired', 'lock')),
  terminated_by        UUID        REFERENCES iam.users(id),  -- NULL = system / user themselves
  city_id              UUID        NOT NULL
);

-- Partial index: only one active session per user
CREATE UNIQUE INDEX idx_sessions_one_active_per_user
  ON iam.sessions(user_id)
  WHERE active = true;
```

The `CREATE UNIQUE INDEX ... WHERE active = true` partial index enforces the single-active-session invariant at the database level. An application bug that attempts to create a second active session for the same user will receive a `UniqueViolation` error from PostgreSQL.

### 4.3 Concurrent Session Enforcement

**Rule:** One active session per user at any time. [CONFIRMED — Part 11.17]

**Enforcement sequence on new login:**

```
POST /api/auth/login
  1. Validate credentials
  2. Check iam.sessions WHERE user_id = ? AND active = true
  3. If existing active session found:
     → UPDATE iam.sessions SET active = false,
         terminated_at = NOW(),
         termination_reason = 'replaced'
       WHERE id = <existing_session_id>
     → Revoke all refresh tokens for that session
     → Enqueue notification to user (device/IP of terminated session)
     → Audit log: session_replaced event
  4. Insert new iam.sessions row (active = true)
  5. Issue new tokens
```

### 4.4 Inactivity Detection

- `iam.sessions.last_activity_at` is updated on each authenticated request.
- Inactivity check runs in the `preHandler` hook on every protected route: `if NOW() - last_activity_at > 30 min → reject request, terminate session`.
- The 25-minute warning is frontend-driven (idle timer monitoring keyboard/mouse events). The frontend sends a keepalive request to a designated endpoint when the user resumes activity before the 30-minute mark.
- The 30-minute server-side check runs independently of the frontend timer — a frozen browser tab that has not refreshed the token cannot bypass session expiry.

### 4.5 Forced Logout [Inference for implementation; rule is CONFIRMED]

Forced logout is available to IT Admin and Security Admin roles. [CONFIRMED — Part 11.17]

```
POST /api/admin/sessions/:session_id/terminate
  Body: { reason: string }   -- mandatory

  1. Verify actor holds IT Admin or Security Admin role
  2. UPDATE iam.sessions SET active = false,
       terminated_at = NOW(),
       termination_reason = 'forced',
       terminated_by = <actor_id>
     WHERE id = ?
  3. Revoke all active refresh tokens for the session
  4. Audit log: forced_logout event (actor_id, target_user_id, session_id, reason)
  5. Target user's next request → 401; user sees "Session ended by administrator"
```

The `reason` field is mandatory and stored in both the session row and the audit event. A force logout without a stated reason is rejected at the application layer.

### 4.6 Shared Workstation Lock [Inference for implementation]

The "Switch User / Lock Screen" action does not terminate the session. It sets `iam.sessions.locked_at = NOW()`. While locked:

- The access token cookie remains set but all protected routes reject requests with locked session status.
- A lock screen UI is shown.
- Re-authentication (password only; no full login flow) resumes the session and clears `locked_at`.
- The refresh endpoint continues to rotate tokens while locked (to maintain token freshness when the user unlocks).
- **[Resolved — [ADR-AUTH-010](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-010-session-locked_at-behavior-when-access-token-expires-while-locked.md)]** If the access token has expired by the time the user unlocks, the unlock flow performs a silent refresh using the still-valid (still-rotating) refresh token, gated only on the same validity checks already defined in Section 1.2 (not found / already used / revoked / expired). The user is not separately prompted about token expiry — re-entering their password to unlock (already required, above) is the security control; token refresh itself is invisible. A full re-login is required only if the refresh token itself is invalid per those existing checks, not merely because the access token expired while locked.
    - Explicitly out of scope for this decision, deferred to Phase 2: step-up (re-)authentication for specific high-risk actions (approvals, signing, role changes) regardless of recent login — this would require an in-session challenge mechanism not present anywhere in this design, and depends on TOTP infrastructure that Section 10.5 does not activate until Phase 2.
    - Explicitly not adopted: a separate "maximum session age" ceiling shorter than the 14-day refresh token lifetime (Section 1.2). Introducing one would cut against the rationale for that 14-day lifetime; if a hard ceiling independent of refresh-token validity is wanted, it requires its own deliberate decision and is not introduced by default here.

### 4.7 Administration Transition Sessions [CONFIRMED]

- In-flight documents requiring the prior Mayor's signature automatically wait for the new Mayor. No manual reassignment is required. [CONFIRMED — Part 11.13]
- Sessions of departing officials expire naturally. Their `iam.users` records are soft-deleted (`deleted_at`), which prevents new logins.
- Office-level step assignee fallback rules reassign pending workflow steps to the new officeholder when their account becomes active.
- No forced session termination at administration change is required.

---

## 5. Authorization Model

### 5.1 ABAC with RBAC as Entry Point

**Source:** Consolidated Reference Part 11.8 ("ABAC with RBAC as the simplified entry point").

**Model:** Attribute-Based Access Control (ABAC) with Role-Based Access Control (RBAC) as the administrative entry point.

**Why not pure RBAC:** RBAC cannot express office-scoped access rules. The rule "a user may approve a document only if it is owned by their office and currently at a step assigned to their office" requires evaluating resource attributes (`document.office_id`, `step.assignee_office_id`) against subject attributes (`user.office_id`). This is a native ABAC concern.

**Why ABAC with RBAC entry point:** RBAC defines which abstract actions a role may perform (e.g., `sp-secretary` can `approve` documents). ABAC refines those permissions using resource attributes at evaluation time. Platform Administrators configure roles and their abstract permissions; ABAC policies in code enforce the attribute refinements.

**Policy evaluation result:** Binary — `ALLOW` or `DENY`. No partial permissions.

### 5.2 Authorization Tiers

**Source:** Consolidated Reference Part 11.8 (three tiers confirmed).

|Tier|Scope|Who configures|Example capabilities|
|---|---|---|---|
|Tier 1|System-level (hardcoded)|Code only|Audit log insert; backup and restore; schema migrations; encryption key management|
|Tier 2|Platform-level|Platform Administrator via admin UI|Role definitions; workflow step definitions; document type definitions; office hierarchy; retention schedules; SLA thresholds; numbering series; public visibility rules|
|Tier 3|Instance-level (runtime)|Derived from workflow state and explicit grants|Current step assignee; document owning office; classification level; explicit share grants|

**Tier 1 is the only tier that configures the audit log.** Platform Administrators cannot change audit log behavior. No role grants the ability to modify or delete audit records.

### 5.3 Resource Types

[Inference — resource type names not confirmed in source documents. Derived from the module boundary map in Part 10.2 and document type list in Part 4.]

|Resource Type|Key Attributes Used in Policy|Notes|
|---|---|---|
|`document`|`document_type_id`, `office_id`, `classification_level`, `workflow_status`, `city_id`|Primary protected resource|
|`document_version`|`document_id` → inherits parent classification|Version access inherits document access|
|`document_attachment`|`document_id` → inherits parent classification|Same as version|
|`document_number`|`document_id`|Numbering data inherits parent access|
|`workflow_instance`|`document_id`, `current_step_type`, `current_step_assignee_office_id`|Instance visibility scoped to owning office|
|`workflow_step_instance`|`assignee_user_id`, `assignee_office_id`, `step_type`, `status`|Step-level action gating|
|`iam_user`|`office_id`, `active`, `city_id`|User directory vs. sensitive auth data|
|`role`|`role_type`|Role definitions — Tier 2 only|
|`office`|`office_type`, `city_id`|Organization structure — Tier 2 only|
|`delegation_grant`|`delegating_user_id`, `delegated_to_user_id`, `scope`, `active`|Visible only to the parties involved|
|`audit_event`|`city_id`, `actor_id`|Tier 1 access only|
|`citizen_complaint`|`status`, `assignee_office_id`, `city_id`|Complaint handling — SP Secretariat scoped|
|`citizen_request`|`requester_user_id`, `status`|Document copy requests|
|`session`|`user_id`, `active`|Own sessions only; IT Admin sees all|
|`report_output`|`classification_level`, `city_id`|Report access tied to underlying document access|

### 5.4 Actions

[Inference — action vocabulary not confirmed. The following is a proposed set derived from confirmed workflow steps and operational patterns.]

|Action|Description|
|---|---|
|`create`|Create a new resource instance|
|`read`|Read resource content or metadata|
|`update`|Modify a resource (non-state-change)|
|`delete`|Soft-delete via `deleted_at` (no hard deletes — invariant)|
|`submit`|Submit a draft document into workflow|
|`approve`|Approve a workflow step|
|`reject`|Reject a workflow step (returns to prior step or archives)|
|`amend`|Log an amendment to a document at a workflow step|
|`advance`|Manually advance a workflow step without completing prerequisites (SP Secretary only; always audit-logged with mandatory comment)|
|`assign`|Assign a workflow step to a specific user or office|
|`complete_step`|Mark a workflow step as completed (system action or user action)|
|`number_assign`|Assign a document number (preliminary or final)|
|`number_promote`|Promote a document from preliminary ("Draft") number to final number|
|`certify_urgent`|Log a Certification of Urgency and update associated workflow instances|
|`revoke_delegation`|Revoke an active delegation grant|
|`export`|Export one or more documents|
|`bulk_archive`|Bulk archive (Records Officers only)|
|`bulk_export`|Bulk export|
|`force_logout`|Terminate another user's active session|
|`manage_roles`|Create, edit, deactivate role definitions (Platform Administrator only)|
|`manage_workflow_def`|Publish or deprecate a workflow definition version (Platform Administrator only)|
|`view_audit`|Read audit log entries (authorized readers only — see Section 7)|
|`scan_qr`|Scan a QR code to retrieve document tracking record|

### 5.5 Policy Evaluation Order

[Inference — the evaluation order is proposed based on the confirmed rules from Parts 11.8, 11.4, 11.7, and 12. It is not explicitly sequenced in the source documents.]

Policy evaluation runs in a deny-first cascade. **The first `DENY` encountered terminates evaluation immediately and returns `DENY`.** All conditions must pass for `ALLOW`.

```
Step 1 — CITY ISOLATION GATE
  resource.city_id ≠ subject.city_id
  → DENY (tenant isolation; cannot be overridden by any role or delegation)

Step 2 — IT ADMIN CONTENT ISOLATION
  subject.is_it_admin = true
  AND resource.classification_level IN ('confidential', 'restricted')
  AND action IN ('read', 'export', 'bulk_export')
  → DENY (architectural invariant; cannot be overridden)

Step 3 — PLATFORM ADMINISTRATOR EXCLUSION
  subject.is_platform_admin = true
  AND action NOT IN (Tier 2 platform-admin actions list)
  → DENY (Platform Admin cannot perform operational document actions)

Step 4 — CLASSIFICATION GATE
  resource.classification_level IN ('confidential', 'restricted')
  AND subject does not hold an explicit role grant for that classification level
  → DENY

Step 5 — SOFT DELETE GATE
  resource.deleted_at IS NOT NULL
  AND action ≠ 'read'  (soft-deleted resources remain readable by authorized roles for audit purposes)
  → DENY

Step 6 — RBAC CHECK
  Does subject hold any role that grants the requested (resource_type, action) pair?
  → No matching role found → DENY
  → Role found → proceed to Step 7

Step 7 — ABAC REFINEMENTS (all must pass)

  7a. OFFICE SCOPE
      resource.office_id = subject.office_id
      OR subject holds an explicit cross-office permission for this resource type
      OR subject holds an active delegation grant that extends scope to cover resource.office_id
      → Fail → DENY

  7b. WORKFLOW STEP SCOPE (applies to workflow_step_instance resources)
      step.assignee_office_id = subject.office_id
      OR step.assignee_user_id = subject.user_id
      OR subject holds SP Secretary role (cross-step visibility)
      → Fail → DENY

  7c. DOCUMENT STATE GATE
      Is the requested action permitted for resource's current workflow_status?
      (e.g., 'approve' is not permitted when status = 'archived')
      → Fail → DENY

  7d. DELEGATION SCOPE (applies when subject.dg is not null)
      Does the active delegation grant's scope include the requested (resource_type, action)?
      → Fail → DENY

Step 8 — ALLOW
```

**Implementation note [Inference]:** Steps 1 through 5 are hard-coded invariants in a `PolicyGuard` service and are not configurable by Platform Administrators. Steps 6 through 7 are enforced by the evaluator at runtime against the RBAC table and resource attributes. The evaluator is a single service callable from both Fastify `preHandler` hooks and tRPC procedure guards.

### 5.6 Office Scoping

**Source:** Consolidated Reference Part 11.8 ("ABAC policies evaluated at request time. PostgreSQL Row-Level Security as a second data-isolation layer"). Office structure confirmed in Parts 3 and 6.

**Principle:** A user assigned to one office cannot read, update, or act on documents owned by a different office, unless they hold an explicit cross-office permission or an active delegation grant extends their scope.

#### How Office Scoping Works

1. `organization.offices` defines the hierarchy: SP Secretariat, Mayor's Office, City Hall departments, Barangays.
2. Every document in `documents.documents` carries `office_id` pointing to the owning office.
3. Every user has a primary record in `organization.assignments` linking them to one office.
4. The user's `office_id` is embedded in their JWT access token (`oid` claim) and loaded into tRPC context on each request.
5. At Step 7a of the policy evaluation cascade, `resource.office_id` is compared against `subject.office_id`.

#### Cross-Office Permissions

Certain roles are granted explicit cross-office read access by design: [Inference]

|Role|Cross-Office Access|
|---|---|
|Records Officer|Read metadata (not content) across all offices for archival purposes|
|SP Secretary|Read and act on all workflow steps across SP Secretariat scope|
|Platform Administrator|Read organizational structure and workflow definitions only; no document content access|
|IT Admin|Audit log and session data only; no document content across any office|

#### Office Scoping for Workflow Steps

- A workflow step's `assignee_office_id` determines who can see and act on the step.
- SP Secretariat staff see all pending steps in the Secretariat's scope (full queue visibility for operations).
- Mayor's Office staff see only steps assigned to the Mayor's Office (pending Mayor action queue).
- Committee chairs and members see only steps assigned to their committee.

#### Office Scoping for Multi-Referral Steps [CONFIRMED — Part 8.3]

The `multi_referral` step type assigns to multiple committee offices simultaneously. Each committee sees the step in their pending action queue. The step belongs to the SP Secretariat's office scope for management purposes; any SP Secretary or authorized Secretariat staff can view and manage the step from the Secretariat side. Committee members see only their committee's contribution sub-task.

### 5.7 Delegation Scope in ABAC

**Sources:** Consolidated Reference Parts 4.12, 11.13, 12 (Invariant 16).

When a user holds an active delegation grant, the ABAC evaluator expands their effective authorization scope for the duration of the delegation.

**At request time:**

1. The JWT `dg` claim carries the active delegation grant UUID (null if none active).
    
2. If `dg` is not null: the evaluator loads the `organization.delegation_grants` row for that UUID.
    
3. **[Resolved — [ADR-AUTH-006](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-006-delegation_grant.scope-field-schema.md)]** The row's `scope` field is a `JSONB` column with the following required shape, mirroring the three dimensions this section already requires the evaluator to check:
    
    ```json
    {
      "roles": ["<role-uuid>", "..."],
      "office_ids": ["<office-uuid>", "..."],
      "actions": ["<action-string>", "..."]
    }
    ```
    
    All three keys are required arrays (empty array, not null, when a dimension grants nothing extra). `roles` and `office_ids` reference `iam.roles.id` and `organization.offices.id`. `actions` uses the existing action vocabulary from Section 5.4. Note: this schema has no wildcard convention for "all actions a role can perform" — a delegation covering every action for a role must enumerate them. If a future scenario needs an "everything this role can do" delegation, that requires a follow-up decision rather than assuming a wildcard works.
    
4. The user's effective roles and office scope are temporarily expanded to match the delegation's scope for the duration of the request.
    
5. Step 7d of the evaluation cascade checks that the requested action falls within the delegation scope.
    

**One active delegation per user enforced at DB level:** [CONFIRMED — Part 12, Invariant 16]

```sql
-- Partial unique index on organization.delegation_grants
CREATE UNIQUE INDEX idx_one_active_delegation_per_user
  ON organization.delegation_grants(delegated_to_user_id)
  WHERE active = true;
```

This makes it a database-level error to create a second active delegation for any user.

---

## 6. Row-Level Security

### 6.1 Principle

PostgreSQL Row-Level Security (RLS) is a second enforcement layer below the application. It operates independently of application-level ABAC.

**RLS is not a substitute for application-layer ABAC.** The intended defense model is:

```
Request
  → Fastify preHandler: ABAC evaluation → DENY (most unauthorized requests stop here)
  → If ABAC is bypassed (bug, missing middleware, direct tooling):
      → PostgreSQL RLS evaluates the same rules at the data layer → DENY
```

**Sources:** Consolidated Reference Part 11.8 ("PostgreSQL Row-Level Security as a second data-isolation layer"); Stack Context ("Row-Level Security (RLS) — office-level data isolation enforced at the DB engine, not only in application middleware").

### 6.2 Database Roles

[Inference — role structure not confirmed in source documents. Derived from confirmed requirements in Parts 11.8, 11.11, and 12.]

|DB Role|Purpose|Key Permissions|
|---|---|---|
|`batac_app`|Runtime application service account|SELECT, INSERT, UPDATE (guarded by RLS); REVOKE UPDATE and DELETE on `audit` schema|
|`batac_audit`|Audit log writes|INSERT only on `audit.events`; no SELECT, UPDATE, or DELETE|
|`batac_it_admin`|IT Admin operations|DDL via migrations; SELECT on operational metadata; **REVOKE on document content for confidential/restricted**|
|`batac_readonly`|Read-only monitoring|SELECT only; RLS applies|
|`postgres`|Emergency superuser|Physical access only; credentials in sealed envelope per Part 11.20|

### 6.3 Session Context Variables

RLS policies reference PostgreSQL session configuration variables set at the start of each request by the application. [Inference — variable names not confirmed]

```sql
-- Set at request start by the Fastify request lifecycle hook
SET LOCAL app.city_id   = '<batac-city-uuid>';
SET LOCAL app.user_id   = '<user-uuid>';
SET LOCAL app.office_id = '<office-uuid>';
SET LOCAL app.is_ita    = 'false';          -- IT Admin flag
SET LOCAL app.is_pa     = 'false';          -- Platform Admin flag
```

These variables are set within the PostgreSQL transaction scope (`SET LOCAL`), so they are automatically cleared at transaction end. They cannot carry over between requests.

### 6.4 Tables with RLS Enabled

[Inference — the following table list and policy intent are derived from the confirmed schema map in Part 11.9 and the confirmed authorization rules in Part 11.8. Exact policy expressions require team review before implementation.]

#### `documents` Schema

|Table|RLS Policy Intent|
|---|---|
|`documents.documents`|City isolation (`city_id`); office scope (`office_id`); classification gate for Confidential/Restricted|
|`documents.versions`|Inherits parent document access; IT Admin blocked from Confidential/Restricted content|
|`documents.attachments`|Same as versions|
|`documents.numbers`|Readable if parent document is readable to the requesting user|
|`documents.number_series`|Platform Administrator and Records Officer read; write via migration only|

#### `workflow` Schema

|Table|RLS Policy Intent|
|---|---|
|`workflow.instances`|Office-scoped: visible if owned document is in user's office scope|
|`workflow.step_instances`|Visible if: assigned to user's office; or assignee is the user; or user holds SP Secretary role|
|`workflow.definitions`|All authenticated users may read active definitions; Platform Admin writes|
|`workflow.definition_versions`|Same as definitions|

#### `iam` Schema

|Table|RLS Policy Intent|
|---|---|
|`iam.users`|All authenticated users see basic profile (name, office); credentials columns not selectable by `batac_app` role|
|`iam.credentials`|No SELECT by any application role; writes via specific stored procedures only|
|`iam.sessions`|User sees only their own sessions; IT Admin and Security Admin see all|
|`iam.refresh_tokens`|No application-layer read; refresh endpoint uses stored procedure for lookup|
|`iam.role_assignments`|Readable by Platform Admin and IT Admin; others see their own only|

#### `organization` Schema

|Table|RLS Policy Intent|
|---|---|
|`organization.offices`|All authenticated users read; Platform Admin writes|
|`organization.assignments`|Users see their own; Platform Admin sees all|
|`organization.delegation_grants`|User sees grants where they are delegating party or delegated-to party; Platform Admin sees all|

#### `audit` Schema

|Table|RLS Policy Intent|
|---|---|
|`audit.events`|`batac_audit` role: INSERT only; `batac_app` role: **no SELECT** (cannot be read via app runtime); authorized audit reader role: SELECT via dedicated procedure with filtering|

The application runtime role (`batac_app`) cannot read the audit log directly. Audit log access goes through a separate reader role with its own controlled SELECT grant.

### 6.5 Example RLS Policy Patterns [Inference]

These illustrate the intent. Exact expressions require review against the final schema.

**City isolation (applied to every table in every schema):**

```sql
ALTER TABLE documents.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_city_isolation ON documents.documents
  USING (city_id = current_setting('app.city_id', true)::uuid);
```

**Office scope (documents readable by owning office only):**

```sql
CREATE POLICY p_office_scope ON documents.documents
  FOR SELECT
  USING (
    office_id = current_setting('app.office_id', true)::uuid
    OR has_cross_office_read_grant(
      current_setting('app.user_id', true)::uuid,
      office_id
    )
  );
```

**`has_cross_office_read_grant()` definition and backing table [Resolved — [ADR-AUTH-009](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-009-rls-policy-expression-for-cross-office-read-grants.md)]:**

```sql
CREATE TABLE organization.cross_office_grants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES iam.roles(id),
  office_scope    TEXT NOT NULL,   -- 'all' | specific office_id list via join table, see note below
  access_level    TEXT NOT NULL,   -- 'metadata_only' | 'full'
  resource_types  TEXT[] NOT NULL, -- e.g. ARRAY['document'], ARRAY['workflow_step_instance']
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION has_cross_office_read_grant(
  p_user_id UUID,
  p_office_id UUID
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization.cross_office_grants g
    JOIN iam.role_assignments ra ON ra.role_id = g.role_id
    WHERE ra.user_id = p_user_id
      AND ra.revoked_at IS NULL
      AND (g.office_scope = 'all')
      -- specific-office-scope branch intentionally omitted; see note below
  );
$$ LANGUAGE sql STABLE;
```

Seed data: one row per role from Section 5.6's Cross-Office Permissions table (Records Officer, SP Secretary, Platform Administrator, IT Admin), to be added alongside IAM seed data.

**Two known limitations of this implementation, not yet built out:**

- The function only handles `office_scope = 'all'`, which covers all four roles currently in Section 5.6 (none are scoped to a specific subset of offices today). A future role needing access to _some but not all_ offices requires a real "specific office list" branch, not built here since no confirmed role currently needs it.
- `access_level = 'metadata_only'` is stored in the table but not yet enforced by this function — it only answers "can this user read across offices at all," not "metadata or full content." That distinction must be enforced by an additional condition in the calling policy, similar to how `p_it_admin_content_block` (below) separately gates on classification level. Wiring this in is Documents module migration work, not resolved here.

**IT Admin document content block (versions and attachments):**

```sql
CREATE POLICY p_it_admin_content_block ON documents.versions
  FOR SELECT
  USING (
    NOT (
      current_setting('app.is_ita', true)::boolean = true
      AND (
        SELECT d.classification_level
        FROM documents.documents d
        WHERE d.id = document_id
      ) IN ('confidential', 'restricted')
    )
  );
```

**Own-session-only for users:**

```sql
CREATE POLICY p_own_session ON iam.sessions
  FOR SELECT
  USING (
    user_id = current_setting('app.user_id', true)::uuid
    OR current_setting('app.is_ita', true)::boolean = true
  );
```

---

## 7. IT Admin Data Isolation

**Source:** Consolidated Reference Part 12 (Invariant #10: "IT admin has no document content access — PostgreSQL RLS + application ABAC policy").

### 7.1 Requirement

IT Administrators have zero access to document content classified as **Confidential** or **Restricted**, regardless of any other role or permission they hold. This is an architectural invariant — it cannot be overridden by Platform Administrator configuration or any application-level permission grant.

**Rationale:** IT Admins require schema-level access (running migrations, configuring backups, managing infrastructure) but have no operational need to read the content of sensitive documents such as Administrative Cases (Part 4.13: "Access restricted to the Legislative branch only").

### 7.2 Enforcement Layers

Three independent layers each enforce this rule. All three must block independently.

**Layer 1 — ABAC Policy Evaluator (application)**

Step 2 of the evaluation cascade (Section 5.5):

```
subject.is_ita = true
AND resource.classification_level IN ('confidential', 'restricted')
AND action IN read-family actions
→ DENY immediately; evaluation terminates
```

This runs before any database query is sent.

**Layer 2 — PostgreSQL Row-Level Security**

The `p_it_admin_content_block` policy (Section 6.5) on `documents.versions` and `documents.attachments` blocks any SELECT where the session variable `app.is_ita = true` and the parent document's classification is confidential or restricted.

If the application layer sends a query despite the ABAC denial (due to a bug), PostgreSQL returns an empty result set for those rows rather than an error, which is indistinguishable from "no rows found." This prevents content disclosure via error messages.

**Layer 3 — Database Role Permissions [Inference]**

The `batac_it_admin` database role has the following revocations on content columns:

```sql
-- Revoke content column access for IT Admin DB role
REVOKE SELECT ON documents.versions FROM batac_it_admin;
REVOKE SELECT ON documents.attachments FROM batac_it_admin;

-- Grant access to metadata only (non-content columns) via a view
CREATE VIEW documents.versions_metadata AS
  SELECT id, document_id, version_number, created_at, created_by,
         storage_key_hash  -- hash of the key, not the key itself
  FROM documents.versions;

GRANT SELECT ON documents.versions_metadata TO batac_it_admin;
```

[Inference — column-level revocation approach may need to use views or generated columns depending on PostgreSQL version and schema design. Exact implementation requires review.]

### 7.3 What IT Admin Can and Cannot Access

|Resource|IT Admin Access|Enforcement|
|---|---|---|
|Schema migrations|Full (via deployment tooling, not app runtime)|Deployment process|
|Backup and restore|Full|Infrastructure config|
|`iam.users` (profile, office, role assignments)|Full|Application access|
|`iam.sessions` (all active sessions, for security monitoring)|Full|RLS policy|
|`iam.credentials` (password hashes)|**No SELECT** — stored procedure only|DB role permission|
|Audit log (read for tamper detection)|Via audit reader procedure; SELECT only|Separate reader role|
|Non-confidential document metadata (titles, statuses, numbers)|Read|RLS allows|
|Confidential or Restricted document versions and attachments|**DENIED — invariant**|Three-layer enforcement|
|Confidential or Restricted document metadata (title, status)|[Inference: readable — metadata is not the sensitive content]|RLS allows metadata|

---

## 8. Platform Administrator Role Exclusion Invariant

**Source:** Consolidated Reference Part 12 (Invariant #12: "Platform Administrator role cannot be combined with operational roles — Role assignment validation"); Part 11.8 (Tier 2 definition); Part 11.21.

### 8.1 Rule

The Platform Administrator role cannot be combined with any document-processing role on the same user account. These two types of authority must be held by different persons.

### 8.2 Rationale

The Platform Administrator configures the rules that govern document workflows: role definitions, permission assignments, workflow step definitions, SLA thresholds, and numbering series. A user who both defines the rules and operates within them could configure their own permissions, modify workflow definitions to bypass steps on their own documents, or create gaps in the audit trail for their own actions. Separation is required.

### 8.3 Definition of Document-Processing Roles [Resolved for seeding — ADR/D-AUTH-05; see flag below]

The following role categories are incompatible with Platform Administrator:

|Category|Example Roles|
|---|---|
|SP Office operational|SP Secretary, Administrative Officer II, Clerk III, Records Officer|
|Legislative|Councilor, Committee Chair, Committee Member|
|Executive|Mayor, Vice Mayor, Acting Mayor, OIC (any)|
|Document handler|Encoder, Records Aide, Librarian|
|Citizen-facing|Citizen (portal user)|

**Platform Administrator may be combined with:** IT Admin-adjacent technical roles where no document-processing actions are involved. [Inference]

**Seeding decision:** This list is confirmed for use, verbatim, as the mapping to `type_code = 'document_processor'` (Section 8.4) — see Remaining Open Items at the end of this document for one unresolved accuracy flag on "Acting Mayor" and "OIC (any)" that should be checked before the literal `iam.roles` seed insert is written.

### 8.4 Enforcement

**Layer 1 — Application-level validation at assignment time [Inference]:**

```typescript
// In the role assignment service
async function assignRole(actorId: string, targetUserId: string, roleId: string): Promise<void> {
  const [targetExistingRoles, incomingRole] = await Promise.all([
    getUserRoles(targetUserId),
    getRoleById(roleId),
  ]);

  const targetHasPlatformAdmin = targetExistingRoles
    .some(r => r.type === 'platform_admin');
  const targetHasDocumentProcessing = targetExistingRoles
    .some(r => r.type === 'document_processor');

  if (incomingRole.type === 'platform_admin' && targetHasDocumentProcessing) {
    throw new ConflictError(
      'Cannot assign Platform Administrator role to a user who holds document-processing roles.'
    );
  }
  if (incomingRole.type === 'document_processor' && targetHasPlatformAdmin) {
    throw new ConflictError(
      'Cannot assign a document-processing role to a Platform Administrator.'
    );
  }

  // Proceed with assignment
}
```

**Layer 2 — Database trigger [Inference]:**

```sql
CREATE OR REPLACE FUNCTION enforce_platform_admin_exclusion()
RETURNS TRIGGER AS $$
DECLARE
  v_incoming_type TEXT;
  v_conflict_type TEXT;
BEGIN
  -- Get the type of role being assigned
  SELECT type_code INTO v_incoming_type
  FROM iam.roles WHERE id = NEW.role_id;

  -- Determine what would conflict
  IF v_incoming_type = 'platform_admin' THEN
    v_conflict_type := 'document_processor';
  ELSIF v_incoming_type = 'document_processor' THEN
    v_conflict_type := 'platform_admin';
  ELSE
    RETURN NEW; -- No conflict possible
  END IF;

  -- Check if user already holds the conflicting type
  IF EXISTS (
    SELECT 1
    FROM iam.role_assignments ra
    JOIN iam.roles r ON r.id = ra.role_id
    WHERE ra.user_id = NEW.user_id
      AND r.type_code = v_conflict_type
      AND ra.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'Platform Administrator role cannot be combined with document-processing roles (user_id: %)',
      NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_platform_admin_exclusion
  BEFORE INSERT OR UPDATE ON iam.role_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_platform_admin_exclusion();
```

The database trigger is the backstop: even if the application layer validation is bypassed, the trigger prevents the combination from being persisted. The trigger raises an exception that is surfaced as a 500-level error with an audit event.

---

## 9. Future SSO Migration Path

**Source:** Stack Context ("Structure must remain compatible with future SSO or national identity provider integration"). Consolidated Reference Part 11.18 (PhilSys: "Feature-flagged; assume unavailable; enable if integration becomes available").

### 9.1 Design Constraint

The Phase 1 authentication implementation is designed to support a future migration to an external Identity Provider (IdP) — whether a national government SSO, a Philippine government identity service, or PhilSys — without requiring structural changes to the SPA, the session management layer, or the workflow and document modules.

### 9.2 Decisions Made in Phase 1 That Support SSO Migration

|Concern|Phase 1 Implementation|Why It Supports SSO|
|---|---|---|
|SPA auth flow|PKCE with internal server as auth server|SPA uses the same PKCE flow with any OAuth 2.0 / OIDC-compliant IdP; only the authorization endpoint URL changes|
|Token delivery|HTTP-only cookies for all tokens|Unchanged when migrating; server exchanges IdP tokens for internal session tokens and sets the same cookies|
|JWT claims|Custom private claims with `uid` anchoring to internal UUID|`uid` always refers to the internal user record; an `external_idp_sub` field maps to the IdP's `sub` claim|
|Session management|Server-side sessions in `iam.sessions`|Unchanged; session is created after IdP authentication, not inside it|
|User identity|`iam.users.id` as UUID primary key|Internal identity is never the IdP's identifier; IdP subject stored as a secondary field|
|MFA|TOTP hook point in Phase 1; activated in Phase 2|Deferred to the IdP when SSO is available; TOTP disabled for SSO-authenticated users|
|Password auth|Argon2id for Phase 1|Disabled field for SSO-authenticated accounts; `password_hash` column is nullable for SSO users [Inference]|
|Protocol|OAuth 2.0 + PKCE patterns|Standard; compatible with all major OIDC-compliant IdPs|

### 9.3 Required Schema Addition for SSO [Inference]

When an IdP is integrated, one additional column is needed on `iam.users`:

```sql
ALTER TABLE iam.users
  ADD COLUMN external_idp_sub    TEXT,      -- IdP's 'sub' claim value
  ADD COLUMN external_idp_name   TEXT,      -- IdP identifier (e.g., 'philsys', 'govph-sso')
  ADD COLUMN sso_enabled         BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_users_external_idp_sub
  ON iam.users(external_idp_sub, external_idp_name)
  WHERE external_idp_sub IS NOT NULL;
```

The claim mapping layer (token exchange handler in `/apps/server`) maps the IdP's claims to the internal `uid`, `oid`, `rid`, and `perm` claims. No other layer changes.

### 9.4 Token Exchange Flow with External IdP [Inference]

```
SPA initiates PKCE login with external IdP
  → User authenticates at IdP
  → IdP returns authorization code to SPA callback
  → SPA sends code + code_verifier to /api/auth/callback (internal server)
  → Internal server exchanges code with IdP for IdP access token and ID token
  → Internal server looks up or provisions iam.users via external_idp_sub
  → Internal server creates iam.sessions row
  → Internal server issues internal JWT + refresh token (via HTTP-only cookies)
  → SPA receives session cookies — rest of the flow unchanged
```

The SPA never sees the IdP's access token. It only receives the internal HTTP-only cookies. The workflow, ABAC, RLS, and audit layers are entirely unaware of the IdP — they operate on the internal `user_id` and session, as always.

### 9.5 PhilSys Integration Path [Feature-Flagged]

**Source:** Consolidated Reference Part 11.18 ("PhilSys: Feature-flagged; assume unavailable; enable if integration becomes available").

- Feature flag: `PHILSYS_ENABLED=false` — present in the codebase from Phase 1 but never activated until the integration is available.
- PhilSys applies to citizen portal users (Phase 3), not internal LGU staff in Phase 1 or Phase 2.
- When available: PhilSys acts as the IdP for citizen identity verification. The same token exchange flow applies (Section 9.4).
- Internal LGU user authentication is not blocked by PhilSys availability.

### 9.6 National Government SSO Readiness

No specific national government IdP has been identified. The architecture stays ready by:

- Using only standard OAuth 2.0 / PKCE / OIDC patterns
- Keeping no proprietary auth SDK dependencies in `/apps/web` or `/apps/server`
- Anchoring all internal identity to the `iam.users.id` UUID (IdP subject stored as secondary field)
- Centralizing claim mapping in one location: the token exchange handler in `/apps/server/src/modules/iam/auth/`

---

## 10. Implementation Notes

### 10.1 Fastify Plugin Structure [Inference]

Authentication and authorization middleware runs as Fastify lifecycle hooks registered before all protected route handlers.

```
Authenticated request lifecycle:

preHandler hook 1: verifyAccessToken
  - Extract JWT from batac_at cookie
  - Verify signature and expiry
  - Load session_id from JWT; check iam.sessions WHERE id = sid AND active = true
  - Reject if session inactive, locked, or expired
  - Populate: userId, sessionId, officeId, roles, permissions, delegationGrantId, cityId, isItAdmin, isPlatformAdmin

preHandler hook 2: loadDelegationContext
  - If delegationGrantId is not null: load delegation_grants row
  - Expand effective roles and office scope for this request

preHandler hook 3: setDatabaseSessionVars
  - SET LOCAL app.city_id = ?
  - SET LOCAL app.user_id = ?
  - SET LOCAL app.office_id = ?
  - SET LOCAL app.is_ita = ?
  - SET LOCAL app.is_pa = ?
  - (All vars are SET LOCAL — cleared automatically at transaction end)

preHandler hook 4: updateLastActivity
  - UPDATE iam.sessions SET last_activity_at = NOW() WHERE id = ?
  - (Cheap write; acceptable on every request)

Route handler receives request with fully populated auth context.
```

Public routes (login, token refresh, QR scan public lookup, public portal document listing) are registered in a separate Fastify plugin scope that does **not** apply hooks 1 through 4. They carry their own rate limiting and minimal validation.

### 10.2 tRPC Context [Inference]

tRPC procedures for the internal SPA use a context object populated from the verified request:

```typescript
export type AuthContext = {
  userId:             string;
  sessionId:          string;
  officeId:           string;
  cityId:             string;
  roles:              string[];
  permissions:        string[];
  delegationGrantId:  string | null;
  effectiveOfficeIds: string[];   // includes delegation-extended offices
  effectiveRoles:     string[];   // includes delegation-extended roles
  isItAdmin:          boolean;
  isPlatformAdmin:    boolean;
};

export type Context = {
  auth: AuthContext | null;  // null on unauthenticated routes
  db:   DbClient;
  req:  FastifyRequest;
};
```

The ABAC policy evaluator accepts a `Context` and a resource descriptor and returns `{ allowed: boolean; reason?: string }`. All tRPC procedures that touch protected resources call the evaluator before performing any database operation.

### 10.3 Audit Events for Authentication and Authorization Actions

**Source:** Consolidated Reference Part 11.11 ("Events always audited — cannot be disabled").

All of the following must produce an audit record via the audit service. The audit service is the only path to the `audit.events` table.

|Event|Required Audit Payload|
|---|---|
|`login_success`|`user_id`, `session_id`, `ip_address`, `user_agent`|
|`login_failed`|`attempted_identifier_hash` (SHA-256 of attempted username; never plaintext), `ip_address`, `user_agent`, `failure_reason`|
|`logout`|`user_id`, `session_id`, `method: 'user_initiated'`|
|`session_expired_inactivity`|`user_id`, `session_id`|
|`session_replaced`|`user_id`, `old_session_id`, `new_session_id`, `new_ip_address`|
|`forced_logout`|`actor_id`, `target_user_id`, `target_session_id`, `reason` (mandatory)|
|`token_refresh`|`user_id`, `session_id`|
|`token_reuse_detected`|`user_id`, `family_id`, `ip_address`, `action_taken: 'family_revoked'`|
|`role_assigned`|`actor_id`, `target_user_id`, `role_id`, `role_name`|
|`role_revoked`|`actor_id`, `target_user_id`, `role_id`, `role_name`, `reason`|
|`delegation_grant_created`|`actor_id`, `delegated_to_user_id`, `scope_summary`, `start_at`, `end_at`|
|`delegation_grant_revoked`|`actor_id`, `delegation_grant_id`, `reason`|
|`password_changed`|`user_id`, `actor_id` (same if self-service; different if admin reset)|
|`abac_denial`|`user_id`, `resource_type`, `resource_id`, `action`, `denial_step`, `denial_reason`|
|`session_locked`|`user_id`, `session_id` (Switch User / Lock Screen action)|
|`session_unlocked`|`user_id`, `session_id`|

ABAC denials (`abac_denial`) are always audited, including for routine denials (e.g., a councilor trying to access the Mayor's pending actions queue). The volume of denial events may be high; log aggregation must handle this without dropping records.

### 10.4 Rate Limiting

**Source:** Stack Context (`@fastify/rate-limit` on "Auth and portal endpoints").

|Endpoint|Limit|Window|Strategy|
|---|---|---|---|
|`POST /api/auth/login`|5 attempts|15 minutes per IP|IP-based; block after limit|
|`POST /api/auth/refresh`|20 requests|1 minute per user session|Session-based; sliding window|
|`POST /api/auth/logout`|10 requests|1 minute per IP|IP-based|
|`POST /api/auth/password-reset-request`|3 requests|1 hour per IP|IP-based|
|All other auth endpoints|30 requests|1 minute per IP|IP-based|

[Inference — specific limits not confirmed. The above are a proposed starting point; they must be tuned based on observed traffic patterns before production.]

**After exceeding login limit [Inference]:** Account is rate-limited for 15 minutes from that IP. The account is not globally locked (to prevent denial-of-service attacks from locking out legitimate users). A notification is sent to the account owner. The lockout event is audit-logged. IT Admin can clear the rate limit record manually.

### 10.4.1 Account-Level Lockout Policy [Resolved — [ADR-AUTH-007](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-007-account-lockout-policy-on-repeated-login-failures.md); one value still open]

This supplements the per-IP throttling above with per-account tracking, to address distributed attacks (many IPs, each making a few attempts against the same account) that IP-based throttling alone does not stop.

**Decision: progressive per-account delay, not a hard lockout.** A hard lockout after N failures is itself a denial-of-service vector — it lets an attacker lock a legitimate (and possibly privileged) account out of use without ever needing to guess the password.

|Failures (this account, any IP)|Response|
|---|---|
|1–5|Normal response time|
|6|30-second delay before response|
|7|60-second delay|
|8|2-minute delay|
|9|5-minute delay|
|10+|15-minute delay (repeats; does not escalate further)|

The account is never fully locked — authentication remains eventually possible for a legitimate user, just with increasing delay. This runs alongside, not instead of, the per-IP limits above. Every failure increments an audit-logged counter; an administrator alert fires once a threshold is crossed.

**[Unresolved] Alert threshold value:** not set by this resolution. It depends on expected legitimate failure-rate volume, which has no production data yet to calibrate against. See Remaining Open Items.

**Explicitly deferred to Phase 2, not part of this decision:** MFA-triggered escalation (e.g., requiring TOTP after N failures for privileged roles) is a reasonable enhancement, but depends on the MFA hook point in Section 10.5, which is not active in Phase 1 — `MFA_REQUIRED_ROLES` and `user.totp_enabled` do not exist until Phase 2 activation. This is noted as a recommended Phase 2 follow-on once Section 10.5 activates, not a Phase 1 commitment.

### 10.5 MFA Readiness: Phase 1 Design, Phase 2 Activation

**Source:** Consolidated Reference Part 11.1 ("MFA architecture: Designed from day one; TOTP not enabled in Phase 1 but auth flow accommodates it. TOTP required in Phase 2 for Mayor, SP Secretary, Department Heads, Platform Administrator, IT Admin").

The login handler includes an MFA hook point that does nothing in Phase 1 but can be activated by configuration in Phase 2 with no code changes to surrounding logic:

```
POST /api/auth/login

  1. Validate credentials (password check)
  2. Load user record and roles
  3. MFA hook:
       if MFA_REQUIRED_ROLES contains any of user's roles
       AND user.totp_enabled = true:         ← Phase 2: this becomes true for required roles
         → Issue short-lived MFA challenge token (opaque; 5-minute expiry)
         → Return 202 Accepted with { mfa_required: true }
         → Client presents TOTP code to POST /api/auth/mfa/verify
         → On success: proceed to step 4
       else:                                 ← Phase 1: all users fall through here
         → Proceed to step 4
  4. Create session; issue access + refresh tokens
```

**Phase 2 activation:** Set environment variable `MFA_REQUIRED_ROLES=mayor,sp-secretary,department-head,platform-admin,it-admin`. Set `user.totp_enabled = true` for users in those roles after TOTP enrollment. No code changes needed.

---

## 11. Deferred Decisions (Must Resolve Before IAM Module Migration)

**Status as of this revision: 8 of 10 items resolved outright; 1 (D-AUTH-08) remains fully open; 3 otherwise-resolved items (D-AUTH-02, D-AUTH-05, D-AUTH-07) carry a narrower follow-up that doesn't block migration.** Resolutions are recorded in the relevant body sections above (cross-referenced below) and in the corresponding ADRs. The fully-open item and the three follow-ups are moved to Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md) (Remaining Open Items) rather than left in this table, since this table's original purpose — tracking what's still unresolved — is better served by not mixing closed and open items together.

|#|Item|Resolution|Recorded In|
|---|---|---|---|
|D-AUTH-01|JWT signing algorithm: HS256 vs. RS256|**Resolved: RS256.** SSO confirmed as a near-term priority.|Section 1.1; [ADR-AUTH-001](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-001-jwt-signing-algorithm.md)|
|D-AUTH-02|Argon2id parameters (m, t, p) for password hashing|**Resolved: `m=65536 (64 MB), t=2, p=1`**, exposed via environment variables (`ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`) rather than hardcoded, adopted as OWASP's published baseline. **Hardware benchmarking against target server hardware remains required before production** — this is not optional and is carried forward; see Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md).|[ADR-AUTH-002](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-002-argon2id-parameters.md) (no other body location exists for this parameter; password hashing is otherwise only referenced at Section 9.2)|
|D-AUTH-03|Refresh token lifetime|**Resolved: 14 days.**|Section 1.2; [ADR-AUTH-003](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-003-refresh-token-lifetime.md)|
|D-AUTH-04|Refresh token hash algorithm: Argon2id vs. SHA-256|**Resolved: SHA-256 with per-token salt** (not Argon2id) — token entropy makes a slow hash unnecessary; Argon2id is retained for password hashing (D-AUTH-02), which is unaffected.|Section 1.2; [ADR-AUTH-004](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-004-refresh-token-hash-algorithm.md)|
|D-AUTH-05|Full list of document-processing roles for Platform Admin exclusion trigger|**Resolved for seeding: Section 8.3's list, used verbatim.** One accuracy flag on "Acting Mayor" / "OIC (any)" not fully closed — carried forward; see Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md).|Section 8.3|
|D-AUTH-06|`delegation_grant.scope` field schema|**Resolved:** `JSONB` with required `{ roles: [], office_ids: [], actions: [] }` shape.|Section 5.7; [ADR-AUTH-006](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-006-delegation_grant.scope-field-schema.md)|
|D-AUTH-07|Account lockout policy on repeated login failures|**Resolved: progressive per-account delay, no hard lockout** (Section 10.4.1), alongside the existing per-IP limits. Alert threshold value not set — carried forward; see Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md). MFA-tier escalation explicitly deferred to Phase 2.|Section 10.4.1; [ADR-AUTH-007](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-007-account-lockout-policy-on-repeated-login-failures.md)|
|D-AUTH-08|External TSA provider for audit log timestamps|**Not resolved.** Vendor/procurement selection, out of architectural scope — see Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md).|Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md)|
|D-AUTH-09|RLS policy expression for cross-office read grants|**Resolved:** `organization.cross_office_grants` table and `has_cross_office_read_grant()` function defined. Two specific limitations (non-"all" office scoping; `access_level` not yet enforced) remain implementation work, not blocking.|Section 6.5; [ADR-AUTH-009](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-009-rls-policy-expression-for-cross-office-read-grants.md)|
|D-AUTH-10|Session `locked_at` behavior when access token expires while locked|**Resolved: silent refresh on unlock** using the existing rotating refresh token, gated on existing validity checks only. Step-up authentication for high-risk actions and a separate "max session age" concept were both explicitly considered and **not adopted** in Phase 1.|Section 4.6; [ADR-AUTH-010](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-010-session-locked_at-behavior-when-access-token-expires-while-locked.md)|

---

## 12. Remaining Open Items

One item is entirely unresolved, and three otherwise-resolved items each carry a narrower follow-up. None of these four rows block the IAM module's first migration on their own — each is scoped narrowly below, with the reason it doesn't block stated explicitly so this isn't mistaken for a blanket deferral.

| Item                | What's Open                                                                                                                                                                                                                                                                                                                                                                            | Why It Doesn't Block the IAM Migration                                                                                                                                                                                                                | Required Before                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D-AUTH-02 follow-up | Argon2id parameters (`m=65536, t=2, p=1`) are set as a default, but have **not been benchmarked on actual target server hardware**.                                                                                                                                                                                                                                                    | The parameters are env-configurable (`ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`), so the migration can proceed with the default and the values adjusted later without a schema change.                                            | Production deployment                                                                                                                    |
| D-AUTH-05 follow-up | "Acting Mayor" and "OIC (any)" in Section 8.3's role list read as role _categories_, not confirmed literal `iam.roles.name` rows — "OIC (any)" in particular may need to be several office-specific seeded roles rather than one literal row, or a different enforcement mechanism entirely. This was not resolved, only flagged; the list was used verbatim per explicit instruction. | The trigger logic (Section 8.4) operates on `type_code`, not on the specific role name — so the migration and trigger can be written now. This only affects the literal seed `INSERT` statements for `iam.roles`, not the schema or trigger function. | IAM seed data (i.e., before the seed `INSERT`s are written, not before the migration creating the tables/trigger)                        |
| D-AUTH-07 follow-up | The administrator alert threshold for repeated account-level login failures (Section 10.4.1) has no value. No production traffic data exists yet to calibrate a number that distinguishes normal mistyped-password volume from an actual attack pattern, and no value should be guessed without that data.                                                                             | The counter, audit logging, and progressive-delay mechanism don't require the threshold to be set to be built — the threshold is a comparison value that can be added or changed via configuration after launch, using observed data.                 | Should be set using real post-launch data, or provisionally set conservatively high and tuned down — either way, not a schema dependency |
| D-AUTH-08           | External RFC 3161 Time-Stamping Authority (TSA) provider for the monthly audit log export — entirely unresolved. This is a vendor/procurement decision requiring current research into provider offerings, pricing, and any government-procurement constraints; it is not an architectural design choice and was not researched as part of this resolution.                            | The audit export mechanism and schedule are already defined independently of which TSA is used; the provider is a configuration/integration detail at export time, not a schema or application-logic dependency.                                      | Pre-production (per original deadline, unchanged)                                                                                        |

---

_This document is the pre-development baseline for the authentication and authorization architecture. As of this revision, 8 of the 10 items originally listed in Section 11 are resolved and reflected in the relevant body sections above; the remaining 2 fully open items (D-AUTH-08) plus 3 narrower follow-ups on otherwise-resolved items (D-AUTH-02, D-AUTH-05, D-AUTH-07) are tracked in Section 12; [ADR-AUTH-008](b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md) above, each with an explicit account of why it does not block the IAM module's first migration. Remaining `[Inference]` items elsewhere in this document still require development team confirmation. This document supersedes any earlier auth/auth notes and is the reference for the IAM module schema design._
