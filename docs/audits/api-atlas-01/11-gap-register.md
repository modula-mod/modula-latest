# Gap Register

Status: **PASS**. Findings: 40; P1=16, P2=20, P3=4. No P0 was established after authenticated production and controlled exact-schema acceptance; known defects are fully characterized.

Types: DB/API mismatch=1, architecture debt=7, client contract mismatch=1, data exposure risk=1, dead endpoint=1, duplicate endpoint=1, event delivery gap=1, inconsistent permission=1, missing artifact=1, missing endpoint=3, missing idempotency=1, missing ownership check=2, missing request schema=3, missing signature verification=1, missing storage delivery=2, missing worker=2, module special case=1, observability gap=2, orphan table=1, partial endpoint=1, performance risk=1, placeholder implementation=4, untested endpoint=1.

## API-ATLAS-GAP-001 — P1 — Running production revision is not canonical origin/main

- Domain/type: `release` / `architecture debt`
- Evidence: `evidence/production-snapshot.json#/repository`, `evidence/production-snapshot.json#/containers/api/revision`
- Affected routes: none/architectural
- Affected files: none
- Production impact: The captured production source revision differs from origin/main and does not yet have an accepted canonical-lineage disposition.
- Recommended fix: Converge the deployed revision through reviewed mainline history and record the source, build, image, deployment and runtime correlation.
- Dependencies: release governance
- Verification: Fetch origin, prove ancestry, and compare OCI revision plus /version.json after a reviewed deployment.

## API-ATLAS-GAP-002 — P1 — Follower-only profiles have no follow-request approval flow

- Domain/type: `social` / `missing endpoint`
- Evidence: `services/greenfield-api/src/domains/profiles/writes.ts:57`, `services/greenfield-api/src/domains/profiles/writes.ts:89`
- Affected routes: `POST /v1/profiles/:profileId/follow`
- Affected files: `services/greenfield-api/src/domains/profiles/writes.ts`
- Production impact: Any authenticated follower can create the follow row immediately; follower-only visibility therefore has no owner approval boundary.
- Recommended fix: Add pending/accept/reject follow requests and make follower-only authorization depend on accepted state.
- Dependencies: social schema, client request UI
- Verification: Cross-user acceptance must prove an unapproved account cannot view follower-only data.

## API-ATLAS-GAP-003 — P1 — All published releases are unsigned and unsigned releases are still trusted

- Domain/type: `modules` / `missing signature verification`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/publishedUnsignedReleases`, `services/greenfield-api/src/modules/registry-trust-service.ts:109`, `services/greenfield-api/src/modules/registry-trust-service.ts:127`, `services/greenfield-api/src/modules/release-service.ts:441`
- Affected routes: `GET /v1/registry/modules/:moduleId`, `POST /v1/modules/:moduleId/install`
- Affected files: `services/greenfield-api/src/modules/release-signing.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`
- Production impact: Cryptographic Ed25519 verification exists, but 12 of 12 published releases have no signature and policy calls them verified.
- Recommended fix: Require a verified publisher signature for production publication/install, with an explicit controlled legacy migration.
- Dependencies: publisher key ceremony, release republishing
- Verification: A tampered/unsigned test release must be rejected; current releases must return signature.state=verified.

## API-ATLAS-GAP-004 — P1 — Only 2 of 14 registry releases have retrievable package bytes

- Domain/type: `modules` / `missing artifact`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/releaseArtifactCoverage`, `docs/audits/api-atlas-01/evidence/live-probes.json`
- Affected routes: `GET /v1/registry/releases/:releaseId/artifact`, `POST /v1/modules/:moduleId/install`
- Affected files: `services/greenfield-api/src/modules/install-descriptor-service.ts`
- Production impact: Published metadata can exist without an artifact ref, preventing independent package retrieval/verification for most releases.
- Recommended fix: Backfill immutable package blobs and block publication/installability when the package is absent.
- Dependencies: registry ingestion, artifact retention
- Verification: Every published installable release must pass a digest-matched artifact GET.

## API-ATLAS-GAP-005 — P1 — Seven of seventeen module presentation assets have metadata but no blob

