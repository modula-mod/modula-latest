# GREENFIELD FEATURE REALITY 01 — PR-02 Direct conversation creation

MISSION ITEM: PR-02 — DIRECT CONVERSATION CREATION
STATUS: PARTIAL
BRANCH: `fix/qa-conversation-create-contract`
PR URL: `https://github.com/modula-mod/modula-latest/pull/148`
BASE SHA: `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`
HEAD SHA: Original implementation commit `b69c14adef1287f6d1f4ca2fec39a1e95fe492ff`; the reconciled review tip is maintained in the draft PR description after push.
ROUTES ADDED: 0
ROUTES MODIFIED: 1 — `POST /v1/conversations`
ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown and OpenAPI
MIGRATIONS: None; existing migration 075 `direct_key` uniqueness is the database invariant
TESTS PASSED: 8/8 current messaging integration/regression tests plus the canonical workspace typecheck and 103/103 Atlas checks
TESTS FAILED: 0 final acceptance tests
TESTS SKIPPED: 0 in the reported final suites
SECURITY RESULTS: PASS for authenticated sender derivation, target activity, blocks, self-target, unknown-field and cross-account boundaries
QA INTEGRATION RESULTS: PASS for persisted API behavior in disposable PostgreSQL; the latest native direct-message flow consumes the contract, while the universal share-sheet path remains unimplemented and unrun
NATIVE COMPATIBILITY: Latest native main consumes `POST /v1/conversations` and `data.conversation` for profile-to-DM first sends; the universal share sheet still does not create a missing thread
BLOCKERS: Native universal-share integration is required to demonstrate “select user without thread → create → send → open thread”
APPROVAL REQUIRED: Andy must approve merge and any QA deployment

## Outcome

`POST /v1/conversations` now creates or reuses exactly one direct conversation for the authenticated sender and target handle. It returns `201` with `created: true` for the winner and `200` with `created: false` for retries or an existing pair. Both responses contain the full conversation object used by the native conversation decoder and thread navigation.

The backend candidate passes its persisted, concurrency, security, regression and Atlas gates. Native main now uses this route for profile-to-DM first sends, which proves the response is consumable without an adapter. The mission item remains `PARTIAL`, not `PASS`, because the universal share sheet still scans only existing inbox pages and reports “No chat with … yet” instead of invoking the same creation contract. The native repository was inspected read-only and was not changed.

## Isolation and production protection

- Worktree: `/root/modula-worktrees/greenfield-feature-reality-01-pr02`.
- Reconciliation base: `origin/main` at `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`.
- Disposable PostgreSQL container: `modula-feature-reality-01-pg`.
- Isolation labels: `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01`, `digital.modula.scope=qa-disposable`.
- PostgreSQL exposure: loopback only at `127.0.0.1:55483`.
- Reconciliation database: `modula_feature_reality_01_pr02_reconcile_20261102`.
- `/root/modula-latest` was observed clean and remained untouched at `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`.
- No production database, storage, deployment, merge or public publication was performed.

## Contract

### Request

```text
POST /v1/conversations
Authorization: Bearer <session>
Content-Type: application/json

{
  "handle": "target-handle",
  "text": "optional initial message"
}
```

- `handle` is required, 1–80 characters, case-normalized, and may begin with `@`.
- `text` is optional and limited to 5,000 characters.
- The authenticated actor is always the sender; client-supplied actor/sender fields are rejected.
- Unknown fields are rejected with the standard `VALIDATION_FAILED` envelope rather than silently trusted or stripped.
- Empty/whitespace messages, self-targets, inactive/deleted targets and blocks fail closed.

### Success

```text
201 created
200 existing/retry

data: {
  created: boolean,
  conversation: {
    id,
    kind,
    participants,
    lastMessage,
    unreadCount,
    updatedAt
  }
}
```

The established `data.conversation` location remains unchanged. `created` and the `200` reuse status are additive. Existing group/In-Mail behavior is untouched.

### Error model

- `400 VALIDATION_FAILED`: malformed/unknown fields, invalid message or self-target.
- `401 UNAUTHENTICATED` / session errors: no valid sender session.
- `403 FORBIDDEN`: either-direction account block or missing capability.
- `404 NOT_FOUND`: unknown, deleted, suspended or deactivated target, without exposing account details.
- `429 RATE_LIMITED`: configured write limit.
- `500 SERVER_ERROR`: unexpected failure with the standard request ID envelope.

## Concurrency and idempotency

The sorted authenticated sender/target actor pair remains the deterministic `direct_key`; migration 075 already enforces it as unique.

Creation now runs in one transaction:

1. Acquire the same actor-pair PostgreSQL advisory lock used by moderation block creation.
2. Revalidate that the target actor belongs to an active account.
3. Recheck either-direction blocks under that lock.
4. Derive the recipient's active/request state from the current follow relationship inside the transaction.
5. Insert the conversation with `ON CONFLICT (direct_key) DO NOTHING RETURNING`.
6. Only the winner inserts both members and the optional initial message.
7. A retry reads the existing row and returns it without duplicating the initial message.

The initial message commits atomically with a new conversation. It is creation-only: a retry or reused conversation never appends the optional text again. Clients send subsequent content through `POST /v1/conversations/:id/messages`.

The 12-way QA concurrency test produced exactly one `201`, eleven `200` responses, one conversation ID, two member rows and one initial-message row. A further retry with the same text returned the same ID and left the message count at one.

## Security and privacy results

