# Phase 4.5 — Liquid glass expandable tabs

## Status

Authorized pattern from [iamitkhatkar/rn-expandable-tab-liquid-glass](https://github.com/iamitkhatkar/rn-expandable-tab-liquid-glass) (demo app, not npm). Adapted under `src/platform/ui/navigation/`.

## Gating (crash prevention)

`@callstack/liquid-glass` registers `NativeLiquidGlassModule` and crashes on **static import** when the native binary is missing (`TurboModuleRegistry.getEnforcing`).

Modula:

1. Probes with `TurboModuleRegistry.get('NativeLiquidGlassModule')` (non-enforcing) in `liquid-glass-availability.ts`
2. Skips liquid glass when `Constants.executionEnvironment === StoreClient` (Expo Go)
3. Dynamically `require`s `modula-liquid-glass-tab-bar` only when the probe passes
4. Otherwise renders Expo Router `NativeTabs` (previous stable path)

## Rebuild for full liquid glass

```bash
cd ios && pod install && cd ..
pnpm exec expo run:ios
```

Expo Go always uses NativeTabs fallback.

## Create tab policy

Create is never a tab destination. Expand/plus opens Composer; Home toolbar compose remains.
