import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {useSession, useSessionActions} from '@/auth/runtime'
import {
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'

export function AccountScreen() {
  const session = useSession()
  const {signOut} = useSessionActions()
  const router = useRouter()
  const signedIn = session.status === 'signedIn'
  const account = signedIn ? session.account : null
  const greenfield = signedIn ? session.greenfieldAccount : null

  return (
    <SettingsScreen
      title="Account"
      caption="Your account is owned by Greenfield. Changing your handle does not change your account ID, ownership, followers, repository, modules, or future DIMON linkage."
      right={
        signedIn ? (
          <SettingsOverflowMenu
            title="Account"
            actions={[
              {id: 'sessions', label: 'Active Sessions'},
              {id: 'export', label: 'Export data'},
              {id: 'sign-out', label: 'Sign out', style: 'destructive'},
            ]}
            onAction={id => {
              if (id === 'sessions') router.push('/settings/account/sessions' as Href)
              if (id === 'export') router.push('/settings/account/export' as Href)
              if (id === 'sign-out') {
                void confirmModulaAction({
                  title: 'Sign out?',
                  message: 'You can sign back in with this Modula Account anytime.',
                  confirmLabel: 'Sign out',
                }).then(ok => {
                  if (ok) void signOut()
                })
              }
            }}
          />
        ) : undefined
      }>
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
              row={{
                title: 'Password',
                description: 'Change your Modula Account password.',
                icon: 'security',
                route: '/settings/account/password',
              }}
            />
            <SettingsLinkRow
              last
              row={{
                title: 'Modula Mail',
                description: 'Mailbox identity and provisioner state.',
                icon: 'info',
                route: '/settings/account/mail',
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
            <SettingsLinkRow
              row={{
                title: 'Deactivate',
                description: 'Not available in this build.',
                icon: 'warning',
                preview: true,
                onPress: () => undefined,
              }}
            />
            <SettingsLinkRow
              last
              row={{
                title: 'Delete account',
                description: 'Not available — exports remain the portable path.',
                icon: 'warning',
                preview: true,
                onPress: () => undefined,
              }}
            />
          </SettingsSection>

          <AppButton
            variant="secondary"
            onPress={() => {
              void confirmModulaAction({
                title: 'Sign out?',
                message: 'You can sign back in with this Modula Account anytime.',
                confirmLabel: 'Sign out',
              }).then(ok => {
                if (ok) void signOut()
              })
            }}>
            Sign out
          </AppButton>
        </>
      ) : (
        <>
          <AppText variant="body" colour="textSecondary">
            Sign in to manage your Modula Account.
          </AppText>
          <AppButton onPress={() => router.push('/sign-in' as Href)}>Sign in</AppButton>
        </>
      )}
    </SettingsScreen>
  )
}
