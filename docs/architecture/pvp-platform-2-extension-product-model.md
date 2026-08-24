# PVP Platform Phase 2 extension product model

Status: implemented on `cursor/pvp-platform-2-module-addon-fabric`

Control plane: Greenfield

Presentation: declarative Module Host

## Invariant

A Modula product exposes contracts and an extension consumes those contracts.
The consumer never imports the target product, reads its database, receives the
user session bearer, or injects executable UI into the host.

## Universal taxonomy

All installable entries are immutable registry releases. `kind` defines their
role:

| Kind | Role | Target required |
| --- | --- | --- |
| `module` | Standalone application environment | No; a module must work alone |
| `addon` | Substantial product-specific extension, optionally with a backend | Yes |
| `plugin` | Lighter local/declarative behaviour | Yes |
| `function` | Headless invocable contract | When product-scoped |
| `tool` | Discoverable user action, normally backed by a function | When product-scoped |
| `widget` | Compact declarative presentation | When product-scoped |
| `connector` | Governed bridge to an authorised external service | When product-scoped |
| `service` | Non-primary backend execution infrastructure | When product-scoped |

The released Module Standard 2.1 contract is `extensionProduct`. It carries
targets, owned extension points, declarative contributions, retention, and
bounded graph policy. Greenfield projects it into registry, installation,
capability, contribution, event, job, and lifecycle tables through migration
`039_pvp_platform_2_extension_fabric.sql`.

## Ownership

- A module owns its canonical records, operations, events, and service
  contracts.
- An extension owns its derived state, jobs, settings, and service state.
- Optional annotations use `greenfield_extension_entity_metadata`; its database
  constraint requires `namespace = extension_product_id`.
- Removing extension-owned data cannot delete a target module record.

## Lifecycle

`greenfield_extension_runtime_projection` is the UI-facing authoritative state:

`NOT_INSTALLED → RESOLVING → INSTALLING → INSTALLED → ENABLING → ENABLED`

and, when requested:

`ENABLED → DISABLING → DISABLED → UNINSTALLING → NOT_INSTALLED`

The same projection represents `UPDATE_AVAILABLE`, `UPDATING`, `INCOMPATIBLE`,
`QUARANTINED`, and `FAILED`. Legacy installation states remain only as the
compatible worker/queue source; the projection prevents clients from inferring
state from independent booleans.

## Composition

The generic host resolves:

1. the enabled target installation and immutable release;
2. its declared extension points;
3. enabled, compatible, account-scoped contribution registrations;
4. capability grants, platform, route, and online conditions;
5. one failure boundary per contribution.

There are no Vault AI, Vault Voice, or formatting product IDs in the host or in
Vault Notes core.

## Reference products

- `digital.modula.vault-notes` — standalone module and contract owner.
- `digital.modula.vault-notes.ai` — backend-backed add-on.
- `digital.modula.vault-notes.voice` — media/transcription add-on.
- `digital.modula.vault-notes.formatting` — backend-free plugin.

They are independent repositories and releases. The host/runtime repository
contains contracts and projections, not their product implementation.
