/**
 * Ingestion-time content policy for GUBIC web games (`web-mini-game`).
 *
 * The signed game archive must carry its own restrictive Content-Security-Policy
 * in a real `<meta http-equiv="Content-Security-Policy">` element. Documents are
 * tokenized the way a browser tokenizes them (`html-tokenizer.ts`, WHATWG
 * states, no regex scanning of markup) and anything the tokenizer cannot read
 * unambiguously is refused. This module parses the CSP element and its
 * directives instead of looking for substrings,
 * and also rejects remote script tags, inline event handlers, `javascript:`
 * URLs, `srcdoc`, import maps, meta refresh, non-UTF-8 documents, XHTML and
 * active XML, script-capable SVG, remote worker registrations and dynamic
 * code evaluation in bundled JavaScript. It is dependency-free on
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

import {HtmlTokenizeError, tokenizeHtml, type HtmlToken} from './html-tokenizer.js'

/** Machine-readable reasons. CSP rejections predating the codes use the generic one. */
export type WebGameContentPolicyCode =
  | 'GUBIC_CONTENT_POLICY'
  | 'GUBIC_SVG_ACTIVE_CONTENT'
  | 'GUBIC_HTML_ACTIVE_CONTENT'
  | 'GUBIC_REMOTE_WORKER'
  | 'GUBIC_HTML_MALFORMED'
  | 'GUBIC_XML_DOCUMENT'

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

export type ParsedCsp = Map<string, string[]>

