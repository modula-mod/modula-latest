/**
 * Test fixture modelling a Phaser HTML5 GUBIC package whose loader fetches the
 * package's own files (ATLAS ruling 21 Nov 2026: connect-src 'self').
 *
 * Phaser's LoaderPlugin uses XMLHttpRequest for every file type, so a JSON
 * texture atlas, a bitmap-font XML and audio are all governed by connect-src.
 * With connect-src 'self' they load from the per-package isolated origin
 * (`modula-pkg://<packageId>/` on native); a fetch to the API origin or any
 * remote host stays blocked because no other connect source is allowed and
 * default-src is 'none'.
 *
 * The bytes are small stand-ins (a 1x1 PNG, minimal Ogg/MP3 headers) and the
 * "Phaser" script is a stub: the server only validates the package, it never
 * executes it. Package IDs use the reserved test.modula.* namespace.
 */

export const PHASER_TEST_PACKAGE_ID = 'test.modula.gubic-phaser-connect-self'

/** The document (meta) policy a Phaser package declares under the 21 Nov ruling; see spec §4.2 for the host header. */
export const PHASER_CONNECT_SELF_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; " +
  "connect-src 'self'; object-src 'none'; base-uri 'none'; worker-src 'none'; form-action 'none'"

/**
 * Extension → MIME map from docs/gubic/GUBIC-PLATFORM-SPEC.md §4.2 (the native
 * handler's map). Test-only mirror: the server does not serve package members.
 */
export const GUBIC_PACKAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
)

const index = (csp: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">` +
  `<title>Phaser connect-self fixture</title><link rel="stylesheet" href="style.css"></head>` +
  `<body><div id="game"></div><script src="vendor/phaser.min.js"></script><script src="main.js"></script></body></html>`

const PHASER_STUB = [
  '/* Stand-in for a bundled Phaser build (never loaded from a CDN). */',
  'window.Phaser = { AUTO: 0, Game: function Game(config) { this.config = config } }',
].join('\n')

const MAIN = [
  "const config = { type: Phaser.AUTO, parent: 'game', width: 320, height: 480, scene: { preload, create } }",
  'function preload() {',
  "  // Relative URLs resolve against the package origin; every one is an XHR under connect-src 'self'.",
  "  this.load.atlas('sprites', 'assets/sprites.png', 'assets/sprites.json')",
  "  this.load.bitmapFont('score', 'assets/score.png', 'assets/score.xml')",
  "  this.load.audio('jump', ['assets/jump.ogg', 'assets/jump.mp3', 'assets/jump.m4a', 'assets/jump.wav'])",
  "  this.load.json('levels', 'data/levels.json')",
  '}',
  "function create() { this.add.image(160, 240, 'sprites', 'star') }",
  'new Phaser.Game(config)',
].join('\n')

const ATLAS = JSON.stringify({
  frames: {star: {frame: {x: 0, y: 0, w: 1, h: 1}, rotated: false, trimmed: false, spriteSourceSize: {x: 0, y: 0, w: 1, h: 1}, sourceSize: {w: 1, h: 1}}},
  meta: {app: 'fixture', version: '1.0', image: 'sprites.png', format: 'RGBA8888', size: {w: 1, h: 1}, scale: '1'},
})

const BITMAP_FONT_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<font>',
  '  <info face="Score" size="16" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="1,1"/>',
  '  <common lineHeight="16" base="13" scaleW="1" scaleH="1" pages="1" packed="0"/>',
  '  <pages><page id="0" file="score.png"/></pages>',
  '  <chars count="1"><char id="48" x="0" y="0" width="1" height="1" xoffset="0" yoffset="0" xadvance="8" page="0" chnl="15"/></chars>',
  '</font>',
].join('\n')

/** Members other than index.html (the inventory, game.files.json, is added by the archive builder). */
export function phaserPackageMembers(): Record<string, Buffer> {
  return {
    'style.css': Buffer.from('html, body { margin: 0; background: #000 }'),
    'vendor/phaser.min.js': Buffer.from(PHASER_STUB),
    'main.js': Buffer.from(MAIN),
    'assets/sprites.png': PNG_1X1,
    'assets/sprites.json': Buffer.from(ATLAS),
    'assets/score.png': PNG_1X1,
    'assets/score.xml': Buffer.from(BITMAP_FONT_XML),
    'assets/jump.ogg': Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60)]),
    'assets/jump.mp3': Buffer.concat([Buffer.from('ID3'), Buffer.from([0x04, 0, 0, 0, 0, 0, 0]), Buffer.alloc(32)]),
    'assets/jump.m4a': Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(12)]),
    'assets/jump.wav': Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(24)]),
    'data/levels.json': Buffer.from(JSON.stringify({levels: [{id: 1, stars: 3}]})),
  }
}

export function phaserIndexHtml(csp = PHASER_CONNECT_SELF_CSP): string {
  return index(csp)
}
