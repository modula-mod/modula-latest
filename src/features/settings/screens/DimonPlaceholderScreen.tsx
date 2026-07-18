import {View, StyleSheet} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {SettingsInfoBlock} from '@/features/settings/components/SettingsRows'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function DimonPlaceholderScreen() {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="DIMON" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
          <SettingsInfoBlock
            title="DIMON"
            body="DIMON is not active yet. Modula is preparing Greenfield account IDs, integrity, and capability namespaces so a future economic ledger can bind safely — without fake balances, wallets, or blockchain."
          />
          <AppText variant="caption" colour="textSecondary">
            There are no balances, wallets, mining, staking, or transactions in this build. See
            ADR-009 for the integration boundary.
          </AppText>
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 640, width: '100%', alignSelf: 'center'},
  screen: {flex: 1},
})
