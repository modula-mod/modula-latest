import {useContext} from 'react'

import {
  ThemeTokensContext,
  type ThemeTokenSet,
} from '@/theme/runtime/ThemeTokensContext'

export type {ThemeTokenSet}

export function useThemeTokens(): ThemeTokenSet {
  const context = useContext(ThemeTokensContext)
  if (!context) {
    throw new Error('useThemeTokens must be used within AppearanceProvider')
  }
  return context
}
