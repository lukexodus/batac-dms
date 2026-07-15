# ADR-L2-04 — Nginx Domain Name Injection

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-04  
**Author:** Architecture review

---

## Context

`nginx/batac.conf` currently hardcodes the domain name `dms.batac.gov.ph` in two locations:

```nginx
server_name dms.batac.gov.ph;
ssl_certificate     /etc/letsencrypt/live/dms.batac.gov.ph/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/dms.batac.gov.ph/privkey.pem;
```

Nginx does not natively support environment variable substitution in configuration files. The current config contains an `[Inference]`-labeled comment acknowledging this and listing the two standard workarounds: `envsubst` in a Docker entrypoint, or per-environment config files.

Phase 1 must support multiple deployment targets (cloud VPS, City Hall on-premise) which may use different domain names. The TLS cert paths are also domain-dependent and must be injected consistently.

---

## Decision

**Use `envsubst` in a custom Nginx Docker entrypoint to inject the domain name at container start.**

`nginx/batac.conf` becomes a template (`nginx/batac.conf.template`). Variable references replace hardcoded values:

```nginx
server_name ${APP_DOMAIN};
ssl_certificate     /etc/nginx/certs/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/privkey.pem;
```

> **Note on cert paths:** TLS cert paths are decoupled from the domain name by mounting certs to fixed paths (`/etc/nginx/certs/`). This is addressed in ADR-L2-05. Only `${APP_DOMAIN}` requires substitution in the config template.

A custom entrypoint script runs `envsubst` on the template and writes the result to `/etc/nginx/conf.d/batac.conf` before starting Nginx:

```sh
#!/bin/sh
set -e
envsubst '${APP_DOMAIN}' < /etc/nginx/templates/batac.conf.template \
  > /etc/nginx/conf.d/batac.conf
exec nginx -g 'daemon off;'
```

The `APP_DOMAIN` variable is defined in `.env.production` (or `.env.staging`) and injected into the Nginx container via `env_file:` or `environment:` in `compose.prod.yml`.

Rationale:

1. **Single config file, multiple environments.** One template in the repo serves all deployment targets. The domain name is a deploy-time concern and belongs in the environment, not in version-controlled config files.

2. **No CI pipeline dependency.** CI-time substitution would require the CI runner to know the target domain at build time and bake it into the image. This couples image builds to deployment targets and prevents a single image from being deployed to staging, then production without a rebuild.

3. **Per-environment config files were rejected** because they diverge over time. When the Nginx config changes (e.g., adding a new `location` block), all per-environment files must be updated in sync. A template with one substitution is lower maintenance.

4. **`envsubst` is available in `nginx:alpine`.** The official `nginx:alpine` image ships `envsubst` as part of `gettext`. No additional `apk add` is required. The official image's default entrypoint already supports `.conf.template` files in `/etc/nginx/templates/` — this pattern mirrors that behavior explicitly rather than relying on the implicit version.

---

## Implementation

### File rename

```
nginx/batac.conf  →  nginx/batac.conf.template
```

### Template substitutions

Replace hardcoded domain occurrences with `${APP_DOMAIN}`:

```nginx
# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────
server {
    listen 80;
    server_name _;
    # ... (no domain substitution needed here — catch-all)
}

# ── HTTPS main server ─────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name ${APP_DOMAIN};

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    # ... rest of config unchanged
}
```

### Custom Nginx entrypoint

Create `nginx/entrypoint.sh`:

```sh
#!/bin/sh
set -e
# Substitute only APP_DOMAIN — guard other $ references in the nginx config
# from accidental expansion by quoting the variable list.
envsubst '${APP_DOMAIN}' < /etc/nginx/templates/batac.conf.template \
  > /etc/nginx/conf.d/batac.conf
exec nginx -g 'daemon off;'
```

> **Important:** Pass the explicit variable list `'${APP_DOMAIN}'` to `envsubst`, not an empty list. Without the list, `envsubst` replaces all `$VAR` references in the file, including Nginx variables like `$host`, `$request_uri`, `$scheme`, and `$proxy_add_x_forwarded_for`, which would corrupt the config.

### Dockerfile addition

Add to the Nginx service Dockerfile (or inline in `compose.prod.yml` if no separate Dockerfile exists for Nginx):

```dockerfile
COPY nginx/batac.conf.template /etc/nginx/templates/batac.conf.template
COPY nginx/entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
```

### compose.prod.yml update

```yaml
nginx:
  image: nginx:1.27-alpine
  environment:
    APP_DOMAIN: ${APP_DOMAIN} # passed from .env.production
  # ... rest of service definition unchanged
```

### `.env.example` addition

```bash
# Nginx domain name — used by envsubst in Nginx entrypoint
APP_DOMAIN=dms.batac.gov.ph
```

---

## Consequences

### Status update in L2 Part 13

L2-04 moves from `Unresolved [Inference]` to `Resolved — envsubst in Nginx entrypoint`.

### Risk: `envsubst` variable list must be maintained

If new environment variables are added to `batac.conf.template` in the future, the quoted list in `entrypoint.sh` must be updated to include them. Failure to do so causes those variables to remain as literal `${VAR}` strings in the generated config, which Nginx rejects on startup. This is a low-frequency, easy-to-diagnose failure.

---

## Rejected alternatives

**CI-time substitution** was rejected because it requires the domain name at image build time, preventing a single image from serving multiple deployment targets.

**Per-environment config files** were rejected because they duplicate the full Nginx config per environment, creating a maintenance burden when the shared config evolves.
