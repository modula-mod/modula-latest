import {useMemo} from 'react'
import {useColorScheme} from 'react-native'

import {radius} from '@/theme/foundations/radius'
import {spacing} from '@/theme/foundations/spacing'
import {typography} from '@/theme/foundations/typography'
import {
  resolveSemanticColours,
  type SemanticColours,
} from '@/theme/tokens/semantic'

export type AppearanceMode = 'system' | 'light' | 'dark' | 'oled'

export type ThemeTokenSet = {
  appearanceMode: AppearanceMode
  resolvedColourMode: 'light' | 'dark' | 'oled'
  scheme: 'light' | 'dark'
  colours: SemanticColours
  spacing: typeof spacing
  radius: typeof radius
  typography: typeof typography
}

export function useThemeTokens(mode: AppearanceMode = 'system'): ThemeTokenSet {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light'

  return useMemo(() => {
    const resolvedColourMode =
      mode === 'system' ? systemScheme : mode === 'oled' ? 'oled' : mode
    const scheme = resolvedColourMode === 'light' ? 'light' : 'dark'

    return {
      appearanceMode: mode,
      resolvedColourMode,
      scheme,
      colours: resolveSemanticColours(resolvedColourMode),
      spacing,
      radius,
      typography,
    }
  }, [mode, systemScheme])
}
