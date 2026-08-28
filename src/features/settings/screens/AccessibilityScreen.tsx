import {useRouter, type Href} from 'expo-router'

import {
  SettingsHero,
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAppearance} from '@/theme/runtime/useAppearance'

export function AccessibilityScreen() {
  const router = useRouter()
  const {systemAccessibility, resolved} = useAppearance()
  const screenReaderValue = systemAccessibility.screenReaderEnabled ? 'On' : 'Off'
  const motionValue = resolved.accessibility.reduceMotion ? 'On' : 'Off'

  return (
    <SettingsScreen
      title="Accessibility"
      right={
        <SettingsOverflowMenu
          title="Accessibility"
          actions={[
            {id: 'appearance', label: 'Open Appearance'},
            {id: 'display', label: 'Display & Text Size'},
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
        body="Adapt Modula for vision, motion, hearing, and speech. System features stay in your device settings — Modula cannot turn them on or off."
      />

      <SettingsSection
        title="Vision"
        footer="VoiceOver, Hover Text, and Spoken Content stay in your device settings.">
        <SettingsLinkRow
          row={{
            title: 'VoiceOver',
            icon: 'eye',
            iconDomain: 'accessibility',
            value: screenReaderValue,
            route: '/settings/accessibility/voiceover',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Display & Text Size',
            icon: 'text',
            iconDomain: 'language',
            route: '/settings/display-and-text',
            keywords: ['dynamic type', 'bold', 'contrast', 'larger text'],
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Hover Text',
            icon: 'search',
            iconDomain: 'accessibility',
            route: '/settings/accessibility/hover-text',
            keywords: ['pointer', 'magnify'],
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Motion',
            icon: 'motion',
            iconDomain: 'accessibility',
            route: '/settings/motion',
            value: motionValue,
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Read & Speak',
            icon: 'text',
            iconDomain: 'accessibility',
            route: '/settings/accessibility/read-and-speak',
          }}
          last
        />
      </SettingsSection>

      <SettingsSection title="Physical and Motor">
        <SettingsLinkRow
          row={{
            title: 'Touch',
            icon: 'switch',
            iconDomain: 'interaction',
            route: '/settings/touch',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Voice Control',
            icon: 'comment',
            iconDomain: 'speech',
            route: '/settings/accessibility/voice-control',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Switch Control',
            icon: 'switch',
            iconDomain: 'interaction',
            route: '/settings/accessibility/switch-control',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Keyboard',
            icon: 'text',
            iconDomain: 'interaction',
            route: '/settings/accessibility/keyboard',
          }}
          last
        />
      </SettingsSection>

      <SettingsSection title="Hearing">
        <SettingsLinkRow
          row={{
            title: 'Captions',
            icon: 'note',
            iconDomain: 'hearing',
            route: '/settings/accessibility/captions',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Live Captions',
            icon: 'comment',
            iconDomain: 'hearing',
            route: '/settings/accessibility/live-captions',
          }}
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Speech"
        footer="System features stay in your device settings. Modula does not pretend to enable or disable them.">
        <SettingsLinkRow
          row={{
            title: 'Live Speech',
            icon: 'comment',
            iconDomain: 'speech',
            route: '/settings/accessibility/live-speech',
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Assistive Access',
            icon: 'people',
            iconDomain: 'interaction',
            route: '/settings/accessibility/assistive-access',
          }}
          last
        />
      </SettingsSection>

      <SettingsSection title="General">
        <SettingsLinkRow
          row={{
            title: 'Appearance',
            icon: 'appearance',
            iconDomain: 'appearance',
            route: '/settings/appearance',
          }}
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
