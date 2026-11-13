# GF-RECON-01 Feature Matrix

> GF-RECON-01 — audit date 2026-11-13 (UTC). Read-only reconciliation.
> Backend `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449` · Native `modula-mod/modula-native` main `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` · Vault Notes `modula-mod/modula-vault-notes` main `15bf535785cb544fed40fb440499b7081fa89e93`.
> Live VPS revision, production migration ledger, worker image, feature flags and backup state: **UNKNOWN** (no read-only runtime access in this mission).
> Master plan `MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` was **not available** to the auditor; comparison uses the 2026-11-13 founder audit document and the GreenField Experience Atlas v1.0. GreenField is **not** complete.

## Status counts

| Status | Features | Historic open gaps | Total |
|---|---|---|---|
| NOT FOUND | 3 | 1 | 4 |
| SOURCE PRESENT | 17 | 20 | 37 |
| PR ONLY | 4 | 0 | 4 |
| CI VERIFIED | 2 | 0 | 2 |
| STAGING VERIFIED | 0 | 0 | 0 |
| DEVICE VERIFIED | 0 | 0 | 0 |
| RELEASE READY | 0 | 0 | 0 |
| RELEASED | 0 | 0 | 0 |
| INTENTIONALLY DISABLED | 3 | 2 | 5 |
| HISTORIC CLAIM NEEDS RECHECK | 1 | 8 | 9 |

STAGING VERIFIED, DEVICE VERIFIED, RELEASE READY and RELEASED are all **0**: no exact-SHA staging, device or release evidence was found or produced.

## Features

### F01 — Core identity, sessions, MFA, passkeys, Apple auth

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Synapse
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/auth`; `services/greenfield-api/src/authentication`; `services/greenfield-api/src/accounts`; `services/greenfield-api/src/sessions`
- **Test evidence:** CI: api:test (non-DB) + typecheck green on a91d490e; DB-gated auth suites not individually confirmed in CI log (UNVERIFIED)
- **Missing acceptance:** Sign-up→recover→deletion/export across restarts; revoked-session denial on staging; current deployed flags (UNKNOWN)
- **Dependency:** GF-OPS-01 runtime snapshot

### F02 — Profiles, posts, feed, comments, follows, reactions, reports

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/domains`; `services/greenfield-api/src/app/register-routes.ts:1482`; `services/greenfield-api/src/app/register-phase6s-routes.ts:199`
- **Test evidence:** CI: api-fix-01.follow-privacy, api-baseline-02.security-acceptance, phase7e.notifications run with Postgres in migration-validation job
- **Missing acceptance:** Cross-user object authz, follower-only visibility on staging, stable pagination (discover still fixed-limit, see G023), feed mode validation (G020), link/poll persistence (G012)
- **Dependency:** GF-EDGE-01

### F03 — Messaging v3 (backend)

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-messaging-routes.ts`; `services/greenfield-api/src/domains/messaging/realtime-hub.ts:6`; `services/greenfield-api/migrations/089_messaging_v3.sql`; `services/greenfield-api/tests/messaging-v3.integration.test.ts`
- **Test evidence:** Migration 089 applied in CI full-chain test (api-fix-01.migration.test.ts:126-143). messaging-v3.integration.test.ts is DB-gated (describe.skip without MODULA_TEST_DATABASE_URL) and is NOT in the migration-validation job list → not CI-executed (UNVERIFIED)
- **Missing acceptance:** Run messaging-v3 integration in disposable Postgres; cross-account E2E with receipts/groups/attachments/presence/reconnect; single-instance fan-out (realtime-hub.ts:6, capabilities singleInstance:true at register-messaging-routes.ts:320) forbids >1 API replica
- **Dependency:** GF-MSG-01

### F04 — Messaging v3 native wiring

- **Status:** PR ONLY · **Severity:** P1 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-native` @ `PR #296 head 72c0a368`
- **Paths:** `ios/Modula/Features/Messages/MessageModels.swift:268-283`; `ios/Modula/Features/Messages/MessagingRealtime.swift`
- **Test evidence:** PR body: MessagingV3ContractTests 86 passed (Mac-local, focused). All 13 new v3 paths match backend routes (path-level scan)
- **Missing acceptance:** Live-server behaviour unverified (PR body); stacked on #295→#294→#293; Prism certification of cumulative stack
- **Dependency:** GF-REG-01, GF-MSG-01

