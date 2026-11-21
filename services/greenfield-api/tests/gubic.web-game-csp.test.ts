import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {describe, expect, it} from 'vitest'
import {assertNoRemoteWorkers, decodeAttributeValueOnce, assertStaticSvg, assertWebGameDocumentPolicy, isSvgMember, parseCspDirectives, WebGameContentPolicyError} from '../src/gubic/web-game-csp.js'
import {verifyWebGameArchive} from '../src/modules/github-release-sync-service.js'
import {GUBIC_PACKAGE_MIME_TYPES, PHASER_CONNECT_SELF_CSP, PHASER_TEST_PACKAGE_ID, phaserIndexHtml, phaserPackageMembers} from './helpers/gubic-phaser-package-fixture.js'

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

function gameArchive(html: string | Buffer, members: Record<string, string | Buffer> = {'main.js': 'document.title = "ok"'}): Buffer {
  const files: Record<string, Buffer> = {'index.html': Buffer.isBuffer(html) ? html : Buffer.from(html)}
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
      // (unquoted values are not XML, so the last one is refused as an unparseable tag)
      expect(rejection(svgDoc('', root)), root).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*(?:event-handler attribute|cannot be parsed)/)
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
      expect(rejection(svgDoc(`<use href="${ref}"/>`)), ref).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*external or data: reference/)
      expect(rejection(svgDoc(`<image xlink:href="${ref}"/>`)), ref).toMatch(/external or data: reference \(xlink:href=/)
    }
    expect(rejection(svgDoc('<rect style="fill:url(https://evil.example/p.svg#x)"/>'))).toMatch(/external stylesheet or url\(\) reference \(style\)/)
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
    for (const body of ['<img src="a.png" onerror="alert(1)">', '<body ONLOAD = x()>', '<canvas\n\tonclick=go()></canvas>', '<div><span onmouseover="x()"></span></div>']) {
      expect(htmlRejection(html(body)), body).toMatch(/^\[GUBIC_HTML_ACTIVE_CONTENT\] .*inline event-handler attribute/)
    }
    // A stray "/" before the handler is a parse error the browser recovers from (the handler still applies): refused as malformed.
    expect(htmlRejection(html('<img/onerror=alert(1) src=x>'))).toMatch(/^\[GUBIC_HTML_MALFORMED\] .*stray "\/"/)
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

