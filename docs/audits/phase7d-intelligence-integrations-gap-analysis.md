# Phase 7D Intelligence And Integrations Gap Analysis

Status: INITIAL AUDIT
Date: 2026-07-28
Repository: `/home/andrei/modula-latest`
Branch: `phase7d-greenfield-intelligence-integrations`
Starting commit: `9b2b6996f18f2c03675c535b7af7659ecd13f09f`

## Gate Evidence

The Phase 7D start gate was accepted using the production runtime context rather than the VPS host shell. The deployed Greenfield API runs inside the Compose network where `greenfield-postgres` is intentionally resolvable.

- Git branch before Phase 7D branch creation: `main`
- Working tree before Phase 7D branch creation: clean
- `HEAD` and `origin/main`: `9b2b6996f18f2c03675c535b7af7659ecd13f09f`
- Remote heads before branch creation: `refs/heads/main` only
- Production readiness: `GET https://api.modula.digital/v1/health/ready` returned `ready`
- Runtime migration check: `docker exec -i modula-preview-greenfield-api-1 pnpm --filter @modula/greenfield-api db:status`
- Latest applied migration: `014_phase7c_account_actor_backfill`
- Pending migrations: `[]`

The host-shell failure against `greenfield-postgres` was a Docker-network context mismatch, not evidence of an unknown migration state.

## Required Sources Read

- `docs/architecture/phase7d-runtime-platform.md`
- `docs/architecture/adr/ADR-015-greenfield-runtime-platform.md`
- `docs/product/modula-founder-alpha.md`
- `docs/product/modula-product-language.md`
- `docs/validation/phase7c-final-report.md`
- `docs/validation/phase7c-verifier-reconciliation.md`

## Implementation Inventory

Repository inventory was collected with the required commands:

- `find packages -maxdepth 3 -type f | sort`
- `find services/greenfield-api/src -type f | sort`
- `find services/greenfield-worker/src -type f | sort`
- `find src/features -type f | sort`
- `find scripts -maxdepth 1 -type f | sort | rg "phase7|module|runtime|connector|integration|ai|worker"`

Existing Phase 7A-7C foundations are substantial, but Phase 7D packages and domains have not been created yet.

## Classification Vocabulary

- Implemented: wired, persisted where needed, routed, and covered by current code/tests.
- Partially implemented: a real foundation exists, but Phase 7D scope is not complete.
- Contract only: shared types or manifest declarations exist, but no operational service.
- Placeholder: visible UI/table/route exists but does not perform the Phase 7D behavior.
- Missing: no meaningful implementation found.
- Unsafe: current behavior would violate a Phase 7D security or product requirement if reused unchanged.
- Conflicting: current behavior conflicts with the Phase 7D target model.
- Obsolete: older behavior should be retired or wrapped by the new platform.

## Current Strengths To Preserve

