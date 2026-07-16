import {requireOptionalNativeModule} from 'expo'

/**
 * Hides the Expo Dev Client floating tools FAB (blue/grey gear bubble) on
 * product surfaces. Dev menu remains available via shake / three-finger long press.
 *
 * Config plugin `toolsButton: false` requires a native rebuild; this runtime
 * preference covers already-built binaries without remounting any JS gear.
 */
export function hideExpoDevToolsButton(): void {
  try {
    const DevMenuPreferences = requireOptionalNativeModule<{
      setPreferencesAsync?: (prefs: {
        showFloatingActionButton?: boolean
      }) => Promise<void>
    }>('DevMenuPreferences')

    void DevMenuPreferences?.setPreferencesAsync?.({
      showFloatingActionButton: false,
    })
  } catch {
    // Expo Go / production builds without expo-dev-menu — no-op.
  }
}
