import {inverted} from '@/theme/foundations/inverted'

/**
 * Profile geometry constants. Derived from avatar, halo, and cover — not
 * from a single iPhone screenshot.
 */
export const PROFILE_LAYOUT = {
  coverBodyCompact: 148,
  coverBodyRegular: 168,
  avatarCompact: 80,
  avatarRegular: 96,
  haloExtra: 8,
  coverTopBlur: 28,
  coverBottomBlur: 64,
  metricItemHeight: 44,
  metricWindowItems: 3,
  metricMaxVisible: 6,
  invertedSize: inverted.profile,
} as const

export function profileAvatarSize(compact: boolean): number {
  return compact ? PROFILE_LAYOUT.avatarCompact : PROFILE_LAYOUT.avatarRegular
}

export function profileHaloExtra(showFocusHalo: boolean): number {
  return showFocusHalo ? PROFILE_LAYOUT.haloExtra : 0
}

export function profileAvatarSlotSize(compact: boolean, showFocusHalo: boolean): number {
  return profileAvatarSize(compact) + profileHaloExtra(showFocusHalo)
}

export function profileCoverBody(compact: boolean | undefined): number {
  return compact ? PROFILE_LAYOUT.coverBodyCompact : PROFILE_LAYOUT.coverBodyRegular
}

export function profileCoverHeight(compact: boolean | undefined, insetTop: number): number {
  return profileCoverBody(compact) + insetTop
}

export function profileMetricWindowHeight(): number {
  return PROFILE_LAYOUT.metricItemHeight * PROFILE_LAYOUT.metricWindowItems
}
