# MODULE-PLATFORM-02B migration proof

Date: 2026-10-11 UTC

Source schema: production schema-only dump at migration
`067_legacy_duplicate_installation_versions`. No production account or content
rows were copied. The disposable PostgreSQL 16.9 database was populated with
synthetic Vault 1.8 and historical Vault 0.2 release rows, one active
installation, an exact-release permission review, versioned settings, one live
record and one deleted record.

## 067 to 071

The canonical migrator applied, in one transaction:

- `068_module_platform_records`
- `069_module_platform_media_sharing`
- `070_module_platform_functions_actions`
- `071_module_record_search_projection`

The production-shaped fixture was at exactly 067 immediately before the run.

- installation rows before/after: 1 / 1
- permission review rows before/after: 1 / 1
- record rows before/after: 2 / 2
- settings rows before/after: 1 / 1
- release rows before/after: 2 / 2
- preservation fingerprints for installation, permission review, ordered
  records, settings and releases were byte-for-byte equal before and after:
  `92171f0959c4c72a80ef8afa37e66898`,
  `3b6918daa9a47b791b5a354a47f1a4bb`,
  `436fb07c02b6670e22a73fc89d7ed00e`,
  `ab4f03978306caf689916dee637f1efb`, and
  `71bfbf14ea34fbb9f1ee10a6cd23962f`.
- imported immutable revisions: 2
- imported sync changes: 2
- imported mutation/reference rows: 0 / 0, as expected for pre-MP02 history
- imported revision payload hashes are 64-character SHA-256 values
- media binding/share rows: 0 / 0, as expected before MP02B writes
- function/action runtime tables were present and empty
- the exact generic `module.record.changed` search subscription was present once
- permission definition rows remained 0; no migration-created grant appeared
- highest migration after upgrade: `071_module_record_search_projection`

The migrations create no permission grants and do not alter the permission
review, installation, release, settings or current-record fixtures.

## Executed down migration

The canonical rollback command was actually executed four times, in order:

`071 -> 070 -> 069 -> 068 -> 067`.

- highest migration after down: `067_legacy_duplicate_installation_versions`
- installation / permission review / record / settings / release fixtures
  remaining: 1 / 1 / 2 / 1 / 2
- all five preservation fingerprints remained identical to the pre-upgrade
  values above
- all 13 MP02/MP02B record, media, share, function, host and action runtime
  tables introduced by 068-070 remaining: 0
- 071 search rows were deleted before its old entity-type constraints were
  restored

The down chain is structurally executable and preserves all pre-068 data. It is
intentionally lossy for data written only to the new MP02/MP02B tables after
upgrade: immutable revision history, mutation receipts, normalized references,
sync/resource changes, media bindings, shares, function invocation state, host
requests and inter-module action requests are dropped. Therefore production
recovery after MP02B writes is not a down-only rollback. The real recovery
strategy is the accepted pre-deploy PostgreSQL backup/restore workflow plus
deployment of the previous accepted application images. A down migration is
safe only before new MP02B data is accepted or when that loss is explicitly
approved.
