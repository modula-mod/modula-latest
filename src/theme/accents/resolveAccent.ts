import accents from '@/theme/data/accents.json'
import type {AccentId, AccentTokens} from '@/theme/contracts'
import {
  expandHexColour,
  mixHex,
  strongestReadableForeground,
} from '@/theme/accents/colourMath'

type AccentRecord = Record<string, {label: string; base: string}>

export type AccentPreset = {
  id: Exclude<AccentId, 'custom'>
  label: string
  base: string
}

const presetData = accents as AccentRecord

export const ACCENT_PRESETS: AccentPreset[] = Object.entries(presetData).map(
  ([id, value]) => ({
    id: id as Exclude<AccentId, 'custom'>,
    label: value.label,
    base: value.base,
  }),
)

export function getAccentBase(
  accentId: AccentId,
  customAccent: string | null,
): string {
  if (accentId === 'custom') {
    const normalized = customAccent ? expandHexColour(customAccent) : null
    return normalized ?? presetData.modulaTeal.base
  }

  return presetData[accentId]?.base ?? presetData.modulaTeal.base
}

export function resolveAccent(
  accentId: AccentId,
  customAccent: string | null,
  isDark: boolean,
  increaseContrast: boolean,
): AccentTokens {
  const base = getAccentBase(accentId, customAccent)
  const foreground = strongestReadableForeground(base)
  const subtleMixTarget = isDark ? '#000000' : '#FFFFFF'
  const pressedMixTarget = isDark ? '#FFFFFF' : '#000000'
  const subtleAmount = increaseContrast ? 0.72 : 0.84
  const borderAmount = increaseContrast ? 0.42 : 0.58

  return {
    base,
    foreground,
    subtle: mixHex(base, subtleMixTarget, subtleAmount),
    subtleStrong: mixHex(base, subtleMixTarget, Math.max(0.5, subtleAmount - 0.18)),
    border: mixHex(base, subtleMixTarget, borderAmount),
    pressed: mixHex(base, pressedMixTarget, isDark ? 0.18 : 0.16),
    focus: mixHex(base, foreground, foreground === '#000000' ? 0.22 : 0.16),
  }
}
