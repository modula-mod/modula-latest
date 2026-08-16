/**
 * Toolbar icon chrome. One layer only:
 * - `plain` — glyph inside a native header capsule (iOS 26 shared glass).
 * - `glass` — circular overlay on artwork / SecondaryScreenHeader.
 * Never put glass discs inside a header capsule.
 *
 * Overlay glass uses extraLarge (Expo UI glass circle). Capsule glyphs stay regular.
 */
export type ToolbarChrome = 'glass' | 'plain'

/** Minimum hit for capsule glyphs and compact CTAs. */
export const TOOLBAR_HIT = 44

/** Overlay extraLarge glass circle / ControlGroup host. */
export const OVERLAY_GLASS_HIT = 52
