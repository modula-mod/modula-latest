export type SurfaceRole =
  | 'canvas'
  | 'navigation'
  | 'content'
  | 'post'
  | 'card'
  | 'floating'
  | 'input'
  | 'modal'
  | 'media'
  | 'control'

export type MaterialTokens = {
  backgroundColor: string
  foregroundColor: string
  borderColor: string
  borderWidth: number
  radius: number
  opacity: number
  blurIntensity: number
  blurTint: 'light' | 'dark' | 'default'
  useNativeGlass: boolean
  shadowColor: string
  shadowOpacity: number
  shadowRadius: number
  shadowOffsetY: number
  elevation: number
  innerHighlightColor: string
  innerHighlightOpacity: number
  pressOpacity: number
  pressScale: number
}

export type MaterialTokenMap = Record<SurfaceRole, MaterialTokens>

export type MotionTokens = {
  instant: number
  fast: number
  normal: number
  slow: number
  pressScale: number
  /** Semantic springs used by drawer / selection / celebration. */
  springs: {
    press: {damping: number; stiffness: number; mass: number}
    selection: {damping: number; stiffness: number; mass: number}
    sheet: {damping: number; stiffness: number; mass: number}
    drawer: {damping: number; stiffness: number; mass: number}
    navigation: {damping: number; stiffness: number; mass: number}
    celebration: {damping: number; stiffness: number; mass: number}
  }
}

export const SURFACE_ROLES = [
  'canvas',
  'navigation',
  'content',
  'post',
  'card',
  'floating',
  'input',
  'modal',
  'media',
  'control',
] as const satisfies readonly SurfaceRole[]
