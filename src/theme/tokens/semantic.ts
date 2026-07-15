import {colour} from '@/theme/foundations/colour'

export type SemanticColours = {
  canvas: string
  surface: string
  surfaceRaised: string
  border: string
  text: string
  textSecondary: string
  accent: string
  accentForeground: string
  destructive: string
}

export const lightSemanticColours: SemanticColours = {
  canvas: colour.white,
  surface: colour.neutral50,
  surfaceRaised: colour.white,
  border: colour.neutral200,
  text: colour.neutral900,
  textSecondary: colour.neutral500,
  accent: colour.brandAccent,
  accentForeground: colour.white,
  destructive: colour.red600,
}

export const darkSemanticColours: SemanticColours = {
  canvas: colour.neutral900,
  surface: colour.black,
  surfaceRaised: colour.neutral700,
  border: colour.neutral700,
  text: colour.neutral50,
  textSecondary: colour.neutral300,
  accent: colour.brandAccent,
  accentForeground: colour.white,
  destructive: colour.red600,
}

export type ColourScheme = 'light' | 'dark'

export function getSemanticColours(scheme: ColourScheme): SemanticColours {
  return scheme === 'dark' ? darkSemanticColours : lightSemanticColours
}
