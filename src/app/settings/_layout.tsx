import {Stack} from 'expo-router'

import {useTheme} from '@/theme/runtime/useTheme'

export default function SettingsLayout() {
  const {colours} = useTheme()

  return (
    <Stack
      screenOptions={{
        headerStyle: {backgroundColor: colours.canvas},
        headerTintColor: colours.accent,
        headerTitleStyle: {color: colours.text},
        contentStyle: {backgroundColor: colours.canvas},
      }}>
      <Stack.Screen name="index" options={{title: 'Settings'}} />
      <Stack.Screen name="account/index" options={{title: 'Account'}} />
      <Stack.Screen name="account/email" options={{title: 'Email'}} />
      <Stack.Screen name="account/password" options={{title: 'Password'}} />
      <Stack.Screen name="account/export" options={{title: 'Export data'}} />
      <Stack.Screen name="account/delete" options={{title: 'Delete account'}} />
      <Stack.Screen name="privacy/index" options={{title: 'Privacy & security'}} />
      <Stack.Screen name="privacy/activity" options={{title: 'Activity privacy'}} />
      <Stack.Screen name="privacy/app-passwords" options={{title: 'App passwords'}} />
      <Stack.Screen name="appearance" options={{title: 'Appearance'}} />
      <Stack.Screen name="accessibility" options={{title: 'Accessibility'}} />
      <Stack.Screen name="content-media" options={{title: 'Content & media'}} />
      <Stack.Screen name="notifications" options={{title: 'Notification settings'}} />
      <Stack.Screen name="language" options={{title: 'Languages'}} />
      <Stack.Screen name="moderation/index" options={{title: 'Moderation'}} />
      <Stack.Screen name="moderation/muted" options={{title: 'Muted accounts'}} />
      <Stack.Screen name="moderation/blocked" options={{title: 'Blocked accounts'}} />
      <Stack.Screen name="moderation/lists" options={{title: 'Moderation lists'}} />
      <Stack.Screen name="feeds" options={{title: 'Feed preferences'}} />
      <Stack.Screen name="interests" options={{title: 'Interests'}} />
      <Stack.Screen name="lists" options={{title: 'Lists'}} />
      <Stack.Screen name="modules" options={{title: 'Modules'}} />
      <Stack.Screen name="marketplace" options={{title: 'Marketplace'}} />
      <Stack.Screen name="about" options={{title: 'About'}} />
      <Stack.Screen name="developer" options={{title: 'Developer'}} />
    </Stack>
  )
}
