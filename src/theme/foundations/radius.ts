export const radius = {
  small: 8,
  medium: 12,
  large: 18,
  xlarge: 24,
  round: 999,
  none: 0,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
} as const

export type RadiusToken = keyof typeof radius
