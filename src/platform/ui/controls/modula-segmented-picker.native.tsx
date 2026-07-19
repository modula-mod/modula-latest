import {Host, Picker, Text} from '@expo/ui/swift-ui'
import {pickerStyle, tag, tint} from '@expo/ui/swift-ui/modifiers'
import {ScrollView, useWindowDimensions} from 'react-native'

import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Native Expo UI segmented Picker — theme via Host seedColor + accent tint.
 * Optional `scrollable` gives a wide control inside a horizontal ScrollView.
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
    <Host
      matchContents={!scrollable}
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[
        scrollable
          ? {width: contentWidth, minWidth: contentWidth}
          : {alignSelf: 'stretch', width: '100%'},
        style,
      ]}>
      <Picker
        label={accessibilityLabel}
        selection={value}
        onSelectionChange={selection => {
          if (typeof selection === 'string' && allowed.has(selection)) {
            onValueChange(selection)
          }
        }}
        modifiers={[pickerStyle('segmented'), tint(colours.accent)]}
        testID={testID}>
        {options.map(option => (
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  )

  if (!scrollable) return picker

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      contentContainerStyle={{alignItems: 'center', minHeight: 36}}>
      {picker}
    </ScrollView>
  )
}
