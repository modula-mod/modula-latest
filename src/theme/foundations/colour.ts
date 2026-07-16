export const lightColours = {
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceRaised: '#F7F9FA',
  surfaceMuted: '#F1F4F5',
  border: '#E4E9EC',
  text: '#101416',
  textSecondary: '#65737B',
  textTertiary: '#8A969D',
  accent: '#369CAA',
  accentForeground: '#FFFFFF',
  accentSubtle: '#E9F5F6',
  destructive: '#E5484D',
  success: '#2E9B64',
  backdrop: 'rgba(0, 0, 0, 0.44)',
} as const

export const darkColours = {
  canvas: '#000000',
  surface: '#0D0F10',
  surfaceRaised: '#151819',
  surfaceMuted: '#1B1F21',
  border: '#272D30',
  text: '#F4F7F8',
  textSecondary: '#9BA7AD',
  textTertiary: '#758086',
  accent: '#53B2BE',
  accentForeground: '#001012',
  accentSubtle: '#102B2F',
  destructive: '#FF6369',
  success: '#45BD7B',
  backdrop: 'rgba(0, 0, 0, 0.68)',
} as const

/** Raw values kept for existing Phase 0 helpers. Prefer semantic tokens in UI. */
export const colour = {
  brandAccent: lightColours.accent,
  white: lightColours.canvas,
  black: darkColours.canvas,
  neutral50: lightColours.surfaceRaised,
  neutral100: lightColours.surfaceMuted,
  neutral200: lightColours.border,
  neutral300: darkColours.textSecondary,
  neutral500: lightColours.textSecondary,
  neutral700: darkColours.surfaceMuted,
  neutral900: lightColours.text,
  red600: lightColours.destructive,
} as const

export type ColourName = keyof typeof colour
