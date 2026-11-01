# GREENFIELD FEATURE REALITY 01 — PR-04 Complete Communities backend

MISSION ITEM: PR-04 — COMPLETE COMMUNITIES BACKEND

STATUS: PARTIAL

BRANCH: `feat/qa-communities`

PR URL: `https://github.com/modula-mod/modula-latest/pull/150`

BASE SHA: Stacked review base `e2da717950ded407edbba3ab8cca44b6c56bf08a`; underlying GreenField main baseline `bae20cebb48685c56ed5ccfe5537f121e3f36110`

HEAD SHA: Implementation commit `102a310195373fb3ff810d0f55b90e67883f8982`; the exact review tip is maintained in the draft PR description

ROUTES ADDED: 21 — Communities discovery/identity, membership, posts, settings, events and polls

ROUTES MODIFIED: Shared attachment-content, canonical post-write/read/edit/delete, comment and reaction policy behavior now enforces Community visibility and settings

ATLAS UPDATED: YES — JSON, CSV, DOCX, Markdown and OpenAPI; 720 runtime methods reconcile to 506 application routes plus 214 framework routes

MIGRATIONS: `081_greenfield_communities` with tested down migration; `080` remains reserved for PR-01

TESTS PASSED: 24 persisted integration/regression tests, canonical workspace typecheck and 103 Atlas checks

TESTS FAILED: 0 final acceptance tests

TESTS SKIPPED: 0 in the reported final suites

SECURITY RESULTS: PASS for authentication, role enforcement, private-Community non-disclosure, attachment access, banned/restricted members, unknown fields, ownership, policy enforcement, rate-limit configuration, cross-user isolation and stale writes

QA INTEGRATION RESULTS: PASS for the complete persisted API journey and idempotent QA fixture on disposable PostgreSQL; no deployed QA service or Native runtime is claimed

NATIVE COMPATIBILITY: API contracts cover the current screens and preference names, but latest Native main remains a preview shell backed by fixtures and `UserDefaults`

BLOCKERS: Native API wiring and a deployed isolated-QA service/device journey remain required for full end-to-end acceptance

APPROVAL REQUIRED: Andy must approve merge and any QA deployment

## Outcome

GreenField now has a persistent Communities domain rather than a route-shaped demonstration. It supports discovery, identity, active/pending/left/banned membership state, member directories, canonical social posts, global policy and per-member notification settings, single-choice polls, events and capacity-safe RSVP state.

Community posts remain rows in the existing `posts` domain. Existing post reads, edits, deletes, comments, reactions, attachments, audit records and internal events are reused. No parallel social feed, local-only persistence or native-only module was introduced.

The backend candidate passes its isolated database, concurrency, security, regression, migration and Atlas gates. The mission item remains `PARTIAL`, not `PASS`, because the latest Native client still presents the Community preview shell and this branch has not been deployed to an isolated QA API revision.

## Isolation and production protection

- Worktree: `/root/modula-worktrees/greenfield-feature-reality-01-pr04`.
- Branch: `feat/qa-communities`, stacked on the unmerged PR-03 tip for review.
- Disposable PostgreSQL container: `modula-feature-reality-01-pg`.
- Isolation labels: `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01`, `digital.modula.scope=qa-disposable`.
- PostgreSQL exposure: loopback only at `127.0.0.1:55483`.
- Final regression database: `modula_feature_reality_01_pr04_final3_20261101`.
- Migration-cycle database: `modula_feature_reality_01_pr04_rollback2_20261101`.
- GreenField remote main remained `bae20cebb48685c56ed5ccfe5537f121e3f36110` at final verification.
- `/root/modula-latest` remained clean and untouched at production revision `db0e1e31c19f07538198c8191fa97976c39a7684`.
- No production database, storage, service, billing system, signing key, deployment, merge or publication was used.

## API surface

### Discovery and identity

- `GET /v1/communities`
- `POST /v1/communities`
- `GET /v1/communities/:communityId`
- `PATCH /v1/communities/:communityId`

Discovery supports bounded cursor pagination, stable featured/activity ordering, text/category filters and joined/not-joined filters. Public discoverable Communities are visible anonymously; private Communities are returned only to active members. Create/update bodies reject unknown owner, role and featured fields.

### Membership

- `POST /v1/communities/:communityId/join`
- `POST /v1/communities/:communityId/leave`
- `GET /v1/communities/:communityId/members`

Membership is persisted with a composite primary key, a database-enforced single active owner and active/pending/banned/left states. Concurrent joins serialize and converge on one row. Owners cannot leave until ownership is transferred; a role-transfer API is intentionally not invented while the Native admin screen remains Coming Soon.

### Canonical posts

- `GET /v1/communities/:communityId/posts`
- `POST /v1/communities/:communityId/posts`

Posts are created through `PostWriteService` with a server-trusted Community association. The server derives public/private audience, validates active membership and posting role, applies attachment and blocked-word policy, binds existing media, writes audit/event records and preserves canonical post identity. Community posts are not implicitly cross-posted to AT Protocol.

The author/idempotency-key database invariant handles concurrent retries. Identical requests return the committed post; changed text or a key reused across generic and Community contexts returns `CONFLICT`.

