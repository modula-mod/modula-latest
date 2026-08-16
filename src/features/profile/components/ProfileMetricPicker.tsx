/* eslint-disable react-hooks/immutability */
import {useCallback, useEffect, useMemo} from 'react'
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
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const NEIGHBOR_OPACITY = 0.34
const FAR_OPACITY = 0.16
const NEIGHBOR_SCALE = 0.88
const ITEM_HEIGHT = PROFILE_LAYOUT.metricItemHeight
const WINDOW_ITEMS = PROFILE_LAYOUT.metricWindowItems

function windowStartFromOffset(offset: number, count: number): number {
  'worklet'
  if (count <= WINDOW_ITEMS) return 0
  const index = offset / ITEM_HEIGHT
  return Math.max(0, Math.min(count - WINDOW_ITEMS, index - 1))
}

function windowStartForIndex(index: number, count: number): number {
  if (count <= WINDOW_ITEMS) return 0
  return Math.max(0, Math.min(count - WINDOW_ITEMS, index - 1))
}

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
  const {colours, motion} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const count = metrics.length
  const selectedIndex = Math.max(
    0,
    metrics.findIndex(metric => metric.id === selectedMetricId),
  )
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
  const windowHeight =
    count === 1
      ? ITEM_HEIGHT
      : count === 2
        ? ITEM_HEIGHT * 2
        : profileMetricWindowHeight()
  const windowStart = windowStartForIndex(selectedIndex, count)
  const selectedRow = selectedIndex - windowStart
  const accessibilityValue = selected
    ? `${selected.label}, ${metricSpokenValue(selected)}, selected, ${selectedIndex + 1} of ${count}.`
    : undefined
  const showFocal = count > 1
  const selectedTop = selectedRow * ITEM_HEIGHT

  if (count === 1 && selected) {
    return (
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={`${selected.label}, ${metricSpokenValue(selected)}`}
        accessibilityHint={
          selected.destination.type === 'none' ? undefined : 'Opens this metric'
        }
        onPress={() => onActivateMetric(selected)}
        style={[styles.single, {minHeight: 44}]}>
        <MetricCopy metric={selected} selected />
      </AppPressable>
    )
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Profile statistics"
        accessibilityValue={{text: accessibilityValue}}
        accessibilityHint="Swipe up or down to change. Double tap to open."
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
        style={[styles.gesture, {minHeight: Math.max(44, windowHeight)}]}>
        <View style={[styles.window, {height: windowHeight}]}>
          {showFocal ? (
            <View
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.focal,
                {
                  backgroundColor: colours.text,
                  top: selectedTop + 4,
                  height: ITEM_HEIGHT - 8,
                },
              ]}
            />
          ) : null}
          {metrics.map((metric, index) => (
            <MetricWheelItem
              key={metric.id}
              metric={metric}
              index={index}
              count={count}
              selected={index === selectedIndex}
              scrollOffset={scrollOffset}
              reduceMotion={reduceMotion}
            />
          ))}
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <AppPressable
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={() => moveBy(-1)}
              style={[styles.hit, {top: (selectedRow - 1) * ITEM_HEIGHT, height: ITEM_HEIGHT}]}
            />
            <AppPressable
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={activate}
              style={[styles.hit, {top: selectedRow * ITEM_HEIGHT, height: ITEM_HEIGHT}]}
            />
            <AppPressable
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={() => moveBy(1)}
              style={[styles.hit, {top: (selectedRow + 1) * ITEM_HEIGHT, height: ITEM_HEIGHT}]}
            />
          </View>
        </View>
      </View>
    </GestureDetector>
  )
}

function metricDisplayValue(metric: ProfileMetricDescriptor): string {
  if (metric.loading) return '—'
  if (metric.unavailable) return '—'
  return metric.formattedValue
}

function metricSpokenValue(metric: ProfileMetricDescriptor): string {
  if (metric.loading) return 'Loading'
  if (metric.unavailable) return 'Unavailable'
  return metric.formattedFullValue
}

function MetricCopy({
  metric,
  selected,
}: {
  metric: ProfileMetricDescriptor
  selected: boolean
}) {
  return (
    <View style={styles.copy}>
      <AppText
        variant={selected ? 'title2' : 'headline'}
        numberOfLines={1}
        colour={selected ? 'text' : 'textSecondary'}>
        {metricDisplayValue(metric)}
      </AppText>
      <AppText
        variant="micro"
        numberOfLines={1}
        colour={selected ? 'textSecondary' : 'textTertiary'}>
        {metric.label}
      </AppText>
    </View>
  )
}

function MetricWheelItem({
  metric,
  index,
  count,
  selected,
  scrollOffset,
  reduceMotion,
}: {
  metric: ProfileMetricDescriptor
  index: number
  count: number
  selected: boolean
  scrollOffset: SharedValue<number>
  reduceMotion: boolean
}) {
  const style = useAnimatedStyle(() => {
    const current = scrollOffset.value / ITEM_HEIGHT
    const windowStart = windowStartFromOffset(scrollOffset.value, count)
    const translateY = (index - windowStart) * ITEM_HEIGHT
    const distance = Math.abs(index - current)
    const progress = Math.min(2, distance)
    return {
      opacity: reduceMotion
        ? progress < 0.5
          ? 1
          : progress < 1.5
            ? NEIGHBOR_OPACITY
            : FAR_OPACITY
        : interpolate(progress, [0, 1, 2], [1, NEIGHBOR_OPACITY, FAR_OPACITY]),
      transform: [
        {translateY},
        {
          scale: reduceMotion ? 1 : interpolate(progress, [0, 1, 2], [1, NEIGHBOR_SCALE, 0.84]),
        },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.item, {height: ITEM_HEIGHT}, style]}>
      <MetricCopy metric={metric} selected={selected} />
    </Animated.View>
  )
}

const FOCAL_GUTTER = 11

const styles = StyleSheet.create({
  copy: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 0,
    paddingLeft: FOCAL_GUTTER,
  },
  focal: {
    borderRadius: 1.5,
    left: 0,
    opacity: 0.45,
    position: 'absolute',
    width: 3,
  },
  gesture: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
  },
  hit: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  item: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  single: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: FOCAL_GUTTER,
  },
  window: {
    overflow: 'hidden',
    width: '100%',
  },
})
