# GF-OPS-01 — Production runtime truth vs source (read-only)

Mission: GF-OPS-01 (Wave 0), spec `/workspace/specs/mission-2026-11-13.txt` ("Status discipline",
"Deployment/recovery observations", "Contract for every Grok bot mission").
Captured by: SENTINEL, 2026-11-13 11:37–11:40 GMT (Europe/London, UTC+0).
Method: unauthenticated public HTTPS GETs on `api.modula.digital`, public DNS-over-HTTPS, and source
inspection of a fresh read-only clone. No SSH, no DB connection, no host access, no writes, no secrets read.

## Overall status: PARTIAL

| Half | Status | Why |
|---|---|---|
| Source baseline + compose review | PASS (scope: source review) | Exact main SHA, tree, migration tip, duplicate check, `SOURCE_EXPECTED_MIGRATION` trace completed. |
| Live runtime capture | PARTIAL | API revision, release id, expected migration, readiness, worker heartbeat age, public capabilities, DNS and edge observed. Worker image/heartbeat SHA, direct ledger read, full flags (incl. `MODULA_CALLS_ENABLED`), live nginx, snapshots and backup status are UNKNOWN: no legitimate read-only host/DB access exists on the SENTINEL box. |

## Exact SHAs

| Item | Value |
|---|---|
| `modula-latest` origin/main (verified 2026-11-13 ~11:37 GMT via `git ls-remote` + clone) | `a91d490e61ebfff38069378ddf757429eb000449` (tree `8eb1f04d4658b61caf25d66a1c1dc785dc297a77`) — "Merge pull request #168", committed 2026-11-11 01:17:50 GMT |
| `0840c736e33eb8ded482bc97d940c34b42d9ac9b` (#158 merge) | Tree `f28554fa2f096123c1559eccda8b65a964389821` (matches SENTINEL #158 cert). It is an **ancestor** of main, not main: main = 0840c73 + #166 (`2718d0a9`) + #167 (`088d7cef`) + #168 (`a91d490e`); 20 commits ahead. |
| Source migration tip | `090_calls_v1.sql` (90 up migrations 001–090 + 90 `.down.sql`); no duplicate up-migration numbers on main |
| Live API self-reported commit | `a91d490e61ebfff38069378ddf757429eb000449`, releaseId `greenfield-v1-a91d490e61eb`, builtAt 2026-11-11 01:18:10 GMT |
| Live API expected migration | `090_calls_v1` |

Note on migration count: `services/greenfield-api/migrations/` contains 180 files = 90 up + 90 `.down.sql`;
`uniq -d` on up-file numbers is empty. The 089 collision in the spec concerns signer PR #165 (PR ONLY), not main.

## Key findings

1. **No API revision drift observed**: live `/v1/version` commit == origin/main `a91d490e`. (Self-reported env; image digest/label not observed.)
2. **Migration ledger tip inferred 090_calls_v1** (INFERRED, not read): `/v1/health/ready` = 200 and readiness fails closed on pending/unknown migrations or tip ≠ `MODULA_EXPECTED_MIGRATION` (`services/greenfield-api/src/domains/system/health.ts:10-19`).
3. **Historic snapshots superseded**: `docs/audits/api-atlas-01/00-production-truth.md` (prod 073 at 2026-10-14) and `FEATURE-REALITY-BASELINE.md` (prod 075 at 2026-10-31) are HISTORIC OPEN; production has since advanced to `a91d490e`/090 per public evidence.
4. **Compose default 076 is stale** — see `COMPOSE-EXPECTED-MIGRATION.md`. Severity LOW–MEDIUM: the deploy script always overrides it and fails closed; the risk is manual compose use producing a not-ready API and a misleading `/v1/version.expectedMigration`.
5. **Off-host backup: NOT FOUND IN INSPECTED SOURCE** (no upload/remote transport in `ops/backup/*`; SPOF register and `postgres-restore.md` still describe same-VPS copies). Live status UNKNOWN.
6. **Calls flag**: source default OFF (`MODULA_CALLS_ENABLED` must equal `true`, `services/greenfield-api/src/config/env.ts:148`); calls code (090) is live, but the runtime flag value is UNKNOWN.

## Files

- `RUNTIME-SNAPSHOT.md`, `runtime-snapshot.json` — per-field value or UNKNOWN, source, GMT timestamp, method.
- `DRIFT.md` — source vs runtime.
- `COMPOSE-EXPECTED-MIGRATION.md` — 076 default analysis and fix.
- `evidence/` — raw public responses (headers + bodies) and DoH answers. Contains no secrets, cookies or tokens.

## Missing evidence to reach PASS (needs owner-approved read-only access)

- `docker image inspect` labels/digests for running api + worker containers; `greenfield_worker_heartbeats.release_sha`.
- Direct `node dist/scripts/db-status.js` (or `SELECT` on migration ledger) output.
- Flag inventory from `/etc/modula/*.env` as NAMES + present/redacted, incl. `MODULA_CALLS_ENABLED` value (boolean is not a secret).
- `nginx -T` diff vs `ops/nginx/api.modula.digital.greenfield.conf` at `a91d490e`.
- `last-success.json` marker, `systemctl list-timers modula-greenfield-backup.timer`, provider snapshot list, and proof of any independent off-host encrypted copy + restore drill.

## Delivery

SENTINEL performs no GitHub writes. This directory is committed locally on branch
`docs/gf-ops-01-runtime-truth` off `a91d490e` in a SENTINEL clone and exported as a `git format-patch`
for ATLAS to push and open as a PR (do not merge without review).