### Settings

- `GET /v1/communities/:communityId/settings`
- `PATCH /v1/communities/:communityId/settings`

Every active non-restricted member can load non-sensitive global policy plus their own persisted `notifyMentions`, `weeklyDigest` and `eventReminders` preferences. A member can patch only those fields and cannot select another actor. `canManage` identifies owner/admin clients; the sensitive blocked-word list is `null` for other members.

Owners and administrators may also change membership/posting policy, attachment/reaction/featured-post rules, blocked words and the `inviteLinksEnabled` policy flag. Global writes require `expectedVersion`. Policy changes through either the Community or settings route share an advisory lock and advance both relevant revisions, preventing cross-contract stale overwrites.

`inviteLinksEnabled` is configuration metadata only. This PR does not claim an invite-issuance endpoint.

### Events

- `GET /v1/communities/:communityId/events`
- `POST /v1/communities/:communityId/events`
- `GET /v1/communities/:communityId/events/:eventId`
- `PATCH /v1/communities/:communityId/events/:eventId`
- `PUT /v1/communities/:communityId/events/:eventId/response`

Events persist time range, IANA timezone string, online/in-person/TBA location metadata, optional owned cover image, capacity, cancellation state and optimistic version. RSVP writes serialize on the event, enforce active membership, reject cancelled events and cannot exceed capacity. `null` removes the caller's response.

### Polls

- `GET /v1/communities/:communityId/polls`
- `POST /v1/communities/:communityId/polls`
- `GET /v1/communities/:communityId/polls/:pollId`
- `PATCH /v1/communities/:communityId/polls/:pollId`
- `PUT /v1/communities/:communityId/polls/:pollId/vote`

Polls support 2–10 ordered options, explicit close time, results visibility, vote-change policy and cancellation. A `(poll_id, actor_id)` primary key prevents duplicate votes; the server locks the poll for vote transitions and calculates aggregates from authoritative vote rows.

## Persistence and constraints

Migration `081_greenfield_communities` adds:

- `greenfield_communities`
- `greenfield_community_settings`
- `greenfield_community_memberships`
- `greenfield_community_events`
- `greenfield_community_event_responses`
- `greenfield_community_polls`
- `greenfield_community_poll_options`
- `greenfield_community_poll_votes`
- Community association/moderation columns and feed index on canonical `posts`

Foreign keys, partial unique indexes, membership-owner uniqueness, event/poll checks, vote/response primary keys and bounded access indexes enforce the core invariants independently of request handlers.

Member profile projections and event/poll aggregates are hydrated with bounded batch queries for each cursor page rather than issuing a new query set per result row.

Migration number `080` is reserved by PR-01. The intended approval order remains PR-01, PR-02, PR-03, then PR-04. The disposable database accepted 081 without a fabricated 080 ledger row; the combined approved history will supply 080 before 081.

## Security and reliability results

- Private Community IDs, posts and artwork fail closed for anonymous users and outsiders.
- Public artwork is readable; private icon, cover and event media inherit current membership authorization.
- Client-supplied owner, role, featured and other privileged unknown fields are rejected before Fastify strips them.
- Posting, poll and event writes require active membership and the configured role.
- Restricted and banned members cannot post or regain access through a guessed ID.
- Reaction disablement is enforced by the shared policy engine even for the post author.
- Blocked words apply to Community post creation and edits.
- Community settings cannot be changed by ordinary members; member notification writes affect only the authenticated membership.
- Community identity, event and poll writes use optimistic revisions; stale writes return `CONFLICT`.
- Concurrent joins, post retries, votes and capacity-limited RSVPs converge on database-valid state.
- Route write throttles reuse the configured GreenField write-rate policy.
- Audit records and internal events are transactionally written with domain state where applicable.

## QA fixture

`pnpm --filter @modula/greenfield-api db:seed:communities-qa` creates the deterministic, fictitious `modula-builders-qa` fixture with three test actors, one canonical post, one poll and one event.

The script refuses to run unless all of these are true:

- `MODULA_QA_FIXTURES_ENABLED=true`.
- Environment is QA, preview, development or test, never production.
- The database host is loopback.
- The database name is explicitly QA/test/feature-reality scoped and is not production-like.

Running the seed twice against the final disposable database returned the same Community ID and produced counts `1|3|1|1|1` for Community, memberships, posts, polls and events.

## API Atlas result

```text
720 runtime method routes = 506 application routes + 214 framework-derived routes
source-only routes: 0
runtime-only routes: 0
application routes before PR-04: 485
application routes added by PR-04: 21
mission-specific complete contracts: 24 stacked overrides
Atlas verification: 103/103
```

Candidate capture enabled the existing Premium and Verification QA feature flags so conditional source routes were not incorrectly classified as absent. The capture remains feature-branch candidate evidence and does not claim production runtime availability.

## Verification commands and final results

All commands were run from `/root/modula-worktrees/greenfield-feature-reality-01-pr04`.

