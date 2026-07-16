export const breakpoints = {
  compact: 0,
  medium: 768,
  expanded: 1024,
} as const

export type LayoutClass = 'compact' | 'medium' | 'expanded'
