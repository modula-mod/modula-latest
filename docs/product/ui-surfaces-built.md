# Modula UI surfaces built (craft track)

**Branch tip track:** `phase6s-social-product-completion`  
**Honesty rule:** Preview/planned screens explain direction. They do not fake wallets, billing, or untrusted module execution.

## Entry

| Route | Status |
| --- | --- |
| `/welcome` | Atmospheric welcome + capabilities CTA |
| `/onboarding` | 3-step first-run + PresenceArc |
| `/product` | Full Product Hub catalogue |
| `/product/atlas` | Feature Atlas registry: **580+** named capabilities with honest maturity labels |
| `/product/design-lab` | X + Apple Liquid Glass inspiration remaps (Modula Teal, not a clone) |

## Interactive studios

| Route | Surface |
| --- | --- |
| `/product/focus` | Focus Off/Light/Deep/Custom + policy engine Preview + Halo |
| `/product/start` | Start Launcher quick actions + local command/product/module search |
| `/product/chat-assist` | Chat Assist permission modes + functions checklist + Quiet Send section |
| `/product/quiet-send` → `/product/chat-assist` | Quiet Send redirect into Chat Assist |
| `/product/intelligence` | Canonical intelligence Hub (GAIA · AKI · Governor …) |
| `/product/intelligence/[slug]` | Layer detail + seeded Preview samples |
| `/product/commands` | Command Layer catalogue |
| `/product/aki` → `/product/intelligence/aki` | AKI redirect |
| `/product/governor` → Governor layer | AGI Governor redirect |
| `/product/circuit-memory` | Circuit Memory Centre local inspect/delete/export controls |
| `/product/kaizen` | Kaizen Improve capture + local review queue |
| `/product/ledger` | Ledger Replay diagnostic rows + non-destructive replay explanation |
| `/product/foundry` · `/claims-graph` | Layer redirects |
| `/product/merge-feeds` | Merge 2–5 feeds (persisted) + local preset name + source weighting Preview |
| `/product/automations` | Workflow cards + local enable (persisted) |
| `/product/gaia` | GAIA console — scopes + governed flow (persisted) |
| `/product/gaia-atlas` | Atlas schematic (GAIA centre · AKI/Governor orbit) |
| `/product/widgets` | Toggle widgets → Board strip (persisted); GAIA briefing Preview, DIMON activity inactive, NFT entitlements Preview |
| `/product/feature-control` | Enable/lock features (persisted) |
| `/product/glass-privacy` | Glass Privacy levels (persisted) |
| `/product/forge` | Plan/Build/Preview/Manifest workspace + templates, chat, scan, versions |
| `/product/permissions` | Permissions matrix + Security Scan Preview |
| `/product/developer` | Developer Tools studio: Greenfield MCP status, Modula CLI commands, Cursor `mcp.json` example |
| `/product/nft` | NFT ownership foreshadow — DIMON inactive, mint/transfer blocked |
| `/product/agents` | Agents module studio (Gaia scopes) |
| `/product/integrations` | Elements catalogue + pin/filter |
| `/product/search` | Universal search preview |
| `/product/atlas` | Feature Atlas browse/search/filter surface; maps capabilities to existing routes or atlas-filter fallbacks |
| `/product/creator` | Creator economy path picker |
| `/product/ownership` | Ownership & portability |
| `/product/presence` | Presence rings (not IG Stories) |
| `/product/communities` | Communities OS (also `/communities`) |
| `/product/[slug]` | Capability pre-screen for every catalogue item |

Local craft prefs: `src/features/product/storage/productPreferencesStorage.ts` (AsyncStorage). Kaizen queue: `modula.kaizen.queue.v1`. Circuit Memory Preview list: `modula.circuit-memory.items.v1`.

## Social OS surfaces

| Route | Notes |
| --- | --- |
| `/profile/os` | Profile-OS pre-screen |
| `/modules` | Modules library (marketplace-backed) |
| `/marketplace/[id]` | 69 module pre-screens across Notes, Tasks, CRM, Calendar, Files, DIMON inactive wallet, NFT entitlements, Newsletter, Analytics, Health, Games, Automations, Agents, Themes, Widgets, Team tools |
| `/teams` | Teams OS role preview + persisted role choice + roles matrix + shared Board/modules + approval stubs + focus/availability + Intelligence/Ledger links |
| `/communities` | Communities OS seeded list |
| `/board` | Widget strip (reorder/remove) + Focus copy from prefs + GAIA/DIMON/NFT entitlement widget cards |
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
| Composer Tools drawer | Manifest-like tool registry fallback: Photo, Camera, Video, GIF, File, Poll, Location, Schedule, Comment-to-DM, Automation, AI rewrite, Translation, Content warning, Product attach, NFT attach blocked; unavailable tools explain required modules |

## Navigation wiring

- Drawer: Product Hub, Focus, Forge, Search  
- Settings: Product Hub, Feature Control, Glass Privacy, Focus, Gaia, Forge  
- Account panel: Product Hub, Focus, Search  
- Board: Profile-OS, Focus, product chips  
- Product Hub: Feature Atlas featured card near Create & Extend
