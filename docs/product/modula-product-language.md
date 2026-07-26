# Modula Product Language

Status: Phase 7C canonical vocabulary

Only the canonical names below should appear in user-facing Founder Alpha UI. Internal aliases may remain temporarily when needed for migration, but new copy and navigation should use this language.

| Concept | Canonical name | Notes |
| --- | --- | --- |
| Main extension store | Product Hub | Replaces user-facing Marketplace/Extensions wording for the core catalogue. |
| Personal dashboard | Board | Private operating surface, not a feed. |
| User page | Profile | No separate Identity Centre. |
| Content stream | Feed | Home contains feed modes. |
| Publish surface | Composer | Central create surface. |
| Installed product | Module | First-class installed product capability. |
| Module-provided command | Tool | Exposed through Composer, module route, or menus. |
| Executable reviewed operation | Function | Requires review/gating/audit. |
| Embedded summary surface | Widget | Summary or compact contribution surface. |
| Behaviour extension | Plugin | Trusted lifecycle/runtime extension, not arbitrary code. |
| External service integration | Connection | Optional external account or service link. |
| Game ecosystem | Gubic | Deferred. |
| Game package | Game | Deferred. |
| Core backend | Greenfield | Exposed only where technically necessary. |

## Replacement Rules

- Use `Product Hub`, not `Marketplace`, for the main module store entry.
- Use `Board`, not dashboard, control center, workspace, or home board.
- Use `Profile`, not Identity Centre.
- Use `Module`, not extension or app, when referring to installed Modula products.
- Use `Tool` for module-provided commands in the Composer plus drawer.
- Use `Function` only for reviewed executable operations and developer/audit contexts.
- Use `Connection` for AT Protocol and other optional external integrations.
- Use `Greenfield` in diagnostics, About, and developer docs; avoid exposing backend terminology in onboarding.

## Current UI Names To Audit

Observed current terms requiring Phase 7C cleanup:

- `Marketplace`
- `Modules`
- `Extensions`
- `Developer Tools`
- `Feature Atlas`
- `Design Lab`
- `Customize`
- `Forge`
- `Glass Privacy`
- `DIMON`
- `NFT`
- `Gaia`
- `AT Protocol`

These can remain in developer/product disclosure where appropriate, but they should not compete with the Founder Alpha navigation language.
