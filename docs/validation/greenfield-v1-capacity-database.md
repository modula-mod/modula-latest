# GreenField v1 capacity-database evidence

Date: 2026-10-15

Environment: dedicated disposable PostgreSQL 16 database
`modula_closeout_capacity` on loopback. It was created from zero and migrated
through candidate migration `074_greenfield_v1_query_indexes`. No production
state was used or changed.

## Production-shaped fixture

The reusable, loopback-restricted
`tools/greenfield-closeout/capacity-database.mjs` generated the following
internally consistent fixture:

| Object | Count |
| --- | ---: |
| module records | 100,000 |
| immutable revisions | 300,000 |
| sync changes | 300,000 |
| completed mutation-ledger rows | 100,000 |
| reverse references | 50,000 |
| active shares | 25,000 |
| media bindings / attachments | 10,000 / 10,000 |
| module-record search projections | 100,000 |

Generation took 49.2 seconds including `ANALYZE`. Database growth was
751,067,136 bytes (about 716 MiB), producing 1,415,298,688 bytes (about
1.32 GiB) of WAL. This is a fixture-generation measurement, not a production
write-rate promise.

The first attempted generation failed on an ambiguous typed parameter in the
revision statement. The encompassing transaction rolled back every preceding
record insert; the corrected explicitly typed generator then completed. This
is retained as proof that fixture creation itself is all-or-nothing.

## Integrity

The generic capacity invariants all returned zero:

- current record revision missing from history;
- revision duplicate or gap;
- duplicate sync sequence;
- orphan reference.

The canonical read-only integrity verifier also returned PASS with zero
critical failures across all 25 check classes. It decoded and reconciled all
100,000 module-record search identities, verified all revisions, changes,
references, media bindings, shares, mutation results, release-linked tables,
and current-state linkages.

## Query plans and remediation

Initial `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` exposed two real plan defects:

| Query | Before | Candidate index | After |
| --- | --- | --- | --- |
| active record list | parallel sequential scan, 31.951 ms | `greenfield_module_records_active_list_idx` | index-only scan, 0.076 ms |
| active recipient shares | sequential scan + sort, 17.970 ms | `greenfield_module_record_shares_active_recipient_list_idx` | index-only scan, 0.114 ms |

The remaining representative plans were already bounded:

| Query | Plan | Execution |
| --- | --- | ---: |
| record history | revision record index | 0.091 ms |
| reverse references | target index | 0.040 ms |
| incremental sync page (200 rows) | ordered primary-key index | 0.114 ms |
| generic search page | ordered search-document index | 0.079 ms |
| mutation replay | unique account/installation/mutation index | 0.039 ms |

Migration 074 adds only the two evidenced partial indexes. On the 1.3 GB
database, the complete migration command, including TypeScript/process startup
and migration-ledger commit, took 0.90 seconds. Index sizes were approximately
18.1 MiB and 6.0 MiB. Because ordinary `CREATE INDEX` briefly takes a table
write-blocking lock, deploy it during the closeout maintenance window; 0.90
seconds is the measured upper bound on this fixture, not a universal guarantee.

## Index and autovacuum classification

All primary/unique indexes remain integrity constraints. History, reference,
mutation, sync, search, media, folder, owner, and recipient indexes map to
documented route families or recovery/GC access paths. An index showing zero
scans in a single synthetic run is not evidence for deletion. No historical
index was removed.

The initial failed fixture transaction temporarily produced dead tuples. The
next autovacuum observations cleared them to zero on the largest affected
record, revision, and mutation tables. Autovacuum/autoanalyze timestamps were
observed on active tables; explicit `ANALYZE` supplies deterministic candidate
planning statistics. No production autovacuum setting was changed without
production workload evidence.

## Connection and storage observations

- PostgreSQL `max_connections`: 100.
- Audit-time connections: 1–2.
- Largest measured table: revisions at about 465 MiB including indexes.
- Records: about 175 MiB after vacuum plus candidate index.
- Changes: about 190 MiB.
- Search projection: about 185 MiB.

The fixture remains disposable evidence for the soak, clean backup/restore,
restored API/worker boot, and final capacity calculations. It must not be
mistaken for user data or copied into production.

## Soak disposition

A 25-client, 100 ms think-time soak was started against the isolated API and
this fixture. Interim samples through roughly 15 minutes were stable: API RSS
plateaued near 354 MiB with 45–47 file descriptors, worker RSS near 106 MiB with
22 descriptors, database connections at 12, and queued/running jobs at zero.
The 30-minute process ended while the operator terminal was detached and its
final JSON report was not retained. These interim observations are useful but
do **not** satisfy the closeout soak PASS gate; a complete retained run is still
required before a freeze decision.
