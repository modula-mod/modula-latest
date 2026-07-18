import {Tabs} from 'expo-router'
import {NativeTabs} from 'expo-router/unstable-native-tabs'
import type {ComponentType} from 'react'

import {isCallstackLiquidGlassNativeAvailable} from '@/platform/ui/navigation/liquid-glass-availability'
import type {ModulaLiquidGlassTabBarProps} from '@/platform/ui/navigation/modula-liquid-glass-tab-bar.types'
import {MODULA_TABS} from '@/platform/ui/navigation/modula-tabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type LiquidGlassTabBarComponent = ComponentType<ModulaLiquidGlassTabBarProps>

let cachedLiquidGlassTabBar: LiquidGlassTabBarComponent | null | undefined

/**
 * Lazily load the expandable liquid-glass tab bar only when the native module
 * is linked. A static import of `@callstack/liquid-glass` crashes Expo Go /
 * stale binaries at module evaluation time (`NativeLiquidGlassModule`).
 */
function getLiquidGlassTabBar(): LiquidGlassTabBarComponent | null {
  if (cachedLiquidGlassTabBar !== undefined) {
    return cachedLiquidGlassTabBar
  }

  if (!isCallstackLiquidGlassNativeAvailable()) {
    cachedLiquidGlassTabBar = null
    return null
  }

  try {
    // Dynamic require keeps @callstack/liquid-glass off the Expo Go bundle path.
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
 * Native tabs:
 * - Dev client / `expo run:ios` with pods → ModulaLiquidGlassTabBar
 *   (authorized rn-expandable-tab-liquid-glass pattern)
 * - Expo Go / missing NativeLiquidGlassModule → Expo Router NativeTabs fallback
 *
 * Create is not a tab destination — compose stays toolbar / expand action.
 */
export function PlatformTabs() {
  // Probe native module so PersistentShellTabBar and this navigator agree.
  if (getLiquidGlassTabBar()) {
    return <LiquidGlassPlatformTabs />
  }

  return <NativeTabsFallback />
}

function LiquidGlassPlatformTabs() {
  const {colours} = useThemeTokens()

  // Floating bar is owned by PersistentShellTabBar at the root so settings /
  // product / marketplace keep the same chrome. Avoid a second in-tabs bar.
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        sceneStyle: {backgroundColor: colours.canvas},
      }}>
      {MODULA_TABS.map(tab => (
        <Tabs.Screen
          key={tab.id}
          name={tab.routeName}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
          }}
        />
      ))}
      <Tabs.Screen name="create" options={{href: null}} />
    </Tabs>
  )
}

function NativeTabsFallback() {
  const {colours} = useThemeTokens()

  return (
    <NativeTabs
      tintColor={colours.accent}
      disableTransparentOnScrollEdge
      labelStyle={{
        default: {color: colours.textSecondary},
        selected: {color: colours.accent},
      }}
      iconColor={{
        default: colours.textSecondary,
        selected: colours.accent,
      }}>
      {MODULA_TABS.map(tab => (
        <NativeTabs.Trigger
          key={tab.id}
          name={tab.routeName}
          accessibilityLabel={tab.label}
          disableTransparentOnScrollEdge>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{
              default: tab.sfSymbol.default as never,
              selected: tab.sfSymbol.selected as never,
            }}
            md={tab.materialSymbol as never}
          />
        </NativeTabs.Trigger>
      ))}
      {/* File kept for route presence; never a visible destination. */}
      <NativeTabs.Trigger name="create" hidden />
    </NativeTabs>
  )
}
