import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {KonstaProgress} from '@/platform/ui/adapters/konsta/progress.web'
import type {ModulaProgressProps} from '@/platform/ui/controls/modula-progress'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaProgress({progress, label, style, testID}: ModulaProgressProps) {
  const {spacing} = useThemeTokens()
  return (
    <View style={[{alignSelf: 'stretch', gap: spacing[2]}, style]}>
      {label ? <AppText variant="caption" colour="textSecondary">{label}</AppText> : null}
      <KonstaProgress label={label} progress={progress} testID={testID} />
    </View>
  )
}
