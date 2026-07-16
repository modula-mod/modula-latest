import {Tabs} from 'expo-router'
import {Platform} from 'react-native'

import {useTheme} from '@/theme/runtime/useTheme'

export default function TabsLayout() {
  const {colours} = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colours.accent,
        tabBarInactiveTintColor: colours.textSecondary,
        tabBarStyle: {
          backgroundColor: colours.canvas,
          borderTopColor: colours.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          tabBarAccessibilityLabel: 'Board',
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarAccessibilityLabel: 'Feed',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: Platform.OS === 'web' ? 'Alerts' : 'Alerts',
          tabBarAccessibilityLabel: 'Notifications',
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
