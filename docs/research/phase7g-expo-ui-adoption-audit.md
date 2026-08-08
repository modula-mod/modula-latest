# Phase 7G Expo UI Adoption Audit

Date: 2026-08-08
Skill used: Expo UI guidance for SDK 57.

## Pinned Versions

Observed commands:

- `pnpm exec expo-doctor`
- `pnpm exec expo config --type public`
- `node /root/.agents/skills/expo-ui/scripts/list-components.js /home/andrei/modula-latest --docs`

| Package / tool | Observed |
| --- | --- |
| Expo SDK config | `57.0.0` |
| `expo` | `~57.0.8` installed; Doctor expects `~57.0.11` |
| `expo-router` | `~57.0.8` |
| `react-native` | `0.86.0`; Doctor expects `0.86.2` |
| `@expo/ui` | `57.0.7`; Doctor expects `~57.0.9` |
| `expo-glass-effect` | `~57.0.1` |
| Duplicate native module issue | `expo-web-browser@57.0.2` top-level and `expo-web-browser@15.0.11` via `@atproto/oauth-client-expo@0.1.8` |

Doctor result: 15/20 checks passed. Do not upgrade during Phase 7G audit; classify for backlog.

Universal Expo UI components available at `@expo/ui@57.0.7`:

`BottomSheet`, `Button`, `Checkbox`, `Collapsible`, `Column`, `FieldGroup`, `Host`, `Icon`, `List`, `ListItem`, `Picker`, `RNHostView`, `Row`, `ScrollView`, `Slider`, `Spacer`, `Switch`, `Text`, `TextInput`.

## Component Recommendations

| Control type | Current implementation | Expo UI alternative | Pinned support | Benefit | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Button | `ModulaButton`, `AppPressable`, `AppButton` | Universal `Button` inside platform adapter | yes | native semantics for primary forms | too heavy for feed cards | keep adapter; migrate auth/settings CTAs only |
| Switch | `SystemSwitch`, `ModulaSwitch` | Universal `Switch` | yes | native accessibility and semantics | adapter drift | standardize all Settings switches through adapter |
| Checkbox | `ModulaCheckbox`/pressables | Universal `Checkbox` | yes | native terms/privacy control | web parity | keep adapter and migrate scattered checkboxes |
| TextInput | RN TextInput and `ModulaTextInput` | Universal `TextInput` | yes | native form semantics | sizing and autofill regressions | use adapter for auth/settings; keep feed/composer dense RN until proven |
| SecureField | `ModulaSecureInput` / RN secure | Universal secure TextInput or SwiftUI SecureField inside adapter | partial | better auth field semantics | platform-specific split | adapter-only, no feature direct import |
| Picker | custom sheets/pills | Universal `Picker` | yes | native option control | visual mismatch in dense surfaces | use for settings forms, not feed filters |
| SegmentedControl | `ModulaSegmentedPicker` plus custom pills | community segmented control via adapter | yes | native selected state | Host in sticky overlays | canonicalize adapter; shared fallback for sticky/glass |
| List/ListItem | custom `SettingsRows` | Universal `List`, `ListItem`, `FieldGroup` | yes | native settings list semantics | broad migration risk | P1/P2 gradual settings migration |
| FieldGroup/Form | custom sections | Universal `FieldGroup`; SwiftUI Form only in platform adapter | partial | grouped settings consistency | over-native styling can fight Modula surfaces | use FieldGroup for settings groups |
| BottomSheet | `ModulaSheet`, selection sheet, drawer variants | Universal `BottomSheet` | yes | reduce duplicate sheet behavior | route modal differences | consolidate composer/settings sheets |
| Menu/ContextMenu | platform adapters | SwiftUI Menu/ContextMenu inside adapter | platform-specific | native menu semantics | Android/web fallback | keep adapter, no feature direct imports |
| ConfirmationDialog/Alert | `confirmModulaAction`, `Alert.alert` | SwiftUI ConfirmationDialog/Alert via adapter | partial | destructive action semantics | web/native divergence | add adapter later for destructive module/story actions |
| ProgressView | custom loading/skeletons | SwiftUI/adapter progress | partial | install/upload semantics | overuse | use for module install/story upload only |

## Surfaces That Should Not Be Replaced By Expo UI

Do not replace these simply because Expo UI exists:

- `SocialPost` / feed cards
- `PresenceStoriesRail` / story rings
- `ProfileHeader` and profile content tabs
- media viewer and full-screen reels layouts
- generic module view renderer

These are product presentation components and need Modula-specific layout, token, and module inheritance behavior.

## Segmented Control Inventory

| Surface | Current path | Current status | Recommendation |
| --- | --- | --- | --- |
| Home Following / For You / Modules | `HomeFeedScreen`, `HomeStickyFeedModes` | inline uses `ModulaSegmentedPicker`; sticky fallback exists | keep one adapter; fix conditional hook |
| Activity filters | `src/features/activity/screens/ActivityScreen.tsx` | adapter-backed in Phase 7F-B | keep |
| Product Hub Discover / Installed / Updates | module/product screens | adapter-backed | keep |
| Appearance System / Light / Dark / OLED | `AppearanceScreen` | custom cards plus segments | keep cards for mode previews; use adapter for compact mutually-exclusive choices |
| Discover categories | `Pill` horizontal list | custom pills | consider adapter only if labels fit; current category list is scrollable and okay as chips |

## Adoption Verdict

Use Expo UI for native controls and settings/form semantics, not for broad product presentation. The immediate P1 is not adopting more Expo UI; it is fixing the existing native segmented adapter lint bug and preventing feature code from importing platform-specific Expo UI directly.
