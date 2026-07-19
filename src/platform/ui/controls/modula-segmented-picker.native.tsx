import {Host, Picker, ScrollView, Text} from '@expo/ui/swift-ui'
import {
  frame,
  pickerStyle,
  scrollIndicators,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers'
import {useWindowDimensions} from 'react-native'

import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

const DEFAULT_SCROLL_MAX_WIDTH = 360
const DEFAULT_SEGMENT_MIN_WIDTH = 88

/**
 * Native Expo UI segmented Picker — theme via Host seedColor + accent tint.
 * `scrollable` uses SwiftUI ScrollView inside a max-width viewport.
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  scrollable = false,
  segmentMinWidth = DEFAULT_SEGMENT_MIN_WIDTH,
  maxWidth,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const allowed = new Set(options.map(option => option.value))

  const viewportCap = maxWidth ?? (scrollable ? DEFAULT_SCROLL_MAX_WIDTH : windowWidth)
  const viewportWidth = Math.min(windowWidth - 32, viewportCap)
  const contentWidth = Math.max(viewportWidth, options.length * segmentMinWidth)

  const picker = (
    <Picker
      label={accessibilityLabel}
      selection={value}
      onSelectionChange={selection => {
        if (typeof selection === 'string' && allowed.has(selection)) {
          onValueChange(selection)
        }
      }}
      modifiers={[
        pickerStyle('segmented'),
        tint(colours.accent),
        frame({
          width: scrollable ? contentWidth : viewportWidth,
          height: 34,
          maxWidth: scrollable ? contentWidth : viewportWidth,
        }),
      ]}
      testID={testID}>
      {options.map(option => (
        <Text key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </Text>
      ))}
    </Picker>
  )

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[
        {
          alignSelf: 'center',
          width: viewportWidth,
          maxWidth: viewportWidth,
          height: 38,
        },
        style,
      ]}>
      {scrollable ? (
        <ScrollView
          axes="horizontal"
          showsIndicators={false}
          modifiers={[
            scrollIndicators('hidden', 'horizontal'),
            frame({width: viewportWidth, height: 38, maxWidth: viewportWidth}),
          ]}>
          {picker}
        </ScrollView>
      ) : (
        picker
      )}
    </Host>
  )
}
