import {createContext} from 'react'

import type {
  AccentId,
  AdvancedChromeEffect,
  AppearanceMode,
  SurfaceType,
  SystemAdaptivePreference,
  TextScale,
  TextScalePreference,
  ThemeFamily,
  WebPresentation,
} from '@/theme/contracts'

export type AppearanceActionsContextValue = {
  setMode: (mode: AppearanceMode) => void
  setThemeFamily: (family: ThemeFamily) => void
  setAccent: (accentId: AccentId) => void
  setCustomAccent: (hex: string) => void
  setSurfaceType: (surfaceType: SurfaceType) => void
  setWebPresentation: (presentation: WebPresentation) => void
  setTextScale: (scale: TextScale) => void
  setTextScalePreference: (preference: TextScalePreference) => void
  setBoldText: (value: SystemAdaptivePreference) => void
  setReduceMotion: (value: SystemAdaptivePreference) => void
  setReduceTransparency: (value: SystemAdaptivePreference) => void
  setIncreaseContrast: (value: SystemAdaptivePreference) => void
  setDifferentiateWithoutColor: (value: SystemAdaptivePreference) => void
  setShowSwitchLabels: (value: SystemAdaptivePreference) => void
  setAdvancedChromeEffect: (effect: AdvancedChromeEffect) => void
  resetAppearance: () => void
}

export const AppearanceActionsContext =
  createContext<AppearanceActionsContextValue | null>(null)
