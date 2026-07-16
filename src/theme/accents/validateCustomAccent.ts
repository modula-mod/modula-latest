import {expandHexColour} from '@/theme/accents/colourMath'

export type CustomAccentValidation =
  | {
      valid: true
      value: string
      message: null
    }
  | {
      valid: false
      value: null
      message: string
    }

export function validateCustomAccent(input: string): CustomAccentValidation {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      valid: false,
      value: null,
      message: 'Enter a hex colour such as #369CAA.',
    }
  }

  if (!trimmed.startsWith('#')) {
    return {
      valid: false,
      value: null,
      message: 'Use #RGB or #RRGGBB format.',
    }
  }

  const normalized = expandHexColour(trimmed)
  if (!normalized) {
    return {
      valid: false,
      value: null,
      message: 'Custom accents cannot use alpha, gradients, or colour names.',
    }
  }

  return {
    valid: true,
    value: normalized,
    message: null,
  }
}
