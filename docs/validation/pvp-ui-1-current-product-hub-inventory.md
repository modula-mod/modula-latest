# PVP-UI-1 current Product Hub inventory

**Recorded from:** `9841530a59250a8f162460332cc834715316038d` (`origin/main` / Phase 7N-A)  
**Workspace:** `/Users/msjoy/Developer/modula-pvp-ui-1-product-hub`  
**Classification key:** KEEP / REFINE / REWORK / REPLACE / REMOVE

Phase 7N-A visual class for Product Hub: **NEEDS_REFINEMENT**. Useful product semantics are preserved. Visual quality is reconstructed.

## ROUTE

| Path | File | Class | Notes |
| --- | --- | --- | --- |
| `/product` | `src/app/product/index.tsx` → `ProductHubScreen` | KEEP | Flagship Product Hub |
| `/marketplace` | `src/app/marketplace/index.tsx` → `MarketplaceScreen` | KEEP | Same catalogue screen |
| `/marketplace/[moduleId]` | `src/app/marketplace/[moduleId].tsx` | KEEP | Module Detail. Interior is Phase 2. PVP-UI-1 may only fix transition/handoff. |
| `/modules` | `src/app/modules.tsx` | KEEP | Library, not this phase |
| Product stack layout | `src/app/product/_layout.tsx` | KEEP | `SecondaryStackLayout`, `headerShown: false` |
| Marketplace stack layout | `src/app/marketplace/_layout.tsx` | KEEP | Same |

## SCREEN

