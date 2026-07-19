import {Host, Picker, Text} from '@expo/ui/swift-ui'
import {pickerStyle, tag, tint} from '@expo/ui/swift-ui/modifiers'

import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Native Expo UI segmented Picker — theme via Host seedColor + accent tint.
 * Keep option counts small (≤4) so UISegmentedControl stays readable.
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const allowed = new Set(options.map(option => option.value))

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{alignSelf: 'stretch'}, style]}>
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
}
