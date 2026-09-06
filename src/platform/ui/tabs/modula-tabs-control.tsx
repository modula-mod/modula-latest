import type {StyleProp, ViewStyle} from 'react-native'

import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaMotionTabs} from '@/platform/ui/tabs/modula-motion-tabs'

export type ModulaTabPresentation =
  | 'navigation'
  | 'segmented'
  | 'scrollable'
  | 'underline'

export type ModulaTabOption = {
  id: string
  label: string
  accessibilityLabel?: string
  disabled?: boolean
}

export type ModulaTabsProps = {
  tabs: ModulaTabOption[]
  value: string
  onValueChange: (value: string) => void
  presentation?: ModulaTabPresentation
  accessibilityLabel?: string
  segmentMinWidth?: number
  maxWidth?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * One semantic content-tab API. The implementation chooses an existing,
 * platform-aware control instead of asking screens to size their own rails.
 */
export function ModulaTabs({
  tabs,
  value,
  onValueChange,
  presentation = 'segmented',
  accessibilityLabel,
  segmentMinWidth,
  maxWidth,
  style,
  testID,
}: ModulaTabsProps) {
  if (presentation === 'underline' || presentation === 'navigation') {
    return (
      <ModulaMotionTabs
        accessibilityLabel={accessibilityLabel}
        onSelectTab={onValueChange}
        selectedTabId={value}
        style={style}
        tabs={tabs.map(tab => ({
          id: tab.id,
          title: tab.label,
          accessibilityLabel: tab.accessibilityLabel,
          disabled: tab.disabled,
        }))}
        testID={testID}
      />
    )
  }

  return (
    <ModulaSegmentedPicker
      accessibilityLabel={accessibilityLabel}
      appearance={presentation === 'scrollable' ? 'plain' : 'segmented'}
      maxWidth={maxWidth}
      onValueChange={onValueChange}
      options={tabs.map(tab => ({
        value: tab.id,
        label: tab.label,
        disabled: tab.disabled,
      }))}
      scrollable={presentation === 'scrollable'}
      segmentMinWidth={segmentMinWidth}
      style={style}
      testID={testID}
      value={value}
    />
  )
}
