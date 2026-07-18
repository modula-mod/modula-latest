import {Stack} from 'expo-router'
import {StatusBar} from 'expo-status-bar'
import {useEffect} from 'react'

import {NetworkStatusBanner} from '@/components/data/NetworkStatusBanner'
import {AppErrorBoundary} from '@/components/system/AppErrorBoundary'
import {SessionProvider} from '@/auth/runtime'
import {QueryRuntimeProvider} from '@/data/query'
import {ProfilePresentationProvider} from '@/features/profile/runtime/ProfilePresentationProvider'
import '@/features/social/registerExpansionDestinations'
import {AccountPanelProvider} from '@/platform/ui'
import {hideExpoDevToolsButton} from '@/platform/ui/dev/hide-expo-dev-tools-button'
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
        <Stack.Screen name="messages" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="lists" />
        <Stack.Screen name="collections" />
        <Stack.Screen name="drafts" />
        <Stack.Screen name="communities" />
        <Stack.Screen name="teams" />
        <Stack.Screen name="modules" />
        <Stack.Screen name="marketplace" />
        <Stack.Screen name="product" />
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
      {/* Live nav chrome: left NavigationDrawer (avatar → openDrawer).
          AdaptiveAccountPanel remains in codebase for sheet Preview / verify,
          but is not mounted — nothing called openAccountPanel after the drawer restore. */}
      <NavigationDrawer />
    </>
  )
}

export default function RootLayout() {
  useEffect(() => {
    hideExpoDevToolsButton()
  }, [])

  return (
    <AppErrorBoundary>
      <AppServicesProvider>
        <QueryRuntimeProvider>
          <SessionProvider>
            <AppearanceProvider>
              <ProfilePresentationProvider>
                <AccountPanelProvider>
                  <ShellDrawerProvider>
                    <RootNavigator />
                    <NetworkStatusBanner />
                  </ShellDrawerProvider>
                </AccountPanelProvider>
              </ProfilePresentationProvider>
            </AppearanceProvider>
          </SessionProvider>
        </QueryRuntimeProvider>
      </AppServicesProvider>
    </AppErrorBoundary>
  )
}
