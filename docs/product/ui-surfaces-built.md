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
| `/product/focus` | Focus Mode toggles + Halo (persisted) |
| `/product/merge-feeds` | Merge 2–5 feeds (persisted) |
| `/product/automations` | Workflow cards + local enable (persisted) |
| `/product/gaia` | Agent console + scopes (persisted) |
| `/product/gaia-atlas` | Atlas schematic |
| `/product/widgets` | Toggle widgets → Board strip (persisted) |
| `/product/feature-control` | Enable/lock features (persisted) |
| `/product/glass-privacy` | Glass Privacy levels (persisted) |
| `/product/forge` | Builder canvas + draft name (persisted) |
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
| `/board` | Widget strip + Focus copy from prefs |
| `/settings/dimon` | Expanded DIMON direction (inactive) |

## Navigation wiring

- Drawer: Product Hub, Focus, Forge, Search  
- Settings: Product Hub, Feature Control, Glass Privacy, Focus, Gaia, Forge  
- Account panel: Product Hub, Focus, Search  
- Board: Profile-OS, Focus, product chips  
