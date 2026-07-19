/**
 * SVG path builder for inverted corners — port of the geometry from
 * https://corner-inverter.douiri.org (AstroDriss/inverted-corners-generator).
 *
 * Regular corners use sweep=1 arcs; the concave bite uses sweep=0.
 */

export type MediaInvertedCornerOptions = {
  cornerRadius?: number
  trayWidth?: number
  trayHeight?: number
  /** [leading fillet, inverted fillet, trailing fillet] */
  biteRadii?: [number, number, number]
}

/** Tuned for feed media posts — larger concave fillet reads closer to the reference. */
export const MEDIA_INVERTED_DEFAULTS = {
  cornerRadius: 40,
  trayWidth: 204,
  trayHeight: 68,
  biteRadii: [22, 36, 22] as [number, number, number],
}

type InvertedCorner = {
  width: number
  height: number
  corners: [number, number, number]
}

const A = (r: number, x: number, y: number, sweep = 1) =>
  `A${r},${r} 0,0,${sweep} ${x},${y}`
const H = (x: number) => `H${x}`
const V = (y: number) => `V${y}`
const M = (x: number, y: number) => `M${x},${y}`

function drawInvertedBottomLeft(
  corner: InvertedCorner,
  origin: {x: number; y: number},
): string {
  const [c0, c1, c2] = corner.corners
  const {x, y} = origin
  const {width, height} = corner
  return (
    A(c0, x, y - c0) +
    V(y - height + c1) +
    A(c1, x - c1, y - height, 0) +
    H(x - width + c2) +
    A(c2, x - width, y - height - c2)
  )
}

/**
 * Rounded rect with an inverted (concave) bottom-left corner —
 * the canvas action tray from the reference post UI.
 */
export function buildMediaInvertedCornerPath(
  width: number,
  height: number,
  options?: MediaInvertedCornerOptions,
): string {
  const r = Math.min(
    options?.cornerRadius ?? MEDIA_INVERTED_DEFAULTS.cornerRadius,
    width / 4,
    height / 4,
  )
  const trayW = Math.min(
    options?.trayWidth ?? MEDIA_INVERTED_DEFAULTS.trayWidth,
    width * 0.65,
  )
  const trayH = Math.min(
    options?.trayHeight ?? MEDIA_INVERTED_DEFAULTS.trayHeight,
    height * 0.22,
  )
  const bite = options?.biteRadii ?? MEDIA_INVERTED_DEFAULTS.biteRadii
  const [c0, c1, c2] = bite.map(v =>
    Math.min(v, trayW / 2, trayH / 2),
  ) as [number, number, number]

  const bl: InvertedCorner = {
    width: trayW,
    height: trayH,
    corners: [c0, c1, c2],
  }

  let path = M(r, 0)
  path += H(width - r)
  path += A(r, width, r)
  path += V(height - r)
  path += A(r, width - r, height)
  path += H(bl.width + bl.corners[0])
  path += drawInvertedBottomLeft(bl, {x: bl.width, y: height})
  path += V(r)
  path += A(r, r, 0)
  path += 'Z'
  return path
}
