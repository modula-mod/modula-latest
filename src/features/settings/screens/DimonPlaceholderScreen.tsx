import {View, StyleSheet, ScrollView} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
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
              styles.list,
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

          <AppText variant="caption" colour="textSecondary">
            There are no balances, wallets, mining, staking, or transactions in this build. See
            ADR-009 for the integration boundary.
          </AppText>

          <AppButton onPress={() => router.push('/product/dimon' as Href)}>
            Open DIMON capability card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product' as Href)}>
            All Modula capabilities
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 640, width: '100%', alignSelf: 'center'},
  screen: {flex: 1},
  list: {borderWidth: StyleSheet.hairlineWidth},
})
