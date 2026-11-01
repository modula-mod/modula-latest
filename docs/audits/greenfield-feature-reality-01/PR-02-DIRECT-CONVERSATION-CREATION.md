# GREENFIELD FEATURE REALITY 01 — PR-02 Direct conversation creation

MISSION ITEM: PR-02 — DIRECT CONVERSATION CREATION
STATUS: PARTIAL
BRANCH: `fix/qa-conversation-create-contract`
PR URL: `https://github.com/modula-mod/modula-latest/pull/148`
BASE SHA: `bae20cebb48685c56ed5ccfe5537f121e3f36110`
HEAD SHA: Implementation commit `b69c14adef1287f6d1f4ca2fec39a1e95fe492ff`; the exact review tip is maintained in the draft PR description.
ROUTES ADDED: 0
ROUTES MODIFIED: 1 — `POST /v1/conversations`
ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown and OpenAPI
MIGRATIONS: None; existing migration 075 `direct_key` uniqueness is the database invariant
TESTS PASSED: 14 integration/regression tests plus the canonical workspace typecheck and 103 Atlas checks
TESTS FAILED: 0 final acceptance tests
TESTS SKIPPED: 0 in the reported final suites
SECURITY RESULTS: PASS for authenticated sender derivation, target activity, blocks, self-target, unknown-field and cross-account boundaries
QA INTEGRATION RESULTS: PASS for persisted API behavior in disposable PostgreSQL; native share-sheet navigation remains unimplemented and unrun
NATIVE COMPATIBILITY: Response retains `data.conversation` and adds `created`; current native main does not call the route
BLOCKERS: Native share-sheet integration is required to demonstrate “select user without thread → create → send → open thread”
APPROVAL REQUIRED: Andy must approve merge and any QA deployment

## Outcome

`POST /v1/conversations` now creates or reuses exactly one direct conversation for the authenticated sender and target handle. It returns `201` with `created: true` for the winner and `200` with `created: false` for retries or an existing pair. Both responses contain the full conversation object used by the native conversation decoder and thread navigation.

The backend candidate passes its persisted, concurrency, security, regression and Atlas gates. The mission item remains `PARTIAL`, not `PASS`, because native main still scans only existing inbox pages and reports “No chat with … yet”; it does not call the creation route. The native repository was inspected read-only and was not changed.

## Isolation and production protection

- Worktree: `/root/modula-worktrees/greenfield-feature-reality-01-pr02`.
- Base: unchanged `origin/main` at `bae20cebb48685c56ed5ccfe5537f121e3f36110`.
- Disposable PostgreSQL container: `modula-feature-reality-01-pg`.
- Isolation labels: `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01`, `digital.modula.scope=qa-disposable`.
- PostgreSQL exposure: loopback only at `127.0.0.1:55483`.
- Final feature database: `modula_feature_reality_01_pr02_final4_20261101`.
- Premium regression creates and removes its own disposable database.
- `/root/modula-latest` stayed untouched at production revision `db0e1e31c19f07538198c8191fa97976c39a7684`.
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

1. Acquire the same actor-pair PostgreSQL advisory lock used by moderation block/unblock.
2. Revalidate that the target actor belongs to an active account.
3. Recheck either-direction blocks under that lock.
4. Insert the conversation with `ON CONFLICT (direct_key) DO NOTHING RETURNING`.
5. Only the winner inserts both members and the optional initial message.
6. A loser reads the committed winning row and returns it.

The initial message commits atomically with a new conversation. It is creation-only: a retry or reused conversation never appends the optional text again. Clients send subsequent content through `POST /v1/conversations/:id/messages`.

The 12-way QA concurrency test produced exactly one `201`, eleven `200` responses, one conversation ID, two member rows and one initial-message row. A further retry with the same text returned the same ID and left the message count at one.

## Security and privacy results

- Sender identity comes only from `requireCapability(..., 'post:engage')`.
- The target handle must resolve through a live profile, live actor and active GreenField account.
- Suspended and unknown accounts return the same public `Recipient not found` contract.
- Self-conversations are rejected.
- Blocks in either direction are rejected, and the creation transaction serializes against moderation block/unblock.
- Recipient request state remains server-derived: active only when the recipient follows the sender; otherwise pending.
- Unknown identity fields are explicitly rejected after authentication.
- Outsiders still cannot read a conversation, and pending recipients still cannot reply before acceptance.
- No target-private account information is added to error details.

## API Atlas result

The route count is unchanged because PR-02 modifies an existing endpoint:

```text
689 runtime method routes = 484 application routes + 205 framework-derived routes
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

MODULA_TEST_DATABASE_URL=<isolated-loopback-db> CI=true pnpm --dir services/greenfield-api exec vitest run tests/messaging.integration.test.ts
PASS: 1 file, 7 tests

MODULA_TEST_DATABASE_URL=<isolated-loopback-admin-base> MODULA_TEST_ADMIN_DATABASE_URL=<isolated-loopback-admin-db> CI=true pnpm --dir services/greenfield-api exec vitest run tests/premium.integration.test.ts
PASS: 1 file, 7 tests

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED=true MODULA_VERIFICATION_ENABLED=true MODULA_VERIFICATION_QA_REVIEW_ENABLED=true pnpm api:atlas:capture-candidate
PASS: 689 runtime methods / 484 application routes / zero reconciliation gaps

CI=true API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
PASS: 103/103 checks

TZ=Pacific/Auckland API_ATLAS_RUNTIME_EVIDENCE=candidate node tools/api-atlas/generate.mjs
PASS: DOCX SHA-256 unchanged from UTC generation

git diff --check
PASS
```

Pre-final diagnostic runs are not hidden: a direct service-only typecheck and the first Vitest collection attempt failed because workspace contract packages had not yet been built; the canonical root build fixed the harness. One development test run passed 6/7 but exhausted the registration fixture limiter, so the security test was changed to reuse verified fixtures. A second passed 6/7 and showed Fastify was safely stripping, rather than rejecting, a forged identity field; the handler was tightened to reject it explicitly. The final clean-database feature run and adjacent regression both pass 7/7 with zero skips.

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

Native main `20fcf3cc7acdce677d9de5091107ddfe884bd31b` currently exposes list, list-messages, send, read and request paths in `ios/Modula/Features/Messages/MessageModels.swift`, but no create-conversation path/capability. `ios/Modula/Features/UniversalShare/ModulaShareSheet.swift` loads up to four existing inbox pages, skips a selected person when no conversation ID is found, and displays `No chat with … yet.`

Required native follow-up, outside this server mission:

1. Add `POST /v1/conversations` with `{handle}` and decode `data.created` plus `data.conversation`.
2. When the share sheet cannot resolve an existing thread, call creation, cache/use the returned conversation ID, then send through the existing message endpoint.
3. Navigate to the returned conversation and cover new-thread/reused-thread/block/error cases in native tests.

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
