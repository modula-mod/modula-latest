# Modula Visual Constitution

Phase: 7M-A (binding). Implementation of new visuals is **7M-B/C** after this constitution and UI Lab approval.

Reference baseline: Phase 7M UI System Research and Agent Skill Pack. Inspect installed Expo SDK 57 / RN 0.86.2 / `@expo/ui` 57.0.10 before any API claim.

## End goal

Not “an Expo UI app” and not “an Apple-looking app”. A Modula visual system whose low-level interactions feel native while social composition, density, navigation personality, Surface runtime, and product identity remain recognisably Modula.

## Rules

| Rule | Requirement |
| --- | --- |
| Content first, surfaces second | Do not wrap every section in a card. Continuous social content beats nested containers. |
| Native where native is better | Inputs, switches, menus, pickers, sheets, and platform navigation use native semantics where the installed SDK supports the contract. |
| Modula where identity matters | Feed composition, Stories, reactions, Product Hub, Focus Halo, Surface Types, and module presentation stay distinctive. |
| Glass is chrome, not wallpaper | Translucent material is for floating navigation, drawers, sheets, overlays — not behind every content block. |
| High density, not cramped density | Minimise dead space while keeping readable rhythm and usable touch targets. |
| One concept, one canonical component | One segmented control, one sheet contract, one icon registry, one text-field family, one module card contract. |
| State should be obvious without noise | Selected / disabled / loading / error use hierarchy, shape, and text; never colour alone. |
| Motion explains change | Animation communicates relationship, state, and navigation. It does not decorate static content. |
| Reduced Motion is a mode | Every spatial animation has a no/low-motion equivalent via Reanimated `useReducedMotion` / `AccessibilityInfo`. |
| Surface Type changes material, not meaning | Switching glass → solid cannot change hierarchy, routes, action positions, or data. |
| OLED means actual OLED | Canonical OLED canvas is true black where specified; secondary surfaces must not recreate a grey app shell. |
| Platform-native does not mean platform-identical | iOS may use SF Symbols; Android Material Symbols; web SVG. Semantic names stay identical. |
| Accessibility survives customisation | Dynamic Type, VoiceOver/TalkBack, web keyboard, and contrast are hard requirements. |
| No raw engineering UI in customer surfaces | Internal IDs, compatibility enums, and debug state belong under developer/trust details. |
| Prove the primitive before multiplying it | UI Lab across variants before any production screen depends on a new primitive. |
| Enhance what exists | Search `src/platform/ui`, `src/components/primitives`, and `src/theme` before adding a file. |

## Platform policy

| Semantic layer | iOS | Android | Web |
| --- | --- | --- | --- |
| Icons | SF Symbols via `@expo/ui` Icon **after** adapter exists | Material Symbols via Expo UI | Modula-owned SVG set |
| Buttons | `@expo/ui` universal / SwiftUI through Modula adapter | universal / Compose through adapter | semantic button / RN Web |
| Text input | native-backed `@expo/ui` where contract fits | same | RN Web / DOM-backed semantic field |
| Segmented control | SwiftUI Picker / segmented | Compose / Material equivalent | accessible custom / roving selection |
| Switch | native SwiftUI | native Compose | semantic switch |
| Sheet | Expo UI if installed-SDK tests pass; TrueSheet is a **later** fallback candidate | same | responsive modal / bottom-sheet adapter |
| Menus | SwiftUI Menu / ContextMenu | Compose menu | accessible web menu |
| Navigation | Expo Router | Expo Router | Expo Router |
| Feed | FlatList until FlashList is admitted and benchmarked | same | same; no FlashList install in 7M-A |
| Media | expo-image / expo-video | same | same |
| Haptics | expo-haptics | expo-haptics where meaningful | optional / no-op |

## Anti-patterns (automatic review failure)

- A second theme context or a new `packages/ui` tree beside `src/theme` + `src/platform/ui`.
- Product screens importing `@expo/ui/swift-ui`, Gorhom, TrueSheet, Paper, or icon fonts directly.
- Blind SDK upgrade to obtain a UI feature.
- Decorative `BlurView` / GlassEffect on feed cells.
- Inline `withTiming(217)` instead of motion tokens.
- Hardcoded SF Symbol / Material / Ionicons names in feature screens.
- Fake-success UI or hiding a broken control to make a screenshot pass.
- Redesigning a working screen so it no longer saves / restores session / loads sessions.
- Copying Bluesky ALF or `@bsky.app/*` components.

## Sequencing

```text
7M-A  constitution + inventory + skill     ← this document
7M-B  UI Lab + Login + Home + Product Hub  ← visual approval gate
7M-C  full product UI rollout              ← functionality frozen underneath
```
