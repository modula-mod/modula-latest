# Module skill — digital DNA

Machine-readable capability declaration for GAIA, AKI, and the AGI Governor.  
Companion to `modula.module.json` (`GreenfieldModuleManifest`).

## Identity

- **moduleId:** `digital.modula.example`
- **name:** Example Module
- **summary:** Boilerplate module — replace before publishing.
- **runtime:** Modula host ≥ 0.1.0

## What it does

- Provides a sample route, Board card, and profile tab slot.
- Registers a Composer tool stub.
- Owns only namespaced storage.

## Commands exposed

| Command | Risk | Confirmation | Description |
| --- | --- | --- | --- |
| `example.ping` | low | preview | Health check / Preview |

## Data types owned

- `example.note` — local draft objects in namespaced storage

## Inputs / outputs

- **In:** user-confirmed text  
- **Out:** draft entity id  

## Surfaces

- Route: `/modules/digital.modula.example`
- Profile tab: `example`
- Board surface: `example-card`
- Settings: `example-settings`
- Widget: `board.example`

## AI-accessible actions

- `example.summariseLocal` — read-only over module namespace; never host private data

## Permissions required

See `modula.module.json` → `permissions`.

User-visible strings must match `/product/permissions` catalogue.

## Network destinations

- None by default. Declare allowlist when adding `network:declared`.

## Risk & confirmation

- Default risk: **low**
- High-risk AI or network actions require **explicit** confirmation and AKI preview

## Events

- **Emits:** `example.draft.created`
- **Consumes:** none

## Audit / Ledger

- All command executions must produce Ledger entries when consequential
- Uninstall behaviour: `exportThenPurge`

## Compatibility

- Host compatibility: `minimumHostVersion` in manifest
- Does not hardcode Vault Notes / Tasks / CRM into the host
