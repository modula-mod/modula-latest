import {Tabs, useRouter, type Href} from 'expo-router'
import {StyleSheet, View, useWindowDimensions} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {useSession} from '@/auth/runtime'
import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {resolveVisibleModulaTabs} from '@/features/product/data/resolveTabBar'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useHydrated} from '@/lib/useHydrated'
import {MODULA_TABS} from '@/platform/ui/navigation/modula-tabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const webIcons: Record<string, AppIconName> = {
  index: 'home',
  discover: 'discover',
  hub: 'modules',
  create: 'create',
  activity: 'activity',
  profile: 'profile',
}

const RAIL_SHORTCUTS: {
  label: string
  icon: AppIconName
  href: Href
  featureId?: string
}[] = [
  {label: 'Board', icon: 'board', href: '/board'},
  {label: 'Product', icon: 'modules', href: '/product'},
  {label: 'Customize', icon: 'appearance', href: '/product/customize'},
  {label: 'Forge', icon: 'developer', href: '/product/forge', featureId: 'forge'},
  {label: 'Agents', icon: 'automation', href: '/product/agents', featureId: 'agents'},
  {label: 'Focus', icon: 'contrast', href: '/product/focus', featureId: 'focus'},
]

/**
 * Web adaptive rail / bottom bar using the same ModulaTabDefinition list.
 * Does not use NativeTabs (unstable API is native-first).
 */
export function PlatformTabs() {
  const {colours} = useThemeTokens()

  return (
    <Tabs
      tabBar={props => <WebTabRail {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {backgroundColor: colours.canvas},
      }}>
      {MODULA_TABS.map(tab => (
        <Tabs.Screen
          key={tab.id}
          name={tab.routeName}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
            href: tab.id === 'create' ? null : undefined,
          }}
        />
      ))}
    </Tabs>
  )
}

type WebTabRailProps = {
  state: {index: number; routes: {key: string; name: string}[]}
  descriptors: Record<string, {options: {title?: string; tabBarAccessibilityLabel?: string}}>
  navigation: {
    emit: (options: {
      type: 'tabPress'
      target: string
      canPreventDefault: true
    }) => {defaultPrevented: boolean}
    navigate: (name: string) => void
  }
}

function WebTabRail({state, descriptors, navigation}: WebTabRailProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null
  const {width} = useWindowDimensions()
  const hydrated = useHydrated()
  const {colours, spacing, radius} = useThemeTokens()
  const {preferences} = useProductPreferences()
  const rail = hydrated && width >= 900

  const selectedRouteName =
    state.index >= 0 ? state.routes[state.index]?.name : undefined
  const visibleTabNames = new Set(
    resolveVisibleModulaTabs(preferences.tabBarIds, {
      alwaysIncludeRouteName: selectedRouteName,
    })
      .filter(tab => tab.id !== 'create')
      .map(tab => tab.routeName),
  )

  const visibleRoutes = state.routes.filter(route => visibleTabNames.has(route.name))
  const shortcuts = RAIL_SHORTCUTS.filter(
    item => !item.featureId || isFeatureEnabled(preferences, item.featureId),
  )

  return (
    <View
      style={[
        rail ? styles.rail : styles.bar,
        {
          backgroundColor: colours.surface,
          borderColor: colours.border,
          paddingBottom: rail ? spacing[4] : Math.max(insets.bottom, spacing[2]),
          paddingTop: rail ? insets.top + spacing[4] : spacing[2],
        },
      ]}>
      {visibleRoutes.map(route => {
        const index = state.routes.findIndex(item => item.key === route.key)
        const focused = state.index === index
        const {options} = descriptors[route.key]
        const label = options.title ?? route.name
        const isProfile = route.name === 'profile'

        return (
          <AppPressable
            key={route.key}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityState={{selected: focused}}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name)
              }
            }}
            style={[
              styles.item,
              rail && styles.railItem,
              focused && rail
                ? {
                    backgroundColor: colours.accentSubtle,
                    borderRadius: radius.medium,
                  }
                : null,
            ]}>
            {isProfile ? (
              <Avatar
                name={
                  profile?.displayName ??
                  (session.status === 'guest' ? 'Guest' : 'Modula')
                }
                uri={profile?.avatarUri}
                colour={profile?.coverColour}
                size={22}
                style={styles.profileAvatar}
              />
            ) : (
              <AppIcon
                name={webIcons[route.name] ?? 'home'}
                colour={focused ? colours.text : colours.textSecondary}
                size={22}
              />
            )}
            <AppText
              variant="caption"
              style={{color: focused ? colours.text : colours.textSecondary}}>
              {label}
            </AppText>
          </AppPressable>
        )
      })}

      {rail ? (
        <View style={[styles.shortcuts, {gap: spacing[1], marginTop: spacing[3]}]}>
          <AppText variant="micro" colour="textSecondary">
            MORE
          </AppText>
          {shortcuts.map(item => (
            <AppPressable
              key={item.href.toString()}
              accessibilityLabel={item.label}
              onPress={() => router.push(item.href)}
              style={[styles.item, styles.railItem]}>
              <AppIcon name={item.icon} colour={colours.textSecondary} size={18} />
              <AppText variant="caption" colour="textSecondary">
                {item.label}
              </AppText>
            </AppPressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
  },
  profileAvatar: {
    borderWidth: 0,
  },
  rail: {
    borderRightWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 12,
    width: 104,
  },
  railItem: {
    flex: 0,
    minHeight: 56,
    width: '100%',
  },
  shortcuts: {
    borderTopColor: 'transparent',
    width: '100%',
  },
})
