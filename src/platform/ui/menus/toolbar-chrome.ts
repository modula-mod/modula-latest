import {controls} from '@/theme/foundations/controls'

/**
 * Toolbar icon chrome. One layer only:
 * - `plain` — glyph inside a native header capsule (iOS 26 shared glass).
 * - `glass` — circular overlay on artwork / SecondaryScreenHeader.
 * Never put glass discs inside a header capsule.
 *
 * Overlay glass uses extraLarge (Expo UI glass circle). Capsule glyphs stay regular.
 */
export type ToolbarChrome = 'glass' | 'plain'

/** Minimum hit for capsule glyphs, Profile header icons, and compact CTAs. */
export const TOOLBAR_HIT = controls.touchTarget.minimum

/** Standalone overlay controls keep a 44pt hit target with a smaller visual. */
export const OVERLAY_GLASS_HIT = controls.touchTarget.minimum

/**
 * Overlay grouped trailing actions (Customize / Module Detail).
 * Same 44pt hits as Profile `unstable_header*Items`. Adjacent controls share
 * the capsule without a decorative gutter.
 */
export const OVERLAY_GROUP_HIT = TOOLBAR_HIT
export const OVERLAY_GROUP_GAP = 0
export const OVERLAY_GROUP_MIN_WIDTH = OVERLAY_GROUP_HIT * 2 + OVERLAY_GROUP_GAP

/** Capsule width for n adjacent icon slots. */
export function overlayGroupWidth(itemCount: number): number {
  const count = Math.max(1, itemCount)
  return count * OVERLAY_GROUP_HIT + Math.max(0, count - 1) * OVERLAY_GROUP_GAP
}

/** Compact filled action chip width inside a control group (e.g. Open). */
export const OVERLAY_GROUP_ACTION_WIDTH = 56

export function overlayGroupItemWidth(kind: 'icon' | 'action'): number {
  return kind === 'action' ? OVERLAY_GROUP_ACTION_WIDTH : OVERLAY_GROUP_HIT
}

/** Capsule width for a mixed icon / action slot list. */
export function overlayGroupWidthForKinds(kinds: ('icon' | 'action')[]): number {
  if (!kinds.length) return OVERLAY_GROUP_HIT
  return kinds.reduce(
    (sum, kind, index) =>
      sum + overlayGroupItemWidth(kind) + (index > 0 ? OVERLAY_GROUP_GAP : 0),
    0,
  )
}
