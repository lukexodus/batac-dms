# ADR-INF-005 (formerly ADR-L2-05) — TLS Certificate Provisioning

`[Corrected — this file's own title previously said only "ADR-L2-05," a local per-document
numbering scheme predating the project-wide reorganization into the current domain-prefixed
ADR scheme. The filename and ADR Master Index (J5) both use ADR-INF-005. Same pattern found across
this entire L2 cluster and the D3 cluster (see ADR-WFL-003's title note) — evidently
project-wide, not confined to one document. "ADR-L2-05" is preserved as a parenthetical alias.]`

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-05  
**Author:** Architecture review

---

## Context

`nginx/batac.conf` assumes Let's Encrypt via Certbot:

```nginx
ssl_certificate     /etc/letsencrypt/live/dms.batac.gov.ph/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/dms.batac.gov.ph/privkey.pem;
```

The certificate renewal automation method was not specified. Phase 1 must support both a cloud VPS deployment and an on-premise City Hall deployment with no guaranteed internet access.

Let's Encrypt's ACME protocol requires outbound internet access for certificate issuance and renewal (HTTP-01 or DNS-01 challenge). This is incompatible with the on-premise deployment constraint.

---

## Decision

**Pre-provisioned TLS certificate mounted as a Docker secret, with a formal renewal runbook.**

The LGU IT Office obtains a certificate from a trusted CA (commercial or government-issued). The certificate and private key are mounted into the Nginx container at fixed paths. Renewal is a documented manual operation performed by the IT Office on a defined schedule.

Rationale:

1. **On-premise constraint is the deciding factor.** ACME-based automation (Certbot, Caddy auto-TLS) requires outbound HTTP or DNS access to a Let's Encrypt or other ACME CA endpoint. City Hall on-premise has no guaranteed internet. A method that fails in one of the two mandatory deployment targets is not viable.

2. **LGU IT Office already holds a government domain.** The `batac.gov.ph` domain implies an existing relationship with a CA (likely PhilSys or a government-contracted CA, or a commercial CA). The IT Office can procure and renew a certificate through existing channels.

3. **Docker secrets provide the correct injection path.** The cert file and key file are mounted read-only into the Nginx container without appearing in environment variables or image layers. This is the correct handling for TLS private keys.

4. **Manual renewal is acceptable at Phase 1 scope.** The system serves internal city government staff and a citizen portal — not a high-traffic consumer service. A 1-year certificate with a 60-day advance renewal reminder is operationally manageable.

---

## Implementation

### Certificate mount paths

The Nginx config is updated (consistent with ADR-L2-04) to use fixed cert paths decoupled from the domain name:

```nginx
ssl_certificate     /etc/nginx/certs/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/privkey.pem;
```

### Docker secrets definition in `compose.prod.yml`

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    secrets:
      - tls_cert
      - tls_key
    volumes:
      - /run/secrets/tls_cert:/etc/nginx/certs/fullchain.pem:ro
      - /run/secrets/tls_key:/etc/nginx/certs/privkey.pem:ro
    # ... rest of service definition

secrets:
  tls_cert:
    file: /etc/batac/tls/fullchain.pem   # path on Docker host — managed by IT Office
  tls_key:
    file: /etc/batac/tls/privkey.pem     # path on Docker host — managed by IT Office
```

The host paths (`/etc/batac/tls/`) are not committed to version control. The IT Office places cert files there as part of the deployment runbook. The directory is owned by `root` with `600` permissions on the key file.

### Renewal runbook (to be documented separately)

The following steps must be included in the deployment operations runbook:

1. **Reminder:** Set a calendar alert at **60 days before certificate expiry**.
2. **Procurement:** Request a renewed certificate from the CA using the existing domain verification method.
3. **Staging test:** Replace the cert on the staging deployment first. Verify HTTPS, check cert validity in browser.
4. **Production rotation:**
   - Copy `fullchain.pem` and `privkey.pem` to `/etc/batac/tls/` on the production host.
   - Reload Nginx without a full container restart: `docker compose exec nginx nginx -s reload`
   - Verify the new cert is live: `openssl s_client -connect ${APP_DOMAIN}:443 -showcerts < /dev/null 2>/dev/null | openssl x509 -noout -dates`
5. **Confirmation:** Log the renewal date and next-expiry date in the IT Office operations log.

> **Note:** `nginx -s reload` causes Nginx to re-read configuration and cert files without dropping active connections. No downtime is required for renewal if the cert files are replaced before the reload signal.

### Nginx config cleanup

Remove the Certbot ACME challenge location block from `batac.conf.template` — it is no longer needed:

```nginx
# REMOVE this block — Certbot is not used
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

The HTTP-to-HTTPS redirect block (`listen 80; return 301 https://...`) is retained.

---

## Consequences

### Status update in L2 Part 13

L2-05 moves from `Not specified` to `Resolved — pre-provisioned cert via Docker secrets, manual renewal with runbook`.

### Forward path to automation

If the system migrates fully to a cloud VPS with guaranteed internet access, automatic renewal via Certbot (DNS-01 challenge) or Caddy can be introduced. DNS-01 challenge is preferable to HTTP-01 if the DNS provider offers an API, as it works without exposing port 80. This migration requires only changes to `compose.prod.yml` and the Nginx config — no application code changes.

### Risk: missed renewal

Manual renewal is an operational risk. Mitigations:

- 60-day advance calendar reminder (doubles the window — Let's Encrypt issues 90-day certs; commercial CAs typically 1 year)
- `nginx -s reload` for zero-downtime rotation
- Certificate expiry monitoring should be added to the deployment runbook (e.g., a cron job on the host: `openssl s_client ... | openssl x509 -noout -enddate`)

---

## Rejected alternatives

**Certbot sidecar container** was rejected because Let's Encrypt ACME requires outbound internet, which is not guaranteed in the on-premise City Hall deployment.

**Caddy (replace Nginx)** was rejected for the same reason — Caddy's auto-TLS uses ACME and has the identical on-premise constraint. Caddy is a valid long-term direction if the project moves to a cloud-only deployment.