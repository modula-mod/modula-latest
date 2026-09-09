import {Checkbox} from 'konsta/react'

export function KonstaCheckbox({
  accessibilityLabel,
  disabled,
  label,
  onValueChange,
  testID,
  value,
}: {
  accessibilityLabel: string
  disabled?: boolean
  label?: string
  onValueChange: (value: boolean) => void
  testID?: string
  value: boolean
}) {
  return (
    <Checkbox
      checked={value}
      className="modula-konsta-checkbox"
      data-testid={testID}
      disabled={disabled}
      onChange={event => onValueChange(event.currentTarget.checked)}>
      <span>{label ?? accessibilityLabel}</span>
    </Checkbox>
  )
}
