import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {
  ModulaSegmentedOption,
  ModulaSegmentedPickerProps,
} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const NEAR_END_PX = 56

type ModulaSegmentedScrollRailProps = Pick<
  ModulaSegmentedPickerProps,
  | 'options'
  | 'value'
  | 'onValueChange'
  | 'accessibilityLabel'
  | 'style'
  | 'testID'
  | 'initialVisibleCount'
  | 'revealBatchSize'
  | 'onNearEnd'
>

/**
 * Theme-aware horizontal segment rail with progressive reveal near the
 * trailing edge (swipe right → load / show more options).
 */
export function ModulaSegmentedScrollRail({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  initialVisibleCount = 3,
  revealBatchSize = 2,
  onNearEnd,
}: ModulaSegmentedScrollRailProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(Math.max(initialVisibleCount, 1), options.length),
  )
  const nearEndLock = useRef(false)
  const onNearEndRef = useRef(onNearEnd)
  onNearEndRef.current = onNearEnd

  useEffect(() => {
    setVisibleCount(count =>
      Math.min(Math.max(count, initialVisibleCount), options.length),
    )
  }, [initialVisibleCount, options.length])

  const visibleOptions = useMemo(
    () => options.slice(0, visibleCount),
    [options, visibleCount],
  )
  const hasMore = visibleCount < options.length

  const revealMore = useCallback(() => {
    setVisibleCount(count => {
      if (count >= options.length) return count
      return Math.min(options.length, count + Math.max(1, revealBatchSize))
    })
    onNearEndRef.current?.()
  }, [options.length, revealBatchSize])

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent
      const distanceFromEnd =
        contentSize.width - (contentOffset.x + layoutMeasurement.width)
      if (distanceFromEnd > NEAR_END_PX) {
        nearEndLock.current = false
        return
      }
      if (nearEndLock.current) return
      nearEndLock.current = true
      if (hasMore) {
        revealMore()
      } else {
        onNearEndRef.current?.()
      }
    },
    [hasMore, revealMore],
  )

  const fadeColor = colours.canvas

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.host, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          {
            gap: spacing[1],
            padding: 3,
            backgroundColor: colours.surfaceMuted,
            borderRadius: radius.round,
          },
        ]}>
        {visibleOptions.map(option => (
          <SegmentChip
            key={option.value}
            option={option}
            selected={option.value === value}
            onPress={() => {
              if (!option.disabled) onValueChange(option.value)
            }}
          />
        ))}
        {hasMore ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.moreHint, {paddingHorizontal: spacing[2]}]}>
            <AppText variant="caption" colour="textTertiary">
              ···
            </AppText>
          </View>
        ) : null}
      </ScrollView>
      {hasMore ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${fadeColor}00`, fadeColor]}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={styles.fade}
        />
      ) : null}
    </View>
  )
}

function SegmentChip({
  option,
  selected,
  onPress,
}: {
  option: ModulaSegmentedOption
  selected: boolean
  onPress: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityRole="tab"
      accessibilityState={{selected, disabled: !!option.disabled}}
      accessibilityLabel={option.label}
      disabled={option.disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colours.accent : colours.surface,
          borderRadius: radius.round,
          opacity: option.disabled ? 0.45 : 1,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          borderColor: selected ? colours.accentBorder : 'transparent',
        },
      ]}>
      <AppText
        variant="label"
        style={{
          color: selected ? colours.accentForeground : colours.text,
        }}
        numberOfLines={1}>
        {option.label}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 34,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 40,
  },
  fade: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 36,
  },
  host: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    width: '100%',
  },
  moreHint: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
})