| Area | Classification | Evidence | Recommendation |
| --- | --- | --- | --- |
| Greenfield account sessions | Implemented | `services/greenfield-api/src/sessions/service.ts`, `services/greenfield-api/src/security/auth-context.ts`, `services/greenfield-api/migrations/004_greenfield_sovereign_core.sql` | Reuse Greenfield account/session authority for Phase 7D account scoping. Do not add a parallel auth system. |
| Legacy preview actor sessions | Partially implemented | `services/greenfield-api/src/security/session.ts`, `services/greenfield-api/src/app/register-routes.ts` | Keep only where Phase 6/7C routes still require it. New Phase 7D account-owned APIs should use `GreenfieldSessionService`. |
| API request envelope | Partially implemented | `services/greenfield-api/src/transport/envelope.ts`, `src/api/decoding/decodeApiEnvelope.ts`, `src/api/contracts/ApiError.ts` | Extend this envelope to the required `GreenfieldApiError` shape instead of creating a second response format. |
| Request correlation | Partially implemented | `services/greenfield-api/src/transport/envelope.ts`, `services/greenfield-api/src/app/register-routes.ts` | `request.id` reaches API responses today. Phase 7D must propagate it into audit events, worker jobs, AI runs, connector action runs, and frontend diagnostics. |
| Environment validation | Implemented for existing services | `services/greenfield-api/src/config/env.ts`, `services/greenfield-worker/src/config.ts` | Extend existing Zod config modules for connector, credential, AI, automation, and runtime provider settings. Optional providers must validate without making the core API unready. |
| Secret redaction in logs | Partially implemented | `services/greenfield-api/src/app/create-server.ts`, `services/greenfield-api/src/observability/logger.ts`, `services/greenfield-worker/src/observability/logger.ts` | Reuse logger redaction, then add explicit credential-envelope redaction tests for connector and AI fields. |
| Authenticated encryption primitive | Partially implemented | `services/greenfield-api/src/security/crypto.ts`, `services/greenfield-worker/src/bridges/atproto/session-crypto.ts` | Generalise into a credential encryption service with key versions, access/refresh token separation, and rotation documentation. Do not reuse AT-only names for generic credentials. |
| SSRF guard | Partially implemented | `services/greenfield-api/src/security/ssrf.ts`, `services/greenfield-worker/src/bridges/atproto/ssrf-guard.ts` | Promote to a shared Phase 7D outbound-request policy for generic REST connectors, webhook sends, and provider metadata fetches. Add allow-list and port-policy support. |
| Module registry and immutable releases | Implemented | `packages/greenfield-module-manifest/src/manifest.ts`, `packages/greenfield-module-registry-contracts/src/*`, `services/greenfield-api/src/modules/*`, `services/greenfield-api/migrations/009_phase7a_module_platform.sql` | Build runtime resolution on installed module -> immutable release -> declared requirements. Do not bypass release/provenance tables. |
| Module install lifecycle | Implemented | `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`, `services/greenfield-worker/src/modules/enable-handler.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts` | Reuse idempotent lifecycle queue patterns for runtime session cleanup, connector enable/disable, and automation enable/disable. |
| Module permissions | Partially implemented | `services/greenfield-api/src/modules/permission-service.ts`, `services/greenfield-api/src/modules/runtime-access.ts`, `greenfield_module_permission_reviews` in `services/greenfield-api/src/database/types.ts` | Preserve account-scoped permission reviews. Add runtime capability mapping and connection/AI/automation permission grants as separate Phase 7D tables. |
| Module records | Implemented | `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/migrations/010_phase7b_module_runtime.sql`, `packages/greenfield-module-ui-contracts/src/index.ts` | Treat records provider as a trusted built-in runtime provider (`modula.records`). |
| Module actions | Partially implemented | `services/greenfield-api/src/modules/action-service.ts`, `src/features/modules/runtime/module-view-renderer.tsx`, `greenfield_module_action_events` in `services/greenfield-api/migrations/010_phase7b_module_runtime.sql` | Treat action provider as trusted built-in (`modula.actions`), but add runtime launch decisions, confirmation policy mapping, and AI-tool write gates. |
| Functions | Partially implemented | `packages/greenfield-contracts/src/function.ts`, `services/greenfield-api/src/functions/service.ts`, `services/greenfield-worker/src/functions/invoke.ts` | Keep functions reviewed and host-owned. Phase 7D should forbid arbitrary remote function code by default and route AI/automation function calls through a reviewed tool/function registry. |
| Audit events | Partially implemented | `services/greenfield-api/src/domains/audit/repository.ts`, `audit_events` in `services/greenfield-api/src/database/types.ts` | Reuse `AuditRepository`, but add Phase 7D event names and scrub metadata for tokens, prompt content, private content, and provider payloads. |
| Background job queue | Partially implemented | `background_jobs` and `job_failures` in `services/greenfield-api/src/database/types.ts`, `services/greenfield-worker/src/jobs/claim.ts`, `services/greenfield-worker/src/jobs/runner.ts`, `services/greenfield-worker/src/jobs/retry.ts` | Keep lease/retry/dead-letter kernel. Add explicit schemas, idempotency keys, correlation IDs, cancellation, retention, and Developer diagnostics for Phase 7D jobs. |
| Notification delivery | Partially implemented | `services/greenfield-worker/src/notifications/create.ts`, `services/greenfield-worker/src/notifications/social.ts`, `services/greenfield-api/src/domains/notifications/*`, `services/greenfield-api/migrations/013_phase7c_notification_preferences.sql` | Reuse for automation and connector notifications. Add delivery audit and failure-state visibility before external notification channels are added. |
| Product Hub module surface | Partially implemented | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx`, `src/data/repositories/api/ApiModuleRepository.ts`, `src/features/board/screens/BoardScreen.tsx` | Extend Product Hub sections for Connections, AI tools, Automations, Functions, and Modules rather than creating a separate marketplace. |
| Settings foundation | Partially implemented | `src/features/settings/screens/SettingsHomeScreen.tsx`, `src/app/settings/*`, `src/features/atproto/screens/ConnectionsScreen.tsx` | Add Settings -> AI and Settings -> Automations as first-class settings rows. Keep Developer diagnostics gated. |
| Frontend repository/query pattern | Implemented | `src/runtime/createAppServices.ts`, `src/data/repositories/api/*`, `src/features/modules/hooks/useModuleQueries.ts` | Add connection, AI, automation, and runtime repositories/hooks. Do not fetch directly from screens. |
| Composer tool drawer | Partially implemented | `src/components/composer/ComposerToolsDrawer.tsx`, `src/data/repositories/api/ApiToolsRepository.ts`, `/v1/tools` in `services/greenfield-api/src/app/register-routes.ts` | Replace hardcoded sections and tool-specific conditionals with a registry-driven composer tool definition that includes availability, permission, provider, connection, action, and disabled reason. |

## Phase 7D Subsystem Gaps

| Subsystem | Classification | Evidence | Recommendation |
| --- | --- | --- | --- |
| Runtime contracts | Missing | Required package `packages/greenfield-module-engine-contracts/` is absent. Existing contracts are module manifest/UI focused: `packages/greenfield-module-manifest/src/manifest.ts`, `packages/greenfield-module-ui-contracts/src/index.ts`. | Create `@modula/greenfield-module-engine-contracts` with `GreenfieldEngineKind`, provider, requirement, compatibility, lifecycle, event, capability, resource, and session contracts. |
| Runtime provider registry | Missing | No `packages/greenfield-runtime/` package and no API domain for runtime providers. | Create `@modula/greenfield-runtime` with trusted provider registration for `modula.declarative-ui`, `modula.records`, `modula.actions`, `modula.functions`, `modula.connector`, `modula.ai`, and `modula.automation`. |
| Runtime sessions | Missing | Account sessions exist in `services/greenfield-api/src/sessions/service.ts`, but there are no logical runtime session tables or lifecycle APIs. | Add `greenfield_runtime_sessions` and service methods for module, connector, AI, AI-tool, and automation sessions. Persist state only; keep provider handles out of the database. |
| Runtime resolution | Missing | Current `services/greenfield-api/src/modules/runtime-access.ts` resolves only installed module state and granted permissions. | Implement installed module -> release -> engine requirements -> provider candidates -> trust -> status -> compatibility -> capabilities -> account permissions -> configuration -> launch decision. Return stable reason codes, not a single boolean. |
| Built-in runtime providers | Contract only | Phase 7D docs define provider IDs, but code has only direct module services. | Wrap existing module UI, records, actions, and functions as trusted providers while preserving the existing service implementations. |
| Provider failure isolation | Partially implemented | Frontend module host has `src/features/modules/runtime/module-error-boundary.tsx`; worker catches job errors in `services/greenfield-worker/src/jobs/runner.ts`. | Add runtime session failure events, provider quarantine/degraded states, and shell recovery UI tied to runtime sessions. |
| Connector contracts | Contract only | `packages/greenfield-contracts/src/connector.ts` has a small extension manifest type only. | Create `@modula/greenfield-connector-contracts` with provider adapter, definition, capability, connection, state, permission, resource, action, sync, webhook, error, event, schemas, and validation modules. |
| Connector registry | Placeholder | `greenfield_connectors` exists in `services/greenfield-api/migrations/004_greenfield_sovereign_core.sql`; `/v1/connectors` in `services/greenfield-api/src/app/register-routes.ts` returns raw rows. | Replace raw table exposure with a provider registry service and DTOs for `modula.google`, `modula.microsoft`, `modula.github`, `modula.slack`, `modula.notion`, `modula.nextcloud`, `modula.webhook`, and `modula.generic-rest`. |
| Connection persistence | Partially implemented | AT-only rows exist: `atproto_connections`, `atproto_oauth_states`, `atproto_oauth_sessions` in `services/greenfield-api/src/database/types.ts`. Generic `greenfield_connections` tables do not exist. | Add generic connection tables in migration `015_*` or later: providers, connections, credentials, scopes, permissions, sync state, events, webhook endpoints, deliveries, and action runs. |
| Connection lifecycle | Partially implemented | `services/greenfield-api/src/bridges/atproto/service.ts` supports connected, revoked, disconnected-like states for AT. No generic state machine exists. | Implement the canonical state transition validator for available, authorising, connected, refreshing, degraded, expired, revoked, disabled, failed, and disconnected. Invalid transitions must not mutate state. |
| OAuth | Partially implemented | AT state creation/expiry/one-time consumption/account-session binding exists in `services/greenfield-api/src/bridges/atproto/service.ts`. | Generalise OAuth state storage by provider with cryptographic state, PKCE where supported, redirect allow-list, exact callback matching, replay protection, provider binding, account binding from initiation record, CSRF protection, and sanitised errors. |
| OAuth callback authority | Partially implemented | AT callback uses state plus current auth context in `services/greenfield-api/src/app/register-routes.ts`. | Generic OAuth must never accept account IDs from callback query parameters. For provider redirects without browser auth, the one-time initiation record must be the authority. |
| Token encryption | Partially implemented | AES-256-GCM helper exists in `services/greenfield-api/src/security/crypto.ts`; AT encrypted session rows store `encrypted_session` and `encryption_key_version`. | Create a connector credential service using `MODULA_CREDENTIAL_ENCRYPTION_KEY` and key-version metadata. Store access token, refresh token, and auxiliary material in separate encrypted envelopes. |
| Token refresh | Placeholder | `/v1/atproto/connections/:connectionId/refresh` returns existing connection status in `services/greenfield-api/src/app/register-routes.ts`; worker decrypts AT sessions but no generic credential refresh service exists. | Add provider adapter `refreshCredentials`, credential expiry tracking, refresh jobs, and audit events. |
| Provider health | Missing | Greenfield readiness checks database/migrations/seed in `services/greenfield-api/src/domains/system/health.ts`; no connector or AI provider health registry exists. | Add provider health services and classify core, optional, and provider dependencies so optional unconfigured providers do not make the API globally unready. |
| Sync jobs | Partially implemented | Worker supports module sync and AT jobs in `services/greenfield-worker/src/jobs/runner.ts`. | Add connector job types: `connector.credentials.refresh`, `connector.health.check`, `connector.resources.sync`, `connector.webhook.process`, `connector.action.execute`, `connector.connection.cleanup`, and `connector.event.retention`. |
| Webhook processing | Missing | No `/v1/webhooks/connectors/:providerId/:endpointId` route or generic webhook delivery tables found. | Implement signature verification, timestamp validation, replay prevention, body limits, content-type validation, allow-listed event types, dedupe, async processing, retention, secret rotation, and rate limits. |
| Generic REST connectors | Unsafe if built on current function service unchanged | `services/greenfield-api/src/functions/service.ts` can execute `remoteHttp` via `safeFetch`, but Phase 7D forbids arbitrary remote function code and requires reviewed connector actions. | Use the SSRF guard, but do not expose arbitrary URL execution. Require host allow-lists, HTTPS by default, port restrictions, response limits, and reviewed action definitions. |
| AI contracts | Missing | Required package `packages/greenfield-ai-contracts/` is absent. Product screens mention GAIA/AI only as previews: `src/features/product/screens/GaiaConsoleScreen.tsx`, `src/features/product/data/featureAtlas.ts`. | Create `@modula/greenfield-ai-contracts` with provider, model, capability, request/response, message, conversation, tool, usage, policy, safety, error, event, schemas, and validation contracts. |
| AI provider abstraction | Missing | No `services/greenfield-api/src/domains/ai` or trusted AI provider adapters exist. | Add server-side adapters only for configured providers. Keep provider SDK/base URL/API keys out of frontend responses. |
| AI provider registry | Missing | No registry for `modula.ai.openai-compatible`, `modula.ai.anthropic`, `modula.ai.google`, `modula.ai.local-openai-compatible`, or `modula.ai.gaia`. | Implement server-authoritative metadata with states available, not-configured, unavailable, disabled, degraded, rate-limited, quarantined, and failed. Keep Gaia unavailable unless a real trusted Gaia service exists. |
| Model registry | Missing | No AI model catalogue tables or APIs found. | Add `greenfield_ai_providers` and `greenfield_ai_models`; only allow server-approved model IDs. Developer arbitrary model/base URL access must be separately gated. |
| AI conversations | Missing | No `greenfield_ai_conversations`, `greenfield_ai_messages`, or `/v1/ai/conversations` routes found. | Add persistent conversations/messages/runs/tool calls/usage/feedback/events. Store user-visible messages and safe metadata only. Do not store hidden reasoning. |
| AI generation APIs | Missing | No `/v1/ai/generate`, rewrite, summarise, extract, classify, usage, or settings routes found. | Implement non-streaming first unless SSE/chunked streaming can be delivered reliably in this deployment. Persist final assistant messages and usage. |
| AI streaming | Missing | No stream route or provider streaming abstraction exists. | Defer streaming in Phase 7D unless authenticated cancellation, timeout, abort, final persistence, and bounded buffering can be verified. Do not fake streaming. |
| AI tools | Missing | Existing tools are extension/composer tools in `packages/greenfield-contracts/src/tool.ts` and `/v1/tools`; no reviewed AI tool registry exists. | Create reviewed AI tool definitions with input/output schemas, required capability, required connection, account permission, read/write classification, confirmation policy, timeout, rate limit, and audit policy. |
| Tool confirmation policy | Partially implemented | Module UI actions include `confirmationPolicy` in `packages/greenfield-module-ui-contracts/src/index.ts`, and `src/features/modules/runtime/module-view-renderer.tsx` asks for confirmation for module actions. | Map AI tool actions into read-only, reversible write, and external/consequential write. The model must not override confirmation policy. |
| Prompt governance | Missing | No `services/greenfield-api/src/domains/ai/prompts/` registry exists. | Centralise prompts by ID/version/purpose/context/output schema/tool policy/input-output limits/retention policy. Treat connector data as untrusted data, never as instructions. |
| AI context boundaries | Missing | No AI context selector or audit trail exists. | Implement explicit account, feature, conversation, module permission, connection permission, privacy policy, and tool-invocation context selection. Do not auto-inject all notes, messages, files, emails, or calendar data. |
| AI privacy controls | Missing | Settings has Connections and Modules, but no AI settings route: `src/features/settings/screens/SettingsHomeScreen.tsx`, `src/app/settings/*`. | Add Settings -> AI with enablement, default provider/model, history, tool use, connected-service context, module context, retention, export, delete history, and usage. Persist to Greenfield. |
| AI usage metering | Missing | No AI usage tables or quotas. Existing rate-limit code is route-level and not AI-specific. | Track input/output/total tokens only from real provider usage, mark unknown when absent, and add daily/monthly/per-feature/per-model/concurrent/tool-call controls. |
| Quotas and rate limits | Partially implemented | `MODULA_RATE_LIMIT_ENABLED` and Fastify route configs exist in `services/greenfield-api/src/app/register-routes.ts`. | Add account/IP-aware policies for auth, search, media, AI generation, AI tool execution, connector actions, OAuth initiation, webhook ingestion, and automation runs. Return stable retry info. |
| Retention | Partially implemented | Module record retention exists in `greenfield_module_data_retention`; jobs and notifications have partial state. | Define retention for connector credentials/events/webhook bodies, AI conversations/messages/tool calls/usage, automation runs, and audit records. |
| User consent | Partially implemented | Module permission reviews and AT connection settings exist: `greenfield_module_permission_reviews`, `src/features/atproto/screens/ConnectionsScreen.tsx`. | Add explicit connection permissions, AI context permissions, AI tool-use controls, automation action consent, and account data-control screens. |
| Account export | Partially implemented | Account export routes and repository exports exist in `services/greenfield-api/src/repositories/service.ts`, `src/features/settings/screens/AccountExportScreen.tsx`. | Extend export to include connections without secrets, AI conversations/messages/settings/usage, automations/runs, runtime sessions, and safe connector event metadata. Exclude tokens. |
| Account deletion | Missing | No Phase 7D cleanup path for connectors, AI, automations, runtime sessions, and pending jobs found. | Add account deletion cleanup orchestration that disables automations, terminates runtime sessions, revokes connectors where possible, deletes encrypted credentials, cancels pending jobs, removes AI history by policy, and preserves required audit records. |
| Automation contracts | Missing | Required package `packages/greenfield-automation-contracts/` is absent. Product screens are preview-only, for example `src/features/product/screens/AutomationsStudioScreen.tsx`. | Create declarative automation contracts for trigger, condition, action, schedule, run, step, input, output, failure, retry, permission, and connection. |
| Automation APIs | Missing | No `/v1/automations` or `/v1/automation-runs` routes found. | Implement CRUD, enable/disable, manual run, schedule run, run history, and cancellation. Ship only operational manual and schedule triggers initially. |
| Automation lifecycle | Missing | Worker job lifecycle exists, but no automation definitions/runs/steps. | Add automation definition/run/step tables and route every action through runtime, permission, connector, module, or AI service boundaries. |
| Worker scheduling | Partially implemented | `background_jobs.available_at`, `lease_owner`, `lease_expires_at`, and retry utilities exist. | Add schedule trigger materialisation and automation-specific job schema. Keep arbitrary executable triggers forbidden. |
| Retries | Implemented for current jobs | `services/greenfield-worker/src/jobs/retry.ts`, `services/greenfield-worker/src/jobs/runner.ts`. | Reuse bounded retry/dead-letter behavior for connector and automation jobs, but add per-job timeout/cancellation/correlation and typed failure reasons. |
| Dead-letter handling | Implemented for current jobs | `services/greenfield-worker/src/jobs/claim.ts`, `services/greenfield-worker/tests/retry.test.ts`, `services/greenfield-worker/tests/lease.test.ts`. | Add Developer diagnostics APIs and UI for dead letters instead of exposing internals to normal users. |
| Observability | Partially implemented | Worker metrics/logging exist in `services/greenfield-worker/src/observability/*`; API logger redaction exists. | Add `/v1/developer/*` diagnostics for runtime providers/sessions, connectors, AI, automations, jobs, and health. Gate server-side, not only by hidden navigation. |
| Developer gating | Partially implemented | Frontend gate exists in `src/lib/platform.ts` and `src/features/settings/screens/SettingsHomeScreen.tsx`; admin APIs use capabilities in `services/greenfield-api/src/app/register-routes.ts`. | Add server-side developer authorisation for all Phase 7D developer diagnostics. Do not rely on frontend visibility alone. |
| Product Hub integration | Partially implemented | Current Product Hub is module-centric: `src/features/modules/screens/ProductHubMarketplaceScreen.tsx`, `src/features/product/screens/ProductHubScreen.tsx`. | Add Product Hub sections for Connections, AI tools, Automations, Functions, and Modules. Detail pages must include trust, capabilities, data requested, write permissions, configured status, privacy, and action state. |
| Settings -> Connections | Partially implemented | `src/features/atproto/screens/ConnectionsScreen.tsx` lists AT Protocol and future rows for GitHub, Drive, Nextcloud. | Replace future rows with server-backed connector catalogue states: Available, Connected, Needs attention, Not configured, Coming later. Add permission, health, sync, reconnect, enable/disable, disconnect, and data-access summaries. |
| Settings -> AI | Missing | No `src/app/settings/ai.tsx` or AI settings screen exists. | Add screen and API-backed repository for settings/usage/history controls. Show honest "AI is not configured on this Modula environment" when no provider is healthy. |
| Settings -> Automations | Missing | No `src/app/settings/automations.tsx` or automation management screen exists. | Add automation list, enable state, trigger, last/next run, connection requirements, failure state, run now, edit, delete, and history. |
| Composer AI tools | Placeholder | `src/components/composer/ComposerToolsDrawer.tsx` marks AI rewrite unavailable by string matching; local API seeds AI Assist preview in `src/api/local/routes/authRoutes.ts`. | Add real registry-backed AI composer actions that return suggestions to editable state. Never auto-publish. Preserve original draft. |
| Feed AI capabilities | Missing | Feed actions are social actions only: `src/features/feed/postActions/*`, `src/features/feed/FeedPostRow.tsx`. | Add controlled per-post AI actions only on request: summarise, explain, extract key points, alt text. Do not auto-analyse feed. |
| Profile AI assistance | Missing | Profile editor and profile repository exist, but no AI suggestion path: `src/features/profile/screens/EditProfileScreen.tsx`, `src/features/profile/data-query/useUpdateProfileMutation.ts`. | Add suggestion-only profile AI actions for bio, summary, and link description. Require explicit user apply. |
| Vault Notes AI | Missing | Vault Notes is the first module through module runtime, but no AI capabilities are declared or routed in host code. | If Vault Notes needs AI capabilities, publish a new immutable release with optional AI permissions and implement first-party functions that operate on current note only unless broader context is explicitly selected. |
| Data inventory | Missing | `docs/privacy/` does not exist yet. | Create `docs/privacy/phase7d-data-inventory.md` during Phase 7D implementation and keep it in sync with migrations/APIs. |
| API inventory | Missing | No `docs/audits/phase7d-api-inventory.md`. | Generate and maintain route inventory with method, path, auth, account scoping, permissions, schemas, pagination, rate limit, audit, frontend consumer, tests, and status. |
| Phase 7D verifiers | Missing | `scripts/verify-phase7d-*.mjs` do not exist. | Add the required verifier scripts after implementation boundaries exist. Keep previous Phase 7C verifiers passing. |

## Conflicts And Obsolete Surfaces

| Item | Classification | Evidence | Recommendation |
| --- | --- | --- | --- |
| `/v1/connectors` raw table response | Conflicting | `services/greenfield-api/src/app/register-routes.ts` returns `greenfield_connectors` rows directly. | Replace or wrap with a stable connector DTO. Do not expose internal manifest/config fields once real credentials and provider configuration exist. |
| AT Protocol as special connection island | Partially implemented | `services/greenfield-api/src/bridges/atproto/service.ts`, `src/features/atproto/*`, `services/greenfield-worker/src/bridges/atproto/*`. | Keep AT optional, but use it as a migration/reference case for generic connection lifecycle, encrypted credentials, and connection settings. |
| Composer tool string matching | Obsolete | `src/components/composer/ComposerToolsDrawer.tsx` infers AI/NFT/photo/camera behavior from `toolId` substrings. | Move behavior into tool registry metadata with explicit actions and disabled reasons. |
| Product preview AI/Gaia screens | Placeholder | `src/features/product/screens/GaiaConsoleScreen.tsx`, `src/features/product/data/featureAtlas.ts`, `src/features/product/data/intelligenceLayers.ts`. | Keep preview disclosures honest until server-backed AI providers, conversations, tools, usage, and settings exist. Do not wire fake AI responses. |
| Function `remoteHttp` path | Unsafe if exposed broadly | `services/greenfield-api/src/functions/service.ts` supports manifest-configured remote HTTP functions. | Restrict remote HTTP to reviewed trusted functions with SSRF policy, allow-listing, idempotency, audit, and no arbitrary module-supplied provider code. |
| Developer access hidden only in UI | Unsafe if copied to new diagnostics | `src/lib/platform.ts` and Settings developer rows hide UI, while some admin routes use capability checks. | All Phase 7D diagnostics must be protected server-side. UI gating is only presentation. |

## Migration Conventions

The next migration number after current main is `015`. Existing migrations live in `services/greenfield-api/migrations/` and use paired `.sql`/`.down.sql` files. Generated database type mirrors are currently maintained in:

- `services/greenfield-api/src/database/types.ts`
- `services/greenfield-worker/src/database.ts`

Phase 7D persistence should continue this convention and avoid ad hoc table access without typed updates.

## Recommended First Implementation Order

1. Add contracts-only packages: module engine, connector, AI, and automation contracts.
2. Add `@modula/greenfield-runtime` with provider registry, lifecycle state machine, compatibility resolution, and in-memory tests.
3. Add migration `015_phase7d_runtime_connectors_ai_automation.sql` only after contracts and table design are settled.
4. Generalise credential encryption from AT-specific helpers into a Phase 7D credential service.
5. Implement connector provider metadata and unconfigured honest states before OAuth actions.
6. Implement AI provider/model registry and settings before any generation endpoint.
7. Extend worker job schemas and diagnostics before adding sync/webhook/automation job types.
8. Add frontend repositories/hooks, then Settings/Product Hub/Composer surfaces.
9. Add verifiers as each boundary becomes operational.
10. Deploy only after backup, migrations, API/worker/web validation, and live acceptance evidence are recorded.

## Explicit Non-Implementation In This Audit

This audit did not implement runtime packages, connector providers, AI providers, automations, migrations, frontend screens, deployment changes, or verifiers. It records the gap between the accepted Phase 7C baseline and the Phase 7D mission so implementation can proceed without creating parallel systems or weakening existing security boundaries.
