import {View, StyleSheet} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {useSession, useSessionActions} from '@/auth/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountScreen() {
  const session = useSession()
  const {signOut} = useSessionActions()
  const {spacing} = useThemeTokens()
  const profile = session.status === 'signedIn' ? session.profile : null
  const account = session.status === 'signedIn' ? session.account : null

  return (
    <AppScreen scroll>
      <View style={[styles.wrap, {gap: spacing[4], padding: spacing[4]}]}>
        <AppText variant="display">Account</AppText>
        <Surface variant="contained" style={[styles.panel, {gap: spacing[3], padding: spacing[4]}]}>
          <Info label="Session" value={session.status} />
          <Info label="Data source" value={runtimeEnvironment.dataSource} />
          <Info label="Environment" value={runtimeEnvironment.appEnvironment} />
          {profile ? <Info label="Profile" value={`${profile.displayName} · @${profile.handle}`} /> : null}
          {account ? <Info label="Email" value={account.email} /> : null}
          <Info label="Account type" value={account ? 'Local prototype account' : 'Public browsing'} />
          {session.status === 'signedIn' ? (
            <AppButton variant="secondary" onPress={() => void signOut()}>
              Sign out
            </AppButton>
          ) : null}
        </Surface>
      </View>
    </AppScreen>
  )
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.info}>
      <AppText variant="caption" colour="textSecondary">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  info: {
    gap: 2,
  },
  panel: {},
  wrap: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
})
