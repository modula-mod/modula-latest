# GreenField v1 recovery evidence

Validated 2026-10-15 in disposable PostgreSQL and isolated API/worker runtimes.

## Production-shaped synthetic restore

A clean logical dump of the 1.27 GB capacity fixture was restored into an empty
database. The dump was 32,930,228 bytes with SHA-256
`26c50184ffd8be152a38d38e7e6c4357e9be1a2efbc13ad9feac5ac5f697f62b`.
Dump time was 2.71 seconds and clean restore time was 13.82 seconds. Exact table
counts matched and all 25 read-only integrity checks passed. An isolated API and
worker booted against the restored state; a 10-second smoke produced 1,891
requests at 188.29 requests/second with p95 11.04 ms, p99 13.78 ms, and zero
errors.

## Real production backup restore

The encrypted recovery set
`gbv1-recovery-20261014T213534554Z` captured production SHA
`f05d03c237c62d1b0946a760610d1155f02a8520` at migration
`073_backup_sequence_acl_defaults`:

| Payload | Evidence |
| --- | --- |
| PostgreSQL | 7,841,055 bytes; SHA-256 `70ee00da40a1469272caf12f979c583bf96189a7a7e80e809110be130c609439` |
| media | 60 files; content digest `7cc483c4208e06d508edfe9d695a2f6c629c708d3444e6350ac9471e8d050a66`; payload SHA-256 `a8f873a82231289842018836a0b81e253c6aa433b8981d3e4c3b5add1905ccc2` |
| configuration | 24 files; content digest `a52e39a00c32f7c4a4ef42e14e36d28dc32a9fcc9a34c1802534eee71774937f`; payload SHA-256 `23948331251f453a98f789fd3fb923d65dc989004f341f1111eb6ca4614e10e4` |

All payloads were mode `0600`. They were verified and restored into an empty
database and empty media/config destinations in 3.80 seconds. Database counts
matched the source fingerprint: 112 accounts, 41 releases, 35 installations,
1,648 audit events, and 1,895 jobs. Restored media contained 60 files / 29,931,163
bytes; restored configuration contained 24 files / 25,703 bytes with secret
environment files kept mode `0600`.

Before migration, the canonical integrity verifier passed all 25 checks, all 38
immutable artifact blobs rehashed correctly, and all 41 release manifests
matched. Migration `074_greenfield_v1_query_indexes` then completed in 0.65
seconds. The restored API and worker booted, and the mixed smoke produced 1,881
requests at 187.81 requests/second with p95 11.74 ms, p99 14.69 ms, maximum
35.18 ms, and zero errors. The post-migration integrity verifier again passed.

The bounded terminal-job repair was also rehearsed on this restored copy. It
selected exactly 12 understood legacy dead letters with digest
`f94846d400d7ad45392ef6bb4072f91dfa5271342fd7f86836778b6c484b9668`,
changed only those rows to `CANCELLED`, retained their errors/failure history,
and appended one audit event. Active dead letters became zero and integrity
remained PASS.

## Recovery boundary

This proves database, media, artifact, configuration, API, worker, migration,
smoke, and integrity recovery on the current host. It does **not** prove host
loss recovery: every discovered backup copy currently resides on the same VPS.
Until an independently administered destination receives an encrypted copy and
a restore is tested from that copy, correlated VPS/storage loss remains a hard
freeze blocker. No cloud provider or external destination is invented by this
closeout.

Final acceptance still requires a fresh post-deploy backup of the merged SHA
and another zero-state restore/API/worker/smoke/integrity drill.
