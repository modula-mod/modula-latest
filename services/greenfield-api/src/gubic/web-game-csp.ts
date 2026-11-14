/**
 * Ingestion-time content policy for GUBIC web games (`web-mini-game`).
 *
 * The signed game archive must carry its own restrictive Content-Security-Policy
 * in a real `<meta http-equiv="Content-Security-Policy">` element. This module
 * parses that element and its directives instead of looking for substrings,
 * and also rejects remote script tags, inline event handlers, `javascript:`
 * URLs, `srcdoc`, import maps, script-capable SVG, remote worker registrations
 * and dynamic code evaluation in bundled JavaScript. It is dependency-free on
 * purpose and errs on the side of refusal: anything it cannot interpret
 * unambiguously is rejected.
 *
 * The JavaScript scans (eval / new Function / remote workers) are BEST-EFFORT
 * static checks on source text: they catch direct and lightly obfuscated use,
 * not determined obfuscation (e.g. `window['ev'+'al']`). The enforcing control
 * is the CSP itself (no 'unsafe-eval', worker-src 'none') together with the
 * native player's sandbox; these scans are an early, explainable refusal.
 *
 * Host-side isolation (iframe sandbox, origin isolation, postMessage origin
 * checks) lives in the native player and is out of scope here.
 */

import {gunzipSync} from 'node:zlib'

/** Machine-readable reasons. CSP rejections predating the codes use the generic one. */
export type WebGameContentPolicyCode =
  | 'GUBIC_CONTENT_POLICY'
  | 'GUBIC_SVG_ACTIVE_CONTENT'
  | 'GUBIC_HTML_ACTIVE_CONTENT'
  | 'GUBIC_REMOTE_WORKER'

export class WebGameContentPolicyError extends Error {
  constructor(message: string, readonly code: WebGameContentPolicyCode = 'GUBIC_CONTENT_POLICY') {
    super(message)
  }
}

const fail = (message: string): never => { throw new WebGameContentPolicyError(message) }
/** Fails with a code; the code is also prefixed to the message so it survives error mapping. */
const failCode = (code: WebGameContentPolicyCode, message: string): never => {
  throw new WebGameContentPolicyError(`[${code}] ${message}`, code)
}

/** Elements whose content is raw text / RCDATA: markup inside them is not markup. */
const RAW_TEXT_ELEMENTS = ['script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'template']

/** Directives a game document may declare. Anything else is refused. */
const ALLOWED_DIRECTIVES = new Set([
  'default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'font-src', 'media-src', 'connect-src', 'object-src', 'worker-src', 'child-src', 'frame-src',
  'manifest-src', 'base-uri', 'form-action',
])

/** Directives that govern executable code: only `'self'` (or `'none'`) is acceptable. */
const CODE_DIRECTIVES = new Set(['script-src', 'script-src-elem', 'script-src-attr', 'worker-src', 'child-src', 'frame-src', 'object-src'])

/** Directives whose value must be exactly `'none'`. All but object-src are mandatory. */
const NONE_ONLY_DIRECTIVES = new Set(['default-src', 'connect-src', 'object-src', 'base-uri', 'worker-src'])

/**
 * Markup permitted before the CSP meta. Anything else (text, a loading element,
 * `</head>`, `<body>`) would either run before the policy applies or move the
 * meta out of `<head>`, where browsers ignore it.
 */
const PRE_CSP_ALLOWED_MARKUP = /<!doctype\b[^>]*>|<html\b[^>]*>|<head\b[^>]*>|<title\b[^>]*><\/title>|<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi

export type ParsedCsp = Map<string, string[]>

/** Removes HTML comments. An unterminated comment swallows the rest of the document, as in a browser. */
export function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
}

function stripRawTextElements(html: string): string {
  let out = html
  for (const name of RAW_TEXT_ELEMENTS) {
    out = out.replace(new RegExp(`(<${name}\\b(?:[^>"']|"[^"]*"|'[^']*')*>)[\\s\\S]*?(?:</${name}\\s*>|$)`, 'gi'), '$1</' + name + '>')
  }
  return out
}