- Domain/type: `modules` / `missing storage delivery`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/presentationAssets`, `docs/audits/api-atlas-01/evidence/live-probes.json`
- Affected routes: `GET /v1/registry/releases/:releaseId/assets/:assetId`
- Affected files: `services/greenfield-api/src/modules/routes/index.ts`
- Production impact: Product Hub receives declared URLs whose asset route returns 404 for affected releases.
- Recommended fix: Require asset blob presence during ingestion/publication and backfill or remove broken metadata.
- Dependencies: registry ingestion, artwork pipeline
- Verification: Catalogue crawl must retrieve and digest-check every advertised available asset.

## API-ATLAS-GAP-006 — P1 — Runtime auto-grants manifest permissions when no review row exists

- Domain/type: `modules` / `inconsistent permission`
- Evidence: `services/greenfield-api/src/modules/runtime-access.ts:51`, `services/greenfield-api/src/modules/runtime-access.ts:71`, `evidence/production-snapshot.json#/operationalAggregates/activeInstallPermissionReviews`
- Affected routes: `GET /v1/modules/:moduleId/records/:collection`, `POST /v1/modules/:moduleId/actions/:actionId`
- Affected files: `services/greenfield-api/src/modules/runtime-access.ts`
- Production impact: Two active production installations have no review; their declared permissions become effective without recorded user grant.
- Recommended fix: Remove the fallback for production, backfill explicit reviews, and fail closed when grant evidence is absent.
- Dependencies: installation migration
- Verification: All active installations must have a review and missing-review requests must return FORBIDDEN.

## API-ATLAS-GAP-007 — P1 — Reaction notification jobs are dead-lettering on database uniqueness errors

- Domain/type: `activity` / `event delivery gap`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/failedJobs`, `evidence/production-snapshot.json#/operationalAggregates/jobFailureDetails`
- Affected routes: `PUT /v1/posts/:postId/reaction`, `GET /v1/notifications`
- Affected files: `services/greenfield-worker/src/notifications/create.ts`
- Production impact: Ten notification.reaction jobs reached DEAD_LETTER with PostgreSQL 23505, most recently 2026-10-02.
- Recommended fix: Make notification aggregation/upsert idempotent, repair/replay affected dead letters, and add an alert.
- Dependencies: notification schema, dead-letter replay
- Verification: Repeated reactions must converge to one notification and leave no dead letter.

## API-ATLAS-GAP-008 — P1 — No operational production model/provider is available

- Domain/type: `intelligence` / `placeholder implementation`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/aiProviders`, `evidence/production-snapshot.json#/operationalAggregates/aiRuntime`, `services/greenfield-api/src/ai/providers/resolver.ts:53`
- Affected routes: `POST /v1/modules/:moduleId/ai/requests`, `POST /v1/ai/requests`
- Affected files: `services/greenfield-api/src/ai/provider-runtime-service.ts`
- Production impact: All real providers/models are unconfigured or disabled; the sole available model is a development mock and production has zero executions.
- Recommended fix: Configure and verify a governed real/local provider, then run safe production acceptance through the gateway.
- Dependencies: provider credentials, policy approval
- Verification: A non-mock production request must execute, ledger usage, and pass failure/timeout tests.

## API-ATLAS-GAP-009 — P1 — GAIA is an acceptance-fixture planner, not a general operational planner

- Domain/type: `intelligence` / `placeholder implementation`
- Evidence: `packages/intelligence-governance/src/gaia.ts:10`, `packages/intelligence-governance/src/gaia.ts:17`, `packages/intelligence-governance/src/gaia.ts:86`, `services/greenfield-api/src/intelligence/service.ts:18`
- Affected routes: `POST /v1/intelligence/missions/:missionId/start`
- Affected files: `packages/intelligence-governance/src/gaia.ts`, `services/greenfield-api/src/intelligence/service.ts`
- Production impact: Only four exact fixture objectives are recognized and production has zero mission/decision/ledger rows.
- Recommended fix: Introduce a provider-backed or local Nodus planner behind the existing governed proposal contract without bypassing AKI.
- Dependencies: operational provider, Nodus contract
- Verification: Unseen objectives must yield bounded proposals and every run must traverse decisions, approvals and ledger.

## API-ATLAS-GAP-010 — P1 — No Nodus integration surface or local-client contract exists

