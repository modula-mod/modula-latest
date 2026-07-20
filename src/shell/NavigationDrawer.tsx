import {useEffect, useMemo, useRef} from 'react'
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import {usePathname, useRouter, type Href} from 'expo-router'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import Animated, {
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {Avatar} from '@/components/primitives/Avatar'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useSession, useSessionActions} from '@/auth/runtime'
import {useReduceMotion} from '@/lib/accessibility'
import {isDevelopmentBuild} from '@/lib/platform'
import {getAccountPanelDestinations} from '@/platform/ui/navigation/account-panel-destinations'
import {DrawerItem} from '@/shell/DrawerItem'
import {useShellDrawer} from '@/shell/ShellDrawerContext'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {DrawerDestination, DrawerSectionId} from '@/types/navigation'

const SECTION_LABELS: Record<DrawerSectionId, string> = {
  spaces: 'Spaces',
  create: 'Create',
  labs: 'Labs',
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
    label: 'Messages',
    route: '/messages',
    icon: 'messages',
    section: 'spaces',
  },
  {
    label: 'Saved',
    route: '/saved',
    icon: 'saved',
    section: 'spaces',
  },
  {
    label: 'Modules',
    route: '/modules',
    icon: 'modules',
    description: 'Installed capabilities',
    section: 'spaces',
  },
  {
    label: 'Communities',
    route: '/communities',
    icon: 'community',
    section: 'spaces',
  },
  {
    label: 'Teams',
    route: '/teams',
    icon: 'teams',
    section: 'spaces',
  },
  {
    label: 'Marketplace',
    route: '/marketplace',
    icon: 'marketplace',
    section: 'create',
  },
  {
    label: 'Forge',
    route: '/product/forge',
    icon: 'developer',
    description: 'Build modules',
    section: 'create',
  },
  {
    label: 'Search',
    route: '/product/search',
    icon: 'search',
    section: 'create',
  },
  {
    label: 'Product Hub',
    route: '/product',
    icon: 'discover',
    section: 'labs',
  },
  {
    label: 'Customize',
    route: '/product/customize',
    icon: 'appearance',
    description: 'Layout studios and optional surfaces',
    section: 'labs',
  },
  {
    label: 'Design Lab',
    route: '/product/design-lab',
    icon: 'appearance',
    section: 'labs',
  },
  {
    label: 'Feature Atlas',
    route: '/product/atlas',
    icon: 'discover',
    section: 'labs',
  },
  {
    label: 'Focus Mode',
    route: '/product/focus',
    icon: 'contrast',
    section: 'labs',
  },
  {
    label: 'Developer Tools',
    route: '/product/developer',
    icon: 'tools',
    section: 'labs',
  },
  {
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    section: 'system',
  },
]

function routeSelected(pathname: string, route: string): boolean {
  if (pathname === route) return true
  if (route !== '/' && pathname.startsWith(`${route}/`)) return true
  return false
}

/** Map registry-only destinations into drawer sections (Lists, Drafts, Help, …). */
function sectionForRegistryRoute(route: string): DrawerSectionId {
  if (
    route.startsWith('/settings') ||
    route === '/help' ||
    route === '/account/switcher'
  ) {
    return 'system'
  }
  if (
    route.startsWith('/product') ||
    route === '/creator' ||
    route === '/reels'
  ) {
    return 'labs'
  }
  if (route === '/marketplace' || route === '/product/forge' || route === '/product/search') {
    return 'create'
  }
  return 'spaces'
}

export function NavigationDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const {width} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const {colours, spacing, radius, resolvedColourMode} = useThemeTokens()
  const {phase, progress, closeDrawer, settleDrawer} = useShellDrawer()
  const reduceMotion = useReduceMotion()
  const session = useSession()
  const {signOut} = useSessionActions()
  const ownerProfile = session.status === 'signedIn' ? session.profile : null
  const drawerWidth = Math.min(348, Math.max(292, width * 0.82))

  const sections = useMemo(() => {
    const knownRoutes = new Set(drawerDestinations.map(item => item.route))
    const extras: DrawerDestination[] = getAccountPanelDestinations()
      .filter(item => !knownRoutes.has(item.route))
      .map(item => ({
        label: item.label,
        route: item.route,
        icon: item.icon,
        description: item.description,
        section: sectionForRegistryRoute(item.route),
      }))
    const merged = [...drawerDestinations, ...extras]
    return SECTION_ORDER.map(id => ({
      id,
      label: SECTION_LABELS[id],
      items: merged.filter(item => item.section === id),
    })).filter(section => section.items.length > 0)
  }, [])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }))

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-drawerWidth, 0]),
      },
      {
        scale: interpolate(progress.value, [0, 1], [0.97, 1]),
      },
    ],
    opacity: interpolate(progress.value, [0, 0.2, 1], [0.85, 1, 1]),
  }))

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onUpdate(event => {
          'worklet'
          const next = 1 + event.translationX / drawerWidth
          progress.value = Math.max(0, Math.min(1, next))
        })
        .onEnd(event => {
          'worklet'
          runOnJS(settleDrawer)({
            velocityX: event.velocityX,
            at: progress.value,
          })
        }),
    [drawerWidth, progress, settleDrawer],
  )

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

  let staggerIndex = 0

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => closeDrawer()}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: colours.backdrop},
            backdropStyle,
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation drawer"
            onPress={() => closeDrawer()}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.drawerFrame,
              drawerStyle,
              {
                width: drawerWidth,
              },
            ]}>
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
                          : 'Local prototype account'}
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
                {sections.map(section => (
                  <View key={section.id} style={{gap: spacing[1]}}>
                    <AppText
                      variant="caption"
                      colour="textTertiary"
                      style={{
                        paddingHorizontal: spacing[2],
                        marginBottom: spacing[1],
                      }}>
                      {section.label.toUpperCase()}
                    </AppText>
                    <View style={{gap: spacing[1]}}>
                      {section.items.map(item => {
                        const delay = reduceMotion ? 0 : 40 + staggerIndex * 28
                        staggerIndex += 1
                        return (
                          <Animated.View
                            key={item.route}
                            entering={
                              reduceMotion
                                ? undefined
                                : FadeInDown.delay(delay).springify().damping(20)
                            }>
                            <DrawerItem
                              item={item}
                              dense={section.id === 'system' || section.id === 'labs'}
                              selected={routeSelected(pathname, item.route)}
                              onPress={() => navigate(item.route)}
                            />
                          </Animated.View>
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
                <AppText variant="caption" colour="textTertiary">
                  Appearance · {resolvedColourMode === 'light' ? 'Light' : 'Dark'}
                </AppText>
                {session.status === 'signedIn' ? (
                  <AppPressable
                    accessibilityLabel="Sign out"
                    onPress={() => {
                      closeDrawer({afterClose: () => void signOut()})
                    }}>
                    <AppText variant="label" colour="accent">
                      Sign out
                    </AppText>
                  </AppPressable>
                ) : null}
                <AppText variant="micro" colour="textTertiary">
                  Modula 0.1.0 · {isDevelopmentBuild() ? 'Development' : 'Local'}
                </AppText>
              </View>
            </MaterialSurface>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  drawer: {
    borderRadius: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    flex: 1,
    width: '100%',
  },
  drawerFrame: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
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
