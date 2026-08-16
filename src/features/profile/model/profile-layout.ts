import {inverted} from '@/theme/foundations/inverted'

/**
 * Profile geometry constants. Derived from avatar, halo, and cover — not
 * from a single iPhone screenshot.
 *
 * Vertical rhythm:
 *   cover → glass chrome
 *   avatar cradled by the inverted corner, cover still visible below it
 *   name / handle / bio on the raised trailing plateau
 *   compact metric column | metadata grid
 *   tabs → content
 *
 * The cradle drives everything below the cover: the concave quarter arc and
 * the rise are both exactly `cradleRadius` from the avatar centre, so the
 * canvas edge, the identity column offset, and the cover height all fall out
 * of one number instead of being tuned independently.
 */
export const PROFILE_LAYOUT = {
  coverBodyCompact: 158,
  coverBodyRegular: 176,
  avatarCompact: 76,
  avatarRegular: 88,
  haloExtra: 5,
  haloWidth: 2,
  avatarBorder: 0,
  /** Cover showing around the avatar inside the inverted cradle. */
  cradleGap: 14,
  /** Plateau clearance above the avatar crown. */
  plateauLift: 4,
  /** Convex radius where the cradle rise meets the identity plateau. */
  plateauRadius: 16,
  /** Gap from the cradle rise to the first identity glyph. */
  identityColumnGap: 4,
  /** Breathing room from the avatar/halo bottom to stacked-fallback identity. */
  identityAfterAvatar: 8,
  /** Canvas above the metric column, measured from the cover edge. */
  metricColumnTop: 10,
  coverTopBlur: 28,
  coverBottomBlur: 36,
  metricItemHeight: 40,
  metricWindowItems: 3,
  metricMaxVisible: 5,
  metricColumnMin: 96,
  metricColumnMax: 132,
  stackedFontScale: 1.35,
  stackedWidth: 340,
  invertedSize: inverted.profile,
} as const

export type ProfileGeometry = {
  coverBody: number
  avatarSize: number
  slotSize: number
  /** Distance from the cover edge up to the top of the avatar slot. */
  avatarLift: number
  haloExpansion: number
  heroHorizontalInset: number
  identityPaddingTop: number
  /** Leading offset of the identity column — sits on the cradle rise. */
  identityColumnOffset: number
  /** Height of the cover band the canvas plateau rises through. */
  raisedBodyHeight: number
  metricViewportHeight: number
  metricColumnTop: number
  metricColumnWidth: number
  avatarCenterX: number
  /** Avatar centre inside the transition band. */
  avatarCenterY: number
  cradleRadius: number
  plateauRadius: number
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

export function profileCradleRadius(compact: boolean, showFocusHalo: boolean): number {
  return profileAvatarSlotSize(compact, showFocusHalo) / 2 + PROFILE_LAYOUT.cradleGap
}

/**
 * Band the canvas rises through: cradle radius (avatar centre to the canvas
 * edge) plus the avatar's upper half plus clearance above the crown.
 */
export function profileRaisedBodyHeight(compact: boolean, showFocusHalo: boolean): number {
  return Math.round(
    profileCradleRadius(compact, showFocusHalo) +
      profileAvatarSlotSize(compact, showFocusHalo) / 2 +
      PROFILE_LAYOUT.plateauLift,
  )
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
  const cradleRadius = profileCradleRadius(compact, showFocusHalo)
  const raisedBodyHeight = profileRaisedBodyHeight(compact, showFocusHalo)
  const contentWidth = options?.contentWidth ?? 390
  const fontScale = options?.fontScale ?? 1
  const identityColumnOffset = Math.round(
    slotSize / 2 + cradleRadius + PROFILE_LAYOUT.identityColumnGap,
  )
  // The identity column must still hold a name and a handle beside the rise.
  const stackedFallback =
    fontScale >= PROFILE_LAYOUT.stackedFontScale ||
    contentWidth < PROFILE_LAYOUT.stackedWidth ||
    contentWidth - horizontalInset * 2 - identityColumnOffset < 150
  return {
    coverBody: profileCoverBody(compact),
    avatarSize,
    slotSize,
    avatarLift: cradleRadius + slotSize / 2,
    haloExpansion,
    heroHorizontalInset: horizontalInset,
    identityPaddingTop: slotSize / 2 + PROFILE_LAYOUT.identityAfterAvatar,
    identityColumnOffset,
    raisedBodyHeight,
    metricViewportHeight: profileMetricWindowHeight(),
    metricColumnTop: raisedBodyHeight + PROFILE_LAYOUT.metricColumnTop,
    metricColumnWidth: profileMetricColumnWidth(
      Math.max(0, contentWidth - horizontalInset * 2),
    ),
    avatarCenterX: horizontalInset + slotSize / 2,
    avatarCenterY: raisedBodyHeight - cradleRadius,
    cradleRadius,
    plateauRadius: PROFILE_LAYOUT.plateauRadius,
    invertedCornerRadius: inverted.profile,
    transitionHeight: raisedBodyHeight,
    stackedFallback,
  }
}
