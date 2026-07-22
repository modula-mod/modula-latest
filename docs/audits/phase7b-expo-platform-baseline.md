# Phase 7B Expo Platform Baseline

Date: 2026-07-21
Branch: `phase7b-greenfield-module-host`

## Commands

- `node -p "require('./package.json').dependencies?.expo || require('./package.json').devDependencies?.expo"` -> `~57.0.7`
- `pnpm why expo` -> one installed version, `expo@57.0.7`
- `pnpm why expo-router` -> one installed version, `expo-router@57.0.7`
- `pnpm why @expo/ui` -> one installed version, `@expo/ui@57.0.7`
- `pnpm exec expo install --check` -> `Dependencies are up to date`

## Installed Versions

| Package | Version |
|---|---:|
| `expo` | `~57.0.7` |
| `expo-router` | `~57.0.7` |
| `@expo/ui` | `~57.0.7` |
| `react-native` | `0.86.0` |
| `react` | `19.2.3` |
| `react-dom` | `19.2.3` |

Expo SDK: 57.

## Documentation Baseline

Use SDK 57 documentation, not examples from another SDK generation.

Sources:

- Expo SDK 57 changelog: https://expo.dev/changelog/sdk-57
- Expo UI overview: https://docs.expo.dev/versions/latest/sdk/ui/
- Expo UI universal Host: https://docs.expo.dev/versions/latest/sdk/ui/universal/host/
- Expo UI universal components: https://docs.expo.dev/versions/latest/sdk/ui/universal/
- Expo UI SwiftUI: https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/
- Expo UI Jetpack Compose: https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/
- Expo Router introduction: https://docs.expo.dev/router/introduction/
- Expo Router SDK reference: https://docs.expo.dev/versions/latest/sdk/router/
- React Native New Architecture in Expo: https://docs.expo.dev/guides/new-architecture/
- Expo GlassEffect: https://docs.expo.dev/versions/latest/sdk/glass-effect/

## New Architecture

Expo SDK 57 uses React Native `0.86.0`. Expo documentation states that SDK 55 and later do not support disabling the New Architecture because the legacy architecture option was removed in React Native 0.82. Expo Go also supports only the New Architecture.

Repository config does not set `newArchEnabled` in `app.config.ts`; under SDK 57 that means the app remains on the New Architecture path.

## Existing Platform Adapters

Feature and product code must not import directly from:

- `@expo/ui/swift-ui`
- `@expo/ui/jetpack-compose`

Allowed boundary:

- `src/platform/ui/**`

Existing adapter families:

- `src/platform/ui/buttons/`
- `src/platform/ui/controls/`
- `src/platform/ui/menus/`
- `src/platform/ui/sheets/`
- `src/platform/ui/materials/`
- `src/platform/ui/navigation/`
- `src/platform/ui/dev/expo-ui-lab/`

Existing notes:

- `src/platform/ui/README.md` says feature screens consume wrappers and never `@expo/ui/swift-ui` directly.
- `src/platform/ui/dev/expo-ui-lab/README.md` permits live demos to import SwiftUI only inside the platform UI boundary.

## Expo UI Policy for Phase 7B

- Prefer universal `@expo/ui` imports through Modula adapters where possible.
- Platform-specific SwiftUI or Jetpack Compose imports stay in `.native.tsx`, `.ios.tsx`, or `.android.tsx` files under `src/platform/ui/**`.
- `Host` ownership stays inside the adapter file.
- Feature modules under `src/features/modules/**` render through Modula primitives and platform wrappers.
- Web fallbacks must be functional React Native/React Native Web surfaces.
- Do not put an Expo UI Host inside absolute sticky feed overlays, liquid-glass tab geometry, shell bottom wash, Reels overlays, or Stories dial overlays.
- Do not alter validated PR #7 bottom chrome geometry.

## Native Liquid Glass Availability

Current dependency register records:

- `expo-glass-effect ~57.0.1`
- `@callstack/liquid-glass 0.8.0`

Repository adapters already guard liquid glass runtime availability:

- `src/platform/ui/navigation/liquid-glass-availability.ts`
- `src/platform/ui/materials/liquid-glass-chrome.tsx`
- `src/platform/ui/navigation/platform-tabs.native.tsx`

Native liquid glass requires a compatible native runtime and custom rebuild. Web and unsupported native runtimes must fall back to token-driven solid, blur, or raised surfaces. Reduce Transparency must force opaque/solid presentation.

## Web-Unavailable Features

Do not rely on these for Phase 7B web acceptance:

- Real SwiftUI or Jetpack Compose rendering outside the `@expo/ui` web fallback.
- Native liquid glass rendering.
- Native sheet presentation details beyond the existing web fallback.
- Native-only haptics, camera, video playback internals, or iOS menu presentation.

## Native Rebuild Requirements

No new native dependency is expected for Phase 7B.

Native rebuild remains required for dependency changes involving:

- `@expo/ui`
- `expo-glass-effect`
- `@callstack/liquid-glass`
- `expo-camera`
- `expo-video`
- other Expo-managed native modules

VPS acceptance for Phase 7B is web/static plus backend/API/worker validation. Native iOS, physical iPhone, TestFlight, and Android native acceptance are deferred.
