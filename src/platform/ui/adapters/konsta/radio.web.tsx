import {Radio} from 'konsta/react'

export function KonstaRadio({
  checked,
  description,
  disabled,
  label,
  name,
  onSelect,
  value,
}: {
  checked: boolean
  description?: string
  disabled?: boolean
  label: string
  name: string
  onSelect: () => void
  value: string
}) {
  return (
    <Radio
      checked={checked}
      className="modula-konsta-radio"
      disabled={disabled}
      name={name}
      onChange={event => { if (event.currentTarget.checked) onSelect() }}
      value={value}>
      <span className="modula-konsta-choice-copy">
        <span>{label}</span>
        {description ? <span className="modula-konsta-choice-description">{description}</span> : null}
      </span>
    </Radio>
  )
}
