export const radius = {
  small: 8,
  medium: 12,
  large: 18,
  xlarge: 24,
  /** Hero media cards (feed media posts). */
  xxlarge: 40,
  round: 999,
  none: 0,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 40,
  full: 999,
} as const

export type RadiusToken = keyof typeof radius
