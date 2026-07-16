import {darkColours, lightColours} from '@/theme/foundations/colour'
import {
  type AccentId,
  type ResolvedColourMode,
} from '@/theme/tokens/dimensions'

export type SemanticColours = {
  canvas: string
  surface: string
  surfaceRaised: string
  surfaceMuted: string
  border: string
  text: string
  textSecondary: string
  textTertiary: string
  accent: string
  accentForeground: string
  accentSubtle: string
  destructive: string
  success: string
  backdrop: string
}

export type ColourScheme = 'light' | 'dark'

function isDarkMode(mode: ResolvedColourMode): boolean {
  return mode === 'dark' || mode === 'dim' || mode === 'oled'
}

/**
 * Resolve semantic colours for a colour mode + accent.
 * Dim / OLED currently share the dark palette (specialised palettes deferred).
 */
export function resolveSemanticColours(
  mode: ResolvedColourMode,
  _accentId: AccentId = 'modulaTeal',
): SemanticColours {
  const dark = isDarkMode(mode)
  return dark ? darkColours : lightColours
}

/** @deprecated Prefer resolveSemanticColours via theme runtime */
export const lightSemanticColours: SemanticColours = resolveSemanticColours(
  'light',
  'modulaTeal',
)

/** @deprecated Prefer resolveSemanticColours via theme runtime */
export const darkSemanticColours: SemanticColours = resolveSemanticColours(
  'dark',
  'modulaTeal',
)

export function getSemanticColours(scheme: ColourScheme): SemanticColours {
  return resolveSemanticColours(scheme === 'dark' ? 'dark' : 'light', 'modulaTeal')
}
