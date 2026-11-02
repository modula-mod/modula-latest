# GREENFIELD FEATURE REALITY 01 — PR-01 Moliboo signed packs and stickers

MISSION ITEM: PR-01 — MOLIBOO SERIES 2 SIGNED PACK DELIVERY
STATUS: PARTIAL
BRANCH: `feat/qa-moliboo-series2-packs`
PR URL: `https://github.com/modula-mod/modula-latest/pull/147`
BASE SHA: Initial implementation base `bae20cebb48685c56ed5ccfe5537f121e3f36110`; reconciled review base is current main `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`
HEAD SHA: The exact live branch tip is maintained in draft PR #147 because a Git commit cannot embed its own SHA.
ROUTES ADDED: 9
ROUTES MODIFIED: 1
ATLAS UPDATED: YES
MIGRATIONS: `084_moliboo_signed_packs`
TESTS PASSED: 42 distinct focused feature/migration/registry compatibility tests plus the full workspace typecheck and 103 Atlas checks
TESTS FAILED: 0 final acceptance tests
TESTS SKIPPED: 0 in the reported suites
SECURITY RESULTS: PASS for implemented server boundaries
QA INTEGRATION RESULTS: PASS for persisted server/API flows; native runtime execution remains unrun
NATIVE COMPATIBILITY: Exact existing catalogue, descriptor, content container, digest-signature and limit contracts are implemented; iOS simulator/device install evidence is not available on this VPS
BLOCKERS: Actual native PackageManager install/update/failed-update rollback was not executed; no production signing or publication is authorized
APPROVAL REQUIRED: Andy must approve merge, deployment and any package publication

## Outcome

The GreenField candidate now provides persistent, cryptographically verified Moliboo Series 2 delivery, server-authoritative ownership/outfit state, QA withdrawal/restoration, and signed Sprout sticker delivery through the existing release, signing-key, artifact and PackageManager trust architecture.

The server implementation and isolated QA evidence pass. The mission item remains `PARTIAL`, not `PASS`, because this Linux VPS did not execute the native iOS PackageManager through a real install, update and failed-update rollback. The raw native catalogue and its cryptographic contract were exercised through the compiled server runtime, and the exact descriptor/signature algorithm was verified in integration tests, but those facts do not substitute for native runtime acceptance.

## Isolation and production protection

- Implementation worktree: `/root/modula-worktrees/greenfield-feature-reality-01`.
- Production checkout `/root/modula-latest` was not modified.
- Disposable PostgreSQL container: `modula-feature-reality-01-pg`.
- Container labels: `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01` and `digital.modula.scope=qa-disposable`.
- PostgreSQL is published only on loopback `127.0.0.1:55483`.
- Fixture database: `modula_feature_reality_01_pr01`.
- Cross-workstream media-constraint regression database: `modula_feature_reality_01_pr01_media_reconcile_20261102`.
- The one-use QA private signing key was stored outside the repository with mode `0600` and deleted after fixture creation. Only public-key/signature evidence remains in QA.
- No production database, storage, signing key, package release, deployment or billing system was changed.
- No package was published publicly.

