# Modula Universal Theme Architecture (v5 adaptation)

> **Provenance:** Source document was *Modula Universal Theme Architecture v5* (`.docx`), written for the older Bluesky-based Modula effort.
>
> **Status on this machine (2026-07-16):** The owner path `/Users/msjoy/Downloads/Modula_Universal_Theme_Architecture_v5.docx` was **not found**. Searched `/Users/msjoy/Downloads`, `/home/andrei`, `/root`, `/tmp`, and related attachment roots — no matching `.docx` / `.md` / `.pdf`.
>
> This file is a **greenfield adaptation** of the product Appearance / Surface Type brief (§18–19) plus Phase 0 token foundations. When the owner uploads the v5 docx, replace/expand this document with the extracted content (adapted — no Bluesky ALF coupling).

## Goals

- One immutable **resolved theme** consumed by primitives and features.
- Independent dimensions that compose without overwriting each other.
- Protocol- and shell-agnostic — no Bluesky ALF, no `@bsky.app` theme packages.
- Material engines (Glass, Liquid Glass, Skeuo, Neo) are **pluggable stubs** until Phase 2+.

## Independent dimensions

| Dimension | Values (Phase 1) | Runtime today |
|---|---|---|
| Colour mode | `system`, `light`, `dim`, `dark`, `oled` | `system` → light/dark; dim/oled map to dark palette stubs |
| Theme family | `standard`, `forest`, `ocean`, `plum`, `espresso`, `spaceGray` | `standard` only resolved; others reserved |
| Accent | `modulaTeal` (`#369CAA`) + reserved named accents | `modulaTeal` active |
| Surface type | `native`, `solid`, `glass`, `glay`, `minimalSpatial`, `skeuo`, `neo` | `solid` / `native` stubs; materials deferred |

Example composition (product brief):

```text
Ocean + OLED + Teal Accent + Glass Surface
→ one resolved ThemeTokens object
```

## Token layers

```text
foundations/     raw scales (colour, spacing, radius, typography)
tokens/          semantic colour + material contracts
runtime/         preference → resolved ThemeTokens
primitives/      consume ThemeTokens only
```

## Surface Type contract (deferred engines)

Surface Type controls **material behaviour**, not merely border radius:

- opacity, blur, elevation, edge treatment, border
- highlights, shadow, texture, depth, motion response
- platform-native effects (iOS Liquid Glass, Android Material, web CSS)

See `src/theme/tokens/surface.ts` and `src/theme/README.md`.

## What is implemented now vs deferred

| Implemented | Deferred |
|---|---|
| Types for all dimensions | Full family palettes |
| System → light/dark resolution | Dim / OLED specialised palettes |
| Accent Modula Teal | Marketplace / custom accents |
| Solid material tokens | Glass / Glay / Skeuo / Neo engines |
| Semantic colours on primitives | expo-glass-effect wiring as default chrome |
| Appearance settings stub | User-persisted preferences |

## Adaptation rules (greenfield)

1. Do not import Bluesky ALF or copy its theme provider tree.
2. Primitives read `useTheme()` / `ThemeProvider` only.
3. Features must not hardcode `#369CAA` — use `colours.accent`.
4. `@expo/ui` chrome goes through `src/components/system/`, not swift-ui imports in features.
5. Admit no speculative theme libraries (NativeWind, Tamagui, Skia theme kits, etc.).
