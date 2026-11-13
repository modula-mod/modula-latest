# GreenField v1 operations runbook

## Alerts

Page: API public live down for 2 consecutive minutes; ready down for 2 minutes;
PostgreSQL unavailable; worker heartbeat older than 60 seconds; disk at or above
95%; backup older than 26 hours; new critical integrity result; active untrusted
installation; or TLS expiry below 14 days. Warn: disk at 90%; inode use at 85%;
DB connections above 70% of `max_connections`; dead letters increasing; 5xx
above 2% for 5 minutes; p99 above the measured budget; TLS below 30 days.
De-duplicate by failure class and clear only after two healthy observations.

## Disk pressure

At 90%, stop nonessential image builds, inventory Docker images/build cache,
journals, PostgreSQL, media, artifacts, and backups. Reclaim only old build
cache first. Preserve current and accepted rollback images and do not prune
volumes. At 95%, freeze deploys/uploads, verify a current backup, reduce safe
journal/cache retention, and escalate the largest measured owner. Never delete
PostgreSQL files, media, artifacts, or backups ad hoc. Media/artifact GC is
dry-run first and reference-aware. Database growth is handled through retention
policy or capacity expansion, not filesystem deletion.

## Signer or release compromise

Identify the exact key/release and evidence; revoke in the registry; stop rollout;
inventory affected releases/installations; verify new install/update/artifact
authorization is blocked; register a replacement public key; and re-sign only
independently re-built, digest-verified artifacts. Never reuse a compromised key
or fabricate provenance. Preserve audit records.

## Secrets

Rotate one credential class at a time with overlap where supported: install new
DB/provider/session/SMTP/GitHub material in the documented secret source,
restart the narrow consumer, verify, then revoke old material. The offline
release signing private key never resides on production. Documentation records
only environment variable names and `PRESENT`, `MISSING`, or `DISABLED`.

## Failed deploy and rollback

Acquire the deployment lock. Verify exact merged SHA and backup. Build immutable
API/worker images, migrate under the advisory lock, start API, require ready,
start worker, require current heartbeat (worker container `healthy`), then smoke. If startup fails after a
forward-compatible migration, start the accepted prior images and run smoke. If
the prior application is not compatible with the forward database, stop writes
and restore the verified pre-deploy backup plus prior media/artifact/config set.
Never use a lossy down migration as the production recovery plan.

Migration `074_greenfield_v1_query_indexes` builds two evidenced partial
indexes with ordinary transactional `CREATE INDEX`. The complete migration
took 0.90 seconds on the 1.3 GB closeout fixture (100k records / 25k shares),
but it briefly blocks writes to those two tables. Apply it only under the
deployment and database advisory locks in the maintenance window; abort before
cutover if the production lock wait exceeds the operator budget.

## Release identity for hand-run Compose commands (GF-OPS-01)

`ops/docker/compose.production.yml` has no defaults for `SOURCE_RELEASE_SHA`,
`SOURCE_BUILT_AT` or `SOURCE_EXPECTED_MIGRATION`; every `docker compose -f
ops/docker/compose.production.yml ...` invocation (including `ps`, `logs`,
`exec` and `run`) fails fast with `required variable ... is missing a value`
until they are set. The previous `076_greenfield_premium_entitlements` default
let a hand-run container advertise a stale expected migration and fail
readiness. `ops/deploy/greenfield-production.sh` exports all three from
`--expected-sha` / `--expected-migration`. For ad-hoc commands against the
running release, load its non-secret labels first:

```sh
eval "$(ops/deploy/running-release-env.sh)"
docker compose -f ops/docker/compose.production.yml ps
```

Never type a migration id from memory; it must equal the source tip of the
deployed SHA (`ls services/greenfield-api/migrations | grep -v '\.down\.' | tail -1`).
CI enforces this with `pnpm verify:greenfield-v1-deploy-safety`
(`scripts/verify-compose-release-pins.mjs`).

## Worker health (G033)

The production worker has a Docker healthcheck
(`ops/docker/greenfield-worker-heartbeat-healthcheck.cjs`, mounted read-only).
It reads `greenfield_worker_heartbeats` with the worker's own database role and
reports healthy only when the heartbeat row of this worker - exact
`MODULA_WORKER_ID` and `MODULA_RELEASE_SHA`, both required - started after the
container started and is at most 90 seconds old (the same threshold
`/v1/status` uses for `operational`). Compose pins
`MODULA_WORKER_ID=greenfield-worker-<SOURCE_RELEASE_SHA>`, overriding any value
in `/etc/modula/greenfield-worker.env`, so another process's heartbeat can never
make this container read healthy. The service is single-instance: do not scale
it, and give any one-off `compose run greenfield-worker` its own
`MODULA_WORKER_ID`, because the id is also the job lease owner.

A worker whose loop is blocked by a long job is reported **unhealthy on
purpose** (fail-closed): until GF-OPS-01 (c) lands in the worker runtime the
heartbeat, outbox drain and lease reaper all share the job loop, so a blocked
loop is indistinguishable from a hung worker. See
`docs/audits/GF-OPS-01/README.md`.
It publishes no port and never prints the database URL. Override the threshold
with `MODULA_WORKER_HEALTHCHECK_MAX_AGE_SECONDS` in the worker env file only
with a recorded reason. An `unhealthy` worker is not restarted automatically;
treat it like the 60-second heartbeat page above. `scripts/verify-greenfield-backend-v1.mjs`
now requires the worker container to be `running|healthy|0`.

## Dead letters and outbox

Inspect by job/event type and error class. Replay is selected, dry-run by
default, idempotent, and subject to current trust/permission checks. Do not bulk
replay legacy evidence or bypass current authority. Preserve failure evidence;
`reaction 23505` history attached to succeeded jobs is not an active failure.

## Retention

Security/action audit evidence: retain according to the dedicated audit policy,
never generic cache cleanup. User records follow account/module retention and
deletion semantics. Installation history, release provenance, signer/revocation
evidence, and deletion tombstones are retained independently of user content.
Backups target 14 daily, 8 weekly, and 12 monthly recovery points, subject to
measured capacity and an independent encrypted copy.
