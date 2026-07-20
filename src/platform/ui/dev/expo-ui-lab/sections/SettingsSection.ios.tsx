import {DisclosureGroup, Picker, Section, Text, Toggle} from '@expo/ui/swift-ui'
import {tag} from '@expo/ui/swift-ui/modifiers'
import {useState} from 'react'

import {useExpoUiLab} from '@/platform/ui/dev/expo-ui-lab/LabContext'

export function SettingsSection() {
  const {settings, updateSettings} = useExpoUiLab()
  const [settingsExpanded, setSettingsExpanded] = useState(false)

  const themeOptions = ['light', 'dark', 'auto'] as const
  const languageOptions = ['en', 'es', 'fr', 'de'] as const

  return (
    <Section title="App Settings">
      <Toggle
        label="Push Notifications"
        isOn={settings.notifications}
        onIsOnChange={value => updateSettings({notifications: value})}
      />
      <Toggle
        label="Auto-save Changes"
        isOn={settings.autoSave}
        onIsOnChange={value => updateSettings({autoSave: value})}
      />

      <DisclosureGroup
        label="Advanced Settings"
        isExpanded={settingsExpanded}
        onIsExpandedChange={setSettingsExpanded}>
        <Picker
          label="App Theme"
          selection={settings.theme}
          onSelectionChange={selection => {
            if (
              typeof selection === 'string' &&
              themeOptions.includes(selection as (typeof themeOptions)[number])
            ) {
              updateSettings({
                theme: selection as (typeof themeOptions)[number],
              })
            }
          }}>
          {themeOptions.map(option => (
            <Text key={option} modifiers={[tag(option)]}>
              {option}
            </Text>
          ))}
        </Picker>

        <Picker
          label="Language"
          selection={settings.language}
          onSelectionChange={selection => {
            if (
              typeof selection === 'string' &&
              languageOptions.includes(
                selection as (typeof languageOptions)[number],
              )
            ) {
              updateSettings({language: selection})
            }
          }}>
          {languageOptions.map(option => (
            <Text key={option} modifiers={[tag(option)]}>
              {option}
            </Text>
          ))}
        </Picker>
      </DisclosureGroup>
    </Section>
  )
}
