# Modula

**Simplifying Digital.**

> One identity. One environment. Infinite configurations.

Modula is a modular **Social Operating System** — identity, social interaction, personal tools, external integrations, and installable modules inside one user-controlled environment. The user’s profile becomes their platform.

This repository is the **greenfield** Modula client for iOS, Android, and web (Expo SDK 57, React Native, TypeScript, Expo Router). It replaces the Bluesky-derived prototype; that codebase may be studied for UI patterns only.

## What Modula is / is not

| Is | Is not |
|---|---|
| Profile-centred Social OS | Only a social network or notes app |
| Host for installable modules | A Bluesky / AT Proto fork |
| Protocol-independent social UI | Gaia-, wallet-, or marketplace-dependent |
| Token-driven appearance system | A copy of Bluesky ALF |

## Current status

| Phase | Status |
|---|---|
| **0 — Foundation** | Done — Expo SDK 57, native projects, tokens, startup contract |
| **0.5 / 1 — Shell** | In progress — tabs shell, full Settings IA (Account/Privacy/Moderation…), mock social, Board |
| 2–8 | Deferred — see roadmap below |

First launch opens the **Board** (personal OS surface). Foundation status remains under Settings → About / Developer.

## Tech stack

- Expo SDK 57 · React Native New Architecture · React 19
- Expo Router (file-based) · TypeScript
- `@expo/ui` (universal) via system adapters
- pnpm workspaces

## Prerequisites & getting started

- Node.js 20+
- pnpm
- Xcode + CocoaPods (iOS, macOS)
- Android SDK + JDK (Android)

```bash
pnpm install
cp .env.example .env   # optional
pnpm start             # or: pnpm web / pnpm ios / pnpm android
```

Details: `docs/development/getting-started.md`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm start` | Expo development server |
| `pnpm web` | Web / PWA |
| `pnpm ios` | Native iOS (`expo run:ios`) |
| `pnpm android` | Native Android (`expo run:android`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `expo lint` |
| `pnpm doctor` | `expo-doctor` |
| `pnpm prebuild` | Generate native projects |
| `pnpm prebuild:clean` | Clean regenerate native projects |

## Architecture docs

| Doc | Topic |
|---|---|
| `docs/product/overview.md` | Condensed product vision |
| `docs/product/theme-architecture-v5.md` | Appearance dimensions (v5 adaptation) |
| `docs/architecture/project-structure.md` | `src/` layout |
| `docs/architecture/startup-contract.md` | Launch invariants |
| `docs/architecture/module-boundary.md` | Host vs modules |
| `docs/architecture/screen-map.md` | Bluesky → Modula map |
| `docs/architecture/expo-native-component-list.md` | NCL relevance |
| `docs/architecture/dependency-policy.md` | Admission rules |
| `docs/architecture/dependency-register.md` | Admitted packages |
| `docs/architecture/bluesky-inspiration-policy.md` | Study ≠ copy |
| `docs/architecture/native-project-policy.md` | `ios/` / `android/` |

Agent skills: `.cursor/skills/modula-architecture`, `modula-ui`, `modula-dependencies`.

## Roadmap (condensed)

0. Foundation · 1. Shell · 2. Appearance · 3. Profile · 4. Social foundation · 5. Module standard · 6. Core modules · 7. Marketplace · 8. Advanced (teams, wallet, Gaia, Neural Atlas)

## Native & dependency policy

- Native folders are first-class after prebuild; see `native-project-policy.md`.
- OTA / EAS Update is **not** enabled.
- New deps require register + `expo install` for Expo modules — no speculative installs.

## Licence

See [LICENSE](./LICENSE) (MIT, from Expo template provenance). Product branding and Modula identity are separate from template licence headers.
