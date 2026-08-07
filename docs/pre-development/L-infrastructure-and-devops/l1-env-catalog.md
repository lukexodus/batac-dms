# Environment Variable Catalog

## Table of Contents

- [L42–L51] Batac City LGU Platform — Document metadata including version, status, target audience, and classification.
- [L52–L87] 1. Introduction — Purpose of the catalog, environmental scope, deployment philosophy, and core configuration principles.
- [L88–L131] 2. Naming Convention — Structured prefix hierarchy, syntax guidelines, and naming rules for all environment variables.
- [L132–L148] 3. Variable Classification Matrix — Legend defining classifications like required, optional, secret, public, and phase-specific variables.
- [L149–L172] 4. Core Application Variables — Identity, runtime mode, port, host, logging level, and tenant details for the Fastify server.
- [L173–L225] 5. Database Configuration — Database connection strings for partitioned roles, connection pool limits, and Drizzle ORM logs.
- [L226–L283] 6. Authentication & Security — JWT tokens, cookie attributes, session inactivity timeouts, Argon2id hashing parameters, and MFA configuration.
- [L284–L302] 7. Audit Log Security — Cryptographic HMAC signing secret, genesis hash, retention settings, and RFC 3161 TSA export options.
- [L303–L327] 8. File Storage Configuration — S3-compatible credentials, endpoints, path styles, upload limits, and separate write-once backup bucket details.
- [L328–L348] 9. Email Configuration — SMTP connection credentials, TLS/STARTTLS security settings, from address, and connection pool sizing.
- [L349–L370] 10. OCR Configuration — OCR engine backend, language packs, worker threads, confidence quality thresholds, and migration batch sizes.
- [L371–L396] 11. Search Configuration — PostgreSQL full-text search settings and Meilisearch configuration for typo-tolerant query features.
- [L397–L411] 12. Notifications (SSE) — Server-Sent Events heartbeat intervals, connection limits, and in-app notification retention and cleanup thresholds.
- [L412–L440] 13. Error Monitoring & Observability — Sentry integration options, structured log redaction rules, and server health check endpoint path.
- [L441–L459] 14. Public Portal Configuration — URLs, citizen OTP parameters, and annual account re-verification schedules for the Phase 3 portal.
- [L460–L502] 15. Background Jobs — Pgboss queue concurrency, retry settings, and cron expressions for compliance, cleanup, and backup tasks.
- [L503–L519] 16. Rate Limiting — Fastify rate limiting thresholds and window durations for authentication, API, portal, and uploads.
- [L520–L535] 17. QR Codes & Document Numbering — QR code generation options, Sangguniang Panlungsod legislative ordinals, and document tracking number prefixes.
- [L536–L548] 18. Internationalisation & Regional Settings — Node.js system timezone, language locales supported, and translation fallback settings.
- [L549–L567] 19. Feature Flags — Flags enabling or disabling system capabilities like MFA, OCR, search backends, SMS, and portal.
- [L568–L608] 20. Infrastructure & Deployment — Docker image tags, database backup encryption keys, retention settings, and disaster recovery hot-standby options.
- [L609–L973] 21. Zod Validation Schema Strategy — Startup validation logic, schema files architecture, and client/server environment variable parsing.
  - [L613–L620] 21.1 Architecture — Three-file layout separating server, client-side Vite, and Next.js portal validation rules.
  - [L621–L906] 21.2 Server Environment Schema (`env.server.ts`) — Zod schemas and cross-field validation rules for all backend-only environment configuration variables.
  - [L907–L925] 21.3 Startup Validation Entry Point — Application entry point script performing parse and process exit on invalid startup configurations.
  - [L926–L950] 21.4 Vite Client Schema (`env.client.ts`) — Zod validation schema for frontend client-side environment variables exposed to Vite builds.
  - [L951–L973] 21.5 Next.js Portal Schema (`env.portal.ts`) — Validation rules partitioning server-side portal parameters and public NEXT_PUBLIC_ client-side variables.
- [L974–L1212] 22. Sample Environment Files — Template env configurations for local development, staging integration, and production reference.
  - [L978–L1074] 22.1 `.env.example` (Root — Committed to Git) — Comprehensive template showing default development settings and placeholder values for all parameters.
  - [L1075–L1098] 22.2 `.env.development` (Local Override) — Local configuration overrides disabling production features like Sentry, SSL, and DB backup.
  - [L1099–L1132] 22.3 `.env.staging` (Staging Environment) — Production-like environment template using staging URLs, enabling logs, and omitting actual secrets.
  - [L1133–L1212] 22.4 `.env.production` (Production Reference) — Authoritative production template detailing non-secret settings, pool limits, and required cloud endpoints.
- [L1213–L1288] 23. Secret Management Strategy — Docker secrets integration scripts, encryption rotation policies, and sealed break-glass recovery procedures.
- [L1289–L1488] 24. Master Variable Catalog — Consolidated reference table listing every environment variable, its category, defaults, and phase.

---

## Batac City LGU Platform

**Document Version:** 1.0.0
**Status:** Pre-Development Baseline
**Audience:** Development Team, DevOps, LGU IT Office
**Last Updated:** June 2026
**Classification:** Internal — Development Reference

---

## 1. Introduction

### 1.1 Purpose

This document is the **single source of truth** for all environment-variable-driven configuration in the Batac City LGU Platform. It defines every variable the platform requires or may require, specifies its classification, documents its purpose, and provides concrete examples and validation rules.

The platform must be deployable across four distinct environments — development, staging, production, and an on-premise installation at Batac City Hall — without code changes. All behavioural differences between environments are controlled exclusively through environment variables. No configuration values are hardcoded in application source code.

### 1.2 Environment Philosophy

#### Development
Local developer workstations. Secrets may use weak placeholder values. SSL is optional. Verbose logging is enabled. Debug features may be active. Hot-reload and source maps are in use. Seed data is present.

#### Staging
A production-like environment used for integration testing, QA, and stakeholder reviews before production deployments. Secrets must be rotated separately from production. Logging and monitoring match production behaviour. Actual SMTP and storage may be sandboxed.

#### Production
The live Batac City deployment on Cloudflare R2 and a VPS host. All secrets must be rotated, strong, and managed through a secrets vault. Verbose logging must be disabled. Error tracking is active. Backup jobs are enabled.

#### On-Premise
A future deployment entirely within Batac City Hall's network infrastructure. Cloudflare R2 is replaced by MinIO. External SaaS dependencies are either self-hosted or removed. This is a near-certainty within the 10-year operational horizon of the platform, and every architectural decision is made to support it from day one. Migration from cloud to on-premise must require only environment variable changes — no code changes.

### 1.3 Configuration Principles

**Fail Fast.** The application validates all required environment variables at startup using Zod. If a required variable is missing or malformed, the process exits immediately with a clear, actionable error message. The platform never starts in an undefined configuration state.

**Twelve-Factor App.** Configuration is stored exclusively in the environment, not in code or files committed to version control. `.env` files are git-ignored and serve only as templates. All runtime configuration is injected at process start.

**Secrets Management.** Any variable marked Secret in this document must never appear in logs, error messages, API responses, stack traces, or source code. Secret rotation must not require a code deployment — only an environment variable update and a process restart.

**Least Privilege.** Each application sub-process uses only the credentials it needs. The audit log database user has `INSERT` only — `UPDATE` and `DELETE` are revoked at the PostgreSQL grant level. The application runtime user has no access to the schema migrations. Backup credentials are separate from production application credentials.

**Explicit over Implicit.** No variable has a hidden default that silently changes behaviour in a security-relevant way. Variables with defaults document those defaults explicitly here and in the Zod schema.

---

## 2. Naming Convention

All environment variables follow a structured prefix hierarchy that reflects the subsystem the variable belongs to. This enables grepping, tooling, and documentation generation.

### 2.1 Prefix Table

| Prefix | Subsystem | Examples |
|--------|-----------|---------|
| `APP_` | Core application identity and behaviour | `APP_ENV`, `APP_URL`, `APP_PORT` |
| `NODE_` | Node.js runtime | `NODE_ENV` |
| `DB_` | Database connection and pool | `DB_HOST`, `DB_PASSWORD`, `DB_POOL_MAX` |
| `DATABASE_URL_` | Drizzle/pg connection strings per role | `DATABASE_URL_APP`, `DATABASE_URL_AUDIT` |
| `AUTH_` | Authentication tokens, cookies, sessions | `AUTH_JWT_ACCESS_SECRET`, `AUTH_COOKIE_DOMAIN` |
| `ARGON2_` | Password hashing tuning | `ARGON2_MEMORY_COST` |
| `AUDIT_` | Audit log integrity and export | `AUDIT_HMAC_SECRET`, `AUDIT_EXPORT_SCHEDULE` |
| `S3_` | S3-compatible file storage | `S3_ENDPOINT`, `S3_BUCKET` |
| `SMTP_` | Email delivery | `SMTP_HOST`, `SMTP_FROM` |
| `OCR_` | Optical character recognition service | `OCR_ENGINE`, `OCR_WORKER_COUNT` |
| `SEARCH_` | Document full-text search | `SEARCH_PROVIDER`, `SEARCH_MEILISEARCH_URL` |
| `SSE_` | Server-Sent Events notifications | `SSE_HEARTBEAT_INTERVAL_MS` |
| `NOTIF_` | In-app notification settings | `NOTIF_RETENTION_DAYS` |
| `SENTRY_` | Error tracking and performance monitoring | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` |
| `LOG_` | Structured logging behaviour | `LOG_LEVEL`, `LOG_PRETTY` |
| `PORTAL_` | Public citizen portal (Phase 3) | `PORTAL_URL`, `PORTAL_CDN_URL` |
| `JOB_` | Background job workers (pgboss, node-cron) | `JOB_WORKER_CONCURRENCY`, `JOB_RETRY_LIMIT` |
| `CRON_` | Scheduled task timing expressions | `CRON_SLA_CHECK`, `CRON_MAYOR_LAPSE_CHECK` |
| `RATE_` | Rate limiter thresholds per endpoint group | `RATE_AUTH_MAX`, `RATE_API_WINDOW_MS` |
| `QR_` | QR code generation parameters | `QR_BASE_URL`, `QR_ERROR_CORRECTION_LEVEL` |
| `DOC_` | Document numbering and series | `DOC_SP_ORDINAL`, `DOC_NUMBER_CITY_ID` |
| `I18N_` | Internationalisation and locale | `I18N_DEFAULT_LOCALE`, `I18N_SUPPORTED_LOCALES` |
| `FEATURE_` | Runtime feature flags | `FEATURE_MFA_ENABLED`, `FEATURE_MEILISEARCH_ENABLED` |
| `TZ` | System timezone | `TZ=Asia/Manila` |
| `BACKUP_` | Database and file backup | `BACKUP_SCHEDULE`, `BACKUP_S3_BUCKET` |

### 2.2 Naming Rules

- All variable names are `SCREAMING_SNAKE_CASE`.
- Names are descriptive and self-documenting. Abbreviations are used only where the meaning is unambiguous (e.g., `URL`, `JWT`, `SSE`, `SMTP`).
- Boolean variables use values `"true"` and `"false"` (strings). The Zod schema transforms them to native booleans.
- Duration variables are expressed in milliseconds and suffixed `_MS`, or in seconds and suffixed `_S`, or use ISO 8601 / cron notation where noted.
- Variables scoped to a specific application package prefix with the package role when necessary (e.g., `NEXT_PUBLIC_` for Next.js client-side variables in `/apps/portal`).

---

## 3. Variable Classification Matrix

Each environment variable in this catalog is assigned one or more of the following classifications.

| Classification | Symbol | Meaning |
|---|---|---|
| **Required** | `REQ` | Must be present at startup. Application will not start without it. Validated by Zod at boot. |
| **Optional** | `OPT` | Has a documented default value. Can be omitted. Zod provides the default. |
| **Secret** | `SEC` | Contains credentials, keys, or tokens. Must never be logged or exposed. Must be managed through a secrets vault in staging and production. |
| **Public** | `PUB` | Safe to expose in client-side bundles. Used in Next.js `NEXT_PUBLIC_` prefix. Contains no credentials. |
| **Dev Only** | `DEV` | Meaningful only in development environments. Ignored or unavailable in production builds. |
| **Production Only** | `PROD` | Must be set in production. May be omitted in development where a safe placeholder suffices. |
| **Phase 2+** | `PH2` | Not required for Phase 1. Schema is defined now to avoid future breaking changes. Variables are validated as optional in Phase 1. |
| **Phase 3+** | `PH3` | Required only when the public citizen portal is activated. |

---

## 4. Core Application Variables

These variables govern the identity, runtime mode, and top-level behaviour of the Fastify server process in `/apps/server`.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `NODE_ENV` | REQ | Yes | No | — | `production` | Node.js environment identifier. Controls framework-level behaviour (stack traces, dev middleware). Accepted values: `development`, `test`, `staging`, `production`. |
| `APP_ENV` | REQ | Yes | No | — | `production` | Platform-level environment. More granular than `NODE_ENV`. Accepted values: `development`, `staging`, `production`, `on-premise`. Controls feature gating, logging verbosity, and observability sink routing. |
| `APP_NAME` | OPT | No | No | `Batac City LGU Platform` | `Batac City LGU Platform` | Human-readable application name. Used in email templates, log metadata, and error messages. |
| `APP_VERSION` | OPT | No | No | `0.0.0` | `1.0.0` | Semantic version of the deployed build. Injected at build time by the CI pipeline. Emitted in health-check responses and Sentry releases. |
| `APP_URL` | REQ | Yes | No | — | `https://dms.batac.gov.ph` | Canonical base URL of the internal web application (`/apps/web`). Used for generating absolute URLs in emails, QR codes, and audit log references. Must not have a trailing slash. |
| `API_URL` | REQ | Yes | No | — | `https://api.batac.gov.ph` | Base URL of the Fastify server (`/apps/server`). Used by the frontend to construct REST and tRPC endpoints. Must not have a trailing slash. |
| `APP_PORT` | OPT | No | No | `3000` | `3000` | TCP port the Fastify server binds to. Overridden by the reverse proxy (Nginx/Caddy) in production. |
| `APP_HOST` | OPT | No | No | `0.0.0.0` | `0.0.0.0` | Network interface the Fastify server listens on. `0.0.0.0` binds all interfaces (required in Docker). Use `127.0.0.1` for local-only in development if desired. |
| `LOG_LEVEL` | OPT | No | No | `info` | `info` | Pino log level. Accepted values: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`. Development typically uses `debug`. Production must use `info` or higher. |
| `LOG_PRETTY` | DEV | No | No | `false` | `true` | Enables pino-pretty human-readable log formatting. **Must be `false` in production** — JSON output is required for log aggregators. Set `true` in development only. |
| `CORS_ALLOWED_ORIGINS` | REQ | Yes | No | — | `https://dms.batac.gov.ph,https://portal.batac.gov.ph` | Comma-separated list of origins permitted by `@fastify/cors`. Must be an explicit allowlist in staging and production. `*` is prohibited. Fastify plugin reads this as an array. |
| `CITY_ID` | REQ | Yes | No | — | `01930a7d-5c92-7e0f-bf5f-000000000001` | UUID v4 identifying the Batac City tenant record. Injected as the `city_id` column on all core entity rows. Multi-LGU adaptation changes only this variable and re-seeds the tenant row. |
| `TRUST_PROXY` | OPT | No | No | `false` | `true` | Passed to Fastify's `trustProxy` option. Set `true` when the server is behind Nginx, Caddy, or Cloudflare. Required for correct `X-Forwarded-For` IP resolution in rate limiting and audit logs. |
| `BCRYPT_ROUNDS` | — | — | — | — | — | **Not used.** This platform uses Argon2id. See Section 6. |
| `APP_INSTANCE_ID` | OPT | No | No | (auto-generated UUID) | `server-01` | A stable identifier for this specific process instance. Used in distributed log correlation and pgboss worker registration. In Docker Compose, set to the container name. |

