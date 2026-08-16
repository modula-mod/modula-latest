import {inverted} from '@/theme/foundations/inverted'
import {radius} from '@/theme/foundations/radius'

/**
 * SVG path builders for inverted (concave) corners.
 *
 * Convex radii live in `radius`. Concave bites live in `inverted`.
 * Profile cover transitions and media trays share this primitive so feature
 * code does not scatter path magic numbers.
 */

const A = (r: number, x: number, y: number, sweep = 1) =>
  `A${r},${r} 0,0,${sweep} ${x},${y}`
const H = (x: number) => `H${x}`
const V = (y: number) => `V${y}`
const M = (x: number, y: number) => `M${x},${y}`

export type InvertedBiteRadii = [number, number, number]

export type InvertedSurfacePathOptions = {
  /** Convex radius on the uncut corners of the surface. */
  cornerRadius?: number
  /** Width of the inverted tray / cutout. */
  trayWidth?: number
  /** Height of the inverted tray / cutout. */
  trayHeight?: number
  /** [leading fillet, inverted fillet, trailing fillet] */
  biteRadii?: InvertedBiteRadii
}

export const PROFILE_COVER_INVERTED_DEFAULTS = {
  cornerRadius: radius.medium,
  trayWidth: 128,
  trayHeight: 56,
  biteRadii: [inverted.sm, inverted.profile, inverted.sm] as InvertedBiteRadii,
}

function clampBite(
  bite: InvertedBiteRadii,
  trayW: number,
  trayH: number,
): InvertedBiteRadii {
  return bite.map(value =>
    Math.min(value, trayW / 2, trayH / 2),
  ) as InvertedBiteRadii
}

/**
 * Fill path for a band whose top-leading corner is inverted.
 * Used as a canvas-coloured overlay at the bottom of a profile cover so the
 * body appears to wrap around the avatar.
 */
export function buildTopLeadingInvertedPath(
  width: number,
  height: number,
  options?: InvertedSurfacePathOptions,
): string {
  const defaults = PROFILE_COVER_INVERTED_DEFAULTS
  const trayW = Math.min(options?.trayWidth ?? defaults.trayWidth, Math.max(48, width * 0.62))
  const trayH = Math.min(
    options?.trayHeight ?? defaults.trayHeight,
    Math.max(24, height - 2),
  )
  const r = Math.min(
    options?.cornerRadius ?? defaults.cornerRadius,
    width / 6,
    height / 2,
  )
  const [c0, c1, c2] = clampBite(
    options?.biteRadii ?? defaults.biteRadii,
    trayW,
    trayH,
  )

  let path = M(0, height)
  path += H(width)
  path += V(r)
  path += A(r, width - r, 0)
  path += H(trayW + c0)
  path += A(c0, trayW, c0)
  path += V(trayH - c1)
  path += A(c1, trayW - c1, trayH, 0)
  path += H(c2)
  path += A(c2, 0, trayH + c2)
  path += V(height)
  path += 'Z'
  return path
}

/**
 * Fill path for a compact selected surface with one inverted bottom-trailing
 * corner — used by the Profile Metric Picker when the geometry clarifies
 * selection without becoming a second card.
 */
export function buildSelectedInvertedSurfacePath(
  width: number,
  height: number,
  options?: InvertedSurfacePathOptions,
): string {
  const r = Math.min(
    options?.cornerRadius ?? radius.medium,
    width / 4,
    height / 4,
  )
  const bite = options?.biteRadii ?? ([inverted.xs, inverted.sm, inverted.xs] as InvertedBiteRadii)
  const trayW = Math.min(options?.trayWidth ?? 28, width * 0.4)
  const trayH = Math.min(options?.trayHeight ?? 16, height * 0.4)
  const [c0, c1, c2] = clampBite(bite, trayW, trayH)

  let path = M(r, 0)
  path += H(width - r)
  path += A(r, width, r)
  path += V(height - trayH - c2)
  path += A(c2, width - c2, height - trayH)
  path += H(width - trayW + c1)
  path += A(c1, width - trayW, height - trayH + c1, 0)
  path += V(height - c0)
  path += A(c0, width - trayW - c0, height)
  path += H(r)
  path += A(r, 0, height - r)
  path += V(r)
  path += A(r, r, 0)
  path += 'Z'
  return path
}
