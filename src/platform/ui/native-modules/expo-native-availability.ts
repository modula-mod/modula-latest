import {requireOptionalNativeModule} from 'expo'
import {TurboModuleRegistry} from 'react-native'

/**
 * Safe probes for native modules that crash on static import when the
 * current binary was built before the dependency was admitted.
 *
 * Rebuild path after admitting expo-camera / expo-video / Skia:
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

/**
 * `@shopify/react-native-skia` uses TurboModuleRegistry.getEnforcing('RNSkiaModule')
 * at import time — never statically import Skia until this returns true.
 */
export function isReactNativeSkiaNativeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('RNSkiaModule') != null
  } catch {
    return false
  }
}
