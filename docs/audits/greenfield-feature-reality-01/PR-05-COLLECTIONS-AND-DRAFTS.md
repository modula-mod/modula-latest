# PR-05 — Server Collections and Drafts

MISSION ITEM: PR-05 — SERVER COLLECTIONS AND DRAFTS

STATUS: PARTIAL

BRANCH: `feat/qa-collections-and-drafts`

PR URL: https://github.com/modula-mod/modula-latest/pull/151

BASE SHA: `6f153ed95e310794acc628d5b85430f99b982873` (stacked review base; underlying main `bae20cebb48685c56ed5ccfe5537f121e3f36110`)

HEAD SHA: `f0258f4a7a3b73687fd0335ca27626388136ff93` (implementation and Atlas evidence; report-link commit follows)

ROUTES ADDED: 14

ROUTES MODIFIED: 1 (`GET /v1/saves`)

ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown, OpenAPI and route/data evidence

MIGRATIONS: `082_greenfield_collections_and_drafts` up/down; QA up/down/up verified

TESTS PASSED: 23 relevant integration/regression tests; 103 Atlas checks; typecheck

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

Migration `082_greenfield_collections_and_drafts` adds:

- `greenfield_saved_collections`
- `greenfield_saved_collection_items`
- `greenfield_post_drafts`
- `greenfield_post_draft_content`

Database uniqueness prevents duplicate collection membership. Collection position allocation is serialized. Collection and draft mutations use optimistic versions so a stale device receives a revision conflict rather than silently replacing newer content.

Draft creation supports a request idempotency key. Publish derives a server-side idempotency identity from the draft, obtains the post service's transaction-scoped advisory lock, validates and binds attachment references, creates the post, and finalizes draft state in the same transaction. Concurrent retries therefore return one post rather than creating duplicates. Failed validation or attachment processing leaves the draft editable and recoverable.

Attachment orphan removal now locks and verifies database state before deleting storage bytes, and reserved draft attachments cannot be stolen by a direct post or removed as orphans.

## QA isolation and migration evidence

The migration and integration tests used the disposable `modula-feature-reality-01-pg` PostgreSQL container, labelled `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01` and `digital.modula.scope=qa-disposable`, exposed only on loopback. No production database, storage, billing or signing resource was used.

Evidence:

- Applied migration 082.
- Rolled migration 082 down to schema version 081 and verified its root tables were absent.
- Reapplied migration 082 and verified all four tables were present.
- Verified the restricted API role can read the four new tables.
- Pending migration list is empty for this source lineage.

The disposable mission database also retains an earlier PR-01 migration ledger entry whose source is not present on this stacked PR-05 branch. That is expected disposable composition state and is not evidence of a production migration.

## Verification

From the repository root:

```bash
CI=true pnpm typecheck
```

Result: PASS.

```bash
MODULA_TEST_DATABASE_URL=<isolated-qa-url> MODULA_LOG_LEVEL=silent CI=true pnpm --dir services/greenfield-api exec vitest run tests/collections-drafts.integration.test.ts tests/post04.attachments.test.ts tests/communities.integration.test.ts tests/story-dm-replies.integration.test.ts tests/phase7e.internal-events.test.ts
```

Result: 5 files, 23 tests passed, 0 failed, 0 skipped.

```bash
CI=true GITHUB_HEAD_REF=main API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
```

Result: 103/103 checks passed. Candidate Atlas contains 520 application routes and 739 method routes, with no source-only or runtime-only route drift.

```bash
git diff --check
```

Result: PASS.

## Native integration gap

Native main `dbbd1f26a4a0761cfd6bc46c2e7ef671085b1775` was inspected read-only. Named collections currently use `PrivateFileStore` and declare server collections unavailable; post drafts use local private-file autosave. Native work must:

1. Call the authenticated collection and draft contracts.
2. Migrate or reconcile local records deliberately rather than silently overwriting server state.
3. Upload local media and use valid server attachment references before draft synchronization.
4. Surface revision conflicts for user resolution.
5. Treat InMail and Story drafts as separate models unless their contracts are explicitly added later.

No native repository files were changed.

## Recovery

Before any future deployment, preserve the four new tables and attachment reservation state. For application rollback, stop new collection/draft writes and restore the prior image. Run the down migration only when collection/draft data has been exported or explicitly approved for removal. Repeated publish requests remain safe because a published draft retains its `published_post_id`.

## Review status

PR #151 is a draft stacked on `feat/qa-communities`. It is unmerged, undeployed, and has no auto-merge configuration. Andy's explicit approval remains required.
