# Theme

Token-driven appearance for Modula.

## Layers

- `foundations/` — raw scales (colour, spacing, radius, typography)
- `tokens/` — semantic colours, dimensions, Surface Type contracts
- `runtime/` — preferences → immutable `ThemeTokens` via `ThemeProvider`

## Dimensions (Theme Architecture v5 adaptation)

Colour mode × theme family × accent × Surface Type. See `docs/product/theme-architecture-v5.md`.

## Working now

- System / light / dark resolution (`dim` / `oled` map to dark canvas stubs)
- Accent Modula Teal `#369CAA`
- Solid material tokens; other Surface Types are deferred stubs

## Deferred

Full family palettes; Glass / Liquid Glass / Glay / Skeuo / Neo engines; persisted preferences.