- Domain/type: `intelligence` / `missing endpoint`
- Evidence: `evidence/source-sweep.json`, `packages/intelligence-contracts/src/domain.ts`
- Affected routes: none/architectural
- Affected files: `packages/intelligence-contracts/src`
- Production impact: Native/offline Nodus has no declared handshake, capability discovery, proposal submission or synchronization contract.
- Recommended fix: Define a local-first Nodus adapter/API boundary using intelligence contracts; do not model Nodus as a cloud provider.
- Dependencies: intelligence contract design
- Verification: Contract tests must cover offline proposal, reconnect, approval and ledger synchronization.

## API-ATLAS-GAP-011 — P1 — Legacy remote function invocation trusts a client-supplied installation ID

- Domain/type: `security` / `missing ownership check`
- Evidence: `services/greenfield-api/src/app/register-routes.ts:1244`, `services/greenfield-api/src/app/register-routes.ts:1250`, `services/greenfield-api/src/functions/service.ts:6`, `services/greenfield-api/src/extensions/capability-resolver.ts:2`, `evidence/production-snapshot.json#/operationalAggregates/legacyFunctionRuntime`
- Affected routes: `POST /v1/functions/:functionId/invoke`
- Affected files: `services/greenfield-api/src/functions/service.ts`, `services/greenfield-api/src/extensions/capability-resolver.ts`
- Production impact: Any authenticated account can nominate another installation ID; the service checks only that installation capability, not installation ownership. Production has two remoteHttp functions but zero active function:invoke grants, so no currently executable production path was proven.
- Recommended fix: Require the installation to belong to the authenticated account and route through the canonical installation/runtime permission service; deprecate the legacy invoke route.
- Dependencies: function route consolidation
- Verification: Two-account integration test must reject B invoking through A installation; an enabled owned grant must still execute through SSRF policy.

## API-ATLAS-GAP-012 — P1 — AI stream cancel and reconnect omit account ownership checks

- Domain/type: `security` / `missing ownership check`
- Evidence: `services/greenfield-api/src/ai/routes.ts:186`, `services/greenfield-api/src/ai/routes.ts:198`, `services/greenfield-api/src/ai/streaming-runtime.ts:50`, `services/greenfield-api/src/ai/streaming-runtime.ts:94`, `evidence/production-snapshot.json#/operationalAggregates/aiRuntime/streams`
- Affected routes: `POST /v1/ai/streams/:streamId/cancel`, `POST /v1/ai/streams/:streamId/reconnect`
- Affected files: `services/greenfield-api/src/ai/routes.ts`, `services/greenfield-api/src/ai/streaming-runtime.ts`
- Production impact: The routes authenticate but pass only streamId; repository loads the stream without account scope. Production has zero stream rows, so active cross-account impact was not exercised.
- Recommended fix: Pass auth.accountId into streaming operations and query/update by stream plus account; return uniform not-found to other users.
- Dependencies: AI stream contract
- Verification: Two-account test must prove B cannot observe, cancel or reconnect A stream.

## API-ATLAS-GAP-013 — P1 — Link and poll composer contracts are not persisted by GreenField

- Domain/type: `posts` / `client contract mismatch`
- Evidence: `packages/api-contracts/src/posts.ts:103`, `services/greenfield-api/src/domains/posts/writes.ts:32`, `src/features/composer/screens/ComposerScreen.tsx:523`
- Affected routes: `POST /v1/posts`
- Affected files: `packages/api-contracts/src/posts.ts`, `services/greenfield-api/src/domains/posts/writes.ts`
- Production impact: The client has link/poll concepts; the server input has neither. A linkPreview field can be ignored while a text post succeeds.
- Recommended fix: Either remove/disable the controls at the API boundary or implement explicit validated link and poll persistence/contracts.
- Dependencies: post schema, client decoder
- Verification: Contract tests must prove each advertised composer type survives create and retrieval.

## API-ATLAS-GAP-014 — P1 — Legacy post image limit is incompatible with nginx public body limit

