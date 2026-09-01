import {ActivityIndicator, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleLoadingState({label = 'Opening module'}: {label?: string}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{alignItems: 'center', gap: spacing[3], padding: spacing[6]}}>
      <ActivityIndicator color={colours.accent} />
      <AppText variant="headline">{label}</AppText>
      <AppText variant="body" colour="textSecondary">
        This only takes a moment.
      </AppText>
    </View>
  )
}
