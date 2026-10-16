# GreenField v1 observability and alerting

GreenField deliberately uses a lightweight VPS-native observability baseline.
It is sufficient only when the following machine-readable probes are scheduled
and their non-zero exits are delivered to an operator.

`scripts/greenfield-v1-observability.mjs` reports request volume, status-family
counts, p50/p95/p99/max latency, the latest worker counters, worker error logs,
PostgreSQL connections, queued/running/dead-letter jobs, failure history,
heartbeat age, database size, container CPU/memory/PIDs/network/block I/O, and
host disk availability. `scripts/greenfield-v1-health.mjs` is the non-mutating
daily health subset. `scripts/greenfield-v1-smoke.sh` is the release acceptance
suite and exits non-zero on any required failure.

API request logs are structured JSON and contain timestamp, level, request ID,
method, route, status, and duration. Incoming safe request IDs are preserved;
otherwise the API generates one before the first request log and returns it in
`x-request-id`. The same identifier is available to outbox/job/function/action
records where those operations cross a durable boundary. Worker logs emit
machine-readable cumulative counters every 60 seconds for claims, completions,
retries, dead letters, outbox drain, and ingestion.

Logs must never contain authorization headers, passwords, provider keys,
session material, signing private keys, private intelligence content, or raw
module payloads. Synthetic redaction probes are part of release acceptance.
Docker JSON logs, nginx logs, and the systemd journal are covered by the host
rotation policy; disk alerts remain the final guard against failed rotation.

Alert thresholds and de-duplication are canonical in
`docs/operations/greenfield-operations-runbook.md`. At minimum the alert
transport must cover API/ready failure, stale worker heartbeat, database
unavailability or saturation, disk/inodes, backup failure/age, rising dead
letters, sustained 5xx, and TLS expiry.

The production baseline collected on 2026-10-15 reported 20 sampled API
requests, all 2xx, p50 0.34 ms and p95/p99 0.44 ms; two database connections of
100; a current worker heartbeat; and zero active event dead letters. Twelve
terminal background jobs were identified as old, understood operational states
and are handled only through the bounded audited closeout tool—failure history
is never erased.
