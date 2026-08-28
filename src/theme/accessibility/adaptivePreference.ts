import type {
  SystemAdaptivePreference,
  TextScale,
  TextScalePreference,
} from '@/theme/contracts'

export const SYSTEM_ADAPTIVE_OPTIONS: {
  value: SystemAdaptivePreference
  label: string
}[] = [
  {value: 'system', label: 'System'},
  {value: 'on', label: 'On'},
  {value: 'off', label: 'Off'},
]

export function isSystemAdaptivePreference(
  value: unknown,
): value is SystemAdaptivePreference {
  return value === 'system' || value === 'on' || value === 'off'
}

export function migrateAdaptivePreference(
  value: unknown,
  fallback: SystemAdaptivePreference = 'system',
): SystemAdaptivePreference {
  if (isSystemAdaptivePreference(value)) return value
  if (value === true) return 'on'
  if (value === false) return 'system'
  return fallback
}

/**
 * Precedence: explicit Modula override → system preference → default off.
 */
export function resolveAdaptivePreference(
  preference: SystemAdaptivePreference,
  systemValue: boolean,
): boolean {
  if (preference === 'on') return true
  if (preference === 'off') return false
  return systemValue
}

export function adaptivePreferenceLabel(
  preference: SystemAdaptivePreference,
): string {
  if (preference === 'on') return 'On'
  if (preference === 'off') return 'Off'
  return 'System'
}

export function mergeAdaptivePreference(
  incoming: SystemAdaptivePreference,
  local: SystemAdaptivePreference,
): SystemAdaptivePreference {
  if (incoming === 'on') return 'on'
  if (local === 'off') return 'off'
  return incoming
}

export function textScaleLabel(preference: TextScalePreference): string {
  if (preference.mode === 'system') return 'System'
  return customTextScaleLabel(preference.scale)
}

export function customTextScaleLabel(scale: TextScale): string {
  switch (scale) {
    case 0.9:
      return 'Small'
    case 1:
      return 'Default'
    case 1.1:
      return 'Large'
    case 1.2:
      return 'Extra Large'
    case 1.3:
      return 'Accessibility'
    default:
      return 'Default'
  }
}

export function encodeAdaptiveForGreenfield(
  preference: SystemAdaptivePreference,
): boolean {
  return preference === 'on'
}

export function encodeTextScaleForGreenfield(
  preference: TextScalePreference,
): TextScale {
  return preference.mode === 'custom' ? preference.scale : 1
}
