import Constants, {ExecutionEnvironment} from 'expo-constants'
import {TurboModuleRegistry} from 'react-native'

/**
 * Safe probe for `@callstack/liquid-glass` native binary.
 *
 * IMPORTANT: Only use the non-throwing TurboModuleRegistry lookup here.
 * The enforcing registry API throws and white-screens Expo Go / stale native
 * builds when the binary is missing (often at package import time).
 *
 * Full liquid-glass expandable tabs require a custom native rebuild:
 *   cd ios && pod install && cd ..
 *   pnpm exec expo run:ios
 * Expo Go always uses the NativeTabs fallback.
 */
export function isCallstackLiquidGlassNativeAvailable(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false
  }

  try {
    // Non-enforcing lookup — returns null when the module is not linked.
    const nativeModule = TurboModuleRegistry.get('NativeLiquidGlassModule')
    return nativeModule != null
  } catch {
    return false
  }
}
