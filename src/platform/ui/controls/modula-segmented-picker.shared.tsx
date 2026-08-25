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
const TRACK_HEIGHT = 40

/**
 * Cross-platform segmented control.
 * - `segmented` — classic muted track + raised selected thumb (system look)
 * - `glass` — liquid-glass wrapper; selected thumb is a plain token capsule
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
  embedded = false,
}: ModulaSegmentedPickerProps) {
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const plain = appearance === 'plain'
  const glass = appearance === 'glass'
  /** Classic muted track + raised thumb (also used for `segmented` on non-iOS). */
  const track = appearance === 'track' || appearance === 'segmented'
  const isDark = scheme === 'dark'
  /** Parent liquid-glass capsule supplies chrome — keep track fill clear. */
  const nestInGlass = embedded && track

  const viewportCap = maxWidth ?? (scrollable ? DEFAULT_SCROLL_MAX_WIDTH : windowWidth)
  const viewportWidth = Math.min(windowWidth - 32, viewportCap)
  const contentWidth = Math.max(
    viewportWidth,
    plain ? viewportWidth : options.length * segmentMinWidth,
  )
  const trackWidth = nestInGlass
    ? Math.min(viewportWidth, Math.max(options.length * 96, 280))
    : scrollable
      ? contentWidth
      : ('100%' as const)

  const segments = options.map(option => {
    const selected = option.value === value
    const selectedFill = isDark
      ? 'rgba(255,255,255,0.14)'
      : colours.surface
    const showThumb = selected && !plain

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
            minWidth: scrollable ? segmentMinWidth : undefined,
            flex: scrollable ? undefined : 1,
            flexShrink: scrollable ? 0 : undefined,
            borderRadius: radius.round,
            // Scrollable menu (plain): muted selected chip. Glass/segmented: raised thumb.
            backgroundColor: !selected
              ? 'transparent'
              : plain
                ? colours.surfaceMuted
                : selectedFill,
            ...(showThumb
              ? {
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colours.border,
                }
              : plain && selected
                ? {
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colours.border,
                  }
                : null),
          },
        ]}>
        <AppText
          variant="label"
          style={{
            color: selected ? colours.text : colours.textSecondary,
            textAlign: 'center',
            fontWeight: selected ? '600' : '500',
            flexShrink: scrollable ? 0 : undefined,
          }}
          numberOfLines={scrollable ? undefined : 1}>
          {option.label}
        </AppText>
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
        plain
          ? {
              width: scrollable ? contentWidth : viewportWidth,
              maxWidth: scrollable ? contentWidth : viewportWidth,
              gap: spacing[1],
            }
          : glass
            ? {
                width: '100%',
                gap: 2,
                padding: 3,
                minHeight: TRACK_HEIGHT,
              }
            : {
                // `track` / fallback `segmented`
                backgroundColor: nestInGlass
                  ? 'transparent'
                  : colours.surfaceMuted,
                borderRadius: radius.round,
                padding: 3,
                gap: 2,
                width: trackWidth,
                maxWidth: viewportWidth,
                minHeight: TRACK_HEIGHT,
                alignSelf: nestInGlass ? 'center' : 'stretch',
              },
        plain && !scrollable ? style : null,
        track && !scrollable ? style : null,
      ]}>
      {segments}
    </View>
  )

  if (plain || track || !glass) {
    if (!scrollable) {
      return (
        <View
          style={[
            {
              alignSelf: 'center',
              maxWidth: viewportWidth,
              width: nestInGlass ? trackWidth : undefined,
            },
            style,
          ]}>
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

  // glass appearance — real liquid glass (no opaque fill that kills Callstack glass).
  // Shadow on an outer shell so overflow:hidden doesn’t clip it.
  const wrapped = (
    <View
      style={[
        styles.trackShadow,
        {
          borderRadius: radius.round,
          width: scrollable ? contentWidth : viewportWidth,
          maxWidth: scrollable ? contentWidth : viewportWidth,
        },
        !scrollable ? style : null,
      ]}>
      <LiquidGlassChrome
        interactive
        fallback="clear"
        contentLayout="flow"
        blurIntensity={92}
        style={[
          styles.trackGlass,
          {
            borderRadius: radius.round,
            width: '100%',
            minHeight: TRACK_HEIGHT,
          },
        ]}>
        {row}
      </LiquidGlassChrome>
    </View>
  )

  if (!scrollable) {
    return (
      <View style={{alignSelf: 'center', maxWidth: viewportWidth}}>
        {wrapped}
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
      {wrapped}
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
  trackGlass: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  trackShadow: {
    alignSelf: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
})
