import type {PaletteCore} from '@/theme/contracts'
import {isValidHexColour} from '@/theme/accents/colourMath'

const REQUIRED_PALETTE_KEYS = [
  'canvas',
  'surface1',
  'surface2',
  'surface3',
  'border',
  'borderStrong',
  'textMain',
  'textSub',
  'textMuted',
] as const

export function validatePalette(input: unknown): input is PaletteCore {
  if (!input || typeof input !== 'object') {
    return false
  }

  const candidate = input as Record<string, unknown>
  return REQUIRED_PALETTE_KEYS.every(
    key => typeof candidate[key] === 'string' && isValidHexColour(candidate[key]),
  )
}

export {REQUIRED_PALETTE_KEYS}
