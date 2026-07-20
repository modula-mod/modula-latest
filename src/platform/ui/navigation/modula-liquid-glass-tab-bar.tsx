import {useRouter, type Href} from 'expo-router'
import {useState, type ComponentType, type ReactNode} from 'react'
import {Pressable, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'
import {BlurView} from 'expo-blur'
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
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'

export type {ModulaLiquidGlassTabBarProps}

/**
 * Expandable liquid-glass bottom tab bar adapted from
 * https://github.com/iamitkhatkar/rn-expandable-tab-liquid-glass
 * (owner permission granted for Modula integration).
 *
 * Loaded only via dynamic require from PlatformTabs after a safe native-module
 * probe. Do not statically import this file from app routes or Expo Go paths.
 *
 * Product screens must not import this file or `@callstack/liquid-glass`.
 */

type LiquidGlassModule = {
  LiquidGlassContainerView: ComponentType<{
    style?: StyleProp<ViewStyle>
    spacing?: number
    children?: ReactNode
  }>
  LiquidGlassView: ComponentType<{
    style?: StyleProp<ViewStyle>
    interactive?: boolean
    effect?: string
    children?: ReactNode
  }>
  isLiquidGlassSupported: boolean
}

function loadLiquidGlassModule(): LiquidGlassModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@callstack/liquid-glass') as LiquidGlassModule
  } catch {
    return null
  }
}

const liquidGlass = loadLiquidGlassModule()
const isLiquidGlassSupported = Boolean(liquidGlass?.isLiquidGlassSupported)
const LiquidGlassContainerView = liquidGlass?.LiquidGlassContainerView ?? View
const LiquidGlassView = liquidGlass?.LiquidGlassView ?? View

const TAB_ICONS: Record<string, AppIconName> = {
  index: 'home',
  discover: 'discover',
  board: 'board',
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

function GlassSurface({
  children,
  style,
  interactive = false,
  solidFallback,
}: {
  children: ReactNode
  style?: object
  interactive?: boolean
  solidFallback: string
}) {
  const {scheme} = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const useNativeGlass = isLiquidGlassSupported && !reduceTransparency

  if (reduceTransparency) {
    return (
      <View style={[style, {backgroundColor: solidFallback, overflow: 'hidden'}]}>
        {children}
      </View>
    )
  }

  if (useNativeGlass) {
    return (
      <LiquidGlassView
        interactive={interactive}
        // Clear keeps the pill chrome without a heavy rectangular blur slab
        // that reads as "bottom progressive blur" tied to the tab bar.
        effect="clear"
        style={style}>
        {children}
      </LiquidGlassView>
    )
  }

  // Soft glass fallback when Callstack liquid glass isn't linked / supported.
  // Keep intensity low so shell edge dissolve owns the bottom fade.
  return (
    <BlurView
      intensity={42}
      tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={[style, {overflow: 'hidden', backgroundColor: 'transparent'}]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#FFFFFF',
            opacity: scheme === 'dark' ? 0.06 : 0.1,
          },
        ]}
      />
      {children}
    </BlurView>
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
  const {reduceTransparency} = useSystemAccessibility()
  const {preferences} = useProductPreferences()
  const [expanded, setExpanded] = useState(false)
  const mainTabScale = useSharedValue(1)
  const plusIconRotate = useSharedValue(0)
  const expandActions = EXPAND_ACTIONS.filter(
    action => !action.featureId || isFeatureEnabled(preferences, action.featureId),
  )

  const visibleTabs = MODULA_TABS.filter(tab =>
    state.routes.some(route => route.name === tab.routeName),
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

  const glassFallback = colours.surface
  const useNativeGlass = isLiquidGlassSupported && !reduceTransparency

  const Container = useNativeGlass ? LiquidGlassContainerView : View

  // Pin to physical bottom: 0 — safe-area is padding inside the glass so the
  // chrome reaches the screen edge (no black strip under the home indicator).
  const bottomPad = Math.max(insets.bottom, spacing[2])

  return (
    <Container
      style={[
        styles.container,
        {
          bottom: 0,
          paddingBottom: bottomPad,
          gap: spacing[3],
        },
      ]}
      {...(useNativeGlass ? {spacing: 16} : {})}>
      <Animated.View style={[mainTabStyle, styles.mainCluster]}>
        <GlassSurface
          solidFallback={glassFallback}
          style={[
            styles.liquidGlassView,
            {
              borderRadius: radius.xlarge,
              // Native liquid glass needs no stroke; BlurView fallback stays
              // borderless too so the pill reads as glass, not a solid card.
              borderColor: 'transparent',
              borderWidth: 0,
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
        </GlassSurface>
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
        <GlassSurface
          interactive
          solidFallback={colours.accent}
          style={[
            styles.plusButtonGlass,
            {
              borderRadius: radius.round,
              backgroundColor: useNativeGlass ? undefined : colours.accent,
            },
          ]}>
          <Animated.View style={plusIconStyle}>
            <AppIcon
              name="create"
              colour={
                useNativeGlass ? colours.text : colours.accentForeground
              }
              size={26}
            />
          </Animated.View>
        </GlassSurface>
      </Pressable>
    </Container>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: 'transparent',
    justifyContent: 'center',
    minHeight: FLOATING_TAB_BAR_SEGMENT_HEIGHT,
    overflow: 'hidden',
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
    height: 60,
    justifyContent: 'center',
    width: 60,
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
