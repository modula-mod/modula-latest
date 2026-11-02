# GREENFIELD FEATURE REALITY 01 — PR-03 Story replies into direct messages

MISSION ITEM: PR-03 — STORY REPLIES INTO DIRECT MESSAGES
STATUS: PARTIAL
BRANCH: `feat/qa-story-dm-replies`
PR URL: `https://github.com/modula-mod/modula-latest/pull/149`
BASE SHA: Stacked review base `d99c1470df6e5b9aff8f6bb02174120fcd7bc9b5`; underlying GreenField main baseline `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`
HEAD SHA: Implementation commit `cd1e1dbd7e73f990166774dc0ed15fb196f5125b`; the exact review tip is maintained in the draft PR description
ROUTES ADDED: 1 — `POST /v1/stories/:storyId/replies`
ROUTES MODIFIED: 1 — `GET /v1/conversations/:id/messages` adds optional `storyContext`; `POST /v1/conversations` retains its PR-02 contract while sharing the same transaction-safe primitive
ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown and OpenAPI; 759 runtime methods reconcile to 536 application routes plus 223 framework routes
MIGRATIONS: None; existing message, idempotency, event, delivery, outbox, job and notification tables are reused
TESTS PASSED: 23/23 persisted integration/regression tests, canonical workspace typecheck and 103/103 Atlas checks
TESTS FAILED: 0 final acceptance tests
TESTS SKIPPED: 0 in the reported final suites
SECURITY RESULTS: PASS for authentication, Story visibility/expiry, either-direction blocks, self-reply, recipient derivation, declined requests, unknown fields, guessed IDs, idempotency-key conflicts and cross-user conversation reads
QA INTEGRATION RESULTS: PASS for persisted API, event-delivery and worker-handler behavior in disposable PostgreSQL; no deployed QA API/worker or Native runtime was claimed
NATIVE COMPATIBILITY: Ordinary message rows remain displayable by existing clients and `storyContext` is additive, but latest Native main still opens Messages instead of calling the reply endpoint
BLOCKERS: Native request wiring and a deployed isolated-QA service/device journey are required for full end-to-end acceptance
APPROVAL REQUIRED: Andy must approve merge and any QA deployment

## Outcome

An authenticated viewer can now reply to a concrete, live Story item. The server resolves the author from the Story, authorizes visibility, finds or creates the canonical one-to-one conversation, inserts an ordinary direct message, records minimal private Story context, and enqueues one retry-safe notification in a single PostgreSQL transaction.

The backend candidate passes its persisted, concurrency, security, regression and Atlas gates. The mission item remains `PARTIAL`, not `PASS`, because current Native main does not call the endpoint and this branch has not been deployed to an isolated QA API/worker revision.

## Isolation and production protection

- Worktree: `/root/modula-worktrees/greenfield-feature-reality-01-pr03`.
- Branch: `feat/qa-story-dm-replies`, stacked on the unmerged PR-02 tip for review.
- Disposable PostgreSQL container: `modula-feature-reality-01-pg`.
- Isolation labels: `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01`, `digital.modula.scope=qa-disposable`.
- PostgreSQL exposure: loopback only at `127.0.0.1:55483`.
- Reconciliation database: `modula_feature_reality_01_pr03_reconcile_20261102`.
- `/root/modula-latest` was observed clean and remained untouched at `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`.
- No production database, object storage, signing key, billing system, deployment, merge or public publication was used.

## API contract

### Request

```text
POST /v1/stories/:storyId/replies
Authorization: Bearer <session>
Content-Type: application/json

{
  "text": "Story reply text",
  "idempotencyKey": "client-generated-retry-key"
}
```

- `storyId` is the concrete `greenfield_story_items.item_id` exposed to clients as `StoryItem.itemId`, not the group ID.
- `text` is required, trimmed, non-blank and limited to 5,000 characters.
- `idempotencyKey` is required, 8–200 characters, and accepts letters, numbers, `.`, `_`, `:`, and `-`.
- Unknown fields are rejected. A client cannot supply or redirect the recipient.

