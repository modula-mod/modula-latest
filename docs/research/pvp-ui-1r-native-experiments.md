# PVP-UI-1R native experiments

Installed Expo SDK 57.0.15 / Expo Router 57.0.15 / `@expo/ui` 57.0.12 / `expo-glass-effect` 57.0.1.

Live comparison: `/settings/developer/pvp-native-experiments` and UI Lab PVP-UI-1R directions.

## Stack.SearchBar

| | |
| --- | --- |
| API | `Stack.SearchBar` — `node_modules/expo-router/build/layouts/stack-utils/StackSearchBar.d.ts` |
| Works? | iOS yes. **Automatically sets `headerShown: true`.** |
| Decision | **REJECT** as Product Hub production chrome. **ADAPT** morphing `ProductHubSearchChrome` (compact glass trigger → field). |

## Bottom toolbar SearchBarSlot

| | |
| --- | --- |
| API | `Stack.Toolbar.SearchBarSlot` (iOS 26+) |
| Works? | Types present. Conflicts with Modula floating tab bar. |
| Decision | **REJECT** for Product Hub. Keep evaluated for a later Shell phase. |

## Compact search button → expanding field

| | |
| --- | --- |
| API | `ProductHubSearchChrome` + search machine + Reanimated |
| Works? | iOS / web / Android via adapters |
| Decision | **ADOPT** as production idle search. |

## Segmented control

| | |
| --- | --- |
| API | `ModulaSegmentedPicker` / Expo UI segmented |
| Decision | **ADAPT** — wide library chrome only. **REJECT** as a stacked utility block under search. Narrow web uses a full-label popover so Discover never truncates to “Disco…”. |

## Liquid Glass

| | |
| --- | --- |
| API | `expo-glass-effect` via `LiquidGlassChrome`; `isLiquidGlassAvailable` / `isGlassEffectAPIAvailable` |
| Decision | **ADAPT** — search trigger + library trigger only. Never featured/content/rows. |

## Apple Zoom

| | |
| --- | --- |
| API | `Link.AppleZoom` on featured artwork |
| Decision | **ADAPT** — Featured → Module Detail cover. Rows keep standard push. |

## Animated symbols

| | |
| --- | --- |
| API | expo-ui-examples animated-symbols; install confirmation |
| Decision | **ADAPT** — install/open confirmation only, tied to real lifecycle. Not decorative. |

## Material / Compose

| | |
| --- | --- |
| API | `@expo/ui/jetpack-compose` via existing adapters; Material You example inspected |
| Decision | **ADAPT** — same IA, Material segmented/ripple language on Android. **REJECT** iOS glass/typography on Android. |
