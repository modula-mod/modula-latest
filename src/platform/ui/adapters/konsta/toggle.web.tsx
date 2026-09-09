import {Toggle} from 'konsta/react'

export function KonstaToggle({
  accessibilityLabel,
  disabled,
  onValueChange,
  testID,
  value,
}: {
  accessibilityLabel: string
  disabled?: boolean
  onValueChange: (value: boolean) => void
  testID?: string
  value: boolean
}) {
  return (
    <Toggle
      aria-label={accessibilityLabel}
      checked={value}
      className="modula-konsta-toggle"
      data-testid={testID}
      disabled={disabled}
      onChange={event => onValueChange(event.currentTarget.checked)}>
      <span className="modula-web-visually-hidden">{accessibilityLabel}</span>
    </Toggle>
  )
}
