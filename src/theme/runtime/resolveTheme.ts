import {radius} from '@/theme/foundations/radius'
import {spacing} from '@/theme/foundations/spacing'
import {typography} from '@/theme/foundations/typography'
import {
  DEFAULT_THEME_PREFERENCES,
  type ThemePreferences,
} from '@/theme/tokens/dimensions'
import {
  resolveSemanticColours,
  type SemanticColours,
} from '@/theme/tokens/semantic'
import {
  resolveMaterialTokens,
  type MaterialTokens,
} from '@/theme/tokens/surface'

export type ThemeTokens = {
  preferences: ThemePreferences
  resolvedColourMode: import('@/theme/tokens/dimensions').ResolvedColourMode
  /** light | dark — for StatusBar and coarse branching */
  scheme: 'light' | 'dark'
  colours: SemanticColours
  material: MaterialTokens
  spacing: typeof spacing
  radius: typeof radius
  typography: typeof typography
}

export function resolveColourMode(
  preference: ThemePreferences['colourMode'],
  systemScheme: 'light' | 'dark',
): import('@/theme/tokens/dimensions').ResolvedColourMode {
  if (preference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light'
  }
  return preference
}

export function resolveTheme(
  preferences: ThemePreferences = DEFAULT_THEME_PREFERENCES,
  systemScheme: 'light' | 'dark' = 'light',
): ThemeTokens {
  const resolvedColourMode = resolveColourMode(
    preferences.colourMode,
    systemScheme,
  )
  const scheme: 'light' | 'dark' =
    resolvedColourMode === 'light' ? 'light' : 'dark'

  return {
    preferences,
    resolvedColourMode,
    scheme,
    colours: resolveSemanticColours(resolvedColourMode, preferences.accent),
    material: resolveMaterialTokens(preferences.surfaceType),
    spacing,
    radius,
    typography,
  }
}
