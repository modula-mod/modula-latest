import type {ReactElement} from 'react'
import {Platform} from 'react-native'

/**
 * iOS 26 puts all `headerRight` / `headerLeft` children into one shared
 * liquid-glass capsule — icons sit clustered on the left of a wide pill.
 *
 * Use `unstable_header*Items` with `hidesSharedBackground` + spacing so each
 * control is a separate plain glyph, spaced apart (not one cramped group).
 */

export type PlainHeaderCustomItem = {
  type: 'custom'
  element: ReactElement
  hidesSharedBackground: true
}

export type PlainHeaderSpacingItem = {
  type: 'spacing'
  spacing: number
}

/** Gap between paired header icons (create/messages, share/more, …). */
export const HEADER_ICON_PAIR_GAP = 22

export function plainHeaderCustomItem(
  element: ReactElement,
): PlainHeaderCustomItem {
  return {
    type: 'custom',
    element,
    hidesSharedBackground: true,
  }
}

export function plainHeaderSpacing(
  spacing = HEADER_ICON_PAIR_GAP,
): PlainHeaderSpacingItem {
  return {type: 'spacing', spacing}
}

/** True when native stack supports per-item shared-background control. */
export function supportsPlainHeaderItems(): boolean {
  return Platform.OS === 'ios'
}
