# Phase 7I-MAC-A — Expo Doctor

Date: 2026-08-10  
Branch: `phase7i-mac-native-ui-acceptance`  
Base: `phase7i-trusted-production-alpha` @ `0f9708bbaa1896e438dc3a9f5b28ec6d1327c353`  
Command: `pnpm exec expo-doctor` (expo-doctor 1.20.0)

## Result

`18/20 checks passed. 2 checks failed.`

Doctor exit code was `0` despite failed checks (tool quirk). Findings below are classified for Mac acceptance; no Expo upgrade/downgrade was performed solely to green the report.

## Installed stack (recorded)

| Item | Value |
| --- | --- |
| Expo SDK / CLI | `expo@57.0.11` / CLI `57.0.13` (config sdkVersion `57.0.0`) |
| React Native | `0.86.2` |
| Expo Router | `~57.0.11` → installed `57.0.11` |
| `@expo/ui` | `~57.0.9` → installed `57.0.9` |
| React | `19.2.3` |
| iOS deployment target | `16.4` (`ios/Podfile.properties.json` / Xcode project) |
| New Architecture | Not explicitly forced in `Podfile.properties.json`; Expo SDK 57 / RN 0.86 default path applies in the tracked native project |
| Sibling Module Standard | `../modula-mod/modula-module-standard` @ `2bfc0a826d19db870a445e06d52010cec6e0a54f` (`phase7i-trusted-production-alpha`) |

## Findings

| Finding | Classification | Notes |
| --- | --- | --- |
| App config fields may not sync in a non-CNG project (`scheme`, `orientation`, `userInterfaceStyle`, `icon`, `ios`, `android`, `plugins`) | `INTENTIONAL_NATIVE_PROJECT_STATE` | `ios/` and `android/` are committed and deliberately maintained. Same waiver pattern as Phase 7H (`PHASE7H_TRACKED_NATIVE_PROJECT`). Native-affecting `app.config.ts` changes must be mirrored intentionally; do not `expo prebuild --clean` for Mac acceptance. |
| Patch version mismatches vs latest Expo SDK 57 expectations (`@expo/metro-runtime` 57.0.8→~57.0.9, `@expo/ui` 57.0.9→~57.0.10, `expo` 57.0.11→~57.0.12, `expo-constants`, `expo-dev-client`, `expo-image-picker`, `expo-router`, `expo-splash-screen`) | `UPSTREAM_COMPATIBILITY` | Lockfile on the trusted production alpha pins these patch levels. Drift is patch-only within SDK 57. Not a Mac build blocker. Do **not** run `expo install --fix` blindly during acceptance; align only with an explicit dependency admission if a native defect requires it. |
| `pnpm exec expo install --check` reports the same patch set | `UPSTREAM_COMPATIBILITY` | Investigated; left unchanged for acceptance reproducibility against `phase7i-trusted-production-alpha`. |
| Missing sibling `modula-module-standard` on a fresh Mac clone | `ACTIONABLE` (environment) | Root `package.json` uses `file:../modula-mod/modula-module-standard/packages/*`. Fresh clone requires a sibling checkout at the Phase 7I Standard SHA and a Standard package `tsc` build so `dist/` exists before `pnpm install` (pnpm copies `files: ["dist"]` at install time). Documented for Mac operators; not an Expo Doctor check. |
| `modula-module` bin warning when `create-module` dist missing | `ACTIONABLE` (environment) | Resolved by building Standard packages before reinstall. Harmless for iOS Simulator product acceptance if CLI scaffolding is unused. |

## Non-findings / intentional

| Topic | Classification |
| --- | --- |
| Tracked `ios/` present | `INTENTIONAL_NATIVE_PROJECT_STATE` |
| EAS / TestFlight not used in this phase | `INTENTIONAL_NATIVE_PROJECT_STATE` |
| No unexplained doctor noise left as `UNKNOWN` | — |

## Decision

Proceed with local Xcode / `expo run:ios` acceptance on the locked SDK 57 patch set. Treat doctor failures as documented waivers + upstream patch drift, not blockers for Mac UI audit.
