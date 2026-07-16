import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function useTheme() {
  const tokens = useThemeTokens()
  const actions = useAppearanceActions()

  return {
    ...tokens,
    setPreferences: () => {},
    setColourMode: actions.setMode,
  }
}
