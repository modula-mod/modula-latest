# Phase 7I-D Database Runtime Validation

Captured: 2026-08-09

## Source Freeze

- Source: `/root/modula-latest`
- Branch: `phase7i-trusted-production-alpha`
- Starting SHA: `974a3b2354fedd010a884a5d342fefbc24184fe9`
- `git status --short`: clean before D1 source edits
- `git diff --check`: clean before D1 source edits
- D1 introduced source changes for the production topology, production write gate, route-validation hardening, role separation, runtime inventory docs, and live API parity verification.
- A new pushed source SHA is required before building production images.

## Write Freeze

- Public API maintenance mode enabled through `/etc/nginx/conf.d/api.modula.digital.greenfield.conf`.
- Nginx config backup: `/var/backups/modula/nginx/phase7i-d/api.modula.digital.greenfield.conf.before-maintenance.20260809T000443Z`
- `nginx -t`: successful, with pre-existing `nodus.modula.digital` OCSP stapling warning.
- Public maintenance check: `https://api.modula.digital/v1/health/live` returned HTTP `503` with `{"code":"MAINTENANCE"}`.
- Stopped only Greenfield writers:
  - `modula-preview-greenfield-worker-1`
  - `modula-preview-greenfield-api-1`
- Left running for final dump:
  - `modula-preview-greenfield-postgres-1`

## Final Logical Dump

- Backup directory: `/var/backups/modula/greenfield/phase7i-d/`
- Manifest: `/var/backups/modula/greenfield/phase7i-d/greenfield-final-20260809T000549Z.manifest.md`
- Source DB: `modula`
- Source container: `modula-preview-greenfield-postgres-1`
- PostgreSQL version: `PostgreSQL 16.9 on x86_64-pc-linux-musl`
- Dump format: PostgreSQL custom logical dump, `pg_dump -Fc`
- Dump file: `/var/backups/modula/greenfield/phase7i-d/greenfield-final-20260809T000549Z.dump`
- Dump size: `649214` bytes
- Dump SHA-256: `08b3a21a7f2491d2bc380cdebe176a85555f4cfbe23564f2513ab90958fbf94f`
- Globals file: `/var/backups/modula/greenfield/phase7i-d/greenfield-final-20260809T000549Z.globals.sql`
- Globals SHA-256: `16d4523756d8d4614cd0d9556187ca63a3851e14f8da8d4297df8b152e87bca6`

## Disposable Restore Integrity

First restore attempt showed that RLS policies reference `modula_api`; the clean restore was repeated with placeholder roles:

- `modula_migrator`
- `modula_api`
- `modula_readonly`
- `modula_backup`
- `modula_worker`

Clean restore command exited `0` after placeholder roles existed.

Representative source and restored counts matched before migrations:

| Table | Source | Restored |
| --- | ---: | ---: |
| `greenfield_accounts` | 88 | 88 |
| `profiles` | 92 | 92 |
| `posts` | 81 | 81 |
| `greenfield_comments` | 21 | 21 |
| `greenfield_reactions` | 7 | 7 |
| `follows` | 19 | 19 |
| `notifications` | 40 | 40 |
| `greenfield_module_sources` | 5 | 5 |
| `greenfield_module_releases` | 5 | 5 |
| `greenfield_extension_installations` | 14 | 14 |
| `greenfield_module_records` | 9 | 9 |
| `vault_notes_records` | 0 | 0 |
| `audit_events` | 487 | 487 |
| `background_jobs` | 323 | 323 |

Integrity checks:

- `pg_amcheck`: clean after enabling `amcheck` in the disposable restore.
- Unvalidated constraints: `0`
- Restored public indexes before pending migrations: `308`
- Restored foreign-key constraints before pending migrations: `152`

## Migration Rehearsal

Recreated disposable PostgreSQL on loopback only:

- Container: `modula-phase7id-restore-pg`
- Port: `127.0.0.1:55433->5432`
- Purpose: migration/API/Worker rehearsal only, not production runtime.

Migration inventory before applying:

```json
{
  "pending": [
    "022_phase7e_module_records_and_vault_notes",
    "023_phase7e_module_backend_runtime",
    "024_phase7e_ai_platform_foundation",
    "025_phase7e_ai_provider_runtime",
    "026_phase7e_ai_product_actions",
    "027_phase7e_module_runtime_2",
    "028_phase7f_stories",
    "029_phase7h_mail"
  ]
}
```