// Sentinel §33 (#188): every probe that the regex scanner accepted. The scanner now
// tokenizes like a browser and fails closed, so each of these must be refused.
describe('GUBIC web game HTML tokenizer (Sentinel §33 probes)', () => {
  const BODY = '<canvas></canvas><script src="main.js"></script>'
  const csp = meta(STRICT)
  const reason = (html: string) => {
    try {
      verifyWebGameArchive(gameArchive(html))
    } catch (error) {
      return (error as Error).message
    }
    throw new Error(`expected the document to be rejected: ${html}`)
  }

  it('rejects a remote script hidden by an empty <!--> comment before the CSP meta', () => {
    const probe = '<!--><script src="https://evil.example/x.js"></script>-->'
    expect(reason(`<!doctype html><html><head>${probe}${csp}</head><body>${BODY}</body></html>`)).toMatch(/before any other content|non-local script/)
    expect(reason(`${probe}${csp}${BODY}`)).toMatch(/before any other content|non-local script/)
  })

  it('rejects a remote script between meta attributes that look like a comment, before the CSP meta', () => {
    const probe = '<meta name=a content="<!--"><script src=https://evil.example/x.js></script><meta name=b content="-->">'
    expect(reason(`<head>${probe}${csp}</head>${BODY}`)).toMatch(/before any other content|non-local script/)
  })

  it('rejects on* handlers after <!-->, <!---> and <!-- --!> comments', () => {
    for (const probe of ['<!--><img src=x onerror=alert(1)>-->', '<!---><img src=x onerror=alert(1)>-->', '<!-- --!><img src=x onerror=alert(1)>-->']) {
      expect(reason(doc(csp, probe)), probe).toMatch(/GUBIC_HTML_ACTIVE_CONTENT.*inline event-handler attribute \(onerror on <img>\)/)
    }
  })

  it('does not start a comment inside an attribute value', () => {
    expect(reason(doc(csp, '<p title="<!--"><img src=x onerror=alert(1)><p title="-->">'))).toMatch(/inline event-handler attribute \(onerror on <img>\)/)
  })

  it('does not start a comment inside script text', () => {
    // The literal probe uses "<!--" inside the script, which is refused outright (escape states are not modelled)...
    expect(reason(doc(csp, '<script>var a="<!--";</script><img src=x onerror=alert(1)><script>"-->"</script>'))).toMatch(/GUBIC_HTML_MALFORMED.*"<!--" inside an inline <script>/)
    // ...and without it, the markup between the scripts is still seen.
    expect(reason(doc(csp, '<script>var a="<!-" + "-";</script><img src=x onerror=alert(1)><script>"-->"</script>'))).toMatch(/inline event-handler attribute \(onerror on <img>\)/)
  })

  it('ends a <? bogus comment at the first >', () => {
    expect(reason(doc(csp, '<?x <!-- ><img src=x onerror=alert(1)> -->'))).toMatch(/inline event-handler attribute \(onerror on <img>\)/)
    expect(reason(doc(csp, '<!x <!-- ><img src=x onerror=alert(1)> -->'))).toMatch(/inline event-handler attribute \(onerror on <img>\)/)
  })

  it('ends script data at </script followed by whitespace or /', () => {
    for (const probe of ['<script>/* </script x><img src=x onerror=alert(1)> */</script>', '<script>/* </script/><img src=x onerror=alert(1)> */</script>',
      '<script>/* </SCRIPT\t><img src=x onerror=alert(1)> */</script>']) {
      expect(reason(doc(csp, probe)), probe).toMatch(/GUBIC_HTML_(?:MALFORMED|ACTIVE_CONTENT)/)
    }
    // A plain "</script>" variant: tokenized like the browser, the handler is found.
    expect(reason(doc(csp, '<script>/* </SCRIPT ><img src=x onerror=alert(1)> */</script>'))).toMatch(/onerror on <img>/)
    // "</scripts" is not an end tag: still script text, so nothing is found and the document passes.
    expect(() => verifyWebGameArchive(gameArchive(doc(csp, '<script>var s = "</scripts>"; ok()</script><script src="main.js"></script>')))).not.toThrow()
  })

  it('fails closed on a stray quote in an unquoted value or attribute name', () => {
    expect(reason(doc(csp, "<img src=x' onerror=alert(1)>"))).toMatch(/GUBIC_HTML_MALFORMED.*unexpected ' in the unquoted value of src/)
    expect(reason(doc(csp, "<img a'b src=x onerror=alert(1)>"))).toMatch(/GUBIC_HTML_MALFORMED.*unexpected ' in an attribute name/)
  })

  it('fails closed on other tags that cannot be tokenized unambiguously', () => {
    for (const probe of ['<img src="a"onerror=x>', '<img =x>', '<img src=>', '<img src="x', '<img src=a<b>', '<a href=x`y>', '<img src=x src=y>',
      '</ x>', '</3>', '</p x>', '<plaintext>', '<![CDATA[ x ]]>', '<script>x', '<style>a{}', 'a\u0000b', '<img a"b=1>', '<i<b>x</i>']) {
      expect(reason(doc(csp, probe)), JSON.stringify(probe)).toMatch(/GUBIC_HTML_MALFORMED/)
    }
  })

  it('only allows whitespace, a DOCTYPE, <html>, <head> and <meta charset> before the CSP meta', () => {
    expect(() => verifyWebGameArchive(gameArchive(`\uFEFF<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  ${csp}\n  <title>Game</title>\n</head><body>${BODY}</body></html>`))).not.toThrow()
    for (const before of ['<!-- note -->', '<!---->', '<?xml version="1.0"?>', '<title></title>', '<base href="/">', '<meta name="viewport" content="width=device-width">',
      '<meta charset="utf-8" name="x">', '<link rel="stylesheet" href="a.css">', '<style></style>', 'x', '<body>', '</head>', '<noscript></noscript>']) {
      expect(reason(`<!doctype html><html><head>${before}${csp}</head>${BODY}`), before).toMatch(/before any other content/)
    }
  })

  it('re-scans raw text whose meaning depends on parser context', () => {
    // e.g. <style> in <select> is not raw text in every parser mode.
    expect(reason(doc(csp, '<select><style><img src=x onerror=alert(1)></style></select>'))).toMatch(/onerror on <img>/)
    expect(reason(doc(csp, '<noscript><img src=x onerror=alert(1)></noscript>'))).toMatch(/onerror on <img>/)
    expect(reason(doc(csp, '<textarea><script src=https://evil.example/x.js></script></textarea>'))).toMatch(/non-local script/)
    expect(() => verifyWebGameArchive(gameArchive(doc(csp, '<style>canvas > p { color: red }</style><textarea>a < b</textarea>' + BODY)))).not.toThrow()
  })

  it('refuses inline <svg> and <math>, whose foreign-content parsing differs', () => {
    expect(reason(doc(csp, '<svg><style><img src=x onerror=alert(1)></style></svg>'))).toMatch(/inline <svg> foreign content/)
    expect(reason(doc(csp, '<math><mi>x</mi></math>'))).toMatch(/inline <math> foreign content/)
  })

  it('normalises script src URLs like a browser before the locality check', () => {
    for (const src of ['ht\ttps://evil.example/x.js', ' //evil.example/x.js', '/\\evil.example/x.js', '&#104;ttps://evil.example/x.js', '\\\\evil.example\\x.js']) {
      expect(reason(doc(csp, `<script src="${src}"></script>`)), src).toMatch(/non-local script/)
    }
  })
})

// Sentinel §33 (#188) residuals.
describe('GUBIC web game content policy (Sentinel §33 residuals)', () => {
  const csp = meta(STRICT)
  const fails = (archive: Buffer) => {
    try {
      verifyWebGameArchive(archive)
    } catch (error) {
      return (error as Error).message
    }
    throw new Error('expected the archive to be rejected')
  }
  const withMember = (path: string, body: string | Buffer) => gameArchive(doc(csp), {'main.js': 'ok()', [path]: body})
  const utf16le = (text: string, bom = true) => Buffer.concat([bom ? Buffer.from([0xff, 0xfe]) : Buffer.alloc(0), Buffer.from(text, 'utf16le')])
  const utf16be = (text: string) => { const le = Buffer.from(text, 'utf16le'); return Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(le).swap16()]) }
  const EVIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'

  it('matches http-equiv exactly: a padded CSP http-equiv is no CSP', () => {
    for (const equiv of ['Content-Security-Policy ', ' Content-Security-Policy', 'Content-Security-Policy\t']) {
      const padded = `<meta http-equiv="${equiv}" content="${STRICT}">`
      expect(fails(gameArchive(doc(padded))), JSON.stringify(equiv)).toMatch(/no effective CSP meta element/)
      expect(fails(gameArchive(doc(csp + padded))), JSON.stringify(equiv)).toMatch(/GUBIC_HTML_ACTIVE_CONTENT.*http-equiv is padded/)
    }
    // ASCII case-insensitive and character references are still the same keyword.
    expect(() => verifyWebGameArchive(gameArchive(doc(`<meta http-equiv="content-security-POLICY" content="${STRICT}">`)))).not.toThrow()
    // Any character reference in http-equiv is refused (Sentinel §37 B1), even one a browser would decode to the keyword.
    expect(fails(gameArchive(doc(`<meta http-equiv="Content&#45;Security-Policy" content="${STRICT}">`)))).toMatch(/GUBIC_HTML_MALFORMED.*character reference in an http-equiv value/)
  })

  it('rejects <meta http-equiv=refresh> anywhere', () => {
    const refresh = '<meta http-equiv="refresh" content="0;url=https://evil.example/">'
    expect(fails(gameArchive(doc(csp + refresh)))).toMatch(/GUBIC_HTML_ACTIVE_CONTENT.*http-equiv=refresh/)
    expect(fails(gameArchive(doc(csp, `<p>${refresh.replace('https://evil.example/', 'javascript:alert(1)')}</p>`)))).toMatch(/http-equiv=refresh|script URL/)
    expect(fails(gameArchive(doc(csp, '<meta http-equiv=" Refresh " content="5">')))).toMatch(/http-equiv=refresh/)
    expect(fails(gameArchive(doc(csp, `<noscript>${refresh}</noscript>`)))).toMatch(/http-equiv=refresh/)
    expect(fails(gameArchive(`<head>${refresh}${csp}</head>`))).toMatch(/before any other content|http-equiv=refresh/)
  })

  it('refuses documents that are not UTF-8 or declare another encoding', () => {
    expect(fails(gameArchive(doc(csp + '<meta name="x" content="y">').replace('<meta charset="utf-8">', '<meta charset="iso-2022-jp">')))).toMatch(/GUBIC_HTML_MALFORMED.*non-UTF-8 encoding \(iso-2022-jp\)/)
    expect(fails(gameArchive(doc(csp, '<meta http-equiv="Content-Type" content="text/html; charset=shift_jis">')))).toMatch(/non-UTF-8 encoding/)
    expect(fails(gameArchive(doc(csp, '<title><meta charset=utf-7></title>')))).toMatch(/non-UTF-8 encoding \(utf-7\)/)
    expect(fails(gameArchive(doc(csp, 'a\u001b$Bb')))).toMatch(/ESC byte/)
    const invalid = Buffer.concat([Buffer.from(doc(csp, '<p>')), Buffer.from([0xc3, 0x28]), Buffer.from('</p>')])
    expect(fails(gameArchive(invalid))).toMatch(/GUBIC_HTML_MALFORMED.*not valid UTF-8/)
    expect(() => verifyWebGameArchive(gameArchive(doc(csp + '<meta name="x" content="y">').replace('<meta charset="utf-8">', '<meta charset=" UTF-8 ">')))).not.toThrow()
  })

  it('refuses .xhtml/.xht members and holds .xml members to an inert-data policy', () => {
    const xhtml = '<html xmlns="http://www.w3.org/1999/xhtml"><body><script>fetch("https://evil.example")</script></body></html>'
    expect(fails(withMember('evil.xhtml', xhtml))).toMatch(/GUBIC_XML_DOCUMENT.*evil\.xhtml is XHTML/)
    expect(fails(withMember('evil.XHT', xhtml))).toMatch(/GUBIC_XML_DOCUMENT/)
    expect(fails(withMember('data/evil.xml', xhtml))).toMatch(/GUBIC_XML_DOCUMENT.*1999\/xhtml namespace/)
    expect(fails(withMember('data/evil.xml', '<x:root xmlns:x="http&#58;//www.w3.org/1999/xhtml"/>'))).toMatch(/xhtml namespace/)
    expect(fails(withMember('data/evil.xml', '<?xml-stylesheet type="text/xsl" href="x.xsl"?><font/>'))).toMatch(/xml-stylesheet/)
    expect(fails(withMember('data/evil.xml', '<!DOCTYPE font [<!ENTITY x "y">]><font>&x;</font>'))).toMatch(/entity declaration/)
    expect(fails(withMember('data/evil.xml', utf16le('<?xml version="1.0" encoding="UTF-16"?><font/>')))).toMatch(/GUBIC_(?:XML_DOCUMENT|SVG_ACTIVE_CONTENT).*UTF-16LE, not UTF-8/)
    const font = '<?xml version="1.0"?>\n<font><info face="Arial" size="32"/><common lineHeight="32"/><pages><page id="0" file="font.png"/></pages><chars count="1"><char id="32" x="0" y="0"/></chars></font>'
    expect(() => verifyWebGameArchive(withMember('assets/font.xml', font))).not.toThrow()
  })

  it('detects UTF-16/32 SVG by BOM and NUL patterns and refuses non-UTF-8 SVG', () => {
    for (const [path, bytes] of [
      ['a.xml', utf16le(EVIL_SVG)], ['a.svg', utf16le(EVIL_SVG)], ['art/a.dat', utf16le(EVIL_SVG)], ['art/b.dat', utf16be(EVIL_SVG)],
      ['art/c.dat', utf16le(EVIL_SVG, false)], ['art/d.png', gzipSync(utf16le(EVIL_SVG))],
      ['art/e.dat', Buffer.concat([Buffer.from([0xff, 0xfe, 0, 0]), Buffer.from([0x3c, 0, 0, 0])])],
      ['art/f.dat', Buffer.from([0, 0, 0, 0x3c, 0, 0, 0, 0x73])],
    ] as const) {
      expect(fails(withMember(path, bytes)), path).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*(?:UTF-16|UTF-32)/)
    }
    // Non-markup UTF-16 text (a localisation file) and binary images are not SVG candidates.
    expect(() => verifyWebGameArchive(withMember('lang/en.txt', utf16le('hello = Hello')))).not.toThrow()
    expect(() => verifyWebGameArchive(withMember('art/a.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])))).not.toThrow()
  })

  it('rejects DOCTYPE internal subsets, <!ATTLIST> and <!ENTITY> in SVG', () => {
    const body = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'
    expect(fails(withMember('a.svg', `<!DOCTYPE svg [<!ATTLIST svg onload CDATA "alert(1)">]>${body}`))).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*<!ATTLIST> declaration/)
    expect(fails(withMember('a.svg', `<!DOCTYPE svg [<!ATTLIST a href CDATA "javascript:alert(1)">]>${body}`))).toMatch(/<!ATTLIST>|script URL/)
    expect(fails(withMember('a.svg', `<!DOCTYPE svg [<!ENTITY e "x">]>${body}`))).toMatch(/entity declaration/)
    expect(fails(withMember('a.svg', `<!DOCTYPE svg [ ]>${body}`))).toMatch(/internal subset/)
    expect(fails(withMember('a.svg', `<!DOCTYPE svg PUBLIC "a>[" "b">${body}`))).toMatch(/internal subset or unsupported form/)
    expect(fails(withMember('a.svg', `<!ELEMENT svg ANY>${body}`))).toMatch(/<!ELEMENT> declaration/)
    expect(() => verifyWebGameArchive(withMember('a.svg', `<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n${body}`))).not.toThrow()
  })

  it('decodes CSS escapes and comments before the remote and script-URL checks', () => {
    const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
    for (const inner of ['<style>@import "\\68ttps://evil.example/a.css";</style>', '<style>@\\69mport url(//evil.example/a.css);</style>',
      '<style>@import/**/"https://evil.example/a.css";</style>', '<rect style="fill:url(\\68ttps://evil.example/p.svg#x)"/>',
      '<rect style="fill:url(\\2f\\2f evil.example/p.svg#x)"/>', '<rect fill="url(&#x5c;68ttps://evil.example/p#x)"/>',
      '<style><![CDATA[ rect { fill: url( "\\000068ttps://evil.example/p#x" ) } ]]></style>']) {
      expect(fails(withMember('a.svg', svg(inner))), inner).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*external stylesheet or url\(\) reference/)
    }
    expect(fails(withMember('a.svg', svg('<rect style="background:url(java\\73 cript:alert(1))"/>')))).toMatch(/script URL/)
    expect(fails(withMember('a.svg', svg('<style>a { background: url("j\\61vascript:x") }</style>')))).toMatch(/script URL in CSS/)
    expect(() => verifyWebGameArchive(withMember('a.svg', svg('<style>.a { fill: url(#g); content: "\\2014" }</style><rect class="a" style="fill:url(\\23 g)"/>')))).not.toThrow()
  })

  it('rejects data: URLs in SVG href / xlink:href (use, a, image and any other element)', () => {
    const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${inner}</svg>`
    for (const inner of ['<use href="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"/>', '<a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"><text>x</text></a>',
      '<image xlink:href="data:image/png;base64,iVBORw0KGgo="/>', '<feImage href=" DATA:image/svg+xml,x"/>', '<pattern xlink:href="da&#x09;ta:x"/>',
      '<a><set attributeName="href" to="data:text/html,x"/></a>', '<a><animate attributeName="href" values="#a;data:text/html,x"/></a>']) {
      expect(fails(withMember('a.svg', svg(inner))), inner).toMatch(/GUBIC_SVG_ACTIVE_CONTENT.*data: reference/)
    }
    expect(() => verifyWebGameArchive(withMember('a.svg', svg('<use href="#coin"/><image href="coin.png"/><a href="help.html"><text>?</text></a>')))).not.toThrow()
  })
})

// Sentinel §37 (#188 re-cert).
describe('GUBIC web game content policy (Sentinel §37)', () => {
  const csp = meta(STRICT)
  const fails = (archive: Buffer) => {
    try {
      verifyWebGameArchive(archive)
    } catch (error) {
      return (error as Error).message
    }
    throw new Error('expected the archive to be rejected')
  }

  it('B1: refuses double-encoded http-equiv values that a browser decodes once to no CSP', () => {
    for (const equiv of ['Content&amp;#45;Security-Policy', 'Content&#38;#45;Security-Policy', 'Content&#x26;#45;Security-Policy', 'Content&amp;#x2d;Security&amp;#x2d;Policy']) {
      const html = doc(`<meta http-equiv="${equiv}" content="${STRICT}">`, '<script>fetch("https://evil.example")</script>')
      expect(fails(gameArchive(html)), equiv).toMatch(/GUBIC_HTML_MALFORMED.*character reference in an http-equiv value/)
      // Also when a real CSP is present, and on non-meta elements or inside raw text.
      expect(fails(gameArchive(doc(csp, `<p http-equiv="${equiv}"></p>`))), equiv).toMatch(/character reference in an http-equiv value/)
      expect(fails(gameArchive(doc(csp, `<noscript><meta http-equiv="${equiv}"></noscript>`))), equiv).toMatch(/character reference in an http-equiv value/)
    }
  })

  it('R3: decodes the CSP content exactly once', () => {
    expect(decodeAttributeValueOnce('&amp;#45;', true)).toBe('&#45;')
    expect(decodeAttributeValueOnce('&#x26;#59;', true)).toBe('&#59;')
    expect(decodeAttributeValueOnce('&#39;self&#39;&lt;', true)).toBe("'self'<")
    expect(() => decodeAttributeValueOnce('a&nbsp;b', true)).toThrow(/unsupported character reference/)
    expect(() => decodeAttributeValueOnce('a &amp b', true)).toThrow(/unsupported character reference/)
    // "&#x26;#59;" must not become a ";" directive separator; it stays the literal "&#59;" and the policy fails.
    const doubled = STRICT.replace("connect-src 'none'; ", "connect-src 'none'&#x26;#59; ")
    expect(fails(gameArchive(doc(meta(doubled))))).toMatch(/connect-src|Web game CSP/)
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT.replace(/;/g, '&#59;')))))).not.toThrow()
  })

  it('R1: refuses raw-text nesting at the depth cap instead of leaving it unchecked', () => {
    const nest = (inner: string) => `<select><style><xmp><noembed><noframes><iframe><input>${inner}</iframe></noframes></noembed></xmp></style></select>`
    for (const payload of ['<img src=x onerror=alert(1)>', '<script src="https://evil.example/x.js"></script>', '<meta http-equiv="refresh" content="0;url=https://evil.example">',
      '<a href="javascript:alert(1)">x</a>', '<iframe srcdoc="<script>alert(1)</script>"></iframe>']) {
      expect(fails(gameArchive(doc(csp, nest(payload)))), payload).toMatch(/GUBIC_HTML_MALFORMED.*nests raw-text markup deeper than 4 levels/)
    }
    // Within the cap the payload is found by the re-scan itself.
    expect(fails(gameArchive(doc(csp, '<select><style><xmp><img src=x onerror=alert(1)></xmp></style></select>')))).toMatch(/onerror on <img>/)
    // Deep raw text without markup is fine.
    expect(() => verifyWebGameArchive(gameArchive(doc(csp, '<style>canvas { color: red }</style><script src="main.js"></script>')))).not.toThrow()
  })

  it('M18: treats <noscript> as raw text and re-checks it', () => {
    expect(fails(gameArchive(doc(csp, '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>')))).toMatch(/GUBIC_HTML_/)
    expect(fails(gameArchive(doc(csp, '<noscript></noscript><img src=x onerror=alert(1)>')))).toMatch(/onerror on <img>/)
  })

  it('M7: refuses junk on a raw-text end tag such as </script x>', () => {
    for (const end of ['</script x>', '</script/>', '</script x=1>', '</style junk>', '</title/>']) {
      const element = /<\/(\w+)/.exec(end)![1]!
      const body = `<${element}>ok</${end.slice(2)}<p>benign</p><script src="main.js"></script>`
      expect(fails(gameArchive(doc(csp, body))), end).toMatch(new RegExp(`GUBIC_HTML_MALFORMED.*malformed </${element}> end tag`))
    }
    expect(() => verifyWebGameArchive(gameArchive(doc(csp, '<script src="main.js"></script \t><p>benign</p>')))).not.toThrow()
  })

  it('M26: the raw-text charset scan catches declarations the tag check cannot see', () => {
    // The encoding prescan ignores element context, so a charset inside script text still counts.
    expect(fails(gameArchive(doc(csp, '<script>/* <meta charset="iso-2022-jp"> */</script><script src="main.js"></script>')))).toMatch(/non-UTF-8 encoding \(iso-2022-jp\)/)
    expect(fails(gameArchive(doc(csp, '<script>var x = "text/html; charset=shift_jis"</script>')))).toMatch(/non-UTF-8 encoding \(shift_jis\)/)
  })
})

// ATLAS ruling, 21 Nov 2026: html5 games may use connect-src 'self' so Phaser's loader can fetch
// the package's own JSON/XML/audio from the per-package isolated origin. Exactly 'none' or exactly
// 'self'; nothing else, alone or alongside 'self'.
describe("GUBIC web game connect-src 'self' (ATLAS 21 Nov ruling)", () => {
  const withConnect = (connect: string) => STRICT.replace("connect-src 'none'", `connect-src ${connect}`)
  const refusal = (policy: string) => {
    try {
      verifyWebGameArchive(gameArchive(doc(meta(policy))))
    } catch (error) {
      return (error as Error).message
    }
    throw new Error(`expected the policy to be rejected: ${policy}`)
  }

  it("accepts connect-src 'self' and still accepts connect-src 'none'", () => {
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(withConnect("'self'")))))).not.toThrow()
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(withConnect("'SELF'")))))).not.toThrow()
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(STRICT))))).not.toThrow()
    expect(parseCspDirectives(withConnect("'self'")).get('connect-src')).toEqual(["'self'"])
  })

  it('rejects the API origin and any remote host, alone or alongside self', () => {
    for (const connect of [
      'https://api.modula.digital', 'api.modula.digital', 'https://*.modula.digital', 'https://evil.example', 'http://127.0.0.1:4000', '//evil.example',
      "'self' https://api.modula.digital", "'self' api.modula.digital", "'self' https://evil.example",
    ]) expect(refusal(withConnect(connect)), connect).toMatch(/connect-src must be exactly 'none' or exactly 'self'/)
  })

  it('rejects ws:, wss:, https:, http:, data:, blob: and other schemes, alone or alongside self', () => {
    for (const scheme of ['ws:', 'wss:', 'https:', 'http:', 'data:', 'blob:', 'filesystem:', 'modula-pkg:', 'wss://api.modula.digital']) {
      expect(refusal(withConnect(scheme)), scheme).toMatch(/connect-src must be exactly 'none' or exactly 'self'/)
      expect(refusal(withConnect(`'self' ${scheme}`)), `'self' ${scheme}`).toMatch(/connect-src must be exactly 'none' or exactly 'self'/)
    }
  })

  it("rejects '*', a repeated or mixed keyword, and other keywords", () => {
    for (const connect of ['*', "'self' *", "'self' 'none'", "'none' 'self'", "'self' 'self'", "'unsafe-inline'", "'strict-dynamic'", "'self' 'unsafe-eval'", "self", "'self"]) {
      expect(refusal(withConnect(connect)), connect).toMatch(/connect-src must be exactly 'none' or exactly 'self'/)
    }
  })

  it('still requires connect-src, with at least one source', () => {
    expect(refusal(STRICT.replace("connect-src 'none'; ", ''))).toMatch(/must set connect-src 'none' or 'self'/)
    expect(refusal(withConnect(''))).toMatch(/connect-src has no sources/)
  })

  it('leaves default-src and the other required directives unchanged', () => {
    const selfConnect = withConnect("'self'")
    expect(refusal(selfConnect.replace("default-src 'none'", "default-src 'self'"))).toMatch(/default-src 'none'/)
    expect(refusal(selfConnect.replace("worker-src 'none'", "worker-src 'self'"))).toMatch(/worker-src 'none'/)
    expect(refusal(selfConnect.replace("base-uri 'none'", "base-uri 'self'"))).toMatch(/base-uri 'none'/)
    expect(refusal(selfConnect.replace("object-src 'none'", "object-src 'self'"))).toMatch(/object-src 'none'/)
    expect(refusal(selfConnect.replace("script-src 'self'", "script-src 'self' https://cdn.example"))).toMatch(/script-src/)
    // The tokenizer rules are untouched: a remote script before the CSP is still refused with connect-src 'self'.
    expect(() => verifyWebGameArchive(gameArchive(doc(meta(selfConnect), '<script src="https://evil.example/x.js"></script>')))).toThrow(/non-local script/)
    expect(() => verifyWebGameArchive(gameArchive(`<!doctype html><!--><script src="https://evil.example/x.js"></script>--><html><head>${meta(selfConnect)}</head></html>`))).toThrow()
  })

  describe('Phaser package fixture (JSON atlas, bitmap-font XML, audio)', () => {
    const phaserArchive = (csp?: string) => gameArchive(phaserIndexHtml(csp), phaserPackageMembers())

    it("passes validation with connect-src 'self'", () => {
      expect(() => verifyWebGameArchive(phaserArchive())).not.toThrow()
      expect(PHASER_TEST_PACKAGE_ID.startsWith('test.modula.')).toBe(true)
    })

    it('ships only member types the documented MIME map covers (json, xml, ogg/mp3/m4a/wav, png, css, js)', () => {
      const members = Object.keys(phaserPackageMembers())
      for (const path of members) expect(GUBIC_PACKAGE_MIME_TYPES[path.split('.').pop()!], path).toBeDefined()
      expect(members.filter(path => /\.json$/.test(path)).map(path => GUBIC_PACKAGE_MIME_TYPES.json)).toEqual(['application/json', 'application/json'])
      expect(GUBIC_PACKAGE_MIME_TYPES).toMatchObject({xml: 'application/xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', wav: 'audio/wav', woff: 'font/woff', woff2: 'font/woff2', gif: 'image/gif', mp4: 'video/mp4'})
    })

    it('is refused if its policy would let the loader reach the API origin, a remote host or a socket', () => {
      for (const connect of ["'self' https://api.modula.digital", "'self' https://evil.example", "'self' wss:", 'https:', '*']) {
        expect(() => verifyWebGameArchive(phaserArchive(PHASER_CONNECT_SELF_CSP.replace("connect-src 'self'", `connect-src ${connect}`))), connect)
          .toThrow(/connect-src must be exactly 'none' or exactly 'self'/)
      }
      // default-src stays 'none', so nothing falls back to a wider connect policy.
      expect(parseCspDirectives(PHASER_CONNECT_SELF_CSP).get('default-src')).toEqual(["'none'"])
    })
  })
})
