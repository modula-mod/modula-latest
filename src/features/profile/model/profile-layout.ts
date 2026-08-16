import {inverted} from '@/theme/foundations/inverted'

/**
 * Profile hero geometry, measured from the founder composition.
 *
 *   cover photograph, full bleed under the chrome
 *   inverted-corner cradle around the portrait (circular bite + convex landing)
 *   display name / handle on the raised plateau, beside the portrait
 *   metric wheel under the portrait | bio + metadata to the right
 *   tabs → content
 *
 * The cradle radius is the portrait slot plus a small cover gap, so the
 * inverted corner wraps the circle instead of cutting a 90° step beside it.
 * The plateau sits at the avatar centre — the name is beside the portrait,
 * not in the cover chrome and not under the feet.
 */
export const PROFILE_LAYOUT = {
  avatarRatio: 0.22,
  avatarMin: 84,
  avatarMax: 96,
  avatarLeadRatio: 0.05,
  avatarLeadMin: 16,
  avatarLeadMax: 24,
  haloExtra: 5,
  haloWidth: 2,
  avatarBorder: 3,
  /** Painted portrait is 5% smaller than the cradle so it sits inside the pocket. */
  avatarFit: 0.95,
  /** Lower the portrait into the white pocket. Does not move the inverted SVG. */
  avatarDrop: 60,
  /** Extra drop for name / handle / bio. Does not move the inverted SVG. */
  identityDrop: 55,
  /** Cover showing around the portrait inside the inverted cradle. */
  cradleGap: 8,
  /** Convex landing from the cradle onto the identity plateau. */
  plateauRadius: 20,
  /** Cover above the portrait crown: chrome + photo. Keep this tall — the
   *  inverted overlay stays a short cradle at the bottom, not extra height. */
  coverHeadroomCompact: 140,
  coverHeadroomRegular: 160,
  /** Portrait bottom to the top of the metric wheel. */
  metricColumnGap: 12,
  /**
   * Extra space under the in-flow portrait before the wheel.
   * Does not move the inverted SVG. 0 restores the pre-flow gap —
   * the old 70pt was padding the hanging absolute avatar already occupied.
   */
  metricDrop: 0,
  /** Name sits just onto the white plateau so glyphs don’t spill into the photo. */
  identityPlateauGap: 8,
  identityAfterAvatar: 12,
  coverTopBlur: 28,
  metricItemHeight: 42,
  metricWindowItems: 3,
  metricMaxVisible: 5,
  metricRailGutter: 14,
  /**
   * Overlay chrome below the safe area: 8pt offset + 44pt glass hit.
   * Sticky tabs sit flush under that row — the name morphs into it.
   */
  stickyChromeClearance: 52,
  stackedFontScale: 1.35,
  stackedWidth: 340,
  invertedSize: inverted.profile,
} as const

