import {useAppearance} from '@/theme/runtime/useAppearance'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'

/**
 * Canonical accessibility adapter. Screens should read this (or theme tokens)
 * instead of calling AccessibilityInfo directly.
 */
export function useModulaAccessibility() {
  const {preferences, resolved, systemAccessibility} = useAppearance()
  return {
    preferences,
    resolved: resolved.accessibility,
    system: systemAccessibility,
  }
}

export {useSystemAccessibility}
export {
  adaptivePreferenceLabel,
  resolveAdaptivePreference,
  textScaleLabel,
} from '@/theme/accessibility/adaptivePreference'
export {useReduceMotion} from '@/lib/accessibility'
