# ADR-008 — Greenfield extension kernel

## Status

Accepted (Phase 6R)

## Context

Modula is a modular product: the host owns startup and shell; modules live in separate repositories; plugins, tools, and functions need a shared trust and capability model. Phase 6R introduces **Greenfield Extensions** as the authoritative extension vocabulary so AT Protocol connectors, future economic engines, and first-party modules share one install/runtime contract.

## Decision

Greenfield distinguishes these extension kinds:

| Kind | Role |
| --- | --- |
| **Module** | Separately distributed application capability (e.g. Vault Notes, Tasks, CRM, future Gaia Atlas). May contribute routes, profile tabs, Board surfaces, settings, schemas, functions, tools, widgets, permissions. Implementations stay out of the main repo. |
| **Plugin** | Trusted extension to Greenfield or the Modula host (auth provider, moderation, indexing, notifications, media, economic engine). May register lifecycle hooks. |
| **Function** | Callable backend operation with typed input/output; sync, background job, or remote HTTP. |
| **Tool** | User-facing action invoking a function or route (Composer, menus, profile, Board, search, module, global command). |
| **Connector** | Integration with an external system (AT Protocol, ActivityPub, GitHub, Drive, etc.). |
| **Widget** | Visual component in a permitted UI slot. |
| **Bridge** | Specialised connector for external social/protocol federation; optional and revocable. |

All kinds share a common manifest shape (`GreenfieldExtensionManifest` in `@modula/greenfield-contracts`) with capabilities, compatibility bounds, and entrypoints. Arbitrary JavaScript source is **not** permitted inside manifests. Arbitrary marketplace code is **not** executed automatically.

## Trust levels

| Level | Typical kinds | Install posture |
| --- | --- | --- |
| **First-party** | Core plugins, DIMON (future), Modula-shipped modules | Signed/publisher-allowlisted; enabled by product policy |
| **Partner** | Approved connectors/bridges | Explicit admin or user install; capability review |
| **Community / marketplace** | Third-party modules/tools | Capability least-privilege; no automatic code execution; host isolation |

## Installation rules

- Installations are recorded with version, publisher, requested capabilities, and grant state.
- Host must remain launchable with zero modules (existing module-boundary rule).
- Connectors/bridges require explicit user or operator enablement.
- Unknown schemas or extension kinds are rejected by default.

## Capability requirements

- Every extension declares `capabilities: string[]` (and functions/tools declare `requiredCapabilities`).
- Runtime enforces grants before record mutation, function invoke, or bridge publish.
- Capability namespaces are stable strings (e.g. future `dimon:*`); no silent escalation.

## Execution modes

Functions support:

- `synchronous`
- `backgroundJob`
- `remoteHttp`

Timeouts and idempotency flags are mandatory on function manifests. Tools never embed executable source; they reference `functionId` and/or `route`.

## Lifecycle

1. **Discover** — manifest + compatibility check  
2. **Install** — persist installation; grant capabilities  
3. **Activate** — register entrypoints (routes, hooks, widgets, tools)  
4. **Update** — version bump with migration metadata where declared  
5. **Deactivate / remove** — unregister entrypoints; retain audit trail  
6. **Failure** — isolate; do not crash host or corrupt repositories  

## Versioning

- Manifest `version` (semver string) + `manifestVersion` (integer contract).
- `compatibility.minimumGreenfieldVersion` required; optional maximum.
- Module packages additionally carry repository URL, package version, host compatibility, and migration metadata.

## Removal

- Uninstall behaviour is declared on module manifests (data retain vs purge policy).
- Bridge/connector removal revokes tokens and stops jobs; Modula records remain.
- Capability grants are revoked on removal.

## Failure isolation

- Module/plugin failures must not gate first frame or crash the shell.
- Bridge job failures use existing outbox / retry / dead-letter patterns; never roll back committed Greenfield records.
- Function failures return typed errors; background failures emit audit events.

## Audit requirements

- Install, update, grant, revoke, invoke (sensitive), and bridge publish attempts are auditable.
- Public logs must not include private record bodies or secrets.

## Consequences

- PART 1 ships TypeScript contracts only (`@modula/greenfield-contracts` extension files).
- PART 2+ implements persistence and runtime under `services/greenfield-api` / `greenfield-worker`.
- Vault Notes and other modules remain separate GitHub-backed packages; only host contracts land in this repository.
