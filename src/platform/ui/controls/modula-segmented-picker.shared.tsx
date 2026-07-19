import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const DEFAULT_SCROLL_MAX_WIDTH = 360
const DEFAULT_SEGMENT_MIN_WIDTH = 88

/**
 * Segmented control with liquid-glass track + selected capsule.
 * Plain appearance stays label-only (no glass chrome).
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

  const segments = options.map(option => {
    const selected = option.value === value
    const label = (
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
    )

    const pressable = (
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
            opacity: option.disabled ? 0.45 : 1,
            minWidth: scrollable && !plain ? segmentMinWidth - 8 : undefined,
            flex: scrollable ? undefined : 1,
            borderRadius: radius.round,
            ...(plain || !selected
              ? {
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                }
              : null),
          },
        ]}>
        {plain || !selected ? (
          label
        ) : (
          <LiquidGlassChrome
            interactive
            fallback="regular"
            contentLayout="flow"
            style={[styles.selectedGlass, {borderRadius: radius.round}]}>
            <View
              style={[
                styles.selectedInner,
                {
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                },
              ]}>
              {label}
            </View>
          </LiquidGlassChrome>
        )}
      </AppPressable>
    )

    return pressable
  })

  const row = plain ? (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          width: scrollable ? contentWidth : viewportWidth,
          maxWidth: scrollable ? contentWidth : viewportWidth,
          gap: spacing[1],
        },
        !scrollable ? style : null,
      ]}>
      {segments}
    </View>
  ) : (
    <LiquidGlassChrome
      interactive
      fallback="clear"
      contentLayout="flow"
      style={[
        styles.trackGlass,
        {
          borderRadius: radius.round,
          width: scrollable ? contentWidth : viewportWidth,
          maxWidth: scrollable ? contentWidth : viewportWidth,
        },
        !scrollable ? style : null,
      ]}>
      <View
        testID={testID}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        style={[styles.row, styles.trackRow, {gap: 2}]}>
        {segments}
      </View>
    </LiquidGlassChrome>
  )

  if (!scrollable) {
    return (
      <View style={[{alignSelf: 'center', maxWidth: viewportWidth}, plain ? style : null]}>
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
  selectedGlass: {
    alignSelf: 'stretch',
    flex: 1,
    minHeight: 30,
    overflow: 'hidden',
    width: '100%',
  },
  selectedInner: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  trackGlass: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  trackRow: {
    padding: 3,
    width: '100%',
  },
})
