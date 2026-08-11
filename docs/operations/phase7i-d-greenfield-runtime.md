# Phase 7I-D Greenfield Runtime

Captured: 2026-08-09

## Source Release

- Canonical source: `/root/modula-latest`
- Branch: `phase7i-trusted-production-alpha`
- Pushed source SHA: `c47d20b1be57dab8f3f28274926e67cc008d847c`
- `git rev-parse HEAD`: `c47d20b1be57dab8f3f28274926e67cc008d847c`
- `git rev-parse origin/phase7i-trusted-production-alpha`: `c47d20b1be57dab8f3f28274926e67cc008d847c`
- `git status --short`: clean before writing this document

## Production Compose

- Compose file: `/root/modula-latest/ops/docker/compose.production.yml`
- Compose project: `modula-production`
- Components:
  - `greenfield-postgres`
  - `greenfield-redis`
  - `greenfield-api`
  - `greenfield-worker`
- The preview compose file `/home/andrei/modula-latest/ops/docker/compose.preview.yml` is not used by this production topology.
- Production env files are under `/etc/modula/` with mode `600`.

## Fresh PostgreSQL

- Container: `modula-production-greenfield-postgres-1`
- Image: `postgres:16.9-alpine`
- Volume: `modula-production_greenfield_pg_data`
- Host port exposure: none
- Container port only: `5432/tcp`
- Role init script: `/root/modula-latest/ops/docker/postgres/init-roles.sh`
- Role init evidence from container logs: `DO`, five `ALTER ROLE`, `GRANT`, `ALTER DATABASE`

Runtime roles:

| Role | Superuser | Create DB | Create Role | Bypass RLS | Purpose |
| --- | --- | --- | --- | --- | --- |
| `modula_api` | false | false | false | false | API runtime |
| `modula_worker` | false | false | false | false | Worker runtime |
| `modula_migrator` | false | false | false | true | Schema migration and DDL |
| `modula_readonly` | false | false | false | false | Read-only access |
| `modula_backup` | false | false | false | true | Logical backups, including FORCE RLS tables |

## Restored Dataset

- Final dump: `/var/backups/modula/greenfield/phase7i-d/greenfield-final-20260809T000549Z.dump`
- Dump SHA-256: `08b3a21a7f2491d2bc380cdebe176a85555f4cfbe23564f2513ab90958fbf94f`
- Restore command used `pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U modula_migrator -d modula`.
- Restored representative counts matched the final dump before migrations:
  - `greenfield_accounts=88`
  - `profiles=92`
  - `posts=81`
  - `greenfield_comments=21`
  - `greenfield_reactions=7`
  - `follows=19`
  - `notifications=40`
  - `greenfield_module_sources=5`
  - `greenfield_module_releases=5`
  - `greenfield_extension_installations=14`
  - `greenfield_module_records=9`
  - `audit_events=487`
  - `background_jobs=323`

## Migrations

- Applied through `030_phase7i_runtime_role_grants`.
- Pending migrations: `[]`
- `schema_migrations`: `30`
- Public tables: `178`
- Public indexes: `439`
- Unvalidated constraints: `0`

Phase 7I role-grant repair:

- `028_phase7f_stories` and `029_phase7h_mail` introduced new runtime tables after the older global grants.
- `030_phase7i_runtime_role_grants` grants the Stories and mail queue tables to `modula_api`, `modula_worker`, and `modula_backup`.
- `modula_api` grants now include `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on:
  - `greenfield_story_groups`
  - `greenfield_story_items`
  - `greenfield_story_views`
  - `greenfield_mail_jobs`

## Fresh Redis

- Container: `modula-production-greenfield-redis-1`
- Image: `redis:7.4-alpine`
- Host port exposure: none
- Container port only: `6379/tcp`
- Runtime state policy: fresh ephemeral runtime, no imported state
- Persistence: `--appendonly no --save ""`
- Internal ping: `PONG`

Redis usage classification from source audit:

- Current Greenfield code has no Redis client dependency.
- Redis is reserved for cache, locks, rate limits, ephemeral queues, session helpers, and temporary state.
- No product-critical durable data is currently known to exist only in Redis.

## Immutable Images

API:

- Image: `modula-greenfield-api:c47d20b1be57dab8f3f28274926e67cc008d847c`
- Image ID: `sha256:918127f44aa70de76f59e8e0af8d17cb4f9e9af7bd5fa29741825424001a845e`
- OCI revision: `c47d20b1be57dab8f3f28274926e67cc008d847c`
- OCI source: `/root/modula-latest`
- OCI title: `modula-greenfield-api`

Worker:

- Image: `modula-greenfield-worker:c47d20b1be57dab8f3f28274926e67cc008d847c`
- Image ID: `sha256:9d5c8163cf6d54dde27a968dbab4393c07ae849e1376a339755f6ffde8e5edac`
- OCI revision: `c47d20b1be57dab8f3f28274926e67cc008d847c`
- OCI source: `/root/modula-latest`
- OCI title: `modula-greenfield-worker`

External build context:

- The production image build uses `/root/modula-mod/modula-module-standard` as an explicit BuildKit additional context.
- This preserves the external Module Standard repository boundary while allowing Docker to resolve the existing `file:` package dependencies.

## Private API Acceptance

- Container: `modula-production-greenfield-api-1`
- Image: `modula-greenfield-api:c47d20b1be57dab8f3f28274926e67cc008d847c`
- Runtime user: `uid=999(modula) gid=999(modula)`
- Host binding: `127.0.0.1:4020->4020`

Direct loopback checks:

- `GET http://127.0.0.1:4020/v1/health/live`: `200`, status `live`
- `GET http://127.0.0.1:4020/v1/health/ready`: `200`, status `ready`
- `GET http://127.0.0.1:4020/v1/meta`: `environment: production`, `registration.mode: open`, `emailVerificationRequired: true`, `mutations: true`, module registry enabled, Vault Notes reference enabled
- `GET http://127.0.0.1:4020/v1/stories/rail`: `200`, body `{"items":[]}`
- `MODULA_LIVE_API_BASE_URL=http://127.0.0.1:4020 pnpm verify:phase7i-live-api-parity`: pass, `103` frontend calls covered by `227` source routes and `99` live probes

## Worker Runtime

- Container: `modula-production-greenfield-worker-1`
- Image: `modula-greenfield-worker:c47d20b1be57dab8f3f28274926e67cc008d847c`
- Runtime user: `uid=999(modula) gid=999(modula)`
- Startup log: `modula worker starting`
- D1 caveat: `/etc/modula/greenfield-worker.env` is a temporary private-runtime config with `MODULA_ENVIRONMENT=preview` and `MODULA_MAIL_TRANSPORT=disabled`.
- D2 must replace the Worker env with `MODULA_ENVIRONMENT=production`, authenticated SMTP settings, and real mail acceptance before public registration opens.

## Public Cutover State

- Public `https://api.modula.digital/v1/health/live` still returns controlled maintenance HTTP `503`.
- Public maintenance body: `{"ok":false,"error":{"code":"MAINTENANCE","message":"Modula API maintenance is in progress."}}`
- This is intentional until D2 mail and the later public API cutover gates pass.

## Listener State

Observed host listeners for Greenfield-related ports:

- `127.0.0.1:4020`: rebuilt production API
- `127.0.0.1:5433`: preserved old preview PostgreSQL
- `127.0.0.1:55433`: disposable migrated restore retained for evidence

No host listener was observed for:

- PostgreSQL `5432`
- Redis `6379`

## Old Runtime State

- Old preview API: stopped
- Old preview Worker: stopped
- Old preview PostgreSQL: running on `127.0.0.1:5433`, preserved
- Disposable migrated restore: running on `127.0.0.1:55433`, preserved for evidence until final D1 closeout cleanup

## Current Gate Result

D1 fresh data/runtime gate is privately accepted:

- Fresh PostgreSQL runtime: pass
- Role separation: pass, with documented backup/migrator BYPASSRLS exception
- Final dump restore: pass
- Migrations through `030`: pass
- Fresh Redis runtime: pass
- Immutable API image: pass
- Immutable Worker image: pass
- API non-root runtime: pass
- Worker non-root runtime: pass
- Private live/ready/meta/Stories acceptance: pass
- Live API parity: pass
- Public API cutover: intentionally not performed
- Production mail: pending D2