function decodeEntities(value: string): string {
  const decoded = value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(quot|apos|lt|gt|amp);/gi, (_, name: string) => ({quot: '"', apos: "'", lt: '<', gt: '>', amp: '&'} as Record<string, string>)[name.toLowerCase()]!)
  if (/&[a-z0-9#]+;/i.test(decoded)) fail('Web game CSP uses an unsupported character reference')
  return decoded
}

/** Parses the attributes of a single start tag (`<tag ...>`). Duplicate attributes keep the first, as in HTML. */
export function parseTagAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>()
  const body = tag.replace(/^<[a-z0-9-]+/i, '').replace(/\/?>$/, '')
  const pattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(body))) {
    const name = match[1]!.toLowerCase()
    if (attributes.has(name)) continue
    attributes.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''))
  }
  return attributes
}

function startTags(html: string, name: string): Array<{tag: string, index: number}> {
  const tags: Array<{tag: string, index: number}> = []
  const pattern = new RegExp(`<${name}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) tags.push({tag: match[0], index: match.index})
  return tags
}

/** Parses a serialized policy into directives. Duplicate directives are refused rather than ignored. */
export function parseCspDirectives(policy: string): ParsedCsp {
  if (policy.includes(',')) fail('Web game CSP must be a single policy')
  const directives: ParsedCsp = new Map()
  for (const raw of policy.split(';')) {
    const tokens = raw.trim().split(/[\t\n\f\r ]+/).filter(Boolean)
    if (!tokens.length) continue
    const name = tokens[0]!.toLowerCase()
    if (!/^[a-z0-9-]+$/.test(name)) fail(`Web game CSP has an invalid directive name: ${tokens[0]}`)
    if (directives.has(name)) fail(`Web game CSP repeats the ${name} directive`)
    directives.set(name, tokens.slice(1))
  }
  return directives
}

function isLocalKeyword(source: string): boolean {
  return source === "'self'" || source === "'none'"
}

/** Validates a parsed policy against the GUBIC game policy. */
export function assertRestrictiveGameCsp(directives: ParsedCsp): void {
  for (const [name, sources] of directives) {
    if (!ALLOWED_DIRECTIVES.has(name)) fail(`Web game CSP directive is not permitted: ${name}`)
    if (!sources.length) fail(`Web game CSP directive ${name} has no sources`)
    for (const source of sources) {
      const lower = source.toLowerCase()
      if (lower === "'unsafe-eval'" || lower === "'unsafe-inline'" || lower === "'wasm-unsafe-eval'" || lower === "'unsafe-hashes'") {
        fail(`Web game CSP must not allow ${lower} (${name})`)
      }
      if (lower === "'none'" && sources.length > 1) fail(`Web game CSP directive ${name} mixes 'none' with other sources`)
      if (lower.includes('*')) fail(`Web game CSP must not use wildcard sources (${name})`)
      if (CODE_DIRECTIVES.has(name)) {
        if (/^(?:data|blob|filesystem|javascript):?$/.test(lower)) fail(`Web game CSP must not allow ${lower} code sources (${name})`)
        if (!isLocalKeyword(lower)) fail(`Web game CSP ${name} may only allow 'self' (found ${source})`)
        continue
      }
      // Non-code directives may additionally use inline data/blob media; never a remote scheme or host.
      if (isLocalKeyword(lower) || lower === 'data:' || lower === 'blob:') continue
      fail(`Web game CSP must not allow remote or non-local sources (${name}: ${source})`)
    }
  }
  for (const name of NONE_ONLY_DIRECTIVES) {
    const sources = directives.get(name)
    if (name === 'object-src' && !sources) continue
    if (!sources || sources.length !== 1 || sources[0]!.toLowerCase() !== "'none'") fail(`Web game CSP must set ${name} 'none'`)
  }
  const script = directives.get('script-src')
  if (!script || script.length !== 1 || script[0]!.toLowerCase() !== "'self'") fail("Web game CSP must set script-src 'self'")
}

/**
 * Extracts, parses and validates the document's CSP. Requires exactly one
 * effective `<meta http-equiv="Content-Security-Policy">` outside comments
 * and raw-text elements, placed before anything that loads or runs content.
 */
export function assertWebGameDocumentPolicy(html: string, path: string): ParsedCsp {
  const uncommented = stripHtmlComments(html)
  const markup = stripRawTextElements(uncommented)
  const cspMetas = startTags(markup, 'meta').filter(({tag}) =>
    (parseTagAttributes(tag).get('http-equiv') ?? '').trim().toLowerCase() === 'content-security-policy')
  if (cspMetas.length === 0) {
    fail(/content-security-policy/i.test(html)
      ? `Web game document ${path} has no effective CSP meta element (a policy inside a comment or raw text is ignored)`
      : `Web game document ${path} lacks the required restrictive CSP`)
  }
  if (cspMetas.length > 1) fail(`Web game document ${path} must declare exactly one CSP meta element`)
  const [meta] = cspMetas
  if (markup.slice(0, meta!.index).replace(/^\uFEFF/, '').replace(PRE_CSP_ALLOWED_MARKUP, '').trim()) {
    fail(`Web game document ${path} must declare its CSP in <head> before any other content`)
  }
  const content = parseTagAttributes(meta!.tag).get('content')
  if (!content?.trim()) fail(`Web game document ${path} has an empty CSP`)
  const directives = parseCspDirectives(content!)
  assertRestrictiveGameCsp(directives)
  for (const {tag} of startTags(uncommented, 'script')) {
    const src = parseTagAttributes(tag).get('src')
    if (src === undefined) continue
    const trimmed = src.trim()
    if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('\\')) {
      fail(`Web game document ${path} loads a non-local script: ${trimmed || '(empty)'}`)
    }
  }
  assertNoActiveHtmlMarkup(uncommented, path)
  return directives
}

/**
 * Rejects inline-code vectors in a game document: `on*` event-handler
 * attributes, `javascript:`/`vbscript:` URLs, `srcdoc` documents and
 * `<script type=importmap>`. The CSP already blocks inline handlers and
 * script URLs at runtime; refusing them at ingestion makes the failure
 * explicit and does not rely on every host honouring the meta policy.
 */
function assertNoActiveHtmlMarkup(uncommented: string, path: string): void {
  const reject = (what: string) => failCode('GUBIC_HTML_ACTIVE_CONTENT', `Web game document ${path} contains ${what}`)
  // Raw-text bodies (script/style/textarea...) are not markup; their start tags still are.
  for (const {name, attributes} of allStartTags(stripRawTextElements(uncommented))) {
    for (const [attribute, value] of attributes) {
      if (/^on/.test(localName(attribute))) reject(`an inline event-handler attribute (${attribute} on <${name}>)`)
      if (attribute === 'srcdoc') reject(`a srcdoc attribute (on <${name}>)`)
      const normalised = normaliseUrlForScan(value)
      if (/^(?:java|vb)script:/.test(normalised) || (attribute === 'srcset' && /(?:^|,)(?:java|vb)script:/.test(normalised))) {
        reject(`a script URL (${attribute} on <${name}>)`)
      }
    }
    if (name === 'script') {
      const type = attributes.find(([attribute]) => attribute === 'type')?.[1]
      if (type !== undefined && decodeReferencesForScan(type).trim().toLowerCase() === 'importmap') reject('a <script type=importmap> import map')
    }
  }
}

/**
 * Decodes XML/HTML character references for scanning purposes only. Unlike
 * `decodeEntities` it never fails: unknown named references are left in place.
 * The small named set covers the classic `java&Tab;script&colon;` bypasses.
 */
function decodeReferencesForScan(value: string): string {
  const named: Record<string, string> = {
    quot: '"', apos: "'", lt: '<', gt: '>', amp: '&', colon: ':', tab: '\t', newline: '\n', sol: '/', bsol: '\\',
    lpar: '(', rpar: ')', period: '.', nbsp: ' ',
  }
  let previous: string
  let out = value
  // Decode repeatedly so that `&amp;#106;` style double encoding cannot hide a scheme.
  do {
    previous = out
    out = out
      .replace(/&#x0*([0-9a-f]{1,6});?/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
      .replace(/&#0*([0-9]{1,7});?/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
      .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
  } while (out !== previous)
  return out
}

function safeCodePoint(point: number): string {
  return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\uFFFD'
}

/** URL-ish normalisation: browsers drop ASCII whitespace/control characters inside schemes. */
function normaliseUrlForScan(value: string): string {
  // eslint-disable-next-line no-control-regex
  return decodeReferencesForScan(value).replace(/[\u0000-\u0020\u007f-\u009f]+/g, '').toLowerCase()
}

const REMOTE_REFERENCE = /^(?:https?:|\/\/|\\\\)/

/** Every start tag in a markup string, with a lenient attribute parse (no entity failure). */
function allStartTags(markup: string): Array<{name: string, attributes: Array<[string, string]>}> {
  const tags: Array<{name: string, attributes: Array<[string, string]>}> = []
  const tagPattern = /<([a-z][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi
  let tag: RegExpExecArray | null
  while ((tag = tagPattern.exec(markup))) {
    const attributes: Array<[string, string]> = []
    const attributePattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
    let attribute: RegExpExecArray | null
    while ((attribute = attributePattern.exec(tag[2]!))) {
      attributes.push([attribute[1]!.toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4] ?? ''])
    }
    tags.push({name: tag[1]!.toLowerCase(), attributes})
  }
  return tags
}

const localName = (qualified: string) => qualified.slice(qualified.lastIndexOf(':') + 1)

/** True for `.svg`/`.svgz` members and for any member whose content sniffs as SVG (image/svg+xml). */
export function isSvgMember(path: string, bytes: Buffer): boolean {
  if (/\.svgz?$/i.test(path)) return true
  if (/\.html?$/i.test(path)) return false
  const text = svgText(bytes)?.slice(0, 64 * 1024) ?? null
  return text !== null && /^(?:\uFEFF)?\s*(?:<\?xml\b[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!doctype\b[^>[]*(?:\[[\s\S]*?\])?\s*>\s*)*<(?:[\w.-]+:)?svg\b/i.test(text)
}

/**
 * Text of a possibly gzip-compressed (svgz) member, or null when it is not
 * text (contains NUL, e.g. a PNG; UTF-16 SVG is therefore treated as binary).
 * Decompression is bounded by the archive's own 64 MiB expanded-size limit.
 */
function svgText(bytes: Buffer): string | null {
  let raw = bytes
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    try { raw = gunzipSync(raw, {maxOutputLength: 64 * 1024 * 1024}) } catch { return null }
  }
  if (raw.includes(0)) return null
  return raw.toString('utf8')
}

/**
 * Rejects script-capable SVG. Plain static SVG (shapes, gradients, local
 * `#fragment` or relative references, inline styles) passes. Matching is
 * case-insensitive, namespace-prefix tolerant and whitespace tolerant.
 */
export function assertStaticSvg(bytes: Buffer, path: string): void {
  const text = svgText(bytes)
  if (text === null) failCode('GUBIC_SVG_ACTIVE_CONTENT', `Web game SVG ${path} is not a text document`)
  const svg = stripHtmlComments(text!)
  const reject = (what: string) => failCode('GUBIC_SVG_ACTIVE_CONTENT', `Web game SVG ${path} contains ${what}`)
  if (/<\s*(?:[\w.-]+:)?script\b/i.test(svg)) reject('a <script> element')
  if (/<\s*(?:[\w.-]+:)?foreignobject\b/i.test(svg)) reject('a <foreignObject> element')
  // Entity declarations can smuggle markup past a scan; external stylesheets/XSLT can run code.
  if (/<!entity\b/i.test(svg)) reject('an XML entity declaration')
  if (/<\?xml-stylesheet\b/i.test(svg)) reject('an xml-stylesheet processing instruction')
  for (const {attributes} of allStartTags(svg)) {
    for (const [name, value] of attributes) {
      const local = localName(name)
      if (/^on/.test(local)) reject(`an event-handler attribute (${name})`)
      const normalised = normaliseUrlForScan(value)
      if (/(?:java|vb)script:/.test(normalised)) reject(`a script URL (${name})`)
      if ((local === 'href' || local === 'src') && REMOTE_REFERENCE.test(normalised)) reject(`an external reference (${name}="${value.trim()}")`)
      if (/url\(\s*['"]?(?:https?:|\/\/)/.test(normalised)) reject(`an external url() reference (${name})`)
    }
  }
  // <style> element bodies: external url()/@import and script URLs.
  for (const match of svg.matchAll(/<\s*(?:[\w.-]+:)?style\b[^>]*>([\s\S]*?)(?:<\/\s*(?:[\w.-]+:)?style\s*>|$)/gi)) {
    const css = normaliseUrlForScan(match[1]!)
    if (/url\(['"]?(?:https?:|\/\/)/.test(css) || /@import(?:url\()?['"]?(?:https?:|\/\/)/.test(css)) reject('an external stylesheet reference')
    if (/(?:java|vb)script:/.test(css)) reject('a script URL in a <style> element')
  }
}

/**
 * Rejects dynamic code evaluation in a JavaScript source. Matches inside
 * comments and strings too, by design. BEST-EFFORT: this is a text scan, not a
 * parser, so obfuscated access (`window['ev'+'al']`, `Function.prototype.constructor`)
 * is not detected. The CSP (no 'unsafe-eval') is what actually blocks evaluation.
 */
export function assertNoDynamicCode(source: string, path: string): void {
  if (/(?<![\w$])eval\s*\(/.test(source)) fail(`Web game script ${path} uses eval()`)
  if (/\bnew\s+Function\s*\(/.test(source)) fail(`Web game script ${path} uses new Function()`)
  assertNoRemoteWorkers(source, path)
}

/** A string/template literal whose value starts with a URL scheme (http:, data:, blob:...), `//` or `\\`. */
const NON_LOCAL_LITERAL = String.raw`['"\x60]\s*(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//|\\\\)`
const REMOTE_WORKER_PATTERNS: Array<[RegExp, string]> = [
  // new Worker('https://…'), new SharedWorker(new URL('//cdn/…', import.meta.url))
  [new RegExp(String.raw`\bnew\s+(?:Shared)?Worker\s*\(\s*(?:new\s+URL\s*\(\s*)?` + NON_LOCAL_LITERAL), 'Worker/SharedWorker'],
  // navigator.serviceWorker.register('https://…'), also ?. and ['register'] access
  [new RegExp(String.raw`\bserviceWorker\s*(?:\??\.\s*register|\??\.?\s*\[\s*['"\x60]register['"\x60]\s*\])\s*\(\s*(?:new\s+URL\s*\(\s*)?` + NON_LOCAL_LITERAL), 'serviceWorker'],
  // importScripts('https://…') inside a worker
  [new RegExp(String.raw`\bimportScripts\s*\(\s*` + NON_LOCAL_LITERAL), 'importScripts'],
]

/**
 * Rejects Worker / SharedWorker / serviceWorker registrations (and worker
 * importScripts) whose script is a remote, data: or blob: URL literal.
 * BEST-EFFORT like the eval scan: URLs built at runtime are not seen; the
 * required `worker-src 'none'` is the enforcing control.
 */
export function assertNoRemoteWorkers(source: string, path: string): void {
  for (const [pattern, what] of REMOTE_WORKER_PATTERNS) {
    if (pattern.test(source)) failCode('GUBIC_REMOTE_WORKER', `Web game script ${path} registers a non-local ${what} script`)
  }
}

/** Validates every document and script member of a web game archive. */
export function assertWebGameContentPolicy(files: ReadonlyMap<string, Buffer>, entryPath = 'index.html'): void {
  if (!files.has(entryPath)) fail('Web game archive lacks its entry document')
  for (const [path, bytes] of files) {
    if (/\.html?$/i.test(path)) {
      const html = bytes.toString('utf8')
      assertWebGameDocumentPolicy(html, path)
      for (const {tag, index} of startTags(stripHtmlComments(html), 'script')) {
        const rest = stripHtmlComments(html).slice(index + tag.length)
        const close = rest.search(/<\/script\s*>/i)
        assertNoDynamicCode(close >= 0 ? rest.slice(0, close) : rest, `${path} (inline script)`)
      }
    } else if (/\.(?:m?js|cjs)$/i.test(path)) {
      assertNoDynamicCode(bytes.toString('utf8'), path)
    } else if (isSvgMember(path, bytes)) {
      assertStaticSvg(bytes, path)
    }
  }
}
