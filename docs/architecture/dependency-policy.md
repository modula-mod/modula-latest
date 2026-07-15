# Dependency Policy

Modula admits dependencies deliberately. Phase 0 keeps the official Expo SDK 57 template set and adds no speculative libraries.

## Admission requirements

Every new direct dependency must have:

1. A defined use case in Modula.
2. Expo SDK 57 compatibility evidence.
3. New Architecture compatibility.
4. An acceptable licence.
5. A maintained upstream repository.
6. An isolated integration test before global use.
7. A documented removal path.

## Installation rules

- Expo-managed packages: `pnpm exec expo install <package>`
- Ordinary JS packages outside the Expo matrix: `pnpm add <package>`
- Do not pin or bump Expo matrix versions by hand.
- Do not install a package merely because an example or prior repository used it.

## Explicitly deferred

Do not install during bootstrap or without a later audited phase:

- Zustand, TanStack Query, React Hook Form, Zod
- Shopify React Native Skia, extra Reanimated packages
- Bottom-sheet / drawer libraries
- NativeWind, Tamagui, React Native Paper
- Auth, database, analytics, crash-reporting SDKs
- Blockchain / wallet SDKs
- Module-loading, background-task, notification, or AI SDKs

## Register

Every direct dependency must appear in `dependency-register.md` with purpose, native impact, licence, and phase.
