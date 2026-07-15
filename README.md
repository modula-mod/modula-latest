# Modula

Modula is a modular Social Operating System that combines identity, social
interaction, personal tools, external integrations, and installable modules
inside one user-controlled environment.

This repository contains the greenfield Modula application for iOS, Android,
and the web. It is built with React Native, Expo, TypeScript, and Expo Router.

The application is being developed from a minimal native foundation. Product
features, protocol adapters, modules, and advanced visual effects are added
only after their underlying runtime contracts are proven stable.

## Status

**Phase 0 — Fresh Expo SDK 57 foundation**

- Single foundation route (`/`)
- Modula identity (`digital.modula.app`)
- Primitives + semantic colour tokens
- Documented architecture and dependency admission
- Native projects generated via Expo prebuild (committed)

## Prerequisites

- Node.js 20+
- pnpm
- Xcode + CocoaPods for iOS (macOS)
- Android SDK + JDK for Android

## Install

```bash
pnpm install
```

Optional environment file:

```bash
cp .env.example .env
```

## Commands

| Command | Purpose |
|---|---|
| `pnpm start` | Expo development server |
| `pnpm web` | Web / PWA development |
| `pnpm ios` | Native iOS run (`expo run:ios`) |
| `pnpm android` | Native Android run (`expo run:android`) |
| `pnpm typecheck` | TypeScript (`tsc --noEmit`) |
| `pnpm lint` | `expo lint` |
| `pnpm doctor` | `expo-doctor` |
| `pnpm prebuild` | Generate native projects |
| `pnpm prebuild:clean` | Clean regenerate native projects |

## Platform notes

- **Web:** `pnpm web`
- **iOS:** After prebuild, open `ios/Modula.xcworkspace` or run `pnpm ios`
- **Android:** After prebuild, run `pnpm android`

See `docs/development/` for details.

## Quality checks

```bash
pnpm install
pnpm exec expo install --check
pnpm doctor
pnpm typecheck
pnpm lint
```

## Native prebuild policy

Native folders are generated only after the JS foundation validates. They are committed and treated as first-class source. See `docs/architecture/native-project-policy.md`.

OTA updates / EAS Update are intentionally **not** configured in Phase 0.

## Dependency admission

New dependencies require use case, SDK 57 evidence, New Architecture compatibility, licence review, maintained upstream, isolated test, and removal path. See:

- `docs/architecture/dependency-policy.md`
- `docs/architecture/dependency-register.md`

## Architecture docs

- `docs/architecture/project-structure.md`
- `docs/architecture/startup-contract.md`
- `docs/architecture/bluesky-inspiration-policy.md`
- `docs/architecture/module-boundary.md`
