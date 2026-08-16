import {createContext} from 'react'

import type {ResolvedAppearance} from '@/theme/contracts'
import {inverted} from '@/theme/foundations/inverted'
import {radius} from '@/theme/foundations/radius'
import {spacing} from '@/theme/foundations/spacing'

export type LegacySemanticAliases = {
  surface: string
  surfaceRaised: string
  surfaceMuted: string
  text: string
  textSecondary: string
  textTertiary: string
}

export type ThemeTokenSet = ResolvedAppearance & {
  appearanceMode: ResolvedAppearance['preferences']['mode']
  resolvedColourMode: ResolvedAppearance['resolvedMode']
  resolvedFamily: ResolvedAppearance['resolvedFamily']
  scheme: 'light' | 'dark'
  spacing: typeof spacing
  radius: typeof radius
  inverted: typeof inverted
  material: ResolvedAppearance['materials']['card']
  colours: ResolvedAppearance['colours'] & LegacySemanticAliases
}

export const ThemeTokensContext = createContext<ThemeTokenSet | null>(null)
