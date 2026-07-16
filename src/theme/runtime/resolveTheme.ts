import type {AppearancePreferences, ResolvedAppearanceMode} from '@/theme/contracts'
import {DEFAULT_APPEARANCE_PREFERENCES} from '@/theme/data/defaults'
import {resolveAppearance} from '@/theme/runtime/resolveAppearance'

export type ThemeTokens = ReturnType<typeof resolveAppearance>

export function resolveColourMode(
  preference: AppearancePreferences['mode'],
  systemScheme: 'light' | 'dark',
): ResolvedAppearanceMode {
  if (preference === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light'
  }
  return preference
}

export function resolveTheme(
  preferences: AppearancePreferences = DEFAULT_APPEARANCE_PREFERENCES,
  systemScheme: 'light' | 'dark' = 'light',
): ThemeTokens {
  return resolveAppearance(preferences, systemScheme)
}