- Sender identity comes only from `requireCapability(..., 'post:engage')`.
- The target handle must resolve through a live profile, live actor and active GreenField account.
- Suspended and unknown accounts return the same public `Recipient not found` contract.
- Self-conversations are rejected.
- Blocks in either direction are rejected, and the creation transaction serializes against moderation block creation.
- Recipient request state remains server-derived: active only when the recipient follows the sender; otherwise pending.
- Unknown identity fields are explicitly rejected after authentication.
- Outsiders still cannot read a conversation, and pending recipients still cannot reply before acceptance.
- No target-private account information is added to error details.

## API Atlas result

The route count is unchanged because PR-02 modifies an existing endpoint:

```text
758 runtime method routes = 535 application routes + 223 framework-derived routes
source-only routes: 0
runtime-only routes: 0
mission-specific complete contracts: 1
Atlas verification: 103/103
```

The complete route contract documents purpose/domain, authentication, authorization, exact body validation, `200`/`201` responses, machine error codes, lack of pagination, database idempotency/concurrency and compatibility. The same contract is embedded in JSON, CSV, Markdown, OpenAPI and the deterministic DOCX.

PR-01 introduced the shared Atlas contract-overlay/DOCX generator on another unmerged branch. PR-02 carries the same shared machinery so its own review artifact is complete. Merge order remains PR-01 then PR-02; after any approved PR-01 merge, PR-02 must be rebased and its conversation override combined with the PR-01 overrides rather than replacing them.

## Verification commands and final results

All commands were run from `/root/modula-worktrees/greenfield-feature-reality-01-pr02`.

```text
CI=true pnpm typecheck
PASS: canonical workspace dependency builds and typechecks

MODULA_TEST_DATABASE_URL=<isolated-loopback-db> CI=true pnpm --dir services/greenfield-api exec vitest run tests/messaging.integration.test.ts --maxWorkers=1 --no-file-parallelism
PASS: 1 file, 8 tests

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate MODULA_ENVIRONMENT=development MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED=true MODULA_VERIFICATION_ENABLED=true MODULA_VERIFICATION_QA_REVIEW_ENABLED=true MODULA_GUBIC_PLAY_ENABLED=true pnpm api:atlas:capture-candidate
PASS: 758 runtime methods / 535 application routes / zero reconciliation gaps

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
PASS: 103/103 checks

(umask 0002; TZ=Pacific/Auckland API_ATLAS_RUNTIME_EVIDENCE=candidate node tools/api-atlas/generate-docx.mjs)
PASS: DOCX SHA-256 unchanged at `266d6a6c8b8bb0ab6d147a9426a05216137ff7fc993872ac2175e0fd3d04f1f9`

git diff --check
PASS
```

Pre-final diagnostic runs are not hidden: a direct service-only typecheck and the first Vitest collection attempt failed because workspace contract packages had not yet been built; the canonical root build fixed the harness. One development test run passed 6/7 but exhausted the registration fixture limiter, so the security test was changed to reuse verified fixtures. A second passed 6/7 and showed Fastify was safely stripping, rather than rejecting, a forged identity field; the handler was tightened to reject it explicitly. The original clean-database branch run passed 7/7. After merging current main's messaging-v2 regression into the same file, the reconciled QA run passed 8/8 with zero skips.

## Files changed

Implementation and tests:

- `services/greenfield-api/src/app/register-messaging-routes.ts`
- `services/greenfield-api/src/domains/messaging/service.ts`
- `services/greenfield-api/tests/messaging.integration.test.ts`

Atlas generation and contracts:

- `tools/api-atlas/generate.mjs`
- `tools/api-atlas/generate-docx.mjs`
- `tools/api-atlas/verify.mjs`
- `docs/audits/api-atlas-01/contract-overrides.json`
- `docs/audits/api-atlas-01/api-atlas.docx`
- Generated Atlas JSON, CSV, Markdown, OpenAPI, Mermaid and evidence files under `docs/audits/api-atlas-01/`.

Mission evidence:

- `docs/audits/greenfield-feature-reality-01/PR-02-DIRECT-CONVERSATION-CREATION.md`

## Native integration gap

Native main `e50fc3916fb4738b7c63b7bed92bef49a8076eb8` now exposes the `POST /v1/conversations` path in `ios/Modula/Features/Messages/MessageModels.swift`. `GreenfieldMessagingRepository.startConversation(handle:text:)` sends the documented `{handle,text?}` body and decodes `data.conversation`; `MessagingStore.startDirect` uses it for a profile-to-DM first send. This proves the backend response is natively consumable.

`ios/Modula/Features/UniversalShare/ModulaShareSheet.swift` remains incomplete: it loads up to four existing inbox pages, skips a selected person when no conversation ID is found, and displays `No chat with … yet.` instead of invoking `startConversation`.

Required native follow-up, outside this server mission:

1. When the share sheet cannot resolve an existing thread, call the existing native `startConversation` repository method with the share text atomically, or create then send using a documented idempotency strategy.
2. Cache/use the returned conversation ID and navigate to the returned conversation.
3. Cover new-thread/reused-thread/block/error cases in native tests.

Until that read-only-discovered gap is implemented and run, the backend route is QA-testable but the full share-sheet acceptance journey is not demonstrated.

## Rollback and recovery

No migration or persistent schema change is introduced. Code rollback restores the prior handler/service behavior. Existing conversations and messages remain valid because response fields are additive and the database tables are unchanged. If PR-02 is reverted, native clients must not depend on `created` or the `200` reuse distinction.

## Merge/deployment status

- Draft review PR only.
- Not merged.
- Auto-merge disabled.
- Not deployed.
- Production unchanged.
- Andy approval required before merge or deployment.
