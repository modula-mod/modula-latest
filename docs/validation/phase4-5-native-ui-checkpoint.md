# Phase 4.5 Native UI Checkpoint

Status: Interim accepted checkpoint

Label: Native UI Recovery — Interim Accepted Checkpoint

Date: 2026-07-17
Branch: `phase4-5-native-ui-recovery`
Host: Mac clone at `$HOME/Developer/modula-latest`

This checkpoint preserves the improved frontend before Phase 5 backend work.
It is **not** a final UI acceptance.

## Working

- Expo / Metro-backed native iOS app launches without startup crash (Simulator, installed `digital.modula.app`)
- Home feed renders: stories rail, Following / For You / Modules selector, inline composer prompt, posts
- Floating liquid-glass style tab bar with Home / Discover / Board / Activity / Profile destinations plus Compose FAB
- Platform-native navigation shell and headers from Phase 4.5 recovery commits
- Adaptive account panel architecture (sheet + reducer; instant-close fix retained on branch)
- Profile hero/tabs, cover/avatar editor wiring, Reels presentation, Composer / Tools sheet present in codebase
- Automated: `pnpm typecheck`, `pnpm verify:theme`, `pnpm verify:phase4`, `pnpm verify:phase4-5` (40 checks), `pnpm exec expo export --platform web`
- Expo Doctor: only known committed-native / non-CNG sync warning

## Known visual limitations

- Interface is interim; further polish expected after Phase 5
- Liquid-glass tab chrome requires a native rebuild with linked `@callstack/liquid-glass`; Expo Go uses NativeTabs fallback
- Accessibility role warnings (`Unsupported Role value: destructive`) observed in Simulator logs during Home render
- Some social surfaces still use preview-only affordances (audience/CW/GIF/location tools, etc.)
- Historical visual defects from Phase 4.5 audits may persist in edge layouts; see `docs/audits/phase4-5-visual-defect-audit.md` and `docs/validation/phase4-5-ui-bugs/`

## Known functional limitations

- `pnpm lint` currently FAIL (react-hooks immutability/refs errors in liquid-glass tab bar + SkeletonBlock; assorted warnings)
- `pnpm verify:phase1` / `verify:phase2` / `verify:phase3` FAIL against evolved Phase 4.5 tree (reanimated/worklets allowed later; route layout changed; early-phase forbidden-deps rules outdated)
- Production authentication deferred; demo/local data runtime still in use
- Physical device and TestFlight walks not completed in this Mission A pass
- Account panel / Profile / full Composer interactions not exhaustively re-walked in this pass (Home launch + tab chrome confirmed via Simulator screenshot)
- Local `DEVELOPMENT_TEAM` must not be committed; stripped from `project.pbxproj` before checkpoint commit

## Automated validation (Mission A)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm exec expo install --check` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | FAIL (see known functional limitations) |
| `pnpm verify:phase1` | FAIL (outdated Phase 1 constraints) |
| `pnpm verify:phase2` | FAIL (outdated Phase 2 constraints) |
| `pnpm verify:theme` | PASS |
| `pnpm verify:phase3` | FAIL (outdated Phase 3 constraints) |
| `pnpm verify:phase4` | PASS |
| `pnpm verify:phase4-5` | PASS |
| `pnpm exec expo export --platform web` | PASS |
| `pnpm exec expo-doctor` | FAIL (known non-CNG warning only) |

## Simulator

- PASS (launch, Home render, tab bar + composer prompt visible; no immediate crash)
- Evidence: Simulator screenshot `/tmp/modula-sim-home.png` (local host; not committed)

## Physical iPhone

- NOT TESTED

## TestFlight

- NOT TESTED

## Expo Go

- App icon present on Simulator home screen alongside the native Modula build
- Full Expo Go walk of recovered native chrome NOT TESTED in this pass