---

## 5. Database Configuration

The platform requires PostgreSQL. Three separate database roles are used with distinct privilege sets, following the principle of least privilege. The application never uses a superuser or the migration role at runtime.

### 5.1 Connection Variables

The platform supports both a single `DATABASE_URL_*` connection string and individual component variables for environments where a secrets manager injects individual values.

**If `DATABASE_URL_APP` is present, it takes precedence over individual `DB_*` variables for the app role.** Drizzle ORM accepts either format.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `DATABASE_URL_APP` | REQ, SEC | Yes | Yes | — | `postgresql://app_user:secret@localhost:5432/batac_lgu?sslmode=require` | Full connection string for the application runtime role. This role has `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all schemas **except** `audit`. Used by the Fastify server for all normal operations. |
| `DATABASE_URL_AUDIT` | REQ, SEC | Yes | Yes | — | `postgresql://audit_user:secret@localhost:5432/batac_lgu?sslmode=require` | Full connection string for the audit-log role. This role has **`INSERT` only** on the `audit` schema. `UPDATE` and `DELETE` are revoked at the PostgreSQL grant level, not merely in application code. Used exclusively by the audit service module. |
| `DATABASE_URL_MIGRATE` | REQ, SEC | Yes (migrations only) | Yes | — | `postgresql://migrate_user:secret@localhost:5432/batac_lgu?sslmode=require` | Full connection string used by Drizzle Kit (`drizzle-kit migrate`) and migration scripts in `/tools/scripts`. This role has `DDL` privileges. It is **never used at application runtime**. Stored separately from `DATABASE_URL_APP`. |
| `DB_HOST` | OPT | No | No | `localhost` | `127.0.0.1` | Fallback database hostname. Used when `DATABASE_URL_APP` is not provided. |
| `DB_PORT` | OPT | No | No | `5432` | `5432` | PostgreSQL port. |
| `DB_NAME` | OPT | No | No | `batac_lgu` | `batac_lgu_prod` | Database name. |
| `DB_APP_USER` | OPT | No | No | `app_user` | `batac_app` | Application runtime username (fallback). |
| `DB_APP_PASSWORD` | OPT | No | Yes | — | `s3cret` | Application runtime password (fallback). |
| `DB_SSL` | OPT | No | No | `true` | `true` | Enables SSL/TLS for database connections. Must be `true` in production. |
| `DB_SSL_REJECT_UNAUTHORIZED` | OPT | No | No | `true` | `true` | Rejects connections to DB hosts with invalid certificates. Set `false` only in development with a self-signed cert. **Never `false` in production.** |

### 5.2 Connection Pool Variables

Drizzle ORM uses `pg` (node-postgres) under the hood. Pool sizing affects both performance and database connection limits.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `DB_POOL_MIN` | OPT | No | No | `2` | `2` | Minimum number of connections held in the pool at all times. |
| `DB_POOL_MAX` | OPT | No | No | `10` | `20` | Maximum concurrent database connections from the app pool. Size this against your PostgreSQL `max_connections` setting. Production should be sized per expected concurrent load. |
| `DB_POOL_IDLE_TIMEOUT_MS` | OPT | No | No | `30000` | `30000` | Time (ms) a connection can remain idle before being released from the pool. |
| `DB_POOL_ACQUIRE_TIMEOUT_MS` | OPT | No | No | `10000` | `10000` | Maximum time (ms) to wait for a connection from the pool before throwing an error. |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | OPT | No | No | `5000` | `5000` | Maximum time (ms) to wait for the initial TCP connection to PostgreSQL to be established. |
| `DB_STATEMENT_TIMEOUT_MS` | OPT | No | No | `30000` | `30000` | PostgreSQL `statement_timeout` injected per connection. Prevents runaway queries from blocking the pool. |

### 5.3 Read Replica (Phase 2+)

The platform is designed to support a read replica for reporting queries, Meilisearch sync, and audit log exports without impacting the primary write path.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `DATABASE_URL_READ_REPLICA` | PH2, SEC | No | Yes | — | `postgresql://readonly:secret@replica.host:5432/batac_lgu` | Connection string for a PostgreSQL streaming replica. Used by the reporting module and Meilisearch sync jobs. If absent, the primary connection is used. |

### 5.4 Drizzle-Specific Variables

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `DRIZZLE_VERBOSE` | DEV | No | No | `false` | `true` | Enables Drizzle ORM query logging. Outputs all generated SQL to stdout. **Must be `false` in production** — query output may contain PII. |
| `DRIZZLE_LOGGER` | DEV | No | No | `false` | `true` | Enables Drizzle's built-in logger interface. Separate from `DRIZZLE_VERBOSE`. Used in development for migration debugging. |

---

## 6. Authentication & Security

The platform uses short-lived JWT access tokens delivered via HTTP-only cookies, with long-lived refresh tokens stored server-side in PostgreSQL. This architecture is explicitly designed for future SSO or national identity provider integration.

### 6.1 JWT Configuration

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `AUTH_JWT_ACCESS_SECRET` | REQ, SEC, PROD | Yes | Yes | — | `(256-bit random hex)` | Signing secret for JWT access tokens. Must be at least 256 bits of cryptographically random entropy. Rotation requires coordinated deployment — all active sessions are invalidated. Use `openssl rand -hex 32` to generate. |
| `AUTH_JWT_REFRESH_SECRET` | REQ, SEC, PROD | Yes | Yes | — | `(256-bit random hex)` | Signing secret for JWT refresh token **validation**. Distinct from the access token secret. Refresh tokens are stored hashed in PostgreSQL; this secret verifies the token presented by the client. |
| `AUTH_JWT_ACCESS_EXPIRES_IN` | OPT | No | No | `15m` | `15m` | Access token TTL in `jsonwebtoken` duration notation. Accepted examples: `15m`, `30m`, `1h`. Must be short-lived. Maximum recommended value: `60m`. |
| `AUTH_JWT_REFRESH_EXPIRES_IN` | OPT | No | No | `30d` | `30d` | Refresh token server-side expiry duration. Stored in the `iam.refresh_tokens` table and checked at each refresh cycle. Rotation occurs on every use. |
| `AUTH_JWT_ALGORITHM` | OPT | No | No | `HS256` | `HS256` | JWT signing algorithm. `HS256` is the default (symmetric, server-to-server trust). Reserved for future migration to `RS256` or `ES256` when an external identity provider is integrated. |

### 6.2 Cookie Configuration

All tokens are delivered exclusively via HTTP-only cookies. Client-side JavaScript has no access to token values. This is a non-negotiable security invariant.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `AUTH_COOKIE_SECURE` | OPT | No | No | `true` | `true` | Sets the `Secure` attribute on all auth cookies. Must be `true` in production (HTTPS only). Set `false` in local HTTP development only. |
| `AUTH_COOKIE_SAMESITE` | OPT | No | No | `Strict` | `Strict` | Sets the `SameSite` attribute. `Strict` is required. `Lax` or `None` are not permitted for auth cookies in this platform. |
| `AUTH_COOKIE_DOMAIN` | OPT | No | No | — | `.batac.gov.ph` | Sets the `Domain` attribute on auth cookies. In development, leave blank. In production, set to the shared domain to allow cookies across subdomains (e.g., `dms.batac.gov.ph` and `api.batac.gov.ph`). |
| `AUTH_COOKIE_PATH` | OPT | No | No | `/` | `/` | Restricts the cookie's path scope. |
| `AUTH_ACCESS_TOKEN_COOKIE_NAME` | OPT | No | No | `__Host-bat_at` | `__Host-bat_at` | Name of the access token cookie. The `__Host-` prefix enforces additional browser-level security constraints (no `Domain` attribute, `Secure` required, path must be `/`). |
| `AUTH_REFRESH_TOKEN_COOKIE_NAME` | OPT | No | No | `__Host-bat_rt` | `__Host-bat_rt` | Name of the refresh token cookie. Same constraints as the access token cookie. |

### 6.3 Session Configuration

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `AUTH_SESSION_INACTIVITY_TIMEOUT_MS` | OPT | No | No | `1800000` | `1800000` | Session inactivity timeout in milliseconds. Default is 30 minutes (1,800,000 ms). After this period of inactivity, the user is logged out. |
| `AUTH_SESSION_WARNING_THRESHOLD_MS` | OPT | No | No | `1500000` | `1500000` | Milliseconds before the inactivity timeout at which a "session expiring soon" warning is sent to the client via SSE. Default is 25 minutes (1,500,000 ms). |
| `AUTH_MAX_CONCURRENT_SESSIONS` | OPT | No | No | `1` | `1` | Maximum number of active sessions per user. When a new login occurs and this limit is reached, the oldest session is terminated and the user is notified. Currently fixed at 1 (single-session enforcement). |

### 6.4 Argon2id Password Hashing

Argon2id is used for all password hashing per OWASP recommendations. These tuning variables allow the security parameters to be adjusted as hardware improves without a code change.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `ARGON2_MEMORY_COST` | OPT | No | No | `65536` | `65536` | Memory cost in KiB. OWASP minimum is 19 MiB (19,456 KiB); this default (64 MiB) is more conservative, matching B5 ADR-AUTH-002. Increase in production if server RAM permits. |
| `ARGON2_TIME_COST` | OPT | No | No | `2` | `2` | Number of iterations. OWASP's published minimum for Argon2id is 2, not 3 — corrected to match B5 ADR-AUTH-002 and current OWASP Password Storage Cheat Sheet guidance. `[Corrected — this row previously defaulted to 3 with an incorrect inline claim that 3 is the OWASP minimum; it is not]` |
| `ARGON2_PARALLELISM` | OPT | No | No | `1` | `1` | Degree of parallelism (threads). OWASP recommends `p=1` specifically — increasing parallelism speeds up hashing but reduces Argon2's memory-hardness advantage against parallel/GPU attacks, so this should not be set to the number of CPU cores. `[Corrected — description previously suggested maximizing to available cores, which weakens the memory-hardness guarantee this algorithm is chosen for]` |
| `ARGON2_HASH_LENGTH` | OPT | No | No | `32` | `32` | Output hash length in bytes. 32 bytes (256 bits) is the recommended default. |

### 6.5 MFA Configuration (Phase 1 Ready; Enforced in Phase 2)

MFA infrastructure is wired into the authentication flow in Phase 1 but not enforced until Phase 2. These variables allow activation without a code deployment.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `AUTH_MFA_TOTP_ENABLED` | OPT | No | No | `false` | `true` | Globally enables TOTP-based MFA. When `false`, MFA enrollment and enforcement are disabled. Set `true` in Phase 2 for privileged roles (Mayor, SP Secretary, Platform Administrator, IT Admin). |
| `AUTH_MFA_TOTP_ISSUER` | OPT | No | No | `Batac City LGU` | `Batac City LGU` | The issuer name displayed in TOTP authenticator apps. |
| `AUTH_MFA_TOTP_WINDOW` | OPT | No | No | `1` | `1` | Number of TOTP step windows to allow on either side of the current time. `1` tolerates ±30 seconds of clock drift. |

---

## 7. Audit Log Security

The audit log is the tamper-evidence backbone of the platform. All government transactions that can have legal or accountability implications are written here. The log is append-only at the PostgreSQL permission level and cryptographically protected at the application layer.

