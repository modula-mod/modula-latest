import {GestureHandlerRootView} from 'react-native-gesture-handler'

import {Stack, useGlobalSearchParams} from 'expo-router'
import Head from 'expo-router/head'
import {StatusBar} from 'expo-status-bar'
import {useEffect} from 'react'
import {StyleSheet} from 'react-native'

import {NetworkStatusBanner} from '@/components/data/NetworkStatusBanner'
import {AppErrorBoundary} from '@/components/system/AppErrorBoundary'
import {SessionProvider} from '@/auth/runtime'
import {QueryRuntimeProvider} from '@/data/query'
import {ProductPreferencesProvider} from '@/features/product/runtime/ProductPreferencesProvider'
import {ProfilePresentationProvider} from '@/features/profile/runtime/ProfilePresentationProvider'
import {AppLockGate, AppLockProvider} from '@/features/security/app-lock'
import '@/features/social/registerExpansionDestinations'
import {AccountPanelProvider} from '@/platform/ui/navigation/AccountPanelContext'
import {hideExpoDevToolsButton} from '@/platform/ui/dev/hide-expo-dev-tools-button'
import {PersistentShellTabBar} from '@/platform/ui/navigation/persistent-shell-tab-bar'
import {ShellBottomProgressiveBlur} from '@/platform/ui/navigation/shell-bottom-progressive-blur'
import {ModulaSplashOverlay} from '@/platform/ui/splash/ModulaSplashOverlay'
import {ModulaToastProvider} from '@/platform/ui/feedback'
import {ModulaActionPresenterProvider} from '@/platform/ui/menus/modula-action-presenter-provider'
import {ModulaConfirmationProvider} from '@/platform/ui/menus/modula-confirmation-provider'
import {prepareModulaSplash} from '@/platform/ui/splash/modula-splash'
import {AppServicesProvider} from '@/runtime'
import {NavigationDrawer} from '@/shell/NavigationDrawer'
import {ShellDrawerProvider, useShellDrawer} from '@/shell/ShellDrawerContext'
import {AppearanceProvider} from '@/theme/runtime/AppearanceProvider'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

void prepareModulaSplash()

function RootNavigator() {
  const {scheme, colours} = useThemeTokens()
  const {openDrawer} = useShellDrawer()
  const params = useGlobalSearchParams<{openDrawer?: string | string[]}>()

  useEffect(() => {
    if (!__DEV__) return
    const flag = Array.isArray(params.openDrawer) ? params.openDrawer[0] : params.openDrawer
    if (flag !== '1') return
    const timer = setTimeout(() => openDrawer(), 600)
    return () => clearTimeout(timer)
  }, [openDrawer, params.openDrawer])

  return (
    <>
      <Head>
        <title>Modula</title>
      </Head>
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
        <Stack.Screen name="share-profile" options={{presentation: 'modal'}} />
        <Stack.Screen name="share" options={{presentation: 'modal'}} />
        <Stack.Screen name="report" options={{presentation: 'modal'}} />
        <Stack.Screen name="reactions" options={{presentation: 'modal'}} />
        <Stack.Screen name="board" />
        <Stack.Screen name="settings" />
      </Stack>
      {/* Live nav chrome: left NavigationDrawer (avatar → openDrawer).
          AdaptiveAccountPanel remains in codebase for sheet Preview / verify,
          but is not mounted — nothing called openAccountPanel after the drawer restore. */}
      <NavigationDrawer />
      {/* iOS NativeTabs owns the home-indicator edge. Web still fades the rail. */}
      <ShellBottomProgressiveBlur />
      {/* NativeTabs live in (tabs). This mount is a no-op on iOS. */}
      <PersistentShellTabBar />
      <ModulaSplashOverlay />
    </>
  )
}

export default function RootLayout() {
  useEffect(() => {
    hideExpoDevToolsButton()
  }, [])

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppErrorBoundary>
        <AppServicesProvider>
          <QueryRuntimeProvider>
            <SessionProvider>
              <AppearanceProvider>
                <ModulaActionPresenterProvider>
                  <ModulaConfirmationProvider>
                    <ModulaToastProvider>
                      <AppLockProvider>
                        <ProductPreferencesProvider>
                          <ProfilePresentationProvider>
                            <AccountPanelProvider>
                              <ShellDrawerProvider>
                                <RootNavigator />
                                <NetworkStatusBanner />
                                <AppLockGate />
                              </ShellDrawerProvider>
                            </AccountPanelProvider>
                          </ProfilePresentationProvider>
                        </ProductPreferencesProvider>
                      </AppLockProvider>
                    </ModulaToastProvider>
                  </ModulaConfirmationProvider>
                </ModulaActionPresenterProvider>
              </AppearanceProvider>
            </SessionProvider>
          </QueryRuntimeProvider>
        </AppServicesProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
