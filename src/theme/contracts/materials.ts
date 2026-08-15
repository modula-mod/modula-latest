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

/**
 * Canonical Modula motion durations. Semantic vocabulary (7M):
 * micro = pressed/hover; quick = `fast`; standard = `normal`;
 * expressive = `slow`; overlay = sheet/backdrop when not native-driven.
 * Reduce Motion swaps the whole token set — never branch per call site.
 */
export type MotionTokens = {
  instant: number
  /** Pressed / hover state feedback (~90ms). */
  micro: number
  /** Semantic "quick": icon state, small disclosure. */
  fast: number
  /** Semantic "standard": segment selection, common transitions. */
  normal: number
  /** Semantic "expressive": menu / reaction appearance. */
  slow: number
  /** Sheet / backdrop presentation when not native-driven (~320ms). */
  overlay: number
  pressScale: number
  /** Semantic springs. 7M names: snappy = `selection`, standardSpring = `drawer`. */
  springs: {
    press: {damping: number; stiffness: number; mass: number}
    selection: {damping: number; stiffness: number; mass: number}
    sheet: {damping: number; stiffness: number; mass: number}
    drawer: {damping: number; stiffness: number; mass: number}
    navigation: {damping: number; stiffness: number; mass: number}
    celebration: {damping: number; stiffness: number; mass: number}
    /** Larger connected spatial transitions; reduced-motion equivalent is a cross-fade. */
    spatial: {damping: number; stiffness: number; mass: number}
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
