# PVP Platform Phase 2 existing module runtime audit

Recorded: 2026-08-24  
Product baseline: `ba2a5fab94864b30f2f61b2bef1b62436e08b463`  
Module Standard baseline: `2bfc0a826d19db870a445e06d52010cec6e0a54f` (`mms-v2.0.0`)  
Vault Notes baseline: `b439d89be7466c338310c9c31283ccec4e898786`  
Production mutation: **NO**

## Decision

PVP Platform Phase 2 will evolve the existing Module Standard 2, Greenfield
registry, installation runtime, capability registry, service gateway, event
outbox, worker, and declarative Module Host. It will not add an
`@modula/extensions-v2` package or a second installation/authentication
universe.

The repository already contains more of the required foundation than its older
module-only naming suggests. The missing work is a coherent product taxonomy,
target/extension graph, typed extension points, authoritative lifecycle
projection, scoped invocation, extension-owned jobs/events/data, and generic
host composition.

## Source inventory and disposition

| Existing component | Evidence | Decision | Phase 2 action |
| --- | --- | --- | --- |
| Module Standard 2.0 contracts | `/root/modula-mod/modula-module-standard/packages/module-standard/src/standard-2.ts` | `EXTEND` | Add optional product kind, target contracts, extension points, contribution contracts, retention, and bounded graph policy. Preserve Standard 1.x/2.0 compatibility. |
| Module Standard validator | `/root/modula-mod/modula-module-standard/packages/module-validator/src/index.ts` | `EXTEND` | Validate kinds, targets, extension-point ownership, declarative contributions, typed capabilities, target ranges, and prohibited executable/remote fields. |
| Module Standard SDK/testing | `/root/modula-mod/modula-module-standard/packages/module-sdk`, `packages/module-testing` | `EXTEND` | Add builders/fixtures for module, add-on, plugin, function, tool, widget, connector, and service products. |
| Greenfield module manifest package | `packages/greenfield-module-manifest` | `EXTEND` | Consume the released Standard extension-product contract; retain the accepted V1/V2 envelope and checksum logic. |
| Old Greenfield extension taxonomy | `packages/greenfield-contracts/src/extension.ts` | `REFACTOR` | Add `addon` and `service`, remove no data, retain `bridge` as a legacy/internal compatibility kind. |
| Old extension lifecycle types | `packages/greenfield-contracts/src/extension-installation.ts`, `extension-lifecycle.ts` | `REFACTOR` | Map old values onto one authoritative lifecycle projection and add resolving/enabling/disabling/updating/uninstalling/quarantined states. |
| Immutable registry and provenance | `greenfield_module_versions`, `greenfield_module_releases`, `greenfield_module_sources`, `greenfield_module_release_integrity`, `greenfield_module_release_signatures` in migration 009 | `KEEP` | Continue exact commit/tag/checksum/signature verification. Product kind and target relationships attach to releases; no mutable-main installs. |
| Quarantine/revocation | `GreenfieldModuleQuarantineService`, migration 009 quarantine/revocation tables | `KEEP` | Reuse for checksum/signature/policy failures and ensure quarantined products cannot register contributions. |
| Publisher/namespace policy | `GreenfieldModulePublisherService`, migration 009 publisher tables | `KEEP` | Reuse for registry policy and trusted service origin decisions. |
| Extension installation row | `greenfield_extension_installations` in migration 004 | `EXTEND` | Retain as the canonical per-account install identity. Add a projected lifecycle state instead of replacing the table. |
| Install plan and permission review | `GreenfieldModuleInstallationService`, `greenfield_module_install_plans`, `greenfield_module_permission_reviews` | `EXTEND` | Include recursive dependency plan, parent/target review, capability grants, install graph persistence, and permission deltas. |
| Dependency declarations | legacy `dependencies` plus Standard 2 `dependencyGraph` | `EXTEND` | Treat targets as required typed graph edges, support dependency closure, deterministic ordering, depth/node bounds, and explicit `DEPENDENCY_CYCLE`. |
| Dependency resolver | `services/greenfield-api/src/modules/dependency-resolver.ts` | `EXTEND` | Preserve semver/provider resolution and active dependant lookup; add a release-aware directed graph, deterministic traversal, platform checks, update impact, and cascade preview. |
| Resolved dependency persistence | `greenfield_module_resolved_dependencies` in migration 027 | `EXTEND` | Reuse for all product kinds and add target/edge identity where required. Do not introduce a parallel graph store. |
| Permission model 2 | `greenfield_module_permission_states`, `GreenfieldModuleRuntime2Service` | `EXTEND` | Store typed product capabilities and resource scopes separately from UI placement. Require renewed approval for new grants. |
| Capability registry | `greenfield_module_capability_registry` | `EXTEND` | Register module-owned capabilities and broker grants from consuming extension to target provider. |
| Runtime service registry | `greenfield_module_service_registrations`, `GreenfieldModuleRuntime2Service.invokeService` | `EXTEND` | Preserve policy, schema, rate, idempotency, audit, and depth checks; add target resource scope, short-lived assertion identity, timeout/retry/circuit state, and external service binding policy. |
| Module backend token exchange | `services/greenfield-api/src/modules/backend/token-service.ts` | `EXTEND` | Reuse Greenfield signing/session storage. Add consumer, target, action, scope, `jti`, correlation, and shorter invocation TTL. Never forward the Greenfield session bearer. |
| Backend network policy | `modules/backend/network-policy.ts`, discovery/trust services | `KEEP` | Reuse TLS, DNS, private-network, redirect, host, origin, and SSRF controls. Extensions may reference only registered service bindings. |
| Backend gateway/circuit state | `modules/backend/gateway-service.ts`, `module_backend_health`, `module_backend_failures` | `EXTEND` | Preserve isolated failures and current open-circuit behavior; add bounded retry/backoff and contribution-safe unavailable results. |
| Generic module APIs | `/v1/modules/...` routes in `services/greenfield-api/src/modules/routes/index.ts` | `EXTEND` | Keep API conventions, authenticated account scope, envelope/error conventions, and canonical-ID normalization. Add product/graph/contribution/function/job endpoints modularly. |
| Existing generic actions | `GreenfieldModuleActionService`, `greenfield_module_actions` | `EXTEND` | Route extension contributions to declared functions through the capability broker; never grant data access from UI placement alone. |
| Generic record service | `GreenfieldModuleRecordService`, `greenfield_module_records` | `KEEP` | Preserve account isolation and module-owned records. Add namespaced extension annotations as a separate mechanism, not columns on Vault Notes core tables. |
| Module contributions V1 | `greenfield_module_contributions`, `GreenfieldModuleContributionService` | `EXTEND` | Preserve legacy routes/settings/tools/functions/widgets/plugins/connectors/jobs/events and add typed extension-point contributions with target/availability/capability/platform conditions. |
| Standard 2 UI registrations | `greenfield_module_ui_contribution_registrations` | `EXTEND` | Add the accepted Phase 2 contribution kinds and target extension point. Resolve only enabled, granted, compatible contributions. |
| Module Host | `src/features/modules/runtime/module-host.tsx` | `EXTEND` | Compose core declarative views plus resolved contributions. Keep the existing top-level error boundary and add per-extension boundaries. No Vault-specific conditions. |
| Declarative renderer | `module-view-renderer.tsx`, `@modula/greenfield-module-ui-contracts` | `EXTEND` | Add approved action/menu/toolbar/section/widget descriptors. Continue rejecting arbitrary JSX, HTML, WebViews, eval, and remote JavaScript. |
| Module management screen | `src/features/modules/screens/ModuleManagementScreen.tsx` | `EXTEND` | Show child extensions, grants, service health, target/dependency/provenance, failure code, and developer-only inspection without redesigning Product Hub. |
| Product Hub registry projection | `GreenfieldModuleRegistryService`, `GreenfieldModuleMarketplaceService`, Product Hub screens | `EXTEND` | Project product kind and target relations so add-ons/plugins are discovered from registry data. Preserve the PVP-UI-1R composition. |
| Composer tool discovery | `ApiToolsRepository` and `/v1/modules/contributions` | `EXTEND` | It already merges registered contributions with core tools; migrate remaining Vault-specific/core arrays to typed runtime tool registrations. |
| Transactional outbox | `services/greenfield-api/src/domains/outbox/repository.ts` | `KEEP` | Reuse atomic `outbox_events` plus `background_jobs`; add versioned extension lifecycle/event/job messages. |
| Event schemas and delivery | migrations 018/019, API/worker event domains | `EXTEND` | Register module-owned event schemas/subscriptions, at-least-once delivery, idempotency, retry, dead-letter, and redacted audit metadata. |
| Job declarations | `greenfield_module_job_registrations` | `EXTEND` | Retain declarations; add account-scoped invocation rows with queued/running/succeeded/failed/retrying/cancelled projection and safe operational metadata. |
| Audit repository/policy engine | `domains/audit/repository.ts`, `domains/policy/engine.ts` | `KEEP` | Reuse append-only audit and policy evaluation; add the required extension lifecycle/security event names without payload contents. |
| AI provider runtime | migrations 024-026 and `src/ai` services | `REFACTOR` | Reuse provider-neutral execution, prompt/result schema, streaming, usage, and honest provider-unavailable state. Move Vault actions out of Vault Notes into the Vault AI add-on. |
| Vault Notes optional AI manifest declarations | `/root/modula-mod/modula-vault-notes/modula.module.json` and `module.manifest.json` | `REMOVE` | Remove only in a new real Vault Notes release after Vault AI owns the actions. Core notes remain independently installable/offline-capable. |
| Legacy top-level tool/function/plugin/widget tables | migration 004 `greenfield_tools`, `greenfield_functions`, `greenfield_plugins`, `greenfield_widgets` | `REFACTOR` | Keep for backward compatibility and project new registry products into them where existing consumers require it. Do not make them a second source of truth. |
| Hardcoded built-in tools | migration 004 seed rows and client core tool list | `REFACTOR` | Preserve core device actions; resolve installable extension tools from registry/runtime. Remove product-specific hard-coding as typed contributions replace it. |

