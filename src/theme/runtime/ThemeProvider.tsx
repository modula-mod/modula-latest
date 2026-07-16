import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {useColorScheme} from 'react-native'

import {
  DEFAULT_THEME_PREFERENCES,
  type ThemePreferences,
} from '@/theme/tokens/dimensions'
import {resolveTheme, type ThemeTokens} from '@/theme/runtime/resolveTheme'

export type ThemeContextValue = ThemeTokens & {
  setPreferences: (patch: Partial<ThemePreferences>) => void
  setColourMode: (mode: ThemePreferences['colourMode']) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({children}: PropsWithChildren) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light'
  const [preferences, setPreferencesState] = useState<ThemePreferences>(
    DEFAULT_THEME_PREFERENCES,
  )

  const setPreferences = useCallback((patch: Partial<ThemePreferences>) => {
    setPreferencesState(prev => ({...prev, ...patch}))
  }, [])

  const setColourMode = useCallback((mode: ThemePreferences['colourMode']) => {
    setPreferencesState(prev => ({...prev, colourMode: mode}))
  }, [])

  const value = useMemo<ThemeContextValue>(() => {
    const tokens = resolveTheme(preferences, system)
    return {
      ...tokens,
      setPreferences,
      setColourMode,
    }
  }, [preferences, system, setPreferences, setColourMode])

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}
