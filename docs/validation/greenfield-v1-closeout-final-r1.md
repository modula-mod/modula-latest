# Modula GreenField — V1-CLOSEOUT-FINAL-R1

Evidence window: 2026-10-15 through 2026-10-16

## Decision

Status: **PARTIAL**. The candidate's independent validation gates pass, but no
authorized off-host backup destination exists in the discovered production
configuration. Therefore the branch must not be merged, deployed, tagged, or
called frozen. Production remains unchanged at
`f05d03c237c62d1b0946a760610d1155f02a8520` / migration
`073_backup_sequence_acl_defaults`.

To close the mandatory recovery gate, an operator must provide an authorized
independently administered S3-compatible bucket, restic repository, or second
host, including its endpoint/host-key trust and credentials through the secret
configuration channel. A second directory or volume on this VPS does not
qualify.

## Gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| Independent off-host backup | BLOCKED | No rclone remote, restic repository, object-store configuration, MinIO alias, independent mount, or backup target was configured; all discovered backup bytes are on `/dev/vda1`. |
| Remote-copy retrieval and clean restore | BLOCKED | Same-host zero-state DB/media/artifact/config restore passed, but it is not host-loss evidence. |
| Retained 30-minute soak | PASS | 1,800.41 seconds, 361/361 valid samples, 178,110 requests at 98.94 RPS, 0.009% bounded 429 responses, no 5xx/timeouts/process/DB/queue failure. |
| Exact image SBOM | PASS | API/worker SPDX JSON contains 282/145 packages and is checksummed. |
| Exact image vulnerability/secret scan | PASS WITH DOCUMENTED EXCEPTIONS | No image secrets and no high/critical finding with an available fix. Twelve unique no-fix/deferred OS advisories are classified in `docs/operations/greenfield-supply-chain.md`. |
| Fresh migration 074 API suite | PASS | Fresh DB migrated through 074; 464/465 passed in the canonical run and the sole environment-gated case passed in its required live harness, making all 465 cases proven. |
| Fresh migration 074 worker suite | PASS | 13 files / 44 tests passed with both test and admin DB URLs. The four formerly skipped legacy migration tests ran and passed. |
| Contract/type/lint/build/Atlas/secret gates | PASS | Local CI-equivalent run exited 0; Atlas 92/92, source-only 0, runtime-only 0. |
| Legacy dead letters | BLOCKED FOR PRODUCTION TRANSITION | All 12 are classified and must not be replayed; the bounded cancel transition passed on a restored copy, but production apply is deferred until off-host recovery exists. |
| PR and hosted CI | Draft PR #126 | The complete hosted workflow passed on `af6d302`; the final evidence commit must independently retain the same required green checks. Merge and deployment remain prohibited while recovery is blocked. |
| Deployment/final recovery/freeze tag | BLOCKED | No feature-branch deployment and no false freeze. |

## Soak

The reusable runner persisted an atomic machine-readable report every five
seconds while the mixed-load process ran. It targeted the isolated migration
074 API/worker and the 1.27 GB production-shaped database; production was not
loaded or mutated.

- Duration: 1,800.41 seconds with 361/361 valid five-second samples
- Concurrency: 25 clients, 250 ms think time, one RFC 2544 identity per
  synthetic client (isolated loopback harness only)
- Requests / throughput: 178,110 / 98.94 RPS
- p50 / p95 / p99 / maximum: 0.61 / 10.85 / 12.62 / 45.06 ms
- Error rate and timeouts: 0.009% (16 bounded HTTP 429 responses), zero
  5xx, transport errors, or timeouts
- API RSS start/end/growth/max: 290.14 / 314.94 / +24.80 / 314.94 MiB;
  only +0.63 MiB in the final five minutes
- Worker RSS start/end/growth/max: 93.61 / 101.18 / +7.57 / 101.18
  MiB; +1.36 MiB in the final five minutes
- DB connections start/end/max: 2 / 12 / 14
- Queue start/end/max: 0 / 0 / 0; running-job maximum 0
- File descriptors start/end/max: API 24 / 34 / 59; worker 24 / 24 / 24
- Process/database/heartbeat result: API and worker alive and DB available in
  every sample; maximum heartbeat age 11.77 seconds

