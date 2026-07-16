import {colour} from '@/theme/foundations/colour'
import {
  ACCENT_HEX,
  type AccentId,
  type ResolvedColourMode,
} from '@/theme/tokens/dimensions'

export type SemanticColours = {
  canvas: string
  surface: string
  surfaceRaised: string
  border: string
  text: string
  textSecondary: string
  accent: string
  accentForeground: string
  destructive: string
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
  accentId: AccentId = 'modulaTeal',
): SemanticColours {
  const accent = ACCENT_HEX[accentId] ?? colour.brandAccent
  const dark = isDarkMode(mode)

  if (!dark) {
    return {
      canvas: colour.white,
      surface: colour.neutral50,
      surfaceRaised: colour.white,
      border: colour.neutral200,
      text: colour.neutral900,
      textSecondary: colour.neutral500,
      accent,
      accentForeground: colour.white,
      destructive: colour.red600,
    }
  }

  const canvas =
    mode === 'oled' ? colour.black : mode === 'dim' ? '#1F1F23' : colour.neutral900

  return {
    canvas,
    surface: colour.black,
    surfaceRaised: colour.neutral700,
    border: colour.neutral700,
    text: colour.neutral50,
    textSecondary: colour.neutral300,
    accent,
    accentForeground: colour.white,
    destructive: colour.red600,
  }
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
