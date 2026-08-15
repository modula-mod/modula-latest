# CURRENT MODULA UI INVENTORY

Date: 2026-08-15  
Phase: **7M-A only** (research + constitution + agent skill)  
Accepted production runtime SHA at inventory: `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a`  
Source of versions: installed `package.json` / resolved `node_modules`, not latest-docs guesses.

**The Phase 7M UI System Research and Agent Skill Pack is the reference baseline. Do not blindly implement every proposed dependency or API. No broad product-screen redesign is authorised during 7M-A.**

This inventory exists to prevent a second design system beside the one Modula already has. We enhance what exists.

## Installed stack (resolved)

| Package | Declared | Resolved |
| --- | --- | --- |
| Expo SDK | `~57.0.12` | `57.0.12` |
| React Native | `0.86.2` | `0.86.2` |
| React | `19.2.3` | `19.2.3` |
| React Native Web | `~0.21.0` | `0.21.2` |
| Expo Router | `~57.0.12` | `57.0.12` |
| `@expo/ui` | `~57.0.10` | `57.0.10` |
| Reanimated | `4.5.1` | `4.5.1` |
| Gesture Handler | `~2.32.0` | `2.32.0` |
| Skia | `2.6.2` | installed |
| expo-image | `~57.0.2` | `57.0.2` |
| expo-video | `~57.0.2` | `57.0.2` |
| expo-blur | `~57.0.2` | `57.0.2` |
| expo-glass-effect | `~57.0.1` | `57.0.1` |
| `@callstack/liquid-glass` | `^0.8.0` | installed |
| `@react-native-segmented-control/segmented-control` | `2.5.7` | installed |
| react-native-screens | `4.26.2` | `4.26.2` |
| react-native-safe-area-context | `~5.7.0` | `5.7.0` |
| `@expo/vector-icons` | `^15.1.1` | installed (Ionicons via `AppIcon`) |

## `@expo/ui` 57.0.10 inspected surface

Universal (`@expo/ui`): BottomSheet, Button, Checkbox, Collapsible, Column, FieldGroup, Host, Icon, List, ListItem, Picker, Row, ScrollView, Slider, Spacer, Switch, Text, TextInput.

SwiftUI (`@expo/ui/swift-ui`): Alert, BottomSheet, Button, ContextMenu, Form, GlassEffectContainer, Host, List, Menu, Picker, Popover, ProgressView, SecureField, plus layout primitives.

Jetpack (`@expo/ui/jetpack-compose`): AlertDialog, Button, Card, Checkbox, DatePicker, DropdownMenu, FAB, and related Compose hosts.

Community (`@expo/ui/community/*`): bottom-sheet, datetime-picker, masked-view, menu, pager-view, picker, segmented-control, slider.

**Rule:** product screens still must not import these directly. Validate every prop against this installed tree, not SDK 58 / “latest docs”.

## Proposed-by-research packages that are NOT installed

Do not `pnpm add` / `expo install` these during 7M-A. 7M-B may propose one after a written use case + `modula-dependencies` admission:

| Package | Status | 7M stance |
| --- | --- | --- |
| `@shopify/flash-list` | not installed | ADAPT later, per-platform benchmark |
| `react-native-true-sheet` | not installed | ADAPT candidate only after Expo UI sheet acceptance fails |
| `@gorhom/bottom-sheet` | not installed | INSPIRATION_ONLY |
| `@radix-ui/*` | not installed | ADAPT web-only, later |
| Moti | not installed | REJECT initially |
| React Native Paper as runtime | not installed | REJECT |
| Third-party Stories package | not installed | REJECT runtime |

## Existing Modula UI owners

