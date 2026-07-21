import {
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {usePrimaryAtprotoConnection} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {
  ATPROTO_SETTINGS_DESCRIPTION,
  ATPROTO_SETTINGS_TITLE,
} from '@/features/atproto/copy'
import {useRouter, type Href} from 'expo-router'

export function ConnectionsScreen() {
  const router = useRouter()
  const oauthEnabled = useAtprotoCapability('atprotoOAuth')
  const {connection} = usePrimaryAtprotoConnection()

  return (
    <SettingsScreen
      title="Connections"
      caption="Optional External Networks. Your Modula Account and Greenfield data stay authoritative; bridges never own your identity."
      right={
        oauthEnabled ? (
          <SettingsOverflowMenu
            title="Connections"
            actions={[{id: 'atproto', label: `Manage ${ATPROTO_SETTINGS_TITLE}`}]}
            onAction={id => {
              if (id === 'atproto') router.push('/settings/connections/atproto' as Href)
            }}
          />
        ) : undefined
      }>
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
    </SettingsScreen>
  )
}
