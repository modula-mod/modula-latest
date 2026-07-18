import {View, StyleSheet, ScrollView} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {SettingsInfoBlock} from '@/features/settings/components/SettingsRows'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const USES = [
  'Modula Wallet',
  'Payments between users',
  'Module, theme, and marketplace purchases',
  'Creator and developer rewards',
  'Subscription and revenue sharing',
  'Verified ownership of digital items',
  'Identity verification and reputation',
  'Secure transfers between Modula services',
]

const CAPABILITIES = [
  {id: 'dimon:account:read', label: 'Account read', state: 'Reserved'},
  {id: 'dimon:account:link', label: 'Account link', state: 'Reserved'},
  {id: 'dimon:transaction:request', label: 'Transaction request', state: 'Reserved'},
  {id: 'dimon:transaction:approve', label: 'Transaction approve', state: 'Reserved'},
  {id: 'dimon:ledger:audit', label: 'Ledger audit', state: 'Reserved'},
]

const EVENT_TYPES = [
  'dimon.account.linked',
  'dimon.transaction.requested',
  'dimon.transaction.approved',
  'dimon.ledger.audited',
]

const FORBIDDEN = [
  'Fake balances',
  'Decorative token UI',
  'Chain RPC status or calls',
  'Mining, staking, or speculative token mechanics',
]

const PHASES = [
  {
    title: '1 · Shell + social + modules',
    body: 'Modula OS must be reliable before economics. This phase is active now.',
  },
  {
    title: '2 · Capability namespaces',
    body: 'Greenfield account IDs and dimon:* capabilities reserved in contracts.',
  },
  {
    title: '3 · Ledger activation',
    body: 'Wallet, settlement, and rewards only after integrity gates pass. Not this build.',
  },
]

export function DimonPlaceholderScreen() {
  const router = useRouter()
  const {colours, spacing, radius} = useThemeTokens()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="DIMON" />
      <ResponsiveContent>
        <ScrollView contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <SettingsInfoBlock
            title="DIMON"
            body="DIMON is not active yet. Modula is preparing Greenfield account IDs, integrity, and capability namespaces so a future economic ledger can bind safely — without fake balances, wallets, or blockchain. DIMON is designed to power value and ownership across Modula — not speculative crypto theatre."
          />

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.large,
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              STATUS
            </AppText>
            <AppText variant="title">Inactive on Greenfield</AppText>
            <AppText variant="body" colour="textSecondary">
              No balances, wallets, mining, staking, or transactions in this build. Feature Control
              keeps DIMON locked until activation.
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Ownership ledger (future)</AppText>
            <AppText variant="body" colour="textSecondary">
              DIMON may later add a transaction ledger for ownership, settlement, reward, and audit
              events. That requires a dedicated service boundary, stable Greenfield account binding,
              explicit user approval, tamper-evident records, replay protection, key-management
              rules, and a reviewed security model before any activation.
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">ADR-006 boundary</AppText>
            <AppText variant="body" colour="textSecondary">
              ADR-006 says PostgreSQL is primary DB; blockchain is NOT the app database. DIMON may
              later provide ownership and settlement proofs, but not mining, speculative tokens, or
              a replacement for Greenfield application state in this phase.
            </AppText>
          </Surface>

          <AppText variant="headline">Activation path</AppText>
          {PHASES.map(phase => (
            <Surface
              key={phase.title}
              variant="contained"
              style={[
                styles.card,
                {
                  gap: spacing[2],
                  padding: spacing[4],
                  borderRadius: radius.medium,
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                },
              ]}>
              <AppText variant="label">{phase.title}</AppText>
              <AppText variant="body" colour="textSecondary">
                {phase.body}
              </AppText>
            </Surface>
          ))}

          <AppText variant="headline">Reserved capabilities</AppText>
          <View style={{gap: spacing[2]}}>
            {CAPABILITIES.map(item => (
              <Surface
                key={item.id}
                variant="contained"
                style={[
                  styles.capRow,
                  {
                    padding: spacing[3],
                    gap: spacing[3],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon name="security" colour={colours.accent} size={18} />
                <View style={{flex: 1, gap: 2}}>
                  <AppText variant="label">{item.label}</AppText>
                  <AppText variant="caption" colour="textTertiary">
                    {item.id}
                  </AppText>
                </View>
                <AppText variant="caption" colour="textSecondary">
                  {item.state}
                </AppText>
              </Surface>
            ))}
          </View>

          <AppText variant="headline">Reserved event types</AppText>
          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="textTertiary">
              From @modula/dimon-contracts. Reserved only; Phase 6R does not emit or persist them.
            </AppText>
            {EVENT_TYPES.map(eventType => (
              <AppText key={eventType} variant="body" colour="textSecondary">
                · {eventType}
              </AppText>
            ))}
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="label">Planned uses</AppText>
            {USES.map(item => (
              <AppText key={item} variant="body" colour="textSecondary">
                · {item}
              </AppText>
            ))}
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                gap: spacing[2],
                padding: spacing[4],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="label">What is forbidden now</AppText>
            {FORBIDDEN.map(item => (
              <AppText key={item} variant="body" colour="textSecondary">
                · {item}
              </AppText>
            ))}
          </Surface>

          <AppText variant="caption" colour="textSecondary">
            There are no balances, wallets, mining, staking, or transactions in this build. See
            ADR-006 and ADR-009 for the integration boundary. Contracts live in
            @modula/dimon-contracts.
          </AppText>

          <AppButton onPress={() => router.push('/product/ledger' as Href)}>
            Ledger & Replay
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/ownership' as Href)}>
            Ownership & portability
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/developer' as Href)}>
            Developer Tools
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 640, width: '100%', alignSelf: 'center'},
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  capRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
