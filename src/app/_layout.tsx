import {Stack} from 'expo-router'
import {StatusBar} from 'expo-status-bar'

import {AppErrorBoundary} from '@/components/system/AppErrorBoundary'
import {DemoSocialProvider} from '@/demo/DemoSocialContext'
import {NavigationDrawer} from '@/shell/NavigationDrawer'
import {ShellDrawerProvider} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function RootNavigator() {
  const {scheme, colours} = useThemeTokens()

  return (
    <AppErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {backgroundColor: colours.canvas},
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="compose" options={{presentation: 'modal'}} />
        <Stack.Screen name="reels" />
        <Stack.Screen name="post/[postId]" />
        <Stack.Screen name="board" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="communities" />
        <Stack.Screen name="teams" />
        <Stack.Screen name="modules" />
        <Stack.Screen name="marketplace" />
        <Stack.Screen name="settings" />
      </Stack>
      <NavigationDrawer />
    </AppErrorBoundary>
  )
}

export default function RootLayout() {
  return (
    <DemoSocialProvider>
      <ShellDrawerProvider>
        <RootNavigator />
      </ShellDrawerProvider>
    </DemoSocialProvider>
  )
}
