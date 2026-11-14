# GF-MOD-02 — Presentation bytes required at ingestion and publication

Mission GF-MOD-02 (owner Mosaic), from GF-RECON-01 (backend main `a91d490e`).
Gap: GAP-REGISTER G004 (presentation assets metadata without blob; 7/17 at
the historic snapshot). Backfill of production data is out of scope.

## What changed

| Area | Change | Code |
| --- | --- | --- |
| Ingestion gate | `GreenfieldMpsIngestService.ingest` now requires every declared presentation asset to be backed by bytes: supplied and verified in this ingestion, or already stored in the content-addressed blob table under the digest the manifest declares. A declaration without a digest can only be satisfied by supplied bytes. Runs before any write, so a rejection leaves no ingestion, frontend or presentation rows. Error: `VALIDATION_FAILED` (400). Covers every caller: admin `POST /v1/admin/product-standard/ingest` (which carries no asset bytes), GitHub release sync, and scripts. | `services/greenfield-api/src/product-standard/ingest-service.ts` (`assertPresentationAssetBlobsAvailable`) |
| Publication gate | `GreenfieldModuleReleaseService.publishRelease` refuses (`VALIDATION_FAILED`) when presentation metadata already bound to the release has no stored bytes (historic G004 rows). Releases already published are not touched. | `services/greenfield-api/src/modules/release-service.ts` |
| Internal count | `GET /v1/admin/registry/artifacts/orphans` (admin only, DRY_RUN) adds `missingPresentationBlobs: {count, releases, assets[]}` — the inverse of the existing orphan-blob list. `scripts/greenfield-v1-integrity.ts` adds an `informational` check `presentation_assets_missing_blob` (informational so existing integrity gates do not fail before a backfill decision). | `src/modules/presentation-blob-gaps.ts`, `src/modules/distribution-service.ts`, `scripts/greenfield-v1-integrity.ts` |

Read path is unchanged: `registry-presentation-service` still left-joins blobs
and projects metadata; `GET /v1/registry/releases/:releaseId/assets/:assetId`
still returns `NOT_FOUND` ("bytes have not been ingested") for a gap.

No routes, tables, migrations or error codes added. The admin orphan report
response gains one additive field.

## Acceptance matrix

| Acceptance (FIRST-20-MISSIONS #10) | Test (`tests/gf-mod-02.presentation-blobs.test.ts`) |
| --- | --- |
| Ingest test: metadata without blob rejected | rejects metadata whose bytes are neither supplied nor stored, leaving no ingestion rows; rejects a declared asset without a digest …; rejects through the admin ingest route … and stays rejected on replay; rejects every concurrent ingest … |
| Content-addressed reuse still allowed (no false rejection) | accepts supplied bytes, and a later product may reference the same stored blob by digest (includes identical replay) |
| Publication requires blobs | refuses to publish a release whose bound presentation metadata lacks bytes |
| Existing releases unaffected (read path unchanged) | leaves existing releases unaffected: projection still returns the row, asset route still 404 for the gap and 200 with matching digest for stored bytes |
| Missing-blob count exposed internally (admin only) | same test: admin report `missingPresentationBlobs`, non-admin 403 |
| No-DB unit | presentation blob gate (no database round trip needed) |

`tests/greenfield-mps-v1.ingest.test.ts` now supplies the fixture bytes for
the assets each reference product declares (previously it passed only when
another suite had already stored those blobs in the shared database).

## Security / rollback

* Fail-closed for new writes only; existing rows and read paths unchanged.
* Rollback: revert the commit; no schema or data change to undo.
* Next dependency: owner-approved read-only production count (admin report
  or integrity script), then a backfill/removal decision for historic rows.