/** The character references the value-identity decoder understands: numeric, and the five XML names. */
const KNOWN_REFERENCE = /&(?:#x([0-9a-f]+)|#([0-9]+)|(quot|apos|lt|gt|amp));/gi
const NAMED_REFERENCES: Record<string, string> = {quot: '"', apos: "'", lt: '<', gt: '>', amp: '&'}

/**
 * Decodes an attribute value EXACTLY ONCE, as a browser does: one left-to-right
 * pass, so `&amp;#45;` becomes the literal text `&#45;`, never `-`. This is
 * the single decoder for every acceptance decision (CSP content, charset
 * labels). With `strict`, any `&` that is not one of the understood references
 * is refused, because a browser might decode it differently (legacy names,
 * missing semicolons). The refusal-direction scans use the more aggressive
 * `decodeReferencesForScan` instead, which can only find more.
 */
export function decodeAttributeValueOnce(value: string, strict: boolean): string {
  if (strict && value.replace(KNOWN_REFERENCE, '').includes('&')) fail('Web game CSP uses an unsupported character reference')
  return value.replace(KNOWN_REFERENCE, (_, hex: string | undefined, dec: string | undefined, name: string | undefined) =>
    hex !== undefined ? safeCodePoint(parseInt(hex, 16)) : dec !== undefined ? safeCodePoint(parseInt(dec, 10)) : NAMED_REFERENCES[name!.toLowerCase()]!)
}

function decodeEntities(value: string): string {
  return decodeAttributeValueOnce(value, true)
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

type StartTag = Extract<HtmlToken, {type: 'startTag'}>

const attributeValue = (tag: StartTag, name: string) => tag.attributes.find((attribute) => attribute.name === name)?.value

/** Tokenizes like a browser (see html-tokenizer.ts); anything it cannot tokenize unambiguously is refused. */
function tokenizeDocument(html: string, path: string): HtmlToken[] {
  try {
    return tokenizeHtml(html.replace(/^\uFEFF/, ''))
  } catch (error) {
    if (error instanceof HtmlTokenizeError) failCode('GUBIC_HTML_MALFORMED', `Web game document ${path} ${error.message}`)
    throw error
  }
}

/**
 * The only tokens allowed before the CSP meta: whitespace, a DOCTYPE, `<html>`,
 * `<head>` and `<meta charset>`. No comments, processing instructions,
 * scripts, `<base>`, `<title>` or anything else, so nothing can load, run or
 * hide before the policy applies, and the meta stays inside `<head>`.
 */
function allowedBeforeCsp(token: HtmlToken): boolean {
  switch (token.type) {
    case 'text': return /^[\t\n\f ]*$/.test(token.data)
    case 'doctype': return true
    case 'startTag':
      if (token.name === 'html' || token.name === 'head') return true
      return token.name === 'meta' && token.attributes.length === 1 && token.attributes[0]!.name === 'charset'
    default: return false
  }
}

/**
 * Refuses any character reference in an http-equiv value. A browser decodes
 * the value once; refusing `&` entirely means ingestion never has to agree
 * with it on how (`Content&amp;#45;Security-Policy` is no CSP in a browser).
 */
function assertPlainHttpEquiv(token: HtmlToken, path: string): void {
  if (token.type !== 'startTag') return
  const httpEquiv = attributeValue(token, 'http-equiv')
  if (httpEquiv?.includes('&')) {
    failCode('GUBIC_HTML_MALFORMED', `Web game document ${path} has a character reference in an http-equiv value (${JSON.stringify(httpEquiv.slice(0, 80))} on <${token.name}>)`)
  }
}

/** True when the http-equiv value is exactly Content-Security-Policy (ASCII case-insensitive, no trimming, as browsers match it). */
function isCspMeta(token: HtmlToken): token is StartTag {
  if (token.type !== 'startTag' || token.name !== 'meta') return false
  const httpEquiv = attributeValue(token, 'http-equiv')
  // No decoding at all: http-equiv values containing "&" are refused outright (assertPlainHttpEquiv).
  return httpEquiv !== undefined && !httpEquiv.includes('&') && httpEquiv.toLowerCase() === 'content-security-policy'
}

/**
 * Extracts, parses and validates the document's CSP, then checks the whole
 * token stream. Requires exactly one effective `<meta http-equiv="Content-Security-Policy">`
 * preceded only by whitespace, a DOCTYPE, `<html>`, `<head>` and `<meta charset>`.
 */
export function assertWebGameDocumentPolicy(html: string, path: string): ParsedCsp {
  const tokens = tokenizeDocument(html, path)
  for (const token of tokens) assertPlainHttpEquiv(token, path)
  const cspMetas = tokens.filter(isCspMeta)
  if (cspMetas.length === 0) {
    fail(/content-security-policy/i.test(html)
      ? `Web game document ${path} has no effective CSP meta element (a policy inside a comment or raw text is ignored)`
      : `Web game document ${path} lacks the required restrictive CSP`)
  }
  if (cspMetas.length > 1) fail(`Web game document ${path} must declare exactly one CSP meta element`)
  const meta = cspMetas[0]!
  if (!tokens.slice(0, tokens.indexOf(meta)).every(allowedBeforeCsp)) {
    fail(`Web game document ${path} must declare its CSP in <head> before any other content (only a DOCTYPE, <html>, <head> and <meta charset> may precede it)`)
  }
  const content = attributeValue(meta, 'content')
  if (!content?.trim()) fail(`Web game document ${path} has an empty CSP`)
  const directives = parseCspDirectives(decodeEntities(content!))
  assertRestrictiveGameCsp(directives)
  assertNoActiveHtmlMarkup(tokens, path, 0)
  return directives
}

const UTF8_LABELS = new Set(['utf-8', 'utf8', 'unicode-1-1-utf-8', 'unicode11utf8', 'unicode20utf8', 'x-unicode20utf8'])

/** Game documents must be UTF-8: another declared encoding (e.g. ISO-2022-JP) would change how a browser reads the bytes we scanned. */
function assertUtf8Label(label: string, path: string): void {
  if (!UTF8_LABELS.has(label.trim().toLowerCase())) failCode('GUBIC_HTML_MALFORMED', `Web game document ${path} declares a non-UTF-8 encoding (${label.trim()})`)
}

/**
 * Decodes an HTML member as strict UTF-8. Invalid UTF-8, an ESC byte
 * (ISO-2022 shift sequences) or a charset declaration anywhere in the raw text
 * (the encoding prescan ignores element context) naming another encoding is
 * refused, so the text we scan is the text the browser renders.
 */
function decodeHtmlMember(bytes: Buffer, path: string): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', {fatal: true}).decode(bytes)
  } catch {
    return failCode('GUBIC_HTML_MALFORMED', `Web game document ${path} is not valid UTF-8`)
  }
  if (text.includes('\u001b')) failCode('GUBIC_HTML_MALFORMED', `Web game document ${path} contains an ESC byte`)
  for (const match of text.matchAll(/charset\s*=\s*["']?\s*([a-z0-9_:.-]+)/gi)) assertUtf8Label(match[1]!, path)
  return text
}

/**
 * Rejects inline-code vectors in a game document's tokens: non-local
 * `<script src>`, `on*` event-handler attributes, `javascript:`/`vbscript:`
 * URLs, `srcdoc` documents, `<script type=importmap>`, inline `<svg>`/`<math>`
 * (foreign content changes how a browser tokenizes `<script>`/`<style>`), and
 * dynamic code in inline scripts. The CSP already blocks inline handlers and
 * script URLs at runtime; refusing them at ingestion makes the failure
 * explicit and does not rely on every host honouring the meta policy.
 *
 * Non-script raw text (style, title, textarea, iframe, noscript, xmp, noembed,
 * noframes) is also re-tokenized as markup and held to the same rules, because
 * whether a browser treats it as raw text depends on tree-construction context.
 */
const MAX_RAW_TEXT_DEPTH = 4

function assertNoActiveHtmlMarkup(tokens: HtmlToken[], path: string, depth: number): void {
  const reject = (what: string) => failCode('GUBIC_HTML_ACTIVE_CONTENT', `Web game document ${path} contains ${what}`)
  for (const token of tokens) {
    if (token.type === 'rawText') {
      if (token.element === 'script') {
        assertNoDynamicCode(token.data, `${path} (inline script)`)
      } else if (token.data.includes('<')) {
        // Fail closed at the nesting cap instead of leaving deeper content unchecked.
        if (depth >= MAX_RAW_TEXT_DEPTH) failCode('GUBIC_HTML_MALFORMED', `Web game document ${path} nests raw-text markup deeper than ${MAX_RAW_TEXT_DEPTH} levels (<${token.element}>)`)
        assertNoActiveHtmlMarkup(tokenizeDocument(token.data, `${path} (<${token.element}> content)`), path, depth + 1)
      }
      continue
    }
    if (token.type !== 'startTag') continue
    const {name, attributes} = token
    if (name === 'svg' || name === 'math') reject(`inline <${name}> foreign content (ship artwork as a separate .svg member)`)
    assertPlainHttpEquiv(token, path)
    if (name === 'meta') {
      const httpEquiv = attributeValue(token, 'http-equiv')
      const keyword = httpEquiv === undefined ? undefined : decodeReferencesForScan(httpEquiv).trim().toLowerCase()
      // A padded value is ignored by browsers (no policy applies) while it reads like one: refuse it.
      if (keyword === 'content-security-policy' && !isCspMeta(token)) reject(`a CSP meta whose http-equiv is padded (${JSON.stringify(httpEquiv)}), which browsers ignore`)
      // Meta refresh navigates without being governed by the CSP.
      if (keyword === 'refresh') reject('a <meta http-equiv=refresh>')
      if (keyword === 'content-type') assertUtf8Label(/charset\s*=\s*["']?\s*([^\s"';]+)/i.exec(decodeAttributeValueOnce(attributeValue(token, 'content') ?? '', false))?.[1] ?? 'utf-8', path)
      const charset = attributeValue(token, 'charset')
      if (charset !== undefined) assertUtf8Label(decodeAttributeValueOnce(charset, false), path)
    }
    if (name === 'script') {
      const type = attributeValue(token, 'type')
      if (type !== undefined && decodeReferencesForScan(type).trim().toLowerCase() === 'importmap') reject('a <script type=importmap> import map')
      const src = attributeValue(token, 'src')
      if (src !== undefined) {
        // Browsers strip surrounding C0/space and drop tab/newline inside a URL before parsing its scheme.
        const trimmed = decodeReferencesForScan(src).trim()
        const normalised = normaliseUrlForScan(src)
        if (!normalised || /^[a-z][a-z0-9+.-]*:/.test(normalised) || /^[\/\\]{2}/.test(normalised)) {
          fail(`Web game document ${path} loads a non-local script: ${trimmed || '(empty)'}`)
        }
      }
    }
    for (const {name: attribute, value} of attributes) {
      if (/^on/.test(localName(attribute))) reject(`an inline event-handler attribute (${attribute} on <${name}>)`)
      if (attribute === 'srcdoc') reject(`a srcdoc attribute (on <${name}>)`)
      const normalised = normaliseUrlForScan(value)
      if (/^(?:java|vb)script:/.test(normalised) || (attribute === 'srcset' && /(?:^|,)(?:java|vb)script:/.test(normalised))) {
        reject(`a script URL (${attribute} on <${name}>)`)
      }
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

/** Remote (`http:`, `https:`, `//`, `\\`) or `data:` URL after browser normalisation. */
const REMOTE_OR_DATA_REFERENCE = /^(?:https?:|\/\/|\\\\|\/\\|data:)/

/** Every start tag in an XML/SVG string (lenient attribute parse, no entity failure) with its offset. */
function allStartTags(markup: string): Array<{name: string, attributes: Array<[string, string]>, index: number}> {
  const tags: Array<{name: string, attributes: Array<[string, string]>, index: number}> = []
  const tagPattern = /<([a-z_][\w.:-]*)((?:\s+[^\s"'<>/=]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*\/?>/gi
  let tag: RegExpExecArray | null
  while ((tag = tagPattern.exec(markup))) {
    const attributes: Array<[string, string]> = []
    const attributePattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    let attribute: RegExpExecArray | null
    while ((attribute = attributePattern.exec(tag[2]!))) {
      attributes.push([attribute[1]!.toLowerCase(), attribute[2] ?? attribute[3] ?? ''])
    }
    tags.push({name: tag[1]!.toLowerCase(), attributes, index: tag.index})
  }
  return tags
}

const localName = (qualified: string) => qualified.slice(qualified.lastIndexOf(':') + 1)

/** Decodes CSS escapes (`\68`, `\h`, escaped newline) and drops comments, for scanning only. */
function decodeCssForScan(value: string): string {
  return decodeReferencesForScan(value)
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '')
    .replace(/\\([0-9a-f]{1,6})[ \t\n\r\f]?/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/\\\r?\n/g, '')
    .replace(/\\([\s\S])/g, '$1')
}

/** CSS that references a remote resource (url(), image-set(), @import) or a script URL, after escape decoding. */
function cssProblem(value: string): string | null {
  const css = normaliseUrlForScan(decodeCssForScan(value))
  if (/(?:\(|@import)['"]?(?:https?:|\/\/|\\\\|\/\\)/.test(css)) return 'an external stylesheet or url() reference'
  if (/(?:java|vb)script:/.test(css)) return 'a script URL in CSS'
  return null
}

type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'utf-32'

/** XML encoding autodetection (BOM, then the NUL patterns of a leading "<"). */
function detectEncoding(raw: Buffer): TextEncoding {
  const b = raw
  if (b.length >= 4 && ((b[0] === 0x00 && b[1] === 0x00 && b[2] === 0xfe && b[3] === 0xff) || (b[0] === 0xff && b[1] === 0xfe && b[2] === 0x00 && b[3] === 0x00))) return 'utf-32'
  if (b.length >= 4 && ((b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0x3c) || (b[0] === 0x3c && b[1] === 0 && b[2] === 0 && b[3] === 0))) return 'utf-32'
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return 'utf-16le'
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return 'utf-16be'
  if (b.length >= 2 && b[0] !== 0 && b[1] === 0) return 'utf-16le'
  if (b.length >= 2 && b[0] === 0 && b[1] !== 0) return 'utf-16be'
  return 'utf-8'
}

const gunzipMember = (bytes: Buffer): Buffer | null => {
  if (!(bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes
  // Bounded by the archive's own 64 MiB expanded-size limit.
  try { return gunzipSync(bytes, {maxOutputLength: 64 * 1024 * 1024}) } catch { return null }
}

/** True when a non-UTF-8 (UTF-16/32) text starts with markup: an XML/SVG candidate we cannot scan. */
function isNonUtf8Markup(raw: Buffer): boolean {
  const encoding = detectEncoding(raw)
  if (encoding === 'utf-8') return false
  if (encoding === 'utf-32') return true
  const head = Buffer.from(raw.subarray(0, Math.min(raw.length, 4096) & ~1))
  if (encoding === 'utf-16be') head.swap16()
  return /^\uFEFF?\s*</.test(head.toString('utf16le'))
}

/** True for `.svg`/`.svgz` members and for any member whose content sniffs as SVG (image/svg+xml), including UTF-16/32 markup. */
export function isSvgMember(path: string, bytes: Buffer): boolean {
  if (/\.svgz?$/i.test(path)) return true
  if (/\.html?$/i.test(path)) return false
  const raw = gunzipMember(bytes)
  if (raw === null) return false
  if (isNonUtf8Markup(raw)) return true
  if (raw.includes(0)) return false
  const text = raw.subarray(0, 64 * 1024).toString('utf8')
  return /^(?:\uFEFF)?\s*(?:<\?xml\b[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!doctype\b[^>[]*(?:\[[\s\S]*?\])?\s*>\s*)*<(?:[\w.-]+:)?svg\b/i.test(text)
}

/**
 * Text of a possibly gzip-compressed (svgz) member as strict UTF-8, or the
 * reason it cannot be scanned (UTF-16/32, NUL bytes, invalid UTF-8).
 */
function xmlText(bytes: Buffer): {text: string} | {problem: string} {
  const raw = gunzipMember(bytes)
  if (raw === null) return {problem: 'is not a readable gzip stream'}
  const encoding = detectEncoding(raw)
  if (encoding !== 'utf-8') return {problem: `is ${encoding.toUpperCase()}, not UTF-8`}
  if (raw.includes(0)) return {problem: 'is not a text document (contains NUL bytes)'}
  try {
    return {text: new TextDecoder('utf-8', {fatal: true}).decode(raw)}
  } catch {
    return {problem: 'is not valid UTF-8'}
  }
}

/** The only DOCTYPE forms accepted in XML members: no internal subset, no odd quoting. */
const SIMPLE_DOCTYPE = /^<!doctype\s+[\w:.-]+(?:\s+(?:public\s+(?:"[^"<>[\]]*"|'[^'<>[\]]*')|system)(?:\s+(?:"[^"<>[\]]*"|'[^'<>[\]]*'))?)?\s*>/i

/** Shared XML prolog checks: declarations (ENTITY/ATTLIST/ELEMENT/NOTATION), internal subsets and xml-stylesheet. */
function xmlPrologProblem(text: string): string | null {
  const declarations = [...text.matchAll(/<!(?!--|\[CDATA\[)([a-z]*)/gi)]
  for (const match of declarations) {
    const keyword = match[1]!.toUpperCase()
    if (keyword === 'DOCTYPE') continue
    return keyword === 'ENTITY' ? 'an XML entity declaration' : keyword === 'ATTLIST' ? 'an <!ATTLIST> declaration' : `an XML <!${keyword || '…'}> declaration`
  }
  for (const match of declarations) {
    if (!SIMPLE_DOCTYPE.test(text.slice(match.index))) return 'a DOCTYPE with an internal subset or unsupported form'
  }
  if (/<\?xml-stylesheet\b/i.test(text)) return 'an xml-stylesheet processing instruction'
  return null
}

/**
 * Rejects script-capable SVG. Plain static SVG (shapes, gradients, local
 * `#fragment` or relative references, inline styles) passes. Matching is
 * case-insensitive, namespace-prefix tolerant and whitespace tolerant, and
 * runs over the raw text (comments and CDATA included) so neither can hide
 * markup from the scan.
 */
export function assertStaticSvg(bytes: Buffer, path: string): void {
  const decoded = xmlText(bytes)
  if ('problem' in decoded) failCode('GUBIC_SVG_ACTIVE_CONTENT', `Web game SVG ${path} ${decoded.problem}`)
  const svg = (decoded as {text: string}).text
  const reject = (what: string) => failCode('GUBIC_SVG_ACTIVE_CONTENT', `Web game SVG ${path} contains ${what}`)
  if (/<\s*(?:[\w.-]+:)?script\b/i.test(svg)) reject('a <script> element')
  if (/<\s*(?:[\w.-]+:)?foreignobject\b/i.test(svg)) reject('a <foreignObject> element')
  // Declarations can smuggle markup or default attributes past a scan; external stylesheets/XSLT can run code.
  const prolog = xmlPrologProblem(svg)
  if (prolog) reject(prolog)
  const tags = allStartTags(svg)
  // Fail closed: every "<name" must be a start tag the scanner could parse.
  const parsed = new Set(tags.map((tag) => tag.index))
  for (const match of svg.matchAll(/<[a-z_]/gi)) {
    if (!parsed.has(match.index)) reject(`a tag that cannot be parsed unambiguously (${JSON.stringify(svg.slice(match.index, match.index + 40))})`)
  }
  for (const {name: element, attributes} of tags) {
    const elementLocal = localName(element)
    for (const [name, value] of attributes) {
      const local = localName(name)
      if (/^on/.test(local)) reject(`an event-handler attribute (${name})`)
      const normalised = normaliseUrlForScan(value)
      if (/(?:java|vb)script:/.test(normalised)) reject(`a script URL (${name})`)
      if ((local === 'href' || local === 'src') && REMOTE_OR_DATA_REFERENCE.test(normalised)) {
        reject(`an external or data: reference (${name}="${value.trim().slice(0, 60)}" on <${element}>)`)
      }
      // SMIL can set href to a data:/remote URL at runtime.
      if ((elementLocal === 'set' || elementLocal.startsWith('animate')) && ['to', 'from', 'by', 'values'].includes(local)
        && normalised.split(';').some((part) => REMOTE_OR_DATA_REFERENCE.test(part))) {
        reject(`an animated external or data: reference (${name} on <${element}>)`)
      }
      const css = cssProblem(value)
      if (css) reject(`${css} (${name})`)
    }
  }
  // <style> element bodies: external url()/@import and script URLs, after CSS escape decoding.
  for (const match of svg.matchAll(/<\s*(?:[\w.-]+:)?style\b[^>]*>([\s\S]*?)(?:<\/\s*(?:[\w.-]+:)?style\s*>|$)/gi)) {
    const css = cssProblem(match[1]!.replace(/<!\[CDATA\[|\]\]>/g, ''))
    if (css) reject(`${css} in a <style> element`)
  }
}

const XML_ACTIVE_NAMESPACES = ['http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg', 'http://www.w3.org/1998/math/mathml']

/**
 * `.xml` members (e.g. bitmap-font or atlas data) are allowed only as inert
 * data: UTF-8, no declarations or internal subset, no xml-stylesheet, and no
 * XHTML, SVG or MathML namespace that would make a browser render active content.
 */
function assertInertXml(bytes: Buffer, path: string): void {
  const reject = (what: string) => failCode('GUBIC_XML_DOCUMENT', `Web game XML ${path} ${what}`)
  const decoded = xmlText(bytes)
  if ('problem' in decoded) reject(decoded.problem)
  const text = (decoded as {text: string}).text
  const prolog = xmlPrologProblem(text)
  if (prolog) reject(`contains ${prolog}`)
  const scan = normaliseUrlForScan(text)
  for (const namespace of XML_ACTIVE_NAMESPACES) if (scan.includes(namespace)) reject(`uses the ${namespace} namespace`)
  if (/<\s*(?:[\w.-]+:)?(?:script|svg|html|foreignobject)\b/i.test(text)) reject('contains renderable markup')
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
      // Also scans inline scripts for dynamic code (assertNoActiveHtmlMarkup).
      assertWebGameDocumentPolicy(decodeHtmlMember(bytes, path), path)
    } else if (/\.(?:xhtml|xht)$/i.test(path)) {
      // XHTML is parsed as XML, outside the HTML tokenizer's model: not accepted in game packages.
      failCode('GUBIC_XML_DOCUMENT', `Web game member ${path} is XHTML; ship documents as .html`)
    } else if (/\.xml$/i.test(path) && !isSvgMember(path, bytes)) {
      assertInertXml(bytes, path)
    } else if (/\.(?:m?js|cjs)$/i.test(path)) {
      assertNoDynamicCode(bytes.toString('utf8'), path)
    } else if (isSvgMember(path, bytes)) {
      assertStaticSvg(bytes, path)
    }
  }
}
