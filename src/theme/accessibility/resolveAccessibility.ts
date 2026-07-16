import type {AppearancePreferences, SystemAccessibilityState} from '@/theme/contracts'

export function resolveAccessibility(
  preferences: AppearancePreferences,
  systemAccessibility: SystemAccessibilityState,
) {
  return {
    boldText: systemAccessibility.boldText || preferences.boldText,
    reduceMotion: systemAccessibility.reduceMotion || preferences.reduceMotion,
    reduceTransparency:
      systemAccessibility.reduceTransparency || preferences.reduceTransparency,
    increaseContrast:
      systemAccessibility.increaseContrast || preferences.increaseContrast,
    screenReaderEnabled: systemAccessibility.screenReaderEnabled,
  }
}
