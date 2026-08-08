import {SegmentedControl} from '@expo/ui/community/segmented-control'
import {useMemo} from 'react'
import {useWindowDimensions} from 'react-native'

import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

/**
 * Native adapter:
 * - `segmented` — `@expo/ui/community/segmented-control` (SwiftUI segmented Picker)
 * - `glass` / `plain` / `scrollable` / sticky overlays — shared RN implementation
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

  // Sticky / glass / track / scrollable → shared RN (Host Picker historically brittle in overlays).
  if (appearance !== 'segmented' || scrollable || embedded) {
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
          height: 34,
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
