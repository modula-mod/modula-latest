# Modula Module SDK (foreshadow)

**Status:** Design note — SDK package not published yet  
**Builder:** `/product/forge`  
**Boilerplate:** `templates/modula-module/`  
**Standards:** `docs/architecture/module-standards.md`

---

## Goal

Give external module authors a typed SDK that:

1. Validates `GreenfieldModuleManifest`
2. Provides host token / storage / capability helpers
3. Never requires importing private host internals
4. Ships with sandbox install via Registry

---

## Planned packages (future)

| Package | Role |
| --- | --- |
| `@modula/module-sdk` | Manifest helpers, capability checks, namespaced storage types |
| `@modula/module-ui` | Optional presentational helpers consuming host tokens |
| `@modula/module-test` | Host contract mocks for CI |

Until these publish, use:

- `templates/modula-module/`
- `@modula/greenfield-contracts` for `GreenfieldModuleManifest`
- Forge Builder Preview for draft JSON

---

## Honest boundary

Forge Preview does **not** run the SDK, publish packages, or execute module code.
