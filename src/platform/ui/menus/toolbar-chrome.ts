/**
 * Toolbar icon chrome. One layer only:
 * - `plain` — glyph inside a native header capsule (iOS 26 shared glass).
 * - `glass` — circular overlay on artwork / SecondaryScreenHeader.
 * Never put glass discs inside a header capsule.
 *
 * Overlay glass uses the large control so back / share read as 44pt
 * App Store circles. Capsule glyphs stay regular.
 */
export type ToolbarChrome = 'glass' | 'plain'

/** Toolbar hit target — back, share, overflow, compact CTAs. */
export const TOOLBAR_HIT = 44
