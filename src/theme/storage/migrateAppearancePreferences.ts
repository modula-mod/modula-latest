import type {
  AccentId,
  AppearanceMode,
  AppearancePreferences,
  SurfaceType,
  TextScale,
  ThemeFamily,
} from '@/theme/contracts'
import {
  ACCENT_IDS,
  APPEARANCE_MODES,
  SURFACE_TYPES,
  TEXT_SCALES,
  THEME_FAMILIES,
} from '@/theme/contracts'
import {expandHexColour} from '@/theme/accents/colourMath'
import {DEFAULT_APPEARANCE_PREFERENCES} from '@/theme/data/defaults'

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return APPEARANCE_MODES.includes(value as AppearanceMode)
}

export function isThemeFamily(value: unknown): value is ThemeFamily {
  return THEME_FAMILIES.includes(value as ThemeFamily)
}

export function isAccentId(value: unknown): value is AccentId {
  return ACCENT_IDS.includes(value as AccentId)
}

export function isSurfaceType(value: unknown): value is SurfaceType {
  return SURFACE_TYPES.includes(value as SurfaceType)
}

export function isTextScale(value: unknown): value is TextScale {
  return TEXT_SCALES.includes(value as TextScale)
}

export function isValidStoredHexColour(value: unknown): value is string {
  return typeof value === 'string' && expandHexColour(value) !== null
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function migrateAppearancePreferences(
  input: unknown,
): AppearancePreferences {
  if (!input || typeof input !== 'object') {
    return DEFAULT_APPEARANCE_PREFERENCES
  }

  const candidate = input as Record<string, unknown>
  const schemaVersion =
    candidate.schemaVersion === 1
      ? 1
      : DEFAULT_APPEARANCE_PREFERENCES.schemaVersion
  const defaults = DEFAULT_APPEARANCE_PREFERENCES
  const customAccent = isValidStoredHexColour(candidate.customAccent)
    ? expandHexColour(candidate.customAccent)
    : null

  return {
    schemaVersion,
    mode: isAppearanceMode(candidate.mode) ? candidate.mode : defaults.mode,
    family: isThemeFamily(candidate.family) ? candidate.family : defaults.family,
    accentId: isAccentId(candidate.accentId)
      ? candidate.accentId
      : defaults.accentId,
    customAccent,
    surfaceType: isSurfaceType(candidate.surfaceType)
      ? candidate.surfaceType
      : defaults.surfaceType,
    textScale: isTextScale(candidate.textScale)
      ? candidate.textScale
      : defaults.textScale,
    boldText: booleanOrDefault(candidate.boldText, defaults.boldText),
    reduceMotion: booleanOrDefault(
      candidate.reduceMotion,
      defaults.reduceMotion,
    ),
    reduceTransparency: booleanOrDefault(
      candidate.reduceTransparency,
      defaults.reduceTransparency,
    ),
    increaseContrast: booleanOrDefault(
      candidate.increaseContrast,
      defaults.increaseContrast,
    ),
    showSwitchLabels: booleanOrDefault(
      candidate.showSwitchLabels,
      defaults.showSwitchLabels,
    ),
  }
}
