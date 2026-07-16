import {useState} from 'react'
import {View} from 'react-native'
import {router} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {ProfileHeader} from '@/features/profile/ProfileHeader'
import {ProfileTabs} from '@/features/profile/ProfileTabs'
import {ScreenHeader} from '@/shell/ScreenHeader'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

const TABS = ['Posts', 'Media', 'Modules'] as const

export default function ProfileScreen() {
  const {colours, spacing, radius} = useTheme()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Posts')

  return (
    <AppScreen padded={false}>
      <ScreenHeader
        title="Profile"
        right={
          <AppPressable onPress={() => router.push('/settings')}>
            <AppText colour="accent">Settings</AppText>
          </AppPressable>
        }
      />
      <AppScreen scroll>
        <ProfileHeader
          displayName="Modula"
          handle="modula.digital"
          bio="Owner profile structure placeholder — public and private surfaces share one identity."
          onEditPress={() => stubAction('Edit profile')}
          editLabel="Owner controls (stub)"
        />

        <ProfileTabs tabs={TABS} value={tab} onChange={setTab} />

        <View
          style={{
            marginTop: spacing.lg,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colours.surface,
            borderColor: colours.border,
            borderWidth: 1,
          }}>
          <AppText colour="textSecondary">
            {tab} tab — placeholder content. Real profile sections arrive in Phase 3.
          </AppText>
        </View>
      </AppScreen>
    </AppScreen>
  )
}
