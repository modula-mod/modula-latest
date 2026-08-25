import {SegmentedControl as ExpoSegmentedControl} from '@expo/ui/community/segmented-control'
import SegmentedControl from '@react-native-segmented-control/segmented-control'
import {useEffect, useMemo, useRef} from 'react'
import {ScrollView, View, useWindowDimensions, type StyleProp, type ViewStyle} from 'react-native'

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

/**
 * Scrollable UISegmentedControl for more segments than fit the viewport.
 *
 * SwiftUI Host (`@expo/ui`) does not clip inside horizontal ScrollView — labels
 * bleed at the edges while scrolling. UIKit `@react-native-segmented-control`
 * respects parent clipping, so we use it here while keeping Expo UI for the
 * fixed-width (non-scrollable) path.
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
    <View
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        {
          alignSelf: 'center',
          maxWidth: viewportWidth,
          overflow: 'hidden',
          width: viewportWidth,
        },
        style,
      ]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        removeClippedSubviews
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        directionalLockEnabled
        testID={testID ? `${testID}-scroll` : undefined}
        style={{width: viewportWidth}}
        contentContainerStyle={{width: contentWidth, alignItems: 'stretch'}}>
        <SegmentedControl
          values={values}
          selectedIndex={selectedIndex}
          enabled={enabled}
          appearance={scheme === 'dark' ? 'dark' : 'light'}
          tintColor={colours.accent}
          style={{
            alignSelf: 'flex-start',
            height: NATIVE_SEGMENTED_HEIGHT,
            minWidth: contentWidth,
            width: contentWidth,
          }}
          testID={testID ? `${testID}-native` : accessibilityLabel}
          onValueChange={label => {
            const match = options.find(option => option.label === label)
            if (match && !match.disabled) {
              onValueChange(match.value)
            }
          }}
        />
      </ScrollView>
    </View>
  )
}

/**
 * Native adapter:
 * - `segmented` — `@expo/ui/community/segmented-control` (SwiftUI segmented Picker)
 * - `segmented` + `scrollable` — UIKit UISegmentedControl in a clipped ScrollView
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
    <ExpoSegmentedControl
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
