# Phase 7J — Native runtime baseline (§11)

Date: 2026-08-11  
Source of truth: installed `package.json` / lockfile on Mac (not training recall).

## Core runtime

| Package | Specifier (package.json) |
|---|---|
| expo | `~57.0.11` |
| react | `19.2.3` |
| react-native | `0.86.2` |
| expo-router | `~57.0.11` |
| typescript | `~6.0.3` |
| @expo/ui | `~57.0.9` |
| expo-secure-store | `~57.0.1` |
| react-native-reanimated | `4.5.1` |

## App identity / native

| Item | Value |
|---|---|
| Bundle ID | `digital.modula.app` |
| Scheme | `modula` |
| Dev client | `expo-dev-client` (in app config plugins) |
| Simulator under test | iPhone 17 Pro · iOS 27.0 · `0727E2F0-8528-44DA-9F4C-7B5F7394096B` |

## Data / API (dev)

| Item | Value |
|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` |
| `EXPO_PUBLIC_DATA_SOURCE` | `remote` |
| `EXPO_PUBLIC_API_URL` | `http://127.0.0.1:4020` (SSH tunnel to private Greenfield) |
| Tunnel | `ssh -N -L 4020:127.0.0.1:4020 modula-vps` (preserved) |

## Health snapshot (tunnel)

- `/v1/health/live` → ok
- `/v1/health/ready` → ok
- `/v1/meta` → Greenfield production-alpha capabilities present (`greenfieldSessions`, `mutations`, etc.)

## Upgrade posture (Step 5)

- Prefer `pnpm exec expo install` for Expo modules.
- Do not speculative-install Zustand / NativeWind / new design systems.
- Dirty `expo-mcp` addition is **engineering-only** until admitted commit.
- After upgrades: `pnpm lint`, `pnpm typecheck`, `pnpm exec expo-doctor` as feasible.
