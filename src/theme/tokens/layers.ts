/**
 * Semantic elevation / z-index layers.
 *
 * Feature code must use these tokens instead of ad-hoc values like 99999.
 * Order is the interaction stack, not a visual style.
 *
 *   LAYER 0 — content
 *   LAYER 1 — raised / scroll-edge
 *   LAYER 2 — sticky + navigation
 *   LAYER 3 — contextual and modal overlays
 */
export const LAYERS = {
  content: 0,
  raisedContent: 1,
  sticky: 4,
  navigation: 8,
  popover: 16,
  sheet: 24,
  dialog: 32,
  toast: 40,
  critical: 48,
} as const

export type LayerId = keyof typeof LAYERS

export function layerZIndex(id: LayerId): number {
  return LAYERS[id]
}
