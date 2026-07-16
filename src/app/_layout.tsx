import {Stack} from 'expo-router'
import {StatusBar} from 'expo-status-bar'

import {NetworkStatusBanner} from '@/components/data/NetworkStatusBanner'
import {AppErrorBoundary} from '@/components/system/AppErrorBoundary'
import {SessionProvider} from '@/auth/runtime'
import {QueryRuntimeProvider} from '@/data/query'
import {ProfilePresentationProvider} from '@/features/profile/runtime/ProfilePresentationProvider'
import {AppServicesProvider} from '@/runtime'
import {NavigationDrawer} from '@/shell/NavigationDrawer'
import {ShellDrawerProvider} from '@/shell/ShellDrawerContext'
import {AppearanceProvider} from '@/theme/runtime/AppearanceProvider'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function RootNavigator() {
  const {scheme, colours} = useThemeTokens()

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {backgroundColor: colours.canvas},
        }}>
        <Stack.Screen name="(auth)" />
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
    </>
  )
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppearanceProvider>
        <AppServicesProvider>
          <QueryRuntimeProvider>
            <SessionProvider>
              <ProfilePresentationProvider>
                <ShellDrawerProvider>
                  <RootNavigator />
                  <NetworkStatusBanner />
                </ShellDrawerProvider>
              </ProfilePresentationProvider>
            </SessionProvider>
          </QueryRuntimeProvider>
        </AppServicesProvider>
      </AppearanceProvider>
    </AppErrorBoundary>
  )
}
