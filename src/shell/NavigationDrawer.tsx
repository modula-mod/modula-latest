import {useEffect, useMemo} from 'react'
import {Animated, BackHandler, Modal, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native'
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
import type {DrawerDestination} from '@/types/navigation'

const drawerDestinations: DrawerDestination[] = [
  {
    label: 'Board',
    route: '/board',
    icon: 'board',
    description: 'Focus, modules, and recent activity',
  },
  {
    label: 'Messages',
    route: '/messages',
    icon: 'messages',
    description: 'Private conversation preview',
  },
  {
    label: 'Saved',
    route: '/saved',
    icon: 'saved',
    description: 'Posts, links, and module notes',
  },
  {
    label: 'Communities',
    route: '/communities',
    icon: 'community',
    description: 'Groups attached to your environment',
  },
  {
    label: 'Teams',
    route: '/teams',
    icon: 'teams',
    description: 'Workspaces and shared surfaces',
  },
  {
    label: 'Modules',
    route: '/modules',
    icon: 'modules',
    description: 'Installed capabilities and previews',
  },
  {
    label: 'Marketplace',
    route: '/marketplace',
    icon: 'marketplace',
    description: 'Discover new Modula capabilities',
  },
  {
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    description: 'Local shell preferences preview',
  },
]

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
  const drawerWidth = Math.min(360, Math.max(280, width * 0.84))

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
              paddingTop: insets.top + spacing[3],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              paddingHorizontal: spacing[4],
              borderRightColor: colours.border,
              },
            ]}>
          <View style={[styles.header, {gap: spacing[3]}]}>
            <AppPressable
              accessibilityLabel="Open profile"
              onPress={() =>
                closeDrawer({afterClose: () => router.push('/profile' as Href)})
              }
              style={styles.headerIdentity}>
              <Avatar
                name={ownerProfile?.displayName ?? (session.status === 'guest' ? 'Guest' : 'Modula')}
                uri={ownerProfile?.avatarUri}
                colour={ownerProfile?.coverColour}
                size={54}
              />
              <View style={styles.headerText}>
                <AppText variant="headline">
                  {ownerProfile?.displayName ?? (session.status === 'guest' ? 'Guest' : 'Sign in to Modula')}
                </AppText>
                <AppText variant="caption" colour="textSecondary">
                  {ownerProfile ? `@${ownerProfile.handle}` : session.status === 'guest' ? 'Browsing public Modula' : 'Local prototype account'}
                </AppText>
              </View>
            </AppPressable>
            <AppPressable
              accessibilityLabel="Open profile"
              onPress={() =>
                closeDrawer({afterClose: () => router.push('/profile' as Href)})
              }
              style={[
                styles.profileShortcut,
                {
                  backgroundColor: colours.accentSubtle,
                  borderRadius: radius.round,
                  paddingHorizontal: spacing[3],
                },
              ]}>
              <AppText variant="label" style={{color: colours.accent}}>
                Profile
              </AppText>
            </AppPressable>
          </View>

          <View
            style={[
              styles.stats,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.medium,
                marginTop: spacing[4],
              },
            ]}>
            {[
              ['Following', ownerProfile?.followingCount ?? 0],
              ['Followers', ownerProfile?.followerCount ?? 0],
              ['Modules', ownerProfile?.moduleCount ?? 0],
            ].map(([label, value]) => (
              <View key={label} style={styles.stat}>
                <AppText variant="headline">{value}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {label}
                </AppText>
              </View>
            ))}
          </View>

          <Divider style={{marginVertical: spacing[4]}} />
          <View style={{gap: spacing[2]}}>
            {drawerDestinations.map(item => (
              <DrawerItem
                key={item.route}
                item={item}
                onPress={() => navigate(item.route)}
              />
            ))}
          </View>
          <View style={styles.footer}>
            <Divider style={{marginBottom: spacing[3]}} />
            <AppText variant="caption" colour="textSecondary">
              Appearance: {resolvedColourMode === 'light' ? 'Light' : 'Dark'}
            </AppText>
            {session.status === 'signedIn' ? (
              <AppPressable
                accessibilityLabel="Sign out"
                onPress={() => {
                  closeDrawer({afterClose: () => void signOut()})
                }}>
                <AppText variant="caption" colour="accent">
                  Sign out
                </AppText>
              </AppPressable>
            ) : null}
            <AppText variant="caption" colour="textSecondary">
              Modula 0.1.0 {isDevelopmentBuild() ? 'Development build' : 'Local shell'}
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
    marginTop: 'auto',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  profileShortcut: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  stats: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: 14,
  },
})