### Success

```text
201 first committed reply
200 identical idempotent replay

data: {
  conversationId: string,
  messageId: string,
  created: boolean,
  conversationCreated: boolean
}
```

The message is stored in `greenfield_conversation_messages` as a normal direct message. `GET /v1/conversations/:id/messages` may additionally return:

```text
storyContext: {
  type: "story",
  storyId,
  groupId,
  ownerActorId,
  mediaKind,
  createdAt,
  expiresAt
}
```

The retained context deliberately excludes Story media URLs and captions. Older clients can ignore the optional field and still render the ordinary message body.

### Error model

- `400 VALIDATION_FAILED`: malformed body, self-reply, blank/oversized text or invalid idempotency key.
- `401 UNAUTHENTICATED` / session errors: no valid sender session.
- `403 FORBIDDEN`: missing capability or a previously declined recipient message request.
- `404 NOT_FOUND`: unknown, deleted, expired, non-ready, blocked or otherwise invisible Story, or an inactive author. The same response avoids ID-existence disclosure.
- `409 CONFLICT`: an idempotency key is reused with different Story/text input.
- `429 RATE_LIMITED`: configured write limit.
- `500 SERVER_ERROR`: unexpected failure with the standard request ID envelope.

## Transaction, idempotency and delivery

The server namespaces the retry key to the authenticated actor and hashes the normalized Story ID plus message text. An actor/key PostgreSQL advisory lock serializes concurrent retries.

One transaction performs:

1. Idempotency reservation and request-hash validation.
2. Story row lock plus ready/deleted/expiry/visibility checks.
3. Author resolution from the Story record.
4. Existing direct-conversation actor-pair lock, active-account and block checks.
5. Canonical conversation create/reuse under the existing unique `direct_key` invariant.
6. Ordinary message insertion and conversation/member timestamps.
7. Private `message.story-replied` append-only event and subscriber delivery rows.
8. `notification.create` outbox event and background job with an idempotent delivery mode.
9. Stored response IDs for safe replay after a lost network response.

Twelve concurrent identical requests produced one `201`, eleven `200` responses, one conversation, one message, one context event, one subscriber-delivery row, one outbox record and one worker job. Replaying after Story deletion returns the original IDs without creating another message. Reusing the key for a different payload returns `409 CONFLICT`.

The notification worker's idempotent mode uses `ON CONFLICT DO NOTHING`. Running the real handler twice against the same queued payload produced one notification row with aggregate count one.

## Privacy and retention

- The replying actor comes only from the authenticated session.
- The recipient comes only from the locked Story row.
- Story read visibility and either-direction blocks are rechecked inside the transaction.
- Guessed and inaccessible Story IDs converge on `NOT_FOUND`.
- A deleted or expired Story cannot receive a new reply.
- A successfully committed DM survives later Story expiry/deletion under normal messaging retention.
- Only minimal non-media Story context is retained with the message event.
- Conversation reads still require membership; outsiders cannot retrieve the message or its context.

## API Atlas result

```text
759 runtime method routes = 536 application routes + 223 framework-derived routes
source-only routes: 0
runtime-only routes: 0
routes added from PR-02 candidate: 1
mission-specific complete contracts: 3 stacked overrides
Atlas verification: 103/103
```

The complete contracts cover the new Story reply route, the additive message-read context and the stacked PR-02 conversation-creation route. The Story reply is categorized under the existing Story/Media route family while its explicit owning domain is documented as Stories integrated with direct messaging.

PR-01 and PR-02 remain separate unmerged reviews. The intended approval order is PR-01, PR-02, then PR-03. After any approved earlier merge, contract overlays and generated Atlas artifacts must be reconciled without dropping another workstream's contracts.

## Verification commands and final results

All commands were run from `/root/modula-worktrees/greenfield-feature-reality-01-pr03`.

