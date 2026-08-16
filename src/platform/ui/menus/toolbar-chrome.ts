/**
 * Toolbar icon chrome. One layer only:
 * - `plain` — glyph inside a native header capsule (iOS 26 shared glass).
 * - `glass` — circular overlay on artwork / SecondaryScreenHeader.
 * Never put glass discs inside a header capsule.
 */
export type ToolbarChrome = 'glass' | 'plain'
