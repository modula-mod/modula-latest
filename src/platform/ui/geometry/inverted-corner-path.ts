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
  /** Horizontal centre of the avatar slot, in overlay coordinates. */
  avatarCenterX?: number
  /** Vertical centre of the avatar slot, in overlay coordinates. */
  avatarCenterY?: number
  /** Outer radius of the cover cradle around the avatar / Focus Halo. */
  cradleRadius?: number
  /** Convex radius where the cradle rise meets the raised plateau. */
  plateauRadius?: number
  /** Depth of the shelf below the raised plateau. */
  stepRise?: number
  /** Horizontal position of the riser between shelf and plateau. */
  stepX?: number
  /** Fillet radius used on both corners of the riser. */
  stepRadius?: number
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

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/**
 * Canvas lip at the bottom of a profile cover.
 *
 * Fills only to the right of `trayWidth` so the cover photo stays around the
 * avatar. The top-leading corner is inverted (sweep 0) — a concave join, not
 * a wrap under the avatar and not a convex rounded rect.
 */
export function buildCoverCanvasLipPath(
  width: number,
  height: number,
  options?: InvertedSurfacePathOptions,
): string {
  const w = clampNonNegative(width)
  const h = clampNonNegative(height)
  if (w <= 0 || h <= 0) return ''

  const trayW = Math.min(
    clampNonNegative(options?.trayWidth ?? PROFILE_COVER_INVERTED_DEFAULTS.trayWidth),
    w,
  )
  const available = w - trayW
  if (available <= 0) return ''

  const r = Math.min(
    clampNonNegative(options?.biteRadii?.[1] ?? inverted.profile),
    h,
    available,
  )
  const x0 = trayW

  if (r <= 0) {
    return M(x0, h) + H(w) + V(0) + H(x0) + V(h) + 'Z'
  }

  return M(x0, h) + H(w) + V(0) + H(x0 + r) + A(r, x0, r, 0) + V(h) + 'Z'
}

/**
 * Cover → canvas transition: a leading shelf that steps up to a raised plateau.
 *
 * This is the silhouette an inverted-corner generator emits — straight runs
 * joined by quarter arcs, so every join is tangent-continuous:
 *
 *   1. convex quarter arc taking the canvas from the cover edge up to the shelf
 *   2. flat shelf, which the portrait straddles
 *   3. concave quarter arc (sweep 0) — the inverted corner
 *   4. vertical riser
 *   5. convex quarter arc (sweep 1) onto the plateau
 *   6. flat plateau carrying identity
 *
 * The portrait is not cut out of the cover. It sits on the shelf and overlaps
 * it, so the gap around it is the Focus Halo rather than a hole in the artwork
 * that pinches whenever the avatar or the halo changes size.
 */
export function buildCoverShelfStepPath(
  width: number,
  height: number,
  options?: InvertedSurfacePathOptions,
): string {
  const w = clampNonNegative(width)
  const h = clampNonNegative(height)
  if (w <= 0 || h <= 0) return ''

  // Shelf depth below the plateau. The band is `rise + lead` tall: the plateau
  // at y=0, the shelf at y=rise, the cover edge at y=h.
  const rise = Math.min(clampNonNegative(options?.stepRise ?? inverted.lg), h)
  const shelfY = rise
  const lead = Math.min(
    clampNonNegative(options?.cornerRadius ?? inverted.md),
    Math.max(0, h - shelfY),
    w / 2,
  )
  const stepX = Math.min(
    Math.max(lead, clampNonNegative(options?.stepX ?? w / 2)),
    w,
  )
  // Both riser corners share a radius so the step reads as one move. It cannot
  // exceed half the rise (the riser would invert) or the runs either side.
  const fillet = Math.min(
    clampNonNegative(options?.stepRadius ?? inverted.md),
    rise / 2,
    Math.max(0, stepX - lead),
    Math.max(0, w - stepX),
  )

  const leadIn = lead > 0 ? M(0, shelfY + lead) + A(lead, lead, shelfY) : M(0, shelfY)
  const tail = H(w) + V(h) + H(0) + 'Z'

  if (rise <= 0 || fillet <= 0) {
    return leadIn + H(stepX) + V(0) + tail
  }

  return (
    leadIn +
    H(stepX - fillet) +
    A(fillet, stepX, shelfY - fillet, 0) +
    V(fillet) +
    A(fillet, stepX + fillet, 0) +
    tail
  )
}