| Area | Location | Disposition |
| --- | --- | --- |
| Theme runtime | `src/theme/runtime/` (`AppearanceProvider`, `ThemeProvider`, `useThemeTokens`) | **KEEP** |
| Surface runtime | `src/theme/contracts/appearance.ts` `SurfaceType`; `src/theme/materials/resolveMaterialTokens.ts`; `src/components/materials/*`; `src/components/primitives/Surface.tsx` | **KEEP** / **REFACTOR** (complete glass/OLED behaviour in 7M-B, do not fork a second Surface type union) |
| Appearance provider | `src/theme/runtime/AppearanceProvider.tsx` | **KEEP** |
| Platform adapters | `src/platform/ui/*` (buttons, controls, sheets, menus, navigation, motion, keyboard, camera) | **KEEP** / **CONSOLIDATE** (this is the semantic UI layer; do not create `packages/ui`) |
| Icon systems | `src/components/primitives/AppIcon.tsx` (Ionicons / `@expo/vector-icons`) | **REFACTOR** toward semantic `ModulaIcon` adapters in 7M-B; inventory names first |
| Text fields | `src/platform/ui/controls/modula-text-input.tsx`, `modula-secure-input.tsx`; `src/auth/screens/AuthScreenPrimitives.tsx` | **CONSOLIDATE** |
| Buttons | `src/platform/ui/buttons/modula-button.tsx`, `AppButton.tsx`, `IconButton.tsx` | **CONSOLIDATE** |
| Sheets | `src/platform/ui/sheets/modula-sheet.{native,web}.tsx` | **KEEP** / **ADAPT** |
| Drawers | `src/platform/ui/navigation/adaptive-account-panel.tsx`, `src/shell/DrawerItem.tsx` | **KEEP** / **REFACTOR** |
| Menus | `src/platform/ui/menus/*` (`ModulaMenu`, context menu, overflow) | **KEEP** |
| Segmented controls | `src/platform/ui/controls/modula-segmented-picker.tsx` + community segmented-control dep | **KEEP** / **ADAPT** |
| Navigation | Expo Router + `src/platform/ui/navigation/platform-tabs.*` | **KEEP** |
| Post components | `src/features/social/components/social-post.tsx`, `FeedPostRow.tsx` | **KEEP** (product-owned; 7M-C after visual approval) |
| Story components | `src/features/presence/components/PresenceStoriesRail.tsx`, `StoryViewerScreen.tsx` | **KEEP** |
| Profile components | `src/features/profile/screens/*`, `ProfileHero.tsx`, `FocusHalo.tsx` | **KEEP** |
| Product Hub components | `src/features/modules/components/ModuleCatalogueCard.tsx`, `ModuleStatusPill.tsx` | **KEEP** |
| Module Host | `src/features/modules/runtime/module-host.tsx` | **KEEP** |
| UI Lab seed | `src/platform/ui/dev/expo-ui-lab/` | **KEEP** / **REFACTOR** into dedicated Modula UI Lab in **7M-B** |
| Duplicate primitives | `AppButton` vs `ModulaButton`; `Avatar.tsx` vs `AppAvatar.tsx`; `Divider` vs `AppDivider`; `EmptyState` vs `AppEmptyState` | **CONSOLIDATE** |

## KEEP / REFACTOR / CONSOLIDATE / REPLACE / REMOVE

| Decision | Meaning in 7M |
| --- | --- |
| KEEP | Canonical. Extend in place. |
| REFACTOR | Same module, stricter contract / Surface / a11y / Reduce Motion. |
| CONSOLIDATE | Multiple implementations → one public contract. Delete the extra export after migration. |
| REPLACE | Only after UI Lab + visual approval. Functionality frozen underneath. |
| REMOVE | Dead parallel API or decorative wrapper with no product job. |

**7M-A authorises none of REFACTOR/CONSOLIDATE/REPLACE/REMOVE in production screens.** This table is the plan, not a license to rewrite.

## Parallel-system prohibition

Do **not** create `packages/ui` during 7M-A (or 7M-B unless inventory still shows no owner). Canonical homes:

- Tokens / Surface / Appearance → `src/theme/`
- Semantic adapters → `src/platform/ui/`
- Shared presentational primitives → `src/components/primitives/`
- Product composition → `src/features/*`

Screens import Modula adapters. Adapters may use `@expo/ui`. Screens never import `@expo/ui/swift-ui` or a third-party sheet library.
