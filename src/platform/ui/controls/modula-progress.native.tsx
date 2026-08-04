import {Host} from '@expo/ui'
import {ProgressView} from '@expo/ui/swift-ui'
import type {StyleProp, ViewStyle} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaProgressProps = {
  /** 0–1 when determinate; omit for indeterminate. */
  progress?: number
  label?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Native progress — values must reflect real lifecycle/bytes, not timers. */
export function ModulaProgress({progress, label, style, testID}: ModulaProgressProps) {
  const {colours, scheme} = useThemeTokens()
  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{alignSelf: 'stretch', minHeight: 8}, style]}
      accessibilityLabel={label}
      testID={testID}>
      <ProgressView value={progress} />
    </Host>
  )
}
