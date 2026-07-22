import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleLoadingState({label = 'Loading module'}: {label?: string}) {
  const {spacing} = useThemeTokens()
  return (
    <Surface variant="contained" style={{padding: spacing[4], gap: spacing[2]}}>
      <View accessibilityRole="progressbar">
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" colour="textSecondary">
          Resolving installation, permissions and view declarations.
        </AppText>
      </View>
    </Surface>
  )
}
