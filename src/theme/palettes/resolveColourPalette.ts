import palettes from '@/theme/data/palettes.json'
import type {
  AccentTokens,
  PaletteCore,
  ResolvedAppearanceMode,
  SemanticColours,
  ThemeFamily,
} from '@/theme/contracts'
import {mixHex} from '@/theme/accents/colourMath'
import {validatePalette} from '@/theme/palettes/validatePalette'

type PaletteModeMap = Partial<Record<ResolvedAppearanceMode, PaletteCore>>
type PaletteFamilyMap = Record<ThemeFamily, PaletteModeMap>

const paletteData = palettes as PaletteFamilyMap

function fallbackPalette(mode: ResolvedAppearanceMode): PaletteCore {
  const standard = paletteData.standard?.[mode] ?? paletteData.standard?.light
  if (!validatePalette(standard)) {
    throw new Error(`Invalid standard ${mode} palette`)
  }
  return standard
}

export function resolveColourPalette(
  family: ThemeFamily,
  mode: ResolvedAppearanceMode,
): PaletteCore {
  const familyForMode = mode === 'light' ? 'standard' : family
  const candidate = paletteData[familyForMode]?.[mode]

  if (validatePalette(candidate)) {
    return candidate
  }

  return fallbackPalette(mode)
}

export function resolveSemanticColours(
  family: ThemeFamily,
  mode: ResolvedAppearanceMode,
  accent: AccentTokens,
  increaseContrast: boolean,
): SemanticColours {
  const palette = resolveColourPalette(family, mode)
  const isDark = mode !== 'light'
  const inverse = isDark ? '#111827' : '#FFFFFF'
  const overlay = isDark
    ? mixHex(palette.surface2, '#FFFFFF', mode === 'oled' ? 0.03 : 0.08)
    : mixHex(palette.surface2, '#000000', 0.03)
  const destructive = isDark ? '#FF6B70' : '#D92D20'
  const warning = isDark ? '#FACC15' : '#B54708'
  const success = isDark ? '#45BD7B' : '#067647'
  const info = isDark ? '#67E8F9' : '#087EA4'

  return {
    canvas: palette.canvas,
    surface1: palette.surface1,
    surface2: palette.surface2,
    surface3: palette.surface3,
    surfaceOverlay: overlay,
    border: palette.border,
    borderStrong: increaseContrast ? palette.borderStrong : palette.border,
    separator: increaseContrast ? palette.borderStrong : palette.border,
    textMain: palette.textMain,
    textSub: palette.textSub,
    textMuted: palette.textMuted,
    textInverse: inverse,
    accent: accent.base,
    accentForeground: accent.foreground,
    accentSubtle: accent.subtle,
    accentBorder: accent.border,
    accentPressed: accent.pressed,
    destructive,
    destructiveSubtle: mixHex(destructive, palette.canvas, isDark ? 0.78 : 0.9),
    warning,
    success,
    info,
    backdrop: isDark ? '#000000' : '#111827',
    shadow: isDark ? '#000000' : '#111827',
    focusRing: accent.focus,
    selection: accent.subtleStrong,
    mediaGlowFallback: accent.subtleStrong,
  }
}
