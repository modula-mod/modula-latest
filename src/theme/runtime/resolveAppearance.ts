import type {
  AppearancePreferences,
  ResolvedAppearance,
  ResolvedAppearanceMode,
  SystemAccessibilityState,
  TypographyToken,
  TypographyTokens,
} from '@/theme/contracts'
import {resolveAccessibility} from '@/theme/accessibility'
import {resolveAccent} from '@/theme/accents'
import {
  DEFAULT_MOTION_TOKENS,
  DEFAULT_SYSTEM_ACCESSIBILITY,
  REDUCED_MOTION_TOKENS,
} from '@/theme/data/defaults'
import {resolveMaterialTokens} from '@/theme/materials'
import {resolveSemanticColours} from '@/theme/palettes'

const BASE_TYPOGRAPHY: TypographyTokens = {
  display: {fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: 0},
  title1: {fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: 0},
  title2: {fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: 0},
  headline: {fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: 0},
  body: {fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: 0},
  bodyStrong: {fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: 0},
  label: {fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0},
  caption: {fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0},
  micro: {fontSize: 11, lineHeight: 14, fontWeight: '500', letterSpacing: 0},
}

function resolveMode(
  preference: AppearancePreferences['mode'],
  systemColourScheme: 'light' | 'dark' | null | undefined,
): ResolvedAppearanceMode {
  if (preference === 'system') {
    return systemColourScheme === 'dark' ? 'dark' : 'light'
  }
  return preference
}

function resolveWeight(
  weight: TypographyToken['fontWeight'],
  boldText: boolean,
): TypographyToken['fontWeight'] {
  if (!boldText) {
    return weight
  }

  if (weight === '400') return '500'
  if (weight === '500') return '600'
  return '700'
}

function resolveTypography(
  preferences: AppearancePreferences,
  boldText: boolean,
): TypographyTokens {
  return Object.fromEntries(
    Object.entries(BASE_TYPOGRAPHY).map(([role, token]) => [
      role,
      {
        ...token,
        fontSize: Math.round(token.fontSize * preferences.textScale * 10) / 10,
        lineHeight: Math.round(token.lineHeight * preferences.textScale * 10) / 10,
        fontWeight: resolveWeight(token.fontWeight, boldText),
      },
    ]),
  ) as TypographyTokens
}

export function resolveAppearance(
  preferences: AppearancePreferences,
  systemColourScheme: 'light' | 'dark' | null | undefined,
  systemAccessibility: SystemAccessibilityState = DEFAULT_SYSTEM_ACCESSIBILITY,
): ResolvedAppearance {
  const resolvedMode = resolveMode(preferences.mode, systemColourScheme)
  const isDark = resolvedMode !== 'light'
  const isOLED = resolvedMode === 'oled'
  const accessibility = resolveAccessibility(preferences, systemAccessibility)
  const accent = resolveAccent(
    preferences.accentId,
    preferences.customAccent,
    isDark,
    accessibility.increaseContrast,
  )
  const colours = resolveSemanticColours(
    preferences.family,
    resolvedMode,
    accent,
    accessibility.increaseContrast,
  )
  const typography = resolveTypography(preferences, accessibility.boldText)
  const materials = resolveMaterialTokens(
    preferences.surfaceType,
    colours,
    isDark,
    accessibility.reduceTransparency,
    accessibility.increaseContrast,
  )
  const motion = accessibility.reduceMotion
    ? REDUCED_MOTION_TOKENS
    : DEFAULT_MOTION_TOKENS

  return {
    preferences,
    resolvedMode,
    resolvedFamily: preferences.family,
    isDark,
    isOLED,
    accessibility,
    colours,
    accent,
    typography,
    materials,
    motion,
  }
}
