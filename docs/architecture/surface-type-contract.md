# Surface Type Contract

Surface Type changes material treatment only.

It must not change:

- navigation destinations;
- component hierarchy;
- information architecture;
- content order;
- interaction semantics;
- arbitrary screen padding.

Supported Surface Types:

- Native
- Solid
- Glass
- Glay
- Minimal Spatial
- Skeuomorphic
- Neomorphic

Material decisions belong in `src/components/materials` and `src/theme/materials`.

Product screens must not import `BlurView`, `GlassView`, `LinearGradient`, or platform shadow/elevation formulas directly.

Native glass is iOS-specific and runtime-gated. Unsupported devices fall back through `MaterialSurface`.

Reduce Transparency forces opaque, non-glass material treatment.
