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

/**
 * Native Expo UI segmented Picker — theme via Host seedColor + accent tint.
 * `scrollable` uses SwiftUI ScrollView so segment taps still register.
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  scrollable = false,
  segmentMinWidth = 92,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const allowed = new Set(options.map(option => option.value))
  const contentWidth = Math.max(
    windowWidth - 32,
    options.length * segmentMinWidth,
  )

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
        ...(scrollable
          ? [frame({width: contentWidth, height: 36})]
          : [frame({maxWidth: Infinity, height: 36})]),
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
      matchContents={!scrollable}
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[
        scrollable
          ? {width: '100%', height: 40}
          : {alignSelf: 'stretch', width: '100%'},
        style,
      ]}>
      {scrollable ? (
        <ScrollView
          axes="horizontal"
          showsIndicators={false}
          modifiers={[scrollIndicators('hidden', 'horizontal')]}>
          {picker}
        </ScrollView>
      ) : (
        picker
      )}
    </Host>
  )
}
