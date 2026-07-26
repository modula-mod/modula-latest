# Phase 7C Expo Native Baseline

Date: 2026-07-26
Branch: `phase7c-modula-product-realisation`

## Version Commands

- `node -p "require('./package.json').dependencies?.expo"` -> `~57.0.8`
- `node -p "require('./package.json').dependencies?.['expo-router']"` -> `~57.0.8`
- `node -p "require('./package.json').dependencies?.['@expo/ui']"` -> `~57.0.7`
- `node -p "require('./package.json').dependencies?.['react-native']"` -> `0.86.0`
- `pnpm why expo` -> one installed version, `expo@57.0.8`
- `pnpm why expo-router` -> one installed version, `expo-router@57.0.8`
- `pnpm why @expo/ui` -> one installed version, `@expo/ui@57.0.7`

## SDK Reality

The prompt references SDK 55 constraints, but the checked-out repository is SDK 57:

- Expo SDK: 57
- Expo Router: 57.0.8
- `@expo/ui`: 57.0.7
- React Native: 0.86.0

SDK 57 means:

- use SDK 57 installed types and package APIs before copying older examples
- `@expo/ui` universal components are available
- platform-specific SwiftUI/Jetpack Compose trees still require `Host`
- feature code must not import `@expo/ui/swift-ui` directly
- native behavior still requires a development build for linked native dependencies and custom native modules

## Installed `@expo/ui` Surface

Command:

- `node /root/.agents/skills/expo-ui/scripts/list-components.js /home/andrei/modula-latest --docs`

Observed:

- Universal package root components include `Host`, `Button`, `Switch`, `Picker`, `Slider`, `TextInput`, `List`, `FieldGroup`, `BottomSheet`, `Collapsible`, layout primitives, and text/icon primitives.
- iOS SwiftUI package includes `Form`, `Section`, `List`, `Menu`, `ContextMenu`, `ConfirmationDialog`, `DatePicker`, `Picker`, `Slider`, `Toggle`, `TextField`, `SecureField`, `ProgressView`, `GlassEffectContainer`, `RNHostView`, accessibility modifiers, and dynamic type modifiers.
- Android Jetpack Compose package includes `NavigationBar`, `SearchBar`, `DockedSearchBar`, `ModalBottomSheet`, `SegmentedButton`, `Switch`, `Slider`, `DatePicker`, `LazyColumn`, `Snackbar`, `Tooltip`, and semantic/testID modifiers.

## Native Tabs Support

Current code:

- `src/app/(tabs)/_layout.tsx` renders `PlatformTabs`.
- Native implementation: `src/platform/ui/navigation/platform-tabs.native.tsx`.
- Web implementation: `src/platform/ui/navigation/platform-tabs.web.tsx`.
- Tab definitions: `src/platform/ui/navigation/modula-tabs.ts`.

Current native strategy:

- If `@callstack/liquid-glass` native module is linked and available, `PlatformTabs` renders Expo Router `Tabs` with the actual visible bar hidden; root-level `PersistentShellTabBar` owns the visible custom shell chrome.
- If liquid glass is unavailable, `PlatformTabs` falls back to `expo-router/unstable-native-tabs`.
- `Create` exists as a hidden route.

SDK 57 Native Tabs API observed in guidance:

- import from `expo-router/unstable-native-tabs`
- use `NativeTabs.Trigger`
- use compound child APIs such as `NativeTabs.Trigger.Label` and `NativeTabs.Trigger.Icon`
- static tab triggers are preferred to avoid remounting and state loss

## Current Root Chrome

Mounted in `src/app/_layout.tsx`:

- `NavigationDrawer`
- `ShellBottomProgressiveBlur`
- `PersistentShellTabBar`
- `ModulaSplashOverlay`
- `NetworkStatusBanner`

Provider order includes:

- `AppServicesProvider`
- `QueryRuntimeProvider`
- `SessionProvider`
- `AppearanceProvider`
- `ProductPreferencesProvider`
- `ProfilePresentationProvider`
- `AccountPanelProvider`
- `ShellDrawerProvider`

## Current Custom Shell Constraints

- Routes stay under `src/app`; logic lives under `src/features`, `src/platform`, `src/components`, `src/theme`, and repositories.
- Native platform UI adapters live under `src/platform/ui/**`.
- Direct `@expo/ui/swift-ui` imports are currently contained under `src/platform/ui/**`, including the developer Expo UI lab and native adapters.
- `Host` trees are already known to be dangerous inside absolute overlays or full-width flex rows unless the adapter controls sizing.
- Web uses a custom rail/bottom-bar fallback and must not depend on Native Tabs.

## Native Development-Build Requirement

The app contains linked native dependencies and native project folders:

- `@expo/ui`
- `@callstack/liquid-glass`
- `expo-glass-effect`
- `expo-camera`
- `expo-image-picker`
- `expo-video`
- `expo-secure-store`
- `ios/`
- `android/`

Phase 7C native acceptance requires a development build or EAS internal build. A web export does not validate SwiftUI/Compose/native tab/liquid-glass behavior.

## Web Fallback Strategy

Current fallback:

- `src/platform/ui/navigation/platform-tabs.web.tsx` renders Expo Router JS `Tabs` with a custom adaptive rail or bottom bar.
- Web rail is driven by the same `MODULA_TABS` source.
- Product shortcuts appear in the rail on wide screens.

Required Phase 7C adjustment:

- Root destinations must become Home, Discover, Create, Activity, Profile.
- Board, Product Hub, Saved, and Settings should move to drawer/profile menu/route toolbar rather than permanent bottom tabs.

## Existing Native Adapters

Relevant adapter families:

- `src/platform/ui/buttons/`
- `src/platform/ui/controls/`
- `src/platform/ui/menus/`
- `src/platform/ui/sheets/`
- `src/platform/ui/materials/`
- `src/platform/ui/navigation/`
- `src/platform/ui/keyboard/`
- `src/platform/ui/camera/`
- `src/platform/ui/refresh/`
- `src/platform/ui/skeletons/`

Policy:

- Feature code imports Modula wrappers, not platform-specific SwiftUI/Compose packages.
- Platform-specific trees stay outside route files.
- `Host` ownership stays inside the adapter file.
