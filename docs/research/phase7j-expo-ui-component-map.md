# Phase 7J — Expo UI component map

Date: 2026-08-11  
Source: installed `@expo/ui` (~57.0.10), Expo UI Lab under `src/platform/ui/dev/expo-ui-lab`, adapters in `src/platform/ui/*`.

Classifications: `AVAILABLE` | `AVAILABLE_IOS` | `AVAILABLE_ANDROID` | `BETA` | `NOT_AVAILABLE` | `KEEP_CUSTOM`

| Component / role | Classification | Modula surface | Notes |
|---|---|---|---|
| Button | AVAILABLE | `ModulaButton` / `AppButton` | Lab: ButtonsSection |
| Icon button | AVAILABLE | `ModulaIconButton` / `IconButton` | |
| Switch | AVAILABLE_IOS / AVAILABLE | `ModulaSwitch` / SystemSwitch | Native iOS path preferred |
| Checkbox | AVAILABLE | `ModulaCheckbox` | |
| Text field | AVAILABLE | `ModulaTextInput` / AuthField | Secure/email/search/OTP variants KEEP_CUSTOM wrappers |
| Secure field | AVAILABLE | `ModulaSecureInput` | |
| Segmented control | AVAILABLE_IOS | `ModulaSegmentedPicker` | Home sticky feed modes |
| Context menu | AVAILABLE_IOS | `ModulaContextMenu` | Lab ContextMenuSection |
| Sheet / bottom sheet | AVAILABLE | `ModulaSheet` | native + web |
| Confirmation dialog | AVAILABLE | `ModulaConfirmationDialog` | |
| Disclosure group | AVAILABLE_IOS | `ModulaDisclosureGroup` | |
| Control group | AVAILABLE | `ModulaControlGroup` | |
| List / list item | AVAILABLE | `ModulaList` / `ModulaListItem` | |
| Progress | AVAILABLE | `ModulaProgress` | |
| Date/time | AVAILABLE_IOS | Lab DateTimeSection | Product adoption DEFER |
| Dashboard / charts | BETA | Lab DashboardSection | Not product chrome |
| Profile SwiftUI demos | AVAILABLE_IOS | Lab ProfileSection | KEEP_CUSTOM product Profile |
| Settings form demos | AVAILABLE_IOS | Lab SettingsSection | KEEP_CUSTOM SettingsRows |
| Liquid glass tab bar | AVAILABLE_IOS | `ModulaLiquidGlassTabBar` | Refine; do not opaque-slab |
| Motion tabs | AVAILABLE | `ModulaMotionTabs` | Reduce Motion aware |
| Progressive blur band | KEEP_CUSTOM | `ProgressiveBlurBand` | Accepted Mac pattern |
| Pull-action tray | KEEP_CUSTOM | `pull-action-tray` | |
| Full-screen modal | KEEP_CUSTOM | router presentations | Map to ModulaFullScreenModal later |
| Popover | NOT_AVAILABLE / BETA | — | Prefer sheet/context menu |
| OTP field | KEEP_CUSTOM | AuthField numeric | Product polish remaining |
| Search field | KEEP_CUSTOM | `AppSearchField` | |
| Drawer | KEEP_CUSTOM | `NavigationDrawer` | MotionTokens adopted |
| Surface materials | KEEP_CUSTOM | theme Surface Types | OLED `#000000` |

## Lab entry

Settings → Developer → Expo UI Lab (`/settings/developer/expo-ui`).
