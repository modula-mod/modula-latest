import {ActivityIndicator, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaProgressProps = {
  progress?: number
  label?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Web / fallback progress. */
export function ModulaProgress({progress, label, style, testID}: ModulaProgressProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const clamped =
    typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : undefined

  return (
    <View style={[{alignSelf: 'stretch', gap: spacing[2]}, style]} testID={testID}>
      {label ? (
        <AppText variant="caption" colour="textSecondary">
          {label}
        </AppText>
      ) : null}
      {clamped == null ? (
        <ActivityIndicator color={colours.accent} />
      ) : (
        <View
          style={{
            height: 6,
            borderRadius: radius.full,
            backgroundColor: colours.border,
            overflow: 'hidden',
          }}>
          <View
            style={{
              width: `${Math.round(clamped * 100)}%`,
              height: '100%',
              backgroundColor: colours.accent,
            }}
          />
        </View>
      )}
    </View>
  )
}
