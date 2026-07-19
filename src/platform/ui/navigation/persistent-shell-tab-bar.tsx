import {usePathname, useRouter, useSegments, type Href} from 'expo-router'
import type {ComponentType} from 'react'

import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import type {ModulaLiquidGlassTabBarProps} from '@/platform/ui/navigation/modula-liquid-glass-tab-bar.types'
import {MODULA_TABS} from '@/platform/ui/navigation/modula-tabs'
import {
  hrefForShellTab,
  resolveShellTabRouteName,
  shouldHideShellTabBar,
} from '@/platform/ui/navigation/shell-tab-bar-visibility'

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

  if (!TabBar) return null
  if (shouldHideShellTabBar(segments)) return null

  const selectedRouteName = resolveShellTabRouteName(pathname)
  const enabledIds = new Set(preferences.tabBarIds)
  const routes = MODULA_TABS.filter(
    tab => enabledIds.has(tab.id) || tab.routeName === selectedRouteName,
  ).map(tab => ({
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

  return <TabBar state={{index, routes}} navigation={navigation} />
}
