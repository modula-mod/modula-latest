# Modula native UI principles (Phase 7J)

Date: 2026-08-11  
Branch: `phase7j-product-convergence`  
Status: **baseline principles locked** — progressive screen redesign continues after auth/base-build PASS.

## Non-negotiables

1. **Primitives consume theme tokens** via `useTheme()` / `useThemeTokens` — no raw hex in features (except foundations).
2. **`@expo/ui` only through adapters** in `src/components/system/*` and `src/platform/ui/*`. Features never import `@expo/ui/swift-ui` directly.
3. **Platform icon abstraction** — `AppIcon` / `ModulaIconButton` map SF Symbols (iOS), Material (Android), SVG (web). Zero missing-glyph boxes on product surfaces.
4. **Surface Types are materials**, not border-radius themes: native / solid / glass / glay / minimalSpatial / skeuo / neo — OLED colour mode uses `#000000`.
5. **Motion respects Reduce Motion** — springs from `MotionTokens`; fade-only when reduced.
6. **`/profile` is canonical** — no Identity Centre duplicate.
7. **Modules stay external packages** — Product Hub hosts; Vault Notes is not inlined under `src/features/vault-notes/`.
8. **Real media URLs** — fix 404/403/CORS/CSP; do not blanket-placeholder away broken assets.
9. **Product acceptance uses** `https://api.modula.digital` — SSH tunnel (`ssh -N -L 4020:127.0.0.1:4020 modula-vps`) is diagnostics only.

## Composition

- One job per section; brand-first on promotional surfaces.
- Prefer existing Modula primitives (`AppScreen`, `AppText`, `AppButton`, `ModulaTextInput`, `ModulaSheet`, segmented pickers) before new packages.
- ProgressiveBlur / floating tab chrome / sticky feed modes are accepted patterns already on this branch — refine, do not resurrect obsolete sticky-Host overlays or opaque glass slabs.

## Redesign order (after auth)

1. Auth + registration + OTP polish  
2. Drawer pan/spring + floating bottom nav  
3. Home hierarchy, Stories (real data), feed segments, post card  
4. Reactions, comments  
5. Settings / security / Appearance / Surface Types  
6. Product Hub + Vault Notes host  
7. Search / Discover / Activity  
8. a11y + performance + UI lab screen matrix

## Related

- `.cursor/skills/modula-ui/SKILL.md`
- `docs/research/phase7j-expo-ui-component-map.md`
- `docs/research/phase7j-ui-component-candidates.md`
- `docs/validation/phase7j-ui-screen-matrix.md`
