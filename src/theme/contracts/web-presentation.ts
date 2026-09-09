export type WebPresentation = 'liquid' | 'material'

export const WEB_PRESENTATIONS = [
  'liquid',
  'material',
] as const satisfies readonly WebPresentation[]
