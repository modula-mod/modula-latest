import {Tabs} from 'expo-router'
import {StyleSheet, View, useWindowDimensions} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {MODULA_TABS} from '@/platform/ui/navigation/modula-tabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const webIcons: Record<string, AppIconName> = {
  index: 'home',
  discover: 'discover',
  board: 'board',
  activity: 'activity',
  profile: 'profile',
}

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
          }}
        />
      ))}
      <Tabs.Screen name="create" options={{href: null}} />
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
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const rail = width >= 900

  const visibleRoutes = state.routes.filter(route =>
    MODULA_TABS.some(tab => tab.routeName === route.name),
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
            style={[styles.item, rail && styles.railItem]}>
            <AppIcon
              name={webIcons[route.name] ?? 'home'}
              colour={focused ? colours.accent : colours.textSecondary}
              size={22}
            />
            <AppText
              variant="caption"
              style={{color: focused ? colours.accent : colours.textSecondary}}>
              {label}
            </AppText>
          </AppPressable>
        )
      })}
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
  rail: {
    borderRightWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 12,
    width: 96,
  },
  railItem: {
    flex: 0,
    minHeight: 56,
    width: '100%',
  },
})
