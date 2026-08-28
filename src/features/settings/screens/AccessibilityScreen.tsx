import {Platform} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {
  SettingsHero,
  SettingsInfoRow,
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAppearance} from '@/theme/runtime/useAppearance'

function platformNoun(): string {
  if (Platform.OS === 'ios') return 'iPhone'
  if (Platform.OS === 'android') return 'Android'
  return 'device'
}

export function AccessibilityScreen() {
  const router = useRouter()
  const {systemAccessibility, resolved} = useAppearance()
  const noun = platformNoun()
  const screenReaderValue = systemAccessibility.screenReaderEnabled
    ? 'Active'
    : `Uses your ${noun} settings`
  const motionValue = resolved.accessibility.reduceMotion ? 'Reduced' : 'System'
  const displayValue = resolved.accessibility.followSystemTextSize
    ? 'System'
    : 'Custom'

  return (
    <SettingsScreen
      title="Accessibility"
      right={
        <SettingsOverflowMenu
          title="Accessibility"
          actions={[
            {id: 'appearance', label: 'Open Appearance'},
            {id: 'display', label: 'Display & Text'},
          ]}
          onAction={id => {
            if (id === 'appearance') router.push('/settings/appearance' as Href)
            if (id === 'display') router.push('/settings/display-and-text' as Href)
          }}
        />
      }>
      <SettingsHero
        icon="accessibility"
        iconDomain="accessibility"
        title="Accessibility"
        body={`Modula follows your ${noun} accessibility settings and adds app-specific controls for text, motion, contrast, and interaction.`}
      />

      <SettingsSection title="Vision">
        <SettingsInfoRow
          icon="eye"
          iconDomain="accessibility"
          label="VoiceOver"
          value={screenReaderValue}
          description="Modula cannot turn the system screen reader on or off."
        />
        <SettingsLinkRow
          row={{
            title: 'Display & Text',
            icon: 'text',
            iconDomain: 'language',
            route: '/settings/display-and-text',
            value: displayValue,
            keywords: ['dynamic type', 'bold', 'contrast'],
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Motion',
            icon: 'motion',
            iconDomain: 'accessibility',
            route: '/settings/display-and-text',
            value: motionValue,
          }}
        />
        <SettingsInfoRow
          icon="text"
          iconDomain="accessibility"
          label="Read & Speak"
          value={`Uses your ${noun} settings`}
          description="Post and settings text stay selectable for Spoken Content."
        />
        <SettingsInfoRow
          icon="search"
          iconDomain="accessibility"
          label="Hover Text"
          value={`Uses your ${noun} settings`}
          last
        />
      </SettingsSection>

      <SettingsSection title="Interaction & motor">
        <SettingsLinkRow
          row={{
            title: 'Touch & Gestures',
            icon: 'switch',
            iconDomain: 'interaction',
            route: '/settings/display-and-text',
            value: '44 pt targets',
          }}
        />
        <SettingsInfoRow
          icon="comment"
          iconDomain="speech"
          label="Voice Control"
          value={`Uses your ${noun} settings`}
          description="Controls expose names Voice Control can speak."
        />
        <SettingsInfoRow
          icon="switch"
          iconDomain="interaction"
          label="Switch Control"
          value={`Uses your ${noun} settings`}
        />
        <SettingsInfoRow
          icon="text"
          iconDomain="interaction"
          label="Keyboard"
          value={Platform.OS === 'web' ? 'Tab and arrows' : `Uses your ${noun} settings`}
          last
        />
      </SettingsSection>

      <SettingsSection title="Hearing">
        <SettingsInfoRow
          icon="note"
          iconDomain="hearing"
          label="Captions"
          value="When media includes captions"
        />
        <SettingsInfoRow
          icon="comment"
          iconDomain="hearing"
          label="Live Captions"
          value={`Uses your ${noun} settings`}
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Speech & cognitive"
        footer="System features stay in your device settings. Modula does not pretend to enable or disable them.">
        <SettingsInfoRow
          icon="comment"
          iconDomain="speech"
          label="Live Speech"
          value={`Uses your ${noun} settings`}
        />
        <SettingsInfoRow
          icon="people"
          iconDomain="interaction"
          label="Assistive Access"
          value="Compatible layout"
          description="Major actions stay tappable. Full Assistive Access optimisation is not claimed."
          last
        />
      </SettingsSection>

      <SettingsSection title="Related">
        <SettingsLinkRow
          row={{
            title: 'Appearance',
            icon: 'appearance',
            iconDomain: 'appearance',
            route: '/settings/appearance',
            description: 'Theme, OLED, accent, and Surface Type.',
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
