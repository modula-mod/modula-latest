import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Web / Android fallback — theme-aware segmented row, optionally scrollable.
 * Uses RN pressables so each segment always receives taps.
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  scrollable = false,
  segmentMinWidth = 92,
}: ModulaSegmentedPickerProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const contentWidth = Math.max(
    windowWidth - 32,
    options.length * segmentMinWidth,
  )

  const row = (
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
          width: scrollable ? contentWidth : '100%',
          minWidth: scrollable ? contentWidth : undefined,
        },
        style,
      ]}>
      {options.map(option => {
        const selected = option.value === value
        return (
          <AppPressable
            key={option.value}
            accessibilityRole="button"
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
                minWidth: scrollable ? segmentMinWidth - 8 : undefined,
                flex: scrollable ? undefined : 1,
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

  if (!scrollable) return row

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled>
      {row}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
})
