import {
  SettingsHero,
  SettingsScreen,
} from '@/features/settings/components/SettingsRows'
import {
  SystemAdaptationSection,
  SystemAdaptationStatusNote,
} from '@/features/settings/components/SystemAdaptationSection'

export function DisplayAndTextScreen() {
  return (
    <SettingsScreen title="Display & Text">
      <SettingsHero
        icon="text"
        iconDomain="language"
        title="Display & Text"
        body="Control how Modula scales type, weight, contrast, and motion. System follows this device. Custom changes apply to Modula only."
      />
      <SystemAdaptationSection />
      <SystemAdaptationStatusNote />
    </SettingsScreen>
  )
}
