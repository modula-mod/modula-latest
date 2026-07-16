import {router} from 'expo-router'

import {AppScreen} from '@/components/primitives/AppScreen'
import {SystemListRow, SystemSection} from '@/components/system'

export default function ModerationSettingsScreen() {
  return (
    <AppScreen scroll>
      <SystemSection title="Safety">
        <SystemListRow title="Muted accounts" onPress={() => router.push('/settings/moderation/muted')} />
        <SystemListRow title="Blocked accounts" onPress={() => router.push('/settings/moderation/blocked')} />
        <SystemListRow
          title="Moderation lists"
          onPress={() => router.push('/settings/moderation/lists')}
          showDivider={false}
        />
      </SystemSection>
    </AppScreen>
  )
}
