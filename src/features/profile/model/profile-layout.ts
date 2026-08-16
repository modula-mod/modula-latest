import {inverted} from '@/theme/foundations/inverted'

/**
 * Profile geometry constants. Derived from avatar, halo, and cover — not
 * from a single iPhone screenshot.
 *
 * Vertical rhythm:
 *   cover → avatar overlap / Focus Halo → inverted transition
 *   → identity (below the slot) → metadata → metrics → tabs → content
 */
export const PROFILE_LAYOUT = {
  coverBodyCompact: 140,
  coverBodyRegular: 156,
  avatarCompact: 80,
  avatarRegular: 96,
  haloExtra: 6,
  haloWidth: 2,
  avatarBorder: 2,
  /** Cover showing around the avatar inside the canvas cradle. */
  cradleGap: 4,
  cradleLipExtra: 2,
  /** Breathing room from the avatar/halo bottom to the display name. */
  identityAfterAvatar: 8,
  coverTopBlur: 28,
  coverBottomBlur: 48,
  metricItemHeight: 34,
  metricWindowItems: 3,
  metricMaxVisible: 5,
  invertedSize: inverted.profile,
} as const

export type ProfileGeometry = {
  coverBody: number
  avatarSize: number
  slotSize: number
  avatarOverlap: number
  haloExpansion: number
  heroHorizontalInset: number
  identityPaddingTop: number
  metricViewportHeight: number
  avatarCenterX: number
  cradleRadius: number
  transitionHeight: number
}

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

/**
 * One geometry object for cover, avatar slot, inverted cradle, and identity.
 * Identity starts below the halo — never under it.
 */
export function profileGeometry(
  compact: boolean,
  showFocusHalo: boolean,
  horizontalInset: number,
): ProfileGeometry {
  const avatarSize = profileAvatarSize(compact)
  const haloExpansion = profileHaloExtra(showFocusHalo)
  const slotSize = avatarSize + haloExpansion
  const avatarOverlap = slotSize / 2
  const cradleRadius = avatarOverlap + PROFILE_LAYOUT.cradleGap
  return {
    coverBody: profileCoverBody(compact),
    avatarSize,
    slotSize,
    avatarOverlap,
    haloExpansion,
    heroHorizontalInset: horizontalInset,
    identityPaddingTop: avatarOverlap,
    metricViewportHeight: profileMetricWindowHeight(),
    avatarCenterX: horizontalInset + slotSize / 2,
    cradleRadius,
    transitionHeight: cradleRadius + PROFILE_LAYOUT.cradleLipExtra,
  }
}
