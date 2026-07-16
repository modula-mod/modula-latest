import {StyleSheet, View, useWindowDimensions} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {MaterialNavigationBar} from '@/components/materials/MaterialNavigationBar'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {currentDemoProfile} from '@/demo/demoProfiles'
import {CreateTabButton} from '@/shell/CreateTabButton'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type TabRoute = {
  key: string
  name: string
}

type TabDescriptor = {
  options: {
    title?: string
    tabBarAccessibilityLabel?: string
  }
}

type TabNavigation = {
  emit: (options: {
    type: 'tabPress'
    target: string
    canPreventDefault: true
  }) => {defaultPrevented: boolean}
  navigate: (name: string) => void
}

type MainTabBarProps = {
  state: {
    index: number
    routes: TabRoute[]
  }
  descriptors: Record<string, TabDescriptor>
  navigation: TabNavigation
}

const tabIcons: Record<string, AppIconName> = {
  index: 'home',
  discover: 'discover',
  activity: 'activity',
}

export function MainTabBar({state, descriptors, navigation}: MainTabBarProps) {
  const insets = useSafeAreaInsets()
  const {width} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const showLabels = width >= 390

  return (
    <MaterialNavigationBar
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, spacing[2]),
          borderTopColor: colours.border,
        },
      ]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          if (route.name === 'create') {
            return (
              <View key={route.key} style={styles.createSlot}>
                <CreateTabButton />
              </View>
            )
          }

          const focused = state.index === index
          const {options} = descriptors[route.key]
          const label = options.title ?? route.name

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <AppPressable
              key={route.key}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityState={{selected: focused}}
              onPress={onPress}
              style={styles.tab}>
              {route.name === 'profile' ? (
                <Avatar
                  name={currentDemoProfile.displayName}
                  colour={currentDemoProfile.avatarColour}
                  size={26}
                  style={[
                    styles.profileAvatar,
                    {borderColor: focused ? colours.accent : colours.border},
                  ]}
                />
              ) : (
                <AppIcon
                  name={tabIcons[route.name] ?? 'home'}
                  colour={focused ? colours.accent : colours.textSecondary}
                  size={24}
                />
              )}
              {showLabels ? (
                <AppText
                  variant="caption"
                  style={{
                    color: focused ? colours.accent : colours.textSecondary,
                  }}>
                  {label}
                </AppText>
              ) : null}
            </AppPressable>
          )
        })}
      </View>
    </MaterialNavigationBar>
  )
}

const styles = StyleSheet.create({
  createSlot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  profileAvatar: {
    borderWidth: 2,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
  },
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
