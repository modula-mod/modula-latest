import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CONTROLS = [
  {label: 'Export your data', route: '/settings/account/export', icon: 'storage' as const},
  {label: 'Manage sessions', route: '/settings/account/sessions', icon: 'security' as const},
  {label: 'Review permissions', route: '/settings/extensions', icon: 'modules' as const},
  {label: 'Privacy controls', route: '/settings/privacy', icon: 'privacy' as const},
  {label: 'Glass Privacy levels', route: '/product/glass-privacy', icon: 'privacy' as const},
  {label: 'Feature Control', route: '/product/feature-control', icon: 'settings' as const},
]

export function OwnershipPortabilityScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Ownership" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Your environment is yours.</AppText>
            <AppText variant="body" colour="textSecondary">
              Export, backup, revoke permissions, preserve purchases. The platform should not trap
              your digital life.
            </AppText>
          </View>

          {CONTROLS.map(item => (
            <Surface
              key={item.route}
              variant="contained"
              style={[
                styles.row,
                {
                  padding: spacing[4],
                  gap: spacing[3],
                  borderRadius: radius.medium,
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                },
              ]}>
              <AppIcon name={item.icon} colour={colours.accent} />
              <View style={{flex: 1}}>
                <AppText variant="headline">{item.label}</AppText>
              </View>
              <AppButton variant="ghost" onPress={() => router.push(item.route as Href)}>
                Open
              </AppButton>
            </Surface>
          ))}
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
