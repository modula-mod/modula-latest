# PR-06 — Vault Notes Package Install Verification

MISSION ITEM: PR-06 — VAULT NOTES PACKAGE INSTALL VERIFICATION

STATUS: BLOCKED

BRANCH: `test/qa-vault-package-install-plan`

PR URL: https://github.com/modula-mod/modula-latest/pull/157

BASE SHA: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`

HEAD SHA: `098de738974eaf073759a592ff807a6e63502430` (implementation and Atlas evidence; this report commit follows)

ROUTES ADDED: 0

ROUTES MODIFIED: 1 (`POST /v1/modules/:moduleId/package-install-plan`)

ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown evidence, OpenAPI, route/data maps and candidate runtime evidence

MIGRATIONS: None

TESTS PASSED: 103 relevant tests; 103 Atlas checks; workspace typecheck

TESTS FAILED: 0 in the final verification run

TESTS SKIPPED: 0

SECURITY RESULTS: PASS for authenticated account binding, paid-package entitlement enforcement, strict request validation, signed content-only module archive inventory, native executable rejection, lock concurrency and retained-artifact digest checks

QA INTEGRATION RESULTS: PARTIAL — the real signed Vault Notes 2.0.2 release imports and completes the standard module install path, but its package-install-plan returns the expected `404 NOT_FOUND` because that release has no optional package declaration

NATIVE COMPATIBILITY: BLOCKED — current Native recognizes the category but activates only a `game-content` root with exactly one `web-runtime`; it fails closed for a `module` package closure

BLOCKERS: A new approved and signed Vault Notes release must declare a content-only `modula.package.1` distribution closure, and Native PackageManager integration must activate `module` closures generically

APPROVAL REQUIRED: Andy approval before merge, release creation, package publication or deployment

## Outcome

The existing route is now a complete authenticated package-plan boundary rather than a metadata-only resolver. It rejects client-supplied identity fields, resolves the authenticated account server-side, validates the host context and cache digest list, gates every paid package in the resolved closure on server-owned entitlements, returns a deterministic canonical lock, and preserves the existing install-time lock digest check.

The release ingestion path now subjects `module` category archives to the same bounded, content-only archive inspection used by other downloadable content categories. A module archive requires a complete file inventory, rejects undeclared or modified members, rejects links and unsafe paths through the shared tar reader, and rejects native executable suffixes or magic bytes. Artifact reads also rehash retained bytes before delivery as defense in depth; PostgreSQL already prevents a digest/blob mismatch at rest.

The workstream is `BLOCKED`, not `PASS`. The generic route and signed `module` package lifecycle pass in isolated PostgreSQL, and the real Vault Notes 2.0.2 release is valid and installable through the standard signed module path. However, the published 2.0.2 product manifest does not declare `distribution.schema = modula.package.1`, so there is no Vault package closure for this endpoint to return. No replacement release was fabricated or publicly published.

## Existing route contract

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/modules/:moduleId/package-install-plan` | Resolve an exact signed and compatible dependency closure, subtract verified cached public artifacts, enforce account entitlements and return `lock` plus `lockSha256`. |

The route requires a GreenField bearer session. Its body permits only:

- optional exact `version`;
- required semantic `hostVersion`;
- required `platform` from `ios`, `android`, `web`, `desktop` or `server`;
- optional semantic `moduleSdkVersion` and `productUiContractVersion`;
- at most 256 validated host capability descriptors;
- at most 4,096 lowercase SHA-256 cached public artifact digests.

Unknown fields are rejected, including a client-supplied `accountId`. The server returns `Cache-Control: private, no-store`. The complete request, response, error, authorization, pagination, idempotency and compatibility contract is embedded in `contract-overrides.json` and generated into the Atlas JSON, CSV, DOCX and OpenAPI artifacts.

Atlas route count changed from the stale 499-route current-main artifact to 535 reconciled application routes because the candidate capture now enables the already-pushed Premium, Verification and GUBIC route groups. PR-06 itself adds no route. Candidate capture reports 535 mapped application routes, 758 total method routes including framework-derived routes, and zero source-only or runtime-only drift.

## Real Vault Notes evidence

Read-only reference identities:

- GreenField base: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`.
- Native main: `dbbd1f26a4a0761cfd6bc46c2e7ef671085b1775`.
- Vault Notes main: `c9e902e85e63f8846d147a70333f9e93eb3087da`.
- Actual module ID: `digital.modula.vault-notes`.
- Release tag: `vault-notes-v2.0.2` at commit `bd5440278831cf97dfa2a6882125d207af013def`.
- Package SHA-256: `2134d04aee1f3f59408f1fbab28c6de2a85aab314515941e16239a74a694c789`.
- Signing key ID: `modula-2026-10-offline-01`.

The public signing key was registered only in the disposable QA database. The private key was not present, requested, printed or used. The real GitHub release was fetched, signature-verified, imported and marked published only in that disposable database. No registry publication or remote release mutation occurred.

QA lifecycle result:

1. Real release discovery and signed import: PASS.
2. Standard module install: `202`, PASS.
3. Installation descriptor: `200`, version `2.0.2`, signature state `verified`, PASS.
4. Optional package install plan: `404 NOT_FOUND`, BLOCKED by absent `modula.package.1` distribution metadata.
5. Native module-category activation: BLOCKED by current client validation.

The standard installation returning `distributionReady: true` means the canonical installation descriptor and immutable standard release package are complete. It does not invent an optional package closure. The package-plan `404` remains the authoritative result for the PR-06 target endpoint.

## Native integration gap

Native main was inspected read-only. `ios/Modula/Features/ProductHub/ProductHubView.swift` calls `validateSupportedPackagePlan`, then accepts only a root package with category `game-content` and exactly one dependency with category `web-runtime`. Although the shared model recognizes `module`, the activation path fails closed for it.

Native work must extend the existing PackageManager path to activate a validated content-only `module` closure without a Vault-specific adapter. It must retain the current signature, digest, archive safety, atomic activation and last-known-good rollback semantics. No Native files were changed in this server workstream.

## QA isolation

Two PostgreSQL databases were created inside the existing disposable container `modula-feature-reality-01-pg`, labelled:

- `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01`;
- `digital.modula.scope=qa-disposable`.

The databases are exposed only on loopback and are separate from production:

- `modula_feature_reality_01_pr06` for real Vault release evidence;
- `modula_feature_reality_01_pr06_regression` for a clean regression run.

The clean PR-06 database applied current migrations `001` through `083`. No migration is added by this PR. The earlier disposable stacked-composition database was deliberately not reused because it contains PR-01/04/05 migration IDs that now collide numerically with newly pushed mainline migrations.

Production checkout `/root/modula-latest`, production PostgreSQL, production object storage, signing material, billing configuration and deployed services were not modified.

## Verification

From the repository root:

```bash
CI=true pnpm typecheck
```

Result: PASS.

```bash
MODULA_TEST_DATABASE_URL=<isolated-pr06-regression-url> MODULA_DATABASE_URL=<isolated-pr06-regression-url> MODULA_DATABASE_MIGRATOR_URL=<isolated-pr06-regression-url> MODULA_LOG_LEVEL=silent CI=true pnpm --filter @modula/greenfield-api exec vitest run --maxWorkers=1 --reporter=verbose tests/package-closure-resolver.test.ts tests/registry-trust.assets.test.ts tests/registry-trust.github-sync.test.ts tests/registry-trust.identity-aliases.test.ts tests/registry-trust.install-descriptor.test.ts tests/registry-trust.installed-state.test.ts tests/registry-trust.signing.test.ts tests/registry-trust.trust-block.test.ts tests/phase7e.vault-notes-platform.test.ts tests/phase7m-b2.vault-notes-identity.test.ts tests/pvp-platform-2.reference-products.test.ts
```

Result: 11 files, 103 tests passed, 0 failed, 0 skipped.

```bash
MODULA_TEST_DATABASE_URL=<isolated-pr06-url> MODULA_LOG_LEVEL=silent CI=true pnpm --filter @modula/greenfield-api exec tsx scripts/qa-vault-package-install-plan.ts
```

Result: real signed 2.0.2 standard install and descriptor PASS; optional package plan `404 NOT_FOUND` recorded as the release blocker.

```bash
GITHUB_HEAD_REF=test/qa-vault-package-install-plan API_ATLAS_RUNTIME_EVIDENCE=candidate CI=true pnpm api:atlas:verify
```

Result: 103/103 checks passed, including complete contract override embedding, deterministic output, CSV count, route reconciliation, DOCX package validation and secret scanning.

```bash
git diff --check
```

Result: PASS.

## Recovery

No database rollback is required. Application rollback is the prior image. The QA-only imported Vault release and generated test identities live solely in disposable databases and can be retired with those databases after review. If a future signed Vault package release fails client activation, withdraw that QA release through the existing release governance path and retain the last known-good standard installation; do not mutate or replace immutable release bytes.

## Review status

PR #157 is a draft based directly on current GreenField main. It is unmerged, undeployed and has no auto-merge configuration. Andy's explicit approval remains required. The branch must not be marked complete until a properly signed Vault package declaration exists and the real Native PackageManager lifecycle is demonstrated in isolated QA.