**The audit log is tamper-evident, not tamper-proof.** An attacker with both direct database write access and the HMAC secret could theoretically insert valid records. This boundary must be documented in the system ADR. The external TSA export closes this window for bulk deletions.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `AUDIT_HMAC_SECRET` | REQ, SEC, PROD | Yes | Yes | — | `(256-bit random hex)` | The HMAC-SHA-256 signing key applied to each audit event payload. Stored in the application environment only — **never written to the database**. An attacker with only DB write access cannot compute a valid HMAC without this key. Rotate this key with caution: rotation invalidates the HMAC of all previous events. Generate with `openssl rand -hex 32`. |
| `AUDIT_GENESIS_HASH` | OPT | No | No | `0000000000000000000000000000000000000000000000000000000000000000` | `0000...` | The SHA-256 hash used as the `previous_hash` for the very first audit record in a chain. Defaults to 64 zero characters. Document this value in the system ADR for the audit log. Must not change after the first audit event is written. |
| `AUDIT_CHAIN_VERIFY_ON_READ` | OPT | No | No | `true` | `true` | When `true`, the audit service validates the SHA-256 hash chain on every read of the audit log. A broken chain raises an alert and logs a `TAMPER_DETECTED` event. Disable only under extraordinary load in a development environment. |
| `AUDIT_RETENTION_DAYS` | OPT | No | No | `3650` | `3650` | Minimum number of days audit records are retained before they become eligible for archival export. Default is 10 years (3,650 days). COA and RA 7160 compliance requires long retention of financial and legislative audit events. |
| `AUDIT_TSA_ENABLED` | OPT | No | No | `false` | `true` | Enables the monthly RFC 3161 timestamp authority export. When `true`, the audit export job submits signed batch digests to the configured TSA. |
| `AUDIT_TSA_URL` | OPT, SEC | No | Yes | — | `https://tsa.example.gov.ph` | URL of the RFC 3161 Timestamp Authority. Required when `AUDIT_TSA_ENABLED` is `true`. Must be a self-hostable or government-operated TSA to satisfy the on-premise constraint. |
| `AUDIT_EXPORT_ENABLED` | OPT | No | No | `false` | `true` | Enables the scheduled audit log export job (managed by pgboss). When `true`, the job runs on the schedule defined by `CRON_AUDIT_EXPORT`. |
| `AUDIT_EXPORT_DESTINATION` | OPT | No | No | `s3` | `s3` | Destination for audit log exports. Currently only `s3` is supported (to the backup S3 bucket). Future values may include `local` for on-premise deployments. |

---

## 8. File Storage Configuration

All file uploads (documents, scanned images, PDF attachments) are streamed directly between the client and the S3-compatible object store. Files **never touch the application server's local disk**. The application is stateless with respect to file storage.

Migration between providers (Cloudflare R2 to MinIO or any other S3-compatible store) requires only changing the four endpoint/credential variables — no code changes. **The application uses the `@aws-sdk/client-s3` library pointed at the configured endpoint. No provider-specific SDK is permitted.**

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `S3_ENDPOINT` | REQ | Yes | No | — | `https://abc123.r2.cloudflarestorage.com` | The S3-compatible endpoint URL. For Cloudflare R2: `https://{ACCOUNT_ID}.r2.cloudflarestorage.com`. For MinIO: `http://minio.internal:9000`. This is the only change needed when migrating between providers. |
| `S3_BUCKET` | REQ | Yes | No | — | `batac-lgu-documents` | The S3 bucket name. Must already exist and have versioning enabled before the application starts. |
| `S3_ACCESS_KEY` | REQ, SEC | Yes | Yes | — | `abc123...` | S3-compatible access key ID. For R2: obtained from the Cloudflare dashboard API tokens. For MinIO: the access key configured during MinIO setup. |
| `S3_SECRET_KEY` | REQ, SEC | Yes | Yes | — | `xyz789...` | S3-compatible secret access key. Pair with `S3_ACCESS_KEY`. Never logged. |
| `S3_REGION` | OPT | No | No | `auto` | `auto` | S3 region. For Cloudflare R2, use `auto`. For MinIO, the configured region (commonly `us-east-1` by convention). For AWS S3, the actual region (e.g., `ap-southeast-1`). |
| `S3_FORCE_PATH_STYLE` | OPT | No | No | `false` | `true` | Forces path-style S3 URLs (`endpoint/bucket/key`) instead of virtual-hosted style (`bucket.endpoint/key`). **Required for MinIO.** Set `false` for Cloudflare R2 and AWS S3. |
| `S3_UPLOAD_MAX_SIZE_MB` | OPT | No | No | `25` | `25` | Maximum file size for a single upload in megabytes. Enforced in both the Fastify route schema and client-side validation. Configurable via this variable to avoid a code change if the LGU requests a higher limit. |
| `S3_SIGNED_URL_EXPIRES_S` | OPT | No | No | `300` | `300` | Expiry in seconds for pre-signed download URLs. Clients use pre-signed URLs for direct-to-storage downloads. Default is 5 minutes. Increase for large files if needed. |
| `S3_UPLOAD_PRESIGN_EXPIRES_S` | OPT | No | No | `600` | `600` | Expiry in seconds for pre-signed upload URLs. Must be long enough for the client to complete the upload but short enough to limit the window for misuse. |
| `S3_ALLOWED_MIME_TYPES` | OPT | No | No | `application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg` | (see default) | Comma-separated list of MIME types accepted for upload. Validated server-side before pre-signed URL issuance. Matches the architecture decision: PDF, DOCX, XLSX, PNG, JPG. |
| `S3_BACKUP_BUCKET` | REQ, PROD | Yes (production) | No | — | `batac-lgu-backups` | Separate S3 bucket for database backups and audit log exports. Must be configured with Object Lock (write-once) for immutable backup copies. |
| `S3_BACKUP_ACCESS_KEY` | REQ, SEC, PROD | Yes (production) | Yes | — | — | Access key for the backup bucket. Must be a **separate credential** from `S3_ACCESS_KEY`. The application runtime role must not have access to the backup bucket. |
| `S3_BACKUP_SECRET_KEY` | REQ, SEC, PROD | Yes (production) | Yes | — | — | Secret key for the backup bucket. Pair with `S3_BACKUP_ACCESS_KEY`. |
| `S3_BACKUP_ENDPOINT` | OPT | No | No | `(same as S3_ENDPOINT)` | — | Allows the backup bucket to reside on a different S3-compatible provider than the document storage bucket. Useful if the LGU uses a separate MinIO instance for backups. |

---

## 9. Email Configuration

Email is used for notifications, document request approvals, complaint respondent notifications, and OTP delivery for citizen portal verification. The platform uses Nodemailer with `@react-email/components` for templated emails. Any SMTP provider is supported, including the LGU's internal mail server.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `SMTP_HOST` | REQ | Yes | No | — | `mail.batac.gov.ph` | Hostname of the SMTP server. Supports LGU-operated mail servers, Microsoft Exchange, or any standards-compliant SMTP provider. |
| `SMTP_PORT` | OPT | No | No | `587` | `587` | SMTP port. Common values: `25` (unencrypted, not recommended), `465` (SSL/TLS), `587` (STARTTLS, recommended). |
| `SMTP_SECURE` | OPT | No | No | `false` | `true` | When `true`, uses SSL/TLS from connection open (port 465). When `false`, uses STARTTLS negotiation (port 587). Maps to Nodemailer's `secure` option. |
| `SMTP_USER` | REQ | Yes | No | — | `noreply@batac.gov.ph` | SMTP authentication username. Usually the sender email address. |
| `SMTP_PASSWORD` | REQ, SEC | Yes | Yes | — | `mail_secret` | SMTP authentication password. |
| `SMTP_FROM` | REQ | Yes | No | — | `noreply@batac.gov.ph` | The `From` email address used for all outbound messages. Must be an address the SMTP server is authorized to send on behalf of. |
| `SMTP_FROM_NAME` | OPT | No | No | `Batac City LGU` | `Batac City LGU` | The display name paired with `SMTP_FROM`. Appears in email clients as the sender name. |
| `SMTP_REJECT_UNAUTHORIZED` | OPT | No | No | `true` | `true` | When `true`, rejects SMTP connections with invalid or self-signed TLS certificates. Set `false` only in development with a local SMTP server (e.g., Mailpit or MailHog). **Never `false` in production.** |
| `SMTP_POOL` | OPT | No | No | `true` | `true` | Enables Nodemailer connection pooling. Recommended for production to avoid repeated TCP connection overhead. |
| `SMTP_MAX_CONNECTIONS` | OPT | No | No | `5` | `5` | Maximum concurrent SMTP connections in the pool. |
| `SMTP_MAX_MESSAGES` | OPT | No | No | `100` | `100` | Maximum number of messages sent per connection before the connection is recycled. |
| `SMTP_DEBUG` | DEV | No | No | `false` | `true` | Enables Nodemailer debug output. Logs full SMTP conversation to stdout. **Must never be `true` in production** — may expose credentials in logs. |

---

## 10. OCR Configuration

Optical character recognition runs automatically on every uploaded document. The system detects scan quality and presents a quality indicator to the user, enabling them to decide whether to perform a manual re-scan before the document is formally logged.

OCR is a confirmed Phase 1 requirement. All calls to the OCR engine must go through the `OcrService` interface in `/apps/server/src/services/ocr.ts` — never called directly from upload handlers. This interface is swappable without touching call sites.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `OCR_ENGINE` | OPT | No | No | `tesseract` | `tesseract` | Selects the OCR engine backend. Accepted values: `tesseract` (uses tesseract.js, preferred for on-premise constraint), `service` (routes to an external OCR HTTP service via `OCR_SERVICE_URL`). |
| `OCR_SERVICE_URL` | OPT | No | No | — | `http://ocr-service.internal:8080` | URL of a self-hosted OCR HTTP service. Used only when `OCR_ENGINE` is `service`. Must be self-hostable — cloud OCR vendors that send data off-premise are prohibited (RA 10173 Data Privacy Act compliance and LGU data sovereignty). |
| `OCR_SERVICE_API_KEY` | OPT, SEC | No | Yes | — | `ocr_api_key_here` | API key for the OCR HTTP service. Used only when `OCR_ENGINE` is `service`. |
| `OCR_LANGUAGE_PACKS` | OPT | No | No | `eng+fil` | `eng+fil` | Tesseract language codes, `+`-joined. Filipino government documents contain English, Filipino, and Ilocano text. Default covers English and Filipino. Add `ilo` if an Ilocano tesseract pack is available and validated. |
| `OCR_WORKER_COUNT` | OPT | No | No | `2` | `4` | Number of parallel OCR workers. Tesseract.js runs in worker threads. Increase on multi-core servers. Keep below `Math.ceil(cpuCount / 2)` to avoid starving the main Fastify event loop. |
| `OCR_TIMEOUT_MS` | OPT | No | No | `60000` | `60000` | Maximum time in milliseconds a single OCR job may run before being aborted. Large or poorly scanned documents may be slow. Default is 60 seconds. |
| `OCR_MAX_FILE_SIZE_MB` | OPT | No | No | `25` | `25` | Maximum file size in MB the OCR service will attempt to process. Files exceeding this limit are flagged with a `SKIPPED_SIZE` quality indicator. Must be ≤ `S3_UPLOAD_MAX_SIZE_MB`. |
| `OCR_QUALITY_THRESHOLD` | OPT | No | No | `0.6` | `0.6` | Confidence score (0.0–1.0) below which a scan is classified as `POOR` quality. The quality indicator is shown to the user regardless of threshold; this value determines the `ACCEPTABLE` vs `POOR` boundary. |
| `OCR_QUEUE_CONCURRENCY` | OPT | No | No | `3` | `3` | Maximum number of concurrent OCR jobs processed from the pgboss queue. Separate from `OCR_WORKER_COUNT` — this is the queue concurrency, not the worker thread count. |
| `OCR_MIGRATION_ENABLED` | OPT | No | No | `false` | `true` | When `true`, the OCR migration job processes historical records imported from LMITS and flags documents lacking OCR-indexed text. Activated during the migration phase, not during normal operation. |
| `OCR_MIGRATION_BATCH_SIZE` | OPT | No | No | `50` | `50` | Number of historical documents to OCR-process per batch during migration jobs. |

---

## 11. Search Configuration

The search provider is abstracted behind a `SearchService` interface in the application. Phase 1 uses PostgreSQL full-text search (`tsvector`/`tsquery`). Phase 2 upgrades to Meilisearch for typo-tolerant search on Filipino proper names. The switch requires only an environment variable change — no call-site changes.

### 11.1 Phase 1 — PostgreSQL FTS

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `SEARCH_PROVIDER` | OPT | No | No | `postgres` | `postgres` | Selects the search backend. Accepted values: `postgres` (Phase 1), `meilisearch` (Phase 2+). When set to `postgres`, all Meilisearch variables are ignored. |
| `SEARCH_FTS_LANGUAGE` | OPT | No | No | `english` | `english` | PostgreSQL FTS configuration. `english` is the default and handles most document text. If Filipino/Tagalog-specific stemming is needed, a custom configuration can be loaded and referenced here. |

### 11.2 Phase 2+ — Meilisearch

These variables are validated as optional in Phase 1 Zod schemas. They must be set when `SEARCH_PROVIDER` is `meilisearch`.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `SEARCH_MEILISEARCH_URL` | PH2 | No (Phase 1) | No | — | `http://meilisearch.internal:7700` | URL of the self-hosted Meilisearch instance. Must be reachable from the Fastify server. Meilisearch runs in Docker on the same VPS or a connected host. |
| `SEARCH_MEILISEARCH_MASTER_KEY` | PH2, SEC | No (Phase 1) | Yes | — | `meilisearch_master_key_here` | Meilisearch master key. Used by the application to create index-scoped API keys at startup. Never use the master key directly for search operations — derive scoped keys. |
| `SEARCH_MEILISEARCH_INDEX_PREFIX` | PH2 | No | No | `batac_` | `batac_prod_` | Prefix for Meilisearch index names. Allows multiple environments to share a single Meilisearch instance by namespacing their indices. |
| `SEARCH_SYNC_BATCH_SIZE` | PH2 | No | No | `100` | `100` | Number of documents per batch when syncing from PostgreSQL to Meilisearch. |
| `SEARCH_SYNC_INTERVAL_MS` | PH2 | No | No | `5000` | `5000` | Polling interval in milliseconds for the Meilisearch sync worker. Shorter intervals give more up-to-date results but increase database read load. |
| `SEARCH_SYNC_ON_STARTUP` | PH2 | No | No | `false` | `false` | When `true`, triggers a full re-index from PostgreSQL to Meilisearch on every application startup. Useful after migrations. Disable in production for normal operation. |

---

## 12. Notifications (SSE)

