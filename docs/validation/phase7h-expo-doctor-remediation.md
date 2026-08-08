# Phase 7H Expo Doctor Remediation

Date: 2026-08-08
Branch: `phase7h-production-social-hardening`
Scope: Block B runtime/toolchain health.

## Current Result

Command:

```sh
pnpm exec expo-doctor
```

Result after remediation:

- `19/20 checks passed`.
- Remaining failure: app config fields that may not be synced in a non-CNG project.

Command:

```sh
pnpm exec expo install --check
```

Result:

- `Dependencies are up to date`.

Command:

```sh
pnpm peers check
```

Result:

- `No peer dependency issues found`.

## Classifications

| Finding | Classification | Resolution |
| --- | --- | --- |
| Duplicate `expo-web-browser` | `REMOVE_DEPENDENCY` | Removed `@atproto/oauth-client-expo@0.1.8`, which pulled `expo-web-browser@15.0.11`. `pnpm why expo-web-browser` now reports only `expo-web-browser@57.0.2` from the app. |
| `@expo/metro-runtime` mismatch | `FIX` | Added direct SDK-compatible `@expo/metro-runtime@57.0.8`. Doctor no longer reports the router/runtime mismatch. |
| Native-folder/CNG warning | `SAFE_DOCUMENTED_EXCEPTION` | This checkout is a tracked-native project: both `ios/` and `android/` are committed and production native behavior must be synchronized intentionally. Do not assume app config plugin changes auto-apply to native projects. Native config changes require explicit native file review and rebuild proof. |
| `@atproto/oauth-client-expo` New Architecture warning | `REMOVE_DEPENDENCY` | Removed the optional native AT OAuth package from the core runtime. AT Protocol remains server-mediated through the Modula API and `expo-web-browser`, behind existing metadata capability gates. |
| SDK 57 patch drift | `FIX` | Aligned the Doctor-reported SDK 57 patch set: `expo`, `expo-router`, `@expo/ui`, `expo-constants`, `expo-dev-client`, `expo-image`, `expo-image-picker`, `expo-linking`, `expo-system-ui`, `react-native`, `react-native-reanimated`, `react-native-worklets`, and `eslint-config-expo`. |

## Native Ownership Decision

Decision: `tracked native project`.

Evidence:

- `ios/` exists.
- `android/` exists.
- `app.config.ts` keeps public Expo metadata and plugin declarations, but those values are not treated as automatic native source-of-truth while native folders are present.

Operational rule:

- Native-affecting changes in `app.config.ts` must be mirrored in `ios/` and `android/` intentionally.
- Do not run `expo prebuild --clean` during production hardening unless the phase explicitly authorizes native regeneration and the diff is reviewed.
- iOS acceptance remains a later Mac/Xcode gate for the resulting native project.

## Remaining Waiver

Expo Doctor `1.20.0` does not expose a project-level per-check ignore for the native-folder/app-config sync warning. The available public config documented in the installed package is for React Native Directory exclusions, not this check.

This is therefore a documented waiver, not a hidden skip:

- Waiver code: `PHASE7H_TRACKED_NATIVE_PROJECT`.
- Scope: `Check for app config fields that may not be synced in a non-CNG project`.
- Expiry: remove the waiver only if Modula either moves fully to CNG/prebuild-owned native projects or removes native-affecting config from `app.config.ts` after proving equivalent native source state.

## Verification Commands

```sh
pnpm why expo-web-browser
pnpm why @expo/metro-runtime
pnpm exec expo install --check
pnpm peers check
pnpm exec expo-doctor --verbose
```