| Screen | Path | Class |
| --- | --- | --- |
| Product Hub marketplace | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx` | REWORK visual composition; KEEP data/search/install behaviour |
| ProductHubScreen alias | `src/features/product/screens/ProductHubScreen.tsx` | KEEP |
| MarketplaceScreen alias | `src/features/marketplace/screens/MarketplaceScreen.tsx` | KEEP |
| Module Detail | `src/features/marketplace/screens/ModuleDetailScreen.tsx` | KEEP interior. REFINE only zoom target / route handoff |
| ProductHubScreen (atlas/forge siblings) | `src/features/product/screens/*HubScreen.tsx` | KEEP — do not migrate |

## COMPONENTS

| Piece | Path | Class |
| --- | --- | --- |
| Search chrome | `src/features/modules/components/ProductHubSearchChrome.tsx` | REFINE — morph, glass trigger, motion tokens, keyboard |
| Editorial hero | `src/features/modules/components/presentation/ModuleEditorialHero.tsx` | REWORK — less card, artwork dominates, copy on canvas |
| Module row | `src/features/modules/components/presentation/ModuleRow.tsx` | REFINE — density, large-text CTA wrap, Coming Soon mute |
| Module action | `src/features/modules/components/presentation/ModuleAction.tsx` | REFINE — customer vocab, compact capsule, no second button family |
| Module shelf | `src/features/modules/components/presentation/ModuleShelf.tsx` | REFINE — discovery shelf, responsive card width |
| Feature card | `src/features/modules/components/presentation/ModuleFeatureCard.tsx` | REFINE |
| Section header | `src/platform/ui/chrome/section-header.tsx` via `HubSectionHeader` | REFINE typography roles |
| Collections | `src/features/modules/components/presentation/ModuleCollection.tsx` | KEEP IA; REFINE presentation |
| Category tiles | `src/features/modules/components/presentation/ModuleCategoryTile.tsx` | KEEP for search browse |
| Artwork | `src/features/modules/components/ModuleArtwork.tsx` | KEEP |
| Cover | `src/features/modules/components/product-detail/ProductCover.tsx` | KEEP artwork; REFINE hero crop relationship |
| Catalogue card wrapper | `src/features/modules/components/ModuleCatalogueCard.tsx` | KEEP compatibility wrapper |
| Status pill | `src/features/modules/components/ModuleStatusPill.tsx` | REMOVE from primary Product Hub rows (developer metadata) |
| Install sheet | `src/features/modules/components/InstallPreviewSheet.tsx` | KEEP — not a Product Hub visual redesign |
| Product-detail family | `src/features/modules/components/product-detail/*` | KEEP — Phase 2 |

## HOOKS

| Hook | Path | Class |
| --- | --- | --- |
| Catalogue / installed / detail | `src/features/modules/hooks/useModuleQueries.ts` | KEEP — canonical TanStack Query |
| Lifecycle mutations | same | KEEP |

## REPOSITORY

| Owner | Path | Class |
| --- | --- | --- |
| Module repository contract | `src/data/repositories/contracts` | KEEP |
| API module repository | `src/data/repositories/api/ApiModuleRepository.ts` | KEEP |
| Canonical identity | `packages/greenfield-contracts/src/canonical-module-identity.ts` | KEEP |
| Beta catalogue policy | `services/greenfield-api/src/modules/beta-catalogue-policy.ts` | KEEP — no backend expansion unless a genuine Product Hub defect |

## API

Existing registry/install routes remain the source of truth:

- `GET /v1/registry/modules`
- `GET /v1/modules/installed`
- install / update / enable lifecycle

PVP-UI-1 does not add fake downloads, ratings, ranks, or prices.

## ARTWORK

| Asset | Path | Class |
| --- | --- | --- |
| Vault Notes cover | `assets/images/product-hub/vault-notes-cover.png` | KEEP — strongest current visual |
| Identity packs | `src/features/modules/identity/moduleArtwork.ts` | KEEP |
| Wrapper | `src/components/primitives/AppImage.tsx` (`expo-image`) | KEEP |

## SEARCH

| Piece | Path | Class |
| --- | --- | --- |
| State machine | `src/features/modules/state/productHubSearchMachine.ts` | KEEP states; REFINE motion settlement |
| Chrome | `ProductHubSearchChrome.tsx` | REFINE |
| Offset memory | `src/features/modules/state/productHubScroll.ts` | KEEP |
| Native `Stack.SearchBar` | Expo Router 57 | EVALUATED — not the production chrome (see native experiments) |

States already present: IDLE_LARGE_HEADER, COMPACT_HEADER, SEARCH_EXPANDING, SEARCH_ACTIVE, SEARCH_RESULTS, SEARCH_EMPTY, SEARCH_ERROR, SEARCH_COLLAPSING.

## INSTALL ACTION

| Piece | Path | Class |
| --- | --- | --- |
| Presentation resolver | `src/features/modules/identity/installPresentation.ts` | REFINE customer labels (Coming Soon / Unavailable) without breaking B6 `'Soon'` internal token |
| Compact CTA | `ModuleAction.tsx` | REFINE |
| Product copy | `src/features/modules/identity/productCopy.ts` | KEEP Vault Notes copy |

## PLATFORM ADAPTERS

| Adapter | Path | Class |
| --- | --- | --- |
| Segmented control | `src/platform/ui/controls/modula-segmented-picker*.tsx` | KEEP — Product Hub must consume this, not a new pill |
| Liquid glass chrome | `src/platform/ui/materials/liquid-glass-chrome.tsx` | KEEP — chrome only |
| Glass control group | `src/platform/ui/menus/chrome-glass-control-group.tsx` | KEEP for compact header actions |
| Sheets | `src/platform/ui/sheets/*` | KEEP |
| Floating tab inset | `src/platform/ui/navigation/floating-tab-bar-inset.ts` | KEEP — fix Product Hub bottom inset if needed, do not replace tab bar |
| Native tabs (shell) | `modula-liquid-glass-tab-bar.tsx` | KEEP for this phase. Recommendation recorded for Shell phase |
| Context menus | `src/platform/ui/menus/modula-context-menu.tsx` | ADAPT for optional row menus |
| Motion | `src/theme` motion tokens + `section-enter.tsx` | KEEP tokens; REFINE Product Hub use |

## UI LAB (existing — do not create another)

| Surface | Path | Class |
| --- | --- | --- |
| Modula primitives lab | `src/platform/ui/dev/modula-primitives-lab.tsx` | REFINE — add PVP-UI-1 entries |
| Expo UI lab | `src/platform/ui/dev/expo-ui-lab/` | KEEP |
| Route | `/settings/developer/modula-ui-lab` | KEEP |

## What PVP-UI-1 must not touch

Profile, Home, Post, Auth, Settings interiors, Module Detail interior, global tab migration, production deploy, database, VPS checkout.