The platform delivers real-time in-app notifications using Server-Sent Events (SSE). SSE is one-directional (server to client) and does not require WebSocket infrastructure. Fastify handles SSE connections natively.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `SSE_HEARTBEAT_INTERVAL_MS` | OPT | No | No | `30000` | `30000` | Interval in milliseconds at which the server sends a heartbeat (comment) event to keep SSE connections alive through proxies and load balancers. Default is 30 seconds. |
| `SSE_CONNECTION_TIMEOUT_MS` | OPT | No | No | `3600000` | `3600000` | Maximum duration in milliseconds a single SSE connection is held open before the server closes it and the client reconnects. Default is 1 hour. |
| `SSE_MAX_CONNECTIONS_PER_USER` | OPT | No | No | `3` | `3` | Maximum concurrent SSE connections per authenticated user. Prevents runaway connections from multiple browser tabs. |
| `SSE_RETRY_MS` | OPT | No | No | `3000` | `3000` | Value sent in the SSE `retry:` field. Instructs the browser to wait this many milliseconds before attempting to reconnect after a disconnect. |
| `NOTIF_RETENTION_DAYS` | OPT | No | No | `30` | `30` | Number of days in-app notifications are retained in the database before being eligible for cleanup. Delivered notifications older than this value are removed by a scheduled pgboss job. |
| `NOTIF_MAX_UNREAD_PER_USER` | OPT | No | No | `200` | `200` | Maximum unread notifications retained per user before the oldest are dropped. Prevents notification table bloat for inactive accounts. |

---

## 13. Error Monitoring & Observability

### 13.1 Sentry

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `SENTRY_DSN` | PROD | Yes (production) | No | — | `https://abc@o123.ingest.sentry.io/456` | Sentry Data Source Name. Required in staging and production. Unhandled exceptions in production are unacceptable — Sentry captures them all. Leave blank in development to disable Sentry. |
| `SENTRY_ENVIRONMENT` | OPT | No | No | `(mirrors APP_ENV)` | `production` | Sentry environment tag. Defaults to `APP_ENV`. Explicitly set if the environments differ. |
| `SENTRY_RELEASE` | OPT | No | No | `(mirrors APP_VERSION)` | `1.0.0` | Sentry release name. Enables release tracking and source maps for error grouping. Injected by the CI/CD pipeline at deploy time. |
| `SENTRY_TRACES_SAMPLE_RATE` | OPT | No | No | `0.1` | `0.1` | Fraction of requests (0.0–1.0) to trace for Sentry Performance. `0.1` samples 10% of requests. Lower in high-traffic production; higher in staging. |
| `SENTRY_PROFILES_SAMPLE_RATE` | OPT | No | No | `0.0` | `0.05` | Fraction of traced requests to profile for Sentry Profiling. Off by default (`0.0`). Enable in production to identify bottlenecks. |

### 13.2 Logging

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `LOG_LEVEL` | OPT | No | No | `info` | `info` | Pino log level. See Section 4. |
| `LOG_PRETTY` | DEV | No | No | `false` | `true` | See Section 4. |
| `LOG_REDACT_PATHS` | OPT | No | No | `["req.headers.authorization","req.headers.cookie","*.password","*.secret"]` | (see default) | JSON array of Pino redact paths. These fields are replaced with `[Redacted]` before log output. Prevents accidental credential logging. The default list covers standard HTTP auth headers and common secret field names. |
| `LOG_DESTINATION` | OPT | No | No | `stdout` | `stdout` | Pino log destination. `stdout` for Docker/container environments (collected by log aggregator). `file:/path/to/log` for file output on bare-metal deployments. |

### 13.3 Health Check

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `HEALTH_CHECK_PATH` | OPT | No | No | `/health` | `/health` | HTTP path for the server health-check endpoint. Returns `{ status: "ok", version, uptime }`. Used by Docker health checks, load balancers, and monitoring tools. |

---

## 14. Public Portal Configuration

The public citizen portal (`/apps/portal`) is a Next.js application delivered in Phase 3. Variables in this section are forward-declared so the schema is ready when the portal module is activated. Some variables have `NEXT_PUBLIC_` prefixes, which Next.js includes in the client-side JavaScript bundle. **Never put secrets in `NEXT_PUBLIC_` variables.**

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `PORTAL_URL` | PH3 | No (Phase 1) | No | — | `https://portal.batac.gov.ph` | Canonical URL of the public citizen portal. Used by the backend to generate absolute links and QR scan redirect targets. |
| `PORTAL_API_URL` | PH3 | No | No | `(mirrors API_URL)` | `https://api.batac.gov.ph` | The Fastify REST API base URL, as accessed by the Next.js portal server-side rendering layer. |
| `PORTAL_CDN_URL` | PH3 | No | No | — | `https://cdn.batac.gov.ph` | CDN origin for portal static assets. Leave blank to serve from `PORTAL_URL` directly. |
| `NEXT_PUBLIC_APP_NAME` | PH3, PUB | No | No | `Batac City LGU` | `Batac City LGU` | Application name embedded in the portal client bundle. Appears in page titles and meta tags. |
| `NEXT_PUBLIC_API_URL` | PH3, PUB | No | No | — | `https://api.batac.gov.ph` | Base URL of the REST API, included in the portal's client-side bundle for browser-initiated requests. Must be publicly reachable. |
| `NEXT_PUBLIC_PORTAL_URL` | PH3, PUB | No | No | — | `https://portal.batac.gov.ph` | The portal's own public URL, embedded in the client bundle. Used for sharing links. |
| `NEXT_PUBLIC_QR_BASE_URL` | PH3, PUB | No | No | — | `https://portal.batac.gov.ph/track` | Base URL embedded in QR codes. When a QR code is scanned, the browser navigates to `{NEXT_PUBLIC_QR_BASE_URL}/{tracking_id}`. |
| `PORTAL_CITIZEN_OTP_EXPIRY_S` | PH3 | No | No | `300` | `300` | Expiry in seconds for citizen portal OTP codes (phone and email verification). Default is 5 minutes. |
| `PORTAL_CITIZEN_OTP_LENGTH` | PH3 | No | No | `6` | `6` | Length of the OTP code sent to citizens during verification. |
| `PORTAL_CITIZEN_REVERIFY_DAYS` | PH3 | No | No | `365` | `365` | Number of days between mandatory citizen account re-verifications. Per the architecture decision: annual re-verification. |

---

## 15. Background Jobs

Two schedulers are used:
- `node-cron` for lightweight, stateless scheduled tasks (SLA checks, timer polls)
- `pgboss` for durable, exactly-once job queues (OCR processing, audit exports, email delivery)

pgboss uses the same PostgreSQL database and stores job state in a dedicated schema. It survives application restarts and distributes work across multiple process instances.

### 15.1 pgboss Configuration

| Variable                                 | Class | Required | Secret | Default  | Example  | Description                                                                      |
| ---------------------------------------- | ----- | -------- | ------ | -------- | -------- | -------------------------------------------------------------------------------- |
| `PGBOSS_SCHEMA`                          | OPT   | No       | No     | `pgboss` | `pgboss` | PostgreSQL schema name for pgboss job tables. Isolated from application schemas. |
| `PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS` | OPT   | No       | No     | `86400`  | `86400`  | Seconds after which a completed job is archived. Default is 24 hours.            |
| `PGBOSS_DELETE_AFTER_DAYS`               | OPT   | No       | No     | `7`      | `7`      | Days after which archived jobs are permanently deleted from the pgboss schema.   |

### 15.2 Job Worker Configuration

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `JOB_WORKER_CONCURRENCY` | OPT | No | No | `5` | `10` | Default maximum number of concurrent job executions across all queue workers. Individual queues may override this per-queue. |
| `JOB_RETRY_LIMIT` | OPT | No | No | `3` | `3` | Number of times a failed job is retried before being marked `failed`. |
| `JOB_RETRY_DELAY_S` | OPT | No | No | `60` | `60` | Initial delay in seconds before the first retry of a failed job. Subsequent retries use exponential backoff. |
| `JOB_EXPIRY_SECONDS` | OPT | No | No | `3600` | `3600` | Time in seconds after which an unstarted job expires if it has not been picked up by a worker. |

### 15.3 Scheduled Task Timing (node-cron expressions)

These variables control when periodic checks run. Values must be valid cron expressions.

| Variable                        | Class     | Required | Secret | Default        | Example        | Description                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------- | -------- | ------ | -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CRON_SLA_CHECK`                | OPT       | No       | No     | `*/15 * * * *` | `*/15 * * * *` | Cron expression for the ARTA SLA compliance check. Runs every 15 minutes. Identifies documents approaching or exceeding SLA thresholds and emits escalation notifications. ARTA requires simple ≤3 days, complex ≤7 days, highly technical ≤20 working days.                                             |
| `CRON_MAYOR_LAPSE_CHECK`        | OPT       | No       | No     | `0 6 * * *`    | `0 6 * * *`    | Cron expression for the Mayor's 10-calendar-day lapse check. Runs daily at 06:00 (Asia/Manila). Identifies resolutions and ordinances that have been with the Mayor for 10 days without action and transitions them to "Lapsed into Law" status, logging the RA 7160 legal basis.                        |
| `CRON_PANLALAWIGAN_TIMER_CHECK` | OPT       | No       | No     | `0 7 * * *`    | `0 7 * * *`    | Cron expression for the Sangguniang Panlalawigan 30-day review timer. Runs daily at 07:00. Identifies documents that have been with the Panlalawigan for 30 days with no recorded outcome and transitions them to "Deemed Approved per RA 7160 Section 56(d)", populating the Remarks field accordingly. |
| `CRON_SESSION_CLEANUP`          | OPT       | No       | No     | `0 3 * * *`    | `0 3 * * *`    | Cron expression for expired session cleanup. Runs daily at 03:00. Removes refresh token records past their expiry date from `iam.refresh_tokens`.                                                                                                                                                        |
| `CRON_NOTIFICATION_CLEANUP`     | OPT       | No       | No     | `0 2 * * *`    | `0 2 * * *`    | Cron expression for old notification cleanup. Runs daily at 02:00. Removes delivered notifications older than `NOTIF_RETENTION_DAYS` days.                                                                                                                                                               |
| `CRON_AUDIT_EXPORT`             | OPT       | No       | No     | `0 1 1 * *`    | `0 1 1 * *`    | Cron expression for the monthly audit log export to the TSA and backup S3 bucket. Runs at 01:00 on the first of each month. Effective only when `AUDIT_EXPORT_ENABLED` is `true`.                                                                                                                        |
| `CRON_DELEGATION_EXPIRY_CHECK`  | OPT       | No       | No     | `*/5 * * * *`  | `*/5 * * * *`  | Cron expression for designation (delegation) expiry. Runs every 5 minutes. Identifies `delegation_grants` records past their `end_date` and marks them inactive, triggering routing reassignment back to the original authority.                                                                         |
| `CRON_BACKUP_DATABASE`          | OPT, PROD | No       | No     | `0 0 * * *`    | `0 0 * * *`    | Cron expression for the daily encrypted `pg_dump` backup to S3. Runs at midnight. Effective only in production.                                                                                                                                                                                          |
| `CRON_ORDER_OF_BUSINESS_ALERT`  | OPT       | No       | No     | `0 9 * * 4`    | `0 9 * * 4`    | Cron expression for the Thursday Order of Business cutoff alert. Runs every Thursday at 09:00. Notifies the SP Secretary about measures with missing committee reports that would otherwise be delayed from the upcoming Tuesday session.                                                                |

---

## 16. Rate Limiting

`@fastify/rate-limit` is applied per-route group. Rate limits are configurable here to allow adjustment based on observed load patterns without a code deployment.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `RATE_AUTH_MAX` | OPT | No | No | `10` | `10` | Maximum authentication requests (login, refresh, OTP verify) per `RATE_AUTH_WINDOW_MS` per IP. Prevents brute-force attacks. |
| `RATE_AUTH_WINDOW_MS` | OPT | No | No | `900000` | `900000` | Rate limit window in milliseconds for auth endpoints. Default is 15 minutes (900,000 ms). |
| `RATE_API_MAX` | OPT | No | No | `200` | `200` | Maximum general API requests per `RATE_API_WINDOW_MS` per authenticated user. Prevents scripted scraping. |
| `RATE_API_WINDOW_MS` | OPT | No | No | `60000` | `60000` | Rate limit window in milliseconds for general API endpoints. Default is 60 seconds. |
| `RATE_PORTAL_MAX` | OPT | No | No | `60` | `60` | Maximum requests per `RATE_PORTAL_WINDOW_MS` per IP on the public portal REST API. Applies to tracking lookups, complaint submissions, and document request form endpoints. |
| `RATE_PORTAL_WINDOW_MS` | OPT | No | No | `60000` | `60000` | Rate limit window in milliseconds for portal endpoints. |
| `RATE_UPLOAD_MAX` | OPT | No | No | `20` | `20` | Maximum file upload pre-sign requests per `RATE_UPLOAD_WINDOW_MS` per user. Prevents storage quota abuse. |
| `RATE_UPLOAD_WINDOW_MS` | OPT | No | No | `60000` | `60000` | Rate limit window in milliseconds for upload pre-sign requests. |

---

## 17. QR Codes & Document Numbering

QR codes encode only the tracking ID — never document content. All document data is fetched from the database using the tracking ID.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `QR_BASE_URL` | REQ | Yes | No | — | `https://portal.batac.gov.ph/track` | The URL prefix embedded in all generated QR codes. When scanned, the browser navigates to `{QR_BASE_URL}/{tracking_id}`. The page displays document type, remarks, routing history, and the first page only. Must be publicly accessible without authentication. In Phase 1 (before the portal exists), this can point to a lightweight public-read REST endpoint. |
| `QR_ERROR_CORRECTION_LEVEL` | OPT | No | No | `M` | `M` | QR code error correction level. Accepted values: `L` (7%), `M` (15%), `Q` (25%), `H` (30%). `M` balances code density with resilience to physical damage on printed cover sheets. |
| `QR_MODULE_SIZE` | OPT | No | No | `4` | `4` | QR code module (pixel) size in pixels for server-side generation using the `qrcode` library. Affects the size of the generated PNG/SVG. |
| `QR_COVER_SHEETS_PER_PAGE` | OPT | No | No | `4` | `4` | Number of QR cover sheets printed per physical paper page. The cover sheet contains only three fields: QR Code, Tracking Number, Series Number. Multiple cover sheets fit on one page as compact horizontal rectangles. This is configurable to allow the LGU to adjust for paper conservation. |
| `DOC_SP_ORDINAL` | REQ | Yes | No | — | `7` | The ordinal number of the current Sangguniang Panlungsod. Currently `7` (7th SP). Used as the prefix in all SP document numbers (e.g., `7SP 2026-001`). Changes when a new SP is seated. Changing this variable requires a platform-level configuration update by the Platform Administrator, not a code deployment. |
| `DOC_NUMBER_CITY_ID` | OPT | No | No | `(mirrors CITY_ID)` | `01930a7d-...` | The `city_id` used as the scope for document number series. Defaults to `CITY_ID`. Explicitly separable for multi-LGU scenarios where a single platform instance serves multiple cities. |
| `DOC_TRACKING_NUMBER_PREFIX` | OPT | No | No | `DTS` | `DTS` | Prefix for DTS tracking numbers (e.g., `DTS-2026-000123`). System-generated, immutable per document lifetime, independent of preliminary and final document numbers. |

