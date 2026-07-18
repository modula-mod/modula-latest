import {createContext} from 'react'

import type {
  AccentId,
  AdvancedChromeEffect,
  AppearanceMode,
  SurfaceType,
  TextScale,
  ThemeFamily,
} from '@/theme/contracts'

export type AppearanceActionsContextValue = {
  setMode: (mode: AppearanceMode) => void
  setThemeFamily: (family: ThemeFamily) => void
  setAccent: (accentId: AccentId) => void
  setCustomAccent: (hex: string) => void
  setSurfaceType: (surfaceType: SurfaceType) => void
  setTextScale: (scale: TextScale) => void
  setBoldText: (enabled: boolean) => void
  setReduceMotion: (enabled: boolean) => void
  setReduceTransparency: (enabled: boolean) => void
  setIncreaseContrast: (enabled: boolean) => void
  setShowSwitchLabels: (enabled: boolean) => void
  setAdvancedChromeEffect: (effect: AdvancedChromeEffect) => void
  resetAppearance: () => void
}

export const AppearanceActionsContext =
  createContext<AppearanceActionsContextValue | null>(null)
