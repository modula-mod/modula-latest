/**
 * SVG path builder for inverted corners — port of the geometry from
 * https://corner-inverter.douiri.org (AstroDriss/inverted-corners-generator).
 *
 * Regular corners use sweep=1 arcs; the concave bite uses sweep=0.
 */

type InvertedCorner = {
  width: number
  height: number
  /** [leading fillet, inverted fillet, trailing fillet] */
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
 * the white/canvas action tray from the reference post UI.
 */
export function buildMediaInvertedCornerPath(
  width: number,
  height: number,
  options?: {
    cornerRadius?: number
    trayWidth?: number
    trayHeight?: number
    /** Fillet radii around the inverted bite. */
    biteRadii?: [number, number, number]
  },
): string {
  const r = Math.min(options?.cornerRadius ?? 36, width / 4, height / 4)
  const trayW = Math.min(options?.trayWidth ?? 196, width * 0.65)
  const trayH = Math.min(options?.trayHeight ?? 62, height * 0.22)
  const bite = options?.biteRadii ?? [22, 28, 22]
  const [c0, c1, c2] = bite.map(v =>
    Math.min(v, trayW / 2, trayH / 2),
  ) as [number, number, number]

  const bl: InvertedCorner = {
    width: trayW,
    height: trayH,
    corners: [c0, c1, c2],
  }

  // Clockwise outline — same order as corner-inverter generatePath.
  let path = M(r, 0)
  path += H(width - r)
  path += A(r, width, r) // top-right
  path += V(height - r)
  path += A(r, width - r, height) // bottom-right
  path += H(bl.width + bl.corners[0])
  path += drawInvertedBottomLeft(bl, {x: bl.width, y: height})
  path += V(r)
  path += A(r, r, 0) // top-left
  path += 'Z'
  return path
}
