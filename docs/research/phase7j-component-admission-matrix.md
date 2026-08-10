# Phase 7J — Component admission matrix (§13–17)

Date: 2026-08-11  
Policy: Modula primitives + `src/components/system/*` adapters. No direct `@expo/ui/swift-ui` in features. Surface Types are materials, not border-radius.

## Source priority

1. Existing Modula primitives (`AppButton`, `AppText`, `AppScreen`, inputs, switches)
2. `@expo/ui` via system adapters only
3. React Native core
4. Bluesky / NCL — study density only; reimplement (no copy)
5. New packages — dependency admission required

## Admission matrix (initial)

| Role | Current Modula surface | Candidate source | Admit? | Notes |
|---|---|---|---|---|
| Text input | `ModulaTextInput` / auth fields | keep + harden | **YES** | Canonical input system DoD |
| Secure input | `ModulaSecureInput` | keep | **YES** | |
| Button | `ModulaButton` / `AppButton` | keep | **YES** | Variants via tokens |
| Switch | `SystemSwitch` → `ModulaSwitch` | @expo/ui adapter | **YES** | Mac-B adopted |
| Checkbox | `ModulaCheckbox` | keep | **YES** | |
| Surface | `MaterialSurface` / theme Surface Types | theme v5 | **YES** | Real materials; not radius |
| Drawer | `NavigationDrawer` | keep + Drawer 2.0 | **YES** | No freeze |
| Tabs / feed modes | Home sticky modes | keep | **YES** | Geometry fixed Mac-B |
| Post row | feed components | keep | **YES** | Reactions must be real API |
| Avatar | existing | keep | **YES** | |
| Sheets / menus | partial | @expo/ui research | **DEFER** until UI Lab |
| Glass chrome | stub Surface Type | theme | **STUB** | No half-app glass |
| New design system (Tamagui/NativeWind) | — | — | **REJECT** | Forbidden without phase approval |
| Skia speculative visuals | — | — | **REJECT** | Unless concrete use case |

## Licence rule

- Prefer MIT/Apache-2.0 with clear maintenance.
- No `@bsky.app/*` in UI.
- Register every new package in `docs/architecture/dependency-register.md`.

## UI Lab

- Target route: `/dev/ui-lab` (dev-only; never production bundles).
- Use lab to prove inputs/buttons/surfaces before global adoption.