Applied migrations:

```json
{
  "applied": [
    "022_phase7e_module_records_and_vault_notes",
    "023_phase7e_module_backend_runtime",
    "024_phase7e_ai_platform_foundation",
    "025_phase7e_ai_provider_runtime",
    "026_phase7e_ai_product_actions",
    "027_phase7e_module_runtime_2",
    "028_phase7f_stories",
    "029_phase7h_mail"
  ]
}
```

Post-migration status:

- Pending migrations: `[]`
- Max schema migration: `029_phase7h_mail`
- Schema migration count: `29`
- Unvalidated constraints: `0`
- Public tables: `178`
- Public indexes: `439`

Post-migration table checks:

| Table | Count |
| --- | ---: |
| `greenfield_story_groups` | 0 |
| `greenfield_story_items` | 0 |
| `greenfield_story_views` | 0 |
| `greenfield_mail_jobs` | 0 |
| `module_backend_definitions` | 0 |
| `module_backend_installations` | 0 |
| `greenfield_ai_providers` | 5 |
| `greenfield_ai_models` | 5 |
| `ai_provider_credentials` | 0 |
| `ai_executions` | 0 |

## Current API And Worker Rehearsal

Builds:

- `pnpm --filter @modula/greenfield-api build`: pass
- `pnpm --filter @modula/greenfield-worker build`: pass

Direct API against migrated restore:

- API bound only to `127.0.0.1:4420`.
- `GET /v1/health/live`: `200`, status `live`
- `GET /v1/health/ready`: `200`, status `ready`
- `GET /v1/meta`: `environment: production`, `registration.mode: open`, `emailVerificationRequired: true`, `inviteOnly: false`, `mutations: true`
- `GET /v1/stories/rail`: `200`, body `{"items":[]}`
- Malformed public auth probes returned controlled 4xx responses:
  - `POST /v1/sessions {}`: `401`
  - `POST /v1/accounts/register {}`: `400`
  - `POST /v1/accounts/verify-email {}`: `401`

Worker:

- Started against the same migrated restore as `phase7id-rehearsal-worker`.
- Mail transport was disabled for D1 because production SMTP is a D2 gate.
- DB activity showed `modula-api` and `modula-worker` connections during rehearsal.

Tests and verifiers:

- `node scripts/verify-phase7h-api-contract-parity.mjs`: pass, `103` frontend calls covered by `227` Greenfield routes.
- `MODULA_LIVE_API_BASE_URL=http://127.0.0.1:4420 pnpm verify:phase7i-live-api-parity`: pass, `99` live probes; verifier now fails on route-not-found, maintenance `503`, and any unexpected `5xx`.
- `pnpm --filter @modula/greenfield-api build`: pass after production write gate and malformed payload fixes.
- `pnpm --filter @modula/greenfield-api test`: pass, `14` files passed, `8` skipped; `34` tests passed, `86` skipped.
- `pnpm --filter @modula/greenfield-worker test`: pass, `7` files passed, `1` skipped; `9` tests passed, `8` skipped.
- `git diff --check`: pass after D1 source edits.

## Production Runtime Source Changes

- Added `ops/docker/compose.production.yml` as the production topology sourced from `/root/modula-latest`.
- Added `MODULA_PRODUCTION_WRITES_ENABLED=true` as the explicit production alpha write gate; `MODULA_PREVIEW_WRITES_ENABLED` remains forbidden in production.
- Hardened public account/session routes so malformed payloads return controlled 4xx responses instead of 5xx.
- Added `scripts/verify-phase7i-live-api-parity.mjs` and `pnpm verify:phase7i-live-api-parity`.
- Updated `ops/docker/postgres/init-roles.sh` so `modula_worker` uses `MODULA_WORKER_PASSWORD`, not the API role password.

## Current State After Rehearsal

- Rehearsal API process stopped.
- Rehearsal Worker process stopped.
- Public API maintenance response remains active.
- Old preview Greenfield API and Worker remain stopped.
- Old preview PostgreSQL remains running and preserved.
- Disposable migrated restore remains running on loopback for evidence until production replacement completes.

## Gate Result

Phase 7I-D database dump, disposable restore, pending migration rehearsal, direct current API acceptance, current Worker startup, and DB-backed test gate passed.

Production PostgreSQL replacement is now permitted by the D1 sequence, but old production data/runtime must still be preserved until the fresh production runtime restore and acceptance pass.