---

## 18. Internationalisation & Regional Settings

The platform serves content in English, Filipino (Tagalog), and Ilocano. Philippine government timezone is Asia/Manila.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `TZ` | REQ | Yes | No | `Asia/Manila` | `Asia/Manila` | System timezone for the Node.js process. Set as an OS-level environment variable (not dotenv). Critical for ARTA SLA calculations (working days), the Mayor's 10-day lapse timer, and Panlalawigan 30-day timer. All `TIMESTAMPTZ` columns in PostgreSQL store UTC; this variable controls the timezone context for cron jobs and date arithmetic. |
| `I18N_DEFAULT_LOCALE` | OPT | No | No | `en` | `en` | Default locale for UI text, emails, and generated documents. Accepted values: `en` (English), `fil` (Filipino/Tagalog), `ilo` (Ilocano). |
| `I18N_SUPPORTED_LOCALES` | OPT | No | No | `en,fil,ilo` | `en,fil,ilo` | Comma-separated list of locales the platform serves. Used by i18next to validate locale negotiation requests. |
| `I18N_FALLBACK_LOCALE` | OPT | No | No | `en` | `en` | Locale used when a requested locale is not available or a translation key is missing. |

---

## 19. Feature Flags

Feature flags control the activation of platform capabilities without requiring code deployments. In Phase 1, flags for Phase 2+ features are set to `false` and the associated code paths degrade gracefully. Flags are validated at startup; an unrecognised value causes a Zod error.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `FEATURE_MFA_ENABLED` | OPT | No | No | `false` | `true` | Enables TOTP-based multi-factor authentication enforcement for privileged roles (Mayor, SP Secretary, Platform Administrator, IT Admin). Phase 1 designs the flow; Phase 2 sets this to `true`. |
| `FEATURE_OCR_ENABLED` | OPT | No | No | `true` | `true` | Enables automatic OCR on upload. Phase 1 on. Disabling routes all uploads through the quality indicator with a `SKIPPED_OCR` status. |
| `FEATURE_MEILISEARCH_ENABLED` | PH2 | No | No | `false` | `true` | Switches the `SearchService` from PostgreSQL FTS to Meilisearch. Requires all `SEARCH_MEILISEARCH_*` variables to be set. Phase 2+. |
| `FEATURE_CITIZEN_PORTAL_ENABLED` | PH3 | No | No | `false` | `true` | Enables citizen registration, login, and complaint submission on the public portal. Phase 3. |
| `FEATURE_SMS_ENABLED` | PH3 | No | No | `false` | `true` | Enables SMS notification delivery for complaint respondents and citizen OTP. Phase 3. Requires SMS provider variables. |
| `FEATURE_PHILSYS_ENABLED` | OPT | No | No | `false` | `false` | Enables PhilSys national identity verification for citizen portal registration. Feature-flagged per architecture decision: assume unavailable; enable if integration becomes available. |
| `FEATURE_RECORDS_MANAGEMENT_ENABLED` | PH2 | No | No | `false` | `true` | Activates the Records Management System (RMS) module. Phase 2. |
| `FEATURE_EMAIL_NOTIFICATIONS_ENABLED` | OPT | No | No | `true` | `true` | Enables outbound email notifications. Set `false` in development to prevent accidental email delivery. |
| `FEATURE_SSE_ENABLED` | OPT | No | No | `true` | `true` | Enables Server-Sent Events for real-time in-app notifications. Can be disabled to reduce connection overhead in load testing environments. |
| `FEATURE_AUDIT_CHAIN_VERIFY_ENABLED` | OPT | No | No | `true` | `true` | Alias for `AUDIT_CHAIN_VERIFY_ON_READ`. Retained as a feature flag for emergency disablement under extraordinary audit log load. |

---

## 20. Infrastructure & Deployment

### 20.1 Docker and Container Configuration

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `DOCKER_IMAGE_TAG` | OPT | No | No | `latest` | `1.0.0-sha123abc` | The Docker image tag used in `docker-compose.yml` and Terraform deployments. Injected by the CI pipeline. Used for version pinning in production. |
| `CONTAINER_REGISTRY` | OPT | No | No | — | `ghcr.io/batac-city` | Container registry URL. Used by CI/CD to push and pull images. |

### 20.2 Backup Configuration

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `BACKUP_ENABLED` | OPT | No | No | `false` | `true` | Enables the scheduled database backup job. Must be `true` in production. |
| `BACKUP_ENCRYPTION_KEY` | PROD, SEC | Yes (production) | Yes | — | `(256-bit key)` | Symmetric encryption key for `pg_dump` backup files before upload to S3. Keys are held exclusively by the LGU IT Office. Rotation must be coordinated with the IT Office. Generate with `openssl rand -hex 32`. |
| `BACKUP_S3_BUCKET` | OPT | No | No | `(mirrors S3_BACKUP_BUCKET)` | `batac-lgu-backups` | Target S3 bucket for database backups. Alias that maps to `S3_BACKUP_BUCKET` for the backup job. |
| `BACKUP_RETENTION_DAYS_HOT` | OPT | No | No | `30` | `30` | Days to retain hot (immediately restorable) backup copies. |
| `BACKUP_RETENTION_DAYS_COLD` | OPT | No | No | `365` | `365` | Days to retain cold backup copies in write-once (object lock) storage. |
| `BACKUP_RESTORE_TEST_ENABLED` | OPT | No | No | `false` | `true` | When `true`, the backup job performs a test restoration to a scratch database after each backup and logs the result. Recommended for production DR compliance. |

### 20.3 Disaster Recovery

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `DR_HOT_STANDBY_ENABLED` | PROD | No | No | `false` | `true` | Enables the hot standby (streaming replication) health check. When `true`, the application monitors the standby lag. |
| `DR_HOT_STANDBY_URL` | PROD, SEC | No | Yes | — | `postgresql://app_user:secret@standby.host:5432/batac_lgu` | Connection string for the hot standby. Used only for lag monitoring; writes are never sent here. |
| `DR_MAX_REPLICATION_LAG_S` | OPT | No | No | `60` | `60` | Maximum acceptable streaming replication lag in seconds before an alert is raised. Architecture decision: lag < 60 seconds required. |

### 20.4 SMS Configuration (Phase 3)

SMS is used for complaint respondent notification and citizen OTP when the respondent or citizen has no email address.

| Variable | Class | Required | Secret | Default | Example | Description |
|---|---|---|---|---|---|---|
| `SMS_PROVIDER` | PH3 | No | No | — | `semaphore` | SMS provider identifier. Accepted values to be confirmed when Phase 3 is implemented. Must be a provider reachable from within the Philippines. |
| `SMS_API_KEY` | PH3, SEC | No | Yes | — | `sms_api_key_here` | API key for the SMS provider. |
| `SMS_SENDER_ID` | PH3 | No | No | `BATAC` | `BATAC` | Sender ID displayed on SMS messages. Limited to 11 characters by most Philippine telco carriers. |
| `SMS_ENABLED` | PH3 | No | No | `false` | `true` | Alias of `FEATURE_SMS_ENABLED` for the SMS service module. |

---

## 21. Zod Validation Schema Strategy

All environment variables are validated at application startup using Zod. The application exits with a clear error message if any required variable is missing or invalid. This implements the Fail Fast principle.

### 21.1 Architecture

The environment schema is split into three files within `/apps/server/src/config/`:

