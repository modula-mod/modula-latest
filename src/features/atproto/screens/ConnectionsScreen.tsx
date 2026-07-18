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
  const {connection} = usePrimaryAtprotoConnection()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Connections" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <SettingsInfoBlock
            title="Connections"
            body="Optional External Networks. Your Modula Account and Greenfield data stay authoritative; bridges never own your identity."
          />

          <SettingsSection title="External Networks">
            {oauthEnabled ? (
              <SettingsLinkRow
                row={{
                  title: ATPROTO_SETTINGS_TITLE,
                  description: ATPROTO_SETTINGS_DESCRIPTION,
                  icon: 'integrations',
                  route: '/settings/connections/atproto',
                  value: connection ? `@${connection.handle}` : 'Optional',
                }}
              />
            ) : (
              <SettingsLinkRow
                row={{
                  title: ATPROTO_SETTINGS_TITLE,
                  description: 'Optional External Network — unavailable in this environment.',
                  icon: 'integrations',
                  value: 'Unavailable',
                }}
              />
            )}
            <SettingsLinkRow
              row={{
                title: 'GitHub',
                description: 'Future connector — not available yet.',
                icon: 'developer',
                value: 'Future',
                preview: true,
              }}
            />
            <SettingsLinkRow
              row={{
                title: 'Drive',
                description: 'Future connector — not available yet.',
                icon: 'storage',
                value: 'Future',
                preview: true,
              }}
            />
            <SettingsLinkRow
              last
              row={{
                title: 'Nextcloud',
                description: 'Future connector — not available yet.',
                icon: 'integrations',
                value: 'Future',
                preview: true,
              }}
            />
          </SettingsSection>

          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="textSecondary">
              Plugin states: Enabled, Disabled, Needs configuration, Unavailable, Update available.
              AT Protocol is one optional row — not the Modula identity system.
            </AppText>
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {padding: 16, paddingBottom: 40},
})
