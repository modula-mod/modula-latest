import type {
  AppearancePreferences,
  MotionTokens,
  SystemAccessibilityState,
} from '@/theme/contracts'

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  schemaVersion: 1,
  mode: 'system',
  family: 'standard',
  accentId: 'modulaTeal',
  customAccent: null,
  surfaceType: 'native',
  textScale: 1,
  boldText: false,
  reduceMotion: false,
  reduceTransparency: false,
  increaseContrast: false,
  showSwitchLabels: false,
}

export const DEFAULT_SYSTEM_ACCESSIBILITY: SystemAccessibilityState = {
  boldText: false,
  reduceMotion: false,
  reduceTransparency: false,
  increaseContrast: false,
  screenReaderEnabled: false,
  grayscaleEnabled: false,
  invertColoursEnabled: false,
}

export const DEFAULT_MOTION_TOKENS: MotionTokens = {
  instant: 0,
  fast: 140,
  normal: 200,
  slow: 280,
  pressScale: 0.98,
}

export const REDUCED_MOTION_TOKENS: MotionTokens = {
  instant: 0,
  fast: 0,
  normal: 0,
  slow: 0,
  pressScale: 1,
}
