import {useContext} from 'react'

import {ThemeContext, type ThemeContextValue} from '@/theme/runtime/ThemeProvider'
import {resolveTheme} from '@/theme/runtime/resolveTheme'

/**
 * Access the resolved theme. Falls back to a static light theme if used
 * outside ThemeProvider (should not happen in app routes).
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx) {
    return ctx
  }
  const fallback = resolveTheme()
  return {
    ...fallback,
    setPreferences: () => {},
    setColourMode: () => {},
  }
}
