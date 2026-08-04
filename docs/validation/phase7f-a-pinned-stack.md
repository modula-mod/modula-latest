# Phase 7F-A — Pinned Expo Stack & Doctor

**Source:** `phase7f-a-mac-ios-smoke` @ `eb0ca524a86872e3e9a467bf5e582d06a3ce8119`  
**Policy:** No Expo SDK / React Native upgrade in this phase.

## Pinned versions (from `package.json` / install)

| Package | Pinned |
| --- | --- |
| expo | 57.0.8 (`~57.0.8`) |
| react | 19.2.3 |
| react-native | 0.86.0 |
| expo-router | 57.0.8 (`~57.0.8`) |
| expo-dev-client | 57.0.9 (`~57.0.9`) |
| @expo/ui | 57.0.7 (`~57.0.7`) |
| react-native-reanimated | 4.5.0 |
| react-native-gesture-handler | 2.32.0 (`~2.32.0`) |
| react-native-screens | 4.26.2 |
| @shopify/react-native-skia | 2.6.2 |

SDK from `expo config --type public`: **57.0.0** platforms `ios`, `android`, `web`.

## Expo Doctor (20 checks)

Raw log: `.local-evidence/phase7f-a/expo-doctor.log` (local only).

| Check | Classification | Notes |
| --- | --- | --- |
| Duplicate native deps (`expo-web-browser` 57.0.2 vs nested 15.0.11 under `@atproto/oauth-client-expo`) | **WARNING** | Known AT Proto OAuth nesting; do not SDK-upgrade here |
| Overridden deps (`@expo/metro-runtime` 57.0.5 vs expected ^57.0.7) | **WARNING** | Patch-level; not upgraded in 7F-A |
| Non-CNG sync fields with tracked `ios/` | **WARNING** | Expected: `ios/` is authoritative; app.config native fields may drift |
| RN Directory: `@atproto/oauth-client-expo` untested on New Arch | **WARNING** | Advisory |
| Packages match Expo SDK (patch mismatches for expo/*, RN 0.86.0 vs 0.86.2, etc.) | **WARNING** | Explicit no-upgrade policy for 7F-A |

**Doctor overall for this phase:** no **BLOCKER** that requires an SDK upgrade. Native build proceeds on pinned stack.

## App verifiers

| Check | Result | Classification |
| --- | --- | --- |
| Workspace package build then `pnpm typecheck` | PASS | PASS |
| `pnpm lint` (`import/no-unresolved` on `@modula/api-contracts` exports) | FAIL | **WARNING** — package resolves for TypeScript after build; ESLint resolver/export-map friction; not an iOS compile blocker |
| `pnpm verify:phase7e-no-product-mocks` | PASS | PASS |
| `pnpm verify:phase7e-standard2-normalization` | PASS | PASS |
| `pnpm verify:phase7e-module-standard` | PASS | PASS |
| `pnpm verify:phase7e-vault-notes` | FAIL | **BLOCKED (infra)** — needs built API/worker packages + `MODULA_*_DATABASE_URL`; VPS/DB only; not weakened on Mac |