## Current accepted runtime facts

- Standard 1.0, 1.1, 1.2, and 2.0 manifests are intentionally supported.
- Standard 2 already declares dependency, capability, service, API, hook, job,
  storage, widget, navigation, UI, automation, offline, realtime,
  compatibility, marketplace, and engine sections.
- Greenfield already rejects wildcard permissions, provider-bound AI fields,
  arbitrary executable/HTML/render fields, unsafe backend origins, malformed
  checksums, and unsupported Standard sections.
- The dependency resolver already rejects direct and transitive cycles visible
  through published release dependencies, but it does not yet return a stable
  cycle path or enforce explicit graph bounds.
- The service runtime already checks caller/provider enabled state, account
  identity, schema boundaries, policy, permissions, rate limits, invocation
  depth, idempotency, and audit events.
- The backend gateway already exchanges the user session context for a
  Greenfield-signed short-lived module token. The original user bearer is not
  passed to the module backend.
- The current Host is generic and contains no Vault Notes special case. Its UI
  is core-view only; it does not yet merge target-scoped extension-point
  contributions into a module view.
- Existing job registrations are declarations, not the full account-scoped
  execution lifecycle required by Phase 2.
- Existing event delivery is suitable infrastructure and should be extended;
  Kafka, NATS, and another broker are not justified for this phase.

