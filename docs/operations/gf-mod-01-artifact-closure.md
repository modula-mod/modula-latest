# GF-MOD-01 — Artifact / presentation closure and fail-closed install preview

Mission GF-MOD-01 (owner Mosaic), from GF-RECON-01 (backend main `a91d490e`).
Gaps: GAP-REGISTER G003 (registry artifact availability) and the read-side of
G004 (presentation metadata without blob). Production run of the report needs
owner approval (read-only).

## What changed

| Area | Change | Code |
| --- | --- | --- |
| Closure service | Per-release package artifact closure computed in Postgres (`sha256(bytes)`, `octet_length(bytes)`) so package bytes never stream into the API process. States: `present`, `missing`, `noReleaseDigest`, `digestMismatch`. Presentation blob closure: `present`, `missingBlob`, `noDigest`, `digestMismatch`. | `services/greenfield-api/src/modules/artifact-closure-service.ts` |
| Install preview gate | `installPreview` (and therefore `install`, which runs the preview) now requires a stored `module-package` artifact whose digest equals the release's recorded `release_sha256` and whose bytes still hash to it. Missing → `UNTRUSTED_RELEASE` (403). Corrupt bytes → `ARTIFACT_DIGEST_MISMATCH` (409) plus a `module.artifact.integrity-failed` audit row. | `services/greenfield-api/src/modules/installation-service.ts` |
| Development allowance | The existing `MODULA_ENVIRONMENT=development` + `GREENFIELD_MODULE_ALLOW_UNTRUSTED_DEVELOPMENT_RELEASES` allowance (already refused outside development) also tolerates a *missing* package. It never tolerates a digest mismatch. | same |
| Report script | `pnpm --filter @modula/greenfield-api registry:artifact-closure-report [--module <id>] [--states published,superseded] [--fail-on-open]` — runs one `SET TRANSACTION READ ONLY` transaction and prints JSON (`reportVersion: gf-mod-01.v1`). `--fail-on-open` exits 2 when any release is not closed. | `services/greenfield-api/scripts/artifact-closure-report.ts` |
| Fixtures | `storeFixturePackageArtifact()` stores the bytes `evidenceFor()` already digests, for tests that install under strict trust. | `services/greenfield-api/tests/helpers/registry-fixtures.ts` |

No routes, tables, migrations, error codes or public contracts were added or
changed. Error codes reuse `UNTRUSTED_RELEASE` and `ARTIFACT_DIGEST_MISMATCH`
from `packages/api-contracts/src/errors.ts`.

## Report shape

Per installable release (`published`, `superseded` by default): ids, state,
channel, digests (`releaseSha256`, adapter `manifestSha256`,
`productManifestSha256`, `frontendSha256`), `packageArtifact` closure,
`presentation` counts plus per-asset state, `signature` state/key/verifiedAt
(from `GreenfieldRegistryTrustService`), `trustVerified`, `closed`
(package present + every presentation blob present + signature verified), and
`error` if the trust block could not be built. Totals aggregate the same. The
report carries digests and sizes only, never stored bytes.

## Acceptance matrix

| Acceptance (FIRST-20-MISSIONS #9) | Test | Result on disposable DB |
| --- | --- | --- |
| Script runs against disposable DB fixtures; emits JSON | `tests/gf-mod-01.artifact-closure.test.ts` › report script emits read-only JSON … | run |
| Report cannot write | … › report runs inside a READ ONLY transaction and cannot write | run |
| Release without artifact → install preview refused | … › refuses install preview and install for a trusted release whose package artifact is absent | run |
| Replay / concurrency of a refused preview/install | … › stays refused on replay and under concurrent previews, and writes no install plan | run |
| Wrong-digest package is not accepted as the release package | … › refuses a package stored under a different digest than the release records | run |
| Digest mismatch → `ARTIFACT_DIGEST_MISMATCH` (+ audit, + report state) | … › returns ARTIFACT_DIGEST_MISMATCH when stored package bytes no longer hash … (needs `MODULA_TEST_ADMIN_DATABASE_URL`; simulates storage corruption by briefly relaxing the blob CHECKs as superuser, then restores and revalidates) | run |
| Positive path still works | … › allows install preview once the immutable package artifact is stored … ; `tests/registry-trust.signing.test.ts` › keeps a valid signed release installable under strict production trust policy | run |
| Development allowance is explicit and never accepts corrupt bytes | … › development allowance tolerates a missing package only when explicitly enabled | run |
| No-DB unit | … › reports a release with no recorded digest as noReleaseDigest | run |

## Security / rollback

* Fail-closed only: the change can refuse installs that previously succeeded
  (production releases without stored package bytes). Run the report
  read-only first (owner approval) to size the impact; the existing
  `registry:backfill-distribution-artifacts` script is the remediation path.
* Rollback: revert the commit; no schema or data change to undo.
* Not in scope (next dependency): applying the same gate to update/enable
  paths, Vault signed lifecycle, and backfill (GAP G003 remediation).
