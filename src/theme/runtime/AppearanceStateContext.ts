import {createContext} from 'react'

import type {
  AppearancePreferences,
  ResolvedAppearance,
  SystemAccessibilityState,
} from '@/theme/contracts'

export type AppearanceStateContextValue = {
  preferences: AppearancePreferences
  resolved: ResolvedAppearance
  hydrated: boolean
  systemAccessibility: SystemAccessibilityState
}

export const AppearanceStateContext =
  createContext<AppearanceStateContextValue | null>(null)