### F05 — Inbox UX & folders (local archive, hidden chats, folders, timed mute)

- **Status:** PR ONLY · **Severity:** P2 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-native` @ `PR #295 head 8805174a`
- **Paths:** `ios/Modula/Features/Messages (MessagingInboxTools)`
- **Test evidence:** PR body: focused unit tests 86/0 on simulator; no UI or network tests
- **Missing acceptance:** Separate local-privacy folders from server-synced semantics; biometric hidden chats + cache isolation tests
- **Dependency:** GF-REG-01

### F06 — 1:1 calls (backend)

- **Status:** INTENTIONALLY DISABLED · **Severity:** P1 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-calls-routes.ts:144-286`; `services/greenfield-api/src/domains/calls/{service,policy,signalling-hub}.ts`; `services/greenfield-worker/src/push/voip.ts`; `services/greenfield-api/migrations/090_calls_v1.sql`; `services/greenfield-api/src/config/env.ts:148`
- **Test evidence:** Migration 090 applied in CI full chain (migration-ledger test expects 090_calls_v1). calls.unit.test.ts runs in api:test; calls.integration.test.ts DB-gated (describeIfDb) and NOT in the CI DB job list → UNVERIFIED
- **Missing acceptance:** MODULA_CALLS_ENABLED defaults off (env.ts:148, disabled reason env.ts:615). Coturn/APNs provisioning, wss nginx, two-device media + PushKit/CallKit; multi-replica signalling not implemented (signalling-hub.ts:15 requires Redis pub/sub)
- **Dependency:** GF-CALL-01, GF-CALL-02
- **Notes:** Source present but off by default; not a bug.

### F07 — Coturn / TURN deployment

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Mosaic
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `ops/docker/compose.calls.yml`; `ops/coturn/turnserver.conf.template`; `docs/ops/calls-coturn.md:3`
- **Test evidence:** None — runbook states "documented, not deployed" (calls-coturn.md:3)
- **Missing acceptance:** Isolated staging Coturn DNS/TLS/UDP/TCP relay, external TURN relay test; compose.calls.yml not in automated deploy
- **Dependency:** GF-CALL-02

### F08 — Native call UX / WebRTC transport / CallKit+PushKit

- **Status:** PR ONLY · **Severity:** P1 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-native` @ `PR #297 head c379ee21`
- **Paths:** `ios/Modula/Features/Calls/CallManager.swift`; `CallMediaEngine.swift`; `CallModels.swift:295`; `CallRepository.swift:13-27`; `CallSignallingClient.swift`; `CallViews.swift`; `ios/ModulaTests/CallTests.swift`
- **Test evidence:** PR body: CallTests pass (86/0 overall) Mac-local; all 9 call paths match backend routes
- **Missing acceptance:** "A real call has not been placed: VoIP push delivery and media are unverified" (PR body); new SPM dependency stasel/WebRTC 156.0.0 needs fresh dependency approval
- **Dependency:** GF-CALL-03, GF-CALL-04

### F09 — Group voice/video calls

- **Status:** NOT FOUND · **Severity:** P3 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-calls-routes.ts:38 (maxParticipants: 2)`
- **Test evidence:** n/a
- **Missing acceptance:** Separate multiparty/SFU design + cost/privacy gate; defer until 1:1 DEVICE VERIFIED
- **Dependency:** F06, F08
- **Notes:** Not in 1:1 contract by design.

### F10 — Stories and DM replies

- **Status:** SOURCE PRESENT · **Severity:** P2 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`; `services/greenfield-api/src/app/register-messaging-routes.ts`
- **Test evidence:** phase7i.f5-stories.test.ts (historic G018 evidence); native #298 adds /v1/stories/:id/replies and DELETE /v1/stories/items/:id (both match backend)
- **Missing acceptance:** Offline, blocked user, expiry, deleted story, duplicate reply, push and native journey checks
- **Dependency:** GF-MSG-01

### F11 — Communities

