# Dependency Register

Every future direct dependency must be added to this register.
No package should enter the project merely because an example repository uses it.

| Package | Version | Purpose | Native code | New Architecture verified | Licence | Evidence | Added in |
|---|---:|---|---|---|---|---|---|
| @expo/ui | ~57.0.6 | Expo UI primitives (template) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo | ~57.0.6 | Application framework | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-constants | ~57.0.5 | App config / constants access | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-device | ~57.0.1 | Device info (template) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-font | ~57.0.1 | Font loading support | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-glass-effect | ~57.0.1 | Template glass effect module (unused in Phase 0 UI) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-image | ~57.0.1 | Image component (template) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-linking | ~57.0.3 | Deep linking support | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-router | ~57.0.6 | File-based navigation | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-splash-screen | ~57.0.4 | Native splash screen | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-status-bar | ~57.0.1 | Status bar control | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-symbols | ~57.0.1 | SF Symbols helper (template) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-system-ui | ~57.0.1 | System UI styling | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| expo-web-browser | ~57.0.1 | In-app browser (template) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react | 19.2.3 | UI library | No | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-dom | 19.2.3 | React DOM for web | No | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native | 0.86.0 | Native UI runtime | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native-gesture-handler | ~2.32.0 | Gesture system (Expo Router peer) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native-reanimated | 4.5.0 | Animation runtime (Expo Router peer) | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native-safe-area-context | ~5.7.0 | Safe area insets | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native-screens | 4.25.2 | Native navigation screens | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native-web | ~0.21.0 | Web rendering | No | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| react-native-worklets | 0.10.0 | Worklets peer for Reanimated | Yes | Official SDK 57 | See package LICENSE | Official Expo SDK 57 template | Phase 0 |

## Dev dependencies

| Package | Version | Purpose | Native code | New Architecture verified | Licence | Evidence | Added in |
|---|---:|---|---|---|---|---|---|
| @types/react | ~19.2.2 | React TypeScript types | No | N/A | See package LICENSE | Official Expo SDK 57 template | Phase 0 |
| eslint | ^9.39.5 | Linting | No | N/A | See package LICENSE | Phase 0 quality tooling | Phase 0 |
| eslint-config-expo | ~57.0.0 | Expo ESLint flat config | No | N/A | See package LICENSE | Phase 0 quality tooling | Phase 0 |
| expo-doctor | ^1.20.0 | Expo project health checks | No | N/A | See package LICENSE | Phase 0 quality tooling | Phase 0 |
| typescript | ~6.0.3 | TypeScript compiler | No | N/A | See package LICENSE | Official Expo SDK 57 template | Phase 0 |

## Phase 2 appearance runtime additions

| Package | Version | Purpose | Native code | Development-client rebuild required | Expo Go compatibility | Evidence | Added in |
|---|---:|---|---|---|---|---|---|
| @react-native-async-storage/async-storage | 2.2.0 | Persist non-sensitive appearance preferences only | Yes | Yes | Not guaranteed in this dev-client app | `pnpm exec expo install` | Phase 2 |
| @react-native-community/slider | 5.2.0 | Native text-size control | Yes | Yes | Not guaranteed in this dev-client app | `pnpm exec expo install` | Phase 2 |
| expo-blur | ~57.0.2 | Controlled Glass Surface implementation | Yes | Yes | Expo SDK module, isolated behind MaterialSurface | `pnpm exec expo install` | Phase 2 |
| expo-glass-effect | ~57.0.1 | Native iOS 26 Liquid Glass adapter | Yes | Yes | Requires compatible native runtime | `pnpm exec expo install` | Phase 2 |
| expo-linear-gradient | ~57.0.1 | Restrained material highlights and media effects | Yes | Yes | Expo SDK module | `pnpm exec expo install` | Phase 2 |
| expo-system-ui | ~57.0.1 | Synchronise root native background | Yes | Already present; rebuild required when native deps change | Expo SDK module | Existing dependency confirmed by install | Phase 2 |
| expo-navigation-bar | ~57.0.2 | Synchronise Android navigation-button appearance | Yes | Yes | Android native runtime only | `pnpm exec expo install` | Phase 2 |

AsyncStorage policy:

AsyncStorage stores appearance preferences only.

Do not store passwords, session tokens, private keys, wallet data, personal identity documents, authentication state, or other sensitive material in AsyncStorage.

## Phase 4 data and authentication runtime additions

| Package | Version | Purpose | Native | Storage/security role | Evidence | Added in |
|---|---:|---|---|---|---|---|
| @tanstack/react-query | ^5.101.2 | Server-state cache, query orchestration, retries and mutations | No | No token storage | `pnpm add @tanstack/react-query` | Phase 4 |
| expo-secure-store | ~57.0.1 | Native refresh-token storage boundary | Yes | Stores only `modula.session.refresh-token.v1` on native platforms | `pnpm exec expo install expo-secure-store` | Phase 4 |
| expo-network | ~57.0.1 | Central network-state observation for Query online manager | Yes | No personal data | `pnpm exec expo install expo-network` | Phase 4 |

## Phase 4.5 native UI recovery

| Package | Version | Purpose | Native | Storage/security role | Evidence | Added in |
|---|---:|---|---|---|---|---|
| @expo/ui | ~57.0.6 | Native buttons / sheets / menus via Modula platform adapters | Yes | No personal data | `pnpm exec expo install @expo/ui` | Phase 4.5 |
| expo-clipboard | ~57.0.1 | Copy post text / permalink from native overflow menus | Yes | Clipboard only; no Modula persistence | `pnpm exec expo install expo-clipboard` | Phase 4.5 |
