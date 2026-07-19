import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Web / Android fallback — theme-aware segmented row (native Expo UI on iOS).
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
          padding: 3,
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
            accessibilityState={{selected, disabled: !!option.disabled}}
            accessibilityLabel={option.label}
            disabled={option.disabled}
            onPress={() => onValueChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? colours.accent : 'transparent',
                borderRadius: radius.round,
                opacity: option.disabled ? 0.45 : 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              },
            ]}>
            <AppText
              variant="label"
              style={{
                color: selected
                  ? colours.accentForeground
                  : colours.textSecondary,
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
    minHeight: 34,
  },
})
