import {useRouter, type Href} from 'expo-router'

import {
  SettingsInfoRow,
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAppearance} from '@/theme/runtime/useAppearance'

export function AccessibilityScreen() {
  const router = useRouter()
  const {resolved} = useAppearance()
  const motionValue = resolved.accessibility.reduceMotion ? 'On' : 'Off'

  return (
    <SettingsScreen
      title="Accessibility"
      caption="Modula controls appear first. Device-owned assistive technologies are identified here without pretending the app can change them."
      right={
        <SettingsOverflowMenu
          title="Accessibility"
          actions={[
            {id: 'appearance', label: 'Open Appearance'},
            {id: 'display', label: 'Display & Text Size'},
            {id: 'motion', label: 'Motion'},
          ]}
          onAction={id => {
            if (id === 'appearance') router.push('/settings/appearance' as Href)
            if (id === 'display') router.push('/settings/display-and-text' as Href)
            if (id === 'motion') router.push('/settings/motion' as Href)
          }}
        />
      }>
      <SettingsSection title="Modula">
        <SettingsLinkRow
          row={{
            title: 'Display & Text Size',
            description: 'Text scale, bold text, contrast, and transparency.',
            icon: 'text',
            iconDomain: 'language',
            route: '/settings/display-and-text',
            keywords: ['dynamic type', 'bold', 'contrast', 'larger text'],
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Motion',
            description: 'Prefer quieter transitions throughout Modula.',
            icon: 'motion',
            iconDomain: 'accessibility',
            route: '/settings/motion',
            value: motionValue,
            keywords: ['reduce motion'],
          }}
        />
        <SettingsLinkRow
          row={{
            title: 'Appearance',
            description: 'Theme, surface, accent, and OLED presentation.',
            icon: 'appearance',
            iconDomain: 'appearance',
            route: '/settings/appearance',
          }}
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Vision & Speech"
        footer="VoiceOver, Hover Text, and Read & Speak are controlled in your device settings.">
        <SettingsInfoRow
          icon="eye"
          iconDomain="accessibility"
          label="VoiceOver"
          value="Device Settings"
          description="Modula supplies labels, traits, and a logical reading order."
        />
        <SettingsInfoRow
          icon="text"
          iconDomain="accessibility"
          label="Hover Text"
          value="Device Settings"
          description="Modula keeps text scalable and avoids clipped fixed-height labels."
        />
        <SettingsInfoRow
          icon="messages"
          iconDomain="accessibility"
          label="Read & Speak"
          value="Device Settings"
          description="Readable content remains available to system speech features."
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Interaction"
        footer="Voice Control, Switch Control, hardware keyboard features, and Assistive Access remain system owned.">
        <SettingsInfoRow
          icon="messages"
          iconDomain="accessibility"
          label="Voice Control"
          value="Device Settings"
          description="Controls use concise, unique accessible names."
        />
        <SettingsInfoRow
          icon="switch"
          iconDomain="accessibility"
          label="Switch Control"
          value="Device Settings"
          description="Interactive elements expose standard roles and states."
        />
        <SettingsInfoRow
          icon="developer"
          iconDomain="accessibility"
          label="Keyboard"
          value="Supported"
          description="Web and desktop routes preserve conventional focus and activation."
        />
        <SettingsInfoRow
          icon="accessibility"
          iconDomain="accessibility"
          label="Assistive Access"
          value="Device Settings"
          description="Modula respects the simplified system environment where available."
          last
        />
      </SettingsSection>

      <SettingsSection
        title="Hearing & Live Speech"
        footer="Captions and Live Speech are configured by the operating system; Modula does not show fake switches for them.">
        <SettingsInfoRow
          icon="text"
          iconDomain="accessibility"
          label="Captions"
          value="Device Settings"
          description="Media surfaces reserve semantic caption support when supplied."
        />
        <SettingsInfoRow
          icon="messages"
          iconDomain="accessibility"
          label="Live Speech"
          value="Device Settings"
          description="Text inputs remain compatible with system speech workflows."
          last
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
