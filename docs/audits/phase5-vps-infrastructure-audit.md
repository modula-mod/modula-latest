# Phase 5 VPS infrastructure audit

Date: 2026-07-17

## Tooling
- Node: v24.18.0
- pnpm: 11.11.0
- Docker: 29.1.3
- Docker Compose: v2.40.3
- Nginx: 1.29.3
- PostgreSQL client: 16.14
- systemd: 255

## Resources
- Disk: ~697G total, ~35% used
- Memory: ~23Gi

## Existing Docker
- LibreChat, Open WebUI, Nodus, Keycloak DB, pgvector, Meilisearch — do not destroy
- No host publish of Modula Phase 5 Postgres (`5432` must stay private to compose network)

## Current modula.digital
- Hestia web root: `/home/andrei/web/modula.digital/public_html` (legacy Open WebUI static assets present)
- Active Nginx SSL config pointed at missing `/home/andrei/modula-social-web-dist` (site returning errors)
- Custom proxy remnants for Open WebUI (`127.0.0.1:3000`) and `/api/modula/` → `4010`
- TLS certificates present under `/home/andrei/conf/web/modula.digital/ssl/`

## api.modula.digital
- DNS responds via Cloudflare (HTTP 502 before Phase 5 API deploy)
- No Hestia domain directory observed at audit time — deploy scripts install ops nginx template + certificates as needed

## Occupied ports of note
- 80/443 public (Nginx)
- 3000 Open WebUI published publicly (pre-existing; out of Phase 5 ownership)
- 4020 free for Modula API loopback bind

## Rollback path
1. Restore previous web symlink / nginx ssl config from `/home/andrei/backups/modula-before-phase5-<timestamp>/`
2. `docker compose -f ops/docker/compose.preview.yml down` (does not remove volume unless explicit)
3. Keep Postgres volume intact unless restore-test requires isolation

## Secrets
- Production secrets path: `/etc/modula/api.env` (not in git)
