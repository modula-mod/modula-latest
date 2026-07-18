import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const PATHS = [
  'Configurable creator profiles',
  'Publish content & communities',
  'Sell modules, themes, layouts',
  'Subscriptions & member tabs',
  'Newsletters & services',
  'CRM + automations for leads',
  'Rewards via DIMON (later)',
]

export function CreatorEconomyScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Creator Economy" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Create. Publish. Earn. Own.</AppText>
            <AppText variant="body" colour="textSecondary">
              Creators use Profile-OS + Marketplace. Monetization previews stay honest — no fake
              payouts.
            </AppText>
          </View>

          {PATHS.map(item => (
            <Surface
              key={item}
              variant="contained"
              style={[
                styles.row,
                {
                  padding: spacing[4],
                  gap: spacing[2],
                  borderRadius: radius.medium,
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                },
              ]}>
              <AppIcon name="poll" colour={colours.accent} size={18} />
              <AppText variant="body">{item}</AppText>
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/creator' as Href)}>Creator studio</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/marketplace' as Href)}>
            Marketplace
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/settings/dimon' as Href)}>
            DIMON status
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
