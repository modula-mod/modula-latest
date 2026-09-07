import type {LayoutClass} from '@/layout/breakpoints'

export type ModulaOverlayIntent =
  | 'actions'
  | 'tools'
  | 'picker'
  | 'filters'
  | 'comments'
  | 'context'
  | 'configuration'
  | 'details'
  | 'media'
  | 'edit-profile'
  | 'command'
  | 'search'

export type ModulaPointerType = 'coarse' | 'fine' | 'none'
export type ModulaResolvedPresentation = 'drawer' | 'sheet' | 'dialog' | 'menu' | 'popover'

export type ModulaPresentationEnvironment = {
  intent: ModulaOverlayIntent
  viewport: LayoutClass
  pointer: ModulaPointerType
  hover: boolean
  standalone: boolean
  platform: 'web' | 'ios' | 'android' | 'unknown'
}

/**
 * One deterministic presentation policy for Modula overlays.
 *
 * Products declare intent. The host selects mechanics from capability signals;
 * callers do not scatter viewport checks or user-agent branches through screens.
 */
export function resolvePresentation({
  intent,
  viewport,
  pointer,
  hover,
  standalone,
  platform,
}: ModulaPresentationEnvironment): ModulaResolvedPresentation {
  if (platform !== 'web') {
    return intent === 'configuration' || intent === 'details' ? 'sheet' : 'drawer'
  }

  const touchFirst = pointer === 'coarse' || !hover || standalone
  if (viewport === 'compact' || (viewport === 'medium' && touchFirst)) return 'drawer'

  if (intent === 'actions' || intent === 'context') return 'menu'
  if (intent === 'picker' || intent === 'search') return 'popover'
  if (intent === 'filters' || intent === 'comments' || intent === 'configuration' || intent === 'details') {
    return 'sheet'
  }
  return 'dialog'
}

/** Controlled overlays without an anchor cannot safely render as a menu/popover. */
export function resolveUnanchoredPresentation(
  environment: ModulaPresentationEnvironment,
): Exclude<ModulaResolvedPresentation, 'menu' | 'popover'> {
  const resolved = resolvePresentation(environment)
  return resolved === 'menu' || resolved === 'popover' ? 'dialog' : resolved
}
