import {useId} from 'react'

import {KonstaRadio} from '@/platform/ui/adapters/konsta/radio.web'
import type {ModulaRadioGroupProps} from '@/platform/ui/controls/modula-radio-group'

export function ModulaRadioGroup({label, choices, value, onValueChange, testID}: ModulaRadioGroupProps) {
  const generatedName = useId()
  return (
    <fieldset aria-label={label} className="modula-konsta-radio-group" data-testid={testID}>
      <legend className="modula-web-visually-hidden">{label}</legend>
      {choices.map(choice => (
        <KonstaRadio
          checked={choice.id === value}
          description={choice.description}
          disabled={choice.disabled}
          key={choice.id}
          label={choice.label}
          name={generatedName}
          onSelect={() => onValueChange(choice.id)}
          value={choice.id}
        />
      ))}
    </fieldset>
  )
}
