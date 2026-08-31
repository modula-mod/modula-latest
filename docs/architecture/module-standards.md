# Modula module standards

**Status:** Living standard for external modules (GitHub packages / Registry)  
**Host boundary:** `docs/architecture/module-boundary.md`  
**External product contract:** Modula Product Standard (MPS) 1.0 — `modula.product.json`
**Platform protocol:** Greenfield Protocol `greenfield.v1`  
**Module profile:** Module Standard 2.1 (`../modula-mod/modula-module-standard`)  
**Legacy module manifest:** `GreenfieldModuleManifest` in `@modula/greenfield-module-manifest` (adapter → MPS)  
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

Legacy Greenfield v1 manifests continue to validate unchanged. Standard 2.0 manifests opt into `manifestVersion: 2`, `standardVersion: "2.0.0"`, and `sectionVersions`.

Standard 2.0 adds independently versioned declarations for identity, lifecycle, backend, engines, AI, permissions, settings, routes, views, records, actions, functions, jobs, events, notifications, search, exports, imports, synchronization, dependencies, optional dependencies, integrations, billing, telemetry, diagnostics, accessibility, localization, appearance, onboarding, migrations, capabilities, services, APIs, hooks, metrics, storage, widgets, navigation, UI contributions, automation, offline, realtime, versioning, compatibility, marketplace, and future engines.

Optional contribution arrays remain supported: `routes`, `profileTabs`, `boardSurfaces`, `settings`, `functions`, `tools`, `widgets`, `schemas`.

## Standard 2.0 registries

Standard 2.0 modules can publish generic registries that Greenfield can inspect without module-specific code:

- `dependencyGraph`: `requires`, `optional`, `recommended`, `conflicts`, `replaces`, and `provides`
- `serviceRegistry`: discoverable services such as search, export, autosave, revision, history, markdown, storage, AI, and automation
- `apiRegistry`: module-owned operations under `/api/modula/{module-id}/...`
- `eventBus`: published and subscribed event contracts
- `hookRegistry`: before/after/around lifecycle and record hooks
- `capabilityDiscovery`: boolean support flags for search, export, AI, offline, realtime, notifications, widgets, automation, sync, history, sharing, encryption, media, comments, presence, voice, video, backend, custom backend, and self-hosting
- `permissionModel`: split grant categories for data, filesystem, media, AI, automation, DIMON, connectors, notifications, search, background, realtime, widgets, presence, voice, camera, location, Bluetooth, NFC, clipboard, health, calendar, contacts, mail, storage, backend, admin, and developer
- `jobRegistry`, `storageModel`, `widgetRegistry`, `navigationRegistry`, `uiContributions`, `automationRegistry`, `offline`, `realtime`, `versioning`, `compatibilityMatrix`, `marketplace`, and `engineReadiness`

Greenfield validates Standard 2.0 fields as contracts only. It does not execute module code, patch another module, or grant permissions automatically.

---

## Permission rules

1. Declare every permission the module needs.
2. Never read private host storage outside the module namespace.
3. Network access must be declared and user-visible.
4. Agents/tools must not silently access private modules.
5. Failure in a module must not crash the host (error boundaries).

### Catalogue UI

- Host catalogue: `src/features/product/data/modulePermissions.ts`
- Matrix studio: `/product/permissions`
- Forge Build mode toggles the same IDs
- Security Scan Preview is a local checklist — not a CVE database

See also `docs/design/forge-builder-inspiration.md` (Lovable / Bolt / Base44 remap).

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

## skill.md — module digital DNA

Every module should ship `skill.md` alongside the JSON manifest. GAIA uses it to understand capabilities; AKI uses it to validate; the AGI Governor uses it to control.

Declare at minimum:

- What the module does
- Commands exposed (risk, confirmation)
- Data types owned
- AI-accessible actions
- Permissions + network destinations
- Events emitted/consumed
- Audit / Ledger behaviour
- Compatible host versions

Template: `templates/modula-module/skill.md`  
Intelligence model: `docs/architecture/intelligence-architecture.md`

Commands must also register with the **Command Layer** (typed inputs, preview, undo, Ledger policy) — see `/product/commands`.

---

## Boilerplate

Start from `templates/modula-module/`:

1. Copy the template
2. Fill `modula.module.json` (manifest)
3. Fill `skill.md` (digital DNA for GAIA / AKI / Governor)
4. Implement surfaces behind the declared routes
5. Keep host imports limited to public contracts / tokens
6. Document permissions in README

See also: `src/modules/README.md`, ADR-008 (extension kernel).

External Standard 2.0 docs:

- `../modula-mod/modula-module-standard/docs/module-standard-2.0.md`
- `../modula-mod/modula-module-standard/docs/migration-standard-2.0.md`
- `../modula-mod/modula-module-standard/schemas/module-manifest-2.0.schema.json`
