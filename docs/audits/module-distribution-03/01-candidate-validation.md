# MODULE-DISTRIBUTION-03 candidate validation

Date: 2026-10-13
Branch: `phase-module-distribution-03`
Base: `c6c907549a95c53f612d72fe89638e8222a97c69`

## Database and migration

- Fresh disposable PostgreSQL: migrations `001` through `072_module_distribution_protocol` passed.
- Recovery: `072 -> 071 -> 072` passed on a production-shaped clone.
- Production-shaped clone preserved 17 releases, 27 installations, 29 module records, and 21 settings rows across the `071 -> 072` upgrade.
- Production contained pre-existing orphan `audit.module.*` children that prevented a direct constraint restore. The disposable clone removed only those invalid orphan children before restoring constraints; production was not changed.
- Distribution backfill dry-run, apply, and idempotent re-apply passed for the stored Vault 1.7/1.8 packages. Each release reached 12 artifact rows, eight required for offline launch.

### Pre-deploy backup follow-up

- The established legacy backup command was rejected as deployment evidence after restore proved that its fallback URL selected a stale migration-021 database rather than production.
- The accepted exact production archive is `/var/backups/modula/greenfield/module-distribution-03/20261013T201620Z/modula-production-pre-072.dump`, SHA-256 `d4dd20a6c1964a18ef9697a13e41b017abdd37056ed21e46102d9bc6d0079fa4`.
- A disposable PostgreSQL 16 restore proved migration 071, 17 releases, 27 installations, 105 permission reviews, and 488 validated foreign keys. The backup-specific guarded restore removed only 44 release-child and one publisher-namespace row belonging to already-absent `audit.module` fixtures before recreating constraints; live production was not mutated.
- A dedicated-role dump exposed that sequences created after migration 053 lacked `modula_backup` `SELECT`. Migration `073_backup_sequence_acl_defaults` reconciles current sequences, installs the future default ACL, records prior state for exact down migration, and is covered by an actual `pg_dump` CI gate.
- Fresh `001 -> 073`, `073 -> 072 -> 073`, production-shaped `071 -> 073`, and dedicated-role logical dump verification pass. The production-shaped upgrade preserved 17 releases, 27 installations, and 105 permission reviews with zero unreadable sequences.

## Test and build gates

- Full API: 82/82 files passed; 456 tests passed, one explicitly skipped.
- Full worker with admin-backed migration coverage: 12/12 files, 41/41 tests passed.
- Manifest package: 2/2 files, 20/20 tests passed.
- Root, API, worker, and affected workspace package typechecks passed.
- Repository lint passed with zero warnings.
- API and worker production TypeScript builds passed.
- Candidate Atlas: 630 method routes, 446 application routes, 184 explicit framework exclusions, source-only 0, runtime-only 0, verifier 95/95.

## Performance

Measurements are local VPS-process measurements against disposable PostgreSQL. They are not claims about mobile internet performance. Service-path measurements used 31 warm samples over a signed, installed synthetic release:

| Operation | Median | p95 |
| --- | ---: | ---: |
| Release descriptor | 3.03 ms | 8.05 ms |
| Installation descriptor | 6.01 ms | 9.99 ms |
| Install plan | 2.67 ms | 3.98 ms |
| Update plan | 12.55 ms | 16.70 ms |
| Authenticated artifact read, 5,631-byte fixture | 4.51 ms | 6.66 ms |

The small-fixture artifact read was 1.19 MiB/s after query/auth overhead. Real production-path TTFB, Range, and larger Vault-package throughput remain post-deploy acceptance evidence.

The update-feed benchmark used seven warm samples per size and rolled its transaction back:

| Installations | Queries/request | Median | p95 |
| ---: | ---: | ---: | ---: |
| 10 | 10 | 4.19 ms | 5.81 ms |
| 100 | 10 | 9.26 ms | 10.31 ms |
| 500 | 10 | 22.49 ms | 27.54 ms |
| 1,000 | 10 | 43.28 ms | 49.96 ms |

## Remaining release gates

Feature commit/PR, CI, merge, production backup, main-only deployment, live production acceptance, and synthetic-fixture cleanup are intentionally not claimed by this candidate document.
