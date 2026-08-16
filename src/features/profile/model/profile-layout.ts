import {inverted} from '@/theme/foundations/inverted'

/**
 * Profile geometry constants. Derived from avatar, halo, and cover — not
 * from a single iPhone screenshot.
 *
 * Vertical rhythm:
 *   cover → glass chrome
 *   avatar in an inverted leading valley
 *   name / handle on the raised trailing plateau
 *   compact metric column | bio + metadata grid
 *   tabs → content
 */
export const PROFILE_LAYOUT = {
  coverBodyCompact: 158,
  coverBodyRegular: 176,
  avatarCompact: 76,
  avatarRegular: 88,
  haloExtra: 5,
  haloWidth: 2,
  avatarBorder: 0,
  /** Cover showing around the avatar inside the inverted valley. */
  cradleGap: 6,
  cradleLipExtra: 4,
  /** Breathing room from the avatar/halo bottom to stacked-fallback identity. */
  identityAfterAvatar: 8,
  identityColumnGap: 12,
  coverTopBlur: 28,
  coverBottomBlur: 36,
  metricItemHeight: 28,
  metricWindowItems: 3,
  metricMaxVisible: 5,
  metricColumnMin: 96,
  metricColumnMax: 120,
  raisedBodyCompact: 88,
  raisedBodyRegular: 96,
  stackedFontScale: 1.35,
  stackedWidth: 340,
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
  identityColumnOffset: number
  raisedBodyHeight: number
  raisedIdentityInset: number
  metricViewportHeight: number
  metricColumnWidth: number
  avatarCenterX: number
  cradleRadius: number
  invertedCornerRadius: number
  transitionHeight: number
  stackedFallback: boolean
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

export function profileMetricColumnWidth(contentWidth: number): number {
  return Math.round(
    Math.min(
      PROFILE_LAYOUT.metricColumnMax,
      Math.max(PROFILE_LAYOUT.metricColumnMin, contentWidth * 0.3),
    ),
  )
}

export function profileRaisedBodyHeight(compact: boolean): number {
  return compact ? PROFILE_LAYOUT.raisedBodyCompact : PROFILE_LAYOUT.raisedBodyRegular
}

/**
 * One geometry object for cover, avatar slot, inverted transition, and identity.
 * The two-column composition may stack when type or width cannot preserve it.
 */
export function profileGeometry(
  compact: boolean,
  showFocusHalo: boolean,
  horizontalInset: number,
  options?: {contentWidth?: number; fontScale?: number},
): ProfileGeometry {
  const avatarSize = profileAvatarSize(compact)
  const haloExpansion = profileHaloExtra(showFocusHalo)
  const slotSize = avatarSize + haloExpansion
  const avatarOverlap = slotSize / 2
  const cradleRadius = avatarOverlap + PROFILE_LAYOUT.cradleGap
  const raisedBodyHeight = profileRaisedBodyHeight(compact)
  const contentWidth = options?.contentWidth ?? 390
  const fontScale = options?.fontScale ?? 1
  const stackedFallback =
    fontScale >= PROFILE_LAYOUT.stackedFontScale ||
    contentWidth < PROFILE_LAYOUT.stackedWidth
  return {
    coverBody: profileCoverBody(compact),
    avatarSize,
    slotSize,
    avatarOverlap,
    haloExpansion,
    heroHorizontalInset: horizontalInset,
    identityPaddingTop: avatarOverlap + PROFILE_LAYOUT.identityAfterAvatar,
    identityColumnOffset: slotSize + PROFILE_LAYOUT.identityColumnGap,
    raisedBodyHeight,
    raisedIdentityInset: Math.round(raisedBodyHeight * 0.78),
    metricViewportHeight: profileMetricWindowHeight(),
    metricColumnWidth: profileMetricColumnWidth(
      Math.max(0, contentWidth - horizontalInset * 2),
    ),
    avatarCenterX: horizontalInset + slotSize / 2,
    cradleRadius,
    invertedCornerRadius: inverted.profile,
    transitionHeight: raisedBodyHeight,
    stackedFallback,
  }
}
