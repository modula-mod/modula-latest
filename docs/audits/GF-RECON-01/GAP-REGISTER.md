# GF-RECON-01 Historical Gap Register Recompute

> GF-RECON-01 — audit date 2026-11-13 (UTC). Read-only reconciliation.
> Backend `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449` · Native `modula-mod/modula-native` main `5db0f027dd29c6a877b04aa98e0b457ee2b82e2d` · Vault Notes `modula-mod/modula-vault-notes` main `15bf535785cb544fed40fb440499b7081fa89e93`.
> Live VPS revision, production migration ledger, worker image, feature flags and backup state: **UNKNOWN** (no read-only runtime access in this mission).
> Master plan `MODULA_GREENFIELD_MASTER_PLAN_2026.pdf` was **not available** to the auditor; comparison uses the 2026-11-13 founder audit document and the GreenField Experience Atlas v1.0. GreenField is **not** complete.

Source: `docs/audits/api-atlas-01/gap-register.json` (captured 2026-10-14, last touched in commit 4e3fc4d7) — 39 findings, 31 marked OPEN. These are historical claims, not 31 verified present-day bugs.

## Result

- **Fully fixed on current main: 0 of 31.** No historical OPEN item can be closed with SHA + tests + deployed version.
- **Partially fixed in source: 5** (016 schemas, 022 counters, 024 realtime, 031 legacy routes, 039 Redis role).
- **Still open in source: 16** (008, 009, 013, 014, 019, 020, 021, 023, 025, 026, 027, 030, 032, 033, 036, 040).
- **Disabled by flag/capability (not automatically a bug): 2** (012 native capability-gated, 015 sync flag off).
- **Runtime/data claims needing re-check (production UNKNOWN): 8** (003, 004, 007, 028, 034, 035, 037, 038).

