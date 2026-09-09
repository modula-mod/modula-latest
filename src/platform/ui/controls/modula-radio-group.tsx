import {View} from 'react-native'

import {ModulaListRow} from '@/platform/ui/lists'

export type ModulaChoice = {
  id: string
  label: string
  description?: string
  disabled?: boolean
}

export type ModulaRadioGroupProps = {
  label: string
  choices: ModulaChoice[]
  value: string
  onValueChange: (value: string) => void
  testID?: string
}

export function ModulaRadioGroup({label, choices, value, onValueChange, testID}: ModulaRadioGroupProps) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" testID={testID}>
      {choices.map((choice, index) => (
        <ModulaListRow
          accessibilityRole="radio"
          accessibilityState={{checked: choice.id === value, disabled: choice.disabled}}
          accessory="check"
          description={choice.description}
          disabled={choice.disabled}
          key={choice.id}
          last={index === choices.length - 1}
          onPress={() => onValueChange(choice.id)}
          selected={choice.id === value}
          title={choice.label}
          variant="action"
        />
      ))}
    </View>
  )
}
