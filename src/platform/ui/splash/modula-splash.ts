import {Platform} from 'react-native'
import * as SplashScreen from 'expo-splash-screen'

/**
 * Modula branded splash — native cold-start via expo-splash-screen, plus a JS
 * brand overlay for a calm exit. Pattern studied from react-native-custom-splash
 * (logo + backgroundColor + hide API); implemented on admitted Expo deps only.
 */

let preventPromise: Promise<void> | null = null

export function prepareModulaSplash(): Promise<void> {
  if (Platform.OS === 'web') {
    return Promise.resolve()
  }
  if (!preventPromise) {
    preventPromise = SplashScreen.preventAutoHideAsync()
      .then(() => undefined)
      .catch(() => undefined)
  }
  return preventPromise
}

export async function hideNativeSplash(): Promise<void> {
  if (Platform.OS === 'web') return
  try {
    await SplashScreen.hideAsync()
  } catch {
    // No-op when splash was never shown.
  }
}
