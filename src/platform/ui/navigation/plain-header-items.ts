import type {ReactElement} from 'react'
import {Platform} from 'react-native'

/**
 * iOS 26 header pairs: keep the shared liquid-glass capsule, but space icons
 * apart inside it (not clustered on the left of a wide empty pill).
 *
 * Use `unstable_header*Items` + `spacing` with default `sharesBackground`
 * (do NOT set `hidesSharedBackground` — that deletes the glass).
 */

export type GlassHeaderCustomItem = {
  type: 'custom'
  element: ReactElement
}

export type GlassHeaderSpacingItem = {
  type: 'spacing'
  spacing: number
}

/** Gap between paired header icons inside the shared glass capsule. */
export const HEADER_ICON_PAIR_GAP = 22

/** Custom header item that still participates in iOS 26 shared liquid glass. */
export function plainHeaderCustomItem(
  element: ReactElement,
): GlassHeaderCustomItem {
  return {
    type: 'custom',
    element,
  }
}

export function plainHeaderSpacing(
  spacing = HEADER_ICON_PAIR_GAP,
): GlassHeaderSpacingItem {
  return {type: 'spacing', spacing}
}

/** True when native stack supports `unstable_header*Items`. */
export function supportsPlainHeaderItems(): boolean {
  return Platform.OS === 'ios'
}
