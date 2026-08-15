import {useCallback, useEffect, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import type {GreenfieldSession} from '@modula/greenfield-contracts'

import {AppText} from '@/components/primitives/AppText'
import {
  SettingsCaption,
  SettingsContextRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountSessionsScreen() {
  const services = useAppServices()
  const {colours, spacing, radius} = useThemeTokens()
  const [sessions, setSessions] = useState<GreenfieldSession[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSessions(await services.authRepository.listSessions())
      setError(null)
    } catch {
      setError('Could not load sessions.')
    }
  }, [services.authRepository])

  useEffect(() => {
    const id = setTimeout(() => void load(), 0)
    return () => clearTimeout(id)
  }, [load])

  const revokeOne = async (sessionId: string) => {
    const ok = await confirmModulaAction({
      title: 'Revoke session?',
      message: 'That device will be signed out. Your account stays active here.',
      confirmLabel: 'Revoke',
    })
    if (!ok) return
    await services.authRepository.revokeSession(sessionId)
    await load()
  }

  const revokeOthers = async () => {
    const ok = await confirmModulaAction({
      title: 'Revoke other sessions?',
      message: 'Signs out every other device without ending this session.',
      confirmLabel: 'Revoke others',
    })
    if (!ok) return
    await services.authRepository.revokeOtherSessions()
    await load()
  }

  return (
    <SettingsScreen
      title="Active Sessions"
      caption="Greenfield sessions. Revoking others signs those devices out without changing your account."
      right={
        <SettingsOverflowMenu
          title="Sessions"
          actions={[
            {id: 'refresh', label: 'Refresh'},
            {id: 'revoke-others', label: 'Revoke other sessions', style: 'destructive'},
          ]}
          onAction={id => {
            if (id === 'refresh') void load()
            if (id === 'revoke-others') void revokeOthers()
          }}
        />
      }>
      <SettingsSection title="Devices">
        {sessions.length === 0 ? (
          <View style={[styles.empty, {padding: spacing[4]}]}>
            <AppText variant="caption" colour="textSecondary">
              No additional sessions listed.
            </AppText>
          </View>
        ) : (
          sessions.map((item, index) => (
            <SettingsContextRow
              key={item.sessionId}
              title={item.platform ?? 'Device'}
              actions={[
                {id: 'revoke', label: 'Revoke session', style: 'destructive'},
              ]}
              onAction={id => {
                if (id === 'revoke') void revokeOne(item.sessionId)
              }}>
              <View
                testID="account-session-row"
                style={[
                  styles.sessionRow,
                  {
                    borderBottomColor:
                      index === sessions.length - 1 ? 'transparent' : colours.separator,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    gap: spacing[1],
                  },
                ]}>
                <AppText variant="label">{item.platform ?? 'Device'}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Last seen {new Date(item.lastSeenAt).toLocaleString()} · {item.status}
                </AppText>
                <AppText variant="micro" colour="textTertiary">
                  Long-press for actions
                </AppText>
              </View>
            </SettingsContextRow>
          ))
        )}
      </SettingsSection>

      <View
        style={[
          styles.hint,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.large,
            padding: spacing[4],
          },
        ]}>
        <SettingsCaption>
          Use the ⋯ menu to revoke every other session at once, or long-press a device row.
        </SettingsCaption>
      </View>

      {error ? (
        <AppText variant="caption" colour="destructive">
          {error}
        </AppText>
      ) : null}
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 52,
    justifyContent: 'center',
  },
  hint: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  sessionRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
    width: '100%',
  },
})
