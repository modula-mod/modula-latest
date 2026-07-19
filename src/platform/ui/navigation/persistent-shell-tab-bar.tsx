import {usePathname, useRouter, useSegments, type Href} from 'expo-router'
import {useState, type ComponentType} from 'react'
import {StyleSheet} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated'

import {resolveVisibleModulaTabs} from '@/features/product/data/resolveTabBar'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import type {ModulaLiquidGlassTabBarProps} from '@/platform/ui/navigation/modula-liquid-glass-tab-bar.types'
import {shellChromeObscureAmount} from '@/platform/ui/navigation/shell-chrome-obscure'
import {
  hrefForShellTab,
  resolveShellTabRouteName,
  shouldHideShellTabBar,
} from '@/platform/ui/navigation/shell-tab-bar-visibility'
import {useShellChromeObscureStyle} from '@/platform/ui/navigation/use-shell-chrome-obscure-style'

type LiquidGlassTabBarComponent = ComponentType<ModulaLiquidGlassTabBarProps>

let cachedLiquidGlassTabBar: LiquidGlassTabBarComponent | null | undefined

function getLiquidGlassTabBar(): LiquidGlassTabBarComponent | null {
  if (cachedLiquidGlassTabBar !== undefined) {
    return cachedLiquidGlassTabBar
  }
  if (!isCallstackLiquidGlassNativeAvailable()) {
    cachedLiquidGlassTabBar = null
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/platform/ui/navigation/modula-liquid-glass-tab-bar') as {
      ModulaLiquidGlassTabBar: LiquidGlassTabBarComponent
    }
    cachedLiquidGlassTabBar = mod.ModulaLiquidGlassTabBar
  } catch {
    cachedLiquidGlassTabBar = null
  }
  return cachedLiquidGlassTabBar
}

/**
 * Root-level floating tab bar so secondary stacks (settings, product, …)
 * keep the same bottom chrome as the main tabs.
 *
 * Only mounts when the liquid-glass tab bar native module is available.
 * Expo Go / NativeTabs fallback keeps its in-navigator bar on tab routes only.
 */
export function PersistentShellTabBar() {
  const pathname = usePathname()
  const segments = useSegments()
  const router = useRouter()
  const {preferences} = useProductPreferences()
  const TabBar = getLiquidGlassTabBar()
  const obscureStyle = useShellChromeObscureStyle('down')
  const [visible, setVisible] = useState(true)

  useAnimatedReaction(
    () => shellChromeObscureAmount(),
    value => {
      // Native liquid-glass often ignores ancestor opacity — unmount when pulled.
      runOnJS(setVisible)(value < 0.2)
    },
    [],
  )

  if (!TabBar) return null
  if (shouldHideShellTabBar(segments)) return null

  const selectedRouteName = resolveShellTabRouteName(pathname)
  const routes = resolveVisibleModulaTabs(preferences.tabBarIds, {
    alwaysIncludeRouteName: selectedRouteName,
  }).map(tab => ({
    key: tab.routeName,
    name: tab.routeName,
  }))
  const index = selectedRouteName
    ? Math.max(
        0,
        routes.findIndex(route => route.name === selectedRouteName),
      )
    : -1

  const navigation: ModulaLiquidGlassTabBarProps['navigation'] = {
    emit: () => ({defaultPrevented: false}),
    navigate: (name: string) => {
      router.navigate(hrefForShellTab(name) as Href)
    },
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.wrap, obscureStyle]}>
      {visible ? (
        <TabBar state={{index, routes}} navigation={navigation} />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
})
