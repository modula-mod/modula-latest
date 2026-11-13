# GF-OPS-01 follow-up: worker identity, long-job liveness (author evidence)

Base: #174 head `3622b31c` on modula-latest main `a91d490e`. Author: SENTINEL.
This is author evidence, not certification. No worker runtime code
(`services/greenfield-worker/src/**`) is changed here.

## (b) Fixed worker identity - fixed in ops

Finding confirmed: production compose set no `MODULA_WORKER_ID`, so the worker
fell back to `worker-${process.pid}` (`services/greenfield-worker/src/config.ts:8`)
and the healthcheck's worker filter was optional (`$2::text IS NULL OR ...`), so
any fresh heartbeat on the same release could make a dead worker read healthy.

Fix:

- `ops/docker/compose.production.yml`: worker `environment` sets
  `MODULA_WORKER_ID: greenfield-worker-${SOURCE_RELEASE_SHA:?...}` - a fixed,
  release-scoped literal built only from the already-required release pin
  (`environment` overrides the env file).
- `ops/docker/greenfield-worker-heartbeat-healthcheck.cjs`: `MODULA_WORKER_ID`
  and `MODULA_RELEASE_SHA` are required (unhealthy when unset) and matched
  exactly (`worker_id = $2 AND release_sha = $1`).
- `scripts/verify-compose-release-pins.mjs` (+ 6 new node:test cases) fails
  when the worker id is missing, defaulted/optional, built from a non-release
  variable, pid/hostname-shaped or empty, when the worker is scaled while the id
  is fixed, and when the healthcheck accepts any worker or release.
- Drill `worker-healthcheck-drill.sh`: 16/16, including two worker ids on one
  release with one stale - the stale id is unhealthy while the other is fresh.

## (c) Heartbeat and lease during long jobs - Forge runtime handoff

### Finding (file:line at `3622b31c`, unchanged from `a91d490e`)

- `services/greenfield-worker/src/main.ts:78-80`: the heartbeat is written only
  inside the main `while` loop (`heartbeatDue` -> `recordHeartbeat`).
- `services/greenfield-worker/src/main.ts:155`: the same loop awaits
  `processOneEventDelivery(...) || processOneJob(...)`; nothing else runs until
  the job returns. The reaper (`:128-132`), outbox drain (`:133-136`) and AT
  ingest (`:137-147`) share that loop.
- `services/greenfield-worker/src/jobs/claim.ts:20,27`: the lease is set once at
  claim to `now + leaseDurationMs`; default 60 s
  (`services/greenfield-worker/src/config.ts:13`). No code renews it
  (`grep -rn renew src/` is empty).
- `services/greenfield-worker/src/jobs/runner.ts:38,192`: jobs run under
  `withTimeout(..., job.timeout_ms)`, and `background_jobs.timeout_ms` allows up
  to 900 s (`services/greenfield-api/migrations/043_greenfield_backend_v1_event_job_fabric.sql:94`),
  so a legitimate job can outlive the lease by 15x.
- Consequence (analysis, not exercised): any other worker process, or this one
  after a restart, runs `reapExpiredLeases` (`claim.ts:51-87`) and moves the
  still-running job to `RETRYING`/`DEAD_LETTER`; the original run then fails
  `completeJob` with `JOB_LEASE_LOST` and the job may execute twice.

### Reproduction (real worker, disposable DB, 2026-11-13 12:43-12:45 GMT)

`long-job-heartbeat-drill.sh` migrates a disposable loopback database
(001..090), then runs
`services/greenfield-worker/tests/worker-liveness.acceptance.test.ts`: it spawns
the real worker (`tsx src/main.ts`, fixed `MODULA_WORKER_ID`), holds
`ACCESS EXCLUSIVE` on `notification_preferences` so one real
`notification.create` job (timeout 600 s) blocks for 90 s, samples every 5 s,
and runs the production healthcheck script each time.

| t (s) | job | heartbeat age (s) | lease remaining (s) | healthcheck |
|---|---|---|---|---|
| 5 | RUNNING | 5 | 60 | healthy |
| 31 | RUNNING | 31 | 34 | healthy |
| 61 | RUNNING | 61 | 4 | healthy |
| 66 | RUNNING | 66 | **-1 (expired)** | healthy |
| 86 | RUNNING | 86 | -21 | healthy |
| 91 | RUNNING | **91** | -26 | **unhealthy: heartbeat age 91s > 90s** |