- `env.server.ts` — All server-side-only variables. Never exposed to the client.
- `env.client.ts` — Shared `/apps/web` client variables (Vite's `import.meta.env`).
- `env.portal.ts` — Next.js portal public variables (`NEXT_PUBLIC_*`). In `/apps/portal`.

### 21.2 Server Environment Schema (`env.server.ts`)

```typescript
// /apps/server/src/config/env.server.ts
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);
const floatBetween0and1 = z.coerce.number().min(0).max(1);

const LogLevel = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);
const AppEnv = z.enum(['development', 'staging', 'production', 'on-premise']);
const NodeEnv = z.enum(['development', 'test', 'staging', 'production']);
const SearchProvider = z.enum(['postgres', 'meilisearch']);
const OcrEngine = z.enum(['tesseract', 'service']);

export const serverEnvSchema = z.object({
  // ─── Core ───────────────────────────────────────────────────────────────
  NODE_ENV: NodeEnv,
  APP_ENV: AppEnv,
  APP_NAME: z.string().min(1).default('Batac City LGU Platform'),
  APP_VERSION: z.string().default('0.0.0'),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  APP_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  APP_HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: LogLevel.default('info'),
  LOG_PRETTY: booleanFromString.default('false'),
  LOG_REDACT_PATHS: z
    .string()
    .default('["req.headers.authorization","req.headers.cookie","*.password","*.secret"]')
    .transform((s) => JSON.parse(s) as string[]),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  CITY_ID: z.string().uuid(),
  TRUST_PROXY: booleanFromString.default('false'),
  APP_INSTANCE_ID: z.string().min(1).default(() => crypto.randomUUID()),

  // ─── Database ────────────────────────────────────────────────────────────
  DATABASE_URL_APP: z.string().url(),
  DATABASE_URL_AUDIT: z.string().url(),
  DATABASE_URL_MIGRATE: z.string().url().optional(),
  DB_POOL_MIN: nonNegativeInt.default(2),
  DB_POOL_MAX: positiveInt.default(10),
  DB_POOL_IDLE_TIMEOUT_MS: positiveInt.default(30000),
  DB_POOL_ACQUIRE_TIMEOUT_MS: positiveInt.default(10000),
  DB_POOL_CONNECTION_TIMEOUT_MS: positiveInt.default(5000),
  DB_STATEMENT_TIMEOUT_MS: positiveInt.default(30000),
  DRIZZLE_VERBOSE: booleanFromString.default('false'),

  // ─── Authentication ───────────────────────────────────────────────────────
  AUTH_JWT_ACCESS_SECRET: z.string().min(32),
  AUTH_JWT_REFRESH_SECRET: z.string().min(32),
  AUTH_JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  AUTH_JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  AUTH_JWT_ALGORITHM: z.enum(['HS256', 'RS256', 'ES256']).default('HS256'),
  AUTH_COOKIE_SECURE: booleanFromString.default('true'),
  AUTH_COOKIE_SAMESITE: z.enum(['Strict', 'Lax', 'None']).default('Strict'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_ACCESS_TOKEN_COOKIE_NAME: z.string().default('__Host-bat_at'),
  AUTH_REFRESH_TOKEN_COOKIE_NAME: z.string().default('__Host-bat_rt'),
  AUTH_SESSION_INACTIVITY_TIMEOUT_MS: positiveInt.default(1800000),
  AUTH_SESSION_WARNING_THRESHOLD_MS: positiveInt.default(1500000),
  AUTH_MAX_CONCURRENT_SESSIONS: positiveInt.default(1),
  AUTH_MFA_TOTP_ENABLED: booleanFromString.default('false'),
  AUTH_MFA_TOTP_ISSUER: z.string().default('Batac City LGU'),
  AUTH_MFA_TOTP_WINDOW: nonNegativeInt.default(1),

  // ─── Argon2id ─────────────────────────────────────────────────────────────
  ARGON2_MEMORY_COST: positiveInt.default(65536),
  ARGON2_TIME_COST: positiveInt.default(2),
  ARGON2_PARALLELISM: positiveInt.default(1),
  ARGON2_HASH_LENGTH: positiveInt.default(32),

  // ─── Audit Log ────────────────────────────────────────────────────────────
  AUDIT_HMAC_SECRET: z.string().min(32),
  AUDIT_GENESIS_HASH: z.string().length(64).default('0'.repeat(64)),
  AUDIT_CHAIN_VERIFY_ON_READ: booleanFromString.default('true'),
  AUDIT_RETENTION_DAYS: positiveInt.default(3650),
  AUDIT_TSA_ENABLED: booleanFromString.default('false'),
  AUDIT_TSA_URL: z.string().url().optional(),
  AUDIT_EXPORT_ENABLED: booleanFromString.default('false'),
  AUDIT_EXPORT_DESTINATION: z.enum(['s3']).default('s3'),

  // ─── S3-Compatible Storage ────────────────────────────────────────────────
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_REGION: z.string().default('auto'),
  S3_FORCE_PATH_STYLE: booleanFromString.default('false'),
  S3_UPLOAD_MAX_SIZE_MB: positiveInt.default(25),
  S3_SIGNED_URL_EXPIRES_S: positiveInt.default(300),
  S3_UPLOAD_PRESIGN_EXPIRES_S: positiveInt.default(600),
  S3_ALLOWED_MIME_TYPES: z
    .string()
    .default(
      'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg'
    )
    .transform((s) => s.split(',').map((m) => m.trim())),
  S3_BACKUP_BUCKET: z.string().optional(),
  S3_BACKUP_ACCESS_KEY: z.string().optional(),
  S3_BACKUP_SECRET_KEY: z.string().optional(),
  S3_BACKUP_ENDPOINT: z.string().url().optional(),

  // ─── SMTP ─────────────────────────────────────────────────────────────────
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: booleanFromString.default('false'),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().email(),
  SMTP_FROM_NAME: z.string().default('Batac City LGU'),
  SMTP_REJECT_UNAUTHORIZED: booleanFromString.default('true'),
  SMTP_POOL: booleanFromString.default('true'),
  SMTP_MAX_CONNECTIONS: positiveInt.default(5),
  SMTP_MAX_MESSAGES: positiveInt.default(100),
  SMTP_DEBUG: booleanFromString.default('false'),

  // ─── OCR ──────────────────────────────────────────────────────────────────
  OCR_ENGINE: OcrEngine.default('tesseract'),
  OCR_SERVICE_URL: z.string().url().optional(),
  OCR_SERVICE_API_KEY: z.string().optional(),
  OCR_LANGUAGE_PACKS: z.string().default('eng+fil'),
  OCR_WORKER_COUNT: positiveInt.default(2),
  OCR_TIMEOUT_MS: positiveInt.default(60000),
  OCR_MAX_FILE_SIZE_MB: positiveInt.default(25),
  OCR_QUALITY_THRESHOLD: floatBetween0and1.default(0.6),
  OCR_QUEUE_CONCURRENCY: positiveInt.default(3),
  OCR_MIGRATION_ENABLED: booleanFromString.default('false'),
  OCR_MIGRATION_BATCH_SIZE: positiveInt.default(50),

  // ─── Search ───────────────────────────────────────────────────────────────
  SEARCH_PROVIDER: SearchProvider.default('postgres'),
  SEARCH_FTS_LANGUAGE: z.string().default('english'),
  SEARCH_MEILISEARCH_URL: z.string().url().optional(),
  SEARCH_MEILISEARCH_MASTER_KEY: z.string().optional(),
  SEARCH_MEILISEARCH_INDEX_PREFIX: z.string().default('batac_'),
  SEARCH_SYNC_BATCH_SIZE: positiveInt.default(100),
  SEARCH_SYNC_INTERVAL_MS: positiveInt.default(5000),
  SEARCH_SYNC_ON_STARTUP: booleanFromString.default('false'),

  // ─── SSE & Notifications ──────────────────────────────────────────────────
  SSE_HEARTBEAT_INTERVAL_MS: positiveInt.default(30000),
  SSE_CONNECTION_TIMEOUT_MS: positiveInt.default(3600000),
  SSE_MAX_CONNECTIONS_PER_USER: positiveInt.default(3),
  SSE_RETRY_MS: positiveInt.default(3000),
  NOTIF_RETENTION_DAYS: positiveInt.default(30),
  NOTIF_MAX_UNREAD_PER_USER: positiveInt.default(200),

  // ─── Sentry ───────────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: floatBetween0and1.default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: floatBetween0and1.default(0.0),

  // ─── Background Jobs ──────────────────────────────────────────────────────
  PGBOSS_SCHEMA: z.string().default('pgboss'),
  PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS: positiveInt.default(86400),
  PGBOSS_DELETE_AFTER_DAYS: positiveInt.default(7),
  JOB_WORKER_CONCURRENCY: positiveInt.default(5),
  JOB_RETRY_LIMIT: nonNegativeInt.default(3),
  JOB_RETRY_DELAY_S: nonNegativeInt.default(60),
  JOB_EXPIRY_SECONDS: positiveInt.default(3600),

  // ─── Cron Expressions ─────────────────────────────────────────────────────
  CRON_SLA_CHECK: z.string().default('*/15 * * * *'),
  CRON_MAYOR_LAPSE_CHECK: z.string().default('0 6 * * *'),
  CRON_PANLALAWIGAN_TIMER_CHECK: z.string().default('0 7 * * *'),
  CRON_SESSION_CLEANUP: z.string().default('0 3 * * *'),
  CRON_NOTIFICATION_CLEANUP: z.string().default('0 2 * * *'),
  CRON_AUDIT_EXPORT: z.string().default('0 1 1 * *'),
  CRON_DELEGATION_EXPIRY_CHECK: z.string().default('*/5 * * * *'),
  CRON_BACKUP_DATABASE: z.string().default('0 0 * * *'),
  CRON_ORDER_OF_BUSINESS_ALERT: z.string().default('0 9 * * 4'),

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  RATE_AUTH_MAX: positiveInt.default(10),
  RATE_AUTH_WINDOW_MS: positiveInt.default(900000),
  RATE_API_MAX: positiveInt.default(200),
  RATE_API_WINDOW_MS: positiveInt.default(60000),
  RATE_PORTAL_MAX: positiveInt.default(60),
  RATE_PORTAL_WINDOW_MS: positiveInt.default(60000),
  RATE_UPLOAD_MAX: positiveInt.default(20),
  RATE_UPLOAD_WINDOW_MS: positiveInt.default(60000),

  // ─── QR & Document Numbering ──────────────────────────────────────────────
  QR_BASE_URL: z.string().url(),
  QR_ERROR_CORRECTION_LEVEL: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  QR_MODULE_SIZE: positiveInt.default(4),
  QR_COVER_SHEETS_PER_PAGE: positiveInt.default(4),
  DOC_SP_ORDINAL: z.coerce.number().int().min(1).max(99),
  DOC_NUMBER_CITY_ID: z.string().uuid().optional(),
  DOC_TRACKING_NUMBER_PREFIX: z.string().default('DTS'),

  // ─── i18n ─────────────────────────────────────────────────────────────────
  I18N_DEFAULT_LOCALE: z.string().default('en'),
  I18N_SUPPORTED_LOCALES: z
    .string()
    .default('en,fil,ilo')
    .transform((s) => s.split(',').map((l) => l.trim())),
  I18N_FALLBACK_LOCALE: z.string().default('en'),

  // ─── Feature Flags ────────────────────────────────────────────────────────
  FEATURE_MFA_ENABLED: booleanFromString.default('false'),
  FEATURE_OCR_ENABLED: booleanFromString.default('true'),
  FEATURE_MEILISEARCH_ENABLED: booleanFromString.default('false'),
  FEATURE_CITIZEN_PORTAL_ENABLED: booleanFromString.default('false'),
  FEATURE_SMS_ENABLED: booleanFromString.default('false'),
  FEATURE_PHILSYS_ENABLED: booleanFromString.default('false'),
  FEATURE_RECORDS_MANAGEMENT_ENABLED: booleanFromString.default('false'),
  FEATURE_EMAIL_NOTIFICATIONS_ENABLED: booleanFromString.default('true'),
  FEATURE_SSE_ENABLED: booleanFromString.default('true'),

  // ─── Disaster Recovery ────────────────────────────────────────────────────
  DR_HOT_STANDBY_ENABLED: booleanFromString.default('false'),
  DR_HOT_STANDBY_URL: z.string().url().optional(),
  DR_MAX_REPLICATION_LAG_S: positiveInt.default(60),

  // ─── Backup ───────────────────────────────────────────────────────────────
  BACKUP_ENABLED: booleanFromString.default('false'),
  BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
  BACKUP_RETENTION_DAYS_HOT: positiveInt.default(30),
  BACKUP_RETENTION_DAYS_COLD: positiveInt.default(365),

  // ─── Portal (Phase 3) ─────────────────────────────────────────────────────
  PORTAL_URL: z.string().url().optional(),
  PORTAL_API_URL: z.string().url().optional(),
  PORTAL_CDN_URL: z.string().url().optional(),
  PORTAL_CITIZEN_OTP_EXPIRY_S: positiveInt.default(300),
  PORTAL_CITIZEN_OTP_LENGTH: positiveInt.default(6),
  PORTAL_CITIZEN_REVERIFY_DAYS: positiveInt.default(365),

  // ─── SMS (Phase 3) ────────────────────────────────────────────────────────
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().max(11).default('BATAC'),
}).superRefine((data, ctx) => {
  // Cross-field validation
  if (data.FEATURE_MEILISEARCH_ENABLED && !data.SEARCH_MEILISEARCH_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['SEARCH_MEILISEARCH_URL'],
      message: 'SEARCH_MEILISEARCH_URL is required when FEATURE_MEILISEARCH_ENABLED is true',
    });
  }
  if (data.AUDIT_TSA_ENABLED && !data.AUDIT_TSA_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUDIT_TSA_URL'],
      message: 'AUDIT_TSA_URL is required when AUDIT_TSA_ENABLED is true',
    });
  }
  if (data.BACKUP_ENABLED && !data.BACKUP_ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BACKUP_ENCRYPTION_KEY'],
      message: 'BACKUP_ENCRYPTION_KEY is required when BACKUP_ENABLED is true',
    });
  }
  if (data.DR_HOT_STANDBY_ENABLED && !data.DR_HOT_STANDBY_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DR_HOT_STANDBY_URL'],
      message: 'DR_HOT_STANDBY_URL is required when DR_HOT_STANDBY_ENABLED is true',
    });
  }
  if (data.AUTH_SESSION_WARNING_THRESHOLD_MS >= data.AUTH_SESSION_INACTIVITY_TIMEOUT_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AUTH_SESSION_WARNING_THRESHOLD_MS'],
      message: 'AUTH_SESSION_WARNING_THRESHOLD_MS must be less than AUTH_SESSION_INACTIVITY_TIMEOUT_MS',
    });
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
```

### 21.3 Startup Validation Entry Point

```typescript
// /apps/server/src/config/env.ts
import 'dotenv/config';
import { serverEnvSchema } from './env.server';

const result = serverEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n[FATAL] Environment variable validation failed at startup:');
  console.error(result.error.flatten().fieldErrors);
  console.error('\nThe application cannot start with an invalid configuration.');
  process.exit(1);
}

export const env = result.data;
```

### 21.4 Vite Client Schema (`env.client.ts`)

```typescript
// /apps/web/src/config/env.client.ts
import { z } from 'zod';

export const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().default('Batac City LGU'),
  VITE_API_URL: z.string().url(),
  VITE_APP_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_ENVIRONMENT: z.string().optional(),
});

export const clientEnv = clientEnvSchema.parse({
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
});
```

> **Note:** Vite exposes only variables prefixed `VITE_` to the browser bundle. Never prefix a secret with `VITE_`.

### 21.5 Next.js Portal Schema (`env.portal.ts`)

```typescript
// /apps/portal/src/config/env.portal.ts
import { z } from 'zod';

// Server-side only (SSR / ISR)
export const portalServerSchema = z.object({
  PORTAL_API_URL: z.string().url(),
  PORTAL_CITIZEN_OTP_EXPIRY_S: z.coerce.number().default(300),
});

// Client-side (NEXT_PUBLIC_ prefix required)
export const portalClientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('Batac City LGU'),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_PORTAL_URL: z.string().url(),
  NEXT_PUBLIC_QR_BASE_URL: z.string().url(),
});
```

---

## 22. Sample Environment Files

The following files serve as templates. They are committed to version control at the root of each package where applicable. Actual secrets are never committed.

### 22.1 `.env.example` (Root — Committed to Git)

```dotenv
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  Batac City LGU Platform — Environment Variable Template                 ║
# ║  Copy this file to .env and populate all required values.                ║
# ║  NEVER commit .env to version control.                                   ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# ─── Core ────────────────────────────────────────────────────────────────────
NODE_ENV=development
APP_ENV=development
APP_NAME=Batac City LGU Platform
APP_VERSION=0.0.0
APP_URL=http://localhost:5173
API_URL=http://localhost:3000
APP_PORT=3000
APP_HOST=0.0.0.0
LOG_LEVEL=debug
LOG_PRETTY=true
CORS_ALLOWED_ORIGINS=http://localhost:5173
CITY_ID=01930a7d-0000-0000-0000-000000000001
TRUST_PROXY=false

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL_APP=postgresql://app_user:changeme@localhost:5432/batac_lgu
DATABASE_URL_AUDIT=postgresql://audit_user:changeme@localhost:5432/batac_lgu
DATABASE_URL_MIGRATE=postgresql://migrate_user:changeme@localhost:5432/batac_lgu
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=false
DRIZZLE_VERBOSE=false

# ─── Authentication ───────────────────────────────────────────────────────────
AUTH_JWT_ACCESS_SECRET=REPLACE_WITH_32_BYTE_HEX_FROM_openssl_rand_-hex_32
AUTH_JWT_REFRESH_SECRET=REPLACE_WITH_32_BYTE_HEX_FROM_openssl_rand_-hex_32
AUTH_JWT_ACCESS_EXPIRES_IN=15m
AUTH_JWT_REFRESH_EXPIRES_IN=30d
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=Strict
AUTH_MFA_TOTP_ENABLED=false

# ─── Audit Log ────────────────────────────────────────────────────────────────
AUDIT_HMAC_SECRET=REPLACE_WITH_32_BYTE_HEX_FROM_openssl_rand_-hex_32
AUDIT_CHAIN_VERIFY_ON_READ=true
AUDIT_TSA_ENABLED=false
AUDIT_EXPORT_ENABLED=false

# ─── S3-Compatible Storage ────────────────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=batac-lgu-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# ─── SMTP ─────────────────────────────────────────────────────────────────────
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=noreply@batac.gov.ph
SMTP_PASSWORD=changeme
SMTP_FROM=noreply@batac.gov.ph
SMTP_REJECT_UNAUTHORIZED=false
SMTP_DEBUG=true

# ─── OCR ──────────────────────────────────────────────────────────────────────
OCR_ENGINE=tesseract
OCR_LANGUAGE_PACKS=eng+fil
OCR_WORKER_COUNT=2
FEATURE_OCR_ENABLED=true

# ─── Search ───────────────────────────────────────────────────────────────────
SEARCH_PROVIDER=postgres
FEATURE_MEILISEARCH_ENABLED=false

# ─── QR & Document Numbering ──────────────────────────────────────────────────
QR_BASE_URL=http://localhost:5174/track
DOC_SP_ORDINAL=7

# ─── i18n ─────────────────────────────────────────────────────────────────────
TZ=Asia/Manila
I18N_DEFAULT_LOCALE=en
I18N_SUPPORTED_LOCALES=en,fil,ilo

# ─── Feature Flags ────────────────────────────────────────────────────────────
FEATURE_EMAIL_NOTIFICATIONS_ENABLED=false
FEATURE_SSE_ENABLED=true
FEATURE_CITIZEN_PORTAL_ENABLED=false
FEATURE_SMS_ENABLED=false
FEATURE_RECORDS_MANAGEMENT_ENABLED=false

# ─── Error Monitoring ─────────────────────────────────────────────────────────
# SENTRY_DSN=  # Leave blank in development
```

### 22.2 `.env.development` (Local Override)

```dotenv
# Local development overrides. This file may be committed for team consistency
# but must not contain real secrets. Use .env.local for personal overrides.

NODE_ENV=development
APP_ENV=development
LOG_LEVEL=debug
LOG_PRETTY=true
AUTH_COOKIE_SECURE=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=false
SMTP_REJECT_UNAUTHORIZED=false
SMTP_DEBUG=true
S3_FORCE_PATH_STYLE=true
DRIZZLE_VERBOSE=false
FEATURE_EMAIL_NOTIFICATIONS_ENABLED=false
FEATURE_OCR_ENABLED=true
BACKUP_ENABLED=false
AUDIT_TSA_ENABLED=false
DR_HOT_STANDBY_ENABLED=false
```

### 22.3 `.env.staging` (Staging Environment)

```dotenv
# Staging environment — injected by CI/CD. Never committed with real values.

NODE_ENV=production
APP_ENV=staging
LOG_LEVEL=info
LOG_PRETTY=false
APP_URL=https://staging-dms.batac.gov.ph
API_URL=https://staging-api.batac.gov.ph
QR_BASE_URL=https://staging-portal.batac.gov.ph/track
CORS_ALLOWED_ORIGINS=https://staging-dms.batac.gov.ph

AUTH_COOKIE_SECURE=true
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
SMTP_REJECT_UNAUTHORIZED=true
S3_FORCE_PATH_STYLE=false
TRUST_PROXY=true

FEATURE_EMAIL_NOTIFICATIONS_ENABLED=true
FEATURE_SSE_ENABLED=true
FEATURE_OCR_ENABLED=true
FEATURE_MFA_ENABLED=false

BACKUP_ENABLED=false
AUDIT_TSA_ENABLED=false
DR_HOT_STANDBY_ENABLED=false

# All secrets are injected by the CI/CD pipeline or secrets vault.
# DATABASE_URL_APP, AUTH_JWT_ACCESS_SECRET, etc. are NOT in this file.
```

### 22.4 `.env.production` (Production Reference)

```dotenv
# Production reference. All secrets are managed through the secrets vault
# and injected at runtime. This file documents non-secret values only.

NODE_ENV=production
APP_ENV=production
LOG_LEVEL=info
LOG_PRETTY=false
APP_URL=https://dms.batac.gov.ph
API_URL=https://api.batac.gov.ph
QR_BASE_URL=https://portal.batac.gov.ph/track
CORS_ALLOWED_ORIGINS=https://dms.batac.gov.ph,https://portal.batac.gov.ph
DOC_SP_ORDINAL=7
CITY_ID=01930a7d-5c92-7e0f-bf5f-c8f0babc0001  # Seeded by Terraform
TZ=Asia/Manila
TRUST_PROXY=true

AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=Strict
AUTH_COOKIE_DOMAIN=.batac.gov.ph
AUTH_MFA_TOTP_ENABLED=false           # Phase 2: set to true

DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_POOL_MIN=5
DB_POOL_MAX=20
SMTP_REJECT_UNAUTHORIZED=true
SMTP_POOL=true
S3_FORCE_PATH_STYLE=false             # false for R2; true for MinIO
S3_REGION=auto
S3_UPLOAD_MAX_SIZE_MB=25

SEARCH_PROVIDER=postgres              # Phase 2: meilisearch
OCR_ENGINE=tesseract
OCR_WORKER_COUNT=4
OCR_LANGUAGE_PACKS=eng+fil

FEATURE_OCR_ENABLED=true
FEATURE_EMAIL_NOTIFICATIONS_ENABLED=true
FEATURE_SSE_ENABLED=true
FEATURE_MFA_ENABLED=false
FEATURE_MEILISEARCH_ENABLED=false
FEATURE_CITIZEN_PORTAL_ENABLED=false
FEATURE_RECORDS_MANAGEMENT_ENABLED=false

BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS_HOT=30
BACKUP_RETENTION_DAYS_COLD=365

AUDIT_CHAIN_VERIFY_ON_READ=true
AUDIT_EXPORT_ENABLED=false            # Enable once TSA is confirmed
AUDIT_TSA_ENABLED=false

DR_HOT_STANDBY_ENABLED=false         # Enable when standby is provisioned
DR_MAX_REPLICATION_LAG_S=60

SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.05

# ─── Injected by secrets vault at runtime ─────────────────────────────────────
# DATABASE_URL_APP
# DATABASE_URL_AUDIT
# DATABASE_URL_MIGRATE
# AUTH_JWT_ACCESS_SECRET
# AUTH_JWT_REFRESH_SECRET
# AUDIT_HMAC_SECRET
# BACKUP_ENCRYPTION_KEY
# S3_ACCESS_KEY
# S3_SECRET_KEY
# S3_BACKUP_ACCESS_KEY
# S3_BACKUP_SECRET_KEY
# SMTP_USER
# SMTP_PASSWORD
# SENTRY_DSN
```

---

## 23. Secret Management Strategy

### 23.1 Secret Classification

The following variables must **never** appear in source code, committed files, log output, or API responses:

`AUTH_JWT_ACCESS_SECRET`, `AUTH_JWT_REFRESH_SECRET`, `AUDIT_HMAC_SECRET`, `DATABASE_URL_APP`, `DATABASE_URL_AUDIT`, `DATABASE_URL_MIGRATE`, `DB_APP_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BACKUP_ACCESS_KEY`, `S3_BACKUP_SECRET_KEY`, `SMTP_PASSWORD`, `OCR_SERVICE_API_KEY`, `BACKUP_ENCRYPTION_KEY`, `SEARCH_MEILISEARCH_MASTER_KEY`, `DR_HOT_STANDBY_URL`, `AUDIT_TSA_URL`, `SMS_API_KEY`

### 23.2 Secret Sources by Environment

| Environment | Recommended Secret Source |
|---|---|
| **Development** | `.env.local` file (git-ignored). Weak placeholder values are acceptable. |
| **Staging** | CI/CD pipeline secrets (GitHub Actions secrets, GitLab CI variables). Injected as environment variables at container startup. |
| **Production (VPS)** | Docker Secrets (`/run/secrets/`) or a self-hosted HashiCorp Vault instance. Injected at container startup. LGU IT Office holds the Vault unseal keys. |
| **On-Premise** | HashiCorp Vault on-premise, or Docker Swarm secrets. The LGU IT Office holds all master credentials. Development team has zero access to production secrets. |

### 23.3 Docker Secrets Integration

In Docker Compose and Swarm, secrets are mounted as files at `/run/secrets/<name>`. The application reads secret files and populates the corresponding environment variables at startup:

```typescript
// /apps/server/src/config/load-docker-secrets.ts
import { readFileSync, existsSync } from 'fs';

const SECRET_MAPPING: Record<string, string> = {
  '/run/secrets/jwt_access_secret': 'AUTH_JWT_ACCESS_SECRET',
  '/run/secrets/jwt_refresh_secret': 'AUTH_JWT_REFRESH_SECRET',
  '/run/secrets/audit_hmac_secret': 'AUDIT_HMAC_SECRET',
  '/run/secrets/database_url_app': 'DATABASE_URL_APP',
  '/run/secrets/database_url_audit': 'DATABASE_URL_AUDIT',
  '/run/secrets/s3_access_key': 'S3_ACCESS_KEY',
  '/run/secrets/s3_secret_key': 'S3_SECRET_KEY',
  '/run/secrets/smtp_password': 'SMTP_PASSWORD',
  '/run/secrets/backup_encryption_key': 'BACKUP_ENCRYPTION_KEY',
};

export function loadDockerSecrets(): void {
  for (const [path, envVar] of Object.entries(SECRET_MAPPING)) {
    if (existsSync(path) && !process.env[envVar]) {
      process.env[envVar] = readFileSync(path, 'utf8').trim();
    }
  }
}

// Call before env.ts validation runs:
// loadDockerSecrets();
// import './config/env';
```

### 23.4 Secret Rotation Policy

| Secret | Rotation Frequency | Rotation Impact |
|---|---|---|
| `AUTH_JWT_ACCESS_SECRET` | 90 days, or immediately on suspected compromise | All active access tokens invalidated; users must re-authenticate |
| `AUTH_JWT_REFRESH_SECRET` | 180 days | All refresh tokens invalidated; users must re-login |
| `AUDIT_HMAC_SECRET` | Annually, with coordination | HMAC of old records becomes unverifiable without the old key. Archive old key with the old records' export before rotation. |
| `BACKUP_ENCRYPTION_KEY` | On IT Office personnel change | Re-encrypt all backup archives before rotation completes |
| `S3_ACCESS_KEY / S3_SECRET_KEY` | 90 days | Minimal impact; rotate in Cloudflare/MinIO first, then update env |
| `SMTP_PASSWORD` | Per LGU IT mail server policy | Minimal impact |
| Database role passwords | 180 days | Coordinate with LGU IT; update connection strings simultaneously |

### 23.5 Emergency Break-Glass Procedure

The architecture decision mandates: "Emergency break-glass: Physical sealed envelope in LGU IT Office safe; logged on opening."

The sealed envelope must contain:
- Production PostgreSQL superuser credentials (for recovery only)
- The Vault unseal keys (if HashiCorp Vault is used)
- The backup S3 credentials
- Instructions for the DR failover procedure

Every opening of the sealed envelope must be audit-logged with date, opener identity, and reason.

---

## 24. Master Variable Catalog

The following table is the complete catalog of all environment variables defined in this document.

| Variable | Category | Secret | Required | Default | Phase | Environment Scope |
|---|---|---|---|---|---|---|
| `NODE_ENV` | Core | No | Yes | — | 1 | All |
| `APP_ENV` | Core | No | Yes | — | 1 | All |
| `APP_NAME` | Core | No | No | `Batac City LGU Platform` | 1 | All |
| `APP_VERSION` | Core | No | No | `0.0.0` | 1 | All |
| `APP_URL` | Core | No | Yes | — | 1 | All |
| `API_URL` | Core | No | Yes | — | 1 | All |
| `APP_PORT` | Core | No | No | `3000` | 1 | All |
| `APP_HOST` | Core | No | No | `0.0.0.0` | 1 | All |
| `LOG_LEVEL` | Logging | No | No | `info` | 1 | All |
| `LOG_PRETTY` | Logging | No | No | `false` | 1 | Dev only |
| `LOG_REDACT_PATHS` | Logging | No | No | (see §13) | 1 | All |
| `LOG_DESTINATION` | Logging | No | No | `stdout` | 1 | All |
| `CORS_ALLOWED_ORIGINS` | Core | No | Yes | — | 1 | All |
| `CITY_ID` | Core | No | Yes | — | 1 | All |
| `TRUST_PROXY` | Core | No | No | `false` | 1 | All |
| `APP_INSTANCE_ID` | Core | No | No | (auto) | 1 | All |
| `HEALTH_CHECK_PATH` | Core | No | No | `/health` | 1 | All |
| `DATABASE_URL_APP` | Database | Yes | Yes | — | 1 | All |
| `DATABASE_URL_AUDIT` | Database | Yes | Yes | — | 1 | All |
| `DATABASE_URL_MIGRATE` | Database | Yes | Migrations | — | 1 | All |
| `DB_HOST` | Database | No | No | `localhost` | 1 | All |
| `DB_PORT` | Database | No | No | `5432` | 1 | All |
| `DB_NAME` | Database | No | No | `batac_lgu` | 1 | All |
| `DB_APP_USER` | Database | No | No | `app_user` | 1 | All |
| `DB_APP_PASSWORD` | Database | Yes | No | — | 1 | All |
| `DB_SSL` | Database | No | No | `true` | 1 | All |
| `DB_SSL_REJECT_UNAUTHORIZED` | Database | No | No | `true` | 1 | All |
| `DB_POOL_MIN` | Database | No | No | `2` | 1 | All |
| `DB_POOL_MAX` | Database | No | No | `10` | 1 | All |
| `DB_POOL_IDLE_TIMEOUT_MS` | Database | No | No | `30000` | 1 | All |
| `DB_POOL_ACQUIRE_TIMEOUT_MS` | Database | No | No | `10000` | 1 | All |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | Database | No | No | `5000` | 1 | All |
| `DB_STATEMENT_TIMEOUT_MS` | Database | No | No | `30000` | 1 | All |
| `DRIZZLE_VERBOSE` | Database | No | No | `false` | 1 | Dev only |
| `DRIZZLE_LOGGER` | Database | No | No | `false` | 1 | Dev only |
| `DATABASE_URL_READ_REPLICA` | Database | Yes | No | — | 2 | Prod/Staging |
| `AUTH_JWT_ACCESS_SECRET` | Auth | Yes | Yes | — | 1 | All |
| `AUTH_JWT_REFRESH_SECRET` | Auth | Yes | Yes | — | 1 | All |
| `AUTH_JWT_ACCESS_EXPIRES_IN` | Auth | No | No | `15m` | 1 | All |
| `AUTH_JWT_REFRESH_EXPIRES_IN` | Auth | No | No | `30d` | 1 | All |
| `AUTH_JWT_ALGORITHM` | Auth | No | No | `HS256` | 1 | All |
| `AUTH_COOKIE_SECURE` | Auth | No | No | `true` | 1 | All |
| `AUTH_COOKIE_SAMESITE` | Auth | No | No | `Strict` | 1 | All |
| `AUTH_COOKIE_DOMAIN` | Auth | No | No | — | 1 | Prod/Staging |
| `AUTH_COOKIE_PATH` | Auth | No | No | `/` | 1 | All |
| `AUTH_ACCESS_TOKEN_COOKIE_NAME` | Auth | No | No | `__Host-bat_at` | 1 | All |
| `AUTH_REFRESH_TOKEN_COOKIE_NAME` | Auth | No | No | `__Host-bat_rt` | 1 | All |
| `AUTH_SESSION_INACTIVITY_TIMEOUT_MS` | Auth | No | No | `1800000` | 1 | All |
| `AUTH_SESSION_WARNING_THRESHOLD_MS` | Auth | No | No | `1500000` | 1 | All |
| `AUTH_MAX_CONCURRENT_SESSIONS` | Auth | No | No | `1` | 1 | All |
| `AUTH_MFA_TOTP_ENABLED` | Auth | No | No | `false` | 1 | All |
| `AUTH_MFA_TOTP_ISSUER` | Auth | No | No | `Batac City LGU` | 1 | All |
| `AUTH_MFA_TOTP_WINDOW` | Auth | No | No | `1` | 1 | All |
| `ARGON2_MEMORY_COST` | Auth | No | No | `65536` | 1 | All |
| `ARGON2_TIME_COST` | Auth | No | No | `2` | 1 | All |
| `ARGON2_PARALLELISM` | Auth | No | No | `1` | 1 | All |
| `ARGON2_HASH_LENGTH` | Auth | No | No | `32` | 1 | All |
| `AUDIT_HMAC_SECRET` | Audit | Yes | Yes | — | 1 | All |
| `AUDIT_GENESIS_HASH` | Audit | No | No | `0000...` | 1 | All |
| `AUDIT_CHAIN_VERIFY_ON_READ` | Audit | No | No | `true` | 1 | All |
| `AUDIT_RETENTION_DAYS` | Audit | No | No | `3650` | 1 | All |
| `AUDIT_TSA_ENABLED` | Audit | No | No | `false` | 1 | Prod |
| `AUDIT_TSA_URL` | Audit | Yes | Conditional | — | 1 | Prod |
| `AUDIT_EXPORT_ENABLED` | Audit | No | No | `false` | 1 | All |
| `AUDIT_EXPORT_DESTINATION` | Audit | No | No | `s3` | 1 | All |
| `S3_ENDPOINT` | Storage | No | Yes | — | 1 | All |
| `S3_BUCKET` | Storage | No | Yes | — | 1 | All |
| `S3_ACCESS_KEY` | Storage | Yes | Yes | — | 1 | All |
| `S3_SECRET_KEY` | Storage | Yes | Yes | — | 1 | All |
| `S3_REGION` | Storage | No | No | `auto` | 1 | All |
| `S3_FORCE_PATH_STYLE` | Storage | No | No | `false` | 1 | All |
| `S3_UPLOAD_MAX_SIZE_MB` | Storage | No | No | `25` | 1 | All |
| `S3_SIGNED_URL_EXPIRES_S` | Storage | No | No | `300` | 1 | All |
| `S3_UPLOAD_PRESIGN_EXPIRES_S` | Storage | No | No | `600` | 1 | All |
| `S3_ALLOWED_MIME_TYPES` | Storage | No | No | (see §8) | 1 | All |
| `S3_BACKUP_BUCKET` | Storage | No | No | — | 1 | Prod |
| `S3_BACKUP_ACCESS_KEY` | Storage | Yes | No | — | 1 | Prod |
| `S3_BACKUP_SECRET_KEY` | Storage | Yes | No | — | 1 | Prod |
| `S3_BACKUP_ENDPOINT` | Storage | No | No | — | 1 | Prod |
| `SMTP_HOST` | Email | No | Yes | — | 1 | All |
| `SMTP_PORT` | Email | No | No | `587` | 1 | All |
| `SMTP_SECURE` | Email | No | No | `false` | 1 | All |
| `SMTP_USER` | Email | No | Yes | — | 1 | All |
| `SMTP_PASSWORD` | Email | Yes | Yes | — | 1 | All |
| `SMTP_FROM` | Email | No | Yes | — | 1 | All |
| `SMTP_FROM_NAME` | Email | No | No | `Batac City LGU` | 1 | All |
| `SMTP_REJECT_UNAUTHORIZED` | Email | No | No | `true` | 1 | All |
| `SMTP_POOL` | Email | No | No | `true` | 1 | All |
| `SMTP_MAX_CONNECTIONS` | Email | No | No | `5` | 1 | All |
| `SMTP_MAX_MESSAGES` | Email | No | No | `100` | 1 | All |
| `SMTP_DEBUG` | Email | No | No | `false` | 1 | Dev only |
| `OCR_ENGINE` | OCR | No | No | `tesseract` | 1 | All |
| `OCR_SERVICE_URL` | OCR | No | Conditional | — | 1 | All |
| `OCR_SERVICE_API_KEY` | OCR | Yes | Conditional | — | 1 | All |
| `OCR_LANGUAGE_PACKS` | OCR | No | No | `eng+fil` | 1 | All |
| `OCR_WORKER_COUNT` | OCR | No | No | `2` | 1 | All |
| `OCR_TIMEOUT_MS` | OCR | No | No | `60000` | 1 | All |
| `OCR_MAX_FILE_SIZE_MB` | OCR | No | No | `25` | 1 | All |
| `OCR_QUALITY_THRESHOLD` | OCR | No | No | `0.6` | 1 | All |
| `OCR_QUEUE_CONCURRENCY` | OCR | No | No | `3` | 1 | All |
| `OCR_MIGRATION_ENABLED` | OCR | No | No | `false` | 1 | All |
| `OCR_MIGRATION_BATCH_SIZE` | OCR | No | No | `50` | 1 | All |
| `SEARCH_PROVIDER` | Search | No | No | `postgres` | 1 | All |
| `SEARCH_FTS_LANGUAGE` | Search | No | No | `english` | 1 | All |
| `SEARCH_MEILISEARCH_URL` | Search | No | Phase 2+ | — | 2 | All |
| `SEARCH_MEILISEARCH_MASTER_KEY` | Search | Yes | Phase 2+ | — | 2 | All |
| `SEARCH_MEILISEARCH_INDEX_PREFIX` | Search | No | No | `batac_` | 2 | All |
| `SEARCH_SYNC_BATCH_SIZE` | Search | No | No | `100` | 2 | All |
| `SEARCH_SYNC_INTERVAL_MS` | Search | No | No | `5000` | 2 | All |
| `SEARCH_SYNC_ON_STARTUP` | Search | No | No | `false` | 2 | All |
| `SSE_HEARTBEAT_INTERVAL_MS` | Notifications | No | No | `30000` | 1 | All |
| `SSE_CONNECTION_TIMEOUT_MS` | Notifications | No | No | `3600000` | 1 | All |
| `SSE_MAX_CONNECTIONS_PER_USER` | Notifications | No | No | `3` | 1 | All |
| `SSE_RETRY_MS` | Notifications | No | No | `3000` | 1 | All |
| `NOTIF_RETENTION_DAYS` | Notifications | No | No | `30` | 1 | All |
| `NOTIF_MAX_UNREAD_PER_USER` | Notifications | No | No | `200` | 1 | All |
| `SENTRY_DSN` | Observability | No | Prod | — | 1 | Prod/Staging |
| `SENTRY_ENVIRONMENT` | Observability | No | No | (APP_ENV) | 1 | All |
| `SENTRY_RELEASE` | Observability | No | No | (APP_VERSION) | 1 | All |
| `SENTRY_TRACES_SAMPLE_RATE` | Observability | No | No | `0.1` | 1 | All |
| `SENTRY_PROFILES_SAMPLE_RATE` | Observability | No | No | `0.0` | 1 | All |
| `PORTAL_URL` | Portal | No | Phase 3 | — | 3 | All |
| `PORTAL_API_URL` | Portal | No | Phase 3 | — | 3 | All |
| `PORTAL_CDN_URL` | Portal | No | No | — | 3 | Prod |
| `NEXT_PUBLIC_APP_NAME` | Portal | No | Phase 3 | `Batac City LGU` | 3 | All |
| `NEXT_PUBLIC_API_URL` | Portal | No | Phase 3 | — | 3 | All |
| `NEXT_PUBLIC_PORTAL_URL` | Portal | No | Phase 3 | — | 3 | All |
| `NEXT_PUBLIC_QR_BASE_URL` | Portal | No | Phase 3 | — | 3 | All |
| `PORTAL_CITIZEN_OTP_EXPIRY_S` | Portal | No | No | `300` | 3 | All |
| `PORTAL_CITIZEN_OTP_LENGTH` | Portal | No | No | `6` | 3 | All |
| `PORTAL_CITIZEN_REVERIFY_DAYS` | Portal | No | No | `365` | 3 | All |
| `PGBOSS_SCHEMA` | Jobs | No | No | `pgboss` | 1 | All |
| `PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS` | Jobs | No | No | `86400` | 1 | All |
| `PGBOSS_DELETE_AFTER_DAYS` | Jobs | No | No | `7` | 1 | All |
| `JOB_WORKER_CONCURRENCY` | Jobs | No | No | `5` | 1 | All |
| `JOB_RETRY_LIMIT` | Jobs | No | No | `3` | 1 | All |
| `JOB_RETRY_DELAY_S` | Jobs | No | No | `60` | 1 | All |
| `JOB_EXPIRY_SECONDS` | Jobs | No | No | `3600` | 1 | All |
| `CRON_SLA_CHECK` | Jobs | No | No | `*/15 * * * *` | 1 | All |
| `CRON_MAYOR_LAPSE_CHECK` | Jobs | No | No | `0 6 * * *` | 1 | All |
| `CRON_PANLALAWIGAN_TIMER_CHECK` | Jobs | No | No | `0 7 * * *` | 1 | All |
| `CRON_SESSION_CLEANUP` | Jobs | No | No | `0 3 * * *` | 1 | All |
| `CRON_NOTIFICATION_CLEANUP` | Jobs | No | No | `0 2 * * *` | 1 | All |
| `CRON_AUDIT_EXPORT` | Jobs | No | No | `0 1 1 * *` | 1 | All |
| `CRON_DELEGATION_EXPIRY_CHECK` | Jobs | No | No | `*/5 * * * *` | 1 | All |
| `CRON_BACKUP_DATABASE` | Jobs | No | No | `0 0 * * *` | 1 | Prod |
| `CRON_ORDER_OF_BUSINESS_ALERT` | Jobs | No | No | `0 9 * * 4` | 1 | All |
| `RATE_AUTH_MAX` | Rate Limit | No | No | `10` | 1 | All |
| `RATE_AUTH_WINDOW_MS` | Rate Limit | No | No | `900000` | 1 | All |
| `RATE_API_MAX` | Rate Limit | No | No | `200` | 1 | All |
| `RATE_API_WINDOW_MS` | Rate Limit | No | No | `60000` | 1 | All |
| `RATE_PORTAL_MAX` | Rate Limit | No | No | `60` | 1 | All |
| `RATE_PORTAL_WINDOW_MS` | Rate Limit | No | No | `60000` | 1 | All |
| `RATE_UPLOAD_MAX` | Rate Limit | No | No | `20` | 1 | All |
| `RATE_UPLOAD_WINDOW_MS` | Rate Limit | No | No | `60000` | 1 | All |
| `QR_BASE_URL` | Documents | No | Yes | — | 1 | All |
| `QR_ERROR_CORRECTION_LEVEL` | Documents | No | No | `M` | 1 | All |
| `QR_MODULE_SIZE` | Documents | No | No | `4` | 1 | All |
| `QR_COVER_SHEETS_PER_PAGE` | Documents | No | No | `4` | 1 | All |
| `DOC_SP_ORDINAL` | Documents | No | Yes | — | 1 | All |
| `DOC_NUMBER_CITY_ID` | Documents | No | No | (CITY_ID) | 1 | All |
| `DOC_TRACKING_NUMBER_PREFIX` | Documents | No | No | `DTS` | 1 | All |
| `TZ` | i18n | No | Yes | `Asia/Manila` | 1 | All |
| `I18N_DEFAULT_LOCALE` | i18n | No | No | `en` | 1 | All |
| `I18N_SUPPORTED_LOCALES` | i18n | No | No | `en,fil,ilo` | 1 | All |
| `I18N_FALLBACK_LOCALE` | i18n | No | No | `en` | 1 | All |
| `FEATURE_MFA_ENABLED` | Features | No | No | `false` | 1 | All |
| `FEATURE_OCR_ENABLED` | Features | No | No | `true` | 1 | All |
| `FEATURE_MEILISEARCH_ENABLED` | Features | No | No | `false` | 2 | All |
| `FEATURE_CITIZEN_PORTAL_ENABLED` | Features | No | No | `false` | 3 | All |
| `FEATURE_SMS_ENABLED` | Features | No | No | `false` | 3 | All |
| `FEATURE_PHILSYS_ENABLED` | Features | No | No | `false` | 3+ | All |
| `FEATURE_RECORDS_MANAGEMENT_ENABLED` | Features | No | No | `false` | 2 | All |
| `FEATURE_EMAIL_NOTIFICATIONS_ENABLED` | Features | No | No | `true` | 1 | All |
| `FEATURE_SSE_ENABLED` | Features | No | No | `true` | 1 | All |
| `BACKUP_ENABLED` | Infra | No | Prod | `false` | 1 | Prod |
| `BACKUP_ENCRYPTION_KEY` | Infra | Yes | Conditional | — | 1 | Prod |
| `BACKUP_RETENTION_DAYS_HOT` | Infra | No | No | `30` | 1 | Prod |
| `BACKUP_RETENTION_DAYS_COLD` | Infra | No | No | `365` | 1 | Prod |
| `DR_HOT_STANDBY_ENABLED` | Infra | No | No | `false` | 1 | Prod |
| `DR_HOT_STANDBY_URL` | Infra | Yes | Conditional | — | 1 | Prod |
| `DR_MAX_REPLICATION_LAG_S` | Infra | No | No | `60` | 1 | Prod |
| `SMS_PROVIDER` | SMS | No | Phase 3 | — | 3 | All |
| `SMS_API_KEY` | SMS | Yes | Phase 3 | — | 3 | All |
| `SMS_SENDER_ID` | SMS | No | No | `BATAC` | 3 | All |
| `VITE_APP_NAME` | Client | No | No | `Batac City LGU` | 1 | All |
| `VITE_API_URL` | Client | No | Yes | — | 1 | All |
| `VITE_APP_URL` | Client | No | Yes | — | 1 | All |
| `VITE_SENTRY_DSN` | Client | No | Prod | — | 1 | Prod/Staging |
| `VITE_SENTRY_ENVIRONMENT` | Client | No | No | — | 1 | All |

---

*This document is the authoritative configuration reference for the Batac City LGU Platform. All environment variable additions, removals, or changes must be reflected here before the corresponding code is merged to the main branch. The Zod schema in Section 21 is the machine-readable complement to this catalog — both must be kept in sync.*
