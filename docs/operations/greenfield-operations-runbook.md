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
start worker, require current heartbeat, then smoke. If startup fails after a
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
