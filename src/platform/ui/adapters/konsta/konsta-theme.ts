import type {WebPresentation} from '@/theme/contracts'

export type KonstaTheme = 'ios' | 'material'

export function resolveKonstaTheme(
  presentation: WebPresentation,
): KonstaTheme {
  return presentation === 'material' ? 'material' : 'ios'
}

export function resolvePresentationClass(
  presentation: WebPresentation,
): 'k-ios' | 'k-material' {
  return presentation === 'material' ? 'k-material' : 'k-ios'
}
