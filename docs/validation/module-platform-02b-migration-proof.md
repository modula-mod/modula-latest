# MODULE-PLATFORM-02B migration proof

Date: 2026-10-11 UTC

Source schema: production schema-only dump at migration
`067_legacy_duplicate_installation_versions`. No production account or content
rows were copied. The disposable PostgreSQL 16.9 database was populated with
synthetic Vault 1.8 and historical Vault 0.2 release rows, one active
installation, an exact-release permission review, versioned settings, one live
record and one deleted record.

## 067 to 068

`068_module_platform_records.sql` executed with `ON_ERROR_STOP=1`.

- installation rows before/after: 1 / 1
- permission review rows before/after: 1 / 1
- record rows before/after: 2 / 2
- settings rows before/after: 1 / 1
- preservation fingerprints for installation, permission review, ordered
  records and settings were byte-for-byte equal before and after:
  `90ae90f012cc2d060531fa003340da28`,
  `345e5ead6c96a717a0c503049d143372`,
  `86a621dc42b5d60566a47fe48351052e`, and
  `0c1e58f21b5b764422ea686710f84c85`.
- imported immutable revisions: 2
- imported sync changes: 2
- imported mutation/reference rows: 0 / 0, as expected for pre-MP02 history
- imported revision payload hashes are 64-character SHA-256 values
- highest migration after upgrade: `068_module_platform_records`

The migration creates no permission grants and does not alter the permission
review, installation, release, settings or current-record tables.

## Executed down migration

`068_module_platform_records.down.sql` then executed with
`ON_ERROR_STOP=1`, followed by removal of its migration-ledger row.

- highest migration after down: `067_legacy_duplicate_installation_versions`
- installation / permission review / record / settings fixtures remaining:
  1 / 1 / 2 / 1
- MP02 revision, mutation, reference and change tables remaining: 0

The down migration is structurally executable and preserves all pre-068 data.
It is intentionally lossy for data written only to the new MP02 tables after
upgrade: immutable revision history, mutation receipts, normalized references
and sync changes are dropped. Therefore production recovery after MP02 writes
is not a down-only rollback. The real recovery strategy is the accepted
pre-deploy PostgreSQL backup/restore workflow plus deployment of the previous
accepted application images. A down migration is safe only before new MP02
data is accepted or when that loss is explicitly approved.
