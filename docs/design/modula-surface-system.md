# Modula Surface System

Canonical types already live in `src/theme/contracts/appearance.ts`:

```ts
export type SurfaceType =
  | 'native'
  | 'solid'
  | 'glass'
  | 'glay'
  | 'minimalSpatial'
  | 'skeuomorphic'
  | 'neomorphic'
```

Do not invent a parallel union. Research-pack names `skeuo` / `neo` map to **skeuomorphic** / **neomorphic**.

## Roles

Existing material roles (see `src/theme/contracts` and `MaterialSurface`) include canvas, content, card/grouped, input, floating, overlay, navigation. New components must pick a role; they must not pick a random colour.

## Resolver, not per-screen materials

`MaterialSurface` already branches:

- native glass when `useNativeGlass`
- `expo-blur` when `blurIntensity > 0`
- solid otherwise

`expo-glass-effect` and `@callstack/liquid-glass` stay behind this adapter. Product screens never import them.

Reduce Transparency forces solid (`resolveMaterialTokens.ts`). Keep that invariant.

## Invariants

1. Surface Type changes material, elevation, translucency, and borders — not information architecture.
2. Glass is chrome. Feed posts, Settings rows, and module copy are content.
3. OLED canvas is true black; do not grey-wash the shell to “match glass”.
4. Light / dim / dark / OLED must all remain readable for every Surface Type used in UI Lab.
5. A component that looks correct only on `solid` + light is not accepted.

## 7M-A / 7M-B split

- **7M-A:** document the contract (this file). No engine rewrite.
- **7M-B:** complete missing glass / OLED / Reduce Transparency paths **in the existing resolver**, then prove them in UI Lab.
- **7M-C:** apply to product chrome after visual approval. Do not spray glass onto every card.
