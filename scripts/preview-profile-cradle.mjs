/**
 * Renders the Profile cover → canvas silhouette to an SVG so the inverted
 * corner can be reviewed without booting a simulator.
 *
 * node scripts/preview-profile-cradle.mjs [outFile]
 */
import {writeFileSync} from 'node:fs'

const A = (r, x, y, sweep = 1) => `A${r},${r} 0,0,${sweep} ${x},${y}`
const H = x => `H${x}`
const V = y => `V${y}`
const M = (x, y) => `M${x},${y}`

function buildAvatarCradleRisePath(w, h, o) {
  const r = Math.min(o.cradleRadius, h, w * 0.42)
  const cx = Math.min(Math.max(0, o.avatarCenterX), Math.max(0, w - r))
  const cy = o.avatarCenterY ?? h - r
  const leftX = Math.max(0, cx - r)
  const nadirY = Math.min(h, cy + r)
  const riseX = Math.min(w, cx + r)
  const plateau = Math.min(o.plateauRadius, Math.max(0, w - riseX), Math.max(0, cy))
  return (
    M(0, cy) +
    H(leftX) +
    A(r, cx, nadirY, 0) +
    A(r, riseX, cy, 0) +
    V(plateau) +
    A(plateau, riseX + plateau, 0) +
    H(w) +
    V(h) +
    H(0) +
    'Z'
  )
}

const W = 393
const INSET = 16
const SLOT = 81
const GAP = 14
const R = SLOT / 2 + GAP
const H_BAND = Math.round(R + SLOT / 2 + 4)
const CX = INSET + SLOT / 2
const CY = H_BAND - R
const COVER_BODY = 158

const d = buildAvatarCradleRisePath(W, H_BAND, {
  avatarCenterX: CX,
  avatarCenterY: CY,
  cradleRadius: R,
  plateauRadius: 16,
})

const bandTop = COVER_BODY - H_BAND
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="260" viewBox="0 0 ${W} 260">
  <rect width="${W}" height="${COVER_BODY}" fill="#3d5a6c"/>
  <rect y="${COVER_BODY}" width="${W}" height="${260 - COVER_BODY}" fill="#ffffff"/>
  <g transform="translate(0 ${bandTop})"><path d="${d}" fill="#ffffff"/></g>
  <circle cx="${CX}" cy="${bandTop + CY}" r="${SLOT / 2}" fill="#cfe6e4" stroke="#ffffff" stroke-width="0"/>
  <text x="${CX + R + 4}" y="${bandTop + CY - SLOT / 2 + 26}" font-family="-apple-system,Helvetica" font-size="24" font-weight="700" fill="#111">Andrei</text>
  <text x="${CX + R + 4}" y="${bandTop + CY - SLOT / 2 + 46}" font-family="-apple-system,Helvetica" font-size="13" fill="#666">@andrei.modula · he/him</text>
  <text x="${CX + R + 4}" y="${bandTop + CY - SLOT / 2 + 72}" font-family="-apple-system,Helvetica" font-size="14" fill="#111">Building Modula — a modular Social</text>
</svg>`

const out = process.argv[2] ?? '/tmp/profile-cradle.svg'
writeFileSync(out, svg)
console.log(
  JSON.stringify(
    {out, band: H_BAND, cradleRadius: R, avatar: {cx: CX, cy: CY}, path: d},
    null,
    2,
  ),
)
