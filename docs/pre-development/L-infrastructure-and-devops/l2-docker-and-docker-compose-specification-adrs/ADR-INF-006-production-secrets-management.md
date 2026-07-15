# ADR-L2-06 — Production Secrets Management

**Status:** Decided (Phase 1 scope)  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-06  
**Author:** Architecture review

---

## Context

L1 classifies several variables as `SEC` (secret) — values that must not appear in committed files, logs, or image layers. These include database credentials, JWT signing keys, S3 access keys, the backup encryption key, and SMTP credentials.

L2 Part 9 documents the existing injection hierarchy:

- `.env.production` (not committed) passed via `env_file:` in `compose.prod.yml`
- Docker Secrets (`secrets:` in compose) as an alternative file-based injection path
- A secrets manager (Vault, Infisical, or equivalent) is noted as recommended for production rotation without container restarts — but was unconfirmed at document time

The open decision asks for a confirmed approach before first production deployment.

---

## Decision

**Phase 1: Docker Compose secrets + `.env.production` file managed by the LGU IT Office. No external secrets manager.**

Rotation of `SEC`-classified variables in Phase 1 requires a container restart. This is accepted as a known constraint for this phase.

Rationale:

1. **On-premise deployment target rules out hosted secrets managers.** Infisical Cloud and HashiCorp Vault Cloud are not viable — on-premise has no guaranteed internet. Self-hosted Vault or Infisical are viable in principle but add operational complexity (HA, unsealing, backup, upgrades) before the system has launched.

2. **Rotation frequency is low in Phase 1.** The secrets that require rotation are DB credentials (rotated on personnel change or suspected compromise), JWT keys (rotated on security incidents), S3 keys (rotated on key compromise), and the backup encryption key (rarely). None of these are rotated on a routine daily/weekly schedule. A container restart to rotate is a bounded, low-risk operation: the Fastify container starts in seconds, pgboss workers resume from the PostgreSQL job queue, and no data is at risk.

3. **Docker secrets provide the correct security boundary for file-based secrets.** TLS certs (ADR-L2-05), and any other file-format secrets, are mounted via Docker `secrets:` and are never in environment variables or image layers. String-format secrets (`DATABASE_URL_APP`, `AUTH_JWT_ACCESS_SECRET`, etc.) travel via `.env.production` injected through `env_file:`.

4. **Adding a secrets manager is a Phase 2 infrastructure decision.** It should be evaluated alongside other Phase 2 additions (Meilisearch) when the operational team has experience with the running system and can assess whether rotation frequency justifies the overhead.

---

## Implementation

### `.env.production` handling

- File is never committed to version control.
- File is written by the LGU IT Office on the production host, owned by `root`, permissions `600`.
- Location: `/etc/batac/.env.production` (or equivalent host path outside the repo directory).
- Passed to the Fastify container via `env_file:` in `compose.prod.yml`.

### Docker secrets (file-format secrets only)

File-format secrets (TLS cert and key — see ADR-L2-05) use `secrets:` in `compose.prod.yml`. String-format secrets remain in `.env.production`.

```yaml
# compose.prod.yml — secrets section
secrets:
  tls_cert:
    file: /etc/batac/tls/fullchain.pem
  tls_key:
    file: /etc/batac/tls/privkey.pem
```

No application code changes are required to support Docker secrets for file-format values — Nginx reads them from the mounted path directly.

### Rotation procedure (Phase 1)

For any `SEC`-classified variable requiring rotation:

```bash
# 1. Update the value in /etc/batac/.env.production on the production host
# 2. Restart the Fastify container — brief interruption, no data loss
docker compose -f compose.prod.yml up -d --force-recreate server
# 3. Verify the application starts and passes health check
docker compose -f compose.prod.yml ps
curl -f https://${APP_DOMAIN}/health
```

For TLS cert rotation, `nginx -s reload` is used instead — no container restart required (documented in ADR-L2-05).

### IT Office responsibilities

- Generating and storing `.env.production` securely (offline encrypted backup held by IT Office).
- Controlling host filesystem access to `/etc/batac/`.
- Performing rotation on instruction from the development team.
- Maintaining an operations log of rotation events (date, which secret, who performed it).

---

## Consequences

### Status update in L2 Part 13

L2-06 moves from `Not confirmed [Inference]` to `Resolved (Phase 1) — Docker secrets + .env.production; external secrets manager deferred to Phase 2`.

### Phase 2 re-evaluation trigger

Revisit this decision at Phase 2 planning if any of the following are true:

- Secret rotation frequency increases (e.g., short-lived DB credentials become a requirement)
- The LGU security posture requires an audit trail of secret access events
- The deployment environment gains reliable internet access, making a hosted or self-hosted secrets manager operationally viable

### Risk: `.env.production` file security

The `.env.production` file on the production host is a single point of compromise for all string-format secrets. Mitigations within Phase 1 scope:

- File permissions: `root:root 600`
- Host access restricted to IT Office personnel
- File backed up in encrypted offline storage (not in the same infrastructure)
- No logging of environment variable values at container start (confirm `pino` redaction covers `SEC` fields per L1 §19)

---

## Rejected alternatives

**HashiCorp Vault (self-hosted)** was rejected for Phase 1. Vault requires its own HA setup, unsealing ceremony, backup, and operational runbook. This is disproportionate overhead for a system that has not yet launched.

**Infisical (self-hosted)** was rejected for the same reason. Infisical is lighter than Vault but still requires a running container, a database, and an operational backup path — all before the primary application is in production.
