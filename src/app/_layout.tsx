import {Stack} from 'expo-router'
import {StatusBar} from 'expo-status-bar'

import {NetworkStatusBanner} from '@/components/data/NetworkStatusBanner'
import {AppErrorBoundary} from '@/components/system/AppErrorBoundary'
import {SessionProvider} from '@/auth/runtime'
import {QueryRuntimeProvider} from '@/data/query'
import {ProfilePresentationProvider} from '@/features/profile/runtime/ProfilePresentationProvider'
import '@/features/social/registerExpansionDestinations'
import {
  AccountPanelProvider,
  AdaptiveAccountPanel,
} from '@/platform/ui'
import {AppServicesProvider} from '@/runtime'
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
        <Stack.Screen name="messages" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="lists" />
        <Stack.Screen name="collections" />
        <Stack.Screen name="drafts" />
        <Stack.Screen name="communities" />
        <Stack.Screen name="teams" />
        <Stack.Screen name="modules" />
        <Stack.Screen name="marketplace" />
        <Stack.Screen name="creator" />
        <Stack.Screen name="help" />
        <Stack.Screen name="whats-new" />
        <Stack.Screen name="account/switcher" options={{presentation: 'modal'}} />
        <Stack.Screen name="share-profile" options={{presentation: 'modal'}} />
        <Stack.Screen name="share" options={{presentation: 'modal'}} />
        <Stack.Screen name="report" options={{presentation: 'modal'}} />
        <Stack.Screen name="reactions" options={{presentation: 'modal'}} />
        <Stack.Screen name="discover/interests" options={{presentation: 'modal'}} />
        <Stack.Screen name="discover/feeds" options={{presentation: 'modal'}} />
        <Stack.Screen name="discover/media" />
        <Stack.Screen name="settings" />
      </Stack>
      <AdaptiveAccountPanel />
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
                <AccountPanelProvider>
                  <ShellDrawerProvider>
                    <RootNavigator />
                    <NetworkStatusBanner />
                  </ShellDrawerProvider>
                </AccountPanelProvider>
              </ProfilePresentationProvider>
            </SessionProvider>
          </QueryRuntimeProvider>
        </AppServicesProvider>
      </AppearanceProvider>
    </AppErrorBoundary>
  )
}
