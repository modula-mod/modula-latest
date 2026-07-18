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

const RELATED_LINKS: Array<{label: string; href: Href; variant?: 'secondary' | 'ghost'}> = [
  {label: 'Automations Studio', href: '/product/automations'},
  {label: 'Kaizen Queue', href: '/product/kaizen', variant: 'secondary'},
  {label: 'Circuit Memory', href: '/product/circuit-memory', variant: 'secondary'},
  {label: 'Commands', href: '/product/commands', variant: 'ghost'},
  {label: 'Intelligence', href: '/product/intelligence', variant: 'ghost'},
  {label: 'Design Lab', href: '/product/design-lab', variant: 'ghost'},
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
              Ledger rows here are seeded Preview data. Replay reconstructs the visible timeline,
              decisions, permissions, and policy checks; it never re-runs destructive actions, sends
              messages, installs modules, calls models, contacts services, or mutates stored data.
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
                  <View style={[styles.titleCopy, {gap: spacing[1]}]}>
                    <AppText variant="headline" style={styles.wrapText}>
                      {row.command}
                    </AppText>
                    <AppText variant="caption" colour="textSecondary" style={styles.wrapText}>
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
                      Replay permissions shown for context only /{' '}
                      {row.permissions.length ? row.permissions.join(', ') : 'none'}
                    </AppText>
                    {row.replayNotes.map(note => (
                      <View key={note} style={[styles.noteRow, {gap: spacing[2]}]}>
                        <AppIcon name="check" colour={colours.accent} size={16} />
                        <AppText variant="caption" colour="textSecondary" style={styles.flexText}>
                          {note}
                        </AppText>
                      </View>
                    ))}
                    <AppButton
                      variant="secondary"
                      onPress={() =>
                        setReplayText(
                          `Diagnostic replay for ${row.command}: reconstructed the Preview timeline, policy checks, and permission labels only. No command was executed, no network request was made, and no source data was changed.`,
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

          <Surface
            variant="contained"
            style={[
              styles.replayCard,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.large,
                padding: spacing[4],
                gap: spacing[3],
              },
            ]}>
            <AppText variant="headline">Related workbenches</AppText>
            <AppText variant="body" colour="textSecondary">
              Compare replay explanations with the dry-run builder, improvement capture, memory
              scopes, command routing, intelligence policy, and design-system previews.
            </AppText>
            <View style={[styles.linkGrid, {gap: spacing[2]}]}>
              {RELATED_LINKS.map(link => (
                <AppButton
                  key={link.label}
                  variant={link.variant ?? 'primary'}
                  onPress={() => router.push(link.href)}
                  style={styles.linkButton}>
                  {link.label}
                </AppButton>
              ))}
            </View>
          </Surface>
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
  flexText: {flex: 1, flexShrink: 1, minWidth: 0},
  titleCopy: {flex: 1, flexShrink: 1, minWidth: 0},
  wrapText: {flexShrink: 1, minWidth: 0},
  linkGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  linkButton: {flexBasis: 210, flexGrow: 1, minWidth: 0},
})
