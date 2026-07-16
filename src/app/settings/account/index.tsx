import {router} from 'expo-router'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {SystemListRow, SystemSection} from '@/components/system'
import {useTheme} from '@/theme/runtime/useTheme'

export default function AccountSettingsScreen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText colour="textSecondary" style={{marginBottom: spacing.lg}}>
        Account settings IA mirrors Bluesky categories. Auth-backed actions are stubs
        until Phase 4.
      </AppText>
      <SystemSection title="Signed in as">
        <SystemListRow
          title="Modula"
          subtitle="@modula.digital · Development profile"
          showDivider={false}
        />
      </SystemSection>
      <SystemSection title="Account">
        <SystemListRow title="Email" subtitle="Not connected" onPress={() => router.push('/settings/account/email')} />
        <SystemListRow title="Password" subtitle="Change password" onPress={() => router.push('/settings/account/password')} />
        <SystemListRow title="Export my data" onPress={() => router.push('/settings/account/export')} />
        <SystemListRow
          title="Delete account"
          subtitle="Permanent — stub only"
          onPress={() => router.push('/settings/account/delete')}
          showDivider={false}
        />
      </SystemSection>
    </AppScreen>
  )
}
