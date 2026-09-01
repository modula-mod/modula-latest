import type {AccentTokens, SemanticColours} from '@/theme/contracts/colours'
import type {MaterialTokenMap, MotionTokens} from '@/theme/contracts/materials'
import type {TypographyTokens} from '@/theme/contracts/typography'

export type AppearanceMode = 'system' | 'light' | 'dim' | 'dark' | 'oled'

export type ResolvedAppearanceMode = 'light' | 'dim' | 'dark' | 'oled'

export type ThemeFamily =
  | 'standard'
  | 'forest'
  | 'ocean'
  | 'plum'
  | 'espresso'
  | 'spaceGray'

export type AccentId =
  | 'modulaTeal'
  | 'electricCyan'
  | 'vividViolet'
  | 'neonMint'
  | 'sunsetOrange'
  | 'crimsonFlash'
  | 'lemonSpark'
  | 'rosePetal'
  | 'custom'

export type SurfaceType =
  | 'native'
  | 'solid'
  | 'glass'
  | 'glay'
  | 'minimalSpatial'
  | 'skeuomorphic'
  | 'neomorphic'

export type TextScale = 0.9 | 1 | 1.1 | 1.2 | 1.3

/**
 * Modula override for a system accessibility preference.
 * `system` means follow the operating-system setting — not factory default.
 */
export type SystemAdaptivePreference = 'system' | 'on' | 'off'

/**
 * Text size: follow OS Dynamic Type, or apply a Modula-only scale.
 */
export type TextScalePreference =
  | {mode: 'system'}
  | {mode: 'custom'; scale: TextScale}

/** Preview chrome effects under Appearance → Advanced. */
export type AdvancedChromeEffect = 'off' | 'cameraMaskedBlur'

export type SettingsIconDomain =
  | 'profile'
  | 'account'
  | 'notifications'
  | 'privacy'
  | 'data'
  | 'appearance'
  | 'accessibility'
  | 'language'
  | 'modules'
  | 'security'
  | 'developer'
  | 'content'
  | 'connections'
  | 'info'
  | 'hearing'
  | 'speech'
  | 'interaction'

export type SettingsIconToken = {
  background: string
  foreground: string
}

export type SettingsIconTokens = Record<SettingsIconDomain, SettingsIconToken>

export type AppearancePreferences = {
  schemaVersion: 2
  mode: AppearanceMode
  family: ThemeFamily
  accentId: AccentId
  customAccent: string | null
  surfaceType: SurfaceType
  /** Last custom scale (Greenfield wire). Ignored when textScalePreference is system. */
  textScale: TextScale
  textScalePreference: TextScalePreference
  boldText: SystemAdaptivePreference
  reduceMotion: SystemAdaptivePreference
  reduceTransparency: SystemAdaptivePreference
  increaseContrast: SystemAdaptivePreference
  differentiateWithoutColor: SystemAdaptivePreference
  /** On/Off switch labels. Local-only; no public OS detection API in RN 0.86. */
  showSwitchLabels: SystemAdaptivePreference
  /**
   * Living camera cutout chrome (Motionary-style masked blur).
   * Preview / local preference — not yet a Greenfield sync field.
   */
  advancedChromeEffect: AdvancedChromeEffect
}

export type SystemAccessibilityState = {
  boldText: boolean
  reduceMotion: boolean
  reduceTransparency: boolean
  increaseContrast: boolean
  screenReaderEnabled: boolean
  grayscaleEnabled: boolean
  invertColoursEnabled: boolean
  /**
   * iOS Differentiate Without Color is not exposed by React Native
   * AccessibilityInfo. Always false until a public API exists.
   */
  differentiateWithoutColor: boolean
}

export type ResolvedAccessibility = {
  boldText: boolean
  reduceMotion: boolean
  reduceTransparency: boolean
  increaseContrast: boolean
  differentiateWithoutColor: boolean
  showSwitchLabels: boolean
  followSystemTextSize: boolean
  textScale: TextScale
  screenReaderEnabled: boolean
}

export type ResolvedAppearance = {
  preferences: AppearancePreferences
  resolvedMode: ResolvedAppearanceMode
  resolvedFamily: ThemeFamily
  isDark: boolean
  isOLED: boolean
  accessibility: ResolvedAccessibility
  colours: SemanticColours
  accent: AccentTokens
  typography: TypographyTokens
  materials: MaterialTokenMap
  motion: MotionTokens
  settingsIcons: SettingsIconTokens
}

export const APPEARANCE_MODES = [
  'system',
  'light',
  'dim',
  'dark',
  'oled',
] as const satisfies readonly AppearanceMode[]

export const RESOLVED_APPEARANCE_MODES = [
  'light',
  'dim',
  'dark',
  'oled',
] as const satisfies readonly ResolvedAppearanceMode[]

export const THEME_FAMILIES = [
  'standard',
  'forest',
  'ocean',
  'plum',
  'espresso',
  'spaceGray',
] as const satisfies readonly ThemeFamily[]

export const ACCENT_IDS = [
  'modulaTeal',
  'electricCyan',
  'vividViolet',
  'neonMint',
  'sunsetOrange',
  'crimsonFlash',
  'lemonSpark',
  'rosePetal',
  'custom',
] as const satisfies readonly AccentId[]

export const SURFACE_TYPES = [
  'native',
  'solid',
  'glass',
  'glay',
  'minimalSpatial',
  'skeuomorphic',
  'neomorphic',
] as const satisfies readonly SurfaceType[]

export const TEXT_SCALES = [0.9, 1, 1.1, 1.2, 1.3] as const satisfies readonly TextScale[]

export const SYSTEM_ADAPTIVE_PREFERENCES = [
  'system',
  'on',
  'off',
] as const satisfies readonly SystemAdaptivePreference[]

export const SETTINGS_ICON_DOMAINS = [
  'profile',
  'account',
  'notifications',
  'privacy',
  'data',
  'appearance',
  'accessibility',
  'language',
  'modules',
  'security',
  'developer',
  'content',
  'connections',
  'info',
  'hearing',
  'speech',
  'interaction',
] as const satisfies readonly SettingsIconDomain[]

export const ADVANCED_CHROME_EFFECTS = [
  'off',
  'cameraMaskedBlur',
] as const satisfies readonly AdvancedChromeEffect[]