After the lock was released the job finished `SUCCEEDED`, attempt 1 (no second
worker was running, so nothing reaped it). Result: **FAIL, as expected** -
heartbeat older than 30 s from t=31 s, lease expired from t=66 s, healthcheck
unhealthy at t=91 s. Controls: the same harness with a 10 s block and
`MODULA_WORKER_LIVENESS_CONTROL=1` passes (the test can pass); a 10 s block
without the control flag fails on the >= 90 s acceptance guard (a short run can
never count as acceptance).

The acceptance test is committed **skipped** in normal runs: it only runs with
`MODULA_WORKER_LIVENESS_ACCEPTANCE=1` and `MODULA_TEST_DATABASE_URL`, so
`pnpm worker:test` reports it as skipped (with the reason in its title), never
as passed. It must not be converted to `it.fails`/`it.skip` to turn CI green.

### Forge handoff spec (worker runtime; SENTINEL does not implement it)

1. **Independent heartbeat.** Start a heartbeat timer at boot
   (`setInterval`/self-rescheduling `setTimeout`, every
   `HEARTBEAT_INTERVAL_MS` = 15 s, unref'd, cleared on shutdown) that calls
   `recordHeartbeat` regardless of what the main loop is doing. Never overlap
   writes (skip a tick while one is in flight); keep `recordHeartbeat`'s
   never-throw contract; use the existing pool. Remove or keep the in-loop call
   (harmless). The heartbeat must keep flowing while a job awaits I/O; a
   synchronous CPU-bound job that blocks the event loop may still go stale -
   that is correct.
2. **Lease renewal for long jobs.** While `processOneJob` runs a job, renew its
   lease every `leaseDurationMs / 3` (20 s at the default) with a guarded
   update: `UPDATE background_jobs SET lease_expires_at = now() + leaseDuration,
   updated_at = now() WHERE id = $1 AND lease_owner = $workerId AND status IN
   ('LEASED','RUNNING')`. If the update affects 0 rows the lease was lost: stop
   renewing, record `JOB_LEASE_LOST`, and do not complete/retry the job (the
   existing `completeJob`/`scheduleRetry` guards already refuse). Stop the
   renewal timer in `finally`. Apply the same to event deliveries
   (`events/claim.ts:12,19`) if subscriber timeouts can exceed the lease;
   today they are capped at 30 s (`events/runner.ts:78`).
3. **Optional hardening.** Cap a job's effective timeout or document that
   `timeout_ms` > lease relies on renewal; add metrics `leaseRenewals`,
   `leaseLost`.
4. **Acceptance.** `docs/audits/GF-OPS-01/long-job-heartbeat-drill.sh` (or the
   test directly with `MODULA_WORKER_LIVENESS_ACCEPTANCE=1` and a disposable,
   migrated `MODULA_TEST_DATABASE_URL`) must exit 0 with the default 90 s block:
   heartbeat age <= 30 s at every 5 s sample, the production healthcheck exit 0
   at every sample, `lease_expires_at` in the future at every sample while the
   job is `LEASED`/`RUNNING`, and the job ends `SUCCEEDED` with
   `attempt_count = 1`. Existing worker tests (`heartbeat.test.ts`,
   `lease.test.ts`, `retry.test.ts`, ...) must stay green. SENTINEL will rerun
   the drill against Forge's head.

### Decision: should the healthcheck tolerate a stale heartbeat during a long job?

**No. A stale heartbeat is unhealthy, including during a long job
(fail-closed).** From outside, a loop blocked by a job cannot be told apart from
a hung worker, and while it is blocked the worker is also not heartbeating for
`/v1/status`, not draining the outbox and not reaping leases - it is degraded.
Exempting "worker owns a RUNNING job" would let one hung job mask a dead worker
indefinitely. The threshold stays at 90 s (Docker marks the container unhealthy
after 3 failed checks at 30 s intervals; `restart: unless-stopped` does not
restart unhealthy containers). The correct fix is (c) in the runtime, after
which a long I/O-bound job keeps the worker healthy. #174 author status stays
PARTIAL until Forge lands (c) and the acceptance test passes.

## Files

- `worker-healthcheck-drill.sh`, `long-job-heartbeat-drill.sh`, `drill-lib.sh`:
  loopback-only (`GF_OPS01_PG_ADMIN_URL`, default `127.0.0.1:55491`), databases
  prefixed `gf_ops01_drill_` and dropped on exit; `GF_OPS01_LOG_DIR` for reports.
- `services/greenfield-worker/tests/worker-liveness.acceptance.test.ts`.
