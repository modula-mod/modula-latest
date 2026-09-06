import {useEffect, useMemo, useRef, type ReactNode} from 'react'
import {
  BackHandler,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import {usePathname, useRouter, type Href} from 'expo-router'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {Avatar} from '@/components/primitives/Avatar'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useSession, useSessionActions} from '@/auth/runtime'
import {useReduceMotion} from '@/lib/accessibility'
import {useMotionEntering} from '@/platform/ui/motion/useMotionEntering'
import {ModulaDrawerFrame} from '@/platform/ui/drawers'
import {isDevelopmentBuild, canAccessDeveloperLabs} from '@/lib/platform'
import {DrawerItem} from '@/shell/DrawerItem'
import {useShellDrawer} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DrawerDestination, DrawerSectionId} from '@/types/navigation'

const SECTION_LABELS: Record<DrawerSectionId, string> = {
  spaces: 'Personal',
  create: 'Product',
  labs: 'Preview',
  system: 'System',
}

const SECTION_ORDER: DrawerSectionId[] = ['spaces', 'create', 'labs', 'system']
const FOOTER_FADE = 36

/**
 * Primary navigation destinations — sectioned for Apple-like hierarchy.
 * Labs stay secondary so the drawer does not read as a feature dump.
 */
const drawerDestinations: DrawerDestination[] = [
  {
    label: 'Board',
    route: '/board',
    icon: 'board',
    description: 'Your private operating home',
    section: 'spaces',
  },
  {
    label: 'Saved',
    route: '/saved',
    icon: 'saved',
    section: 'spaces',
  },
  {
    label: 'Profile preview',
    route: '/profile/preview',
    icon: 'profile',
    description: 'Review your public surface',
    section: 'spaces',
  },
  {
    label: 'Product Hub',
    route: '/product',
    icon: 'modules',
    description: 'Modules, tools and widgets',
    section: 'create',
  },
  {
    label: 'Installed modules',
    route: '/modules',
    icon: 'modules',
    description: 'Manage enabled capabilities',
    section: 'create',
  },
  {
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    section: 'system',
  },
  {
    label: 'Appearance',
    route: '/settings/appearance',
    icon: 'appearance',
    description: 'Mode, accent and surfaces',
    section: 'system',
  },
]

function routeSelected(pathname: string, route: string): boolean {
  if (pathname === route) return true
  if (route !== '/' && pathname.startsWith(`${route}/`)) return true
  return false
}

