# Phase 7B Deployment Evidence

Date: 2026-07-26
Branch: `phase7b-greenfield-module-host`

## Pre-Deployment Backup

- Path: `/var/backups/modula/greenfield/phase7b-pre-deployment-20260721T204549Z.dump`
- Size: `559676` bytes
- SHA-256: `0d5af2c6cc0386071d71ad1901a492ed2cae4b1473debd6252f5c992583cdad2`
- Restore command:
  - `pg_restore --exit-on-error --clean --if-exists --dbname "$MODULA_DATABASE_MIGRATOR_URL" /var/backups/modula/greenfield/phase7b-pre-deployment-20260721T204549Z.dump`

## Migration State

Command:

- `set -a; source services/greenfield-api/.env; set +a; pnpm --filter @modula/greenfield-api db:status`

Applied migrations:

- `001_init_schema`
- `002_phase6_social_atproto`
- `003_phase6_api_rls_writes`
- `004_greenfield_sovereign_core`
- `005_greenfield_backup_access`
- `006_phase6s_social_product`
- `007_phase6s_backfill_counts_and_defaults`
- `008_phase6s_comment_reply_counter_consistency`
- `009_phase7a_module_platform`
- `010_phase7b_module_runtime`

Pending migrations: `[]`

## Greenfield API And Worker

API image:

- Tag: `modula-preview-greenfield-api:latest`
- Image ID: `sha256:a83f00877c1142bcce1597d6363230ae8fea4e9251a0870107418b4077785efb`
- Created: `2026-07-26T02:00:30.815513388+01:00`
- Container: `modula-preview-greenfield-api-1`
- Status: `running`, `healthy`
- Port: `127.0.0.1:4020`

Worker image:

- Tag: `modula-preview-greenfield-worker:latest`
- Image ID: `sha256:b347ff6ef4f07b3072ef45810074850af992c52402bc7ca8e52ecc83ed4fdbc9`
- Created: `2026-07-26T02:03:42.681314223+01:00`
- Container: `modula-preview-greenfield-worker-1`
- Status: `running`

API smoke:

- `scripts/smoke-api-preview.sh https://api.modula.digital`
- Result: passed for `/v1/health/live`, `/v1/health/ready`, `/v1/meta`, `/v1/feed/home`, `/v1/profiles/andrei.modula`, `/v1/discover`

## Web Release

Atomic release:

- Current symlink: `/home/andrei/deployments/modula-web/current`
- Target: `/home/andrei/deployments/modula-web/releases/20260726T010928Z`
- Commit: `00bb121384b181873b9bf58914731bd2379118ba`
- Built at: `2026-07-26T01:08:44Z`
- Release JSON SHA-256: `2c18577e7cd30d216c161ed5c0328abe173ff81ec4420c45e3360b63b9edcaf2`
- Checksums file SHA-256: `2c8f7485a4770d74ff339347e8971f924948bb169fbae66286a34c3a3ae0d624`
- Asset cache buster: `00bb121384b1-20260726T010844Z`

Public web smoke:

- `scripts/smoke-web-preview.sh https://modula.digital`
- Result: passed; static routes returned `200` or redirect-to-canonical `301`
- `https://modula.digital/release.json` returned the release metadata above
- `https://modula.digital/_expo/static/js/web/entry-7e32bef835e436a197d5577334ebe036.js?v=00bb121384b1-20260726T010844Z` returned `200`

Deployment notes:

- Active `modula.digital` nginx HTTPS vhost was changed outside Git from full proxy to static root `/home/andrei/deployments/modula-web/current` with API/WebSocket proxy paths preserved.
- Backup files were created before the vhost change:
  - `/home/andrei/conf/web/modula.digital/nginx.ssl.conf.bak.phase7b-20260726T010606Z`
  - `/home/andrei/conf/web/modula.digital/nginx.conf.bak.phase7b-20260726T010606Z`
- `nginx -t` passed before reload; output included only existing OCSP stapling warnings for certificates.
- Initial release `20260726T010503Z` exposed private permissions because the shell umask was `0077`; release `20260726T010928Z` was rebuilt after `scripts/build-web-preview.sh` and `scripts/deploy-web-preview.sh` were hardened with `umask 022` and deployed file permission normalization.
