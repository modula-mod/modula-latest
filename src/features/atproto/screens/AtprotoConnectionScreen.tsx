import {useState} from 'react'
import {Alert, ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import {useQueryClient} from '@tanstack/react-query'
import type {AtprotoPublicationMode} from '@modula/api-contracts'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {useSession} from '@/auth/runtime'
import {queryKeys} from '@/data/query'
import {useAppServices} from '@/runtime'
import {PublicDataWarning} from '@/features/atproto/components/PublicDataWarning'
import {PublicationStatusBanner} from '@/features/atproto/components/PublicationStatusBanner'
import {
  ATPROTO_SETTINGS_DESCRIPTION,
  ATPROTO_SETTINGS_TITLE,
} from '@/features/atproto/copy'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {
  useDisconnectAtprotoMutation,
  usePrimaryAtprotoConnection,
  useRefreshAtprotoMutation,
} from '@/features/atproto/data/useAtprotoConnectionsQuery'
import {
  useAtprotoPreferencesQuery,
  useUpdateAtprotoPreferencesMutation,
} from '@/features/atproto/data/useAtprotoPreferences'
import {startAtprotoOAuth} from '@/features/atproto/oauth/startAtprotoOAuth'
import {
  connectionHasPublishPermission,
  isHealthyAtprotoConnection,
} from '@/features/atproto/publishing/canCrossPost'
import {mapConnectionToUiPublicationStatus} from '@/features/atproto/publishing/publicationStatus'
import {ModulaDisclosureGroup} from '@/platform/ui/menus/modula-disclosure-group'
import {confirmModulaAction} from '@/platform/ui'
import {SettingsInfoBlock, SettingsSection} from '@/features/settings/components/SettingsRows'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const PREFERENCE_OPTIONS: {
  id: AtprotoPublicationMode
  label: string
  description: string
}[] = [
  {
    id: 'modulaOnly',
    label: 'Modula only',
    description: 'Never cross-post. Default after connection.',
  },
  {
    id: 'askEveryTime',
    label: 'Ask every time',
    description: 'Choose Modula or Modula + External Network in Composer.',
  },
  {
    id: 'crossPostPublic',
    label: 'Cross-post public posts',
    description: 'Public, supported posts can default to Modula + this External Network.',
  },
]

function formatDate(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function pdsLabel(pdsUrl: string) {
  try {
    return new URL(pdsUrl).host
  } catch {
    return pdsUrl
  }
}

export function AtprotoConnectionScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const session = useSession()
  const {atprotoRepository} = useAppServices()
  const queryClient = useQueryClient()
  const oauthEnabled = useAtprotoCapability('atprotoOAuth')
  const publishingEnabled = useAtprotoCapability('atprotoPublishing')
  const pdsPilot = useAtprotoCapability('pdsPilot')
  const {connection, isPending, isError, error, refetch} = usePrimaryAtprotoConnection()
  const preferencesQuery = useAtprotoPreferencesQuery()
  const updatePreferences = useUpdateAtprotoPreferencesMutation()
  const disconnectMutation = useDisconnectAtprotoMutation()
  const refreshMutation = useRefreshAtprotoMutation()

  const [handle, setHandle] = useState('')
  const [publicAck, setPublicAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const uiStatus = mapConnectionToUiPublicationStatus(connection)
  const hasPublishScope = connection ? connectionHasPublishPermission(connection) : false

  const connect = async (requestScope: 'atproto' | 'publish') => {
    if (!oauthEnabled) return
    if (session.status !== 'signedIn') {
      setStatusMessage('Sign in with your Modula Account to connect this External Network.')
      return
    }
    if (requestScope === 'publish' && !publicAck) {
      setStatusMessage('Acknowledge the public-data warning before requesting publication permissions.')
      return
    }
    setBusy(true)
    setStatusMessage(null)
    const result = await startAtprotoOAuth({
      atprotoRepository,
      handle: handle.trim() || undefined,
      requestScope,
      returnRoute: '/settings/connections/atproto',
    })
    setBusy(false)
    if (result.status === 'cancelled') {
      setStatusMessage('Connection cancelled.')
      return
    }
    if (result.status === 'failed') {
      setStatusMessage(result.message)
      return
    }
    if (result.callbackUrl) {
      router.push(
        `/oauth/atproto?url=${encodeURIComponent(result.callbackUrl)}` as Href,
      )
      return
    }
    setStatusMessage('Continue in the browser to finish connecting.')
  }

  const onDisconnect = async () => {
    if (!connection) return
    const confirmed = await confirmModulaAction({
      title: 'Disconnect AT Protocol?',
      message:
        'Modula will stop publishing to this AT account. Existing Modula posts stay on Modula.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Keep connected',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await disconnectMutation.mutateAsync(connection.id)
      setStatusMessage('Disconnected.')
    } catch {
      setStatusMessage('Could not disconnect. Try again.')
    }
  }

  const onPreferenceSelect = async (mode: AtprotoPublicationMode) => {
    if (!publishingEnabled || !hasPublishScope) return
    if (mode !== 'modulaOnly' && !publicAck) {
      Alert.alert(
        'Public data acknowledgement required',
        'Acknowledge the public-data warning before enabling AT publication preferences.',
      )
      return
    }
    try {
      await updatePreferences.mutateAsync({
        defaultMode: mode,
        enabled: mode !== 'modulaOnly',
      })
      setStatusMessage(
        mode === 'modulaOnly'
          ? 'Publishing preference set to Modula only.'
          : 'Publishing preference updated. Cross-posting stays opt-in per post when required.',
      )
    } catch {
      setStatusMessage('Could not update publishing preference.')
    }
  }

  if (!oauthEnabled) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title={ATPROTO_SETTINGS_TITLE} />
        <ResponsiveContent>
          <ScrollView contentContainerStyle={[styles.content, {gap: spacing[5]}]}>
            <SettingsInfoBlock
              title={ATPROTO_SETTINGS_TITLE}
              body="AT Protocol OAuth is not available for this API environment."
            />
          </ScrollView>
        </ResponsiveContent>
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={ATPROTO_SETTINGS_TITLE} />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <SettingsInfoBlock
            title={ATPROTO_SETTINGS_TITLE}
            body={ATPROTO_SETTINGS_DESCRIPTION}
          />

          {isPending ? <InitialLoadingState label="Loading connection" /> : null}
          {isError ? (
            <QueryErrorState title="Could not load connection" error={error} onRetry={() => void refetch()} />
          ) : null}

          {uiStatus === 'needsAttention' || uiStatus === 'connectionExpired' ? (
            <PublicationStatusBanner
              status={uiStatus}
              onRetry={() => {
                if (!connection) return
                void refreshMutation.mutateAsync(connection.id).catch(() => {
                  setStatusMessage('Refresh failed. Reconnect your AT account.')
                })
              }}
              onKeepModulaOnly={() => void onPreferenceSelect('modulaOnly')}
            />
          ) : null}

          {connection && isHealthyAtprotoConnection(connection) ? (
            <SettingsSection title="Connected account">
              <Surface
                variant="plain"
                style={[
                  styles.card,
                  {
                    borderRadius: radius.md,
                    padding: spacing[4],
                    gap: spacing[3],
                    borderColor: colours.border,
                  },
                ]}>
                <InfoRow label="Handle" value={`@${connection.handle}`} />
                <InfoRow label="Connection status" value={connection.status} />
                <InfoRow label="PDS provider" value={pdsLabel(connection.pdsUrl)} />
                <InfoRow
                  label="Granted permissions"
                  value={
                    connection.grantedScopes.length
                      ? connection.grantedScopes.join(', ')
                      : 'None listed'
                  }
                />
                <InfoRow
                  label="Last successful refresh"
                  value={formatDate(connection.refreshedAt ?? connection.connectedAt)}
                />
                <InfoRow
                  label="Publishing preference"
                  value={
                    preferencesQuery.data
                      ? PREFERENCE_OPTIONS.find(
                          option => option.id === preferencesQuery.data?.defaultMode,
                        )?.label ?? 'Modula only'
                      : hasPublishScope
                        ? 'Modula only'
                        : 'Identity only'
                  }
                />
                <ModulaDisclosureGroup label="Advanced — DID">
                  <AppText variant="caption" colour="textMuted" selectable>
                    {connection.did}
                  </AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Tokens are never stored or displayed in Modula.
                  </AppText>
                </ModulaDisclosureGroup>
              </Surface>
            </SettingsSection>
          ) : (
            <SettingsSection title="Connect">
              <View style={{gap: spacing[3]}}>
                <AppText variant="caption" colour="textSecondary">
                  Optional handle (for example, alice.bsky.social)
                </AppText>
                <TextInput
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="handle.bsky.social"
                  placeholderTextColor={colours.textTertiary}
                  accessibilityLabel="AT Protocol handle"
                  style={[
                    styles.input,
                    {
                      color: colours.text,
                      borderColor: colours.border,
                      backgroundColor: colours.surfaceRaised,
                      borderRadius: radius.md,
                      padding: spacing[3],
                    },
                  ]}
                />
                <AppPressable
                  accessibilityLabel="Connect AT Protocol identity"
                  disabled={busy}
                  onPress={() => void connect('atproto')}
                  style={[
                    styles.button,
                    {
                      backgroundColor: colours.accent,
                      borderRadius: radius.round,
                      opacity: busy ? 0.6 : 1,
                    },
                  ]}>
                  <AppText variant="label" style={{color: colours.accentForeground}}>
                    Connect identity
                  </AppText>
                </AppPressable>
              </View>
            </SettingsSection>
          )}

          <PublicDataWarning acknowledged={publicAck} onAcknowledgeChange={setPublicAck} />

          {connection && publishingEnabled ? (
            <SettingsSection title="Publication permissions">
              <View style={{gap: spacing[3]}}>
                {!hasPublishScope ? (
                  <AppPressable
                    accessibilityLabel="Request AT publication permission"
                    disabled={busy || !publicAck}
                    onPress={() => void connect('publish')}
                    style={[
                      styles.button,
                      {
                        backgroundColor: publicAck ? colours.accent : colours.surfaceMuted,
                        borderRadius: radius.round,
                      },
                    ]}>
                    <AppText
                      variant="label"
                      style={{
                        color: publicAck ? colours.accentForeground : colours.textTertiary,
                      }}>
                      Enable public publishing
                    </AppText>
                  </AppPressable>
                ) : (
                  PREFERENCE_OPTIONS.map(option => {
                    const selected =
                      (preferencesQuery.data?.defaultMode ?? 'modulaOnly') === option.id
                    return (
                      <AppPressable
                        key={option.id}
                        accessibilityLabel={option.label}
                        onPress={() => void onPreferenceSelect(option.id)}
                        style={[
                          styles.prefRow,
                          {
                            borderColor: selected ? colours.accent : colours.border,
                            borderRadius: radius.md,
                            padding: spacing[3],
                            gap: spacing[1],
                          },
                        ]}>
                        <AppText variant="headline">{option.label}</AppText>
                        <AppText variant="caption" colour="textSecondary">
                          {option.description}
                        </AppText>
                      </AppPressable>
                    )
                  })
                )}
              </View>
            </SettingsSection>
          ) : null}

          {connection ? (
            <SettingsSection title="Actions">
              <View style={{gap: spacing[3]}}>
                <AppPressable
                  accessibilityLabel="Refresh AT Protocol connection"
                  onPress={() => {
                    void refreshMutation.mutateAsync(connection.id).then(async () => {
                      await queryClient.invalidateQueries({queryKey: queryKeys.atproto.all})
                      setStatusMessage('Connection refreshed.')
                    })
                  }}>
                  <AppText variant="label" style={{color: colours.accent}}>
                    Refresh connection
                  </AppText>
                </AppPressable>
                <AppPressable accessibilityLabel="Disconnect AT Protocol" onPress={() => void onDisconnect()}>
                  <AppText variant="label" style={{color: colours.destructive}}>
                    Disconnect
                  </AppText>
                </AppPressable>
              </View>
            </SettingsSection>
          ) : null}

          {!pdsPilot ? (
            <AppText variant="caption" colour="textMuted">
              Modula PDS pilot is not available in this environment.
            </AppText>
          ) : null}

          {statusMessage ? (
            <AppText variant="caption" colour="textSecondary">
              {statusMessage}
            </AppText>
          ) : null}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={{gap: 2}}>
      <AppText variant="caption" colour="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {padding: 16, paddingBottom: 48},
  card: {borderWidth: StyleSheet.hairlineWidth},
  input: {borderWidth: StyleSheet.hairlineWidth},
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  prefRow: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
