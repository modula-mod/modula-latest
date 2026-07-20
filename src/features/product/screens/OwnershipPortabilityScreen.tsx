import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const CONTROLS: Array<{
  label: string
  detail: string
  route: Href
  icon: AppIconName
}> = [
  {
    label: 'Export your data',
    detail: 'Download a portable archive of your Modula environment.',
    route: '/settings/account/export',
    icon: 'storage',
  },
  {
    label: 'Manage sessions',
    detail: 'Revoke devices and review active sign-ins.',
    route: '/settings/account/sessions',
    icon: 'security',
  },
  {
    label: 'Review permissions',
    detail: 'Extension Centre — what modules may access.',
    route: '/settings/extensions',
    icon: 'modules',
  },
  {
    label: 'Privacy controls',
    detail: 'Mute, block, Inner Circle, reporting.',
    route: '/settings/privacy',
    icon: 'privacy',
  },
  {
    label: 'Glass Privacy levels',
    detail: 'Disable Sharing · Protected Chat · Vault Chat.',
    route: '/product/glass-privacy',
    icon: 'privacy',
  },
  {
    label: 'Feature Control',
    detail: 'Enable, hide, or lock experimental surfaces.',
    route: '/product/feature-control',
    icon: 'settings',
  },
  {
    label: 'DIMON status',
    detail: 'Ownership ledger inactive — no balances.',
    route: '/settings/dimon',
    icon: 'security',
  },
]

const PRINCIPLES = [
  'Export without trapping your digital life',
  'Revoke module permissions cleanly',
  'Preserve purchases when DIMON activates later',
  'No fake wallet or ledger in this build',
]

export function OwnershipPortabilityScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Ownership" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Your environment is yours.</AppText>
            <AppText variant="body" colour="textSecondary">
              Export, backup, revoke permissions, preserve purchases. The platform should not trap
              your digital life.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              PRINCIPLES
            </AppText>
            {PRINCIPLES.map(item => (
              <AppText key={item} variant="body" colour="textSecondary">
                · {item}
              </AppText>
            ))}
          </Surface>

          {CONTROLS.map(item => (
            <Surface
              key={item.route.toString()}
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
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="headline">{item.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {item.detail}
                </AppText>
              </View>
              <AppButton variant="ghost" onPress={() => router.push(item.route)}>
                Open
              </AppButton>
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/product/module-standards' as Href)}>
            Module uninstall standards
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
