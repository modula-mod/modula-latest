# Phase 7M-B5 — Expo UI integration map

Inspected 2026-08-15 from installed `node_modules/@expo/ui@57.0.10` plus Expo SDK 57 docs (`docs.expo.dev/versions/v57.0.0`).

**Do not upgrade Expo.** Mission forbids an SDK bump. `pnpm exec expo install --check` currently wants patch bumps (expo 57.0.13, `@expo/ui` 57.0.11, etc.). Record as doctor drift. Do not apply.

Stack verified (resolved, never assumed):

| Package | Resolved |
| --- | --- |
| Expo | 57.0.12 |
| React Native | 0.86.2 |
| React | 19.2.3 |
| React Native Web | 0.21.2 |
| Expo Router | 57.0.12 |
| `@expo/ui` | 57.0.10 |
| Reanimated | 4.5.1 |
| Gesture Handler | 2.32.0 |
| expo-image | 57.0.2 |
| expo-video | 57.0.2 |
| expo-blur | 57.0.2 |
| expo-glass-effect | 57.0.1 |
| @shopify/react-native-skia | 2.6.2 |

Expo UI currently supports a **single universal API** over SwiftUI, Jetpack Compose and web for supported controls. Use universal components where they meet requirements. Only use platform-specific SwiftUI/Compose APIs when the universal API does not expose the needed behaviour.

Import policy (unchanged):

| Importer | Allowed |
| --- | --- |
| `src/platform/ui/**` | `@expo/ui`, `@expo/ui/swift-ui`, `@expo/ui/jetpack-compose` |
| Features / screens | Modula adapters only |

---

## Classification legend

| Class | Meaning |
| --- | --- |
| `EXPO_UNIVERSAL` | `@expo/ui` — SwiftUI / Compose / web dispatch |
| `SWIFTUI_NATIVE` | `@expo/ui/swift-ui` — iOS/tvOS only, through adapter |
| `COMPOSE_NATIVE` | `@expo/ui/jetpack-compose` — Android only, through adapter |
| `MODULA_CUSTOM` | Modula composition (Stories, Post row, Hub, reactions, Focus Halo) |
| `WEB_CUSTOM` | Semantic DOM / RN Web / SVG — not a fake SwiftUI port |

---

## Canonical controls

