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
  advancedChromeEffect: 'off',
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
  springs: {
    press: {damping: 28, stiffness: 420, mass: 0.7},
    selection: {damping: 24, stiffness: 320, mass: 0.8},
    sheet: {damping: 26, stiffness: 280, mass: 0.9},
    drawer: {damping: 30, stiffness: 260, mass: 1},
    navigation: {damping: 28, stiffness: 300, mass: 0.85},
    celebration: {damping: 16, stiffness: 220, mass: 0.75},
  },
}

export const REDUCED_MOTION_TOKENS: MotionTokens = {
  instant: 0,
  fast: 0,
  normal: 0,
  slow: 0,
  pressScale: 1,
  springs: {
    press: {damping: 100, stiffness: 1000, mass: 1},
    selection: {damping: 100, stiffness: 1000, mass: 1},
    sheet: {damping: 100, stiffness: 1000, mass: 1},
    drawer: {damping: 100, stiffness: 1000, mass: 1},
    navigation: {damping: 100, stiffness: 1000, mass: 1},
    celebration: {damping: 100, stiffness: 1000, mass: 1},
  },
}
