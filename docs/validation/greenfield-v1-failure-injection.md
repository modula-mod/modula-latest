# GreenField v1 failure-injection evidence

Date: 2026-10-15

Environment: isolated API and worker processes against the disposable local
PostgreSQL database `modula_closeout` on port 55473. No production database,
user, registry, media, or installation state was mutated.

## PostgreSQL interruption

The database container was stopped while the API and worker were running.

- API liveness remained HTTP 200.
- API readiness changed to HTTP 500 while PostgreSQL was unavailable.
- The API process remained alive and its pool reconnected after PostgreSQL
  returned.
- Readiness recovered on the second one-second poll, five seconds after the
  restart operation began.
- The worker backed off with jitter and resumed. Its heartbeat was 14 seconds
  old immediately after recovery and became current again.

The first run exposed a real defect: an idle PostgreSQL client emitted an
unhandled pool `error` event and terminated the worker with PostgreSQL code
`57P01`. Both API and worker pool constructors now always install a bounded,
redacted error listener. The repeated interruption passed without either
process exiting. This regression is covered by the API/worker build and test
gates; the observed first-run failure is retained here as incident evidence.

## Connection and transaction pressure

`tools/greenfield-closeout/database-chaos.mjs` is restricted to loopback
databases whose names explicitly contain `closeout`, `test`, or `disposable`.
The 2026-10-15T09:52:10Z run produced:

| Probe | Expected bounded outcome | Observed |
| --- | --- | --- |
| Same-row lock contention | `55P03` lock timeout | PASS in 254 ms |
| Opposite transaction ordering | one `40P01` victim and rollback | PASS in 105 ms |
| Concurrent migration runner | advisory lock serializes runner | PASS; blocked 204 ms |
| Connection saturation | bounded `53300`, then pool recovery | PASS; 3 accepted, 7 rejected, 219 ms |

The saturation probe uses a synthetic role with a three-connection limit,
attempts ten concurrent connections, verifies all rejections are PostgreSQL
`53300`, proves a subsequent query succeeds, and removes the temporary role.

## API restart under traffic

The reusable mixed-load harness ran the non-mutating public-read scenario at
ten clients for 15 seconds with 50 ms think time while the single isolated API
process was stopped and restarted.

- Requests: 2,861
- Throughput: 190.15 requests/second
- p50 / p95 / p99: 0.69 / 11.27 / 13.91 ms
- Maximum latency: 37.07 ms
- HTTP 200: 1,921
- Bounded network failures during restart: 940 (32.86%)
- Corruption or residual writes: none; scenario is read-only

This proves process recovery and measures the failure window, but it does not
claim zero-downtime availability: the current topology has one API instance,
and tool/control-plane latency extended the manual stop/start gap. Multiple API
instances behind nginx are the scale-out trigger for restart-transparent
deployments.

## Graceful termination

- API handled SIGINT and exited with status 0.
- Worker stopped claiming work, drained, closed its database pool, and exited
  with status 0 in approximately one second.
- Shutdown remains bounded by the configured timeout.

## Worker crash and outbox boundaries

The disposable database was seeded with an `audit.checkpoint` job in `RUNNING`
state, owned by a synthetic crashed process, with an expired lease. A fresh
compiled worker process:

- wrote a current heartbeat with the expected release identity;
- reaped the abandoned lease;
- claimed the same durable job as attempt 2;
- completed it exactly once as `SUCCEEDED`;
- cleared the lease owner/expiry; and
- created no failure/dead-letter row.

The worker then handled SIGINT and exited cleanly. The exact synthetic job and
both probe heartbeats were deleted, and zero probe residue was verified.

Lease terminal transitions are now fenced by both job ID and current lease
owner. An automated database test proves a stale crashed worker receives
`JOB_LEASE_LOST` after another worker has reclaimed the job and cannot complete,
retry, or dead-letter the new owner's attempt.

A separate outbox fault-injection test installs a narrowly scoped disposable
trigger that raises after the drain has inserted its background job but before
the source event can be marked published. The entire transaction rolls back:
the event stays unpublished with attempt count zero and no job survives. After
removing the fault, replay creates one job, marks the event published, and a
second drain creates no duplicate. The trigger/function and fixture are removed
by test cleanup.

## Request correlation

Fastify now creates the request ID before it writes the first incoming-request
log. A controlled request with `x-request-id: closeout.trace.001` produced the
same ID in the incoming log, route log, completion log, and response header.
The standard header is preferred, `x-modula-request-id` is retained as a
bounded compatibility alias, and malformed or over-128-character values are
replaced by a UUID rather than reflected or logged.

Automated coverage:

```text
greenfield-v1.request-correlation.test.ts  3 passed
phase7e.error-envelope.test.ts             1 passed
```

## Current verdict

Database interruption, connection saturation, lock contention, deadlock
handling, migration serialization, process shutdown, pending-job reclaim,
outbox transaction rollback/replay, restart recovery, and request correlation
have direct evidence. Deployment-failure recovery and prior-image rollback are
not implicitly covered by these results and remain separate closeout gates.
