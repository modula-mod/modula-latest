import {Host, Picker, Text} from '@expo/ui/swift-ui'
import {pickerStyle, tag, tint} from '@expo/ui/swift-ui/modifiers'

import {ModulaSegmentedScrollRail} from '@/platform/ui/controls/modula-segmented-scroll-rail'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Expo UI segmented Picker — theme-aware via Host seedColor + tint.
 * `layout="scroll"` uses a progressive rail (swipe near right → reveal more).
 */
export function ModulaSegmentedPicker({
  options,
  value,
  onValueChange,
  accessibilityLabel,
  style,
  testID,
  layout = 'fit',
  initialVisibleCount,
  revealBatchSize,
  onNearEnd,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()

  if (layout === 'scroll') {
    return (
      <ModulaSegmentedScrollRail
        options={options}
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        style={style}
        testID={testID}
        initialVisibleCount={initialVisibleCount}
        revealBatchSize={revealBatchSize}
        onNearEnd={onNearEnd}
      />
    )
  }

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
