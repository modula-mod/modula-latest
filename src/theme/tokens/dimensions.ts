/**
 * Theme Architecture dimensions (product §18 / Theme Architecture v5 adaptation).
 * Independent axes compose into one resolved ThemeTokens object.
 */

export type ColourModePreference = 'system' | 'light' | 'dim' | 'dark' | 'oled'

/** Resolved after system preference is applied. */
export type ResolvedColourMode = 'light' | 'dim' | 'dark' | 'oled'

export type ThemeFamilyId =
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

export type SurfaceTypeId =
  | 'native'
  | 'solid'
  | 'glass'
  | 'glay'
  | 'minimalSpatial'
  | 'skeuo'
  | 'neo'

export type ThemePreferences = {
  colourMode: ColourModePreference
  family: ThemeFamilyId
  accent: AccentId
  surfaceType: SurfaceTypeId
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  colourMode: 'system',
  family: 'standard',
  accent: 'modulaTeal',
  surfaceType: 'solid',
}

export const ACCENT_HEX: Record<AccentId, string> = {
  modulaTeal: '#369CAA',
  electricCyan: '#22D3EE',
  vividViolet: '#8B5CF6',
  neonMint: '#34D399',
  sunsetOrange: '#F97316',
  crimsonFlash: '#EF4444',
  lemonSpark: '#EAB308',
  rosePetal: '#F472B6',
}