export type ProfileGeometry = {
  coverBody: number
  avatarSize: number
  slotSize: number
  haloExpansion: number
  heroHorizontalInset: number
  avatarLead: number
  avatarLeft: number
  avatarLift: number
  plateauDepth: number
  shelfDepth: number
  transitionHeight: number
  stepX: number
  stepRise: number
  stepRadius: number
  gutterWidth: number
  identityPaddingTop: number
  identityPlateauGap: number
  identityDrop: number
  identityColumnPad: number
  metricViewportHeight: number
  metricColumnTop: number
  metricColumnWidth: number
  /** Pull the portrait into the plateau row so it scrolls with the name. */
  avatarFlowTop: number
  avatarFlowLeft: number
  avatarCenterX: number
  avatarCenterY: number
  cradleRadius: number
  plateauRadius: number
  invertedCornerRadius: number
  stackedFallback: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function profileAvatarSizeFull(compact: boolean, contentWidth = 393): number {
  const scaled = Math.round(contentWidth * PROFILE_LAYOUT.avatarRatio)
  const size = clamp(scaled, PROFILE_LAYOUT.avatarMin, PROFILE_LAYOUT.avatarMax)
  return compact ? size : size + 8
}

export function profileAvatarSize(compact: boolean, contentWidth = 393): number {
  return Math.round(profileAvatarSizeFull(compact, contentWidth) * PROFILE_LAYOUT.avatarFit)
}

export function profileHaloExtra(showFocusHalo: boolean): number {
  return showFocusHalo ? PROFILE_LAYOUT.haloExtra : 0
}

export function profileAvatarSlotSize(
  compact: boolean,
  showFocusHalo: boolean,
  contentWidth = 393,
): number {
  return profileAvatarSize(compact, contentWidth) + profileHaloExtra(showFocusHalo)
}

export function profileAvatarLead(contentWidth = 393): number {
  return clamp(
    Math.round(contentWidth * PROFILE_LAYOUT.avatarLeadRatio),
    PROFILE_LAYOUT.avatarLeadMin,
    PROFILE_LAYOUT.avatarLeadMax,
  )
}

export function profileCradleRadius(
  compact: boolean,
  showFocusHalo: boolean,
  contentWidth = 393,
): number {
  const pocket =
    profileAvatarSizeFull(compact, contentWidth) + profileHaloExtra(showFocusHalo)
  return pocket / 2 + PROFILE_LAYOUT.cradleGap
}

export function profileCoverBody(compact: boolean | undefined, contentWidth = 393): number {
  const slot = profileAvatarSlotSize(Boolean(compact), true, contentWidth)
  const cradle = slot / 2 + PROFILE_LAYOUT.cradleGap
  const lift = cradle + slot / 2
  const headroom = compact
    ? PROFILE_LAYOUT.coverHeadroomCompact
    : PROFILE_LAYOUT.coverHeadroomRegular
  return Math.round(lift + headroom)
}

export function profileCoverHeight(
  compact: boolean | undefined,
  insetTop: number,
  contentWidth = 393,
): number {
  return profileCoverBody(compact, contentWidth) + insetTop
}

export function profileMetricWindowHeight(): number {
  return PROFILE_LAYOUT.metricItemHeight * PROFILE_LAYOUT.metricWindowItems
}

/** Cover bottom up to the plateau: cradle to avatar centre, plus the landing. */
export function profilePlateauDepth(
  compact: boolean,
  showFocusHalo: boolean,
  contentWidth = 393,
): number {
  return Math.round(
    profileCradleRadius(compact, showFocusHalo, contentWidth) + PROFILE_LAYOUT.plateauRadius,
  )
}

export function profileGeometry(
  compact: boolean,
  showFocusHalo: boolean,
  horizontalInset: number,
  options?: {contentWidth?: number; fontScale?: number},
): ProfileGeometry {
  const contentWidth = options?.contentWidth ?? 393
  const fontScale = options?.fontScale ?? 1
  const paintedSize = profileAvatarSize(compact, contentWidth)
  const fullSize = profileAvatarSizeFull(compact, contentWidth)
  const haloExpansion = profileHaloExtra(showFocusHalo)
  const slotSize = paintedSize + haloExpansion
  const pocketSlot = fullSize + haloExpansion
  const avatarLead = profileAvatarLead(contentWidth)
  const cradleRadius = profileCradleRadius(compact, showFocusHalo, contentWidth)
  const plateauRadius = PROFILE_LAYOUT.plateauRadius
  const plateauDepth = Math.round(cradleRadius + plateauRadius)
  const avatarCenterX = avatarLead + pocketSlot / 2
  const gutterWidth = avatarLead + pocketSlot
  // Lower the painted portrait into the white pocket. The inverted SVG stays put.
  const shelfDepth = cradleRadius - slotSize / 2 - PROFILE_LAYOUT.avatarDrop
  // Flat white plateau starts after the concave bite + convex landing.
  const identityColumnPad = PROFILE_LAYOUT.cradleGap + plateauRadius
  const avatarLeft = avatarCenterX - slotSize / 2
  // Same visual as `bottom: shelfDepth` on the cover, but in the plateau row
  // so a fast fling cannot composite the portrait apart from the name.
  const avatarFlowTop =
    plateauDepth - shelfDepth - slotSize - PROFILE_LAYOUT.identityPlateauGap
  const avatarFlowLeft = avatarLeft - horizontalInset

  const identityColumnWidth = contentWidth - horizontalInset - gutterWidth
  const stackedFallback =
    fontScale >= PROFILE_LAYOUT.stackedFontScale ||
    contentWidth < PROFILE_LAYOUT.stackedWidth ||
    identityColumnWidth < 150

  return {
    coverBody: profileCoverBody(compact, contentWidth),
    avatarSize: paintedSize,
    slotSize,
    haloExpansion,
    heroHorizontalInset: horizontalInset,
    avatarLead,
    avatarLeft,
    avatarLift: cradleRadius + slotSize / 2,
    plateauDepth,
    shelfDepth,
    transitionHeight: plateauDepth,
    stepX: gutterWidth,
    stepRise: Math.round(cradleRadius),
    stepRadius: plateauRadius,
    gutterWidth,
    identityPaddingTop: PROFILE_LAYOUT.identityAfterAvatar,
    identityPlateauGap: PROFILE_LAYOUT.identityPlateauGap,
    identityDrop: PROFILE_LAYOUT.identityDrop,
    identityColumnPad,
    metricViewportHeight: profileMetricWindowHeight(),
    metricColumnTop: PROFILE_LAYOUT.metricColumnGap + PROFILE_LAYOUT.metricDrop,
    metricColumnWidth: Math.max(0, gutterWidth - horizontalInset),
    avatarFlowTop,
    avatarFlowLeft,
    avatarCenterX,
    avatarCenterY: plateauRadius,
    cradleRadius,
    plateauRadius,
    invertedCornerRadius: inverted.md,
    stackedFallback,
  }
}
