import type {
  AccentId,
  AdvancedChromeEffect,
  AppearanceMode,
  AppearancePreferences,
  SurfaceType,
  SystemAdaptivePreference,
  TextScale,
  TextScalePreference,
  ThemeFamily,
  WebPresentation,
} from '@/theme/contracts'
import {
  ACCENT_IDS,
  ADVANCED_CHROME_EFFECTS,
  APPEARANCE_MODES,
  SURFACE_TYPES,
  TEXT_SCALES,
  THEME_FAMILIES,
  WEB_PRESENTATIONS,
} from '@/theme/contracts'
import {expandHexColour} from '@/theme/accents/colourMath'
import {migrateAdaptivePreference} from '@/theme/accessibility/adaptivePreference'
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

export function isWebPresentation(value: unknown): value is WebPresentation {
  return WEB_PRESENTATIONS.includes(value as WebPresentation)
}

export function isTextScale(value: unknown): value is TextScale {
  return TEXT_SCALES.includes(value as TextScale)
}

export function isAdvancedChromeEffect(
  value: unknown,
): value is AdvancedChromeEffect {
  return ADVANCED_CHROME_EFFECTS.includes(value as AdvancedChromeEffect)
}

export function isValidStoredHexColour(value: unknown): value is string {
  return typeof value === 'string' && expandHexColour(value) !== null
}

function migrateTextScalePreference(
  candidate: Record<string, unknown>,
  defaults: AppearancePreferences,
): TextScalePreference {
  const raw = candidate.textScalePreference
  if (raw && typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    if (row.mode === 'system') return {mode: 'system'}
    if (row.mode === 'custom' && isTextScale(row.scale)) {
      return {mode: 'custom', scale: row.scale}
    }
  }
  if (candidate.textScaleMode === 'system') return {mode: 'system'}
  if (candidate.textScaleMode === 'custom' && isTextScale(candidate.textScale)) {
    return {mode: 'custom', scale: candidate.textScale}
  }
  if (isTextScale(candidate.textScale) && candidate.textScale !== 1) {
    return {mode: 'custom', scale: candidate.textScale}
  }
  return defaults.textScalePreference
}

export function migrateAppearancePreferences(
  input: unknown,
): AppearancePreferences {
  if (!input || typeof input !== 'object') {
    return DEFAULT_APPEARANCE_PREFERENCES
  }

  const candidate = input as Record<string, unknown>
  const defaults = DEFAULT_APPEARANCE_PREFERENCES
  const customAccent = isValidStoredHexColour(candidate.customAccent)
    ? expandHexColour(candidate.customAccent)
    : null
  const textScalePreference = migrateTextScalePreference(candidate, defaults)
  const textScale = isTextScale(candidate.textScale)
    ? candidate.textScale
    : textScalePreference.mode === 'custom'
      ? textScalePreference.scale
      : defaults.textScale

  return {
    schemaVersion: 2,
    mode: isAppearanceMode(candidate.mode) ? candidate.mode : defaults.mode,
    family: isThemeFamily(candidate.family) ? candidate.family : defaults.family,
    accentId: isAccentId(candidate.accentId)
      ? candidate.accentId
      : defaults.accentId,
    customAccent,
    surfaceType: isSurfaceType(candidate.surfaceType)
      ? candidate.surfaceType
      : defaults.surfaceType,
    webPresentation: isWebPresentation(candidate.webPresentation)
      ? candidate.webPresentation
      : defaults.webPresentation,
    textScale,
    textScalePreference,
    boldText: migrateAdaptivePreference(candidate.boldText, defaults.boldText),
    reduceMotion: migrateAdaptivePreference(
      candidate.reduceMotion,
      defaults.reduceMotion,
    ),
    reduceTransparency: migrateAdaptivePreference(
      candidate.reduceTransparency,
      defaults.reduceTransparency,
    ),
    increaseContrast: migrateAdaptivePreference(
      candidate.increaseContrast,
      defaults.increaseContrast,
    ),
    differentiateWithoutColor: migrateAdaptivePreference(
      candidate.differentiateWithoutColor,
      defaults.differentiateWithoutColor,
    ),
    showSwitchLabels: migrateAdaptivePreference(
      candidate.showSwitchLabels,
      defaults.showSwitchLabels,
    ),
    advancedChromeEffect: isAdvancedChromeEffect(candidate.advancedChromeEffect)
      ? candidate.advancedChromeEffect
      : defaults.advancedChromeEffect,
  }
}

export function mergeLocalAdaptivePreferences(
  server: AppearancePreferences,
  local: AppearancePreferences,
): AppearancePreferences {
  const merge = (
    incoming: SystemAdaptivePreference,
    current: SystemAdaptivePreference,
  ): SystemAdaptivePreference => {
    if (incoming === 'on') return 'on'
    if (current === 'off') return 'off'
    return incoming
  }

  return {
    ...server,
    webPresentation: local.webPresentation,
    advancedChromeEffect: local.advancedChromeEffect,
    showSwitchLabels: local.showSwitchLabels,
    differentiateWithoutColor: local.differentiateWithoutColor,
    textScalePreference:
      local.textScalePreference.mode === 'custom'
        ? local.textScalePreference
        : server.textScalePreference,
    textScale:
      local.textScalePreference.mode === 'custom'
        ? local.textScale
        : server.textScale,
    boldText: merge(server.boldText, local.boldText),
    reduceMotion: merge(server.reduceMotion, local.reduceMotion),
    reduceTransparency: merge(server.reduceTransparency, local.reduceTransparency),
    increaseContrast: merge(server.increaseContrast, local.increaseContrast),
  }
}
