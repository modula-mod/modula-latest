---
name: modula-ui
description: >-
  Modula UI primitives, theme tokens, @expo/ui system adapters, Surface Type
  stubs, and Bluesky inspiration policy. Use when building screens, components,
  theme/appearance, or adapting Bluesky visual density.
---

# Modula UI

## When to use

- Creating or changing primitives / screens
- Theme, colour mode, accents, Surface Types
- Using `@expo/ui` or studying Bluesky / NCL UI
- Appearance settings

## Theme architecture (v5 dimensions)

Independent dimensions resolve into one immutable `ThemeTokens`:

| Dimension | Values |
|---|---|
| Colour mode | system, light, dim, dark, oled |
| Theme family | standard (+ forest, ocean, plum, espresso, spaceGray reserved) |
| Accent | modulaTeal `#369CAA` (+ reserved accents) |
| Surface type | native, solid, glass, glay, minimalSpatial, skeuo, neo |

**Working now:** system → light/dark, Modula Teal, solid/native stubs.  
**Deferred:** full family palettes, Glass/Liquid Glass/Skeuo/Neo engines.

See `docs/product/theme-architecture-v5.md` and `src/theme/`.

## Rules

1. Primitives consume `useTheme()` semantic tokens — not raw hex (except foundations).
2. Features import primitives and `src/components/system/*` — **never** `@expo/ui/swift-ui` directly.
3. Bluesky: study density/hierarchy → reimplement. No ALF, no copied components with Bluesky deps.
4. Post presentation principle: *Media glows. Text breathes. Links contain.* — apply lightly.
5. Surface Types are contracts/stubs until Phase 2 — do not half-implement glass chrome app-wide.
6. Brand accent is `#369CAA` via tokens (`colours.accent`).

## Checklist

- [ ] Uses `AppScreen` / `AppText` / `AppButton` / etc. where applicable
- [ ] Theme colours from runtime, light+dark both readable
- [ ] No new UI library without dependency admission
- [ ] `@expo/ui` only through system adapters
- [ ] No Bluesky design-system copy

## Pointers

- `src/theme/runtime/`
- `src/components/primitives/`
- `src/components/system/`
- `docs/architecture/bluesky-inspiration-policy.md`
- `docs/architecture/expo-native-component-list.md`

## Parity via reimplementation

- Same component **roles** as Bluesky (Button, Avatar, Post row, Settings rows) as Modula primitives.
- Prefer native chrome through `@expo/ui` universal adapters in `components/system`.
- No Bluesky ALF or design-system copy. Token-driven theme only.
