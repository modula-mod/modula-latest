# Modula Motion System

Infrastructure: **Reanimated 4.5.1** and **Gesture Handler 2.32.0** (installed). Do not add Moti.

Motion explains change. It does not continuously decorate static content.

## Proposed tokens (tune in UI Lab — not Apple-standard claims)

```ts
export const motion = {
  duration: {
    instant: 0,
    micro: 90,
    quick: 140,
    standard: 200,
    expressive: 280,
    overlay: 320,
  },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    enter: [0.16, 1, 0.3, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
    linear: [0, 0, 1, 1] as const,
  },
  spring: {
    press: {mass: 0.65, damping: 19, stiffness: 260},
    snappy: {mass: 0.8, damping: 20, stiffness: 230},
    standard: {mass: 1, damping: 22, stiffness: 180},
    spatial: {mass: 1, damping: 24, stiffness: 150},
  },
} as const
```

Place the canonical module next to existing theme motion (`src/theme/contracts/materials.ts` / `src/platform/ui/motion`), not a new package.

| Token | Primary uses | Reduced-motion equivalent |
| --- | --- | --- |
| instant | state correctness | same |
| micro 90ms | pressed / hover | instant |
| quick 140ms | icon state, small disclosure | 90–120ms fade |
| standard 200ms | segment selection | cross-fade |
| expressive 280ms | menu / reaction appearance | 120ms fade |
| overlay 320ms | sheet / backdrop when not native-driven | 120ms fade |
| spring.press | press scale ≤ ~2–3% | no scale |
| spring.snappy | reaction target | state change only |
| spring.standard | drawer settlement | short fade / instant |
| spring.spatial | larger connected transitions | cross-fade |

Use Reanimated `ReduceMotion.System` / `useReducedMotion`. Also honour `AccessibilityInfo` reduced motion, reduced transparency, bold text, and screen reader.

## Performance rules

- No animated blur behind every feed cell.
- No per-frame React state during pan gestures.
- No unbounded shadow stacks.
- No full-resolution images when a thumbnail suffices.
- No Skia canvas for a normal native control.
- No nested virtualized lists without an explicit reason.
- No unstable list keys.
- No animation that forces continuous JS layout.

Skia (`@shopify/react-native-skia` 2.6.2) is for effects that views cannot do cheaply.

## 7M-A

Document only. Do not retune production motion in this phase.
