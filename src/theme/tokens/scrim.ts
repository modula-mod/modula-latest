import type {ResolvedAppearanceMode} from '@/theme/contracts/appearance'

/**
 * Modal / drawer scrim tokens.
 * Light: subtle darkening. Dark/OLED: contrast without greying the canvas.
 * Reduce Transparency: higher opacity, no blur dependency.
 */
export function scrimColour(
  mode: ResolvedAppearanceMode | 'light' | 'dark',
  reduceTransparency = false,
): string {
  const dark = mode === 'dark' || mode === 'oled' || mode === 'dim'
  if (reduceTransparency) {
    return dark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(20, 18, 16, 0.48)'
  }
  if (mode === 'oled') return 'rgba(0, 0, 0, 0.55)'
  if (dark) return 'rgba(0, 0, 0, 0.46)'
  return 'rgba(20, 18, 16, 0.28)'
}