- Domain/type: `media` / `missing storage delivery`
- Evidence: `/etc/nginx/conf.d/api.modula.digital.greenfield.conf:12`, `services/greenfield-api/src/domains/media/post-media-storage.ts:117`
- Affected routes: `POST /v1/posts`
- Affected files: `services/greenfield-api/src/domains/media/post-media-storage.ts`
- Production impact: GreenField accepts up to 20 MiB of legacy image bytes, but nginx rejects the base64 request above 1 MiB before Fastify.
- Recommended fix: Retire legacy inline media in favor of attachment upload, or align a narrowly scoped edge limit.
- Dependencies: client upload migration, nginx review
- Verification: A boundary-size audit attachment must publish through the intended path without widening unrelated routes.

## API-ATLAS-GAP-015 — P1 — User media exists only on one host bind mount

- Domain/type: `media` / `architecture debt`
- Evidence: `evidence/production-snapshot.json#/storage`, `services/greenfield-api/src/domains/attachments/service.ts:169`
- Affected routes: `GET /v1/attachments/:attachmentId/content`, `GET /v1/media/:mediaFile`, `GET /v1/media/stories/:mediaFile`
- Affected files: `services/greenfield-api/src/domains/attachments/service.ts`
- Production impact: Container recreation preserves the bind, but host loss has no discovered object replication or storage readiness/recovery contract.
- Recommended fix: Define backed-up object storage or a tested media backup/restore policy and expose storage readiness internally.
- Dependencies: storage decision, recovery rehearsal
- Verification: Restore media plus metadata to a clean host and digest-check every referenced object.

## API-ATLAS-GAP-016 — P1 — Automated registry/GitHub ingestion is disabled and has no production source

- Domain/type: `modules` / `missing worker`
- Evidence: `evidence/production-snapshot.json#/config/worker/safe/GREENFIELD_MODULE_GITHUB_SYNC_ENABLED`, `evidence/production-snapshot.json#/operationalAggregates/syncSources`, `services/greenfield-worker/src/jobs/runner.ts:84`
- Affected routes: `POST /v1/admin/registry/sync`
- Affected files: `services/greenfield-api/src/modules/github-release-sync-service.ts`, `services/greenfield-worker/src/jobs/runner.ts`
- Production impact: Ingestion code exists, but production automation is disabled, source count is zero, and the two historical runs cannot recur automatically.
- Recommended fix: Configure a reviewed source and exercise repository-to-published-release convergence with signature/artifact gates.
- Dependencies: signing policy, GitHub source
- Verification: A tagged release must be discovered, verified, ingested and published without manual database work.

## API-ATLAS-GAP-017 — P2 — No application route registers a Fastify request or response schema

- Domain/type: `contracts` / `missing request schema`
- Evidence: `api-atlas.json#/routes`, `openapi.generated.yaml`
- Affected routes: none/architectural
- Affected files: `services/greenfield-api/src`
- Production impact: All 393 routes rely on ad hoc handler/service validation; derived OpenAPI cannot describe request/response bodies.
- Recommended fix: Adopt shared schemas incrementally at trust-boundary and mutating routes, then generate canonical OpenAPI.
- Dependencies: API contract ownership
- Verification: Runtime route capture must report schemas for prioritized routes and OpenAPI validation must pass.

## API-ATLAS-GAP-018 — P2 — Attachment orphan cleanup exists but is never scheduled

- Domain/type: `media` / `missing worker`
- Evidence: `services/greenfield-api/src/domains/attachments/service.ts:191`, `services/greenfield-api/tests/post04.attachments.test.ts:199`, `evidence/production-snapshot.json#/operationalAggregates/readyAttachmentLinkage`
- Affected routes: `POST /v1/attachments/uploads`
- Affected files: `services/greenfield-api/src/domains/attachments/service.ts`
- Production impact: Five ready attachments are unbound; only tests invoke cleanup.
- Recommended fix: Add a bounded worker/ops job with retention, metrics and dry-run visibility.
- Dependencies: worker schedule
- Verification: Expired sessions/orphans must be removed while bound media remains retrievable.

## API-ATLAS-GAP-019 — P2 — Story upload validates labels but not decoded size or file signature

