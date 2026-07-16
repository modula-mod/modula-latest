import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaWordmark() {
  const {colours} = useThemeTokens()
  return (
    <AppText
      variant="headline"
      accessibilityRole="header"
      style={{color: colours.text, letterSpacing: 1}}>
      MODULA
    </AppText>
  )
}