- **Status:** SOURCE PRESENT · **Severity:** P2 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-communities-routes.ts`; `services/greenfield-api/migrations/086_greenfield_communities.sql`
- **Test evidence:** Migration in CI chain; native community client paths match backend (contracts scan); native NATIVE-03 adoption only in codex PR #264 (unmerged)
- **Missing acceptance:** Native member/moderation lifecycle E2E; server authority across sessions
- **Dependency:** codex chain disposition

### F12 — Collections / drafts

- **Status:** SOURCE PRESENT · **Severity:** P2 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-collections-drafts-routes.ts`; `services/greenfield-api/migrations/087_greenfield_collections_and_drafts.sql`
- **Test evidence:** Migration in CI chain; native sync only in codex PR #265 (unmerged)
- **Missing acceptance:** Cross-device sync, idempotency/owner enforcement, offline drafts, publish exactly once
- **Dependency:** codex chain disposition

### F13 — Moliboo content/packs/game

- **Status:** SOURCE PRESENT · **Severity:** P2 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/app/register-moliboo-routes.ts`; `services/greenfield-api/src/app/register-moliboo-game-routes.ts`; `services/greenfield-api/migrations/084_moliboo_signed_packs.sql`
- **Test evidence:** Native: Prism cert3 97 MOL unit cases 0 failed on trial merges (Mac-local, pre-#289 merge); MOL01–MOL03 UI tests 20 FAILED/INCOMPLETE (20-min cap) — no baseline
- **Missing acceptance:** Verified content/art digest, wardrobe sync, native 2D visual regression (Moliboo unchanged not yet confirmed), rollback
- **Dependency:** GF-REG-01

### F14 — Premium / StoreKit

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/premium/apple-service.ts`; `services/greenfield-api/src/premium/apple-verifier.ts`; `services/greenfield-api/migrations/088_greenfield_premium_apple_sandbox.sql`
- **Test evidence:** Migration in CI chain; native StoreKit sandbox flow only in codex PR #267 (unmerged, "Apple gate blocked")
- **Missing acceptance:** Real Apple sandbox purchase, server notification, restore/revoke/expiry; no live proof
- **Dependency:** GF-PREM-01

### F15 — Module install / publisher / MPS / registry

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Mosaic
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/modules`; `services/greenfield-api/src/publisher`; `services/greenfield-api/src/modules/github-release-sync-service.ts:260,284`
- **Test evidence:** registry-trust.trust-block, registry-trust.signing, module-version-switch run with Postgres in CI
- **Missing acceptance:** Public artifact + presentation bytes coverage (G003/G004 runtime UNKNOWN), legacy descriptors (G028), Vault special-casing (G027)
- **Dependency:** GF-MOD-01

### F16 — Online signing (Vault Transit signer)

- **Status:** PR ONLY · **Severity:** P0 · **Owner:** Synapse
- **Repo / ref:** `modula-mod/modula-latest` @ `PR #165 head 1bfdde97 base 0840c736`
- **Paths:** `services/greenfield-api/migrations/089_greenfield_online_signing_authority.sql (PR only)`; `services/greenfield-api/src/publisher/signing-provider.ts (PR only)`
- **Test evidence:** PR CI green only against stale base 0840c736 (run 42912880580). GitHub now: mergeable=false, mergeable_state=dirty, rebaseable=false. Local merge-tree vs a91d490e: 14 conflicting files
- **Missing acceptance:** Rebase/renumber to 091, regenerate Atlas, isolated Vault+Postgres acceptance, Sentinel review, key governance
- **Dependency:** GF-SIGN-01
- **Notes:** Migration-id collision: 089_greenfield_online_signing_authority sorts BEFORE 089_messaging_v3 lexically (migrate.ts:31-41 sorts by filename) → on any DB already at 090 it would apply out of order.

### F17 — Vault Notes module

- **Status:** SOURCE PRESENT · **Severity:** P2 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-vault-notes` @ `15bf535785cb544fed40fb440499b7081fa89e93`
- **Paths:** `frontend/`; `modula.product.json (2.1.0-rc.4)`
- **Test evidence:** CI vault-notes job success on 15bf5357. #19 merged; #22 merged (2.1.0-rc.4, 26 reachable routes). #21 open, mergeable=false, 28 conflicting files vs main, version 2.0.3 < main 2.1.0-rc.4 — likely superseded by #22 (needs confirmation)
- **Missing acceptance:** Host navigation metadata, folder/tag filterParam, settings writes, function calls in native/GreenField hosts; signed package lifecycle; no fabricated UI success
- **Dependency:** GF-VAULT-01

### F18 — AI provider routing / gateway

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Synapse
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/ai/providers/resolver.ts:40-70`; `services/greenfield-api/src/ai/gateway-service.ts`; `services/greenfield-api/src/intelligence/provider-selection.ts:11`
- **Test evidence:** verify:phase7e-ai-* scripts exist; not executed in this audit
- **Missing acceptance:** Real provider configuration (runtime UNKNOWN); provider-selection.ts:11 still states no Nodus-backed provider registered
- **Dependency:** GF-AI-01

