import {Stepper} from 'konsta/react'
import type {KeyboardEvent} from 'react'

export function KonstaStepper({
  decrementLabel,
  disabled,
  incrementLabel,
  onDecrement,
  onIncrement,
  testID,
  value,
}: {
  decrementLabel: string
  disabled?: boolean
  incrementLabel: string
  onDecrement: () => void
  onIncrement: () => void
  testID?: string
  value: number
}) {
  const captureRoot = (root: HTMLElement | null) => {
    if (!root) return
    const controls = root.querySelectorAll<HTMLElement>('[role="button"]')
    const configure = (control: HTMLElement | undefined, action: 'decrement' | 'increment', label: string) => {
      if (!control) return
      control.dataset.modulaStepperAction = action
      control.setAttribute('aria-label', label)
      control.setAttribute('aria-disabled', String(Boolean(disabled)))
      control.tabIndex = disabled ? -1 : 0
    }
    configure(controls[0], 'decrement', decrementLabel)
    configure(controls[1], 'increment', incrementLabel)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return
    const action = (event.target as HTMLElement).dataset.modulaStepperAction
    if (!action) return
    event.preventDefault()
    if (action === 'decrement') onDecrement()
    else onIncrement()
  }

  return (
    <Stepper
      aria-disabled={disabled}
      className="modula-konsta-stepper"
      data-testid={testID}
      onKeyDown={onKeyDown}
      onMinus={disabled ? undefined : onDecrement}
      onPlus={disabled ? undefined : onIncrement}
      outline
      ref={captureRoot}
      rounded
      value={value}
    />
  )
}
