# Modula Component Contracts

Public contracts for 7M. **7M-A does not implement these.** 7M-B implements primitives in UI Lab by consolidating existing adapters.

Decision vocabulary (research pack): `USE_DIRECTLY` | `ADAPT` | `INSPIRATION_ONLY` | `REJECT`.

`USE_DIRECTLY` means a suitable **substrate**, not leaking that library’s visual defaults into Modula.

## Canonical home

Do not create `packages/ui` while `src/platform/ui` already exports ModulaButton, ModulaTextInput, ModulaSheet, ModulaSwitch, ModulaSegmentedPicker, ModulaMenu, and related adapters.

New public names may be aliases of those modules. Duplicate folders are a P0 process failure.

## P0 contracts

| Component | Decision | Existing owner | Notes |
| --- | --- | --- | --- |
| Surface | ADAPT | `src/components/primitives/Surface.tsx` + materials | Resolver-owned |
| ModulaIcon | ADAPT | `AppIcon.tsx` (Ionicons) | Three-adapter: SF / Material / SVG. Expo UI Icon does **not** render on web in 57.0.10 |
| ModulaButton | ADAPT | `platform/ui/buttons` + `AppButton` | CONSOLIDATE |
| ModulaTextField | ADAPT | `modula-text-input` + auth primitives | Label / support / error / keyboard / autofill |
| ModulaSecureField | ADAPT | `modula-secure-input` | Password manager, show/hide |
| ModulaOTPField | INSPIRATION_ONLY | none dedicated | Composite over native text input |
| ModulaSegmentedControl | ADAPT | `modula-segmented-picker` | Native picker mobile; accessible web |
| ModulaSwitch | USE_DIRECTLY | `modula-switch` | Expo UI Switch behind wrapper |
| ModulaSheet | ADAPT | `platform/ui/sheets` | Accept installed Expo UI sheet before any TrueSheet install |
| ModulaDialog | ADAPT | `modula-confirmation-dialog` | Focus trap on web |
| ModulaDrawer | ADAPT | account panel / shell | RNGH + Reanimated; Expo Router owns routes |
| ModulaBottomNav | ADAPT | `platform-tabs` | |
| Avatar | ADAPT | `AppAvatar` / `Avatar` / profile avatars | CONSOLIDATE; expo-image |
| StoryViewer | INSPIRATION_ONLY | `StoryViewerScreen` | Own state machine; expo-image + expo-video |
| PostCard | INSPIRATION_ONLY | `social-post` / `FeedPostRow` | Not a generic Card |
| ModuleCard | INSPIRATION_ONLY | `ModuleCatalogueCard` | Canonical installability projection from 7L |
| Media | USE_DIRECTLY | `AppImage` + expo-video adapters | |
| FeedList | ADAPT | existing lists | FlatList until FlashList admitted |

## P1 contracts

ModulaContextMenu, ModulaPopover, StoryRing, ReactionPicker, CommentThread, SettingsRow, HapticFeedback — extend existing menus / reaction-control / SettingsRows. No new libraries in 7M-A.

## REJECT (runtime)

Generic React Native Paper theme, SwiftUIX as a dependency, Moti, third-party Stories packages, VisionCamera for 7M core.

## Provenance (required for every major novel component from 7M-B)

```yaml
component: ModulaSheet
decision: ADAPT
references:
  - source: Expo UI
    exact_version: 57.0.10
    file_or_api: '@expo/ui build/universal/BottomSheet (inspected)'
  - source: existing Modula
    file: src/platform/ui/sheets/modula-sheet.native.tsx
reason:
  - native detents
  - keyboard behaviour
  - accessibility
modula_changes:
  - Surface Runtime integration
  - universal contract
  - web adapter
  - Reduce Motion
verified:
  ios: false
  android: false
  web: false
```

If an agent cannot answer “why does this drawer exist?”, the component is not allowed.

## Functionality freeze (7M-C)

A redesign cannot turn working profile edit / session restore / Settings APIs into a prettier screen that does not save. That is an automatic P0/P1 failure.
