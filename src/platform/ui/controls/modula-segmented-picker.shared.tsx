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
const CAPSULE_HEIGHT = 36

/**
 * Segmented control:
 * - `segmented` — each option is its own liquid-glass capsule
 * - `plain` — label tabs only
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
  const gap = spacing[2]
  const contentWidth = Math.max(
    viewportWidth,
    plain
      ? viewportWidth
      : options.length * segmentMinWidth + gap * Math.max(0, options.length - 1),
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

    if (plain) {
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
              opacity: option.disabled ? 0.45 : 1,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              flex: scrollable ? undefined : 1,
              minWidth: scrollable ? segmentMinWidth - 8 : undefined,
            },
          ]}>
          {label}
        </AppPressable>
      )
    }

    return (
      <AppPressable
        key={option.value}
        accessibilityRole="button"
        accessibilityState={{selected, disabled: !!option.disabled}}
        accessibilityLabel={option.label}
        disabled={option.disabled}
        onPress={() => onValueChange(option.value)}
        style={[
          styles.capsuleHit,
          {
            opacity: option.disabled ? 0.45 : 1,
            flex: scrollable ? undefined : 1,
            minWidth: scrollable ? segmentMinWidth : undefined,
            height: CAPSULE_HEIGHT,
            borderRadius: radius.round,
          },
        ]}>
        <LiquidGlassChrome
          interactive
          fallback={selected ? 'regular' : 'clear'}
          contentLayout="flow"
          style={[
            styles.capsuleGlass,
            {
              borderRadius: radius.round,
              height: CAPSULE_HEIGHT,
            },
          ]}>
          <View
            style={[
              styles.capsuleInner,
              {
                paddingHorizontal: spacing[3],
                minHeight: CAPSULE_HEIGHT,
              },
            ]}>
            {label}
          </View>
        </LiquidGlassChrome>
      </AppPressable>
    )
  })

  const row = (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          width: scrollable ? contentWidth : viewportWidth,
          maxWidth: scrollable ? contentWidth : viewportWidth,
          gap,
        },
        !scrollable ? style : null,
      ]}>
      {segments}
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
  capsuleGlass: {
    alignSelf: 'stretch',
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  capsuleHit: {
    overflow: 'hidden',
  },
  capsuleInner: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
})