- Domain/type: `media` / `missing request schema`
- Evidence: `services/greenfield-api/src/domains/stories/service.ts:280`, `services/greenfield-api/src/domains/stories/service.ts:333`, `services/greenfield-api/src/domains/stories/service.ts:411`
- Affected routes: `POST /v1/stories`
- Affected files: `services/greenfield-api/src/domains/stories/service.ts`
- Production impact: Arbitrary base64 bytes can be stored under an image/video content type; expiration/deletion leaves files on disk.
- Recommended fix: Reuse AttachmentPolicy byte/count/signature validation and add physical cleanup.
- Dependencies: attachment service
- Verification: Invalid magic bytes and oversized decoded payloads must fail; expired bytes must be removed.

## API-ATLAS-GAP-020 — P2 — Profile media has competing canonical-attachment and arbitrary-URL paths

- Domain/type: `profiles` / `architecture debt`
- Evidence: `services/greenfield-api/src/domains/profiles/writes.ts:173`, `services/greenfield-api/src/domains/profiles/writes.ts:292`
- Affected routes: `PATCH /v1/profiles/me`, `POST /v1/profiles/me/avatar`, `POST /v1/profiles/me/cover`
- Affected files: `services/greenfield-api/src/domains/profiles/writes.ts`
- Production impact: PATCH can bypass profile_media ownership/binding with an arbitrary public HTTPS URL, producing two ownership/delivery models.
- Recommended fix: Deprecate raw avatarUri/coverUri writes and require owned attachment bindings.
- Dependencies: client migration
- Verification: All new avatar/cover writes must create profile_media and resolve to canonical attachment URLs.

## API-ATLAS-GAP-021 — P2 — Unknown feed modes silently receive a mislabeled fallback

- Domain/type: `feed` / `missing request schema`
- Evidence: `services/greenfield-api/src/app/register-routes.ts:1443`, `services/greenfield-api/src/app/register-routes.ts:1449`
- Affected routes: `GET /v1/feed/home`
- Affected files: `services/greenfield-api/src/app/register-routes.ts`
- Production impact: Typos or unsupported modes do not fail validation and are labeled modules-chrono-v1.
- Recommended fix: Validate the FeedMode enum before querying.
- Dependencies: shared schema
- Verification: Unknown mode must return VALIDATION_FAILED; three supported modes need response snapshots.

## API-ATLAS-GAP-022 — P2 — Attachment authorization distinguishes private existing IDs from unknown IDs

- Domain/type: `privacy` / `data exposure risk`
- Evidence: `services/greenfield-api/src/app/register-attachment-routes.ts:91`, `services/greenfield-api/src/app/register-attachment-routes.ts:110`
- Affected routes: `GET /v1/attachments/:attachmentId/content`
- Affected files: `services/greenfield-api/src/app/register-attachment-routes.ts`
- Production impact: An unauthorised existing attachment returns 403 while an unknown ID returns 404, disclosing existence if a UUID is learned.
- Recommended fix: Use a uniform not-found response for unauthorized private media and test timing/shape consistency.
- Dependencies: error policy
- Verification: Cross-user fixture must receive the same status/shape for private-existing and unknown IDs.

## API-ATLAS-GAP-023 — P2 — Follow, reaction and comment counters have concurrent race windows

- Domain/type: `social` / `missing idempotency`
- Evidence: `services/greenfield-api/src/domains/profiles/writes.ts:81`, `services/greenfield-api/src/domains/reactions/service.ts:25`, `services/greenfield-api/src/domains/comments/service.ts:156`
- Affected routes: `POST /v1/profiles/:profileId/follow`, `PUT /v1/posts/:postId/reaction`, `POST /v1/posts/:postId/comments`
- Affected files: `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/reactions/service.ts`, `services/greenfield-api/src/domains/comments/service.ts`
- Production impact: Select-then-insert can surface unique violations, and read-then-set counters can lose increments.
- Recommended fix: Use conflict-safe upserts/row locks or atomic SQL increments and add concurrency tests.
- Dependencies: database transaction design
- Verification: Parallel duplicate submissions must converge without 500s or counter drift.

## API-ATLAS-GAP-024 — P2 — Discover/activity surfaces are unpaginated and activity is N+1 hydrated

- Domain/type: `discover` / `performance risk`
- Evidence: `services/greenfield-api/src/domains/discovery/repository.ts:96`, `services/greenfield-api/src/domains/discovery/repository.ts:107`
- Affected routes: `GET /v1/discover`, `GET /v1/activity`
- Affected files: `services/greenfield-api/src/domains/discovery/repository.ts`
- Production impact: Activity reads every active row and resolves profiles in a loop; growth can create unbounded latency.
- Recommended fix: Add stable cursor pagination and batch actor hydration.
- Dependencies: response contract
- Verification: Seeded volume test must show bounded queries and stable cursors.

