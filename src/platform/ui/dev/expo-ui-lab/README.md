# Expo UI Lab (Developer)

Adapted from [betomoedano/expo-ui-playground](https://github.com/betomoedano/expo-ui-playground) for Modula SDK 57.

## Purpose

Evaluate Expo UI SwiftUI components in-app under **Settings → Developer → Expo UI Lab**, then decide which patterns to absorb into Modula wrappers.

## Rules

1. Live demos may import `@expo/ui/swift-ui` **only** inside this folder (and other `src/platform/ui/*` adapters).
2. Product / feature screens import Modula wrappers — never `@expo/ui/swift-ui`.
3. Prefer catalog statuses: `wrapped` → use existing adapters; `candidate` → design a wrapper; `explore` → keep lab-only until there is a product use case.

## Entry

- Catalog: `/settings/developer/expo-ui`
- Full playground: `/settings/developer/expo-ui/playground`
- Section: `/settings/developer/expo-ui/[section]`
- Alias: `/dev/components` → catalog
