import {Host, Picker, Text} from '@expo/ui/swift-ui'
import {frame, pickerStyle, tag, tint} from '@expo/ui/swift-ui/modifiers'
import {useWindowDimensions} from 'react-native'

import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Native adapter:
 * - `segmented` — real UISegmentedControl via Expo UI `Picker`
 * - `glass` / `plain` / `scrollable` — shared RN implementation
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
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const allowed = new Set(options.map(option => option.value))
  const viewportWidth = Math.min(windowWidth - 32, maxWidth ?? windowWidth)

  if (appearance !== 'segmented' || scrollable) {
    return (
      <SharedModulaSegmentedPicker
        options={options}
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
        testID={testID}
        appearance={appearance}
        scrollable={scrollable}
        segmentMinWidth={segmentMinWidth}
        maxWidth={maxWidth}
      />
    )
  }

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[
        {
          alignSelf: 'stretch',
          height: 34,
          width: '100%',
          maxWidth: viewportWidth,
        },
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
        modifiers={[
          pickerStyle('segmented'),
          tint(colours.accent),
          frame({width: viewportWidth, maxWidth: viewportWidth, height: 34}),
        ]}
        testID={testID}>
        {options.map(option => (
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  )
}
