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

const DEFAULT_SCROLL_MAX_WIDTH = 360
const DEFAULT_SEGMENT_MIN_WIDTH = 88

/**
 * Theme-token segmented control:
 * - Track → `surfaceMuted`
 * - Selected capsule → `surface` (+ hairline border)
 * - Labels → `text` / `textSecondary`
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  appearance = 'segmented',
  scrollable = false,
  segmentMinWidth = DEFAULT_SEGMENT_MIN_WIDTH,
  maxWidth,
}: ModulaSegmentedPickerProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const plain = appearance === 'plain'

  const viewportCap = maxWidth ?? (scrollable ? DEFAULT_SCROLL_MAX_WIDTH : windowWidth)
  const viewportWidth = Math.min(windowWidth - 32, viewportCap)
  const contentWidth = Math.max(
    viewportWidth,
    plain ? viewportWidth : options.length * segmentMinWidth,
  )

  const row = (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        plain
          ? {
              width: scrollable ? contentWidth : viewportWidth,
              maxWidth: scrollable ? contentWidth : viewportWidth,
              gap: spacing[1],
            }
          : {
              backgroundColor: colours.surfaceMuted,
              borderRadius: radius.round,
              padding: 3,
              gap: 2,
              width: scrollable ? contentWidth : viewportWidth,
              maxWidth: scrollable ? contentWidth : viewportWidth,
            },
        !scrollable ? style : null,
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
                backgroundColor: plain
                  ? 'transparent'
                  : selected
                    ? colours.surface
                    : 'transparent',
                borderRadius: radius.round,
                opacity: option.disabled ? 0.45 : 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                minWidth: scrollable && !plain ? segmentMinWidth - 8 : undefined,
                flex: scrollable ? undefined : 1,
                ...(plain || !selected
                  ? null
                  : {
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colours.border,
                      shadowColor: colours.text,
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                      shadowOffset: {width: 0, height: 1},
                      elevation: 1,
                    }),
              },
            ]}>
            <AppText
              variant="label"
              style={{
                color: selected ? colours.text : colours.textSecondary,
                textAlign: 'center',
                fontWeight: selected ? '600' : '500',
              }}
              numberOfLines={1}>
              {option.label}
            </AppText>
          </AppPressable>
        )
      })}
    </View>
  )

  if (!scrollable) {
    return (
      <View style={[{alignSelf: 'center', maxWidth: viewportWidth}, style]}>
        {row}
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      style={[
        {alignSelf: 'center', maxWidth: viewportWidth, width: viewportWidth},
        style,
      ]}
      contentContainerStyle={{alignItems: 'center'}}>
      {row}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
})
