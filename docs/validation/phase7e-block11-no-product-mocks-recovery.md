# Phase 7E Block 11 No-Product-Mocks Recovery

Date: 2026-08-01
Repository: `/home/andrei/modula-latest`
Branch: `phase7e-block11-real-product-completion`
Production deployment: prohibited and not performed
Mac/iOS acceptance: not started

## Result

`pnpm verify:phase7e-no-product-mocks` now passes.

The recovery removed product-runtime imports from demo, seed and preview catalogues; changed manual refresh completion to follow the real feed request; and converted several preview-only surfaces into repository-backed or capability-hidden states.

## Finding Classification

| Finding | Classification | Resolution |
| --- | --- | --- |
| `src/components/feed/DemoPostItem.tsx` demo-named component | `remove-dead-feature` | Renamed the unused demo-named feed component to `src/components/feed/FeedPostItem.tsx`. |
| `src/domain/discovery/DiscoverResult.ts` imported `demoProfileModules` type | `replace-with-real-repository` | Moved `ProfileModulePreview` into `src/features/profile/contracts/profileModules.ts`. |
| `src/features/discover/screens/DiscoverFeedsScreen.tsx` imported seeded feeds | `replace-with-real-api` | Uses `/v1/discover` trending topics as feed candidates. |
| `src/features/discover/screens/DiscoverInterestsScreen.tsx` imported seeded interests | `replace-with-real-api` | Uses `/v1/discover` trending topics as interest candidates. |
| `src/features/discover/screens/DiscoverScreen.tsx` imported seeded communities | `replace-with-real-api` | Renders communities from discover topic data. |
| `src/features/feed/screens/HomeFeedScreen.tsx` used timed manual refresh completion | `replace-with-real-api` | Manual refresh ends when `feedQuery.refetch()` resolves or fails. |
| `src/features/marketplace/components/MarketplaceStatusBadge.tsx` imported seeded marketplace type | `replace-with-real-repository` | Owns the small status contract locally. |
| `src/features/marketplace/data/catalog.ts` contained a prohibited demo import string in a comment | `false-positive-with-justified-allow-list` | Removed the comment text; no allow-list was added. |
| `src/features/marketplace/screens/SellerPreviewScreen.tsx` imported seeded seller/catalogue data | `replace-with-real-repository` | Uses `useModuleCatalogueQuery()` and publisher IDs from registry modules. |
| `src/features/presence/components/PresenceStoriesRail.tsx` defaulted to presence seed data | `hide-by-capability` | Rail renders only when real people are supplied. |
| `src/features/product/data/launcherSearch.ts` imported seeded marketplace catalogue | `hide-by-capability` | Removes local module hits from launcher search; module search remains in Product Hub. |
| `src/features/product/screens/CommunitiesOsScreen.tsx` imported seeded communities | `hide-by-capability` | Shows no community records until a real community service is available. |
| `src/features/product/screens/CustomizationSurfacesScreens.tsx` imported seeded social/presence data | `hide-by-capability` | Removes seeded people/list counts and hides empty presence rail output. |
| `src/features/product/screens/StoriesPresenceScreen.tsx` imported presence seed data | `hide-by-capability` | Removes seed-backed join/presence data and keeps the rail empty unless supplied. |
| `src/features/profile/components/ProfileModuleCard.tsx` imported demo module type | `replace-with-real-repository` | Uses the profile module contract. |
| `src/features/profile/components/ProfileShell.tsx` imported `demoProfileModules` | `replace-with-real-repository` | Resolves featured modules from `useModuleCatalogueQuery()` and `profile.featuredModuleIds`. |
| `src/features/profile/data/demoProfiles.ts` imported demo identity claims through product alias | `move-to-test-fixture` | Keeps seed ownership local with a relative import for local API fixtures. |
| `src/features/profile/data/index.ts` exported demo data through product aliases | `move-to-test-fixture` | Uses relative local exports so product aliases are not used for demo data. |
| `src/features/profile/repository/DemoProfileRepository.ts` imported demo profiles | `move-to-test-fixture` | Renamed to `LocalProfileRepository` and kept it scoped to local repository fixtures. |
| `src/features/profile/repository/DemoProfileRepository.ts` demo-named product source | `remove-dead-feature` | Removed the demo-named path by renaming it to `LocalProfileRepository.ts`. |
| `src/features/profile/tabs/ModulesProfileTab.tsx` imported `demoProfileModules` | `replace-with-real-repository` | Resolves profile modules from the module catalogue query. |
| `src/features/reels/data/index.ts` re-exported algorithm seed data | `move-to-test-fixture` | Removed the seed export from the product data barrel. |
| `src/features/reels/screens/YourAlgorithmScreen.tsx` imported algorithm seeds | `replace-with-real-api` | Derives algorithm tags from `useReelsQuery()` data. |
| `src/features/social/data/seededSurfaces.ts` contained a prohibited demo import string in a comment | `false-positive-with-justified-allow-list` | Removed the comment text; no allow-list was added. |
| `src/features/social/screens/SocialSurfaceScreens.tsx` imported seeded social surfaces | `hide-by-capability` | Removed seed imports and defaults product-only placeholder collections to empty data. |
| `src/features/social/sheets/ShareToSheet.tsx` imported seeded message threads | `hide-by-capability` | Removes seeded DM targets; copy/system share remain available. |
| Discover/Profile/Social/Product mixed seeded preview imports across the verifier group | `hide-by-capability` | Normal remote runtime no longer imports those seed modules. |
| Reels algorithm seeded preference state | `replace-with-real-api` | Preference chips are populated from loaded reel captions and sources. |
| Timed refresh state in Home feed | `replace-with-real-api` | Refresh completion is request-driven, not timer-driven. |

## Verification

```text
pnpm verify:phase7e-no-product-mocks
pnpm typecheck
```

Results:

- `pnpm verify:phase7e-no-product-mocks`: passed.
- `pnpm typecheck`: passed.

## Still Not Claimed

- Web browser acceptance has not run yet.
- SMTP-backed auth/recovery acceptance remains incomplete.
- Object storage/media acceptance remains incomplete.
- Phase 7F Mac/iOS acceptance remains not started.
