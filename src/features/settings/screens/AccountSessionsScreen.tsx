import {useCallback, useEffect, useState} from 'react'
import {View, StyleSheet} from 'react-native'
import type {GreenfieldSession} from '@modula/greenfield-contracts'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountSessionsScreen() {
  const services = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const [sessions, setSessions] = useState<GreenfieldSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    try {
      setSessions(await services.authRepository.listSessions())
      setError(null)
    } catch {
      setError('Could not load sessions.')
    }
  }, [services.authRepository])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Active Sessions" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <AppText variant="caption" colour="textSecondary">
            Greenfield sessions. Revoking others signs those devices out without changing your account.
          </AppText>
          {sessions.map(item => (
            <View
              key={item.sessionId}
              style={[
                styles.card,
                {
                  borderColor: colours.separator,
                  gap: spacing[2],
                  padding: spacing[3],
                },
              ]}>
              <AppText variant="headline">{item.platform ?? 'Device'}</AppText>
              <AppText variant="caption" colour="textSecondary">
                Last seen {new Date(item.lastSeenAt).toLocaleString()} · {item.status}
              </AppText>
              <AppButton
                variant="secondary"
                onPress={() => {
                  void services.authRepository.revokeSession(item.sessionId).then(load)
                }}>
                Revoke session
              </AppButton>
            </View>
          ))}
          {!sessions.length ? (
            <AppText variant="caption" colour="textSecondary">
              No additional sessions listed.
            </AppText>
          ) : null}
          <AppButton
            disabled={pending}
            variant="secondary"
            onPress={() => {
              setPending(true)
              void services.authRepository
                .revokeOtherSessions()
                .then(load)
                .finally(() => setPending(false))
            }}>
            Revoke all sessions
          </AppButton>
          {error ? (
            <AppText variant="caption" colour="destructive">
              {error}
            </AppText>
          ) : null}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {borderWidth: StyleSheet.hairlineWidth, borderRadius: 12},
  content: {maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 40},
  screen: {flex: 1},
})