## API-ATLAS-GAP-025 — P2 — No persistent real-time social or push delivery surface exists

- Domain/type: `realtime` / `missing endpoint`
- Evidence: `services/greenfield-api/src/ai/routes.ts:136`, `/etc/nginx/conf.d/api.modula.digital.greenfield.conf:21`
- Affected routes: `GET /v1/ai/executions/:executionId/stream`
- Affected files: `services/greenfield-api/src/ai/routes.ts`
- Production impact: The sole SSE path replays AI events; nginx has no WebSocket upgrade and no APNs/web-push subscription API was found.
- Recommended fix: Define polling guarantees or add governed SSE/push subscription infrastructure.
- Dependencies: notification delivery design
- Verification: A client must receive a new notification through the documented mechanism with reconnect semantics.

## API-ATLAS-GAP-026 — P2 — Connector metadata advertises webhooks without inbound webhook routes

- Domain/type: `connectors` / `placeholder implementation`
- Evidence: `services/greenfield-api/src/connectors/provider-metadata.ts:60`, `services/greenfield-api/src/connectors/provider-metadata.ts:107`, `api-atlas.json#/routes`
- Affected routes: none/architectural
- Affected files: `services/greenfield-api/src/connectors/provider-metadata.ts`
- Production impact: Provider definitions claim webhook support, but only the module-backend Modula webhook route exists.
- Recommended fix: Mark providers unimplemented or add signed, replay-safe, idempotent provider ingress.
- Dependencies: provider adapters
- Verification: Each advertised webhook provider must have a verified route and replay test.

## API-ATLAS-GAP-027 — P2 — Several accepted worker job types complete with no side effect

- Domain/type: `async` / `dead endpoint`
- Evidence: `services/greenfield-worker/src/jobs/runner.ts:95`, `services/greenfield-worker/src/jobs/runner.ts:140`, `services/greenfield-worker/src/jobs/runner.ts:183`
- Affected routes: none/architectural
- Affected files: `services/greenfield-worker/src/jobs/runner.ts`
- Production impact: Lifecycle event-like jobs, module.settings.migrate and audit.checkpoint are marked succeeded after a no-op.
- Recommended fix: Stop enqueueing event names as jobs or implement explicit consumers and audit checkpoint behavior.
- Dependencies: event/job taxonomy
- Verification: Every supported job type must have an asserted effect or be rejected as unsupported.

## API-ATLAS-GAP-028 — P2 — Vault Notes remains special-cased outside the generic host

- Domain/type: `modules` / `module special case`
- Evidence: `services/greenfield-api/src/intelligence/action-boundary.ts:8`, `services/greenfield-api/src/ai/product-action-service.ts:23`, `services/greenfield-worker/src/search/subscribers.ts:23`, `src/features/board/screens/BoardScreen.tsx:114`
- Affected routes: `POST /v1/intelligence/missions/:missionId/start`, `POST /v1/modules/:moduleId/ai/actions/:actionId/executions`
- Affected files: `services/greenfield-api/src/intelligence/action-boundary.ts`, `services/greenfield-api/src/ai/product-action-service.ts`, `services/greenfield-worker/src/search/subscribers.ts`, `src/features/board/screens/BoardScreen.tsx`
- Production impact: Generic MPS hosting works, but search, governed actions, AI actions, Board and presentation logic contain product-specific branches.
- Recommended fix: Move behaviors into manifest/schema/action/projector declarations and retain only generic adapters.
- Dependencies: module standard extensions
- Verification: A neutral reference module must exercise the same flows without core code changes.

## API-ATLAS-GAP-029 — P2 — Only 6 of 36 historical install plans carry the current descriptor

