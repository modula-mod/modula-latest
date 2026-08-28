import {mixHex, strongestReadableForeground} from '@/theme/accents/colourMath'
import type {
  ResolvedAppearanceMode,
  SettingsIconDomain,
  SettingsIconToken,
  SettingsIconTokens,
} from '@/theme/contracts'

type DomainHue = {
  light: string
  dark: string
}

/**
 * Semantic Settings icon-tile colours. Meaning is carried by the glyph and
 * label — colour is accent only (Differentiate Without Color still works).
 */
const DOMAIN_HUES: Record<SettingsIconDomain, DomainHue> = {
  profile: {light: '#5B8DEF', dark: '#4C7CE0'},
  account: {light: '#369CAA', dark: '#2F8A97'},
  notifications: {light: '#E85D4C', dark: '#D94C3C'},
  privacy: {light: '#34A36A', dark: '#2B8F5C'},
  data: {light: '#6B7C93', dark: '#7A8BA3'},
  appearance: {light: '#8B6CCF', dark: '#7B5CC0'},
  accessibility: {light: '#3B82F6', dark: '#2F74E8'},
  language: {light: '#0EA5A5', dark: '#0B9393'},
  modules: {light: '#369CAA', dark: '#2F8A97'},
  security: {light: '#D97706', dark: '#C56A05'},
  developer: {light: '#64748B', dark: '#78879C'},
  content: {light: '#DB2777', dark: '#C91F6B'},
  connections: {light: '#2563EB', dark: '#1D4ED8'},
  info: {light: '#369CAA', dark: '#2F8A97'},
  hearing: {light: '#7C3AED', dark: '#6D28D9'},
  speech: {light: '#0891B2', dark: '#0E7490'},
  interaction: {light: '#EA580C', dark: '#C2410C'},
}

export function resolveSettingsIconTokens(
  mode: ResolvedAppearanceMode,
  increaseContrast: boolean,
): SettingsIconTokens {
  const isDark = mode !== 'light'
  const canvas = mode === 'oled' ? '#000000' : isDark ? '#111827' : '#F4F4F5'
  const entries = Object.entries(DOMAIN_HUES) as [
    SettingsIconDomain,
    DomainHue,
  ][]

  return Object.fromEntries(
    entries.map(([domain, hue]) => {
      const base = isDark ? hue.dark : hue.light
      const background = increaseContrast
        ? base
        : mixHex(base, canvas, isDark ? 0.28 : 0.18)
      const foreground = increaseContrast
        ? strongestReadableForeground(background)
        : isDark
          ? '#F8FAFC'
          : strongestReadableForeground(background)
      const token: SettingsIconToken = {background, foreground}
      return [domain, token]
    }),
  ) as SettingsIconTokens
}
