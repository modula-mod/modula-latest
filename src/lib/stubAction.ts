import {Alert, Platform} from 'react-native'

/** Lightweight stub for actions without a backend yet. */
export function stubAction(feature: string): void {
  const message = `${feature} — coming soon in a later phase.`
  if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
    globalThis.alert(message)
    return
  }
  Alert.alert('Modula', message)
}