- Domain/type: `modules` / `partial endpoint`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/installPlans`, `services/greenfield-api/src/modules/install-descriptor-service.ts:14`
- Affected routes: `GET /v1/modules/:moduleId/install-descriptor`
- Affected files: `services/greenfield-api/src/modules/install-descriptor-service.ts`
- Production impact: Current descriptors are complete, but historical plans cannot be audited through the same immutable contract.
- Recommended fix: Backfill descriptors where release facts are sufficient or explicitly version legacy plans.
- Dependencies: migration policy
- Verification: Every active installation must resolve a digest-verified descriptor.

## API-ATLAS-GAP-031 — P2 — profile_links is read but has no current write API

- Domain/type: `profiles` / `DB/API mismatch`
- Evidence: `services/greenfield-api/src/domains/profiles/repository.ts:166`, `04-database-api-map.md`
- Affected routes: `GET /v1/profiles/:handle`, `PATCH /v1/profiles/me`
- Affected files: `services/greenfield-api/src/domains/profiles/repository.ts`
- Production impact: The table participates in serialization, but profile update writes only the single website fields on profiles.
- Recommended fix: Define link CRUD or retire/migrate the table.
- Dependencies: profile contract
- Verification: Create/update/delete a link and verify privacy-filtered retrieval.

## API-ATLAS-GAP-032 — P2 — Legacy and canonical media/social/auth paths overlap

- Domain/type: `architecture` / `duplicate endpoint`
- Evidence: `services/greenfield-api/src/domains/media/post-media-storage.ts:29`, `services/greenfield-api/src/domains/attachments/service.ts:13`, `services/greenfield-api/src/app/register-routes.ts:1425`
- Affected routes: `POST /v1/posts`, `POST /v1/attachments/uploads`, `POST /v1/sessions`, `POST /v1/accounts/sessions`
- Affected files: `services/greenfield-api/src`
- Production impact: Multiple upload, session and reaction/like paths increase contract drift and already differ at the edge.
- Recommended fix: Declare canonical routes, instrument callers, and deprecate aliases with compatibility windows.
- Dependencies: client migration
- Verification: All clients use canonical routes; aliases have explicit sunset tests.

## API-ATLAS-GAP-033 — P2 — Request IDs do not provide complete nginx-to-worker tracing

- Domain/type: `observability` / `observability gap`
- Evidence: `services/greenfield-api/src/app/register-plugins.ts:8`, `services/greenfield-worker/src/observability/metrics.ts:3`, `/etc/nginx/conf.d/api.modula.digital.greenfield.conf:21`
- Affected routes: none/architectural
- Affected files: `services/greenfield-api/src/app/register-plugins.ts`, `services/greenfield-worker/src/observability/metrics.ts`
- Production impact: API/worker use structured logs and database trace fields, but nginx does not preserve the generated response ID into a shared trace and no metrics/tracing backend was discovered.
- Recommended fix: Propagate trace/correlation IDs into jobs and edge logs; export queue/dead-letter/error metrics.
- Dependencies: observability backend
- Verification: One synthetic request must be traceable across edge, API, outbox, job and result.

## API-ATLAS-GAP-034 — P2 — Worker container has no Docker healthcheck

- Domain/type: `operations` / `observability gap`
- Evidence: `evidence/production-snapshot.json#/containers/worker`, `services/greenfield-api/src/domains/system/status.ts:91`
- Affected routes: none/architectural
- Affected files: none
- Production impact: The new DB heartbeat makes status observable, but Docker cannot independently mark the worker unhealthy.
- Recommended fix: Add a non-invasive healthcheck based on process/heartbeat freshness.
- Dependencies: deployment config
- Verification: Stopping worker progress must transition container/status health within the documented window.

## API-ATLAS-GAP-035 — P2 — 70 application routes have no statically matched automated test

- Domain/type: `testing` / `untested endpoint`
- Evidence: `api-atlas.json#/routes`
- Affected routes: none/architectural
- Affected files: none
- Production impact: The route families remain regression-prone; the per-route list is in api-atlas.json.
- Recommended fix: Prioritize authz, mutations, admin/service ingress and feature-gated routes.
- Dependencies: test fixtures
- Verification: Atlas automatedTest coverage should reach the agreed threshold with security routes at 100%.

## API-ATLAS-GAP-036 — P2 — All module presentation assets are marked development-only

