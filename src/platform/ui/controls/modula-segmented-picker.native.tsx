import {SegmentedControl} from '@expo/ui/community/segmented-control'
import {useEffect, useMemo, useRef} from 'react'
import {ScrollView, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native'

import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

const DEFAULT_SCROLL_SEGMENT_MIN_WIDTH = 108
const NATIVE_SEGMENTED_HEIGHT = 34

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
  const scrollRef = useRef<ScrollView>(null)
  const values = useMemo(() => options.map(option => option.label), [options])
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  )
  const enabled = options.every(option => !option.disabled)
  const contentWidth = Math.max(viewportWidth, options.length * segmentMinWidth)

  useEffect(() => {
    const selectedOffset = selectedIndex * segmentMinWidth
    const centered = selectedOffset - (viewportWidth - segmentMinWidth) / 2
    const maxOffset = Math.max(0, contentWidth - viewportWidth)
    const x = Math.min(maxOffset, Math.max(0, centered))
    scrollRef.current?.scrollTo({x, animated: true})
  }, [contentWidth, segmentMinWidth, selectedIndex, viewportWidth])

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      directionalLockEnabled
      accessibilityLabel={accessibilityLabel}
      testID={testID ? `${testID}-scroll` : undefined}
      style={[{maxWidth: viewportWidth, width: viewportWidth, alignSelf: 'center'}, style]}
      contentContainerStyle={{width: contentWidth, alignItems: 'stretch'}}>
      <SegmentedControl
        values={values}
        selectedIndex={selectedIndex}
        enabled={enabled}
        appearance={scheme === 'dark' ? 'dark' : 'light'}
        tintColor={colours.accent}
        style={{
          width: contentWidth,
          minWidth: contentWidth,
          height: NATIVE_SEGMENTED_HEIGHT,
          alignSelf: 'flex-start',
        }}
        testID={testID ?? accessibilityLabel}
        onValueChange={label => {
          const match = options.find(option => option.label === label)
          if (match && !match.disabled) {
            onValueChange(match.value)
          }
        }}
      />
    </ScrollView>
  )
}

/**
 * Native adapter:
 * - `segmented` — `@expo/ui/community/segmented-control` (SwiftUI segmented Picker)
 * - `segmented` + `scrollable` — same native control in a horizontal ScrollView
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
