# Modula module standards

**Status:** Living standard for external modules (GitHub packages / Registry)  
**Host boundary:** `docs/architecture/module-boundary.md`  
**Manifest contract:** `GreenfieldModuleManifest` in `@modula/greenfield-contracts`  
**Boilerplate:** `templates/modula-module/`

---

## What a module is

A Modula module is a separately distributed package that contributes surfaces to the host:

- Routes
- Profile tabs
- Board surfaces / widgets
- Settings sections
- Composer tools
- Automation nodes
- Agents (scoped)

Modules **must not** be hardcoded into the host application tree as product features.

---

## Manifest requirements

Every module publishes a manifest compatible with `GreenfieldModuleManifest`:

| Field | Required | Notes |
| --- | --- | --- |
| `moduleId` | yes | Stable reverse-DNS style id (`digital.modula.*` or publisher namespace) |
| `name` | yes | Human title |
| `repositoryUrl` | yes | Source of truth package / GitHub URL |
| `packageVersion` | yes | Semver |
| `hostCompatibility` | yes | `minimumHostVersion` |
| `capabilities` | yes | Declared contribution capabilities |
| `permissions` | yes | Least privilege; host enforces |
| `uninstallBehaviour` | yes | `retainData` \| `purgeData` \| `exportThenPurge` |

Optional contribution arrays: `routes`, `profileTabs`, `boardSurfaces`, `settings`, `functions`, `tools`, `widgets`, `schemas`.

---

## Permission rules

1. Declare every permission the module needs.
2. Never read private host storage outside the module namespace.
3. Network access must be declared and user-visible.
4. Agents/tools must not silently access private modules.
5. Failure in a module must not crash the host (error boundaries).

---

## Host guarantees

- Design tokens from host theme
- Namespaced storage
- Capability checks before invoking tools
- Launchable shell with zero modules installed

---

## Forbidden in host

- Hardcoding Vault Notes, Tasks, CRM, or other product modules as first-party features
- Dynamic code fetching / eval of untrusted GitHub sources
- Fake install success that claims remote sandbox execution

---

## Builder pipeline (honest)

```
Forge (draft) → SDK package → Fusion / Registry → Marketplace → sandboxed install
```

Forge Preview in the app drafts manifests only. It does not publish or execute modules.

---

## Boilerplate

Start from `templates/modula-module/`:

1. Copy the template
2. Fill `modula.module.json` (manifest)
3. Implement surfaces behind the declared routes
4. Keep host imports limited to public contracts / tokens
5. Document permissions in README

See also: `src/modules/README.md`, ADR-008 (extension kernel).