### F19 — GAIA / Nodus / MAR

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Synapse
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `packages/intelligence-governance/src/gaia.ts:17`; `packages/mar-runtime/src/testing/registered-capability-planner.ts:10`; `packages/mar-runtime/src/runtime.ts`
- **Test evidence:** Intelligence governance tests run in CI repository-validation
- **Missing acceptance:** Only DeterministicTestPlanner and a testing planner implement GaiaPlanner — no operational planner; no Nodus backend route though native calls /v1/intelligence/nodus/releases/latest (NodusRelease.swift:141)
- **Dependency:** GF-AI-01

### F20 — Connector OAuth / webhooks

- **Status:** SOURCE PRESENT · **Severity:** P2 · **Owner:** Synapse
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/connectors/provider-metadata.ts:60,86,107,127,183`; `services/greenfield-api/src/modules/routes/index.ts:1717`
- **Test evidence:** n/a
- **Missing acceptance:** Metadata advertises webhook support for 5 providers but no connector webhook ingress route exists (only module backend webhook /v1/modules/:id/backend/webhooks/modula). Implement signed replay-safe ingress or set supported:false
- **Dependency:** GF-EDGE-01

### F21 — Media storage, backups, restore

- **Status:** SOURCE PRESENT · **Severity:** P0 · **Owner:** Sentinel
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/domains/attachments/service.ts`; `ops/backup/greenfield-v1-backup.mjs:9`; `ops/backup/restore-test.sh`; `docs/operations/greenfield-spof-register.md:11`
- **Test evidence:** Backup role pg_dump validation runs in CI; age-encrypted local backup to /var/backups/modula/greenfield-v1 (backup.mjs:9). No off-host destination in source
- **Missing acceptance:** Off-host encrypted copy + clean restore drill; live backup state UNKNOWN; SPOF register (2026-10-15) says backup destination "No while all copies remain on the VPS"
- **Dependency:** GF-OPS-01, GF-OPS-02

### F22 — Push / notifications (APNs alert + VoIP)

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Mosaic
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-worker/src/push/apns.ts`; `services/greenfield-worker/src/push/dispatch.ts`; `services/greenfield-worker/src/push/quiet-hours.ts`; `services/greenfield-worker/src/push/voip.ts`
- **Test evidence:** worker:test in CI
- **Missing acceptance:** APNs test delivery/expiry/quiet-hours; VoIP separate delivery; production deployment UNKNOWN
- **Dependency:** GF-CALL-02

### F23 — Metrics, health, runbooks, release pin

- **Status:** SOURCE PRESENT · **Severity:** P1 · **Owner:** Sentinel
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-api/src/domains/system/health.ts:17`; `ops/docker/compose.production.yml:59,79,112,132`; `ops/deploy/greenfield-production.sh:74,155`
- **Test evidence:** deploy-safety verifier runs in CI
- **Missing acceptance:** compose.production.yml default SOURCE_EXPECTED_MIGRATION=076_greenfield_premium_entitlements (source tip 090); deploy script requires explicit --expected-migration but default is misleading; worker has no Docker healthcheck (G033)
- **Dependency:** GF-OPS-01

### F24 — AT Protocol bridge

- **Status:** INTENTIONALLY DISABLED · **Severity:** P3 · **Owner:** Mosaic
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `services/greenfield-bridges/atproto`; `services/greenfield-api/src/config/env.ts:56,429`
- **Test evidence:** n/a
- **Missing acceptance:** MODULA_ATPROTO_ENABLED gated; optional interop only, not GreenField federation
- **Dependency:** none

### F25 — DIMON

- **Status:** INTENTIONALLY DISABLED · **Severity:** P3 · **Owner:** Sentinel
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `packages/dimon-contracts/src`
- **Test evidence:** n/a
- **Missing acceptance:** Contracts only; D15–D17 need separate legal/security approval
- **Dependency:** gated team

### F26 — Node discovery / portable identity / federation / migration (D00–D14)