| Control | Class | Adapter today | Notes |
| --- | --- | --- | --- |
| Host | EXPO_UNIVERSAL | platform adapters | Required around native trees |
| Button | EXPO_UNIVERSAL + SWIFTUI_NATIVE styles | `ModulaButton` | Universal for semantics. Glass styles (`buttonStyle('glass'\|'glassProminent')`) are SwiftUI, iOS 26+ / Xcode 26 only |
| Icon | EXPO_UNIVERSAL | `ModulaIcon` / `AppIcon` | **Does not render on web.** Web must stay SVG |
| TextInput | EXPO_UNIVERSAL | `ModulaTextInput` | Autofill via autoComplete mapping |
| SecureField | SWIFTUI_NATIVE | `ModulaSecureInput` / `ModulaSecureField` | Password / new-password |
| Switch | EXPO_UNIVERSAL | `ModulaSwitch` / `SystemSwitch` | |
| Checkbox | EXPO_UNIVERSAL | `ModulaCheckbox` | |
| Picker / segmented | EXPO_UNIVERSAL + SWIFTUI + COMPOSE SegmentedButton | `ModulaSegmentedPicker` | |
| Slider | EXPO_UNIVERSAL | none in product | Lab only |
| BottomSheet | EXPO_UNIVERSAL | `ModulaSheet` | Test before any TrueSheet admission |
| List / ListItem | EXPO_UNIVERSAL | `SystemListRow` | |
| Menu | SWIFTUI_NATIVE | `ModulaMenu` | Glass: `buttonStyle('glass')` on **Menu**, never `glassEffect()` on the label (halo artifact, expo/expo#43953) |
| ContextMenu | SWIFTUI_NATIVE | `ModulaContextMenu` | Long-press; web uses pointer/keyboard menu |
| Alert / ConfirmationDialog | SWIFTUI_NATIVE | `confirmModulaAction` | |
| Popover | SWIFTUI_NATIVE | `ModulaPopover` | Web: `WEB_CUSTOM` |
| DatePicker | SWIFTUI_NATIVE + COMPOSE_NATIVE | none in product | Lab |
| ProgressView | SWIFTUI_NATIVE | Module install stages | No fake % |
| GlassEffectContainer / glassEffect() | SWIFTUI_NATIVE | UI Lab only | See liquid glass policy |
| expo-glass-effect `GlassView` | SWIFTUI-adjacent | forbidden on feed/tab over moving text | Falls back to regular View when unsupported |
| FAB | COMPOSE_NATIVE | none | Android Compose lab; iOS uses toolbar/button |
| SearchBar / DockedSearchBar | COMPOSE_NATIVE | `ModulaSearchField` | Android native search; iOS/web use field adapter |
| NavigationBar | COMPOSE_NATIVE | Expo Router tabs | Android expression of NAV A |
| DropdownMenu | COMPOSE_NATIVE | `ModulaMenu` Android path | |
| ModalBottomSheet | COMPOSE_NATIVE | `ModulaSheet` | |
| FloatingActionButton | COMPOSE_NATIVE | Compose lab | |
| Stories | MODULA_CUSTOM | `PresenceStoriesRail` | Focus Halo |
| Post row | MODULA_CUSTOM | `SocialPost` | Not a card |
| Reaction picker | MODULA_CUSTOM | `ReactionControl` | Gesture on native; menu on web/SR |
| Product Hub editorial | MODULA_CUSTOM | Hub screens | |
| Module artwork | MODULA_CUSTOM | `ModuleArtwork` | Independent of OS accent |
| Composer tools | MODULA_CUSTOM | `ComposerToolsDrawer` | Native sheet + toolbar behaviour |
| Focus Halo | MODULA_CUSTOM | Stories rail | |
| Web menus / hover / focus | WEB_CUSTOM | `presentModulaActions` web | Keyboard, Escape, hover |
| Web glass | WEB_CUSTOM | controlled CSS if used | Never promise pixel-identical Liquid Glass |

---

## Universal vs platform-specific rule

1. If `@expo/ui` universal Button/Switch/Picker/TextInput/Host/List/BottomSheet meets the contract → use it through the existing adapter.
2. If the missing piece is **iOS 26 glass button style**, **Menu dismiss animation**, **ContextMenu**, **SecureField** → SwiftUI path inside the adapter, with opaque fallback.
3. If the missing piece is **FAB, NavigationBar, SearchBar, SegmentedButton, ModalBottomSheet** on Android → Compose path inside the adapter.
4. If the missing piece is **hover, focus rings, Escape, semantic headings** → WEB_CUSTOM.
5. If the missing piece is **Stories / Post / Hub / reaction / Focus Halo** → MODULA_CUSTOM. Never fake these with a generic Expo List.

---

## Liquid Glass API caveats (binding)

- `buttonStyle('glass' | 'glassProminent')` — iOS 26+ when built with Xcode 26.
- Menu: apply glass via `buttonStyle` on the Menu. **Do not** `glassEffect()` the label (rectangular halo on dismiss).
- `expo-glass-effect` falls back to a regular `View` when unsupported. That fallback must already be a usable opaque control.
- A Surface Type called `glass` must still have a safe opaque/material fallback. If the layout collapses when glass is removed, it is invalid.

---

## Android is not an iOS approximation

One semantic Modula contract → iOS native expression / Android native expression / web expression.

Example: `ModulaContextMenu` may render SwiftUI ContextMenu, Compose DropdownMenu, and a web listbox, while exposing the same actions.