| Gap | Sev | Title | Recomputed on a91d490e | Status | Evidence (path:line) | Test evidence | Missing acceptance | Owner | Mission |
|---|---|---|---|---|---|---|---|---|---|
| 003 | P1 | Registry artifact availability (2/14 historic) | RUNTIME RECHECK | HISTORIC CLAIM NEEDS RECHECK | Source guard partial: github-release-sync-service.ts:260,284 rejects missing/mismatched artifacts on new ingest; no backfill evidence; production coverage UNKNOWN | none this mission | Read-only prod count of releases with retrievable bytes; backfill or block installability | Mosaic | GF-MOD-01 |
| 004 | P1 | Presentation assets metadata without blob (7/17 historic) | RUNTIME RECHECK | HISTORIC CLAIM NEEDS RECHECK | registry-presentation-service.ts:57,93 leftJoin asset blobs (absence tolerated at read); production coverage UNKNOWN | none | Ingestion must require blob; backfill/remove broken metadata | Mosaic | GF-MOD-01 |
| 007 | P1 | No operational AI provider | STILL OPEN IN SOURCE (config) / RUNTIME UNKNOWN | HISTORIC CLAIM NEEDS RECHECK | provider-selection.ts:11 "No Nodus-backed provider is registered. DeterministicTestProvider is a test adapter"; resolver.ts filters disabled/dev-mock providers | none | Governed real/local provider configured on staging + gateway acceptance | Synapse | GF-AI-01 |
| 008 | P1 | GAIA planner is acceptance-fixture only | STILL OPEN IN SOURCE | SOURCE PRESENT | Only DeterministicTestPlanner (gaia.ts:17) and testing/registered-capability-planner.ts:10 implement GaiaPlanner | intelligence-governance tests (CI) | Provider-backed or Nodus planner behind governed proposal contract | Synapse | GF-AI-02 |
| 009 | P1 | No Nodus adapter / local-client contract | STILL OPEN IN SOURCE + NEW CONTRACT DRIFT | NOT FOUND | No backend /v1/intelligence/nodus/* route; native main calls /v1/intelligence/nodus/releases/latest (ios/Modula/Core/Intelligence/Nodus/NodusRelease.swift:141) | none | Define local-first Nodus contract; add route or remove native default path | Synapse | GF-AI-02 |
| 012 | P1 | Link/poll composer not persisted | STILL OPEN (backend) / native capability-gated | INTENTIONALLY DISABLED | No poll/link fields in services/greenfield-api/src/domains/posts/writes.ts; polls exist only for communities and comments (PUT /v1/comments/:id/poll/vote). Native CreationCapabilities.swift:9-11 defaults linkPost/pollPost=false ("Link posts aren’t available yet") | none | Either keep disabled with capability contract test, or implement validated persistence | Forge | GF-EDGE-01 |
| 013 | P1 | Legacy inline post media vs nginx 1m body limit | STILL OPEN IN SOURCE | SOURCE PRESENT | post-media-storage.ts:51 decodes base64 inline media, :118 mediaUploadMaxBytes; ops/nginx/api.modula.digital.greenfield.conf:12 1m default | none | Retire inline media for attachment upload or scope edge limit; live nginx UNKNOWN | Forge | GF-EDGE-01 |
| 014 | P1 | Single-host media/backup durability | STILL OPEN IN SOURCE | SOURCE PRESENT | Backups age-encrypted to /var/backups/modula/greenfield-v1 (ops/backup/greenfield-v1-backup.mjs:9); no off-host destination in source; spof-register.md:11 | backup role pg_dump CI step | Off-host encrypted copy + restore drill; live state UNKNOWN | Sentinel | GF-OPS-02 |
| 015 | P1 | Signed automated registry ingestion disabled/no source | INTENTIONALLY DISABLED (flag) / RUNTIME UNKNOWN | INTENTIONALLY DISABLED | services/greenfield-worker/src/config.ts:78,249 GREENFIELD_MODULE_GITHUB_SYNC_ENABLED default false | none | Reviewed sync source + repository→published convergence with signature/artifact gates on staging | Mosaic | GF-MOD-01 |
| 016 | P2 | Route JSON request/response schemas | PARTIALLY FIXED IN SOURCE | SOURCE PRESENT | 64 `schema: {` occurrences in services/greenfield-api/src (messaging and calls routes use schemas, e.g. register-messaging-routes.ts:32); majority of ~615 routes still schema-less | api:atlas:verify (CI) | Incremental schemas at trust-boundary/mutating routes | Forge | GF-EDGE-01 |
| 019 | P2 | Profile media dual pathways | STILL OPEN IN SOURCE | SOURCE PRESENT | profiles/writes.ts:344-346 still accept avatarUri/coverUri via normalizeMediaUri | none | Require owned attachment binding | Forge | GF-EDGE-01 |
| 020 | P2 | Feed mode silent fallback | STILL OPEN IN SOURCE | SOURCE PRESENT | register-routes.ts:1487 mode = any string; :1493 unknown → modules-chrono-v1 | none | Validate FeedMode enum (400 on unknown) | Forge | GF-EDGE-02 |
| 021 | P2 | Private attachment unknown-ID oracle | STILL OPEN IN SOURCE | SOURCE PRESENT | register-attachment-routes.ts:100/204 NOT_FOUND vs :202 FORBIDDEN "Attachment unavailable" | none | Uniform not-found + shape/timing test | Sentinel | GF-EDGE-02 |
| 022 | P2 | Social counter races | PARTIALLY FIXED IN SOURCE | SOURCE PRESENT | Fixed: reactions atomic SQL (reactions/service.ts:38-81); follows advisory lock (profiles/writes.ts:549). Open: comments read post outside trx (comments/service.ts:183) then set reply_count: post.reply_count + 1 (:236) | phase7e.notifications concurrency tests (reactions) | Atomic increment for comment reply_count + concurrency test | Forge | GF-EDGE-02 |
| 023 | P2 | Discover/activity pagination and N+1 | STILL OPEN IN SOURCE | SOURCE PRESENT | discovery/repository.ts:40 .limit(24), :77 .limit(30), no cursor | none | Cursor pagination + batch hydration | Forge | GF-EDGE-01 |
| 024 | P2 | No realtime social/push surface | PARTIALLY FIXED IN SOURCE | SOURCE PRESENT | New since register: GET /v1/messaging/socket (register-messaging-routes.ts:504), calls signalling ws (register-calls-routes.ts:288), worker APNs/VoIP push; still single-instance; no realtime for comments/social (native polls 25 s per #298) | unit tests only | Define polling guarantees for social; shared pub/sub before multi-replica | Forge | GF-MSG-01 |
| 025 | P2 | Connector webhook ingress advertised but absent | STILL OPEN IN SOURCE | SOURCE PRESENT | provider-metadata.ts:60,86,107,127,183 supported:true; no connector webhook route in 615-route scan | none | Signed replay-safe ingress or supported:false | Synapse | GF-EDGE-03 |
| 026 | P2 | No-op worker jobs | STILL OPEN IN SOURCE | SOURCE PRESENT | services/greenfield-worker/src/jobs/runner.ts:97-114 module.* lifecycle events `break` with no side effect | none | Stop enqueueing or implement consumers with checkpoint audit | Forge | GF-EDGE-03 |
| 027 | P2 | Vault Notes hard-coded in core | STILL OPEN IN SOURCE | SOURCE PRESENT | services/greenfield-api/src/ai/product-action-service.ts:23 VAULT_NOTES_MODULE_ID and Vault-specific prompt/context builders (:53-:614) | verify:mp02b-vault-special-cases gate in CI (passes — gate scope may not cover AI path) | Move into manifest/action declarations | Mosaic | GF-VAULT-01 |
| 028 | P2 | Legacy install descriptor backfill (6/36 historic) | RUNTIME RECHECK | HISTORIC CLAIM NEEDS RECHECK | install-descriptor-service.ts present; production plan counts UNKNOWN | none | Read-only count + backfill/versioning | Mosaic | GF-MOD-01 |
| 030 | P2 | profile_links read without write API | STILL OPEN IN SOURCE | SOURCE PRESENT | profiles/repository.ts:86,247 read only; no insertInto/updateTable(profile_links) in services/ | none | Link CRUD or retire table | Forge | GF-EDGE-01 |
| 031 | P2 | Duplicate/legacy routes | PARTIALLY FIXED IN SOURCE | SOURCE PRESENT | POST /v1/accounts/sessions no longer registered; legacy inline post media (post-media-storage.ts:29-52) still overlaps POST /v1/attachments/uploads | api:atlas:verify | Declare canonical, instrument, deprecate | Forge | GF-EDGE-01 |
| 032 | P2 | Incomplete nginx→worker trace propagation | STILL OPEN IN SOURCE | SOURCE PRESENT | Only search/index.ts:125 and digests.ts:162 carry correlation IDs; no generic job trace propagation | none | Propagate trace IDs into jobs + edge logs | Sentinel | GF-OPS-02 |
| 033 | P2 | Worker Docker healthcheck | STILL OPEN IN SOURCE | SOURCE PRESENT | ops/docker/compose.production.yml healthchecks only for postgres (:22), redis (:42), api (:93); worker has none | deploy-safety verifier (CI) | Heartbeat-freshness healthcheck | Sentinel | GF-OPS-02 |
| 034 | P2 | Routes without automated tests (83 historic) | RECHECK REQUIRED | HISTORIC CLAIM NEEDS RECHECK | Route count grew to ~615 registered patterns; atlas coverage not recomputed in this mission (UNVERIFIED) | api:atlas:verify (CI) — coverage number not extracted | Recompute via pnpm api:atlas | Sentinel | GF-EDGE-01 |
| 035 | P2 | Development-only artwork | RUNTIME RECHECK | HISTORIC CLAIM NEEDS RECHECK | Production asset flags UNKNOWN | none | Publish production artwork with provenance | Mosaic | GF-MOD-01 |
| 036 | P2 | Verifier pinned to schema 055 | STILL OPEN IN SOURCE | SOURCE PRESENT | scripts/verify-greenfield-backend-v1.mjs:113 record('PRODUCTION SCHEMA', schema === '055') | none | Derive expected migration from ledger | Sentinel | GF-OPS-01 |
| 037 | P3 | Potentially orphan tables (14 historic) | RECHECK REQUIRED | HISTORIC CLAIM NEEDS RECHECK | Atlas DB map not regenerated against prod | none | Disposition per table | Forge | GF-D00-01 |
| 038 | P3 | Old QA PostgreSQL containers | RUNTIME RECHECK | HISTORIC CLAIM NEEDS RECHECK | VPS container list UNKNOWN | none | Inventory + retire after backup confirmation | Mosaic | GF-OPS-01 |
| 039 | P3 | Redis role unclear / no persistence | PARTIALLY CLARIFIED | SOURCE PRESENT | Redis now referenced: gubic/lobby-hub.ts, product-standard/ingest-service.ts, calls/signalling-hub.ts:15 (pub/sub prerequisite for multi-instance); persistence config live UNKNOWN | none | Document role + persistence policy | Mosaic | GF-OPS-01 |
| 040 | P3 | Static route/table mappings | STILL OPEN | SOURCE PRESENT | Atlas still static (tools/api-atlas/generate.mjs) | none | Runtime SQL tracing in disposable harness | Forge | GF-D00-01 |

## Previously marked FIXED (production acceptance still pending)

These stay **SOURCE PRESENT** with automated regression evidence; none is STAGING VERIFIED.

| Gap | Title | Regression evidence | Remaining |
|---|---|---|---|
| 001 | Follow approval | api-fix-01.follow-privacy.test.ts (CI DB job) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 002 | Unsigned release rejection | registry-trust.trust-block.test.ts (CI DB job) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 005 | Implicit permission grant | api-baseline-02.security-acceptance.test.ts (CI DB job) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 006 | Reaction notification retries | phase7e.notifications.test.ts + api-fix-01.reaction-dead-letter-retry.test.ts (CI DB job) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 010 | Legacy function invoke installation check | api-baseline-02.security-acceptance.test.ts (CI DB job) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 011 | AI stream cancel/reconnect ownership | api-baseline-02.security-acceptance.test.ts (CI DB job) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 017 | Attachment orphan cleanup scheduling | services/greenfield-worker/tests/media-cleanup.test.ts (worker:test) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |
| 018 | Story upload validation | phase7i.f5-stories.test.ts (DB-gated; CI inclusion UNVERIFIED) | Production acceptance on exact deployed SHA (runtime UNKNOWN) |

## New findings from this recompute

| ID | Sev | Finding | Evidence | Owner |
|---|---|---|---|---|
| RECON-N01 | P0 | Signer PR #165 migration `089_greenfield_online_signing_authority` collides with main `089_messaging_v3`; filename sort places it before 089_messaging_v3 so a DB at 090 would apply it out of order | services/greenfield-api/src/database/migrate.ts:31-41; PR #165 mergeable=false/dirty | Synapse |
| RECON-N02 | P1 | DB-gated calls and messaging-v3 integration suites are not executed in CI (describe.skip without DB; absent from migration-validation job list) | services/greenfield-api/tests/calls.integration.test.ts:9-13; .github/workflows/api-atlas-contract-drift.yml:190-245 | Forge |
| RECON-N03 | P1 | compose.production.yml default expected migration `076_greenfield_premium_entitlements` vs source tip 090 | ops/docker/compose.production.yml:59,79,112,132 | Sentinel |
| RECON-N04 | P2 | Native calls Nodus release endpoint and `/v1/reels/:id` with no backend route | NodusRelease.swift:141; ReelModels.swift:75 | Synapse / Prism |
| RECON-N05 | P2 | Native CI is Ubuntu-only (boundary/design/typecheck/JS); no Xcode build or XCTest in CI — all Swift evidence is Mac-local | .github/workflows/native-boundaries.yml | Prism |
| RECON-N06 | P2 | Native #298 rounds 15–16 (4e6c891d, 6648483d) are not on GitHub (absent from all 30 branch heads and all PR refs) | git cat-file on fresh clone with refs/pull/* | Prism |
| RECON-N07 | P3 | Merged GreenField branches still exist remotely: andy/calls-1, andy/messaging-backend-1, fix/api-dockerfile-intelligence-core (all ancestors of main) | git ls-remote | ATLAS (deletion needs Mac + owner approval) |
