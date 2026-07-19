import {Host, Picker, Text} from '@expo/ui/swift-ui'
import {pickerStyle, tag, tint} from '@expo/ui/swift-ui/modifiers'

import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useSegmentedVisibleOptions} from '@/platform/ui/controls/use-segmented-visible-options'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Native Expo UI segmented Picker — theme via Host seedColor + accent tint.
 * Supports automatic progressive loading of more segments into the same control.
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  initialVisibleCount,
  revealBatchSize,
  autoRevealIntervalMs,
  onRevealMore,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {visibleOptions, hasMore, revealMoreNow} = useSegmentedVisibleOptions({
    options,
    value,
    initialVisibleCount,
    revealBatchSize,
    autoRevealIntervalMs,
    onRevealMore,
  })
  const allowed = new Set(options.map(option => option.value))

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{alignSelf: 'stretch', width: '100%'}, style]}>
      <Picker
        label={accessibilityLabel}
        selection={value}
        onSelectionChange={selection => {
          if (typeof selection !== 'string' || !allowed.has(selection)) return
          onValueChange(selection)
          // Selecting near the trailing edge kicks another reveal immediately.
          const index = visibleOptions.findIndex(option => option.value === selection)
          if (hasMore && index >= visibleOptions.length - 1) {
            revealMoreNow()
          }
        }}
        modifiers={[pickerStyle('segmented'), tint(colours.accent)]}
        testID={testID}>
        {visibleOptions.map(option => (
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  )
}
