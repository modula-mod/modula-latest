import {Range} from 'konsta/react'
import {useId} from 'react'

export function KonstaRange({
  accessibilityLabel,
  disabled,
  max,
  min,
  onValueChange,
  step,
  testID,
  value,
}: {
  accessibilityLabel: string
  disabled?: boolean
  max: number
  min: number
  onValueChange: (value: number) => void
  step: number
  testID?: string
  value: number
}) {
  const generatedId = useId()
  const inputId = testID ? `${testID}-input` : `modula-range-${generatedId}`
  return (
    <div className="modula-konsta-range-wrap" data-testid={testID}>
      <label className="modula-web-visually-hidden" htmlFor={inputId}>{accessibilityLabel}</label>
      <Range
        className="modula-konsta-range"
        disabled={disabled}
        inputId={inputId}
        max={max}
        min={min}
        onInput={event => onValueChange(Number(event.currentTarget.value))}
        step={step}
        value={value}
      />
    </div>
  )
}
