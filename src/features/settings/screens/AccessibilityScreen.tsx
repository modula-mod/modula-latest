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
  const {resolved} = useAppearance()
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
        body="Text, motion, and contrast controls that Modula can actually change. VoiceOver, Hover Text, and other system features stay in your device settings."
      />

      <SettingsSection
        title="Vision"
        footer="VoiceOver, Hover Text, Zoom, and Spoken Content stay in your device settings.">
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
            title: 'Motion',
            icon: 'motion',
            iconDomain: 'accessibility',
            route: '/settings/motion',
            value: motionValue,
            keywords: ['reduce motion'],
          }}
          last
        />
      </SettingsSection>

      <SettingsSection title="Appearance">
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
