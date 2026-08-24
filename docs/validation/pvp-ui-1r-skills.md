# PVP-UI-1R skill bootstrap

**Phase:** PVP-UI-1R — Product Hub Visual Reconstruction  
**Recorded:** 2026-08-22  
**Workspace:** `/Users/msjoy/Developer/modula-pvp-ui-1r-product-hub`  
**Branch:** `cursor/pvp-ui-1r-product-hub-visual-reset`  
**Base:** PR #35 HEAD `8bf192a1cf7f18df728d187efe5aaa00cc44d07f`  
**Product Hub source edited before this file:** NO

This gate was completed before Product Hub production components were changed in 1R.

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
| `.cursor/skills/apple-design/SKILL.md` | Motion/material craft. Does not replace Modula identity. |
| `.cursor/skills/animate-expo/SKILL.md` | Reanimated 4 / Expo Router motion |
| `.cursor/skills/prototype/SKILL.md` | Three-direction divergence in UI Lab |

**No skill silently replaces Phase 7M.** PVP-UI-1R follows 7M anti-AI-UI rules plus the PVP visual constitution: content > containers, artwork > decorative boxes, native chrome > hand-rolled imitation.

## Newer visual / UI skills after Phase 7M

Searched `.cursor/skills/` and `docs/agent-skills/`.

| Skill | Supersedes 7M? | Decision |
| --- | --- | --- |
| `modula-ui` | NO | Complements 7M. |
| `apple-design` | NO | Liquid Glass as a functional layer, not content. |
| `animate-expo` | NO | Search morph, press, install confirmation. |
| `prototype` | NO | Three genuinely different Product Hub directions. |

## Expo skills read

Loaded from the official Expo skill pack (`openai-curated-remote/expo/1.0.2`):

| Skill | Notes for SDK 57 |
| --- | --- |
| `building-native-ui` | Headers, search, NativeTabs, glass, zoom, controls. References read: `search.md`, `toolbar-and-headers.md`, `tabs.md`, `visual-effects.md`, `zoom-transitions.md`. |
| `expo-ui-swift-ui` | **Skill text is SDK 55.** Installed `@expo/ui` 57.0.12 types and Expo SDK 57 docs are the API authority. |
| `expo-ui-jetpack-compose` | **Skill text is SDK 55.** Installed Compose `.d.ts` files are the API authority. |
| `native-data-fetching` | Product Hub continues to use existing TanStack Query repositories. No ad-hoc `fetch()` in the screen. |
| `expo-dev-client` | Native evidence uses the development client / `expo run:ios`, not Expo Go. |

SDK 57 docs actually fetched: `https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/` (`GlassView`, `GlassContainer`, `isLiquidGlassAvailable`, `isGlassEffectAPIAvailable`, Reduce Transparency note).

## Installed SDK inspection

Resolved from `package.json` + `pnpm install --frozen-lockfile` on this worktree:

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
| expo-blur | `57.0.2` |
| expo-glass-effect | `57.0.1` |

### Expo Router 57 types actually present

Inspected in `node_modules/expo-router/build/layouts/stack-utils/StackSearchBar.d.ts`:

- `Stack.SearchBar` **automatically makes the header visible**
- `Stack.Toolbar.SearchBarSlot` is the iOS 26+ bottom-toolbar search presentation
- `Link.AppleZoom` / `Link.AppleZoomTarget` remain available

### `expo-glass-effect` 57.0.1

- `GlassView` (`clear` \| `regular` \| `none`), `isInteractive`, `colorScheme`, `tintColor`
- `GlassContainer`
- `isLiquidGlassAvailable` / `isGlassEffectAPIAvailable`

Product screens remain forbidden from importing `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose` directly. Chrome uses `LiquidGlassChrome`.
