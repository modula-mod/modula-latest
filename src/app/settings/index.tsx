import {router} from 'expo-router'

import {AppScreen} from '@/components/primitives/AppScreen'
import {SystemListRow, SystemSection} from '@/components/system'

export default function SettingsIndexScreen() {
  return (
    <AppScreen scroll>
      <SystemSection title="Account">
        <SystemListRow
          title="Account"
          subtitle="Email, password, export, delete"
          onPress={() => router.push('/settings/account')}
        />
        <SystemListRow
          title="Privacy & security"
          subtitle="Visibility, app passwords, activity"
          onPress={() => router.push('/settings/privacy')}
          showDivider={false}
        />
      </SystemSection>

      <SystemSection title="Moderation">
        <SystemListRow
          title="Moderation"
          subtitle="Muted, blocked, moderation lists"
          onPress={() => router.push('/settings/moderation')}
          showDivider={false}
        />
      </SystemSection>

      <SystemSection title="Experience">
        <SystemListRow
          title="Appearance"
          subtitle="Colour mode, accent, Surface Types"
          onPress={() => router.push('/settings/appearance')}
        />
        <SystemListRow
          title="Accessibility"
          subtitle="Motion and readability"
          onPress={() => router.push('/settings/accessibility')}
        />
        <SystemListRow
          title="Content & media"
          subtitle="External media and autoplay"
          onPress={() => router.push('/settings/content-media')}
        />
        <SystemListRow
          title="Notifications"
          subtitle="Push and in-app alerts"
          onPress={() => router.push('/settings/notifications')}
        />
        <SystemListRow
          title="Languages"
          subtitle="App and content languages"
          onPress={() => router.push('/settings/language')}
        />
        <SystemListRow
          title="Feed preferences"
          subtitle="Following and thread defaults"
          onPress={() => router.push('/settings/feeds')}
        />
        <SystemListRow
          title="Interests"
          subtitle="Discovery signals"
          onPress={() => router.push('/settings/interests')}
        />
        <SystemListRow
          title="Lists"
          subtitle="Curated account lists"
          onPress={() => router.push('/settings/lists')}
          showDivider={false}
        />
      </SystemSection>

      <SystemSection title="Modula">
        <SystemListRow
          title="Modules"
          subtitle="Installed module settings"
          onPress={() => router.push('/settings/modules')}
        />
        <SystemListRow
          title="Marketplace"
          subtitle="Discover modules and themes"
          onPress={() => router.push('/settings/marketplace')}
        />
        <SystemListRow
          title="About"
          subtitle="Foundation status"
          onPress={() => router.push('/settings/about')}
        />
        <SystemListRow
          title="Developer"
          subtitle="Diagnostics and component gallery"
          onPress={() => router.push('/settings/developer')}
          showDivider={false}
        />
      </SystemSection>
    </AppScreen>
  )
}
