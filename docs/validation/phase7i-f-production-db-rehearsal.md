# Phase 7I-F Production Database Rehearsal

Date: 2026-08-09
Repo: `/root/modula-latest`
Branch: `phase7i-trusted-production-alpha`
Commit: `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353`

## Verdict

`PASS_WITH_LIMITATION`

The final logical dump was created, restored into an isolated PostgreSQL runtime, compared against production counts, integrity-checked, migrated, and exercised with DB-backed API/Worker/Runtime 2/Vault Notes tests.

Limitation: public cutover is still blocked by external open-relay proof. This database rehearsal does not authorize F2 by itself.

## Production Source Inventory

| Field | Value |
| --- | --- |
| Compose file | `/root/modula-latest/ops/docker/compose.production.yml` |
| PostgreSQL container | `modula-production-greenfield-postgres-1` |
| PostgreSQL image | `postgres:16.9-alpine` |
| PostgreSQL version | `PostgreSQL 16.9` |
| Database | `modula` |
| Network | `modula-production_greenfield_internal` |
| Volume | `modula-production_greenfield_pg_data` |
| API container | `modula-production-greenfield-api-1` |
| Worker container | `modula-production-greenfield-worker-1` |
| Runtime source | `/root/modula-latest` |

Migration state before dump:

```text
schema_migrations count -> 30
latest migration -> 030_phase7i_runtime_role_grants.sql
pending migrations on restore -> []
```

## Write Stop And Dump

Public API was still behind maintenance 503 before the write stop.

Only Greenfield API and Worker write paths were stopped:

```sh
docker compose -f /root/modula-latest/ops/docker/compose.production.yml stop greenfield-worker greenfield-api
```

The API and Worker were restarted after the dump because F1 remains blocked and public cutover could not proceed:

```sh
docker start modula-production-greenfield-api-1 modula-production-greenfield-worker-1
```

Final logical backup:

| Field | Value |
| --- | --- |
| Directory | `/var/backups/modula/greenfield/phase7i-f/20260809T122533Z/` |
| Dump | `modula-greenfield-20260809T122533Z.dump` |
| Format | `pg_dump -Fc` custom format |
| Size | `872075` bytes |
| SHA-256 | `2635bb4d828f6b9c1888f1e7bdba0dfde071fc410cc10f8b022d728896760158` |
| Metadata | `modula-greenfield-20260809T122533Z.metadata.txt` |

## Isolated Restore

Disposable restore runtime:

| Field | Value |
| --- | --- |
| Container | `modula-phase7if-restore-pg` |
| Image | `postgres:16.9-alpine` |
| Bind | `127.0.0.1:55434 -> 5432` |
| Data | `tmpfs`, disposable |
| Database | `modula_restore` |

Restore command class:

```sh
pg_restore -U modula_restore -d modula_restore --no-owner --no-acl /tmp/modula-greenfield.dump
```

The first restore attempt exposed missing expected DB roles on a fresh runtime. The isolated runtime was corrected by creating the expected roles as `NOLOGIN`, then the exact dump restored cleanly.

## Representative Counts

Counts on the restored dump:

| Entity | Count |
| --- | ---: |
| accounts | 91 |
| profiles | 94 |
| posts | 81 |
| comments | 21 |
| reactions | 7 |
| follows | 19 |
| story groups | 0 |
| story items | 0 |
| story views | 0 |
| notifications | 40 |
| mail jobs | 10 |
| search documents | 39 |
| module registry sources | 5 |
| module releases | 5 |
| module installations | 14 |
| module records | 9 |
| audit events | 494 |
| domain events | 163 |

## Integrity Checks

All checks returned `0`:

```text
duplicate_account_handles
duplicate_auth_identities
duplicate_profile_handles
orphan_comment_reactions_missing_comment
orphan_comments_missing_actor
orphan_comments_missing_post
orphan_module_installations_missing_account
orphan_module_records_missing_installation
orphan_notifications_missing_recipient
orphan_post_reactions_missing_actor
orphan_post_reactions_missing_post
orphan_story_groups_missing_owner
orphan_story_items_missing_group
orphan_story_views_missing_item
```

## Migration Rehearsal

Commands:

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_DATABASE_URL="$RESTORE_URL" MODULA_DATABASE_MIGRATOR_URL="$RESTORE_URL" pnpm --filter @modula/greenfield-api db:status
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_DATABASE_URL="$RESTORE_URL" MODULA_DATABASE_MIGRATOR_URL="$RESTORE_URL" pnpm --filter @modula/greenfield-api db:migrate
```

Results:

```text
db:status -> applied 30, pending []
db:migrate -> {"applied":[]}
```

## DB-Backed Test Rehearsal

All commands used `MODULA_TEST_DATABASE_URL=<isolated DB>`. No DB-related skips due to missing env were observed for these commands.

Worker tests:

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_TEST_DATABASE_URL="$RESTORE_URL" MODULA_DATABASE_URL="$RESTORE_URL" MODULA_DATABASE_MIGRATOR_URL="$RESTORE_URL" pnpm --filter @modula/greenfield-worker test -- --reporter=verbose
```

Result:

```text
Test Files  8 passed (8)
Tests       17 passed (17)
```

API/runtime test files were run as isolated restored-dump rehearsals, resetting the disposable database from the exact dump before each file. Running the files against one shared restored DB leaves cross-file search delivery state that can make the Vault Notes search assertion drain unrelated deliveries first.

```sh
tests/api.integration.test.ts                 -> 11 passed
tests/greenfield.accounts.test.ts             -> 9 passed
tests/phase6s.social.test.ts                  -> passed
tests/phase7e.module-runtime-2.test.ts        -> 5 passed
tests/phase7e.vault-notes-platform.test.ts    -> 2 passed
```

The combined shared-DB run is not used as acceptance evidence because it failed from cross-file search-delivery contamination, while the same files passed when each started from the exact restored dump.

## Private Runtime After Rehearsal

Production API and Worker were restarted after the consistent dump.

```text
modula-production-greenfield-worker-1    Up
modula-production-greenfield-api-1       Up, healthy, 127.0.0.1:4020->4020/tcp
modula-production-greenfield-postgres-1  Up, healthy
modula-production-greenfield-redis-1     Up, healthy
```

Private checks:

```text
GET http://127.0.0.1:4020/v1/health/live  -> 200
GET http://127.0.0.1:4020/v1/health/ready -> 200
GET http://127.0.0.1:4020/v1/meta         -> production metadata, registration open, emailVerificationRequired true
GET http://127.0.0.1:4020/v1/stories/rail -> 200
```

Public check remains blocked by maintenance:

```text
GET https://api.modula.digital/v1/health/live -> 503
GET https://api.modula.digital/v1/stories/rail -> 503
```
