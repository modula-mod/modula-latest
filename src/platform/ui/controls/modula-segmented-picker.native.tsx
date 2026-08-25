import {SegmentedControl} from '@expo/ui/community/segmented-control'
import {useEffect, useMemo, useState} from 'react'
import {PanResponder, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native'

import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

const DEFAULT_SCROLL_SEGMENT_MIN_WIDTH = 108
const NATIVE_SEGMENTED_HEIGHT = 34
const SWIPE_THRESHOLD_PX = 36

type ScrollableNativeSegmentedProps = {
  options: ModulaSegmentedPickerProps['options']
  value: string
  onValueChange: (value: string) => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  segmentMinWidth: number
  viewportWidth: number
}

function clampLeadIndex(
  leadIndex: number,
  selectedIndex: number,
  visibleCount: number,
  total: number,
) {
  const maxLead = Math.max(0, total - visibleCount)
  let next = leadIndex
  if (selectedIndex < next) next = selectedIndex
  if (selectedIndex >= next + visibleCount) next = selectedIndex - visibleCount + 1
  return Math.min(maxLead, Math.max(0, next))
}

function visibleSegmentCount(
  viewportWidth: number,
  total: number,
  segmentMinWidth: number,
) {
  return Math.min(total, Math.max(2, Math.floor(viewportWidth / segmentMinWidth)))
}

/**
 * Native UISegmentedControl with more segments than fit the viewport.
 *
 * The SwiftUI segmented picker cannot be clipped cleanly inside a horizontal
 * ScrollView (labels bleed while scrolling). Instead, keep one viewport-width
 * native control and slide a window of segment labels via horizontal swipe.
 */
function ScrollableNativeSegmentedControl({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  segmentMinWidth,
  viewportWidth,
}: ScrollableNativeSegmentedProps) {
  const {colours, scheme} = useThemeTokens()
  const values = useMemo(() => options.map(option => option.label), [options])
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  )
  const enabled = options.every(option => !option.disabled)
  const visibleCount = visibleSegmentCount(viewportWidth, options.length, segmentMinWidth)
  const maxLead = Math.max(0, options.length - visibleCount)
  const [leadIndex, setLeadIndex] = useState(() =>
    clampLeadIndex(0, selectedIndex, visibleCount, options.length),
  )

  useEffect(() => {
    setLeadIndex(current =>
      clampLeadIndex(current, selectedIndex, visibleCount, options.length),
    )
  }, [options.length, selectedIndex, visibleCount])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          maxLead > 0 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
          Math.abs(gesture.dx) > 8,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx <= -SWIPE_THRESHOLD_PX) {
            setLeadIndex(current => Math.min(maxLead, current + 1))
            return
          }
          if (gesture.dx >= SWIPE_THRESHOLD_PX) {
            setLeadIndex(current => Math.max(0, current - 1))
          }
        },
      }),
    [maxLead],
  )

  const windowValues = values.slice(leadIndex, leadIndex + visibleCount)
  const windowSelectedIndex = Math.max(0, selectedIndex - leadIndex)

  if (visibleCount >= options.length) {
    return (
      <SegmentedControl
        values={values}
        selectedIndex={selectedIndex}
        enabled={enabled}
        appearance={scheme === 'dark' ? 'dark' : 'light'}
        tintColor={colours.accent}
        style={[
          {
            alignSelf: 'stretch',
            height: NATIVE_SEGMENTED_HEIGHT,
            width: viewportWidth,
            maxWidth: viewportWidth,
          },
          style,
        ]}
        testID={testID ?? accessibilityLabel}
        onValueChange={label => {
          const match = options.find(option => option.label === label)
          if (match && !match.disabled) {
            onValueChange(match.value)
          }
        }}
      />
    )
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[{width: viewportWidth, maxWidth: viewportWidth, alignSelf: 'center', overflow: 'hidden'}, style]}
      {...panResponder.panHandlers}>
      <SegmentedControl
        values={windowValues}
        selectedIndex={windowSelectedIndex}
        enabled={enabled}
        appearance={scheme === 'dark' ? 'dark' : 'light'}
        tintColor={colours.accent}
        style={{
          width: viewportWidth,
          maxWidth: viewportWidth,
          height: NATIVE_SEGMENTED_HEIGHT,
        }}
        testID={testID ? `${testID}-window` : accessibilityLabel}
        onValueChange={label => {
          const match = options.find(option => option.label === label)
          if (match && !match.disabled) {
            onValueChange(match.value)
          }
        }}
      />
    </View>
  )
}

/**
 * Native adapter:
 * - `segmented` — `@expo/ui/community/segmented-control` (SwiftUI segmented Picker)
 * - `segmented` + `scrollable` — viewport-native control with swipe windowing
 * - `glass` / `plain` / `track` / sticky overlays — shared RN implementation
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
  segmentMinWidth,
  maxWidth,
  embedded,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const viewportWidth = Math.min(windowWidth - 32, maxWidth ?? windowWidth)
  const values = useMemo(() => options.map(option => option.label), [options])
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  )
  const enabled = options.every(option => !option.disabled)
  const resolvedSegmentMinWidth = segmentMinWidth ?? DEFAULT_SCROLL_SEGMENT_MIN_WIDTH

  if (scrollable && appearance === 'segmented') {
    return (
      <ScrollableNativeSegmentedControl
        options={options}
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
        testID={testID}
        segmentMinWidth={resolvedSegmentMinWidth}
        viewportWidth={viewportWidth}
      />
    )
  }

  if (appearance !== 'segmented' || embedded) {
    return (
      <SharedModulaSegmentedPicker
        options={options}
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
        testID={testID}
        appearance={appearance === 'segmented' ? 'track' : appearance}
        scrollable={scrollable}
        segmentMinWidth={segmentMinWidth}
        maxWidth={maxWidth}
        embedded={embedded}
      />
    )
  }

  return (
    <SegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      enabled={enabled}
      appearance={scheme === 'dark' ? 'dark' : 'light'}
      tintColor={colours.accent}
      style={[
        {
          alignSelf: 'stretch',
          height: NATIVE_SEGMENTED_HEIGHT,
          width: '100%',
          maxWidth: viewportWidth,
        },
        style,
      ]}
      testID={testID ?? accessibilityLabel}
      onValueChange={label => {
        const match = options.find(option => option.label === label)
        if (match && !match.disabled) {
          onValueChange(match.value)
        }
      }}
    />
  )
}