/**
 * Cover → canvas transition that cradles the avatar with inverted corners.
 *
 * Straight runs joined by quarter arcs (G1) — the construction an inverted
 * corner generator emits around a circle, not a 90° step:
 *
 *   1. flat leading shelf, tangent to the bottom of the cradle
 *   2. concave quarter (sweep 0) concentric with the avatar
 *   3. convex quarter (sweep 1) onto the raised plateau
 *   4. flat plateau carrying the display name
 *
 * The plateau sits at the avatar centre so the name reads beside the portrait.
 * `avatarCenterX` / `avatarCenterY` / `cradleRadius` must come from
 * `profilePocketGeometry()` — do not invent a second centre for the SVG.
 */
export function buildAvatarCradleRisePath(
  width: number,
  height: number,
  options?: InvertedSurfacePathOptions,
): string {
  const w = clampNonNegative(width)
  const h = clampNonNegative(height)
  if (w <= 0 || h <= 0) return ''

  const r = Math.min(
    clampNonNegative(options?.cradleRadius ?? inverted.profile),
    h,
    w * 0.5,
  )
  const cx = Math.min(
    Math.max(
      0,
      clampNonNegative(
        options?.avatarCenterX ??
          options?.trayWidth ??
          PROFILE_COVER_INVERTED_DEFAULTS.trayWidth,
      ),
    ),
    Math.max(0, w - r),
  )
  const cy = clampNonNegative(options?.avatarCenterY ?? h - r)
  const baseY = Math.min(h, cy + r)
  const riseX = Math.min(w, cx + r)
  const plateauY = 0
  const plateau = Math.min(
    clampNonNegative(options?.plateauRadius ?? inverted.md),
    Math.max(0, w - riseX),
    Math.max(0, cy - plateauY),
  )

  if (r <= 0 || riseX >= w) {
    return M(0, baseY) + H(w) + V(h) + H(0) + 'Z'
  }

  return (
    M(0, baseY) +
    H(cx) +
    A(r, riseX, cy, 0) +
    V(plateauY + plateau) +
    A(plateau, riseX + plateau, plateauY) +
    H(w) +
    V(h) +
    H(0) +
    'Z'
  )
}

/**
 * Canvas cradle around the avatar.
 *
 * Fills the overlay except an upper semicircle centred on the cover/body
 * line. Kept as a geometry primitive; Profile cover uses the cradle-rise
 * path so the trailing identity plateau can rise into the cover.
 */
export function buildAvatarCradlePath(
  width: number,
  height: number,
  options?: InvertedSurfacePathOptions,
): string {
  const w = clampNonNegative(width)
  const h = clampNonNegative(height)
  if (w <= 0 || h <= 0) return ''

  const radius = Math.min(
    clampNonNegative(options?.cradleRadius ?? inverted.profile),
    h,
    w / 2,
  )
  const cx = Math.min(
    Math.max(
      radius,
      clampNonNegative(
        options?.avatarCenterX ??
          options?.trayWidth ??
          PROFILE_COVER_INVERTED_DEFAULTS.trayWidth,
      ),
    ),
    w - radius,
  )

  if (radius <= 0) {
    return M(0, h) + H(w) + V(0) + H(0) + 'Z'
  }

  return (
    M(0, h) +
    H(cx - radius) +
    A(radius, cx + radius, h, 0) +
    H(w) +
    V(0) +
    H(0) +
    V(h) +
    'Z'
  )
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
  if (options?.avatarCenterX != null && options?.cradleRadius != null) {
    return buildAvatarCradleRisePath(width, height, options)
  }
  if (options?.stepX != null || options?.stepRise != null) {
    return buildCoverShelfStepPath(width, height, options)
  }
  return buildCoverCanvasLipPath(width, height, options)
}

/**
 * Fill path for a compact selected surface with one inverted bottom-trailing
 * corner — kept as a geometry primitive. Profile Metric Picker does not use
 * this; a concave selected pill read as a broken control.
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
