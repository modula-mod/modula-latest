import {useRouter, type Href} from 'expo-router'
import {useState, type ReactNode} from 'react'
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {Avatar} from '@/components/primitives/Avatar'
import {useSession} from '@/auth/runtime'
import {isFeatureEnabled} from '@/features/product/data/featureControl'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaTitleIconButton} from '@/platform/ui/buttons/modula-title-icon-button'
import {FLOATING_TAB_BAR_SEGMENT_HEIGHT} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {expandShellTabBar} from '@/platform/ui/navigation/shell-tab-bar-compact'
import type {ModulaLiquidGlassTabBarProps} from '@/platform/ui/navigation/modula-liquid-glass-tab-bar.types'
import {
  MODULA_TABS,
  type ModulaTabDefinition,
} from '@/platform/ui/navigation/modula-tabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type {ModulaLiquidGlassTabBarProps}

/**
 * Expandable floating bottom tab bar.
 * The pill is an opaque raised surface. BlurView and LiquidGlassView both
 * sample the scrolling feed and leak post text through the chrome.
 * Loaded only via dynamic require from PlatformTabs after a native-module probe.
 * Product screens must not import this file or `@callstack/liquid-glass`.
 */

const TAB_ICONS: Record<string, AppIconName> = {
  index: 'home',
  discover: 'discover',
  hub: 'modules',
  create: 'create',
  activity: 'activity',
  profile: 'profile',
}

type ExpandAction = {
  id: string
  label: string
  icon: AppIconName
  href?: Href
  compose?: boolean
  featureId?: string
}

const EXPAND_ACTIONS: ExpandAction[] = [
  {id: 'compose', label: 'Compose', icon: 'create', compose: true},
  {id: 'messages', label: 'Messages', icon: 'messages', href: '/messages'},
  {id: 'marketplace', label: 'Marketplace', icon: 'marketplace', href: '/marketplace'},
  {id: 'product', label: 'Product Hub', icon: 'modules', href: '/product'},
  {id: 'customize', label: 'Customize', icon: 'appearance', href: '/product/customize'},
  {
    id: 'forge',
    label: 'Forge Builder',
    icon: 'developer',
    href: '/product/forge',
    featureId: 'forge',
  },
  {
    id: 'focus',
    label: 'Focus Mode',
    icon: 'contrast',
    href: '/product/focus',
    featureId: 'focus',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: 'automation',
    href: '/product/agents',
    featureId: 'agents',
  },
  {id: 'permissions', label: 'Permissions', icon: 'privacy', href: '/product/permissions'},
  {id: 'discover', label: 'Search / Discover', icon: 'search', href: '/discover'},
  {id: 'drafts', label: 'Drafts', icon: 'saved', href: '/drafts'},
]

function ChromeSurface({
  children,
  style,
  backgroundColor,
  borderColor,
  shadowColor,
}: {
  children: ReactNode
  style?: object
  backgroundColor: string
  borderColor: string
  shadowColor: string
}) {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined
  const borderRadius: ViewStyle['borderRadius'] = flattened?.borderRadius
  return (
    <View
      style={[
        styles.chromeShadow,
        {
          borderRadius,
          shadowColor,
        },
      ]}>
      <View
        style={[
          style,
          styles.chromeFill,
          {
            backgroundColor,
            borderColor,
            borderRadius,
          },
        ]}>
        {children}
      </View>
    </View>
  )
}

