import {inverted} from '@/theme/foundations/inverted'

/**
 * Profile hero geometry, measured from the founder composition.
 *
 *   cover photograph, full bleed under the chrome
 *   inverted-corner cradle around the portrait (circular bite + convex landing)
 *   display name / handle on the raised plateau, beside the portrait
 *   Metrics / About pager under the identity
 *   tabs → content
 *
 * Pocket and portrait share `profilePocketGeometry()`. The inverted SVG
 * overlay lives in the body overlap band so it cannot drift from the avatar.
 *
 * The cradle radius is the portrait slot plus a small cover gap, so the
 * inverted corner wraps the bottom of the circle instead of a trailing
 * quarter that left the left shelf degenerate. The plateau sits at the
 * overlay top — the name is beside the portrait, not in the cover chrome.
 */
export const PROFILE_LAYOUT = {
  avatarRatio: 0.22,
  avatarMin: 84,
  avatarMax: 96,
  avatarLeadRatio: 0.06,
  avatarLeadMin: 24,
  avatarLeadMax: 32,
  haloExtra: 5,
  haloWidth: 2,
  avatarBorder: 3,
  /** Painted portrait is 5% smaller than the max slot so it seats in the pocket. */
  avatarFit: 0.95,
  /**
   * Optical correction only. Positive lowers the painted portrait relative to
   * the shared pocket centre. Not a layout mechanism — SVG and avatar both
   * read `profilePocketGeometry()`. There is no `modula-profile-andrei.yaml`;
   * this token lives here.
   */
  avatarDrop: 0,
  /**
   * Optical drop for name / handle onto the raised plateau. Small on purpose:
   * the identity sits beside the pocket, not under the old 60pt avatar miss.
   */
  identityDrop: 8,
  /** Cover showing around the outer silhouette (portrait + separator + halo). */
  cradleGap: 4,
  /** Convex landing from the cradle onto the identity plateau. */
  plateauRadius: 20,
  /** Cover above the portrait crown: chrome + photo. Keep this tall — the
   *  inverted overlay stays a short cradle at the bottom, not extra height. */
  coverHeadroomCompact: 140,
  coverHeadroomRegular: 160,
  /** Portrait bottom to the profile info pager. */
  metricColumnGap: 8,
  /** Compact Metrics / About pager. Replaces the old side-by-side info block. */
  pagerMinHeight: 172,
  pagerMaxHeight: 228,
  pagerIndicatorSize: 6,
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
  metricItemHeight: 36,
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

/**
 * Canonical avatar / SVG cradle geometry. Overlay and portrait both read this.
 * Coordinates are in the body overlap band: y = 0 at the top of the inverted
 * overlay (the raised plateau), x = 0 at the screen leading edge.
 */
export type ProfilePocketGeometry = {
  pocketCenterX: number
  pocketCenterY: number
  pocketRadius: number
  avatarCenterX: number
  avatarCenterY: number
  avatarRadius: number
  haloExpansion: number
}

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
  pagerHeight: number
  /** Pull the portrait into the plateau row so it scrolls with the name. */
  avatarFlowTop: number
  avatarFlowLeft: number
  avatarCenterX: number
  avatarCenterY: number
  cradleRadius: number
  plateauRadius: number
  invertedCornerRadius: number
  stackedFallback: boolean
  pocket: ProfilePocketGeometry
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
  return profileAvatarSlotSize(compact, showFocusHalo, contentWidth) / 2 + PROFILE_LAYOUT.cradleGap
}

/**
 * Shared pocket + avatar centres. The SVG cradle and the painted portrait
 * must both use this — never offset one independently.
 */
export function profilePocketGeometry(
  compact: boolean,
  showFocusHalo: boolean,
  contentWidth = 393,
): ProfilePocketGeometry {
  const haloExpansion = profileHaloExtra(showFocusHalo)
  const avatarRadius = profileAvatarSlotSize(compact, showFocusHalo, contentWidth) / 2
  const pocketRadius = avatarRadius + PROFILE_LAYOUT.cradleGap
  const pocketCenterX = profileAvatarLead(contentWidth) + avatarRadius
  // Optical drop, if any, moves the shared centre — SVG and portrait together.
  const pocketCenterY = PROFILE_LAYOUT.plateauRadius + PROFILE_LAYOUT.avatarDrop
  return {
    pocketCenterX,
    pocketCenterY,
    pocketRadius,
    avatarCenterX: pocketCenterX,
    avatarCenterY: pocketCenterY,
    avatarRadius,
    haloExpansion,
  }
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
    profileCradleRadius(compact, showFocusHalo, contentWidth) +
      PROFILE_LAYOUT.plateauRadius +
      Math.max(0, PROFILE_LAYOUT.avatarDrop),
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
  const pocket = profilePocketGeometry(compact, showFocusHalo, contentWidth)
  const slotSize = paintedSize + pocket.haloExpansion
  const avatarLead = profileAvatarLead(contentWidth)
  const cradleRadius = pocket.pocketRadius
  const plateauRadius = PROFILE_LAYOUT.plateauRadius
  const plateauDepth = Math.round(
    cradleRadius + plateauRadius + Math.max(0, PROFILE_LAYOUT.avatarDrop),
  )
  const gutterWidth = avatarLead + slotSize
  const shelfDepth = cradleRadius - pocket.avatarRadius
  const identityColumnPad = PROFILE_LAYOUT.cradleGap + plateauRadius
  const avatarLeft = pocket.avatarCenterX - pocket.avatarRadius
  // Body overlap band is the overlay: y=0 at plateau. Portrait centre is the
  // pocket centre, minus the body padding that sits above the flow child.
  const avatarFlowTop =
    pocket.avatarCenterY - PROFILE_LAYOUT.identityPlateauGap - pocket.avatarRadius
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
    haloExpansion: pocket.haloExpansion,
    heroHorizontalInset: horizontalInset,
    avatarLead,
    avatarLeft,
    avatarLift: cradleRadius + pocket.avatarRadius,
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
    pagerHeight: PROFILE_LAYOUT.pagerMinHeight,
    avatarFlowTop,
    avatarFlowLeft,
    avatarCenterX: pocket.avatarCenterX,
    avatarCenterY: pocket.avatarCenterY,
    cradleRadius,
    plateauRadius,
    invertedCornerRadius: inverted.md,
    stackedFallback,
    pocket,
  }
}
