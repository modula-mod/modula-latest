# PR-05 — Server Collections and Drafts

MISSION ITEM: PR-05 — SERVER COLLECTIONS AND DRAFTS

STATUS: PARTIAL

BRANCH: `feat/qa-collections-and-drafts`

PR URL: https://github.com/modula-mod/modula-latest/pull/151

BASE SHA: `2d2588416aa0dbcdecc81c1adea7e85cf1058e87` (stacked review base; underlying main `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`)

HEAD SHA: `f0258f4a7a3b73687fd0335ca27626388136ff93` (implementation and Atlas evidence; report-link commit follows)

ROUTES ADDED: 14

ROUTES MODIFIED: 1 (`GET /v1/saves`)

ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown, OpenAPI and route/data evidence

MIGRATIONS: `086_greenfield_collections_and_drafts` up/down; QA up/down/up verified

TESTS PASSED: 30 tests (23 relevant integration/regression plus 7 migration/ledger tests); 103 Atlas checks; typecheck

TESTS FAILED: 0

TESTS SKIPPED: 0

SECURITY RESULTS: PASS for authentication, owner isolation, privileged-field rejection, attachment ownership/reservation and stale-write detection

QA INTEGRATION RESULTS: PASS for disposable PostgreSQL backend flows; native/deployed-QA journey not executed

NATIVE COMPATIBILITY: API shapes reflect the existing Saved and post-composer domains, but current native main remains local-only and requires client synchronization work

BLOCKERS: Native API wiring, conflict UX and deployed QA/native-device acceptance

APPROVAL REQUIRED: Andy approval before merge or deployment

## Outcome

The GreenField backend now provides durable, authenticated named Saved collections and post drafts without creating parallel Saved or post systems. Collection membership references existing `post_saves`; draft publishing goes through the canonical `PostWriteService` and atomically records the published post.

The workstream is `PARTIAL`, not `PASS`, because the current native application still persists named collections and post drafts in private local files. The backend behavior is proven against isolated PostgreSQL, but the complete native multi-device journey has not been wired or demonstrated.

## Added routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/me/collections` | List the authenticated user's collections with bounded cursor pagination. |
| POST | `/v1/me/collections` | Create an idempotent named collection. |
| GET | `/v1/me/collections/:collectionId` | Read an owned collection. |
| PATCH | `/v1/me/collections/:collectionId` | Rename or reorder with optimistic concurrency. |
| DELETE | `/v1/me/collections/:collectionId` | Delete an owned collection without deleting Saved items or posts. |
| GET | `/v1/me/collections/:collectionId/items` | List collection items with source availability. |
| POST | `/v1/me/collections/:collectionId/items` | Add an existing Saved item idempotently. |
| DELETE | `/v1/me/collections/:collectionId/items/:itemId` | Remove collection membership only. |
| GET | `/v1/me/drafts` | List post drafts and server revision metadata. |
| POST | `/v1/me/drafts` | Create an idempotent post draft. |
| GET | `/v1/me/drafts/:draftId` | Read an owned post draft. |
| PATCH | `/v1/me/drafts/:draftId` | Update a draft with expected-version conflict detection. |
| DELETE | `/v1/me/drafts/:draftId` | Delete an editable draft with expected-version protection. |
| POST | `/v1/me/drafts/:draftId/publish` | Publish once through the normal post pipeline and retain confirmation state. |

`GET /v1/saves` was extended with stable bounded cursor pagination while preserving its existing `items` response field.

## Persistence and concurrency

Migration `086_greenfield_collections_and_drafts` adds:

- `greenfield_saved_collections`
- `greenfield_saved_collection_items`
- `greenfield_post_drafts`
- `greenfield_post_draft_content`

Database uniqueness prevents duplicate collection membership. Collection position allocation is serialized. Collection and draft mutations use optimistic versions so a stale device receives a revision conflict rather than silently replacing newer content.

Draft creation supports a request idempotency key. Publish derives a server-side idempotency identity from the draft, obtains the post service's transaction-scoped advisory lock, validates and binds attachment references, creates the post, and finalizes draft state in the same transaction. Concurrent retries therefore return one post rather than creating duplicates. Failed validation or attachment processing leaves the draft editable and recoverable.

Attachment orphan removal now locks and verifies database state before deleting storage bytes, and reserved draft attachments cannot be stolen by a direct post or removed as orphans.

## QA isolation and migration evidence

The migration and integration tests used the disposable `modula-feature-reality-01-pg` PostgreSQL container, labelled `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01` and `digital.modula.scope=qa-disposable`, exposed only at `127.0.0.1:55483`. The final feature database was `modula_feature_reality_01_pr05_reconcile_20261102`; the canonical migration suite used `modula_feature_reality_01_pr05_migration_tests_20261102` plus its own temporary databases. No production database, storage, billing or signing resource was used.

GreenField remote main and the protected `/root/modula-latest` checkout remained clean and untouched at `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`. No merge, deployment, package publication or production mutation occurred.

Evidence:

