import {DatePicker, Picker, Section, Text} from '@expo/ui/swift-ui'
import {
  cornerRadius,
  font,
  frame,
  tag,
} from '@expo/ui/swift-ui/modifiers'
import {useState} from 'react'

import {useExpoUiLab} from '@/platform/ui/dev/expo-ui-lab/LabContext'

type Displayed = 'date' | 'hourAndMinute' | 'dateAndTime'

export function DateTimeSection() {
  const {selectedDate, setSelectedDate} = useExpoUiLab()
  const [pickerType, setPickerType] = useState<Displayed>('date')

  const typeOptions: Displayed[] = ['date', 'hourAndMinute', 'dateAndTime']
  const displayedComponents =
    pickerType === 'dateAndTime'
      ? (['date', 'hourAndMinute'] as const)
      : ([pickerType] as const)

  return (
    <Section title="Date & Time Management">
      <Text modifiers={[font({size: 16})]}>
        {`Current Selection: ${selectedDate.toLocaleString()}`}
      </Text>

      <Picker
        label="Picker Type"
        selection={pickerType}
        onSelectionChange={selection => {
          if (
            typeof selection === 'string' &&
            typeOptions.includes(selection as Displayed)
          ) {
            setPickerType(selection as Displayed)
          }
        }}>
        {typeOptions.map(option => (
          <Text key={option} modifiers={[tag(option)]}>
            {option}
          </Text>
        ))}
      </Picker>

      <DatePicker
        title="Select"
        selection={selectedDate}
        displayedComponents={[...displayedComponents]}
        onDateChange={setSelectedDate}
        modifiers={[frame({width: 300}), cornerRadius(10)]}
      />
    </Section>
  )
}
