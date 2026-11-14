import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {describe, expect, it} from 'vitest'
import {assertNoRemoteWorkers, assertStaticSvg, assertWebGameDocumentPolicy, isSvgMember, parseCspDirectives, WebGameContentPolicyError} from '../src/gubic/web-game-csp.js'
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

function gameArchive(html: string, members: Record<string, string | Buffer> = {'main.js': 'document.title = "ok"'}): Buffer {
  const files: Record<string, Buffer> = {'index.html': Buffer.from(html)}
  for (const [path, body] of Object.entries(members)) files[path] = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const inventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, sha256(bytes)]))}))
  return gzipSync(Buffer.concat([...Object.entries(files).map(([path, bytes]) => tarEntry(path, bytes)), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
}

const STRICT = "default-src 'none'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; worker-src 'none'"
const meta = (policy: string) => `<meta http-equiv="Content-Security-Policy" content="${policy}">`
const doc = (head: string, body = '<canvas></canvas><script src="main.js"></script>') =>
  `<!doctype html><html><head><meta charset="utf-8">${head}<title>Reference</title></head><body>${body}</body></html>`

describe('GUBIC web game CSP gate', () => {
  it('accepts a valid restrictive CSP with local scripts, images and styles', () => {
    const html = doc(meta(`${STRICT}; img-src 'self' data: blob:; style-src 'self'; media-src 'self'; form-action 'none'`))
    expect(() => verifyWebGameArchive(gameArchive(html, {'main.js': 'const f = (x) => x * 2; window.evaluate = f; window.myeval = 1'}))).not.toThrow()
    expect([...parseCspDirectives(STRICT).keys()]).toEqual(['default-src', 'script-src', 'connect-src', 'object-src', 'base-uri', 'worker-src'])
    // Single-quoted attribute, entity-encoded quotes and the bare legacy fixture form are equivalent.
    expect(() => verifyWebGameArchive(gameArchive(`<meta http-equiv='content-security-policy' content="default-src &#39;none&#39;; script-src &apos;self&apos;; connect-src 'none'; base-uri &#x27;none&#x27;; worker-src 'none'">`))).not.toThrow()
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
    expect(() => assertWebGameDocumentPolicy(doc(meta("default-src 'none'; connect-src 'none'; base-uri 'none'; worker-src 'none'")), 'index.html')).toThrow(/script-src 'self'/)
    expect(() => assertWebGameDocumentPolicy(doc(meta(`${STRICT}, script-src *`)), 'index.html')).toThrow(/single policy/)
    expect(() => assertWebGameDocumentPolicy(doc(meta("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'")), 'index.html')).toThrow(/wasm-unsafe-eval/)
  })
})

// Prism blocker: SVG members are documents, not inert images, when they are
// navigated to or embedded as <object>/<iframe>. Script-capable SVG is refused.
describe('GUBIC web game SVG members', () => {
  const STATIC_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- static artwork -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" width="10" height="10">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs>
  <style>.a { fill: url(#g); opacity: .5 }</style>
  <rect class="a" width="10" height="10" style="stroke: url(#g)"/>
  <use xlink:href="#g"/><use href="sprites.svg#coin"/><image href="coin.png" width="2" height="2"/>
  <a href="#top"><text x="1" y="5" font-family="sans-serif">One more turn</text></a>
</svg>`
  const withSvg = (svg: string | Buffer, path = 'art/sprite.svg') =>
    gameArchive(doc(meta(STRICT)), {'main.js': 'ok()', [path]: svg})
  const svgDoc = (inner: string, root = '<svg xmlns="http://www.w3.org/2000/svg">') => `${root}${inner}</svg>`
  const rejection = (svg: string | Buffer, path?: string) => {
    try {
      verifyWebGameArchive(withSvg(svg, path))
    } catch (error) {
      return (error as Error).message
    }
    throw new Error('expected the SVG to be rejected')
  }

  it('accepts benign static SVG, plain and gzip-compressed', () => {
    expect(() => verifyWebGameArchive(withSvg(STATIC_SVG))).not.toThrow()
    expect(() => verifyWebGameArchive(withSvg(gzipSync(Buffer.from(STATIC_SVG)), 'art/sprite.svgz'))).not.toThrow()
    // Words like "onwards" or "javascript" in text content are not active content.
    expect(() => verifyWebGameArchive(withSvg(svgDoc('<text>Onwards! Learn javascript later.</text>')))).not.toThrow()
    expect(() => assertStaticSvg(Buffer.from(STATIC_SVG), 'x.svg')).not.toThrow()
  })

  it('rejects <script>, in any case, with a namespace prefix or whitespace', () => {
    for (const inner of ['<script>alert(1)</script>', '<SCRIPT >alert(1)</SCRIPT>', '<svg:script href="a.js"/>', '< script>1</script>']) {
      expect(rejection(svgDoc(inner)), inner).toMatch(/^\[GUBIC_SVG_ACTIVE_CONTENT\] .*<script> element/)
    }
  })

  it('rejects on*= event-handler attributes', () => {
    for (const root of ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">', '<svg xmlns="http://www.w3.org/2000/svg" ONLOAD = \'x()\'>', '<svg xmlns="http://www.w3.org/2000/svg"\n\tonclick=x()>']) {
      expect(rejection(svgDoc('', root)), root).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*event-handler attribute/)
    }
    expect(rejection(svgDoc('<rect width="1" height="1" onmouseover="steal()"/>'))).toMatch(/event-handler attribute \(onmouseover\)/)
    expect(rejection(svgDoc('<set attributeName="fill" to="red" begin="0s" svg:onbegin="x()"/>'))).toMatch(/event-handler/)
  })

  it('rejects <foreignObject>', () => {
    expect(rejection(svgDoc('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>')))
      .toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*<foreignObject>/)
    expect(rejection(svgDoc('<FOREIGNOBJECT/>'))).toMatch(/foreignObject/)
  })

  it('rejects javascript: URLs, including encoded and whitespace-split forms', () => {
    for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' java\tscript:alert(1)', 'java&#x09;script:alert(1)', '&#106;avascript:alert(1)', 'javascript&colon;alert(1)', 'java&Tab;script:x']) {
      expect(rejection(svgDoc(`<a xlink:href="${href}"><text>x</text></a>`)), href).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*script URL/)
    }
    // SMIL can rewrite href to a script URL at runtime.
    expect(rejection(svgDoc('<a><set attributeName="href" to="javascript:alert(1)"/></a>'))).toMatch(/script URL \(to\)/)
  })

  it('rejects external href / xlink:href references and remote stylesheets', () => {
    for (const ref of ['https://evil.example/x.svg#a', 'http://evil.example/a.png', '//evil.example/a.png', 'HTTPS://evil.example/a']) {
      expect(rejection(svgDoc(`<use href="${ref}"/>`)), ref).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*external reference/)
      expect(rejection(svgDoc(`<image xlink:href="${ref}"/>`)), ref).toMatch(/external reference \(xlink:href=/)
    }
    expect(rejection(svgDoc('<rect style="fill:url(https://evil.example/p.svg#x)"/>'))).toMatch(/external url\(\) reference/)
    expect(rejection(svgDoc('<style>@import "https://evil.example/a.css";</style>'))).toMatch(/external stylesheet/)
    expect(rejection(svgDoc('<style>rect { fill: url( //evil.example/p#x ) }</style>'))).toMatch(/external stylesheet/)
  })

  it('rejects entity declarations and xml-stylesheet processing instructions', () => {
    expect(rejection(`<!DOCTYPE svg [<!ENTITY x "&#60;script&#62;alert(1)&#60;/script&#62;">]>${svgDoc('&x;')}`)).toMatch(/XML entity declaration/)
    expect(rejection(`<?xml-stylesheet type="text/xsl" href="evil.xsl"?>${svgDoc('')}`)).toMatch(/xml-stylesheet/)
  })

  it('finds SVG by content sniffing even without an .svg extension, but not in images or HTML', () => {
    const evil = svgDoc('<script>alert(1)</script>')
    expect(rejection(evil, 'art/sprite.png')).toMatch(/GUBIC_SVG_ACTIVE_CONTENT/)
    expect(rejection(`<?xml version="1.0"?>\n<!-- c -->\n<!DOCTYPE svg>\n${evil}`, 'art/data.bin')).toMatch(/GUBIC_SVG_ACTIVE_CONTENT/)
    expect(rejection(gzipSync(Buffer.from(evil)), 'art/sprite.dat')).toMatch(/GUBIC_SVG_ACTIVE_CONTENT/)
    expect(isSvgMember('art/sprite.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe(false)
    expect(isSvgMember('notes.txt', Buffer.from('plain text mentioning <svg> later'))).toBe(false)
    expect(isSvgMember('index.html', Buffer.from(evil))).toBe(false)
  })

  it('exposes the error code on the thrown error', () => {
    try {
      assertStaticSvg(Buffer.from(svgDoc('<script/>')), 'a.svg')
      throw new Error('not rejected')
    } catch (error) {
      expect(error).toBeInstanceOf(WebGameContentPolicyError)
      expect((error as WebGameContentPolicyError).code).toBe('GUBIC_SVG_ACTIVE_CONTENT')
    }
  })
})

// Sentinel CSP hardening for game documents.
describe('GUBIC web game HTML hardening', () => {
  const html = (body: string, head = meta(STRICT)) => gameArchive(doc(head, body))
  const htmlRejection = (archive: Buffer) => {
    try {
      verifyWebGameArchive(archive)
    } catch (error) {
      return (error as Error).message
    }
    throw new Error('expected the document to be rejected')
  }
  const without = (directive: string) => STRICT.split('; ').filter((part) => !part.startsWith(directive)).join('; ')

  it("requires base-uri 'none' and worker-src 'none'", () => {
    expect(() => verifyWebGameArchive(html('<script src="main.js"></script>'))).not.toThrow()
    expect(htmlRejection(html('', meta(without('base-uri'))))).toMatch(/must set base-uri 'none'/)
    expect(htmlRejection(html('', meta(without('worker-src'))))).toMatch(/must set worker-src 'none'/)
    expect(htmlRejection(html('', meta(`${without('base-uri')}; base-uri 'self'`)))).toMatch(/must set base-uri 'none'/)
    expect(htmlRejection(html('', meta(`${without('worker-src')}; worker-src 'self'`)))).toMatch(/must set worker-src 'none'/)
    expect(htmlRejection(html('', meta(`${without('base-uri')}; base-uri https://evil.example`)))).toMatch(/remote or non-local|base-uri 'none'/)
  })

  it('rejects inline on* event-handler attributes', () => {
    for (const body of ['<img src="a.png" onerror="alert(1)">', '<body ONLOAD = x()>', '<canvas\n\tonclick=go()></canvas>', '<img/onerror=alert(1) src=x>', '<svg><rect onmouseover="x()"/></svg>']) {
      expect(htmlRejection(html(body)), body).toMatch(/^\[GUBIC_HTML_ACTIVE_CONTENT\] .*inline event-handler attribute/)
    }
    // Text that merely mentions handlers, and handler-like words inside scripts, are fine.
    expect(() => verifyWebGameArchive(html('<p>Press on to continue; set onload later.</p><script src="main.js"></script>'))).not.toThrow()
    expect(() => verifyWebGameArchive(html('<script>window.addEventListener("load", () => { document.body.setAttribute("data-x", "<img onerror=1>") })</script>'))).not.toThrow()
    expect(() => verifyWebGameArchive(html('<!-- <img onerror="x()"> --><script src="main.js"></script>'))).not.toThrow()
  })

  it('rejects javascript: URLs in any attribute, including encoded forms', () => {
    for (const body of ['<a href="javascript:alert(1)">x</a>', '<a href=" JaVaScRiPt:alert(1)">x</a>', '<a href="java&#x09;script:alert(1)">x</a>',
      '<form action="&#106;avascript:x()"></form>', '<button formaction="vbscript:x">x</button>', '<iframe src="javascript&colon;x"></iframe>', '<img srcset="a.png 1x, javascript:x 2x">']) {
      expect(htmlRejection(html(body)), body).toMatch(/GUBIC_HTML_ACTIVE_CONTENT.*script URL/)
    }
    expect(() => verifyWebGameArchive(html('<p title="javascript is fun">tip: learn javascript: it is fun</p><a href="help.html">help</a>'))).not.toThrow()
  })

  it('rejects srcdoc documents', () => {
    expect(htmlRejection(html('<iframe srcdoc="<p>hi</p>"></iframe>'))).toMatch(/GUBIC_HTML_ACTIVE_CONTENT.*srcdoc attribute/)
    expect(htmlRejection(html('<iframe SRCDOC></iframe>'))).toMatch(/srcdoc/)
  })

  it('rejects <script type=importmap>', () => {
    for (const tag of ['<script type="importmap">{"imports":{"a":"https://evil.example/a.js"}}</script>', '<script type=importmap>{}</script>', "<script TYPE=' ImportMap '>{}</script>"]) {
      expect(htmlRejection(html(tag)), tag).toMatch(/GUBIC_HTML_ACTIVE_CONTENT.*importmap/)
    }
    expect(() => verifyWebGameArchive(html('<script type="module" src="main.js"></script>'))).not.toThrow()
  })

  it('rejects remote Worker, SharedWorker and serviceWorker registrations', () => {
    const remote = ['new Worker("https://evil.example/w.js")', "new SharedWorker( '//evil.example/w.js')", 'new Worker(new URL(`https://evil.example/w.js`, import.meta.url))',
      'navigator.serviceWorker.register("https://evil.example/sw.js")', "navigator.serviceWorker?.register('http://evil.example/sw.js')",
      "navigator.serviceWorker['register']('//evil.example/sw.js')", 'new Worker("data:text/javascript,postMessage(1)")', 'new Worker("blob:https://x/1")',
      "importScripts('https://evil.example/lib.js')"]
    for (const code of remote) {
      expect(htmlRejection(gameArchive(doc(meta(STRICT)), {'main.js': code})), code).toMatch(/^\[GUBIC_REMOTE_WORKER\] Web game script main\.js registers a non-local/)
    }
    expect(htmlRejection(html(`<script>${remote[3]}</script>`))).toMatch(/GUBIC_REMOTE_WORKER.*inline script/)
    // Local workers are not "remote" (worker-src 'none' still stops them at runtime).
    for (const code of ['new Worker("worker.js")', "new Worker(new URL('./worker.js', import.meta.url))", 'navigator.serviceWorker.register("/sw.js")', 'importScripts("lib.js")']) {
      expect(() => assertNoRemoteWorkers(code, 'main.js'), code).not.toThrow()
    }
  })
})
