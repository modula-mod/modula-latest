import * as Haptics from 'expo-haptics'
import {AccessibilityInfo, Platform} from 'react-native'

export type ModulaHaptic = 'selection' | 'success' | 'warning' | 'error' | 'impactLight'

async function hapticsAllowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  try {
    // Modula treats Reduce Motion as a conservative request to reduce optional
    // sensory feedback until a dedicated system haptics preference is exposed.
    return !(await AccessibilityInfo.isReduceMotionEnabled())
  } catch {
    return true
  }
}

export async function performSemanticHaptic(kind: ModulaHaptic): Promise<void> {
  try {
    if (!(await hapticsAllowed())) return
    if (kind === 'selection') {
      await Haptics.selectionAsync()
      return
    }
    if (kind === 'impactLight') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      return
    }
    const notification =
      kind === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : kind === 'warning'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error
    await Haptics.notificationAsync(notification)
  } catch {
    // Haptics are optional and never block an interaction.
  }
}

export const selectionHaptic = () => performSemanticHaptic('selection')
export const lightImpactHaptic = () => performSemanticHaptic('impactLight')
export const successHaptic = () => performSemanticHaptic('success')
export const warningHaptic = () => performSemanticHaptic('warning')
export const errorHaptic = () => performSemanticHaptic('error')
