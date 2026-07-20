# Phase 7A Extension Foundation Audit

## Scope
- Repository: modula-mod/modula-latest
- Branch: phase7a-greenfield-module-platform
- Audited baseline: c127d0cbf16072cc96db6850d8fab9d06c92d18d
- Frontend/native baseline: .phase7a-baseline/start-commit.txt

This audit starts Phase 7A without modifying the captured frontend/native
baseline paths (`src`, `ios`, `android`, `assets`).

## Existing Foundation

### Architecture and Standards
- `docs/architecture/adr/ADR-008-greenfield-extension-kernel.md` defines the Greenfield extension kinds, trust levels, execution modes, lifecycle, capability rules, and the no-arbitrary-code boundary.
- `docs/architecture/module-standards.md` defines the external module standard and keeps Vault Notes, Tasks, CRM, and similar modules out of the host tree.
- `docs/architecture/modula-module-sdk.md` documents the planned SDK boundary and states that the SDK is not published yet.
- `docs/architecture/module-boundary.md` and `src/modules/README.md` preserve the host/module split and require the host to launch with zero optional modules.
- `templates/modula-module/` contains the current boilerplate manifest and `skill.md` digital-DNA template.

### Shared Contracts
- `packages/greenfield-contracts/src/extension.ts` defines `GreenfieldExtensionManifest`, extension kinds, trust, execution modes, and entrypoints.
- `packages/greenfield-contracts/src/module.ts` defines `GreenfieldModuleManifest` with routes, profile tabs, board surfaces, settings, functions, tools, widgets, schemas, capabilities, permissions, compatibility, and uninstall behaviour.
- `packages/greenfield-contracts/src/extension-catalogue.ts`, `extension-installation.ts`, `extension-lifecycle.ts`, `function.ts`, `tool.ts`, and `capability.ts` cover catalogue items, installation status, lifecycle records, functions, tools, and capability grants.
- `packages/greenfield-schema-registry/src/index.ts` includes `modula.modules.manifest`, but only as a lightweight record shape with required `name` and `version`.
- `packages/atproto-lexicons/lexicons/digital/modula/temp/moduleManifest.json` is explicitly temporary and public-only.

### Backend API and Persistence
- `services/greenfield-api/migrations/004_greenfield_sovereign_core.sql` creates core extension tables: `greenfield_extensions`, `greenfield_extension_versions`, `greenfield_extension_installations`, `greenfield_extension_capabilities`, `greenfield_functions`, `greenfield_tools`, `greenfield_plugins`, `greenfield_connectors`, `greenfield_widgets`, and `greenfield_bridges`.
- `services/greenfield-api/migrations/006_phase6s_social_product.sql` adds `greenfield_extension_catalogue`, lifecycle events, failure records, and function jobs, with seeded first-party catalogue items and unavailable/inactive module placeholders.
- `services/greenfield-api/src/extensions/lifecycle-service.ts` implements catalogue-aware install/enable/disable/configure/uninstall and records lifecycle events plus outbox/audit entries.
- `services/greenfield-api/src/extensions/installation-service.ts` implements lower-level install/uninstall/preferences against extension versions and grants optional capabilities.
- `services/greenfield-api/src/extensions/trust-policy.ts` blocks untrusted execution and rejects obvious arbitrary-code entrypoint targets.
- `services/greenfield-api/src/extensions/capability-resolver.ts` checks granted installation capabilities.
- `services/greenfield-api/src/app/register-routes.ts` exposes `/v1/extensions`, `/v1/extensions/catalogue`, `/v1/extensions/installed`, install/uninstall/preferences, `/v1/tools`, `/v1/functions`, `/v1/plugins`, `/v1/connectors`, `/v1/widgets`, and `/v1/modules`.
- `services/greenfield-api/src/app/register-phase6s-routes.ts` adds Phase 6S enable/disable/configuration and function-job routes.

### Worker and Execution
- `services/greenfield-worker/src/extensions/plugin-lifecycle.ts` isolates plugin lifecycle failures, records extension failures, and prevents plugin errors from crashing host readiness.
- `services/greenfield-worker/src/extensions/function-runner.ts` is declarative and does not eval module code.
- `services/greenfield-worker/src/extensions/remote-function-runner.ts` uses a guarded fetch path for remote functions.
- `services/greenfield-api/src/functions/job-service.ts` allows deterministic first-party jobs and rejects untrusted function IDs.
- `services/greenfield-api/src/functions/service.ts` gates remote invocation on the `function:invoke` installation capability.

