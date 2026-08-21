# PVP-UI-1 skill bootstrap

**Phase:** PVP-UI-1 — Product Hub  
**Recorded:** 2026-08-21  
**Workspace:** `/Users/msjoy/Developer/modula-pvp-ui-1-product-hub`  
**Branch:** `cursor/pvp-ui-1-product-hub`  
**Base SHA:** `9841530a59250a8f162460332cc834715316038d`  
**Product Hub source edited before this file:** NO

This gate was completed before Product Hub production components were changed.

## Required output

| Skill | Status |
| --- | --- |
| MODULA UI SKILL | READ |
| MODULA COMPONENT SKILL | READ |
| MODULA SCREEN SKILL | READ |
| MODULA ACCESSIBILITY SKILL | READ |
| MODULA VISUAL VERIFY SKILL | READ |
| EXPO BUILDING NATIVE UI | READ |
| EXPO SWIFTUI | READ |
| EXPO JETPACK COMPOSE | READ |
| EXPO DATA FETCHING | READ |
| EXPO DEV CLIENT | READ |
| INSTALLED SDK INSPECTED | YES |
| INSTALLED @EXPO/UI TYPES | YES |
| INSTALLED EXPO ROUTER TYPES | YES |

## Modula skills read

| Path | Role |
| --- | --- |
| `.cursor/skills/phase7m/SKILL.md` | Binding Cursor pointer for Phase 7M UI |
| `docs/agent-skills/phase7m/SKILL.md` | Binding Modula UI implementation skill |
| `docs/agent-skills/phase7m/reference-policy.md` | Provenance / installed-first / no speculative deps |
| `docs/agent-skills/phase7m/component-implementation.md` | Component construction sequence |
| `docs/agent-skills/phase7m/screen-composition.md` | Screen composition sequence |
| `docs/agent-skills/phase7m/accessibility.md` | Hard a11y requirements |
| `docs/agent-skills/phase7m/visual-verification.md` | Visual evidence requirements |
| `.cursor/skills/modula-ui/SKILL.md` | Theme, adapters, Surface Types |
| `.cursor/skills/modula-architecture/SKILL.md` | Host/module/shell rules |
| `.cursor/skills/modula-dependencies/SKILL.md` | Dependency admission |

## Newer visual / UI skills after Phase 7M

Searched `.cursor/skills/` and `docs/agent-skills/`.

| Skill | Supersedes 7M? | Decision |
| --- | --- | --- |
| `modula-ui` | NO | Complements 7M. Explicitly requires the Phase 7M skill for visual work. |
| `apple-design` | NO | Motion/material craft reference. Does not replace Modula identity or Surface Types. |
| `animate` | NO | Web animation construction. Product Hub native motion uses `animate-expo` + Modula motion tokens. |
| `animate-expo` | NO | Reanimated 4 / Expo Router motion construction. Used for search morph and press. |
| `animation-vocabulary` | NO | Naming glossary only. |

**No skill silently replaces Phase 7M.** PVP-UI-1 follows 7M anti-AI-UI rules plus the PVP programme: native where interaction matters, Modula where identity matters.

## Expo skills read

Loaded from the official Expo skill pack (`openai-curated-remote/expo/1.0.2`):

| Skill | Notes for SDK 57 |
| --- | --- |
| `building-native-ui` | Headers, search, NativeTabs, glass, zoom, controls. References inspected. |
| `expo-ui-swift-ui` | **Skill text is SDK 55.** Installed `@expo/ui` 57.0.12 types are the API authority. |
| `expo-ui-jetpack-compose` | **Skill text is SDK 55.** Installed Compose `.d.ts` files are the API authority. |
| `native-data-fetching` | Product Hub continues to use existing TanStack Query repositories. No ad-hoc `fetch()` in the screen. |
| `expo-dev-client` | Modula is configured with `expo-dev-client`. Native Product Hub evidence uses the development client / `expo run:ios`, not Expo Go. |
| `use-dom` | Inspected only as existence. **Not used.** No DOM Components introduced. |

`building-native-ui` references also read: `search.md`, `toolbar-and-headers.md`, `tabs.md`, `visual-effects.md`, `zoom-transitions.md`, `controls.md`, `animations.md`.

## Installed SDK inspection

Resolved from `package.json` + `pnpm list` on the 7N-A main SHA:

| Package | Installed |
| --- | --- |
| Expo SDK | `57.0.15` |
| React | `19.2.3` |
| React Native | `0.86.2` |
| React Native Web | `0.21.2` |
| Expo Router | `57.0.15` |
| `@expo/ui` | `57.0.12` |
| Reanimated | `4.5.1` |
| Gesture Handler | `2.32.0` |
| expo-image | `57.0.3` |
| expo-video | `57.0.2` |
| expo-blur | `57.0.2` |
| expo-glass-effect | `57.0.1` |

### Expo Router 57 types actually present

Inspected in `node_modules/expo-router`:

- `Stack.SearchBar` / `StackSearchBarProps` (`build/layouts/stack-utils/StackSearchBar.d.ts`)
- `Stack.Toolbar` + `SearchBarSlot` (`build/layouts/stack-utils/toolbar/`)
- `Stack.Screen.Title` via `StackTitle`
- `NativeTabs` + `NativeTabs.BottomAccessory` from `expo-router/unstable-native-tabs` (**alpha**)
- `expo-router/ui` headless tab primitives
- `Link.AppleZoom`, `Link.AppleZoomTarget`, `Link.Trigger.withAppleZoom`
- `Link.Menu` / `Link.Preview`
- `headerSearchBarOptions` still exists on native stack options

`Stack.SearchBar` documentation in the installed types warns that using it **automatically makes the header visible**. Product Hub currently lives under `SecondaryStackLayout` with `headerShown: false` so Modula owns chrome. Native search is therefore evaluated, then wrapped behind `ProductHubSearch` rather than forced on as a global header.

### `@expo/ui` 57.0.12 types actually present

- Universal root plus `swift-ui`, `swift-ui/modifiers`, `jetpack-compose`
- `Host`, SwiftUI `Picker`, `Button`, `GlassEffectContainer`
- Community `segmented-control` already adapted by `ModulaSegmentedPicker` native
- Product screens remain forbidden from importing `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose` directly

### `expo-glass-effect` 57.0.1 types actually present

- `GlassView` with `glassEffectStyle` (`clear` \| `regular` \| `none`), `isInteractive`, `colorScheme`, `tintColor`
- `GlassContainer`
- `isLiquidGlassAvailable` / `isGlassEffectAPIAvailable`

Existing Modula adapter: `src/platform/ui/materials/liquid-glass-chrome.tsx`. PVP-UI-1 does not scatter `GlassView` imports into Product Hub.

## Implementation contract used

```
BLOG (Expo Router v55 article)
  → understand direction
SDK 57 docs + installed .d.ts
  → confirm actual API
Modula platform adapters
  → implement
```

No packages were upgraded because a newer API exists.
