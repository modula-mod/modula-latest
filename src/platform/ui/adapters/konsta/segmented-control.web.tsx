import {Segmented, SegmentedButton} from 'konsta/react'

import type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

export function KonstaSegmentedControl({
  accessibilityLabel,
  onValueChange,
  options,
  testID,
  value,
}: {
  accessibilityLabel?: string
  onValueChange: (value: string) => void
  options: ModulaSegmentedOption[]
  testID?: string
  value: string
}) {
  return (
    <Segmented
      aria-label={accessibilityLabel}
      className="modula-konsta-segmented"
      data-testid={testID}
      role="tablist"
      rounded
      strong>
      {options.map(option => {
        const selected = option.value === value
        return (
          <SegmentedButton
            active={selected}
            aria-label={option.label}
            aria-selected={selected}
            disabled={option.disabled}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            role="tab"
            type="button">
            {option.label}
          </SegmentedButton>
        )
      })}
    </Segmented>
  )
}
