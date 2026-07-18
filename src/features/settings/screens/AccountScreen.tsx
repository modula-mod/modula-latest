import {View, StyleSheet} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {useSession, useSessionActions} from '@/auth/runtime'
import {
  SettingsInfoBlock,
  SettingsLinkRow,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountScreen() {
  const session = useSession()
  const {signOut} = useSessionActions()
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const signedIn = session.status === 'signedIn'
  const account = signedIn ? session.account : null
  const greenfield = signedIn ? session.greenfieldAccount : null

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Account" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[5], padding: spacing[4]}]}>
          <SettingsInfoBlock
            title="Modula Account"
            body="Your account is owned by Greenfield. Changing your handle does not change your account ID, ownership, followers, repository, modules, or future DIMON linkage."
          />

          {signedIn && account && greenfield ? (
            <>
              <SettingsSection title="Identity">
                <SettingsLinkRow
                  row={{
                    title: 'Handle',
                    description: `@${greenfield.primaryHandle}`,
                    icon: 'account',
                    route: '/settings/account/handle',
                  }}
                />
                <SettingsLinkRow
                  row={{
                    title: 'Email',
                    description: account.email,
                    icon: 'info',
                    route: '/settings/account/email',
                  }}
                />
                <SettingsLinkRow
                  last
                  row={{
                    title: 'Password',
                    description: 'Change your Modula Account password.',
                    icon: 'security',
                    route: '/settings/account/password',
                  }}
                />
              </SettingsSection>

              <SettingsSection title="Security">
                <SettingsLinkRow
                  last
                  row={{
                    title: 'Active Sessions',
                    description: 'Review and revoke Greenfield sessions.',
                    icon: 'switch',
                    route: '/settings/account/sessions',
                  }}
                />
              </SettingsSection>

              <SettingsSection title="Your Data">
                <SettingsLinkRow
                  last
                  row={{
                    title: 'Export Greenfield Repository',
                    description: 'Integrity-aware export of your repository.',
                    icon: 'storage',
                    route: '/settings/account/export',
                  }}
                />
              </SettingsSection>

              <SettingsSection title="Danger zone">
                <View style={{padding: spacing[4], gap: spacing[2]}}>
                  <AppText variant="headline">Deactivate</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Deactivation is not available in this build. Contact support when the product
                    ships account lifecycle controls.
                  </AppText>
                  <AppText variant="headline">Delete</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Account deletion is not available in this build. Exports remain the portable path.
                  </AppText>
                </View>
              </SettingsSection>

              <AppButton variant="secondary" onPress={() => void signOut()}>
                Sign out
              </AppButton>
            </>
          ) : (
            <>
              <AppText variant="body">Sign in to manage your Modula Account.</AppText>
              <AppButton onPress={() => router.push('/sign-in' as Href)}>Sign in</AppButton>
            </>
          )}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  screen: {flex: 1},
})