export function NavigationDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const {width} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const {colours, spacing, radius, resolvedColourMode, motion} = useThemeTokens()
  const {phase, progress, closeDrawer, settleDrawer} = useShellDrawer()
  const reduceMotion = useReduceMotion()
  const session = useSession()
  const {signOut} = useSessionActions()
  const ownerProfile = session.status === 'signedIn' ? session.profile : null
  const drawerWidth = Math.min(348, Math.max(292, width * 0.82))

  const sections = useMemo(() => {
    const merged = drawerDestinations.filter(item => {
      if (item.route === '/profile/preview' && !canAccessDeveloperLabs()) return false
      return true
    })
    return SECTION_ORDER.map(id => ({
      id,
      label: SECTION_LABELS[id],
      items: merged.filter(item => item.section === id),
    })).filter(section => section.items.length > 0)
  }, [])

  const indexedSections = useMemo(() => {
    let nextIndex = 0
    return sections.map(section => ({
      ...section,
      items: section.items.map(item => ({
        item,
        staggerIndex: nextIndex++,
      })),
    }))
  }, [sections])

  useEffect(() => {
    if (phase === 'closed') return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer()
      return true
    })
    return () => subscription.remove()
  }, [closeDrawer, phase])

  // Close only when the route changes — not when the drawer first opens.
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    if (pathnameRef.current === pathname) return
    pathnameRef.current = pathname
    if (phase !== 'closed') {
      closeDrawer()
    }
  }, [closeDrawer, pathname, phase])

  if (phase === 'closed') {
    return null
  }

  const navigate = (route: DrawerDestination['route']) => {
    closeDrawer({
      afterClose: () => router.push(route as Href),
    })
  }

  return (
    <ModulaDrawerFrame
      accessibilityLabel="Navigation drawer"
      isPresented
      onDismiss={() => closeDrawer()}
      onSettle={settleDrawer}
      progress={progress}
      testID="navigation-drawer"
      width={drawerWidth}>
            <MaterialSurface
              role="modal"
              style={[
                styles.drawer,
                {
                  paddingTop: insets.top + spacing[4],
                  borderRightColor: colours.border,
                },
              ]}>
              <View
                style={[
                  styles.headerPad,
                  {
                    paddingHorizontal: spacing[4],
                    gap: spacing[3],
                    paddingBottom: spacing[3],
                  },
                ]}>
                <AppPressable
                  accessibilityLabel="Open profile"
                  onPress={() =>
                    closeDrawer({afterClose: () => router.push('/profile' as Href)})
                  }
                  style={[styles.headerIdentity, {gap: spacing[3]}]}>
                  <Avatar
                    name={
                      ownerProfile?.displayName ??
                      (session.status === 'guest' ? 'Guest' : 'Modula')
                    }
                    uri={ownerProfile?.avatarUri}
                    colour={ownerProfile?.coverColour}
                    size={52}
                  />
                  <View style={styles.headerText}>
                    <AppText variant="headline" numberOfLines={1}>
                      {ownerProfile?.displayName ??
                        (session.status === 'guest' ? 'Guest' : 'Sign in to Modula')}
                    </AppText>
                    <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                      {ownerProfile
                        ? `@${ownerProfile.handle}`
                        : session.status === 'guest'
                          ? 'Browsing Modula'
                          : 'Sign in for your Greenfield account'}
                    </AppText>
                  </View>
                </AppPressable>

                {ownerProfile ? (
                  <View style={[styles.statsQuiet, {gap: spacing[4]}]}>
                    <AppText variant="caption" colour="textSecondary">
                      {ownerProfile.followingCount ?? 0} following
                    </AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {ownerProfile.followerCount ?? 0} followers
                    </AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {ownerProfile.moduleCount ?? 0} modules
                    </AppText>
                  </View>
                ) : null}

                <AppPressable
                  accessibilityLabel="View profile"
                  onPress={() =>
                    closeDrawer({afterClose: () => router.push('/profile' as Href)})
                  }
                  style={[
                    styles.profilePill,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                      borderRadius: radius.round,
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[2],
                    },
                  ]}>
                  <AppText variant="label">View Profile</AppText>
                </AppPressable>
              </View>

              <View style={styles.headerFade} pointerEvents="none">
                <ProgressiveBlurBand height={28} topHeavy intensity={36} />
              </View>

              <Animated.ScrollView
                style={styles.scroll}
                contentContainerStyle={{
                  paddingHorizontal: spacing[3],
                  paddingTop: spacing[2],
                  paddingBottom: spacing[4] + FOOTER_FADE,
                  gap: spacing[4],
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {indexedSections.map(section => (
                  <View key={section.id} style={{gap: spacing[1]}}>
                    <AppText
                      variant="caption"
                      colour="textSecondary"
                      style={{
                        paddingHorizontal: spacing[2],
                        marginBottom: spacing[1],
                      }}>
                      {section.label.toUpperCase()}
                    </AppText>
                    <View style={{gap: spacing[1]}}>
                      {section.items.map(({item, staggerIndex}) => {
                        const delay = reduceMotion ? 0 : motion.fast / 3 + staggerIndex * (motion.fast / 5)
                        return (
                          <DrawerRowEnter key={item.route} delay={delay}>
                            <DrawerItem
                              item={item}
                              dense={section.id === 'system' || section.id === 'labs'}
                              selected={routeSelected(pathname, item.route)}
                              onPress={() => navigate(item.route)}
                            />
                          </DrawerRowEnter>
                        )
                      })}
                    </View>
                  </View>
                ))}
              </Animated.ScrollView>

              <View
                style={[
                  styles.footer,
                  {
                    paddingHorizontal: spacing[4],
                    paddingBottom: Math.max(insets.bottom, spacing[4]),
                    paddingTop: spacing[3],
                    gap: spacing[2],
                  },
                ]}>
                <View style={styles.footerFade} pointerEvents="none">
                  <ProgressiveBlurBand
                    height={FOOTER_FADE}
                    topHeavy={false}
                    intensity={40}
                  />
                </View>
                <AppText variant="caption" colour="textSecondary">
                  Appearance · {resolvedColourMode === 'light' ? 'Light' : 'Dark'}
                </AppText>
                {session.status === 'signedIn' ? (
                  <AppPressable
                    testID="drawer-sign-out"
                    accessibilityLabel="Sign out"
                    onPress={() => {
                      closeDrawer({afterClose: () => void signOut()})
                    }}>
                    <AppText variant="label" colour="accent">
                      Sign out
                    </AppText>
                  </AppPressable>
                ) : null}
                <AppText variant="micro" colour="textSecondary">
                  Modula 0.1.0 · {isDevelopmentBuild() ? 'Development' : 'Local'}
                </AppText>
              </View>
            </MaterialSurface>
    </ModulaDrawerFrame>
  )
}

function DrawerRowEnter({delay, children}: {delay: number; children: ReactNode}) {
  const entering = useMotionEntering('down', delay)
  if (!entering) {
    return <>{children}</>
  }
  return <Animated.View entering={entering}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  drawer: {
    borderRadius: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    flex: 1,
    width: '100%',
  },
  footer: {
    overflow: 'visible',
    position: 'relative',
  },
  footerFade: {
    height: FOOTER_FADE,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -FOOTER_FADE,
  },
  headerFade: {
    height: 28,
    marginTop: -4,
    width: '100%',
  },
  headerIdentity: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  headerPad: {
    width: '100%',
  },
  headerText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 96,
  },
  profilePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  statsQuiet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
