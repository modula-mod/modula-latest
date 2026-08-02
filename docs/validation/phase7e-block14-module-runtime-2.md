# Phase 7E Block 14 Module Runtime 2

Status: complete in repository and isolated runtime verification

Date: 2026-08-02
Production database migration: not performed
Production Greenfield deployment: not performed

## Implementation

Runtime 2 state is implemented in the Greenfield API and worker with disposable
database verification only.

Primary files:

- `services/greenfield-api/migrations/027_phase7e_module_runtime_2.sql`
- `services/greenfield-api/migrations/027_phase7e_module_runtime_2.down.sql`
- `services/greenfield-api/src/modules/runtime2-service.ts`
- `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- `services/greenfield-worker/src/modules/installation-handler.ts`
- `services/greenfield-worker/src/modules/enable-handler.ts`
- `services/greenfield-worker/src/modules/disable-handler.ts`
- `services/greenfield-worker/src/modules/uninstall-handler.ts`
- `services/greenfield-api/src/modules/routes/index.ts`
- `src/features/modules/screens/ModuleManagementScreen.tsx`

New API routes:

- `GET /v1/modules/:moduleId/runtime`
- `POST /v1/modules/:moduleId/services/:serviceId/invoke`

## Runtime Capabilities

Implemented and verified:

- dependency relations and version-range planning
- required, optional, recommended, conflicts, replaces and provides relations
- cycle detection
- conflict detection
- optional dependency degradation
- recommended dependency disclosure
- atomic dependency plan acceptance
- provider contracts and capability registry
- capability health state
- service registry and service discovery
- Greenfield service gateway invocation path
- policy and permission evaluation before invocation
- input and output validation
- idempotency
- timeout, rate-limit and invocation depth controls
- audit and event records
- hook registry with before/after ordering
- lifecycle transactions for install, enable, disable, update, uninstall, repair,
  quarantine and unquarantine states
- rollback and data retention decisions
- Permissions 2.0 states
- account-scoped and installation-scoped storage allocations
- encrypted installation-scoped secret storage with redacted descriptors
- jobs that pause when a module is disabled
- generic UI contributions for board, profile tabs, settings, composer tools,
  context menus, search providers, module routes and widgets
- Standard 1.x compatibility normalization for Vault Notes 1.1
- Standard 2 native execution for the reference module

The required service path is enforced:

```text
calling module
-> Greenfield service gateway
-> policy evaluation
-> permission evaluation
-> provider health
-> schema validation
-> provider invocation
-> response validation
-> caller
```

No direct module-to-module import path is used.

## Reference Module

Separate repository:

- `/home/andrei/modula-mod/modula-standard2-reference-module`
- main commit: `9ae68e4bf0307a693b61d98c6a5fdcebd07dc6c2`
- manifest checksum: `7c22672b37d984a280d66920822306ac55a97ec350edb6b1ff5e000636adf21a`

The module provides a real markdown text-analysis function and exercises
dependencies, capabilities, service invocation, API registration, hooks, jobs,
storage, route contribution, settings contribution, board widget contribution
and events.

## Verification

Passed commands:

| Command | Result |
| --- | --- |
| `pnpm verify:phase7e-module-dependency-runtime` | passed |
| `pnpm verify:phase7e-module-capability-registry` | passed |
| `pnpm verify:phase7e-module-service-fabric` | passed |
| `pnpm verify:phase7e-module-hooks` | passed |
| `pnpm verify:phase7e-module-lifecycle` | passed |
| `pnpm verify:phase7e-module-permissions-v2` | passed |
| `pnpm verify:phase7e-module-storage-runtime` | passed |
| `pnpm verify:phase7e-module-jobs-runtime` | passed |
| `pnpm verify:phase7e-module-ui-contributions` | passed |
| `pnpm verify:phase7e-module-runtime-security` | passed |
| `pnpm verify:phase7e-module-runtime-2` | passed |
| `pnpm --filter @modula/greenfield-api build` | passed |
| `pnpm --filter @modula/greenfield-worker build` | passed |

`pnpm verify:phase7e-module-runtime-2` proves:

- Standard 2 release verified
- manifest normalized
- dependency plan generated
- required capability resolved
- conflict rejected
- reference module installed
- service/API/hooks/storage/job/route/widget registered
- module enabled
- service invoked
- input and result validation enforced
- disabled module blocks invocation and pauses jobs
- re-enable works
- uninstall removes registrations
- Standard 1.2 Vault Notes remains compatible
- no-product-mocks verifier remains green
- web production cutover verifier passes

## Production Scope

No migration was applied to the production Greenfield database in Block 14.
No production Greenfield service deployment was performed in Block 14.

## Native Status

Phase 7F Mac/iOS acceptance has not been executed.
No native iOS acceptance result is claimed.
