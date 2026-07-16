---
name: modula-dependencies
description: >-
  Modula dependency admission: register process, expo install vs pnpm add,
  forbidden speculative installs. Use before adding any package, Expo module,
  or copying deps from Bluesky / NCL / playgrounds.
---

# Modula Dependencies

## When to use

- Before `pnpm add` / `expo install`
- Reviewing deps from Bluesky, NCL, or expo-ui-playground
- Updating `docs/architecture/dependency-register.md`

## Process

1. State the **product use case** (not “example uses it”).
2. Prefer packages already in `package.json`.
3. For Expo modules: `pnpm exec expo install <pkg>` (SDK-aligned).
4. For non-Expo libs: justify New Architecture + licence + maintenance.
5. Add a row to `docs/architecture/dependency-register.md`.
6. Prefer an isolated `/dev/components` or settings Developer check before global use.
7. Document removal path.

## Forbidden without explicit phase approval

- Zustand, TanStack Query, Zod (until needed with use case)
- NativeWind, Tamagui, large design systems
- Skia extras for speculative visuals
- Auth SDKs, blockchain, AI SDKs
- `@bsky.app/*`, AT Proto clients in UI
- OTA / EAS Update wiring in early phases

## Checklist

- [ ] Use case written
- [ ] SDK 57 / New Architecture evidence
- [ ] Licence reviewed
- [ ] `expo install` used for Expo packages
- [ ] Register updated
- [ ] Not installed “just in case”

## Pointers

- `docs/architecture/dependency-policy.md`
- `docs/architecture/dependency-register.md`
- `docs/architecture/expo-native-component-list.md`
