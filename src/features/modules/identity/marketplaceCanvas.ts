import type {ResolvedAppearanceMode} from '@/theme/contracts'

/**
 * Product Hub is art-directed separately from the rest of the shell.
 * Dark and OLED use a true-black marketplace canvas so artwork can pop.
 * Dim keeps its twilight canvas. Light stays paper white.
 */
export function marketplaceCanvas(
  mode: ResolvedAppearanceMode,
  fallbackCanvas: string,
): string {
  if (mode === 'oled' || mode === 'dark') return '#000000'
  return fallbackCanvas
}

export function isMarketplaceTrueBlack(mode: ResolvedAppearanceMode): boolean {
  return mode === 'oled' || mode === 'dark'
}
