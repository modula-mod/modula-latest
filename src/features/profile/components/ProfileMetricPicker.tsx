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
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const NEIGHBOR_OPACITY = 0.4
const FAR_OPACITY = 0.18
const NEIGHBOR_SCALE = 0.9
const ARROW_OPACITY = 0.28
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
  align?: 'center' | 'start'
  showSelectionDot?: boolean
  showHints?: boolean
}

export function ProfileMetricPicker({
  metrics,
  selectedMetricId,
  onSelectMetric,
  onActivateMetric,
  align = 'center',
  showSelectionDot = false,
  showHints,
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
      .activeOffsetY([-14, 14])
      .failOffsetX([-10, 10])
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
  const hintsVisible = showHints ?? count > 1

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
        <MetricCopy
          metric={selected}
          selected
          align={align}
          showSelectionDot={showSelectionDot}
        />
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
        style={[
          styles.gesture,
          align === 'start' ? styles.gestureStart : null,
          {minHeight: Math.max(44, windowHeight)},
        ]}>
        {hintsVisible ? <PickerHintArrow name="arrowUp" colour={colours.text} /> : null}
        <View style={[styles.window, {height: windowHeight}]}>
          {metrics.map((metric, index) => (
            <MetricWheelItem
              key={metric.id}
              metric={metric}
              index={index}
              count={count}
              selected={index === selectedIndex}
              scrollOffset={scrollOffset}
              reduceMotion={reduceMotion}
              align={align}
              showSelectionDot={showSelectionDot}
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
        {hintsVisible ? <PickerHintArrow name="arrowDown" colour={colours.text} /> : null}
      </View>
    </GestureDetector>
  )
}

function PickerHintArrow({
  name,
  colour,
}: {
  name: 'arrowUp' | 'arrowDown'
  colour: string
}) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.hint}>
      <ModulaIcon name={name} colour={colour} size={12} />
    </View>
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
  align,
  showSelectionDot,
}: {
  metric: ProfileMetricDescriptor
  selected: boolean
  align: 'center' | 'start'
  showSelectionDot: boolean
}) {
  const {colours} = useThemeTokens()
  const start = align === 'start'
  const textStyle = start ? styles.copyTextStart : styles.copyText

  return (
    <View style={[styles.copyRow, start ? styles.copyRowStart : null]}>
      {showSelectionDot ? (
        <View
          style={[
            styles.selectionDot,
            {
              backgroundColor: selected ? colours.accent : 'transparent',
            },
          ]}
        />
      ) : null}
      <View style={[styles.copy, start ? styles.copyStart : null]}>
        <AppText
          variant={selected ? 'title2' : 'headline'}
          numberOfLines={1}
          colour={selected ? 'text' : 'textSecondary'}
          style={textStyle}>
          {metricDisplayValue(metric)}
        </AppText>
        <AppText
          variant="micro"
          numberOfLines={1}
          colour={selected ? 'textSecondary' : 'textTertiary'}
          style={textStyle}>
          {metric.label}
        </AppText>
      </View>
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
  align,
  showSelectionDot,
}: {
  metric: ProfileMetricDescriptor
  index: number
  count: number
  selected: boolean
  scrollOffset: SharedValue<number>
  reduceMotion: boolean
  align: 'center' | 'start'
  showSelectionDot: boolean
}) {
  const listLayout = align === 'start'
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
            ? listLayout
              ? 0.72
              : NEIGHBOR_OPACITY
            : listLayout
              ? 0.5
              : FAR_OPACITY
        : interpolate(
            progress,
            [0, 1, 2],
            listLayout ? [1, 0.72, 0.5] : [1, NEIGHBOR_OPACITY, FAR_OPACITY],
          ),
      transform: [
        {translateY},
        {
          scale:
            reduceMotion || listLayout
              ? 1
              : interpolate(progress, [0, 1, 2], [1, NEIGHBOR_SCALE, 0.86]),
        },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.item, {height: ITEM_HEIGHT}, style]}>
      <MetricCopy
        metric={metric}
        selected={selected}
        align={align}
        showSelectionDot={showSelectionDot}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  copy: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  copyStart: {
    alignItems: 'flex-start',
  },
  copyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
    width: '100%',
  },
  copyRowStart: {
    justifyContent: 'flex-start',
  },
  copyText: {
    textAlign: 'center',
    width: '100%',
  },
  copyTextStart: {
    textAlign: 'left',
    width: '100%',
  },
  gesture: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  gestureStart: {
    alignItems: 'stretch',
  },
  selectionDot: {
    borderRadius: 3,
    flexShrink: 0,
    height: 6,
    marginRight: 8,
    width: 6,
  },
  hint: {
    alignItems: 'center',
    height: 12,
    justifyContent: 'center',
    opacity: ARROW_OPACITY,
  },
  hit: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  item: {
    alignItems: 'stretch',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  single: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  window: {
    overflow: 'hidden',
    width: '100%',
  },
})