### Frontend Surfaces
- `src/data/repositories/api/ApiExtensionRepository.ts` wires Extension Centre data to `/v1/extensions/catalogue`, `/v1/extensions`, `/v1/extensions/installed`, install, enable, disable, and uninstall.
- `src/features/settings/screens/ExtensionCentreScreen.tsx` presents installed, available, tools, functions, plugins, connections, modules, and developer shelves inside themed settings surfaces.
- `src/features/settings/screens/ExtensionDetailScreen.tsx` exposes basic lifecycle actions and displays publisher, version, type, status, compatibility, and permissions.
- `src/features/modules/screens/ModulesLibraryScreen.tsx` and `src/features/marketplace/screens/ModuleDetailScreen.tsx` present module catalogue and marketplace pre-screens as preview-only.
- `src/components/composer/ComposerToolsDrawer.tsx` loads composer tools from the Greenfield registry with fallback.

### Verification Coverage
- `services/greenfield-api/tests/phase6s.social.test.ts` covers catalogue listing and first-party function jobs.
- `scripts/verify-phase6-greenfield-backend.mjs`, `scripts/verify-phase6-greenfield-frontend.mjs`, `scripts/verify-phase6s-social-backend.mjs`, and `scripts/verify-phase6s-social-frontend.mjs` verify that the existing extension surfaces remain present.

## Gaps Before Phase 7A Implementation

1. The current manifest validator in `services/greenfield-api/src/extensions/manifest-validator.ts` uses a small legacy shape and does not validate `GreenfieldModuleManifest`.
2. Extension versions persist `manifest` and `status`, but there is no immutable module release model with source commit, release archive, package hash, signature, provenance, licence evidence, SBOM, review verdict, or yanking state.
3. The catalogue table and extension-version tables are parallel structures. Install routes use both `InstallationService` and `ExtensionLifecycleService`, so Phase 7A should consolidate policy through one lifecycle path.
4. Capability grants are not automatically derived from manifest permissions/capabilities and there is no explicit user/admin capability-review record.
5. Function invocation has two paths: an older installation-capability route and a Phase 6S account/job route. Required capability checks and execution policy should be unified.
6. Module contribution resolution is not implemented for dynamic route, profile tab, board, settings, widget, or search surfaces. Profile tab registration is still core/local.
7. Frontend repository decoding drops trust, executable, catalogue status, manifest, failure, lifecycle, provenance, and licence fields.
8. Extension detail UI does not yet show evidence, policy mode, confidence/verdict, failure history, release provenance, licence, or capability-review state.
9. Vault Notes exists as seed/demo/marketplace intent only. There is no external reference package release with immutable manifest, licence evidence, provenance, and lifecycle validation.
10. Tests cover presence and basic denial paths, but not immutable releases, provenance/licence validation, lifecycle idempotency, capability grants/revocation, yanked releases, or Vault Notes reference-package acceptance.

## Phase 7A Implementation Order

1. Extend shared contracts for Greenfield Module Standard v1: manifest validation, immutable release identity, source provenance, licence evidence, capability review, lifecycle status, AKI verdict, and failure modes.
2. Add backend persistence and services for module registry releases, provenance/licence evidence, capability grants, lifecycle/audit records, yanked releases, and GitHub-backed source references.
3. Consolidate extension install/enable/disable/configure/uninstall through the catalogue-aware lifecycle service and make capability grants explicit and auditable.
4. Add registry APIs using the existing `/v1` Greenfield route style, preserving external module code boundaries and rejecting arbitrary code execution.
5. Add an external Vault Notes reference package artifact outside the host implementation tree, with manifest, `skill.md`, licence evidence, provenance, and verifier coverage.
6. Update verifiers and tests for the registry, lifecycle, provenance, licence, capability review, Vault Notes reference package, and no-host-module-code guarantees.

## Baseline Constraint

The captured frontend/native baseline was written after integration. Phase 7A
module-platform implementation should not change `src`, `ios`, `android`, or
`assets` unless the baseline constraint is explicitly revised.