```text
CI=true pnpm typecheck
PASS: canonical 24-project dependency builds and workspace typechecks

MODULA_TEST_DATABASE_URL=<isolated-loopback-database> CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/communities.integration.test.ts tests/communities.qa-seed.test.ts tests/phase6s.social.test.ts tests/greenfield-backend-v1.social-completion.test.ts tests/post04.attachments.test.ts --reporter=verbose
PASS: 5 files, 24 tests, 0 failed, 0 skipped

MODULA_QA_FIXTURES_ENABLED=true MODULA_DATABASE_URL=<isolated-loopback-database> pnpm --filter @modula/greenfield-api db:seed:communities-qa
PASS: repeated seed retained one Community, three members, one post, one poll and one event

CI=true GITHUB_HEAD_REF=feat/qa-communities API_ATLAS_RUNTIME_EVIDENCE=candidate MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED=true MODULA_VERIFICATION_ENABLED=true MODULA_VERIFICATION_QA_REVIEW_ENABLED=true pnpm api:atlas:capture-candidate
PASS: 720 runtime methods / 506 application routes / zero reconciliation gaps

CI=true GITHUB_HEAD_REF=main API_ATLAS_RUNTIME_EVIDENCE=candidate pnpm api:atlas:verify
PASS: 103/103 checks

git diff --check
PASS
```

The initial rollback CLI attempt was rejected before database access because required loopback API/origin configuration was absent. The empty disposable database was verified and the rehearsal was rerun with complete QA configuration. The successful cycle applied 081, observed the three notification columns, rolled 081 back with Community tables and `posts.community_id` absent, then reapplied 081.

## Files changed

Implementation and contracts:

- `packages/api-contracts/src/communities.ts`
- `packages/api-contracts/src/index.ts`
- `packages/greenfield-schema-registry/src/events.ts`
- `services/greenfield-api/migrations/081_greenfield_communities.sql`
- `services/greenfield-api/migrations/081_greenfield_communities.down.sql`
- `services/greenfield-api/src/app/register-communities-routes.ts`
- `services/greenfield-api/src/app/register-routes.ts`
- `services/greenfield-api/src/app/register-attachment-routes.ts`
- `services/greenfield-api/src/database/types.ts`
- `services/greenfield-api/src/domains/communities/service.ts`
- `services/greenfield-api/src/domains/posts/repository.ts`
- `services/greenfield-api/src/domains/posts/writes.ts`
- `services/greenfield-api/src/domains/policy/engine.ts`
- `services/greenfield-api/src/domains/profiles/repository.ts`

QA fixtures and tests:

- `services/greenfield-api/seeds/communities-qa-seed.ts`
- `services/greenfield-api/scripts/seed-communities-qa.ts`
- `services/greenfield-api/package.json`
- `services/greenfield-api/tests/communities.integration.test.ts`
- `services/greenfield-api/tests/communities.qa-seed.test.ts`

Atlas contracts and generated artifacts:

- `docs/audits/api-atlas-01/contract-overrides.json`
- `docs/audits/api-atlas-01/api-atlas.docx`
- Generated Atlas JSON, CSV, Markdown, OpenAPI, Mermaid and candidate evidence under `docs/audits/api-atlas-01/`.

Mission evidence:

- `docs/audits/greenfield-feature-reality-01/PR-04-COMMUNITIES.md`

## Native integration gap

The latest Native remote main inspected read-only is `dbbd1f26a4a0761cfd6bc46c2e7ef671085b1775`.

`ios/Modula/Features/Community/CommunityModels.swift` still declares that GreenField has no Community routes, defines `CommunityLocalSettings` in `UserDefaults`, treats interest as device-only and adapts comment polls instead of Community polls. `CommunityHubViews.swift` and `CommunityDetailViews.swift` still show preview/Coming Soon states for live membership, posts, events, moderation and persistence.

Required Native follow-up, outside this server mission:

1. Add typed clients for the 21 documented routes and cursor envelope.
2. Replace preview catalogues/member rows/posts with server DTOs.
3. Persist join/leave, poll vote and RSVP through GreenField and reconcile returned state.
4. Replace `CommunityLocalSettings` for server-owned fields with GET/PATCH settings; keep only genuinely device-local presentation state on-device.
5. Route Community post composition through the Community post endpoint with a stable idempotency key.
6. Load attachment URLs through the authenticated attachment-content contract for private Communities.
7. Add offline/error/conflict UI and Native tests for public/private, roles, pagination, cancellation and stale versions.

Until that client work is implemented and exercised against a deployed isolated-QA candidate, the backend is QA-testable but the complete Native journey is not demonstrated.

## Rollback and recovery

Before real user data exists, the tested QA down migration removes the Community domain tables and canonical-post linkage and restores the pre-081 schema. That down path is destructive and is not a production data-preservation plan.

After any real QA data exists, recovery must use a database backup plus the prior application revision, or a forward migration that preserves records. A code-only rollback must also prevent clients from creating new Community records. Community artwork objects remain scoped attachments; deleting a collection of Community records must never delete unrelated underlying media or social posts without a separate, reviewed retention decision.

## Merge/deployment status

- Draft review only.
- Not merged.
- Auto-merge disabled.
- Not deployed.
- Production unchanged.
- Andy approval required before merge or deployment.
