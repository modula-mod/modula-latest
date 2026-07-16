import {Tabs} from 'expo-router'

import {MainTabBar} from '@/shell/MainTabBar'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export default function TabsLayout() {
  const {colours} = useThemeTokens()

  return (
    <Tabs
      tabBar={props => <MainTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {backgroundColor: colours.canvas},
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarAccessibilityLabel: 'Discover',
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarAccessibilityLabel: 'Create',
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarAccessibilityLabel: 'Activity',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
        }}
      />
    </Tabs>
  )
}
