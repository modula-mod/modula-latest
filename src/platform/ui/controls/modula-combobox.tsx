import {ModulaSelectField} from '@/platform/ui/controls/modula-select-field'

export type ModulaComboboxOption = {value: string; label: string; description?: string}
export type ModulaComboboxProps = {
  value?: string
  options: ModulaComboboxOption[]
  onChange: (value: string | undefined) => void
  label: string
  placeholder?: string
  disabled?: boolean
  noResultsLabel?: string
  testID?: string
}

/** Native fallback keeps the semantic contract and uses the platform picker. */
export function ModulaCombobox({value, options, onChange, label, placeholder, disabled}: ModulaComboboxProps) {
  return (
    <ModulaSelectField
      accessibilityLabel={label}
      loading={disabled}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      value={value}
    />
  )
}
