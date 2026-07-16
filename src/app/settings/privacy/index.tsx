import {router} from 'expo-router'

import {AppScreen} from '@/components/primitives/AppScreen'
import {SystemListRow, SystemSection, SystemSwitch} from '@/components/system'
import {useState} from 'react'

export default function PrivacySettingsScreen() {
  const [privateAccount, setPrivateAccount] = useState(false)
  return (
    <AppScreen scroll>
      <SystemSection title="Account privacy">
        <SystemListRow
          title="Private account"
          subtitle="Approve followers before they see posts"
          right={
            <SystemSwitch
              value={privateAccount}
              onValueChange={setPrivateAccount}
            />
          }
          showDivider={false}
        />
      </SystemSection>
      <SystemSection title="More">
        <SystemListRow
          title="Activity privacy"
          onPress={() => router.push('/settings/privacy/activity')}
        />
        <SystemListRow
          title="App passwords"
          subtitle="Local development tokens (stub)"
          onPress={() => router.push('/settings/privacy/app-passwords')}
          showDivider={false}
        />
      </SystemSection>
    </AppScreen>
  )
}
