import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type LedgerRow = {
  id: string
  command: string
  initiator: string
  status: string
  risk: string
  detail: string
  permissions: string[]
  replayNotes: string[]
}

const LEDGER_ROWS: LedgerRow[] = [
  {
    id: 'ledger-focus-start',
    command: 'focus.start',
    initiator: 'user',
    status: 'completed',
    risk: 'low',
    detail: 'Deep Focus preset selected locally; profile Halo preference updated.',
    permissions: [],
    replayNotes: [
      'Reconstruct FocusPolicyEngine decisions',
      'Show which surfaces would suppress interruptions',
      'Do not change the active Focus preset during replay',
    ],
  },
  {
    id: 'ledger-gaia-plan',
    command: 'gaia.plan',
    initiator: 'user preview',
    status: 'read-only',
    risk: 'low',
    detail: 'GAIA Preview described a Board briefing using allowed scopes only.',
    permissions: ['composer', 'tasks'],
    replayNotes: [
      'Render the deterministic planning labels',
      'Show requested scopes',
      'Do not call a model or read private modules',
    ],
  },
  {
    id: 'ledger-message-held',
    command: 'messaging.send',
    initiator: 'quiet send preview',
    status: 'held',
    risk: 'high',
    detail: 'Message draft held while Deep Focus was active; no network send occurred.',
    permissions: ['network:declared'],
    replayNotes: [
      'Explain why the send required explicit confirmation',
      'Show the held-message reason',
      'Do not send, recall, or mutate a message during replay',
    ],
  },
]

export function LedgerReplayScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [expandedId, setExpandedId] = useState(LEDGER_ROWS[0]?.id ?? '')
  const [replayText, setReplayText] = useState('')

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Ledger Replay" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              BLACK-BOX RECORDER / DIAGNOSTIC REPLAY
            </AppText>
            <AppText variant="display">Replay the path, not the side effect.</AppText>
            <AppText variant="body" colour="textSecondary">
              Ledger rows are seeded Preview data. Replay explains decisions and policy checks; it
              does not re-run destructive actions, send messages, install modules, or mutate data.
            </AppText>
          </View>

          {LEDGER_ROWS.map(row => {
            const expanded = expandedId === row.id
            return (
              <Surface
                key={row.id}
                variant="contained"
                style={[
                  styles.card,
                  {
                    backgroundColor: colours.surface,
                    borderColor: expanded ? colours.accent : colours.border,
                    borderRadius: radius.large,
                    padding: spacing[4],
                    gap: spacing[3],
                  },
                ]}>
                <AppPressable
                  accessibilityLabel={`Expand ${row.command}`}
                  accessibilityState={{expanded}}
                  onPress={() => {
                    setExpandedId(expanded ? '' : row.id)
                    setReplayText('')
                  }}
                  style={[styles.titleRow, {gap: spacing[3]}]}>
                  <AppIcon name="storage" colour={colours.accent} />
                  <View style={{flex: 1, gap: spacing[1]}}>
                    <AppText variant="headline">{row.command}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {row.status} / risk {row.risk} / initiator {row.initiator}
                    </AppText>
                  </View>
                  <AppIcon
                    name={expanded ? 'arrowUp' : 'arrowDown'}
                    colour={colours.textTertiary}
                    size={18}
                  />
                </AppPressable>

                {expanded ? (
                  <View style={{gap: spacing[2]}}>
                    <AppText variant="body" colour="textSecondary">
                      {row.detail}
                    </AppText>
                    <AppText variant="caption" colour="textTertiary">
                      Permissions / {row.permissions.length ? row.permissions.join(', ') : 'none'}
                    </AppText>
                    {row.replayNotes.map(note => (
                      <View key={note} style={[styles.noteRow, {gap: spacing[2]}]}>
                        <AppIcon name="check" colour={colours.accent} size={16} />
                        <AppText variant="caption" colour="textSecondary" style={{flex: 1}}>
                          {note}
                        </AppText>
                      </View>
                    ))}
                    <AppButton
                      variant="secondary"
                      onPress={() =>
                        setReplayText(
                          `Diagnostic replay for ${row.command}: reconstructs policy checks and timeline only. It does not re-run destructive actions or remote side effects.`,
                        )
                      }>
                      Replay diagnostic
                    </AppButton>
                  </View>
                ) : null}
              </Surface>
            )
          })}

          {replayText ? (
            <Surface
              variant="contained"
              style={[
                styles.replayCard,
                {
                  backgroundColor: colours.accentSubtle,
                  borderColor: colours.accent,
                  borderRadius: radius.medium,
                  padding: spacing[4],
                  gap: spacing[2],
                },
              ]}>
              <AppText variant="label">Replay result</AppText>
              <AppText variant="body" colour="textSecondary">
                {replayText}
              </AppText>
            </Surface>
          ) : null}

          <AppButton onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/commands' as Href)}>
            Command Layer
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  noteRow: {alignItems: 'center', flexDirection: 'row'},
  replayCard: {borderWidth: StyleSheet.hairlineWidth},
})
