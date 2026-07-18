# Apple Liquid Glass / HIG inspiration remap

**Status:** design inspiration only  
**Rule:** study navigation material, accessibility, and motion hierarchy. Reimplement through Modula Surface Types and theme tokens.

---

## Modula Surface Type alignment

Liquid Glass and current HIG direction are useful because they treat glass as a navigation and spatial material, not a decoration applied everywhere.

Modula already names this direction in:

- `docs/product/theme-architecture-v5.md`
- `src/theme/tokens/surface.ts`
- `.cursor/skills/modula-ui/SKILL.md`

Surface Types remain contracts/stubs until their engines are intentionally implemented. The design rule is still useful now: material should clarify hierarchy.

---

## What to learn

### Glass is navigation layer only

Modula remap:

- Use glass for tab bars, navigation bars, floating controls, sheets, and transient chrome.
- Keep content solid: posts, settings rows, module cards, forms, and dense reading surfaces should remain legible.
- Treat glass as a layer above content, not as a replacement for every surface.

This matches the existing Modula direction: Surface Type can change depth and translucency while content primitives remain token-driven.

### Minimize chrome on scroll

HIG patterns reward interfaces that get out of the way when users read, scan, or work.

Modula remap:

- Feed and Profile-OS surfaces can reduce secondary chrome during scroll.
- Navigation can compress or become translucent when context is obvious.
- Module workspaces should preserve controls that prevent destructive or confusing states.

### Reduce Transparency accessibility

Glass must obey accessibility preferences.

Modula remap:

- Reduce Transparency should fall back to solid or raised surfaces.
- Contrast must remain readable in light, dark, dim, and OLED modes.
- Visual hierarchy should not depend on blur alone.

### Do not glass everything

The product risk is visual novelty overwhelming content.

Modula remap:

- Content stays solid.
- Navigation and sheets may be glass.
- Dense social rows use hairlines and canvas contrast before blur.
- Module dashboards can use cards when grouping is more important than translucency.

---

## Implementation guardrails

- Features consume `useTheme()` / `useThemeTokens()` and primitives; do not hardcode material behavior in product screens.
- `@expo/ui` and platform material APIs go through `src/components/system/` adapters.
- `Glass` is one Surface Type among `native`, `solid`, `glass`, `glay`, `minimalSpatial`, `skeuo`, and `neo`.
- Respect the theme architecture v5 rule that material engines are deferred until implemented intentionally.

See also:

- [Theme architecture v5](../product/theme-architecture-v5.md)
- [Material usage rules](./material-usage-rules.md)
