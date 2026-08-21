import * as Haptics from 'expo-haptics'

export async function selectionHaptic(): Promise<void> {
  try {
    await Haptics.selectionAsync()
  } catch {
    // Haptics are optional in Phase 1.
  }
}

export async function lightImpactHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  } catch {
    // Haptics are optional in Phase 1.
  }
}

export async function successHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch {
    // Haptics are optional and silent on web.
  }
}
