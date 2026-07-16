import {Platform} from 'react-native'
import * as NavigationBar from 'expo-navigation-bar'
import * as SystemUI from 'expo-system-ui'

import type {ResolvedAppearance} from '@/theme/contracts'

let lastCanvas: string | null = null
let lastNavigationStyle: 'light' | 'dark' | null = null

export async function syncSystemUI(resolved: ResolvedAppearance): Promise<void> {
  const canvas = resolved.colours.canvas
  const navigationStyle = resolved.isDark ? 'light' : 'dark'

  try {
    if (lastCanvas !== canvas) {
      lastCanvas = canvas
      await SystemUI.setBackgroundColorAsync(canvas)
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('System UI background sync failed', error)
    }
  }

  if (Platform.OS !== 'android') {
    return
  }

  try {
    if (lastNavigationStyle !== navigationStyle) {
      lastNavigationStyle = navigationStyle
      NavigationBar.NavigationBar.setStyle(navigationStyle)
      NavigationBar.NavigationBar.setHidden(false)
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Android navigation bar sync failed', error)
    }
  }
}