## Gaps that require implementation

1. Canonical registry product kind lacks `addon` and `service` and has no target
   relationship.
2. A product cannot yet declare owned extension points or contribute against a
   target point with typed conditions.
3. The dependency resolver has no stable whole-install graph result, graph
   bounds, update-impact preview, or cascade uninstall plan.
4. Installation status remains an older lower-camel state set and is not a
   complete authoritative lifecycle projection.
5. Capability grants are installation-wide strings and are not yet resource-
   scoped invocation grants between consumer and target.
6. Service assertions do not yet include consumer, target, action, resource
   scope, or `jti` claims.
7. Standard 2 UI registrations do not yet cover all required Phase 2 kinds or
   target extension points.
8. Host composition does not fetch/merge/boundary-wrap target contributions.
9. Job registration lacks execution rows and safe state/failure projection.
10. Product Hub and Settings do not yet expose target/add-on relationships and
    dependent lifecycle review.
11. Vault Notes still declares optional Vault AI actions inside its own source;
    those must move to the separate Vault AI repository.
12. Vault AI, Vault Voice, and the formatting reference plugin do not yet exist
    as independently released registry products.

## Architecture guardrails

- Evolve the released Module Standard and current Greenfield packages; no
  parallel extension contract package.
- Keep `greenfield_extension_installations` as the install identity and
  `greenfield_module_releases` as immutable release evidence.
- Treat UI contribution permission and data capability permission as separate
  decisions.
- Route all cross-product data access through a target-owned service contract.
- Keep account identity in every graph, grant, invocation, job, metadata, and
  event query.
- Bound graph depth and node count, sort deterministic outputs, and report the
  explicit cycle path.
- Store only hashes, IDs, timing, state, and safe failure codes in operational
  and audit records; never note text, transcripts, recordings, prompts, raw
  tokens, or provider secrets.
- Keep optional extension failure outside the core module error boundary.
- Do not deploy or migrate production as part of this implementation.
