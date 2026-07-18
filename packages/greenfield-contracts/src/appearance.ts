/**
 * Appearance preferences belong to the Greenfield account and synchronise
 * across devices. Local storage may cache them but is not authoritative after sign-in.
 */
export type GreenfieldAppearanceMode =
  | 'system'
  | 'light'
  | 'dim'
  | 'dark'
  | 'oled'

export type GreenfieldAppearanceVariant =
  | 'standard'
  | 'forest'
  | 'ocean'
  | 'plum'
  | 'espresso'
  | 'spaceGray'

export type GreenfieldAppearanceSurface =
  | 'native'
  | 'solid'
  | 'glass'
  | 'glay'
  | 'minimalSpatial'
  | 'skeuomorphic'
  | 'neomorphic'

export type GreenfieldAppearancePreferences = {
  mode: GreenfieldAppearanceMode
  variant: GreenfieldAppearanceVariant
  surface: GreenfieldAppearanceSurface
  accentId: string
  customAccent: string | null
  textScale: number
  boldText: boolean
  reduceMotion: boolean
  reduceTransparency: boolean
  increaseContrast: boolean
  /** Monotonic preference version for optimistic concurrency. */
  version: number
  updatedAt: string
}

export type GreenfieldAppearanceUpdateInput = {
  mode?: GreenfieldAppearanceMode
  variant?: GreenfieldAppearanceVariant
  surface?: GreenfieldAppearanceSurface
  accentId?: string
  customAccent?: string | null
  textScale?: number
  boldText?: boolean
  reduceMotion?: boolean
  reduceTransparency?: boolean
  increaseContrast?: boolean
  /** When provided, server rejects stale writes. */
  expectedVersion?: number
}

export const GREENFIELD_APPEARANCE_TEXT_SCALE_MIN = 0.85
export const GREENFIELD_APPEARANCE_TEXT_SCALE_MAX = 1.6
