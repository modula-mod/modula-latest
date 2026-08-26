# Greenfield Backend V1 data-ledger checkpoint

Recorded: 2026-08-26

Production migration 041: **NOT APPLIED**

Production deployment for this checkpoint: **NOT STARTED**

## Baseline

- Product repository: `modula-mod/modula-latest`
- Programme worktree: `/root/modula-worktrees/greenfield-backend-v1-completion`
- Branch: `cursor/greenfield-backend-v1-completion`
- Baseline main and live web/API/worker SHA:
  `8bce5a40d296131ccebe60b819a53667dd3a25f9`
- Production schema before this checkpoint: `040`
- Production pending migrations before this checkpoint: `0`

## Fresh production backup

The positively identified source was the healthy local production container
`modula-production-greenfield-postgres-1`, database `modula`. The archive keeps
owners and ACLs so runtime-role behavior can be rehearsed exactly.

| Evidence | Value |
| --- | --- |
| Format | PostgreSQL custom (`pg_dump -Fc`) |
| Artifact | `/var/backups/modula/greenfield/greenfield-backend-v1/20260825T211305Z/greenfield-production-pre-gbv1-041.dump` |
| Size | `1,262,270` bytes |
| SHA-256 | `3417109ee2e87847d08dc6f5d7530192d586d872bc686117823b434a0b6b7354` |
| Mode/owner | `0600`, `root:root` |
| ACL entries | `205` |
| Format validation | `pg_restore -l` passed |

## Isolated restore and migration rehearsal

The exact archive restored with owners and ACLs into
`modula_gbv1_pre041_20260825t211305z` in loopback-only PostgreSQL container
`modula-pvp-platform2-pg` at `127.0.0.1:55438`.

Pre-migration status:

- applied through `040_pvp_platform_2_runtime_grants`;
- pending: `041_greenfield_backend_v1_data_ledger` only.

Up result:

- applied: `041_greenfield_backend_v1_data_ledger`;
- pending: `[]`.

Rollback result:

- rolled back: `041_greenfield_backend_v1_data_ledger`;
- `schema_metadata.schema_version`: `040`;
- migration-041 rows: `0`;
- `greenfield_data_*` tables: `0`.

Reapply result:

- applied: `041_greenfield_backend_v1_data_ledger`;
- pending: `[]`.

## Behavior

Command:

```text
MODULA_TEST_DATABASE_URL=<isolated-restored-db> CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/greenfield-backend-v1.data-ledger.test.ts --reporter=verbose
```

Result after reapply: one test file passed, three tests passed, zero skipped.

The behavior gate executes:

- all required API/worker/backup role privileges across seven ledger tables;
- Standard 2 storage declaration projection;
- enable lifecycle projection;
- idempotent dynamic resource registration;
- account isolation;
- schema declaration and checksummed migration activation;
- dedicated database binding through opaque references and `secret://` handles;
- uninstall deletion truth (`DELETED` for completed Greenfield deletion and
  `DELETE_PENDING` for module-owned database deletion awaiting proof);
- database scope-trigger rejection for account/installation forgery;
- arbitrary service URL rejection;
- plaintext-secret metadata rejection.

The first behavior run exposed that listing depended on a non-removed module
installation and hid retained resources after uninstall. The service was fixed
to keep listing account/product scoped while allowing retained, export-pending
and delete-pending resources to remain discoverable for reinstall and recovery.
The reapply behavior run passed after that correction.

## Regression suites

A full API run against the restored production-shaped database correctly
exposed one ledger release-upgrade ordering defect, while seven unrelated
assertions collided with pre-existing static fixture data. The genuine defect
was fixed by updating the installation's authoritative release within the same
transaction before projecting release-scoped ledger resources. A regression
assertion now proves all eight Standard 2 resources move to the new release.

The database was then recreated empty, migrated through all 41 migrations and
used for clean regression runs:

- Greenfield API: 31 test files passed; 180 tests passed; zero failed.
- Greenfield Worker: 8 test files passed; 17 tests passed; zero failed.
- Standard 2 update/lifecycle focus: 1 test file passed; 5 tests passed,
  including the eight-resource release projection assertion.
- `CI=true pnpm verify:greenfield-backend-v1:data-ledger`: PASS.

## Scope delivered

- migration `041` and reversible down migration;
- authoritative resource, owner, binding, schema, migration, retention and
  backup tables;
- account/product/installation/release database scope guard;
- runtime-role grants in the creating migration;
- `GreenfieldDataLedgerService`;
- authenticated account-scoped module ledger routes;
- Standard 2 install and lifecycle projection;
- truthful uninstall state projection;
- architecture constitution and checkpoint verifier.

## Open gates

- Source review, mainline merge and exact-SHA production deployment are open.
- Production migration 041 is open and must not be applied before merge/build.
- Stable backend-service assertion routes are part of the Service Fabric
  checkpoint; current routes are authenticated account routes.
- Module-owned delete handlers, export orchestration and recovery verification
  remain later Backend V1 checkpoints. `DELETE_PENDING` and `EXPORT_PENDING`
  deliberately prevent a false completion claim.
