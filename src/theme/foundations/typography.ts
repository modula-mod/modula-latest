export const typography = {
  display: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
} as const

export type TypographyVariant = keyof typeof typography
