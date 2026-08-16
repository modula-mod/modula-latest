/* eslint-disable react-hooks/immutability */
import {useCallback, useEffect, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {
  PROFILE_LAYOUT,
  profileMetricWindowHeight,
} from '@/features/profile/model/profile-layout'
import type {ProfileMetricDescriptor} from '@/features/profile/model/profile-metrics'
import {InvertedSelectedSurface} from '@/platform/ui/geometry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ITEM_HEIGHT = PROFILE_LAYOUT.metricItemHeight

type ProfileMetricPickerProps = {
  metrics: ProfileMetricDescriptor[]
  selectedMetricId: string
  onSelectMetric: (metricId: string) => void
  onActivateMetric: (metric: ProfileMetricDescriptor) => void
}

export function ProfileMetricPicker({
  metrics,
  selectedMetricId,
  onSelectMetric,
  onActivateMetric,
}: ProfileMetricPickerProps) {
  const {colours, motion, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const count = metrics.length
  const selectedIndex = Math.max(
    0,
    metrics.findIndex(metric => metric.id === selectedMetricId),
  )
  const [surfaceWidth, setSurfaceWidth] = useState(0)
  const scrollOffset = useSharedValue(selectedIndex * ITEM_HEIGHT)
  const startOffset = useSharedValue(selectedIndex * ITEM_HEIGHT)
  const lastTick = useSharedValue(selectedIndex)

  useEffect(() => {
    const next = selectedIndex * ITEM_HEIGHT
    lastTick.value = selectedIndex
    if (reduceMotion) {
      scrollOffset.value = next
      return
    }
    scrollOffset.value = withSpring(next, motion.springs.selection)
  }, [lastTick, motion.springs.selection, reduceMotion, scrollOffset, selectedIndex])

  const commitIndex = useCallback(
    (index: number) => {
      const metric = metrics[index]
      if (!metric || metric.id === selectedMetricId) return
      onSelectMetric(metric.id)
    },
    [metrics, onSelectMetric, selectedMetricId],
  )

  const activate = useCallback(() => {
    const metric = metrics[selectedIndex]
    if (metric) onActivateMetric(metric)
  }, [metrics, onActivateMetric, selectedIndex])

  const moveBy = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(count - 1, selectedIndex + delta))
      if (next === selectedIndex) return
      void selectionHaptic()
      commitIndex(next)
    },
    [commitIndex, count, selectedIndex],
  )

  const pan = useMemo(() => {
    return Gesture.Pan()
      .enabled(count > 1)
      .activeOffsetY([-8, 8])
      .failOffsetX([-24, 24])
      .onBegin(() => {
        startOffset.value = scrollOffset.value
      })
      .onUpdate(event => {
        const max = Math.max(0, (count - 1) * ITEM_HEIGHT)
        const raw = startOffset.value - event.translationY
        if (raw < 0) {
          scrollOffset.value = raw * 0.32
        } else if (raw > max) {
          scrollOffset.value = max + (raw - max) * 0.32
        } else {
          scrollOffset.value = raw
        }
        const tick = Math.max(0, Math.min(count - 1, Math.round(scrollOffset.value / ITEM_HEIGHT)))
        if (tick !== lastTick.value) {
          lastTick.value = tick
          runOnJS(selectionHaptic)()
        }
      })
      .onEnd(event => {
        const max = Math.max(0, (count - 1) * ITEM_HEIGHT)
        const from = Math.round(startOffset.value / ITEM_HEIGHT)
        const projected = scrollOffset.value - event.velocityY * 0.08
        const unbounded = Math.round(projected / ITEM_HEIGHT)
        const limited = Math.max(from - 2, Math.min(from + 2, unbounded))
        const next = Math.max(0, Math.min(count - 1, limited))
        const destination = Math.max(0, Math.min(max, next * ITEM_HEIGHT))
        if (reduceMotion) {
          scrollOffset.value = destination
        } else {
          scrollOffset.value = withSpring(destination, motion.springs.selection)
        }
        runOnJS(commitIndex)(next)
      })
  }, [
    commitIndex,
    count,
    lastTick,
    motion.springs.selection,
    reduceMotion,
    scrollOffset,
    startOffset,
  ])

  if (!count) return null

  const selected = metrics[selectedIndex]
  const windowHeight = count === 1 ? ITEM_HEIGHT : profileMetricWindowHeight()
  const accessibilityValue = selected
    ? `${selected.formattedFullValue} ${selected.label}. ${selectedIndex + 1} of ${count}.`
    : undefined

  if (count === 1 && selected) {
    return (
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={`${selected.formattedFullValue} ${selected.label}`}
        accessibilityHint={
          selected.destination.type === 'none' ? undefined : 'Opens this metric'
        }
        onPress={() => onActivateMetric(selected)}
        style={[styles.single, {minHeight: 44}]}>
        <AppText variant="title2">{selected.formattedValue}</AppText>
        <AppText variant="caption" colour="textSecondary">
          {selected.label}
        </AppText>
      </AppPressable>
    )
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Profile metric picker"
        accessibilityValue={{text: accessibilityValue}}
        accessibilityHint="Swipe up or down to change metric. Double tap to open."
        accessibilityActions={[
          {name: 'increment', label: 'Next metric'},
          {name: 'decrement', label: 'Previous metric'},
          {name: 'activate', label: 'Open metric'},
        ]}
        onAccessibilityAction={event => {
          const name = event.nativeEvent.actionName
          if (name === 'increment') moveBy(1)
          if (name === 'decrement') moveBy(-1)
          if (name === 'activate') activate()
        }}
        testID="profile-metric-picker"
        style={[styles.window, {height: windowHeight}]}
        onLayout={event => setSurfaceWidth(event.nativeEvent.layout.width)}>
        {surfaceWidth > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.selectedSurface,
              {
                height: ITEM_HEIGHT,
                top: ITEM_HEIGHT,
                borderRadius: radius.medium,
              },
            ]}>
            <InvertedSelectedSurface
              width={Math.min(surfaceWidth, 168)}
              height={ITEM_HEIGHT}
              fill={colours.surfaceMuted}
            />
          </View>
        ) : null}
        {metrics.map((metric, index) => (
          <MetricWheelItem
            key={metric.id}
            metric={metric}
            index={index}
            scrollOffset={scrollOffset}
            reduceMotion={reduceMotion}
          />
        ))}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <AppPressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={() => moveBy(-1)}
            style={[styles.hit, {top: 0, height: ITEM_HEIGHT}]}
          />
          <AppPressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={activate}
            style={[styles.hit, {top: ITEM_HEIGHT, height: ITEM_HEIGHT}]}
          />
          <AppPressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={() => moveBy(1)}
            style={[styles.hit, {top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT}]}
          />
        </View>
        {selected?.secondaryText ? (
          <View
            pointerEvents="none"
            style={[styles.secondary, {paddingTop: spacing[1]}]}>
            <AppText variant="micro" colour="textTertiary">
              {selected.secondaryText}
            </AppText>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  )
}

