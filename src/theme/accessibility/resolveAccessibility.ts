import type {
  AppearancePreferences,
  SystemAccessibilityState,
} from '@/theme/contracts'
import {resolveAdaptivePreference} from '@/theme/accessibility/adaptivePreference'

export function resolveAccessibility(
  preferences: AppearancePreferences,
  systemAccessibility: SystemAccessibilityState,
) {
  const followSystemTextSize = preferences.textScalePreference.mode === 'system'
  const textScale =
    preferences.textScalePreference.mode === 'custom'
      ? preferences.textScalePreference.scale
      : 1

  return {
    boldText: resolveAdaptivePreference(
      preferences.boldText,
      systemAccessibility.boldText,
    ),
    reduceMotion: resolveAdaptivePreference(
      preferences.reduceMotion,
      systemAccessibility.reduceMotion,
    ),
    reduceTransparency: resolveAdaptivePreference(
      preferences.reduceTransparency,
      systemAccessibility.reduceTransparency,
    ),
    increaseContrast: resolveAdaptivePreference(
      preferences.increaseContrast,
      systemAccessibility.increaseContrast,
    ),
    differentiateWithoutColor: resolveAdaptivePreference(
      preferences.differentiateWithoutColor,
      systemAccessibility.differentiateWithoutColor,
    ),
    showSwitchLabels: resolveAdaptivePreference(
      preferences.showSwitchLabels,
      false,
    ),
    followSystemTextSize,
    textScale,
    screenReaderEnabled: systemAccessibility.screenReaderEnabled,
  }
}