The API RSS curve plateaued near the end of the run. The worker's smaller RSS
increase was not accompanied by file-descriptor, connection, or queue growth.
The retained measurements do not show an operational leak, while the exact
trend remains something routine production telemetry should continue to watch.

The first retained 30-minute attempt is also preserved, rather than hidden. It
correctly failed the load gate because all 25 virtual clients shared one
loopback source identity and exhausted the abuse limiter: 428,812 of 445,131
responses were HTTP 429. All services remained healthy during that attempt.
The corrected isolated harness used one RFC 2544 benchmarking identity per
virtual client and explicitly forbids that mode for a production URL.

API restart, worker crash/reclaim, PostgreSQL interruption/reconnect, connection
saturation, deadlock rollback, outbox atomic replay, and graceful termination
remain independently proven in
`docs/validation/greenfield-v1-failure-injection.md`; the retained soak itself
contains no injected outage.

## Image supply chain

The runtime-image remediation at
`855fff336e4aabbf6ca24b0b5973c23184051639` changed no API or worker behavior.
It copied only the filtered production deployment, removed npm/npx, ran as the
unprivileged `modula` user, and reduced images from roughly 2.5 GB each to:

- API: `sha256:9f05b40754980b91981475697eb00f37a76a9d7b8fb7fbcdbd2a7964b76351dd`, 278,714,724 bytes.
- worker: `sha256:4a1ecee414ca876eb5da604931e0a28242541cec81cfaafab82adc045cd886e1`, 260,985,460 bytes.

Both images booted successfully at migration 074. The offline Ed25519 release
signing key is absent from the repository, inspected production paths, and both
images. The online backend assertion-signing credential is a distinct runtime
secret and was not printed.

## Test and contract evidence

- Candidate migration: `074_greenfield_v1_query_indexes`.
- API: 83 files, all 465 unique tests proven in the correct environments.
- Worker: 13 files / 44 tests, zero skips with database configuration.
- Contract freeze, permission inventory, Module SDK, Product UI, intelligence,
  runtime, registry/trust, MP02, MD03, social, typecheck, lint, and production
  web build all passed locally.
- Atlas inventory remains 630 method routes = 446 application + 184
  framework-derived routes; source-only/runtime-only are zero. Migration 074
  changes indexes only and adds no route.
- Native handoff contracts and versioned fixtures are present. The Native
  repository was not modified.

## Production invariants

Read-only production inspection confirmed:

- public `https://api.modula.digital/v1/health/live` and `/ready`: HTTP 200;
- API and worker revision: `f05d03c237c62d1b0946a760610d1155f02a8520`;
- migration 073 present; migration 074 not applied;
- current worker heartbeat;
- active untrusted installations: 0;
- Vault Notes 1.8.0: published, signed, active signer, nine enabled or installed-disabled installations;
- Vault Notes 0.2.0: superseded, unsigned, zero active installations;
- Vault Notes 2.0 releases in production registry: 0.

No production data, installation, release, dead letter, migration, service, or
checkout was changed during R1 evidence completion.

## Vault Notes 2.0 preview

The separate clean Vault worktree remains at
`12f12e96af83ce66ba7ac737ce344a6282acef84`, version `2.0.0-rc.2`, branch
`phase-vault-notes-flagship-01`. Its private loopback preview returned HTTP 200
on port 4178. It is preview evidence only: **not signed, not registered, not
published**, and not a GreenField freeze gate unless it exposes a platform
regression.

## Required continuation

1. Configure the authorized independent backup destination without committing
   credentials.
2. Create, encrypt, replicate, retrieve, hash, and zero-state restore the full
   production recovery set.
3. Re-run the dead-letter digest gate and apply only the bounded cancellation if
   the set is still exactly the classified 12.
4. Require the PR's complete hosted CI to pass, merge accepted main, take the
   mandatory pre-deploy backup, and deploy only the merge SHA.
5. Run post-deploy smoke, Atlas, integrity, trust, bounded load, off-host backup
   retrieval, recovered API/worker boot, and recovered smoke.
6. Only then write the freeze document, create a non-overwriting freeze tag, and
   declare GreenField v1 frozen.

Current acceptance statement: **GreenField v1 is not yet approved as a frozen
Native dependency because independent host-loss recovery is unproven.**
