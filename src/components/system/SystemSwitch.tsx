import {ModulaSwitch} from '@/platform/ui/controls/modula-switch'

type SystemSwitchProps = {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  disabled?: boolean
  testID?: string
}

/** Settings switch — Expo UI Switch on native via ModulaSwitch adapter. */
export function SystemSwitch({
  value,
  onValueChange,
  label,
  disabled,
  testID,
}: SystemSwitchProps) {
  return (
    <ModulaSwitch
      value={value}
      onValueChange={onValueChange}
      label={label}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
    />
  )
}
