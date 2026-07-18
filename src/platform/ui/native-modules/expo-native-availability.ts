import {requireOptionalNativeModule} from 'expo'

/**
 * Safe probes for Expo native modules that crash on static import when the
 * current binary was built before the dependency was admitted.
 *
 * Rebuild path after admitting expo-camera / expo-video:
 *   cd ios && pod install && cd ..
 *   pnpm exec expo run:ios
 */

export function isExpoCameraNativeAvailable(): boolean {
  try {
    return requireOptionalNativeModule('ExpoCamera') != null
  } catch {
    return false
  }
}

export function isExpoVideoNativeAvailable(): boolean {
  try {
    return requireOptionalNativeModule('ExpoVideo') != null
  } catch {
    return false
  }
}
