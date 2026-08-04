# Phase 7F-A — Mac Toolchain Audit

**Recorded at:** 2026-08-04  
**Host:** Apple Silicon Mac (agent execution environment)  
**Policy:** No speculative upgrades of Xcode, Expo, React Native, pnpm, or CocoaPods.

## Summary

| Item | Value |
| --- | --- |
| macOS | 27.0 (Build 26A5378n) |
| Architecture | `arm64` (Apple Silicon) |
| Developer directory | `/Applications/Xcode.app/Contents/Developer` |
| Xcode | 26.6 (Build 17F113) |
| Node | v22.21.0 |
| Corepack | 0.34.0 |
| pnpm | 11.3.0 |
| Ruby | 2.6.10p210 (universal.arm64e-darwin26) |
| CocoaPods | 1.16.2 |
| Watchman | **not installed** (`command not found`) — non-blocking for smoke |
| Root disk | 926 Gi total, ~267 Gi available (~6% used) |

## iOS Simulator runtimes installed

| Runtime | Identifier |
| --- | --- |
| iOS 18.2 | `com.apple.CoreSimulator.SimRuntime.iOS-18-2` |
| iOS 18.4 | `com.apple.CoreSimulator.SimRuntime.iOS-18-4` |
| iOS 26.3 | `com.apple.CoreSimulator.SimRuntime.iOS-26-3` |
| iOS 26.5 | `com.apple.CoreSimulator.SimRuntime.iOS-26-5` |
| iOS 27.0 | `com.apple.CoreSimulator.SimRuntime.iOS-27-0` |

## Selected Simulator (Pass A)

| Field | Value |
| --- | --- |
| Device | iPhone 17 Pro |
| iOS | 26.5 |
| UDID | `439E8DF1-EA4F-4028-98A0-32CA9469EAE0` |
| Notes | Already booted at audit time; preferred over creating extra devices. iPhone 16 Pro (iOS 18.x) also available if runtime compatibility requires fallback. |

## Commands captured

```bash
sw_vers
uname -m
xcode-select -p
xcodebuild -version
xcrun simctl list runtimes
xcrun simctl list devices available
node --version
corepack --version
pnpm --version
ruby --version
pod --version || true
watchman --version || true
df -h /
```

Raw capture also saved under `/tmp/phase7f-a-toolchain.txt` on the Mac (local only).

## Upgrade policy for this phase

Tool versions above are accepted as-is. Repairs are allowed only for proven compatibility blockers discovered during Expo / CocoaPods / Xcode builds.
