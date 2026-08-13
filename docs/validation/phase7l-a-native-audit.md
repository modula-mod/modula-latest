# Phase 7L-A Native Audit

Date: 2026-08-13
Host environment: Linux VPS

## Required Mac commands

These commands remain required on the Mac audit host:

```sh
git fetch origin --prune --tags
git switch main
git pull --ff-only
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
cd ios
pod install
xcodebuild -workspace Modula.xcworkspace -scheme Modula -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## Current classification

| Item | Status | Priority | Evidence |
| --- | --- | --- | --- |
| iOS source presence | WORKING | P1 | `ios/Modula.xcworkspace` exists in `/root/modula-latest` |
| Mac build execution | INCOMPLETE | P0 | Current audit host is Linux; `xcodebuild` cannot run here |
| Simulator screen audit | INCOMPLETE | P1 | Requires Mac simulator after build |
| Native session restore | INCOMPLETE | P0 | Source has `NativeSecureSessionStorage.ts`, but runtime proof requires simulator/device |
| Native icon rendering | INCOMPLETE | P1 | Requires simulator screenshot evidence |
| Native media rendering | INCOMPLETE | P1 | Requires simulator screenshot evidence |

## Stop condition

Do not mark Phase 7L-A fully complete until the Mac commands produce `BUILD SUCCEEDED` and the required simulator screen audit screenshots are captured.
