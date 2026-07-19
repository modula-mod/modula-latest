import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSegmentedOption = {
  value: string
  label: string
}

type ModulaSegmentedPickerProps = {
  options: ModulaSegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Web / Android fallback — segmented row matching the Expo UI lab control.
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
}: ModulaSegmentedPickerProps) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          backgroundColor: colours.surfaceMuted,
          borderRadius: radius.round,
          padding: 2,
          gap: spacing[1],
        },
        style,
      ]}>
      {options.map(option => {
        const selected = option.value === value
        return (
          <AppPressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            accessibilityLabel={option.label}
            onPress={() => onValueChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? colours.surface : 'transparent',
                borderRadius: radius.round,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}>
            <AppText
              variant="label"
              style={{
                color: selected ? colours.text : colours.textSecondary,
                textAlign: 'center',
              }}
              numberOfLines={1}>
              {option.label}
            </AppText>
          </AppPressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  segment: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
  },
})