- **Status:** NOT FOUND · **Severity:** P2 · **Owner:** Forge
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `(none) — full-tree scan of a91d490e: no /v1 node, federation, peer, principal or delegation routes; no packages/greenfield-{identity,events,federation,node-sdk}; no docs/protocol or docs/threat-model`
- **Test evidence:** n/a
- **Missing acceptance:** Entire D00–D14 programme. Existing: packages/greenfield-protocol (canonical-json, event-envelope, checkpoint, record-envelope) and outbox_events table (001_init_schema.sql:182) — intra-server primitives only
- **Dependency:** GF-D00-01 … GF-D05-01

### F27 — GreenField Experience Atlas screens (GF-UI-01–12, Part XI services)

- **Status:** NOT FOUND · **Severity:** P2 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-native` @ `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d`
- **Paths:** `(none) — no CurrentNodeService/NodeDirectoryService/MigrationPlanningService in native or backend`
- **Test evidence:** n/a
- **Missing acceptance:** Part XI contracts must be frozen first; demo fixtures must be gated and labelled
- **Dependency:** F26, Part XI freeze

### F28 — Native main baseline

- **Status:** CI VERIFIED · **Severity:** P1 · **Owner:** Prism
- **Repo / ref:** `modula-mod/modula-native` @ `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d`
- **Paths:** `ios/`; `.github/workflows/native-boundaries.yml`
- **Test evidence:** GitHub Actions run 43412276140 on 5db0f027: boundary-and-runtime = success (Ubuntu: verify:boundary, verify:design, typecheck, npm test — NO Xcode build/XCTest in CI); Prism cert3 (Mac-local, trial base 474573c): ModulaTests 713–720 executed / 0 failed per PR #282–#289; device build of #289 exit 0
- **Missing acceptance:** CI does not build iOS. UI tests on #289: 5 passed, 20 failed, run INCOMPLETE (20-min cap); no UI baseline on main; Moliboo visual unchanged NOT confirmed; main has since moved to 5db0f027 (merges of #282–#289 + #292) — no post-merge Xcode run recorded
- **Dependency:** GF-REG-01
- **Notes:** CI VERIFIED applies only to the Ubuntu boundary/typecheck/JS checks.

### F29 — GreenField backend main baseline

- **Status:** CI VERIFIED · **Severity:** P1 · **Owner:** Sentinel
- **Repo / ref:** `modula-mod/modula-latest` @ `a91d490e61ebfff38069378ddf757429eb000449`
- **Paths:** `.github/workflows/api-atlas-contract-drift.yml`
- **Test evidence:** GitHub Actions run 42937914326 on a91d490e: atlas, migration-validation, repository-validation = success (2026-11-11 01:18–01:24 UTC)
- **Missing acceptance:** Live VPS revision, migration ledger, worker image, flags, backup state: UNKNOWN (no runtime access in this mission)
- **Dependency:** GF-OPS-01
- **Notes:** CI VERIFIED = GitHub Actions only; no staging/production evidence.

### F30 — Live production runtime (VPS revision, migration ledger, flags, backups, DNS/nginx)

- **Status:** HISTORIC CLAIM NEEDS RECHECK · **Severity:** P0 · **Owner:** Sentinel
- **Repo / ref:** `modula-mod/modula-latest` @ `UNKNOWN`
- **Paths:** `docs/audits/api-atlas-01/00-production-truth.md (dated 2026-10-14)`; `docs/audits/greenfield-feature-reality-01/FEATURE-REALITY-BASELINE.md (2026-10-31)`
- **Test evidence:** None this mission — read-only runtime access unavailable
- **Missing acceptance:** Capture live SHA, schema_migrations tip, worker image digest, flags, off-host backup + restore status read-only
- **Dependency:** GF-OPS-01
- **Notes:** Historic snapshots said prod migration 073 / 075; treat as stale.

## Checks run vs skipped in this mission

- RUN: fresh clones of all three repos and all PR refs; ls-remote of branch heads; migration directory scan on every ref; `git merge-tree` trial merges; `git cherry`/ancestry for every open native PR; static native↔backend route scan; GitHub check-runs for main SHAs and #165 head; PR mergeability via GitHub API.
- SKIPPED: `pnpm install` / `pnpm api:atlas:verify` / unit or DB tests locally (private pinned Module Standard dependency and DB not provisioned in this read-only mission) — relied on the GitHub Actions results listed per record; Xcode builds/tests (no Mac); any runtime/VPS inspection.
