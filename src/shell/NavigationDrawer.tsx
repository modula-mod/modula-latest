import {useEffect, useMemo} from 'react'
import {
  Animated,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import {usePathname, useRouter, type Href} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {Avatar} from '@/components/primitives/Avatar'
import {Divider} from '@/components/primitives/Divider'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useSession, useSessionActions} from '@/auth/runtime'
import {isDevelopmentBuild} from '@/lib/platform'
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

export function NavigationDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const {width} = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const {colours, spacing, radius, resolvedColourMode} = useThemeTokens()
  const {phase, progress, closeDrawer} = useShellDrawer()
  const session = useSession()
  const {signOut} = useSessionActions()
  const ownerProfile = session.status === 'signedIn' ? session.profile : null
  const drawerWidth = Math.min(348, Math.max(292, width * 0.82))

  const sections = useMemo(
    () =>
      SECTION_ORDER.map(id => ({
        id,
        label: SECTION_LABELS[id],
        items: drawerDestinations.filter(item => item.section === id),
      })).filter(section => section.items.length > 0),
    [],
  )

  const animatedStyles = useMemo(
    () => ({
      backdrop: {
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
      drawer: {
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-drawerWidth, 0],
            }),
          },
        ],
      },
    }),
    [drawerWidth, progress],
  )

  useEffect(() => {
    if (phase === 'closed') return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer()
      return true
    })
    return () => subscription.remove()
  }, [closeDrawer, phase])

  useEffect(() => {
    if (phase === 'open') {
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
    <Modal transparent visible animationType="none" onRequestClose={() => closeDrawer()}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: colours.backdrop},
            animatedStyles.backdrop,
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation drawer"
            onPress={() => closeDrawer()}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawerFrame,
            animatedStyles.drawer,
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
                  <AppText variant="headline">
                    {ownerProfile?.displayName ??
                      (session.status === 'guest' ? 'Guest' : 'Sign in to Modula')}
                  </AppText>
                  <AppText variant="caption" colour="textSecondary">
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

            <Divider />

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{
                paddingHorizontal: spacing[3],
                paddingTop: spacing[3],
                paddingBottom: spacing[4],
                gap: spacing[4],
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {sections.map(section => (
                <View key={section.id} style={{gap: spacing[1]}}>
                  <AppText
                    variant="caption"
                    colour="textTertiary"
                    style={{paddingHorizontal: spacing[2], marginBottom: spacing[1]}}>
                    {section.label.toUpperCase()}
                  </AppText>
                  <View style={{gap: spacing[1]}}>
                    {section.items.map(item => (
                      <DrawerItem
                        key={item.route}
                        item={item}
                        dense={section.id === 'system' || section.id === 'labs'}
                        selected={routeSelected(pathname, item.route)}
                        onPress={() => navigate(item.route)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: spacing[4],
                  paddingBottom: Math.max(insets.bottom, spacing[4]),
                  paddingTop: spacing[3],
                  borderTopColor: colours.border,
                  gap: spacing[2],
                },
              ]}>
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
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  drawer: {
    borderRightWidth: StyleSheet.hairlineWidth,
    flex: 1,
  },
  drawerFrame: {
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerPad: {
    width: '100%',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  profilePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    flex: 1,
  },
  statsQuiet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
