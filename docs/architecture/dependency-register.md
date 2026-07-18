# Dependency Register

Every future direct dependency must be added to this register.
No package should enter the project merely because an example repository uses it.

| Package | Version | Purpose | Native code | New Architecture verified | Licence | Evidence | Added in |
|---|---:|---|---|---|---|---|---|
| @node-rs/argon2 | ^2.0.2 | Server-side Argon2id password hashing for sovereign accounts | No (Node native binding) | N/A (backend only) | MIT | node-rs maintained package; required for Phase 6R password credentials | Phase 6R |
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

## Phase 4.5 expandable liquid-glass tab bar (user-authorized)

Owner permission: Modula product owner spoke with [iamitkhatkar](https://github.com/iamitkhatkar) and authorized integrating the expandable liquid-glass tab pattern from [rn-expandable-tab-liquid-glass](https://github.com/iamitkhatkar/rn-expandable-tab-liquid-glass). That repo is a **demo app, not an npm package** — Modula vendors an adapted adapter under `src/platform/ui/navigation/modula-liquid-glass-tab-bar.tsx` (attribution retained). This directive overrides the earlier Phase 4.5 “NativeTabs-only / no third-party tab bar” rule for this specific integration.

| Package | Version | Purpose | Native | Notes | Evidence | Added in |
|---|---:|---|---|---|---|---|
| @callstack/liquid-glass | 0.8.0 | iOS liquid glass views for expandable tab chrome | Yes | Requires compatible iOS/Xcode liquid-glass runtime; falls back to solid/raised surface when unsupported or Reduce Transparency | `pnpm add @callstack/liquid-glass` | Phase 4.5 |
| react-native-reanimated | 4.5.0 | Expand / plus-button motion from authorized tab pattern | Yes | Re-admitted **only** for this tab-bar adapter; Expo SDK 57 matrix | `pnpm exec expo install react-native-reanimated` | Phase 4.5 |
| react-native-worklets | 0.10.0 | Peer for Reanimated 4 | Yes | Expo SDK 57 matrix | `pnpm exec expo install react-native-worklets` | Phase 4.5 |
| @react-native-segmented-control/segmented-control | 2.5.7 | Installed for Expo parity with upstream demo peers; Modula adapter uses AppIcon tab hits (SF Symbol fork not required) | Yes | Expo SDK 57 | `pnpm exec expo install @react-native-segmented-control/segmented-control` | Phase 4.5 |
| react-native-svg | 15.15.4 | Peer commonly required by icon tooling / Expo matrix | Yes | Expo SDK 57 | `pnpm exec expo install react-native-svg` | Phase 4.5 |

Attribution: tab interaction pattern adapted from iamitkhatkar/rn-expandable-tab-liquid-glass (MIT / project licence as published upstream).

### Liquid glass tabs — native rebuild required

`@callstack/liquid-glass` links `NativeLiquidGlassModule`. A **static import crashes Expo Go** (and any binary without pods) because `TurboModuleRegistry.getEnforcing` runs at module load.

Modula gates with `TurboModuleRegistry.get('NativeLiquidGlassModule')` (non-enforcing) + Expo Go detection in `src/platform/ui/navigation/liquid-glass-availability.ts`. When missing, `platform-tabs.native.tsx` falls back to Expo Router `NativeTabs`.

For the expandable liquid-glass tab bar:

```bash
cd ios && pod install && cd ..
pnpm exec expo run:ios
```

Expo Go always uses the NativeTabs fallback. Do not expect liquid glass chrome inside Expo Go.

## Phase 4.5 UI polish — library decisions (no new packages)

Research: `docs/research/phase4-5-third-party-ui-libs.md`.

| Candidate | Decision | Notes |
|---|---|---|
| `@outpacelabs/avatars` | Not installed | Generative web canvas gradients; wrong API for stacked/story/presence. Modula `src/platform/ui/avatars/` instead. |
| Solarin-Johnson/my-app | Ideas only | Not a package; Reanimated playground — do not vendor. |
| rit3zh/expo-curved-bottom-tabs | Not installed | Demo + Skia + Reanimated; would fight primary liquid-glass tabs. Modula `ModulaCurvedSectionTabs` for Marketplace nested chrome only. |
| rit3zh/expo-motion-tabs | Not installed | Demo bottom-tab morph popups + Reanimated; wrong for Profile content tabs. Modula `ModulaMotionTabs` (LayoutAnimation). |

No new rows in the dependency table — zero packages added for this polish pass.

## Phase 6 AT Protocol frontend

| Package | Version | Purpose | Native | Storage/security role | Evidence | Added in |
|---|---:|---|---|---|---|---|
| @atproto/oauth-client-expo | 0.1.8 | Official AT Protocol OAuth client for Expo (native crypto / redirect scheme). Modula keeps provider tokens server-side. | Yes | Must not store AT access/refresh tokens in AsyncStorage; pending OAuth state only in SecureStore | `pnpm add -w @atproto/oauth-client-expo@0.1.8` | Phase 6 |
| @modula/api-contracts | workspace:* | Shared API DTO types for metadata, AT connections, Atmosphere, preferences | No | Types only | `pnpm add -w @modula/api-contracts@workspace:*` | Phase 6 |

Removal path: disconnect AT UI + drop `@atproto/oauth-client-expo` when AT OAuth is retired; contracts remain for backend.

## Phase 6S — video foundation + Appearance Advanced living backdrop

| Package | Version | Purpose | Native | Development-client rebuild required | Evidence | Added in |
|---|---:|---|---|---|---|---|
| expo-video | ~57.0.1 | Reels / short-media playback foundation (`ModulaReelPlayer`) | Yes | Yes | `pnpm exec expo install` / `pnpm add -w` (workspace root) | Phase 6S |
| expo-camera | ~57.0.3 | Appearance → Advanced camera masked-blur Preview (Motionary-style cutouts) | Yes | Yes | `pnpm exec expo install` / `pnpm add -w` (workspace root) | Phase 6S |

Patterns (not packages):

- [draggable-video-control](https://github.com/mahdidavoodi7/draggable-video-control) — MIT Motionary drop; Modula reimplements draggable glass controls under `src/platform/ui/video/` (no vendored demo app).
- [expo-camera-masked-blur](https://github.com/mahdidavoodi7/expo-camera-masked-blur) — MIT Motionary drop; Modula reimplements via existing MaskedView adapter + `CameraMaskedBlurSurface` (does **not** add `@react-native-masked-view/masked-view`).

Removal path: drop Advanced toggle + Reels `videoUri` playback, then remove `expo-camera` / `expo-video` and native rebuild.

**Stale binary safety:** JS must not statically import `expo-camera` / `expo-video` from the `@/platform/ui` startup barrel. Availability is probed with `requireOptionalNativeModule('ExpoCamera'|'ExpoVideo')` in `src/platform/ui/native-modules/expo-native-availability.ts`. Without a rebuild, UI shows an honest “native rebuild required” fallback instead of crashing.
