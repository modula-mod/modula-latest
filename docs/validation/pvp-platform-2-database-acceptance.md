# PVP Platform Phase 2 database acceptance

Recorded: 2026-08-24

Production mutation: **NO**

Production migration: **NO**

## Backup source

The positively identified source was the healthy PostgreSQL 16.9 container
`modula-production-greenfield-postgres-1`, database `modula`. `pg_dump` is a
read-only database operation.

| Evidence | Value |
| --- | --- |
| Format | PostgreSQL custom (`pg_dump -Fc`) |
| Artifact | `/var/backups/modula/greenfield/pvp-platform-2/20260824T233200Z/greenfield-production-readonly.dump` |
| Size | 1,082,908 bytes |
| SHA-256 | `1a6cc937ab705a417f42987c87a19db2c4f45b199995272abcf9ebd97aaa02be` |
| Mode/owner | `0600`, `root:root` |
| Source migration | `037_phase7i_f5b_rollback_compatibility` |

The first attempt through `modula_backup` was denied on `activity_items` and
produced a zero-byte file. That invalid file was removed. The complete read-only
dump was captured through the database owner. This is recorded as a production
backup-role grant drift to remediate separately; permissions were not changed
because production database mutation is outside this phase.

## Isolated restore

The dump restored with `pg_restore --exit-on-error --no-owner --no-acl` into
`modula_pvp2_restore` inside the existing loopback-only PostgreSQL 16.9
container `modula-pvp-platform2-pg` at `127.0.0.1:55438`.

Pre-migration restored evidence:

- schema chain ended at `037`;
- restored accounts: 104;
- restored module releases: 5;
- pending source migrations: `038`, `039`.

The source migration command applied both pending migrations in one
transaction. A subsequent status returned `pending: []`.

## Migration 039 rollback/reapply

`pnpm --filter @modula/greenfield-api db:rollback` returned
`039_pvp_platform_2_extension_fabric`. After rollback:

- migration row `039`: 0;
- all 10 Phase 2 extension tables: 0;
- `product_kind`/`extension_product` release columns: 0.
- Phase 2 versioned Vault search subscriptions: 0.

Reapply returned `039_pvp_platform_2_extension_fabric`. After reapply:

- migration row `039`: 1;
- Phase 2 extension tables: 10;
- release columns: 2.
- versioned Vault search subscriptions: 10.

## Restored-data tests

The actual restored production-compatible data, after migration, ran:

Before the final run, the named disposable database was recreated from the
recorded dump so earlier test-imported releases could not influence the result.

```text
CI=true pnpm --filter @modula/greenfield-api exec vitest run \
  tests/pvp-platform-2.extension-fabric.test.ts \
  tests/pvp-platform-2.reference-products.test.ts --reporter=verbose
```

Result: 2 test files passed, 13 tests passed, 0 skipped. This includes two
new accounts in the disposable copy, immutable release import, graph/lifecycle,
scoped assertion, capability denial, checksum quarantine, event/job isolation,
bounded idempotent service timeout retry, and the full four-product reference
journey.

## Gate

| Required result | Status |
| --- | --- |
| DATABASE BACKUP | PASS |
| ISOLATED RESTORE | PASS |
| MIGRATION CHAIN | PASS |
| NEW MIGRATION | PASS |
| DB TESTS | PASS |
| ROLLBACK TEST | PASS |
| PRODUCTION MIGRATION | NO |
