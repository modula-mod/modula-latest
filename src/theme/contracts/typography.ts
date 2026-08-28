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

/**
 * 7M semantic vocabulary resolved onto the canonical roles. Aliases keep one
 * source of truth: they never define their own sizes.
 * `metadata` and `metricLabel` map to `caption` (13pt) — not `micro` — so
 * timestamps, product rails, and profile metrics stay readable.
 */
export type TypographySemanticAlias =
  | 'titleLarge'
  | 'title'
  | 'metadata'
  | 'button'
  | 'moduleTitle'
  | 'moduleSubtitle'
  | 'publisher'
  | 'metricValue'
  | 'metricLabel'
  | 'sectionTitle'
  | 'secondaryBody'
  | 'screenLargeTitle'
  | 'screenCompactTitle'
  | 'editorialEyebrow'
  | 'editorialTitle'
  | 'editorialSubtitle'
  | 'sectionAccessory'
  | 'productName'
  | 'productSubtitle'
  | 'buttonLabel'
  | 'rowTitle'
  | 'rowTrailing'
  | 'heroTitle'
  | 'heroDescription'
  | 'footnote'
  | 'sectionHeader'

export const TYPOGRAPHY_SEMANTIC_ALIASES: Record<
  TypographySemanticAlias,
  TypographyRole
> = {
  titleLarge: 'title1',
  title: 'title2',
  metadata: 'caption',
  button: 'label',
  moduleTitle: 'display',
  moduleSubtitle: 'body',
  publisher: 'caption',
  metricValue: 'headline',
  metricLabel: 'caption',
  sectionTitle: 'headline',
  secondaryBody: 'caption',
  screenLargeTitle: 'display',
  screenCompactTitle: 'headline',
  editorialEyebrow: 'micro',
  editorialTitle: 'display',
  editorialSubtitle: 'body',
  sectionAccessory: 'caption',
  productName: 'headline',
  productSubtitle: 'caption',
  buttonLabel: 'label',
  rowTitle: 'body',
  rowTrailing: 'caption',
  heroTitle: 'title1',
  heroDescription: 'body',
  footnote: 'caption',
  sectionHeader: 'caption',
}