function MetricWheelItem({
  metric,
  index,
  scrollOffset,
  reduceMotion,
}: {
  metric: ProfileMetricDescriptor
  index: number
  scrollOffset: SharedValue<number>
  reduceMotion: boolean
}) {
  const style = useAnimatedStyle(() => {
    const offset = index * ITEM_HEIGHT - scrollOffset.value
    const translateY = ITEM_HEIGHT + offset
    const distance = Math.abs(offset)
    const progress = Math.min(1, distance / ITEM_HEIGHT)
    return {
      opacity: reduceMotion ? (progress < 0.5 ? 1 : 0.38) : interpolate(progress, [0, 1], [1, 0.25]),
      transform: [
        {translateY},
        {
          scale: reduceMotion ? 1 : interpolate(progress, [0, 1], [1, 0.88]),
        },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.item, {height: ITEM_HEIGHT}, style]}>
      <AppText variant="headline">{metric.formattedValue}</AppText>
      <AppText variant="caption" colour="textSecondary">
        {metric.label}
      </AppText>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hit: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  secondary: {
    alignItems: 'center',
    bottom: -18,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  selectedSurface: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  single: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  window: {
    alignSelf: 'center',
    maxWidth: 220,
    minWidth: 140,
    overflow: 'hidden',
    width: '100%',
  },
})
