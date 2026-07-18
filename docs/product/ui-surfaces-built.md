# Modula UI surfaces built (craft track)

**Branch tip track:** `phase6s-social-product-completion`  
**Honesty rule:** Preview/planned screens explain direction. They do not fake wallets, billing, or untrusted module execution.

## Entry

| Route | Status |
| --- | --- |
| `/welcome` | Atmospheric welcome + capabilities CTA |
| `/onboarding` | 3-step first-run + PresenceArc |
| `/product` | Full Product Hub catalogue |

## Interactive studios

| Route | Surface |
| --- | --- |
| `/product/focus` | Focus Off/Light/Deep/Custom + policy engine Preview + Halo |
| `/product/intelligence` | Canonical intelligence Hub (GAIA · AKI · Governor …) |
| `/product/intelligence/[slug]` | Layer detail + seeded Preview samples |
| `/product/commands` | Command Layer catalogue |
| `/product/aki` → `/product/intelligence/aki` | AKI redirect |
| `/product/governor` → Governor layer | AGI Governor redirect |
| `/product/circuit-memory` · `/kaizen` · `/foundry` · `/claims-graph` · `/ledger` | Layer redirects |
| `/product/merge-feeds` | Merge 2–5 feeds (persisted) |
| `/product/automations` | Workflow cards + local enable (persisted) |
| `/product/gaia` | GAIA console — scopes + governed flow (persisted) |
| `/product/gaia-atlas` | Atlas schematic (GAIA centre · AKI/Governor orbit) |
| `/product/widgets` | Toggle widgets → Board strip (persisted) |
| `/product/feature-control` | Enable/lock features (persisted) |
| `/product/glass-privacy` | Glass Privacy levels (persisted) |
| `/product/forge` | Plan/Build/Preview/Manifest workspace + templates, chat, scan, versions |
| `/product/permissions` | Permissions matrix + Security Scan Preview |
| `/product/developer` | Developer Tools studio: Greenfield MCP status, Modula CLI commands, Cursor `mcp.json` example |
| `/product/agents` | Agents module studio (Gaia scopes) |
| `/product/integrations` | Elements catalogue + pin/filter |
| `/product/search` | Universal search preview |
| `/product/creator` | Creator economy path picker |
| `/product/ownership` | Ownership & portability |
| `/product/presence` | Presence rings (not IG Stories) |
| `/product/communities` | Communities OS (also `/communities`) |
| `/product/[slug]` | Capability pre-screen for every catalogue item |

Local craft prefs: `src/features/product/storage/productPreferencesStorage.ts` (AsyncStorage).

## Social OS surfaces

| Route | Notes |
| --- | --- |
| `/profile/os` | Profile-OS pre-screen |
| `/modules` | Modules library (marketplace-backed) |
| `/marketplace/[id]` | Module pre-screens + Forge card |
| `/teams` | Teams OS role preview + deep links |
| `/communities` | Communities OS seeded list |
| `/board` | Widget strip (reorder/remove) + Focus copy from prefs |
| Home (`/`) | PresenceArc + Focus banner + quiet/work mode order |
| Messages | Glass Privacy badge + thread hint from prefs |
| Profile customize | Shop + Agents module tab slots (Preview) |
| Tab bar expand | Product Hub, Forge, Focus, Agents shortcuts |
| Web rail | CREATE shortcuts (Product / Forge / Agents / Focus) |
| `templates/modula-module/` | Module boilerplate + `docs/architecture/module-standards.md` |
| `/product/module-standards` | Standards studio |
| `/product/themes` | Themes & layouts packs Preview |
| `/settings/dimon` | Expanded inactive DIMON direction: ownership ledger future, ADR-006 DB boundary, reserved events, forbidden fake balances/token UI |
| Extension Centre | Links to Forge / Standards / Agents / Marketplace |

## Navigation wiring

- Drawer: Product Hub, Focus, Forge, Search  
- Settings: Product Hub, Feature Control, Glass Privacy, Focus, Gaia, Forge  
- Account panel: Product Hub, Focus, Search  
- Board: Profile-OS, Focus, product chips  
