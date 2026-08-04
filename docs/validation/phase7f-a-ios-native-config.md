# Phase 7F-A — iOS Native Ownership & Config Audit

**Date:** 2026-08-04  
**Branch:** `phase7f-a-mac-ios-smoke` @ `eb0ca52` (+ focused native fixes)

## Ownership model

| Question | Answer |
| --- | --- |
| Is `ios/` tracked? | **Yes** — authoritative native project |
| Prebuild used? | **No** — `expo prebuild` / `--clean` not run |
| Pods | `pod install` (no Gemfile); CocoaPods 1.16.2 |
| Workspace | `ios/Modula.xcworkspace` |
| Scheme | `Modula` |

## Bundle / identity

| Item | Value |
| --- | --- |
| Bundle identifier | `digital.modula.app` |
| Display name | Modula |
| URL schemes | `modula`, `digital.modula.app` |
| Associated domains | none in entitlements |
| Entitlements | empty `Modula.entitlements` |
| Keychain / SecureStore | via `expo-secure-store` plugin |
| New Architecture | `RCTNewArchEnabled = true` |
| Expo Updates | disabled in `app.config.ts` |
| Development client | `expo-dev-client` with `toolsButton: false` |

## App Transport Security

- `NSAllowsArbitraryLoads = false`
- `NSAllowsLocalNetworking = true`

HTTPS Greenfield (`https://api.modula.digital`) is ATS-compatible. Local networking allowed for Metro / LocalApiServer.

## Privacy usage descriptions

Declared in Expo config plugins (`expo-image-picker`, `expo-camera`). With tracked `ios/`, Info.plist does not auto-sync those keys (Expo Doctor non-CNG warning).

**7F-A fix:** copied camera/photo usage strings into `ios/Modula/Info.plist` and `app.config.ts` `ios.infoPlist`. Opening Appearance Advanced without `NSCameraUsageDescription` fatals (`RCTFatal` / ExpoCamera permission probe).

## Deployment target

| Layer | Value |
| --- | --- |
| Podfile | `platform :ios, … \|\| '16.4'` |
| `Podfile.properties.json` | `ios.deploymentTarget: "16.4"` (pinned in 7F-A) |
| Project-level `IPHONEOS_DEPLOYMENT_TARGET` | 16.4 |
| Target-level (before fix) | `$(RECOMMENDED_IPHONEOS_DEPLOYMENT_TARGET)` → **15.0** on Xcode 26.6 |
| Target-level (after fix) | **16.4** |

## Focused native fixes applied on Mac branch

1. **Deployment target mismatch** — App target compiled as iOS 15.0 while Expo modules require 16.4 → pin target to `16.4`.
2. **User Script Sandboxing** — `ENABLE_USER_SCRIPT_SANDBOXING = YES` denied CocoaPods `[CP] Copy Pods Resources` write → set `NO` (standard RN/CocoaPods requirement).

## Signing note

`DEVELOPMENT_TEAM` is already present in the tracked Xcode project from prior work. This phase does not introduce a new Team ID as a universal setting and does not commit certificates or private keys.

## Local environment (ignored)

`.env.development.local` (gitignored):

```text
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_DATA_SOURCE=remote
EXPO_PUBLIC_API_URL=https://api.modula.digital
EXPO_PUBLIC_DEMO_SESSION=
```

Backend selection: founder-alpha / preview Greenfield at `https://api.modula.digital` (live + ready + meta verified). No production secrets committed.
