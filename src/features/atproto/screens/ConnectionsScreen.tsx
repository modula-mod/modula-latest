import {ScrollView, StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {
  SettingsInfoBlock,
  SettingsLinkRow,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {usePrimaryAtprotoConnection} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {
  ATPROTO_SETTINGS_DESCRIPTION,
  ATPROTO_SETTINGS_TITLE,
} from '@/features/atproto/copy'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ConnectionsScreen() {
  const {colours, spacing} = useThemeTokens()
  const oauthEnabled = useAtprotoCapability('atprotoOAuth')
  const pdsPilot = useAtprotoCapability('pdsPilot')
  const {connection} = usePrimaryAtprotoConnection()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Connected Accounts" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <SettingsInfoBlock
            title="Connected Accounts"
            body="Link portable public social identities. Modula remains the home for private data, modules, and messages."
          />

          <SettingsSection title="Social identity">
            {oauthEnabled ? (
              <SettingsLinkRow
                row={{
                  title: ATPROTO_SETTINGS_TITLE,
                  description: ATPROTO_SETTINGS_DESCRIPTION,
                  icon: 'integrations',
                  route: '/settings/connections/atproto',
                  value: connection ? `@${connection.handle}` : undefined,
                }}
                last={!pdsPilot}
              />
            ) : (
              <View style={{padding: spacing[4]}}>
                <AppText variant="headline">{ATPROTO_SETTINGS_TITLE}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  AT Protocol connections are unavailable in this environment.
                </AppText>
              </View>
            )}
            {pdsPilot ? (
              <SettingsLinkRow
                last
                row={{
                  title: 'Modula PDS pilot',
                  description: 'Invite-only personal data server pilot.',
                  icon: 'security',
                  preview: true,
                }}
              />
            ) : null}
          </SettingsSection>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {padding: 16, paddingBottom: 40},
})
