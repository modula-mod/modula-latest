# GF-TEST-DB-01 — DB-gated Vitest suites in CI

Mission GF-TEST-DB-01 (GF-RECON-01 queue). Base: `modula-latest` main
`396597159782edcf7a7a9fbd7230fb0a11b1ae96` (after #190). No migration and no
new dependencies. Product edits are: an optional test-only filter on
`claimNextJob` / `processOneJob` so suites sharing CI's disposable database
cannot claim one another's leftover QUEUED jobs; and `listModules` skipping
published releases that have no `manifest.compatibility` so the product
listing cannot 500 the whole catalogue. Suites that failed under CI's restricted roles, or that need
something the `migration-validation` job does not provide, are listed below
and were left out.

## Change

Many Vitest files use `describe.skip` without `MODULA_TEST_DATABASE_URL`.
`pnpm api:test` / `pnpm worker:test` in `repository-validation` have no
database, so those files exit 0 as skipped. The `migration-validation` job
already ran a first set (migrations, API-FIX-01, MP02, messaging v3, calls,
native endpoints, worker lease-renewal / VoIP / push). This mission wires the
remaining suites that pass against the job's disposable `postgres:16` service
and restricted roles.

`.github/workflows/api-atlas-contract-drift.yml` → `migration-validation` adds
five steps. Each writes a Vitest JSON report and runs
`scripts/assert-vitest-db-suites-ran.mjs`, so a skipped, empty or failed file
fails the job.

| Step | Files | Tests | Local duration |
|---|---:|---:|---:|
| GF-TEST-DB-01 worker leftover database integration | 4 | 11 | 6.77 s |
| GF-TEST-DB-01 accounts, social and messaging database integration | 15 | 88 | 36.79 s |
| GF-TEST-DB-01 backend v1 ledger and fabric database integration | 10 | 31 | 11.95 s |
| GF-TEST-DB-01 module, registry and product database integration | 15 | 135 | 28.49 s |
| GF-TEST-DB-01 phase 7, premium, GUBIC and API integration | 18 | 113 | 31.85 s |
| **Total added** | **62** | **378** | **~116 s** |

Local evidence: disposable PostgreSQL on `127.0.0.1:55533` with the CI dummy
role passwords from `ops/docker/postgres/init-roles.sh`, fresh database
`modula_ci_gf_test_db`. CI uses `postgres:16`; the local cluster is not PG16.
Group C and D/E wall-clock times include one excluded failing file each
(those hooks returned in tens of milliseconds and do not change the
"reasonable CI time" conclusion).

`greenfield.accounts.test.ts` was re-run after the other new groups on the
same database (734 leftover `QUEUED` worker jobs) and still passed 13/13,
including mail-identity provisioning (priority luck). That path is now
scoped to the account's own mail-identity job ids, so leftovers can no
longer starve `processMailIdentityUntil`.

## Inventory

Every Vitest file that skips without a database URL is listed here, plus a
few close cousins.

### Already in `migration-validation` (27 files)

API: `settings-v2.integration.test.ts`,
`greenfield-backend-v1.migration-ledger-security.test.ts`,
`api-fix-01.migration.test.ts`, `api-fix-01.reaction-dead-letter-retry.test.ts`,
`api-baseline-02.security-acceptance.test.ts`, `api-fix-01.follow-privacy.test.ts`,
`registry-trust.signing.test.ts`, `registry-release-retrofit-signing.test.ts`,
`registry-trust.trust-block.test.ts`, `module-version-switch.test.ts`,
`module-platform-02.records.test.ts`, `permission-reconciliation.test.ts`,
`module-platform-02b.media-sharing.test.ts`,
`module-platform-02b.functions-actions.test.ts`,
`module-platform-02b.search-contract.test.ts`,
`module-platform-02b.canonical-mutations.test.ts`,
`messaging-v3.integration.test.ts`, `calls.integration.test.ts`,
`gf-native-endpoints.integration.test.ts`.

Worker: `phase7e.notifications.test.ts`, `media-cleanup.test.ts`,
`module-trust-guard.test.ts`, `legacy-installation-data-migration.test.ts`,
`phase7e.vault-notes-search-projector.test.ts`, `push.voip.test.ts`,
`push.dispatch.test.ts`, `lease-renewal.integration.test.ts`.

(`module-platform-02b.search-contract.test.ts`,
`module-platform-02b.canonical-mutations.test.ts` and
`module-trust-guard.test.ts` are already listed in the job; they are not all
`describe.skip` without a DB URL.)

### Added by this PR (62 files, 378 tests)

Worker leftovers: `lease.test.ts`, `outbox-atomicity.test.ts`,
`phase7e.event-delivery.test.ts`, `phase7e.search-projector.test.ts`.

Accounts, social and messaging: `greenfield.accounts.test.ts`,
`greenfield-backend-v1.account-data.test.ts`,
`greenfield-backend-v1.apple-auth.test.ts`, `push.routes.test.ts`,
`messaging.integration.test.ts`, `phase6.security.test.ts`,
`phase6s.social.test.ts`, `communities.integration.test.ts`,
`collections-drafts.integration.test.ts`, `story-dm-replies.integration.test.ts`,
`sticker-packs.integration.test.ts`, `phase7i.f5-stories.test.ts`,
`phase7l.profile-update.test.ts`, `post04.attachments.test.ts`,
`greenfield-backend-v1.social-completion.test.ts`.

Backend v1 ledgers and fabrics: `greenfield-backend-v1.ai-engine.test.ts`,
`greenfield-backend-v1.data-ledger.test.ts`,
`greenfield-backend-v1.entitlements-usage.test.ts`,
`greenfield-backend-v1.extension-ai-prompt.test.ts`,
`greenfield-backend-v1.developer-domain.test.ts`,
`greenfield-backend-v1.build-release.test.ts`,
`greenfield-backend-v1.engine-fabric.test.ts`,
`greenfield-backend-v1.provider-fabric.test.ts`,
`greenfield-backend-v1.service-fabric.test.ts`,
`migration-privilege-rollback.test.ts`.

Module, registry and product: `module-settings-permissions.test.ts`,
`registry-trust.assets.test.ts`, `registry-trust.github-sync.test.ts`,
`registry-listing.compatibility.test.ts`,
`registry-trust.identity-aliases.test.ts`,
`registry-trust.install-descriptor.test.ts`,
`registry-trust.installed-state.test.ts`,
`publisher-console.release-jobs.test.ts`,
`publisher-first-party-policy.test.ts`, `moliboo-game.integration.test.ts`,
`moliboo-signed-packs.integration.test.ts`, `gf-mod-01.artifact-closure.test.ts`,
`gf-mod-02.presentation-blobs.test.ts`, `greenfield-mps-v1.publish.test.ts`,
`greenfield-product-frontend-v1.runtime.test.ts`.

Phase 7, premium, GUBIC and API: `phase7b.module-runtime.test.ts`,
`phase7d.connection-lifecycle.test.ts`, `phase7d.connector-security.test.ts`,
`phase7d.runtime-sessions.test.ts`, `phase7e.ai-platform-foundation.test.ts`,
`phase7e.ai-product-actions.test.ts`, `phase7e.ai-provider-runtime.test.ts`,
`phase7e.internal-events.test.ts`, `phase7e.module-backend-runtime.test.ts`,
`phase7e.policy-audit-notifications.test.ts`, `phase7e.search-platform.test.ts`,
`api.integration.test.ts`, `gubic.play.integration.test.ts`,
`premium.apple-sandbox.integration.test.ts`, `premium.integration.test.ts`,
`pvp-platform-2.extension-fabric.test.ts`,
`support-status.integration.test.ts`,
`synthetic-module-intelligence.integration.test.ts`.

### Left out — environment the job does not provide

| File | Reason |
|---|---|
| `services/greenfield-api/tests/phase7e.vault-notes-platform.test.ts` | Needs a sibling `modula-vault-notes` checkout (`resolveVaultNotesRoot` / `module.manifest.json`). `migration-validation` does not check that repository out (`repository-validation` does). |
| `services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts` | Needs sibling Vault Notes / formatting / AI / voice checkouts and `execFileSync('git', ['show', ...])` against those repos. |
| `services/greenfield-api/tests/gai01.integration.test.ts` | Ten tests are unconditional `it.skip`. The zero-skip guard would fail the step even with a database. |
| `services/greenfield-api/tests/n4-foryou-private-author.test.ts` | Skips unless both `DATABASE_URL`/`GREENFIELD_DATABASE_URL` and a live `GREENFIELD_API_BASE`/`API_BASE` are set. The job has neither a live API nor those env names. |
| `services/greenfield-worker/tests/worker-liveness.acceptance.test.ts` | Opt-in 90 s-class drill; skipped unless `MODULA_WORKER_LIVENESS_ACCEPTANCE=1`. |
| `tests/phase7l-b-auth-regression.test.ts` and other Playwright files under `tests/` | Not Vitest `describe.skip` suites for this job; they need a browser and (for the auth regression) a running API. The auth regression throws if no DB URL is set rather than skipping. |

### Left out — findings under CI roles (no product fix in this PR)

These were run locally against the same restricted roles CI uses
(`modula_migrator` / `modula_worker` / `postgres` admin URL). They failed.
Product code was not changed; the files stay out of the job.

| File | Result | Finding |
|---|---|---|
| `services/greenfield-api/tests/greenfield-backend-v1.module-owned-backend.test.ts` | 0 passed / 4 skipped; `beforeAll` / `afterAll` failed | The suite builds an "admin" connection by rewriting only the database name on `MODULA_TEST_DATABASE_URL`, so it connects as `modula_migrator`. That role cannot `CREATE ROLE` / `DROP ROLE` (`permission denied to create role`). The job's admin URL is not used. |
| `services/greenfield-api/tests/greenfield-mps-v1.ingest.test.ts` | 9 passed / 1 failed | `lets the API runtime role ingest and read family, relationship, asset, privacy, and alias rows` failed with `permission denied to set role "modula_api"`. The test connects as the migrator and `SET ROLE modula_api`; `init-roles.sh` does not grant `modula_api` to `modula_migrator`. |
| `services/greenfield-api/tests/phase7e.module-runtime-2.test.ts` | 5 passed / 1 failed | `rolls the Standard 2 runtime migration down and back up on an isolated database` (gated on `MODULA_TEST_ADMIN_DATABASE_URL`) creates a new database as `postgres`, then runs `migrateUp` as `modula_migrator` on that database. `CREATE TABLE schema_migrations` fails with `permission denied for schema public` (the new database's `public` schema is not owned by the migrator). |

## Job isolation (shared-database flake)

On a shared database, leftover `QUEUED` jobs from another suite can be
claimed by tests that call `claimNextJob` or `processOneJob` without a
scope. The flake on main `5d00c7d3`: `lease.test` `reclaims a crashed
worker lease` sometimes claimed a leftover `gf-ops-01c-*` job from
`lease-renewal.integration` (priority `-1_000_000_000` beats the lease
test's `-1_000`). Under concurrent load this failed locally (1/3 in the
pre-fix repro; Sentinel reported 2/3). More generally, `processMailIdentityUntil`
capped at 200 unscoped claims, so a polluted queue can starve the accounts
mail-identity test.

The fix is an optional `ClaimJobFilter` (`idPrefix` and/or `jobIds`) on
`claimNextJob` and `processOneJob`. Production callers omit it, so the
claim SQL and semantics are unchanged. An explicit empty `jobIds` list
matches nothing (`AND false`) and does not fall back to an unscoped claim.

Test scopes:

- `lease.test.ts` — `idPrefix: 'test-lease-'` (crash-reclaim ids unified to
  that prefix); `afterAll` deletes the file's jobs and `job_failures`.
- `lease-renewal.integration.test.ts` — `idPrefix: 'gf-ops-01c-${suffix}-'`.
- `phase6.security.test.ts` SKIP LOCKED case — `idPrefix: 'test-phase6-lease-'`.
- `greenfield.accounts.test.ts` `processMailIdentityUntil` /
  `processMailEventUntil` — `jobIds` for that account's
  `job-mail-identity-*` / `job-mail-forward-*` rows, looked up from
  `greenfield_mail_identity_requests`.

`worker-liveness.acceptance.test.ts` still starts the real worker
(unfiltered production claim). It is opt-in and not in this job.

## Listing incomplete published releases (product fix)

`GET /v1/registry/products` (and `GET /v1/registry/modules`) walks every
published release and used to throw at
`manifest.compatibility.platforms` when a release had no
`compatibility` field. That 500'd the whole list. Sentinel reproduced
this on a shared CI database after earlier steps left incomplete
published rows (for example `audit.module.alpha-*`; some
`test.modula.*` fixtures are already hidden by beta catalogue policy
and do not reach that line).

`listModules` now skips a release with a missing or non-object
`manifest.compatibility`, the same `continue` path already used for
entries the catalogue cannot show, and writes a structured warning
(`moduleId`, `releaseId`, `version`,
`reason: missing_manifest_compatibility`) with no secrets or manifest
payload. The rest of the list still returns 200. Covered by
`registry-listing.compatibility.test.ts`. Production claim and
install/publish behaviour are unchanged.

## Scope

No migrations, no new dependencies, and no SYNAPSE-owned files. Production
claim semantics are unchanged. The listing skip is the narrow product fix
for incomplete published releases; install and publish behaviour is
unchanged. Not merged and not deployed; merging stays with ATLAS after
Sentinel certifies.
