# GF-OPS-01 — `SOURCE_EXPECTED_MIGRATION` default 076 vs source tip 090

Source: `modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449`.

## Finding

`ops/docker/compose.production.yml` hard-codes a stale fallback, introduced in `834524a4`
(2026-10-25, "checkpoint: preserve inherited premium candidate"):

| File:line | Text |
|---|---|
| `ops/docker/compose.production.yml:59` | api build label `org.modula.migration.expected: ${SOURCE_EXPECTED_MIGRATION:-076_greenfield_premium_entitlements}` |
| `ops/docker/compose.production.yml:79` | api env `MODULA_EXPECTED_MIGRATION: ${SOURCE_EXPECTED_MIGRATION:-076_greenfield_premium_entitlements}` |
| `ops/docker/compose.production.yml:112` | worker build label (same default) |
| `ops/docker/compose.production.yml:132` | worker env (same default) |

Source tip is `090_calls_v1` (14 migrations newer).

## How the value is used

| File:line | Use |
|---|---|
| `ops/deploy/greenfield-production.sh:43-46,74-77` | `--expected-migration` is mandatory and regex-validated |
| `ops/deploy/greenfield-production.sh:147` | `export SOURCE_EXPECTED_MIGRATION="${EXPECTED_MIGRATION}"` before build — the default is never used by the sanctioned deploy |
| `ops/deploy/greenfield-production.sh:154-158` | image label `org.modula.migration.expected` must equal the argument |
| `ops/deploy/greenfield-production.sh:164-172` | ledger `applied.at(-1)` must equal the argument, no pending/unknown |
| `services/greenfield-api/src/config/env.ts:37,525` | `MODULA_EXPECTED_MIGRATION` → `config.expectedMigration` |
| `services/greenfield-api/src/domains/system/health.ts:16-19` | `/v1/health/ready` returns not-ready "migration mismatch" if ledger tip ≠ expected |
| `services/greenfield-api/src/app/register-routes.ts:151` | published publicly as `/v1/version.expectedMigration` |
| `tools/api-atlas/release-lineage.mjs:49` | `publicMigrationExpected: version.expectedMigration === migration` |
| `docs/ops/calls-coturn.md:99` | instructs setting `SOURCE_EXPECTED_MIGRATION=090_calls_v1` |
| `docs/operations/api-atlas-acceptance.md:21` | runbook runs `docker compose -f ops/docker/compose.production.yml run …` directly (default applies if the variable is not exported) |
| CI (`.github/workflows/api-atlas-contract-drift.yml`) | no check on the compose default |

## Assessment

- **Cannot pass the deploy gate.** The sanctioned script always exports the real value and checks
  label + ledger against it. A stale default cannot make a wrong deploy look correct there.
- **Fails closed, not open.** If someone runs `docker compose … up -d` by hand (e.g. host recovery,
  coturn/calls rollout, the api-atlas runbook) with `SOURCE_RELEASE_SHA`
  exported but not `SOURCE_EXPECTED_MIGRATION`, the containers get `076`, ledger tip is `090`, and
  `/v1/health/ready` returns "migration mismatch" → readiness outage, not a silent pass.
- **Misleading.** In the same case, image labels and public `/v1/version.expectedMigration` would
  claim `076`, and `release-lineage` would compare against a wrong value. A stale default in a
  production file also invites "fixing" the ledger instead of the env.
- If `SOURCE_RELEASE_SHA` is also unset, compose fails earlier on an invalid image tag, so the
  realistic trigger is partial manual env.

**Severity: LOW–MEDIUM** (availability + operator confusion; no integrity/security bypass found).
Live impact today: none observed — production reports `expectedMigration: 090_calls_v1` and ready=200.

## Recommended fix (not implemented — production config change needs owner approval)

1. Remove the fallback and require the variable, in all four places:
   `${SOURCE_EXPECTED_MIGRATION:?SOURCE_EXPECTED_MIGRATION must be set to the target migration id}`.
   Same treatment for `SOURCE_RELEASE_SHA` and `SOURCE_BUILT_AT`. Compose then refuses to build/run
   instead of publishing a wrong value.
2. Add a CI check (cheap, no secrets) that fails if `compose.production.yml` contains a hard-coded
   `NNN_*` migration default, and/or that a release pin equals the highest up-migration in
   `services/greenfield-api/migrations/`.
3. Update `docs/operations/api-atlas-acceptance.md` (and any host-recovery runbook) to export
   `SOURCE_RELEASE_SHA` / `SOURCE_EXPECTED_MIGRATION` (or call the deploy script) before any compose use.
4. Validate in isolated staging with `docker compose config` (expect a hard error when unset).