## Routes added

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/moliboos/packs` | Bounded, filterable catalogue of latest approved trusted packs |
| GET | `/v1/moliboos/packs/catalog.json` | Exact raw catalogue consumed by the current native PackageManager |
| GET | `/v1/moliboos/packs/:packId/manifest` | Trusted immutable install descriptor by package/version |
| GET | `/v1/moliboos/packs/:packId/download` | Immutable content-only package bytes |
| GET | `/v1/me/moliboos/ownership` | Account-scoped server-authoritative inventory |
| GET | `/v1/me/moliboos/outfit` | Persisted equipped state and synchronization revision |
| PUT | `/v1/me/moliboos/outfit` | Atomic ownership-checked optimistic-concurrency outfit replacement |
| POST | `/v1/admin/qa/moliboos/packs/:packId/withdraw` | QA/development-only audited release withdrawal |
| POST | `/v1/admin/qa/moliboos/packs/:packId/restore` | QA/development-only cryptographically revalidated restoration |

## Route modified

`GET /v1/stickers/packs` now retains legacy emoji-pack compatibility while adding bounded pagination, Series filtering, signed Sprout pack metadata, immutable PNG delivery facts and fail-closed live trust checks. Existing comment media now resolves sticker identity, pack, label and emoji server-side; forged client metadata is ignored and unknown stickers are rejected.

## Data model and migration

Migration `084_moliboo_signed_packs` adds:

- immutable direct artifact-signature evidence bound to the existing publisher key registry;
- Moliboo character and signed release projections;
- append-only package availability events;
- character fields and idempotent grant evidence added to the existing canonical migration-083 item/inventory tables;
- a single-active-character projection added to the existing canonical equipped-state table;
- signed sticker pack and sticker projections;
- bounded catalogue/access indexes and database uniqueness constraints;
- the Moliboo content media type in the existing immutable artifact blob inventory while preserving the already-shipped web-runtime and GUBIC game-web media types.

No parallel Moliboo ownership or outfit tables remain. The API reads and writes `greenfield_moliboo_inventory` and `greenfield_moliboo_equipped`, alongside the game system already present on main. The down migration is deliberately signed-pack-empty-state-only: it retains the canonical migration-083 tables, restores their original constraints/columns, and refuses to run when release, signature, character grant or active outfit data exists. Persistent recovery is a pre-084 database backup plus prior retained application images, not destructive down migration.

Recovery evidence:

1. A new database applied the full current-main chain plus migration 084.
2. Status reported migration 084 applied, with zero pending or unknown migrations.
3. Empty migration 084 rolled back to 083.
4. Migration 084 reapplied successfully.
5. A rollback attempt against the seeded database failed closed while Moliboo release, signature, ownership or outfit state existed.
6. Seeded status still reported 084 applied with zero pending or unknown migrations.

## Package and artwork evidence

The fixture generator reads assets directly from immutable native Git objects rather than the mutable checkout:

- Repository: `modula-mod/modula-native`.
- Approved poster-cutout source: `791d42e968b4f1b4f3ad309857b4b9fee262c495`.
- Exactly 100 distinct, contiguous identities: 116 through 215.
- First identity: `moliboo.character.116`, Brinlo.
- Last identity: `moliboo.character.215`, Jubilo.
- Every declared `character.json` and `portrait.png` byte count and SHA-256 is rechecked against the immutable source manifest.
- No artwork was generated or substituted.
- Legends 101 through 115 are present as 15 non-wearable character/item records.

The seeded database independently reported:

```text
series2Approved=100 minNumber=116 maxNumber=215 firstKey=brinlo lastKey=jubilo
legends=15 wearable=0
signedStickerPacks=2 stickers=65
```

Sprout sticker fixtures are sourced from audited native main `20fcf3cc7acdce677d9de5091107ddfe884bd31b`. Series 1 contains 36 images and Series 2 contains 29. The absent `02_18_space_explorer` source asset is not fabricated.

## Security and reliability results

- Reuses the existing canonical release signature and publisher trust chain.
- Adds a direct Ed25519 signature over the lowercase artifact SHA-256 required by the current native PackageManager; this is evidence under the existing signer, not a parallel trust root.
- Rechecks live publisher state, signing-key state/validity, release signature, artifact signature, revocations, quarantine, digest linkage, media type and exact bytes before advertising or delivering content.
- QA restore now revalidates the real signature, bytes and content contract; a withdrawn invalidly signed release is rejected.
- Packages are JSON/PNG content only: 6 MiB artifact, 8 MiB decoded, 4 MiB per file, 16 files, canonical relative paths, unique case-insensitive entries and exact declared hashes.
- Absolute paths, traversal, links/archive entries, undeclared extensions, executable content, duplicate paths, malformed JSON, bad PNG signatures and altered file bytes fail closed.
- Ownership derives from the authenticated account and database grants; a request cannot grant ownership.
- Duplicate ownership is prevented by `(account_id,item_id)` and `grant_id` uniqueness.
- Outfit writes lock the account row, validate ownership/wearability/revocation/slot facts, replace state transactionally and use a revision conflict for stale concurrent clients.
- Concurrent same-revision outfit writes produced one `200` and one `409`, with a valid final state.
- Withdrawal/restoration facts and outfit changes are auditable; availability events are append-only.
- Sticker composers resolve signed database facts server-side and cannot trust a client-supplied pack, label or emoji.

## QA runtime evidence

The compiled API runtime was injected against real persisted QA fixtures. Results:

```text
Series 2 pages: 50 + 50
Series 2 total: 100
First package: moliboo.character.116
Last package: moliboo.character.215
Native raw catalogue packages: 100
Sprout Series 1 stickers: 36
Sprout Series 2 stickers: 29
```

The test suite additionally proved:

- latest signed release selection and prior-version availability;
- one-byte file tamper rejection;
- invalid direct signature omission and restore rejection;
- exact artifact digest and Ed25519 verification matching PackageManager;
- immutable download bytes and headers;
- QA withdrawal, older-release fallback and restoration;
- unowned and Legend equip denial;
- outfit persistence after a new authenticated session;
- concurrent equip conflict behavior;
- duplicate ownership denial;
- signed sticker listing and content-addressed PNG delivery;
- comment composer integration with forged metadata ignored;
- malformed cursor error contracts.

## API Atlas result

The baseline was 484 application routes and 689 total runtime method routes. The candidate is:

```text
773 runtime method routes = 544 application routes + 229 framework-derived routes
source-only routes: 0
runtime-only routes: 0
mission-specific complete contracts: 10
Atlas verification: 103/103
```

The 10 complete contracts cover the nine added routes and the changed sticker route. Each documents purpose/domain, authentication, authorization, request/validation, success, errors/codes, pagination/filtering, idempotency/concurrency and version compatibility.

Authoritative outputs now include JSON, CSV, Markdown, OpenAPI and a deterministically generated DOCX. `contract-overrides.json` is merged into the canonical route records, and the verifier proves every override maps to a runtime route, contains every required field, appears unchanged in the Atlas, produces a valid DOCX and remains byte-stable across regeneration.

## Verification commands and results

All commands were run from `/root/modula-worktrees/greenfield-feature-reality-01`.

```text
CI=true pnpm typecheck
PASS: full workspace

