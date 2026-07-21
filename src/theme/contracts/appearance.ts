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

/** Preview chrome effects under Appearance → Advanced. */
export type AdvancedChromeEffect = 'off' | 'cameraMaskedBlur'

export type AppearancePreferences = {
  schemaVersion: 1
  mode: AppearanceMode
  family: ThemeFamily
  accentId: AccentId
  customAccent: string | null
  surfaceType: SurfaceType
  textScale: TextScale
  boldText: boolean
  reduceMotion: boolean
  reduceTransparency: boolean
  increaseContrast: boolean
  showSwitchLabels: boolean
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
}

export type ResolvedAppearance = {
  preferences: AppearancePreferences
  resolvedMode: ResolvedAppearanceMode
  resolvedFamily: ThemeFamily
  isDark: boolean
  isOLED: boolean
  accessibility: {
    boldText: boolean
    reduceMotion: boolean
    reduceTransparency: boolean
    increaseContrast: boolean
    screenReaderEnabled: boolean
  }
  colours: SemanticColours
  accent: AccentTokens
  typography: TypographyTokens
  materials: MaterialTokenMap
  motion: MotionTokens
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

export const ADVANCED_CHROME_EFFECTS = [
  'off',
  'cameraMaskedBlur',
] as const satisfies readonly AdvancedChromeEffect[]