- Applied migration 086 after migration 085 Communities.
- Rolled migration 086 down to schema version 085 and verified the collection and draft root tables were absent.
- Reapplied through migration 086 and verified the canonical ledger ends at `086_greenfield_collections_and_drafts`.
- Verified the restricted API role can read the four new tables.
- Verified production-like 065, fresh and legacy-QA-076 upgrade paths with no unknown migrations or record loss.
- Pending migration list is empty for this source lineage.

The disposable mission database also retains an earlier PR-01 migration ledger entry whose source is not present on this stacked PR-05 branch. That is expected disposable composition state and is not evidence of a production migration.

## Verification

From the repository root:

```bash
CI=true pnpm typecheck
```

Result: PASS.

```bash
MODULA_TEST_DATABASE_URL=<isolated-qa-url> MODULA_LOG_LEVEL=silent CI=true pnpm --dir services/greenfield-api exec vitest run tests/collections-drafts.integration.test.ts tests/post04.attachments.test.ts tests/communities.integration.test.ts tests/story-dm-replies.integration.test.ts tests/phase7e.internal-events.test.ts --reporter=verbose --no-file-parallelism --maxWorkers=1
```

Result: 5 files, 23 tests passed, 0 failed, 0 skipped.

```bash
MODULA_TEST_DATABASE_URL=<isolated-qa-url> MODULA_TEST_ADMIN_DATABASE_URL=<isolated-admin-url> CI=true pnpm --dir services/greenfield-api exec vitest run tests/api-fix-01.migration.test.ts tests/greenfield-backend-v1.migration-ledger-security.test.ts --reporter=verbose --no-file-parallelism --maxWorkers=1
```

Result: 2 files, 7 tests passed, 0 failed, 0 skipped; canonical version and ledger end at 086.

```bash
CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate MODULA_ENVIRONMENT=development MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED=true MODULA_VERIFICATION_ENABLED=true MODULA_VERIFICATION_QA_REVIEW_ENABLED=true MODULA_GUBIC_PLAY_ENABLED=true pnpm api:atlas:capture-candidate
CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
```

Result: 103/103 checks passed. Candidate Atlas contains 571 application routes and 808 method routes, including 237 explicitly excluded framework-derived routes, with no source-only or runtime-only route drift. PR-05 adds 14 application routes to the PR-04 base of 557.

```bash
TZ=Pacific/Auckland API_ATLAS_RUNTIME_EVIDENCE=candidate node tools/api-atlas/generate-docx.mjs
```

Result: byte-stable DOCX SHA-256 `82503e68d4f09c7adf4a55d2d4bce7690ae386714981cb630d138401df995e42` under a different timezone and umask.

```bash
git diff --check
```

Result: PASS.

## Files changed

Implementation and contracts:

- `packages/api-contracts/src/collections-drafts.ts`
- `packages/api-contracts/src/index.ts`
- `services/greenfield-api/migrations/086_greenfield_collections_and_drafts.sql`
- `services/greenfield-api/migrations/086_greenfield_collections_and_drafts.down.sql`
- `services/greenfield-api/src/app/register-collections-drafts-routes.ts`
- `services/greenfield-api/src/app/register-phase6s-routes.ts`
- `services/greenfield-api/src/app/register-routes.ts`
- `services/greenfield-api/src/database/types.ts`
- `services/greenfield-api/src/domains/attachments/service.ts`
- `services/greenfield-api/src/domains/collections/service.ts`
- `services/greenfield-api/src/domains/drafts/service.ts`
- `services/greenfield-api/src/domains/posts/writes.ts`
- `services/greenfield-api/src/domains/saves/service.ts`

Tests and evidence:

- `services/greenfield-api/tests/collections-drafts.integration.test.ts`
- `services/greenfield-api/tests/api-fix-01.migration.test.ts`
- `services/greenfield-api/tests/greenfield-backend-v1.migration-ledger-security.test.ts`
- `docs/audits/api-atlas-01/contract-overrides.json`
- Generated Atlas JSON, CSV, DOCX, Markdown, OpenAPI, Mermaid and candidate evidence under `docs/audits/api-atlas-01/`.
- `docs/audits/greenfield-feature-reality-01/PR-05-COLLECTIONS-AND-DRAFTS.md`

## Native integration gap

Native remote main `e50fc3916fb4738b7c63b7bed92bef49a8076eb8` was inspected read-only. `CollectionStore` and `DraftStore` both still use `PrivateFileStore`; post drafts remain local private-file autosave. Native work must:

1. Call the authenticated collection and draft contracts.
2. Migrate or reconcile local records deliberately rather than silently overwriting server state.
3. Upload local media and use valid server attachment references before draft synchronization.
4. Surface revision conflicts for user resolution.
5. Treat InMail and Story drafts as separate models unless their contracts are explicitly added later.

No native repository files were changed.

## Recovery

Before any future deployment, preserve the four new tables and attachment reservation state. For application rollback, stop new collection/draft writes and restore the prior image. Run the pre-real-data down migration from 086 to 085 only when collection/draft data has been exported or explicitly approved for removal; it is destructive and is not a production data-preservation plan. Repeated publish requests remain safe because a published draft retains its `published_post_id`.

## Review status

PR #151 is a draft stacked on `feat/qa-communities`. It is unmerged, undeployed, and has no auto-merge configuration. Andy's explicit approval remains required.