```text
CI=true pnpm typecheck
PASS: canonical 24-project workspace dependency builds and typechecks

MODULA_TEST_DATABASE_URL=<isolated-loopback-database> CI=true pnpm --dir services/greenfield-api exec vitest run tests/story-dm-replies.integration.test.ts tests/phase7i.f5-stories.test.ts tests/messaging.integration.test.ts tests/phase6s.social.test.ts --no-file-parallelism --maxWorkers=1
PASS: 4 files, 23 tests, 0 failed, 0 skipped
  story-dm-replies.integration.test.ts: 3
  phase7i.f5-stories.test.ts: 4
  messaging.integration.test.ts: 8
  phase6s.social.test.ts: 8

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate MODULA_ENVIRONMENT=development MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED=true MODULA_VERIFICATION_ENABLED=true MODULA_VERIFICATION_QA_REVIEW_ENABLED=true MODULA_GUBIC_PLAY_ENABLED=true pnpm api:atlas:capture-candidate
PASS: 759 runtime methods / 536 application routes / zero reconciliation gaps

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
PASS: 103/103 checks

(umask 0002; TZ=Pacific/Auckland API_ATLAS_RUNTIME_EVIDENCE=candidate node tools/api-atlas/generate-docx.mjs)
PASS: DOCX SHA-256 unchanged at `100319ea2b9677daa4c061999ca648775a4902736c552f5b906b1e7fddfd0ecc`

git diff --check
PASS
```

One pre-final Atlas capture was intentionally discarded after it exposed missing Premium/Verification QA feature flags: it contained 672 runtime methods rather than the PR-02 candidate baseline. Recapturing with the documented QA flags restored all 17 conditional methods and added exactly the one new Story reply route. No reduced-count artifact is included in this review.

## Files changed

Implementation and tests:

- `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`
- `services/greenfield-api/src/domains/stories/service.ts`
- `services/greenfield-api/src/domains/messaging/service.ts`
- `services/greenfield-worker/src/notifications/create.ts`
- `packages/greenfield-schema-registry/src/events.ts`
- `services/greenfield-api/tests/story-dm-replies.integration.test.ts`

Atlas contracts and generated artifacts:

- `docs/audits/api-atlas-01/contract-overrides.json`
- `tools/api-atlas/lib.mjs`
- `docs/audits/api-atlas-01/api-atlas.docx`
- Generated Atlas JSON, CSV, Markdown, OpenAPI, Mermaid and candidate evidence under `docs/audits/api-atlas-01/`.

Mission evidence:

- `docs/audits/greenfield-feature-reality-01/PR-03-STORY-DM-REPLIES.md`

## Native integration gap

The latest remote Native main inspected read-only was `e50fc3916fb4738b7c63b7bed92bef49a8076eb8` (2 November 2026). In `ios/Modula/Features/Stories/StoryViews.swift`, `sendReply` still states `No story-reply endpoint yet`, clears the draft, and opens a new Messages surface without issuing the API request. The decoded `StoryItem.id` is already sourced from the server's `itemId`, so it is the correct path identifier once the request is wired.

Required Native follow-up, outside this server mission:

1. Add the authenticated `POST /v1/stories/:storyId/replies` call with a stable client idempotency key.
2. Use the concrete `StoryItem.itemId` as `storyId`.
3. Decode `conversationId`, `messageId`, `created` and `conversationCreated`.
4. Navigate to the returned conversation and render the ordinary message, optionally enhancing it with `storyContext`.
5. Cover allowed, blocked, expired, reused-thread, new-thread, retry and offline-retry behavior in Native tests.

Until that work is implemented and exercised against a deployed isolated-QA candidate, the backend route is QA-testable but the full Native Story journey is not demonstrated.

## Rollback and recovery

No migration is introduced. A code rollback removes the new route, optional context hydration, event schema and idempotent notification mode. Existing direct messages remain valid ordinary message rows; retained event/outbox records are append-only and do not require destructive cleanup. If the branch is reverted after QA use, Native clients must stop calling the new route and continue ignoring optional `storyContext`.

## Merge/deployment status

- Draft review only.
- Not merged.
- Auto-merge disabled.
- Not deployed.
- Production unchanged.
- Andy approval required before merge or deployment.
