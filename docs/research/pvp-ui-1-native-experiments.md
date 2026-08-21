# PVP-UI-1 native experiments

Installed Expo SDK 57.0.15 / Expo Router 57.0.15 / `@expo/ui` 57.0.12.  
Product Hub is the only production screen in this phase. The global tab bar is **not** replaced.

Live comparison UI: `/settings/developer/pvp-native-experiments` (developer labs only).

## Native header (`Stack.Screen.Title` / large title)

| | |
| --- | --- |
| API | `Stack` from `expo-router` / `expo-router/stack`; `headerLargeTitleEnabled`; `Stack.Screen.Title` |
| Installed version | expo-router 57.0.15 |
| Tested platform | Types + current Product Hub stack (`SecondaryStackLayout` sets `headerShown: false`) |
| Works? | Yes as a system stack header. Conflicts with Modula secondary chrome (avatar, morphing search, Surface Types, progressive blur). |
| Visual quality | Excellent on iOS when the screen is a plain list. Wrong identity for Product Hub. |
| Accessibility | Native large title tracks Dynamic Type. |
| Web fallback | React Navigation header, not Apple large title. |
| Decision | **ADAPT** — `ProductHubHeader` contract. Do not force the system header on Product Hub in Phase 1. |

## Native search (`Stack.SearchBar`)

| | |
| --- | --- |
| API | `Stack.SearchBar` (`build/layouts/stack-utils/StackSearchBar.d.ts`); also `headerSearchBarOptions` |
| Installed version | expo-router 57.0.15 |
| Tested platform | Types. Installed note: using `Stack.SearchBar` **automatically makes the header visible**. |
| Works? | iOS yes; Android/web are not the same morphing control. |
| Visual quality | Native iOS search is the gold standard, but it cannot carry Modula compact-trigger morph + avatar + Surface Types consistently. |
| Accessibility | Native search is strong on iOS. Web still needs a keyboard field. |
| Web fallback | Custom `ProductHubSearch` TextInput with Tab/Shift+Tab/Escape/Enter/clear/focus ring. |
| Decision | **ADAPT** — `ProductHubSearch` wraps the existing search machine. Native search remains the iOS reference, not the production implementation for this screen. |

## Native segmented control

| | |
| --- | --- |
| API | `@expo/ui/community/segmented-control` via `ModulaSegmentedPicker` native adapter; shared RN track fallback |
| Installed version | `@expo/ui` 57.0.12 + `@react-native-segmented-control/segmented-control` 2.5.7 |
| Tested platform | Existing adapter already used elsewhere |
| Works? | Yes |
| Visual quality | Native iOS segmented Picker; Android/web use the shared track. |
| Accessibility | selected / disabled / labels exist on the adapter |
| Web fallback | Keyboard-operable shared picker |
| Decision | **ADOPT** for Discover / Installed / Updates on Product Hub. |

## Liquid Glass

| | |
| --- | --- |
| API | `expo-glass-effect` `GlassView` (`glassEffectStyle`, `isInteractive`, `colorScheme`); existing `LiquidGlassChrome` |
| Installed version | expo-glass-effect 57.0.1 |
| Tested platform | Types + existing shell chrome |
| Works? | iOS 26+ native; fallback blur/opaque elsewhere |
| Visual quality | Good on small chrome. Previous failure mode was content sampling through the floating tab bar. |
| Accessibility | Reduce Transparency → opaque raised surface |
| Web fallback | Token surface, no fake glass |
| Decision | **ADAPT** — compact search trigger and compact header controls only. Never Product Hub content background. If native glass bleeds or mirrors, use the opaque fallback. |

## Apple Zoom

| | |
| --- | --- |
| API | `Link.AppleZoom`, `Link.AppleZoomTarget`, `Link.Trigger withAppleZoom` |
| Installed version | expo-router 57.0.15 |
| Tested platform | Types confirm Stack-only, iOS 18+ |
| Works? | Available. Skinny rows are a documented bad source. Featured artwork → Module Detail cover is the right source. |
| Visual quality | Signature if source/destination aspect ratios match. |
| Accessibility | System handles Reduce Motion when available; otherwise standard push. |
| Web fallback | Standard route transition |
| Decision | **ADAPT** — prototype on Featured artwork → Module Detail cover only. Rows keep a standard push. Module Detail interior is not redesigned. |

## Native tabs (`expo-router/unstable-native-tabs`)

| | |
| --- | --- |
| API | `NativeTabs`, `NativeTabs.Trigger`, `NativeTabs.BottomAccessory` |
| Installed version | expo-router 57.0.15 (**still alpha** in current SDK 57 docs) |
| Tested platform | Types only this phase |
| Works? | Real UITabBar / Material 3 tabs. Cannot measure tab bar height. Max 5 Android tabs. Dynamic tabs remount state. |
| Visual quality | Best platform chrome. Would replace Modula’s floating/spatial tab identity. |
| Accessibility | Platform native |
| Web fallback | Docs recommend `expo-router/ui` or `_layout.web.tsx` |
| Decision | **DEFER** to PVP-UI-13 Shell. Do not migrate Home/Profile/Activity in Phase 1. |

## Custom tabs (`expo-router/ui`)

| | |
| --- | --- |
| API | `expo-router/ui` headless tab building blocks |
| Installed version | expo-router 57.0.15 |
| Tested platform | Types |
| Works? | Yes — intended for custom tab layouts |
| Visual quality | Better fit for Modula’s floating/spatial tab system than NativeTabs |
| Accessibility | Must be provided by Modula |
| Web fallback | This is the web/custom path |
| Decision | **ADAPT** for the later Shell phase. Recommendation: keep a Modula visual tab identity on `expo-router/ui`, optionally offer NativeTabs as the `native` Surface Type. |

## Animated symbols

| | |
| --- | --- |
| API | Expo UI / expo-image SF Symbol effects (examples repo); Modula icon adapter |
| Installed version | `@expo/ui` 57.0.12, expo-image 57.0.3 |
| Tested platform | Types + examples repo |
| Works? | Yes on iOS |
| Visual quality | Strong for install → checkmark confirmation |
| Accessibility | Reduce Motion = instant state |
| Web fallback | Static icon swap |
| Decision | **ADAPT** — only install/update confirmation, search activation, not decorative icon motion. |

## Shell-phase recommendation

Do **not** replace the global tab bar in PVP-UI-1.

For PVP-UI-13:

1. Default / `native` Surface: evaluate NativeTabs (alpha) behind the existing tab adapter if it is stable enough.
2. Distinctive Modula Surfaces (`glass`, `glay`, `minimalSpatial`): `expo-router/ui` custom tabs so identity can stay spatial/floating.
3. Web desktop: never force native-tab visuals; keep the responsive shell.
4. BottomAccessory is interesting for a future now-playing/module mini player, not for Product Hub content.