export function ModulaLiquidGlassTabBar({
  state,
  navigation,
}: ModulaLiquidGlassTabBarProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const session = useSession()
  const profile = session.status === 'signedIn' ? session.profile : null
  const {colours, radius, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const {preferences} = useProductPreferences()
  const [expanded, setExpanded] = useState(false)
  const mainTabScale = useSharedValue(1)
  const plusIconRotate = useSharedValue(0)
  const expandActions = EXPAND_ACTIONS.filter(
    action => !action.featureId || isFeatureEnabled(preferences, action.featureId),
  )

  const visibleTabs = MODULA_TABS.filter(
    tab => tab.routeName !== 'create' && state.routes.some(route => route.name === tab.routeName),
  )

  const selectedRouteName =
    state.index >= 0 ? state.routes[state.index]?.name : undefined
  const selectedIndex = selectedRouteName
    ? visibleTabs.findIndex(tab => tab.routeName === selectedRouteName)
    : -1

  const menuStyle = useAnimatedStyle(() => ({
    height: expanded
      ? withTiming(reduceMotion ? 480 : 520, {duration: reduceMotion ? 0 : 150})
      : withTiming(0, {duration: reduceMotion ? 0 : 150}),
    opacity: expanded
      ? withTiming(1, {duration: reduceMotion ? 0 : 150})
      : withTiming(0, {duration: reduceMotion ? 0 : 150}),
    padding: expanded ? 12 : withTiming(0, {duration: reduceMotion ? 0 : 150}),
  }))

  const mainTabStyle = useAnimatedStyle(() => ({
    transform: [{scale: mainTabScale.value}],
  }))

  const plusIconStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${plusIconRotate.value}deg`}],
  }))

  const navigateTab = (tab: ModulaTabDefinition) => {
    expandShellTabBar()
    const route = state.routes.find(item => item.name === tab.routeName)
    if (!route) return
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    })
    if (!event.defaultPrevented) {
      navigation.navigate(tab.routeName)
      void selectionHaptic()
    }
    if (expanded) setExpanded(false)
  }

  const onPlusPress = () => {
    expandShellTabBar()
    void selectionHaptic()
    if (reduceMotion) {
      setExpanded(prev => !prev)
      plusIconRotate.value = expanded ? 0 : 45
      return
    }

    if (!expanded) {
      // Reanimated shared value, not React state.
      // eslint-disable-next-line react-hooks/immutability
      mainTabScale.value = withSequence(
        withTiming(0.5, {duration: 150}),
        withSpring(1, {stiffness: 900, damping: 60, mass: 8}),
      )
      plusIconRotate.value = withTiming(45, {duration: 200})
    } else {
      mainTabScale.value = withSequence(
        withTiming(1.1, {duration: 150}),
        withTiming(0.9, {duration: 150}),
        withSpring(1, {stiffness: 600, damping: 130, mass: 9}),
      )
      plusIconRotate.value = withTiming(0, {duration: 150})
    }
    setTimeout(() => setExpanded(prev => !prev), reduceMotion ? 0 : 180)
  }

  const onExpandAction = (action: ExpandAction) => {
    expandShellTabBar()
    setExpanded(false)
    plusIconRotate.value = withTiming(0, {duration: reduceMotion ? 0 : 150})
    void selectionHaptic()
    if (action.compose) {
      router.push('/compose' as Href)
      return
    }
    if (action.href) {
      router.push(action.href)
    }
  }

  const glassFallback = colours.surfaceRaised
  const bottomPad = Math.max(insets.bottom, spacing[2])

  return (
    <View
      style={[
        styles.container,
        {
          bottom: 0,
          paddingBottom: bottomPad,
          gap: spacing[3],
        },
      ]}>
      <Animated.View style={[mainTabStyle, styles.mainCluster]}>
        <ChromeSurface
          backgroundColor={glassFallback}
          borderColor={colours.border}
          shadowColor={colours.shadow}
          style={[
            styles.liquidGlassView,
            {
              borderRadius: radius.xlarge,
            },
          ]}>
          {/* Only mount expand menu when open — avoids ghost icons through glass. */}
          {expanded ? (
            <Animated.View
              style={[styles.menuContainer, menuStyle]}
              pointerEvents="auto"
              accessibilityElementsHidden={false}>
              {expandActions.map(action => (
                <ModulaTitleIconButton
                  key={action.id}
                  icon={action.icon}
                  label={action.label}
                  chrome={action.compose ? 'prominent' : 'plain'}
                  stretch
                  onPress={() => onExpandAction(action)}
                  style={styles.menuItem}
                />
              ))}
            </Animated.View>
          ) : null}

          <View
            style={[
              styles.segmentRow,
              expanded && styles.segmentHidden,
              {paddingHorizontal: spacing[2]},
            ]}
            accessibilityRole="tablist">
            {visibleTabs.map((tab, index) => {
              const selected = index === selectedIndex
              const isProfile = tab.routeName === 'profile'
              return (
                <AppPressable
                  key={tab.id}
                  accessibilityLabel={tab.label}
                  accessibilityRole="tab"
                  accessibilityState={{selected}}
                  onPressIn={expandShellTabBar}
                  onPress={() => navigateTab(tab)}
                  style={styles.tabHit}>
                  {isProfile ? (
                    <View
                      style={[
                        styles.profileAvatarRing,
                        selected
                          ? {
                              borderColor: colours.accent,
                              borderWidth: 1.5,
                            }
                          : {borderColor: 'transparent', borderWidth: 1.5},
                      ]}>
                      <Avatar
                        name={
                          profile?.displayName ??
                          (session.status === 'guest' ? 'Guest' : 'Modula')
                        }
                        uri={profile?.avatarUri}
                        colour={profile?.coverColour}
                        size={22}
                        style={styles.profileAvatar}
                      />
                    </View>
                  ) : (
                    <AppIcon
                      name={TAB_ICONS[tab.routeName] ?? 'home'}
                      colour={selected ? colours.accent : colours.textSecondary}
                      size={22}
                    />
                  )}
                  {selected ? (
                    <View
                      style={[
                        styles.tabIndicator,
                        {backgroundColor: colours.accent},
                      ]}
                    />
                  ) : (
                    <View style={styles.tabIndicatorSpacer} />
                  )}
                </AppPressable>
              )
            })}
          </View>
        </ChromeSurface>
      </Animated.View>

      <Pressable
        accessibilityLabel={expanded ? 'Close compose menu' : 'Open compose menu'}
        accessibilityRole="button"
        onPressIn={expandShellTabBar}
        onPress={onPlusPress}
        onLongPress={() => {
          expandShellTabBar()
          router.push('/compose' as Href)
          void selectionHaptic()
        }}
        style={styles.plusButtonContainer}>
        <ChromeSurface
          backgroundColor={colours.accent}
          borderColor={colours.accent}
          shadowColor={colours.shadow}
          style={[
            styles.plusButtonGlass,
            {
              borderRadius: radius.round,
            },
          ]}>
          <Animated.View style={plusIconStyle}>
            <AppIcon
              name="create"
              colour={colours.accentForeground}
              size={22}
            />
          </Animated.View>
        </ChromeSurface>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  chromeFill: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  chromeShadow: {
    elevation: 10,
    overflow: 'visible',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  container: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    left: 16,
    position: 'absolute',
    right: 16,
    // Above ShellBottomProgressiveBlur (zIndex 3).
    zIndex: 10,
  },
  liquidGlassView: {
    justifyContent: 'center',
    minHeight: FLOATING_TAB_BAR_SEGMENT_HEIGHT,
  },
  mainCluster: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuContainer: {
    gap: 8,
    overflow: 'hidden',
  },
  menuItem: {
    alignSelf: 'stretch',
    minHeight: 44,
    minWidth: '100%',
  },
  plusButtonContainer: {
    marginBottom: 2,
  },
  plusButtonGlass: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  profileAvatar: {
    borderWidth: 0,
  },
  profileAvatarRing: {
    alignItems: 'center',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  segmentHidden: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  segmentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: FLOATING_TAB_BAR_SEGMENT_HEIGHT,
    justifyContent: 'space-evenly',
  },
  tabHit: {
    alignItems: 'center',
    flex: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: 8,
  },
  tabIndicator: {
    borderRadius: 1.5,
    height: 3,
    marginTop: 4,
    width: 16,
  },
  tabIndicatorSpacer: {
    height: 3,
    marginTop: 4,
    width: 16,
  },
})
