import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router'
import {NativeTabs} from 'expo-router/unstable-native-tabs'
import {DynamicColorIOS, Platform} from 'react-native'

import {isTabEnabled} from '@/features/product/data/resolveTabBar'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {MODULA_TABS} from '@/platform/ui/navigation/modula-tabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Unselected tab glyphs follow the system interface style so Liquid Glass can
 * invert over light and dark content. Selected state stays Modula teal.
 *
 * Reference: https://docs.expo.dev/router/advanced/native-tabs/
 */
const iosAdaptiveIcon =
  Platform.OS === 'ios'
    ? DynamicColorIOS({
        dark: 'rgb(235, 235, 245)',
        light: 'rgb(60, 60, 67)',
      })
    : undefined

/**
 * Shell tabs are Expo Router NativeTabs — UITabBarController on iOS, which is
 * the Liquid Glass tab bar when built with Xcode 26.
 *
 * Do not wrap this in a custom floating pill. Do not set `backgroundColor`,
 * `blurEffect`, or `disableTransparentOnScrollEdge` — those only affect iOS 18
 * and they kill iOS 26 transparency.
 *
 * Create is hidden (compose lives in the Home header as `/compose`). Hidden
 * NativeTabs routes cannot be focused, so Board is a root stack screen, not a
 * hidden trigger.
 */
export function PlatformTabs() {
  const {scheme, colours} = useThemeTokens()
  const {preferences} = useProductPreferences()
  const defaultIcon = iosAdaptiveIcon ?? colours.textSecondary
  const navigationTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colours.canvas,
      card: colours.canvas,
      primary: colours.accent,
      text: colours.text,
      border: colours.border,
    },
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={colours.accent}
        labelStyle={{
          default: {color: defaultIcon},
          selected: {color: colours.accent},
        }}
        iconColor={{
          default: defaultIcon,
          selected: colours.accent,
        }}>
        {MODULA_TABS.map(tab => {
          const hidden =
            tab.id === 'create' || !isTabEnabled(preferences.tabBarIds, tab.id)
          return (
            <NativeTabs.Trigger
              key={tab.id}
              name={tab.routeName}
              accessibilityLabel={tab.label}
              hidden={hidden}>
              <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon
                sf={{
                  default: tab.sfSymbol.default as never,
                  selected: tab.sfSymbol.selected as never,
                }}
                md={tab.materialSymbol as never}
              />
            </NativeTabs.Trigger>
          )
        })}
      </NativeTabs>
    </NavigationThemeProvider>
  )
}
