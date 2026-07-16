export type TypographyRole =
  | 'display'
  | 'title1'
  | 'title2'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'micro'

export type TypographyToken = {
  fontSize: number
  lineHeight: number
  fontWeight: '400' | '500' | '600' | '700'
  letterSpacing?: number
}

export type TypographyTokens = Record<TypographyRole, TypographyToken>

export const TYPOGRAPHY_ROLES = [
  'display',
  'title1',
  'title2',
  'headline',
  'body',
  'bodyStrong',
  'label',
  'caption',
  'micro',
] as const satisfies readonly TypographyRole[]