CI=true pnpm --dir services/greenfield-api exec vitest run tests/api-fix-01.migration.test.ts tests/greenfield-backend-v1.migration-ledger-security.test.ts tests/moliboo-game.integration.test.ts tests/moliboo-signed-packs.integration.test.ts tests/sticker-packs.integration.test.ts --maxWorkers=1 --no-file-parallelism
PASS: 5 files, 21 tests, 0 skipped

CI=true pnpm --dir services/greenfield-api exec vitest run tests/moliboo-game.rules.test.ts --maxWorkers=1 --no-file-parallelism
PASS: 1 file, 5 tests, 0 skipped

MODULA_TEST_DATABASE_URL=<isolated-loopback-database> MODULA_TEST_ADMIN_DATABASE_URL=<isolated-admin-database> CI=true pnpm --dir services/greenfield-api exec vitest run tests/registry-trust.github-sync.test.ts tests/api-fix-01.migration.test.ts tests/greenfield-backend-v1.migration-ledger-security.test.ts --reporter=verbose --maxWorkers=1 --no-file-parallelism
PASS: 3 files, 23 tests, 0 failed, 0 skipped; signed external-game import remains valid after migration 084 and both up/down constraints preserve `application/vnd.modula.game-web+tgz`

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate MODULA_ENVIRONMENT=development MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED=true MODULA_VERIFICATION_ENABLED=true MODULA_VERIFICATION_QA_REVIEW_ENABLED=true MODULA_GUBIC_PLAY_ENABLED=true pnpm api:atlas:capture-candidate
PASS: 773 runtime method routes; 544 application + 229 framework; 0 source-only/runtime-only

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
PASS: 103/103 checks

(umask 0022; API_ATLAS_RUNTIME_EVIDENCE=candidate node tools/api-atlas/generate.mjs)
(umask 0002; API_ATLAS_RUNTIME_EVIDENCE=candidate node tools/api-atlas/generate.mjs)
PASS: DOCX SHA-256 `e1284ad9306ffd887ab45311ccefe7359bbd94b83bd98b3eee447b4684cfac5b` in both runs; ZIP integrity valid

CI=true pnpm --dir services/greenfield-api qa:seed-moliboo-series2
PASS: immutable-source dry run, 100 packages

CI=true pnpm --dir services/greenfield-api qa:seed-sprout-stickers
PASS: immutable-source dry run, 2 packs / 65 stickers

pnpm --dir services/greenfield-api qa:seed-moliboo-series2 --apply
pnpm --dir services/greenfield-api qa:seed-sprout-stickers --apply
PASS on labelled loopback QA: 100 Series 2 releases, 15 non-wearable Legends, 2 signed packs / 65 stickers; one-use QA private key deleted

