import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {describe, expect, it} from 'vitest'
import {assertWebGameDocumentPolicy, parseCspDirectives} from '../src/gubic/web-game-csp.js'
import {verifyWebGameArchive} from '../src/modules/github-release-sync-service.js'

// GUBIC-P1 / Sentinel §16.6: the web-game ingestion CSP gate must parse the
// effective policy instead of matching substrings anywhere in index.html.

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

function tarEntry(path: string, bytes: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(path, 0, 100)
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.fill(' ', 148, 156)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  const sum = header.reduce((total, byte) => total + byte, 0)
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return Buffer.concat([header, bytes, Buffer.alloc(Math.ceil(bytes.length / 512) * 512 - bytes.length)])
}

function gameArchive(html: string, members: Record<string, string> = {'main.js': 'document.title = "ok"'}): Buffer {
  const files: Record<string, Buffer> = {'index.html': Buffer.from(html)}
  for (const [path, body] of Object.entries(members)) files[path] = Buffer.from(body)
  const inventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, sha256(bytes)]))}))
  return gzipSync(Buffer.concat([...Object.entries(files).map(([path, bytes]) => tarEntry(path, bytes)), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
}

const STRICT = "default-src 'none'; script-src 'self'; connect-src 'none'; object-src 'none'"
const meta = (policy: string) => `<meta http-equiv="Content-Security-Policy" content="${policy}">`
const doc = (head: string, body = '<canvas></canvas><script src="main.js"></script>') =>
  `<!doctype html><html><head><meta charset="utf-8">${head}<title>Reference</title></head><body>${body}</body></html>`

describe('GUBIC web game CSP gate', () => {
  it('accepts a valid restrictive CSP with local scripts, images and styles', () => {
    const html = doc(meta(`${STRICT}; img-src 'self' data: blob:; style-src 'self'; media-src 'self'; base-uri 'none'; form-action 'none'`))
    expect(() => verifyWebGameArchive(gameArchive(html, {'main.js': 'const f = (x) => x * 2; window.evaluate = f; window.myeval = 1'}))).not.toThrow()
    expect([...parseCspDirectives(STRICT).keys()]).toEqual(['default-src', 'script-src', 'connect-src', 'object-src'])
    // Single-quoted attribute, entity-encoded quotes and the bare legacy fixture form are equivalent.
    expect(() => verifyWebGameArchive(gameArchive(`<meta http-equiv='content-security-policy' content="default-src &#39;none&#39;; script-src &apos;self&apos;; connect-src 'none'">`))).not.toThrow()
  })

  it("(a) rejects 'unsafe-eval'", () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta("default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'")))))
      .toThrow(/must not allow 'unsafe-eval'/)
  })

  it("(a) rejects 'unsafe-inline', including outside script-src", () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta("default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'none'")))))
      .toThrow(/must not allow 'unsafe-inline'/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(`${STRICT}; style-src 'self' 'unsafe-inline'`)))))
      .toThrow(/must not allow 'unsafe-inline'/)
  })

  it('(a) rejects a remote, wildcard, data: or blob: script-src', () => {
    for (const source of ['https://evil.example', 'evil.example', '*', 'https:', 'http://cdn.example/x.js', 'data:', 'blob:']) {
      expect(() => verifyWebGameArchive(gameArchive(doc(meta(`default-src 'none'; script-src 'self' ${source}; connect-src 'none'`)))), source)
        .toThrow(/script-src|wildcard/)
    }
    // Sentinel's exact probe (a).
    expect(() => verifyWebGameArchive(gameArchive(doc(meta("default-src 'none'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://evil.example; connect-src 'none'"))))).toThrow(/VALIDATION|unsafe/)
  })

  it('(b) rejects a CSP that exists only inside an HTML comment', () => {
    const html = `<!doctype html><html><head><!-- ${meta(STRICT)} --></head><body><script>eval("1")</script></body></html>`
    expect(() => verifyWebGameArchive(gameArchive(html))).toThrow(/no effective CSP meta element/)
    // ... or only as text inside a raw-text element, or with an unterminated comment.
    expect(() => verifyWebGameArchive(gameArchive(`<title>${meta(STRICT)}</title>`))).toThrow(/no effective CSP/)
    expect(() => verifyWebGameArchive(gameArchive(`<!-- ${meta(STRICT)}`))).toThrow(/no effective CSP/)
    // The legacy substring form with no meta element at all.
    expect(() => verifyWebGameArchive(gameArchive(`<p>Content-Security-Policy: ${STRICT}</p>`))).toThrow(/no effective CSP/)
  })

  it('rejects more than one CSP meta, a late CSP meta, or connect-src *', () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT) + meta(STRICT))))).toThrow(/exactly one CSP meta/)
    expect(() => verifyWebGameArchive(gameArchive(`<script src="main.js"></script>${meta(STRICT)}`))).toThrow(/in <head> before any other content/)
    expect(() => verifyWebGameArchive(gameArchive(`<p>hi</p>${meta(STRICT)}`))).toThrow(/in <head> before any other content/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta("default-src 'none'; script-src 'self'; connect-src *"))))).toThrow(/wildcard|connect-src/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta("default-src 'none'; script-src 'self'; connect-src https://api.example"))))).toThrow(/connect-src/)
  })

  it('(c) rejects a duplicated directive such as a second connect-src *', () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(`${STRICT}; connect-src *`))))).toThrow(/repeats the connect-src directive/)
  })

  it('(d) rejects a remote <script src> tag', () => {
    for (const src of ['https://evil.example/x.js', 'http://evil.example/x.js', '//evil.example/x.js', 'data:text/javascript,1', 'blob:abc', 'javascript:1']) {
      expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT), `<script src="${src}"></script>`))), src).toThrow(/non-local script/)
    }
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT), '<script defer src=https://evil.example/x.js></script>')))).toThrow(/non-local script/)
    // A remote script in a comment is inert and does not change the verdict.
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT), '<!-- <script src="https://evil.example/x.js"></script> --><script src="main.js"></script>')))).not.toThrow()
  })

  it('(e) rejects eval( and new Function( in bundled scripts and inline scripts', () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT)), {'main.js': 'const x = eval("1+1")'}))).toThrow(/main\.js uses eval\(\)/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT)), {'main.js': 'window.eval ("1")'}))).toThrow(/uses eval\(\)/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT)), {'main.js': 'const f = new Function("return 1")'}))).toThrow(/uses new Function\(\)/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT)), {'main.js': 'ok()', 'lib/engine.mjs': 'eval(code)'}))).toThrow(/lib\/engine\.mjs uses eval/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT), '<script>eval("1")</script>')))).toThrow(/inline script\) uses eval/)
  })

  it('applies the same policy to every HTML document in the archive', () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT)), {'main.js': 'ok()', 'levels/menu.html': '<p>no policy</p>'}))).toThrow(/levels\/menu\.html/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT)), {'main.js': 'ok()', 'levels/menu.html': doc(meta(STRICT))}))).not.toThrow()
  })

  it('refuses directives and sources it does not understand', () => {
    expect(() => assertWebGameDocumentPolicy(doc(meta(`${STRICT}; report-uri https://collector.example`)), 'index.html')).toThrow(/not permitted: report-uri/)
    expect(() => assertWebGameDocumentPolicy(doc(meta(`${STRICT}; img-src https://cdn.example`)), 'index.html')).toThrow(/remote or non-local/)
    expect(() => assertWebGameDocumentPolicy(doc(meta("default-src 'self'; script-src 'self'; connect-src 'none'")), 'index.html')).toThrow(/default-src 'none'/)
    expect(() => assertWebGameDocumentPolicy(doc(meta("default-src 'none'; connect-src 'none'")), 'index.html')).toThrow(/script-src 'self'/)
    expect(() => assertWebGameDocumentPolicy(doc(meta(`${STRICT}, script-src *`)), 'index.html')).toThrow(/single policy/)
    expect(() => assertWebGameDocumentPolicy(doc(meta("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'")), 'index.html')).toThrow(/wasm-unsafe-eval/)
  })
})
