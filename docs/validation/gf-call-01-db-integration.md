# GF-CALL-01 — Calls v1 and messaging v3 database integration in CI

Mission GF-CALL-01 (GF-RECON-01 queue #3). Base: `modula-latest` main
`a91d490e61ebfff38069378ddf757429eb000449`, migration tip `090_calls_v1`.
No migration, route, runtime or feature-flag change. `MODULA_CALLS_ENABLED`
stays off by default; only the calls integration suite turns it on for its own
in-process test server.

## Change

The DB-gated suites below use `describe.skip` without
`MODULA_TEST_DATABASE_URL`, and were not listed in the `migration-validation`
job, so CI only ever reported them as skipped (from `pnpm api:test` /
`pnpm worker:test` in `repository-validation`, which has no database).

`.github/workflows/api-atlas-contract-drift.yml` → `migration-validation` now
runs, against the job's disposable `postgres:16` service and restricted roles:

| Step | Suites |
|---|---|
| Messaging v3 and calls v1 database integration | `services/greenfield-api/tests/messaging-v3.integration.test.ts`, `services/greenfield-api/tests/calls.integration.test.ts` |
| Calls v1 VoIP and push dispatch worker database integration | `services/greenfield-worker/tests/push.voip.test.ts`, `services/greenfield-worker/tests/push.dispatch.test.ts` |

Each step writes a Vitest JSON report and runs
`scripts/assert-vitest-db-suites-ran.mjs`, which fails the step if any listed
file is missing from the report, collected zero tests, or has any test that did
not pass (skipped, todo or failed). A silently skipped DB suite is therefore a
CI failure, not a green run.

## Acceptance matrix

Local evidence: disposable PostgreSQL 17.5 cluster on `127.0.0.1` with the CI
dummy role passwords (`ops/docker/postgres/init-roles.sh`), fresh database,
every `migration-validation` step executed in order from the workflow file.
CI uses `postgres:16`; PG16 itself was not run locally.

| Case | Test | Result |
|---|---|---|
| Auth required on every calls route; capability advertised | calls › requires authentication on every calls route… | PASS |
| Idempotent start/accept/end, replay vs conflicting key, stale revision, role checks | calls › runs ring, accept and end with idempotent commands… | PASS |
| Accepted-DM requirement, blocks both ways, call privacy (video off / nobody), busy, glare, ring/connect timeouts | calls › enforces accepted DMs, blocks, privacy… | PASS |
| TURN credentials: participants only, coturn REST HMAC, 600 s TTL, budget, denied after end | calls › issues TURN credentials only to authorized participants… | PASS |
| VoIP registration ownership (other user's device rejected, topic pinned, owner-only delete) and invitation lifecycle | calls › registers PushKit tokens against owned devices only… | PASS |
| Signalling ticket: missing/garbage/bearer/other-call rejected, single use (replay → 401), only hash stored | calls › rejects signalling upgrades without a valid single-use ticket… | PASS |
| Signalling ticket expiry (60 s TTL, expired → 401), supersede on reissue, revoke on terminal call, no ticket for ended call (**added by GF-CALL-01**) | calls › rejects expired, superseded and terminal-call signalling tickets | PASS |
| Foreground call notice over the messaging socket | calls › tells foreground devices about calls over the messaging socket | PASS |
| Calls hidden when not configured | calls › hides calls entirely when the server is not configured for them | PASS |
| VoIP push: ringing only, ring-window retry then expiry, invalid token disables only the VoIP registration | worker push.voip (live Postgres) | PASS |
| Push retry then dead-letter after max attempts; invalid token pruning; quiet hours | worker push.dispatch (live Postgres) | PASS |
| Messaging v3: auth on every route, capabilities, socket auth, groups/roles/blocks, receipt privacy, typing, search scope, presence, voice-note privacy, `clientMessageId` idempotency, push preview/mute/mention/block | messaging-v3 (11 tests) | PASS |

Counts (local, with database): API 20 run / 0 skipped (messaging v3 11, calls
9); worker 12 run / 0 skipped (push.voip 8, push.dispatch 4). Without a
database: API 0 run / 20 skipped; worker 4 run / 8 skipped, and the guard fails
both steps.

## Not covered (out of scope)

- No real Coturn, APNs/PushKit, device or multi-replica transport: those are
  GF-CALL-02 / GF-CALL-03 / GF-CALL-04. These suites are not production or
  device acceptance.
- `services/greenfield-api/tests/messaging.integration.test.ts` (legacy
  messaging) is also DB-gated and still not in `migration-validation`.
