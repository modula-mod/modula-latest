import {Host, HStack, Picker, ScrollView, Button, Text} from '@expo/ui/swift-ui'
import {
  buttonStyle,
  controlSize,
  frame,
  pickerStyle,
  scrollIndicators,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers'
import {useWindowDimensions} from 'react-native'

import {ModulaSegmentedPicker as SharedModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker.shared'
import type {ModulaSegmentedPickerProps} from '@/platform/ui/controls/modula-segmented-picker.types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

const DEFAULT_SCROLL_MAX_WIDTH = 340
const DEFAULT_SEGMENT_MIN_WIDTH = 86

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
  segmentMinWidth = DEFAULT_SEGMENT_MIN_WIDTH,
  maxWidth,
}: ModulaSegmentedPickerProps) {
  const {colours, scheme} = useThemeTokens()
  const {width: windowWidth} = useWindowDimensions()
  const allowed = new Set(options.map(option => option.value))

  const viewportCap = maxWidth ?? (scrollable ? DEFAULT_SCROLL_MAX_WIDTH : windowWidth)
  const viewportWidth = Math.min(windowWidth - 32, viewportCap)

  if (appearance !== 'segmented' || scrollable) {
    if (scrollable && appearance === 'segmented') {
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
              height: 40,
            },
            style,
          ]}>
          <ScrollView
            axes="horizontal"
            showsIndicators={false}
            modifiers={[
              scrollIndicators('hidden', 'horizontal'),
              frame({width: viewportWidth, height: 40, maxWidth: viewportWidth}),
            ]}>
            <HStack spacing={4} alignment="center">
              {options.map(option => {
                const selected = option.value === value
                return (
                  <Button
                    key={option.value}
                    label={option.label}
                    onPress={
                      option.disabled
                        ? undefined
                        : () => {
                            if (allowed.has(option.value)) {
                              onValueChange(option.value)
                            }
                          }
                    }
                    modifiers={[
                      buttonStyle(selected ? 'borderedProminent' : 'bordered'),
                      tint(colours.accent),
                      controlSize('regular'),
                      frame({minWidth: segmentMinWidth, height: 34}),
                    ]}
                  />
                )
              })}
            </HStack>
          </ScrollView>
        </Host>
      )
    }

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
          alignSelf: 'center',
          width: viewportWidth,
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
