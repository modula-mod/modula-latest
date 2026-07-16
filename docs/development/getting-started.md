# Getting Started

## Prerequisites

- Node.js 20+ (Phase 0 validated on Node 24)
- pnpm 9+ (Phase 0 validated on pnpm 11)
- For iOS: macOS, Xcode, CocoaPods
- For Android: Android SDK / Android Studio, JDK 17+
- For web: a modern browser

## Install

```bash
cd /home/andrei/modula-latest
pnpm install
```

Copy `.env.example` to `.env` when local overrides are needed. The app opens on Board. Feed/Explore use in-memory mock social data — no API required.

## Commands

```bash
pnpm start          # Expo dev server
pnpm web            # Web
pnpm ios            # Native iOS (after prebuild)
pnpm android        # Native Android (after prebuild)
pnpm typecheck      # tsc --noEmit
pnpm lint           # expo lint
pnpm doctor         # expo-doctor
pnpm prebuild:clean # regenerate native projects
```

## Quality checks

```bash
pnpm install
pnpm exec expo install --check
pnpm doctor
pnpm typecheck
pnpm lint
```
