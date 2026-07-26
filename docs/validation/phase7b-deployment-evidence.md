# Phase 7B Deployment Evidence

Date: 2026-07-26
Branch: `phase7b-greenfield-module-host`
Latest deployed commit: `cba71b9824bf0bc784e0c53c9a8fc1d3a873545f`

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
- Image ID: `sha256:1fe7ee3616ae779acb55d213966bce95d678ca7c315dbbb758055c167c725ed5`
- Created: `2026-07-26T02:20:55.026769223+01:00`
- Container: `modula-preview-greenfield-api-1`
- Status: `running`, `healthy`
- Port: `127.0.0.1:4020`

Worker image:

- Tag: `modula-preview-greenfield-worker:latest`
- Image ID: `sha256:6c5e7eee2638ab3a4bbf1c47f39da8947bcff45dc74c915b0d02cf7de3307854`
- Created: `2026-07-26T02:20:39.948832119+01:00`
- Container: `modula-preview-greenfield-worker-1`
- Status: `running`

API smoke:

- `scripts/smoke-api-preview.sh https://api.modula.digital`
- Result: passed for `/v1/health/live`, `/v1/health/ready`, `/v1/meta`, `/v1/feed/home`, `/v1/profiles/andrei.modula`, `/v1/discover`

## Live Vault Notes Acceptance

Command: process-local Node HTTPS harness against `https://api.modula.digital`; protected invite code was read from `/etc/modula/greenfield-api.env` and not printed.

Preview account:

- Handle: `p7bms14b8gv`
- Module: `digital.modula.vault-notes`
- Version: `0.2.0`
- Restored record: `019f9c08-8099-77f1-ac9f-b85048505447`

Passed checks:

- Register, verify email, sign in.
- Catalogue search for Vault Notes.
- Module detail for published `0.2.0`.
- Permission review with `13` permissions.
- Install request and worker transition to `installedDisabled`.
- Enable request and worker transition to `enabled`.
- Declarative view list with `8` views.
- Note-list view fetch.
- Schema-driven settings schema.
- Folder create, rename, second-folder create.
- Note create, edit, move, search, folder filter, sort.
- Empty folder delete.
- Declarative Save to Vault source-link create action.
- Post-menu Save to Vault contribution.
- Composer Create Vault Note contribution.
- Settings update.
- Same-version update request and worker return to `enabled`.
- Disable request, worker transition to `disabled`, disabled record access denied with `403`.
- Re-enable request and worker transition to `enabled`.
- Note delete and emptied folder delete.
- Uninstall preview with default `keepData` and `2` retained records.
- Uninstall from `enabled` state and worker transition to removed/not found.
- Reinstall, re-enable, retained saved-post record restored with `retained_after_uninstall=true` and preserved `source_uri`.
- Settings survived keep-data uninstall/reinstall.
- Invalid module lookup returned `404`.

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