- Domain/type: `modules` / `placeholder implementation`
- Evidence: `evidence/production-snapshot.json#/operationalAggregates/presentationAssets`
- Affected routes: `GET /v1/registry/modules/:moduleId`
- Affected files: none
- Production impact: Even retrievable Product Hub artwork is explicitly placeholder/development media.
- Recommended fix: Publish production artwork with provenance and remove the development flag.
- Dependencies: design approval, asset ingestion
- Verification: Public catalogue must contain no developmentAsset=true for released products.

## API-ATLAS-GAP-037 — P2 — Legacy canonical backend verifier is pinned to schema 055

- Domain/type: `testing` / `architecture debt`
- Evidence: `scripts/verify-greenfield-backend-v1.mjs:98`, `evidence/production-snapshot.json#/databaseSchema/appliedMigrations`
- Affected routes: none/architectural
- Affected files: `scripts/verify-greenfield-backend-v1.mjs`
- Production impact: The umbrella verifier requires schema 055 and exact clean main, while observed production is validly at 063_settings_backend_v2; it cannot truthfully serve as the current acceptance command.
- Recommended fix: Update the verifier to derive the current migration ledger and separate source, audit-branch, web and production convergence gates.
- Dependencies: verification ownership
- Verification: The canonical verifier must pass on reviewed current main at 063_settings_backend_v2 without weakening exact-SHA production checks.

## API-ATLAS-GAP-038 — P3 — 14 tables have no API/worker source reference

- Domain/type: `database` / `orphan table`
- Evidence: `04-database-api-map.md`
- Affected routes: none/architectural
- Affected files: none
- Production impact: The static scan identifies legacy, verifier-only or incomplete surfaces that need explicit ownership; it does not prove they are safe to drop.
- Recommended fix: Assign a disposition to each candidate before any cleanup migration.
- Dependencies: schema owners
- Verification: Repository-wide reference and production usage review resolves every candidate.

## API-ATLAS-GAP-039 — P3 — Multiple old verification/recovery PostgreSQL containers remain running

- Domain/type: `operations` / `architecture debt`
- Evidence: `evidence/production-snapshot.json#/hostProcesses/docker`
- Affected routes: none/architectural
- Affected files: none
- Production impact: Old test/recovery databases consume resources and complicate topology, though they are excluded from production truth.
- Recommended fix: Inventory owners and retire only after backup/recovery confirmation.
- Dependencies: operations approval
- Verification: Only documented production and active audit containers remain.

## API-ATLAS-GAP-040 — P3 — Redis is running without persistence and has no application source references

- Domain/type: `operations` / `architecture debt`
- Evidence: `evidence/production-snapshot.json#/redisRuntime`, `evidence/production-snapshot.json#/containers/redis`
- Affected routes: none/architectural
- Affected files: none
- Production impact: Redis adds operational surface but GreenField uses PostgreSQL queues and no Redis client reference was found.
- Recommended fix: Remove it from the GreenField stack if truly unused, or document and monitor its intended role.
- Dependencies: compose review
- Verification: Dependency graph either names a real Redis consumer or the service is absent.

## API-ATLAS-GAP-041 — P3 — Route-to-table and caller mappings are static approximations

- Domain/type: `atlas` / `architecture debt`
- Evidence: `route-data-map.json`, `client-contract-analysis.json`
- Affected routes: none/architectural
- Affected files: none
- Production impact: Dynamic dispatch, SQL helpers and client-computed paths can evade the extractor; confidence is recorded per route.
- Recommended fix: Add runtime SQL tracing in a disposable test harness and typed client instrumentation.
- Dependencies: test environment
- Verification: Representative flows reconcile static maps with observed queries without production tracing.


The JSON form is canonical for remediation tooling and preserves these fields verbatim.

## TODO / FIXME / placeholder sweep

The literal sweep found 266 marker occurrences; 261 are outside test/fixture/demo paths. They are not automatically defects. Classification totals: configuration-safety-guard=4, contract-or-ui-placeholder-field=33, development-adapter-or-comment=25, feature-gated-experimental-protocol=19, implementation-word-review=37, ordinary-error-handling-review=79, possible-runtime-placeholder=64, test-fixture-or-development=5. Every source location, marker and excerpt is in `evidence/source-sweep.json`. Confirmed operational placeholders from that set are represented as gaps above; ordinary error throws, contract/UI placeholder fields, safety guards and feature-gated experimental namespaces remain explicitly distinguished.
