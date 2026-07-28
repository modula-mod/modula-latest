import {useState} from 'react'
import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const PATHS: {
  id: string
  label: string
  detail: string
  icon: AppIconName
  href: Href
}[] = [
  {
    id: 'profile',
    label: 'Configurable creator profiles',
    detail: 'Tabs, storefront, About — Profile-OS',
    icon: 'profile',
    href: '/profile/os',
  },
  {
    id: 'publish',
    label: 'Publish content & communities',
    detail: 'Posts, newsletters, community spaces',
    icon: 'community',
    href: '/communities',
  },
  {
    id: 'sell',
    label: 'Sell modules, themes, layouts',
    detail: 'Marketplace listings — preview',
    icon: 'marketplace',
    href: '/marketplace',
  },
  {
    id: 'subs',
    label: 'Subscriptions & member tabs',
    detail: 'Paid access surfaces — planned',
    icon: 'poll',
    href: '/creator',
  },
  {
    id: 'crm',
    label: 'CRM + automations for leads',
    detail: 'Enquiry → lead → follow-up',
    icon: 'automation',
    href: '/product/automations',
  },
  {
    id: 'dimon',
    label: 'Rewards via DIMON (later)',
    detail: 'DIMON is not active yet',
    icon: 'security',
    href: '/settings/dimon',
  },
]

export function CreatorEconomyScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [activeId, setActiveId] = useState(PATHS[0].id)
  const active = PATHS.find(item => item.id === activeId) ?? PATHS[0]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Creator Economy" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Create. Publish. Earn. Own.</AppText>
            <AppText variant="body" colour="textSecondary">
              Creators use Profile-OS + Marketplace. Monetization previews stay honest — no fake
              payouts.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.preview,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="textTertiary">
              SELECTED PATH
            </AppText>
            <AppText variant="title">{active.label}</AppText>
            <AppText variant="body" colour="textSecondary">
              {active.detail}
            </AppText>
            <AppButton onPress={() => router.push(active.href)}>Open surface</AppButton>
          </Surface>

          {PATHS.map(item => {
            const on = item.id === activeId
            return (
              <Pressable key={item.id} onPress={() => setActiveId(item.id)}>
                <Surface
                  variant="contained"
                  style={[
                    styles.row,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: on ? colours.accentSubtle : colours.surface,
                      borderColor: on ? colours.accent : colours.border,
                    },
                  ]}>
                  <AppIcon name={item.icon} colour={colours.accent} size={18} />
                  <View style={{flex: 1, gap: 2}}>
                    <AppText variant="body">{item.label}</AppText>
                    <AppText variant="caption" colour="textTertiary">
                      {item.detail}
                    </AppText>
                  </View>
                  <AppIcon name="chevronRight" colour={colours.textTertiary} size={16} />
                </Surface>
              </Pressable>
            )
          })}

          <AppButton onPress={() => router.push('/creator' as Href)}>Creator studio</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/marketplace' as Href)}>
            Marketplace
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  preview: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