compiled API fixture smoke
PASS: pages 50 + 50, IDs 116-215, raw catalogue 100, manifest/download 200, downloaded digest matches descriptor

pnpm --dir services/greenfield-api db:rollback
EXPECTED REFUSAL on seeded QA; migration 084 remained applied with 0 pending/unknown migrations

git diff --check
PASS
```

Preliminary invocations were not acceptance runs and are excluded from the PASS totals: the reused disposable database first exposed stale pre-renumbering migration state and was recreated only after its QA labels/loopback binding were checked; configuration and command-line guardrails then refused three seed attempts before fixture writes (invalid `qa` API environment, missing preview encryption configuration, and an extra `--` argument). Every generated private key was removed by a failure trap or immediate cleanup. The configured migration, seed and compiled-ESM API smoke above subsequently passed.

The first GitHub CI run also truthfully failed four migration-ledger assertions that still ended at 079 and found that the then-numbered migration 080 had replaced, rather than extended, the migration-077 release-media constraint. A first local remediation run passed 69/71 and exposed two media-type regressions. The later disposable PR-01→PR-07 composition exposed one further compatibility omission: migration 084 had retained web-runtime but not the already-shipped GUBIC `application/vnd.modula.game-web+tgz` type. The up and down constraints now preserve both media types, and the real signed external-game import plus canonical up/down tests pass. The Atlas DOCX generator pins both timestamps and archive member modes for cross-host byte stability.

## Files changed

Implementation and migration:

- `services/greenfield-api/migrations/084_moliboo_signed_packs.sql`
- `services/greenfield-api/migrations/084_moliboo_signed_packs.down.sql`
- `services/greenfield-api/src/app/register-moliboo-routes.ts`
- `services/greenfield-api/src/app/register-routes.ts`
- `services/greenfield-api/src/app/register-composer-routes.ts`
- `services/greenfield-api/src/domains/moliboos/service.ts`
- `services/greenfield-api/src/domains/comments/sticker-service.ts`
- `services/greenfield-api/src/domains/comments/media.ts`
- `services/greenfield-api/src/database/types.ts`
- `services/greenfield-api/package.json`

QA fixtures and tests:

- `services/greenfield-api/scripts/seed-moliboo-series2-qa.ts`
- `services/greenfield-api/scripts/seed-sprout-stickers-qa.ts`
- `services/greenfield-api/tests/moliboo-signed-packs.integration.test.ts`
- `services/greenfield-api/tests/sticker-packs.integration.test.ts`
- `services/greenfield-api/tests/api-fix-01.migration.test.ts`
- `services/greenfield-api/tests/greenfield-backend-v1.migration-ledger-security.test.ts`

Atlas generation and contracts:

- `tools/api-atlas/generate.mjs`
- `tools/api-atlas/generate-docx.mjs`
- `tools/api-atlas/verify.mjs`
- `docs/audits/api-atlas-01/contract-overrides.json`
- `docs/audits/api-atlas-01/api-atlas.docx`
- Generated Atlas JSON, CSV, Markdown, OpenAPI, Mermaid and evidence files under `docs/audits/api-atlas-01/`.

Mission evidence:

- `docs/audits/greenfield-feature-reality-01/FEATURE-REALITY-BASELINE.md`
- `docs/audits/greenfield-feature-reality-01/PR-01-MOLIBOO-SIGNED-PACKS.md`

## Native integration dependency

The server emits the exact current native schemas:

- `modula.moliboo.catalog.1` raw catalogue;
- `modula.package.1` descriptor;
- `modula.moliboo.assetpack.1` content container;
- lowercase SHA-256 bytes signed with Ed25519/base64;
- existing PackageManager size, file-count, extension, compatibility, staging and last-known-good rules.

No native repository file was changed. Native still needs an integration run that points its debug/QA catalogue base URL to this candidate and demonstrates install, update, failed-update rollback and restored launch. That evidence can move this workstream from `PARTIAL` to `PASS`; it is not a server-code blocker for review.

## Merge/deployment status

- Draft review PR only.
- Not merged.
- Auto-merge disabled.
- Not deployed.
- Not publicly published.
- Production unchanged.
- Andy approval required before any merge or deployment.
