# Phase 7I-MAC-A — Expo UI Inventory

Date: 2026-08-10  
Branch: `phase7i-mac-native-ui-acceptance`  
Installed: Expo SDK 57 / `@expo/ui@57.0.9` / RN `0.86.2`

Boundary rule (unchanged):

```text
feature code → Modula platform adapter (`src/platform/ui/...`) → Expo UI
```

Do not import `@expo/ui/swift-ui` from feature screens.

## Adapter inventory

| Feature / control | Current implementation | Expo UI equivalent? | Safe to adopt? | Native-only? | Requires Host? | Overlay / sticky limitation? | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home Following / For You / Modules (inline) | `ModulaSegmentedPicker` `appearance="segmented"` → `@expo/ui/community/segmented-control` (`modula-segmented-picker.native.tsx`) | Yes (community SegmentedControl / SwiftUI Picker) | Yes (already) | iOS native path; shared RN fallback | Community control (not sticky Host) | Prefer not Host inside sticky overlays | Keep; verify visual density on device |
| Home modes sticky clone | `ModulaSegmentedPicker` `appearance="track"` + `embedded` inside `LiquidGlassChrome` (`HomeStickyFeedModes.tsx`) | Segmented Host historically brittle here | **No Host** | Shared RN intentional | Avoid Host | **Yes — known bad location** | Keep CUSTOM_TRACK / GLASS_EMBEDDED |
| Appearance Dim/Dark/OLED | `ModulaSegmentedPicker` segmented | Yes | Yes | Native | Via adapter | No | Keep |
| Activity filters | `ModulaSegmentedPicker` + overflow menu | Yes | Yes | Native | Via adapter | Header overflow uses Menu Host | Keep |
| Buttons (auth CTAs, module install) | `ModulaButton` / `AppButton` → `@expo/ui` Button + Host | Yes | Yes for forms/actions | Native | Yes on native | Avoid in absolute chrome | Prefer for forms; keep branded surfaces custom |
| Icon / title icon buttons | `ModulaIconButton`, `ModulaTitleIconButton` | Yes | Yes in headers | Native | Yes | Header OK if measured | Keep adapters |
| Context menus (posts) | `ModulaContextMenu` → SwiftUI ContextMenu + Host | Yes | Yes | Native | Yes | Prefer native over custom floating rects | Expand usage for three-dot menus |
| Overflow / chrome menus | `ChromeOverflowMenu`, `ChromeIconMenu`, `ModulaMenu` | Yes | Yes | Native | Yes | Header OK | Prefer for filters/settings overflow |
| Confirmation dialogs | `modula-confirmation-dialog` / `confirmModulaAction` | Yes (alerts) | Yes | Mixed | Varies | N/A | Prefer system confirms |
| Sheets | `ModulaSheet` → `@expo/ui` BottomSheet | Yes | Selective | Native | Frame modifiers | Complex product sheets may stay custom | Use for simple sheets |
| Switch / checkbox / progress / list / text input | `modula-switch`, `modula-checkbox`, `modula-progress`, `modula-list`, `modula-text-input` | Yes | Yes for Settings | Native | Host for several | Settings lists good Host candidates | Prefer in Settings/Account |
| Liquid glass tab bar | `@callstack/liquid-glass` via `modula-liquid-glass-tab-bar.tsx` (+ BlurView fallback) | Expo glass-effect exists but Callstack is current product path | Do not replace casually | Native binary | N/A | Shell chrome — no Expo UI Host | Keep; preserve `bottom: 0` + internal safe-area pad |
| Progressive blur header / bands | `ProgressiveBlurBand`, `ShellBottomProgressiveBlur` (distinct) | Partial (expo-blur) | Custom remains | Native blur | No | Bottom wash ≠ tab geometry | Do not reintroduce full-width BlurView under tab bar |
| Masked view | `@expo/ui/community/masked-view` | Yes | Yes | Native | No | — | Keep |
| Expo UI Lab (Developer) | Direct `@expo/ui/swift-ui` under `src/platform/ui/dev/expo-ui-lab/` | N/A (lab) | Lab-only | Native | Yes | Lab only | Allowed in platform/dev only |

## Feature-screen direct import scan

`rg` for `@expo/ui` under `src/features` / `src/app` (excluding platform adapters): **none required for product** — adapters own native imports. Lab routes under settings/developer remain platform-owned.

## Segmented control program (classification)

| Surface | Classification |
| --- | --- |
| Home Following / For You / Modules (inline) | `NATIVE_EXPO_UI` |
| Home sticky modes | `GLASS_EMBEDDED` / `CUSTOM_TRACK` |
| Appearance dark-depth Dim/Dark/OLED | `NATIVE_EXPO_UI` |
| Activity All / Mentions / Modules style filters | `NATIVE_EXPO_UI` (+ menu) |
| Discover / Marketplace filter chips (where scrollable) | `SCROLLABLE_CHIPS` (do not force UISegmentedControl) |
| Profile tabs (if multi-section) | Audit per screen — prefer native when ≤4 fixed options |

## Menu program

| Surface | Status |
| --- | --- |
| Post three-dot | Adapter `ModulaContextMenu` / `ModulaMenu` — keep expanding |
| Activity filter | `ChromeOverflowMenu` |
| Composer tools | Custom drawer (`ComposerToolsDrawer`) — richer than menu; keep sheet/drawer |
| Settings overflow | Prefer chrome menu adapters |

## Button program

| Surface | Status |
| --- | --- |
| Auth CTAs | Already `ModulaButton` |
| Module install sheet | `ModulaButton` |
| Branding / hero CTAs | Keep custom where brand is the surface |
| Tab bar Create | Custom glass disc — do not replace with system Button |

## Host exclusion zones (do not place Host without geometry proof)

- Absolute sticky Home mode overlay
- Animated floating shell tab bar
- Complex z-index progressive-blur stacks
- Stories dial overlay chrome

## Next adoption priorities (after tunnel + signed-in audit)

1. Settings rows → `ModulaList` / Switch / DisclosureGroup more consistently  
2. Remaining custom three-dot rectangles → context menu adapters  
3. Appearance Surface Type selectors → native pickers where ≤ small fixed sets  
4. Leave Home sticky modes on shared track
