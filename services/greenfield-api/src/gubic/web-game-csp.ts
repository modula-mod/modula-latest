/**
 * Ingestion-time content policy for GUBIC web games (`web-mini-game`).
 *
 * The signed game archive must carry its own restrictive Content-Security-Policy
 * in a real `<meta http-equiv="Content-Security-Policy">` element. This module
 * parses that element and its directives instead of looking for substrings,
 * and also rejects remote script tags and dynamic code evaluation in bundled
 * JavaScript. It is dependency-free on purpose and errs on the side of refusal:
 * anything it cannot interpret unambiguously is rejected.
 *
 * Host-side isolation (iframe sandbox, origin isolation, postMessage origin
 * checks) lives in the native player and is out of scope here.
 */

export class WebGameContentPolicyError extends Error {}

const fail = (message: string): never => { throw new WebGameContentPolicyError(message) }

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

/** Directives whose value must be exactly `'none'`. */
const NONE_ONLY_DIRECTIVES = new Set(['default-src', 'connect-src', 'object-src'])

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
    out = out.replace(new RegExp(`(<${name}\\b[^>]*>)[\\s\\S]*?(?:</${name}\\s*>|$)`, 'gi'), '$1</' + name + '>')
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
  return directives
}

/** Rejects dynamic code evaluation in a JavaScript source. Matches inside comments and strings too, by design. */
export function assertNoDynamicCode(source: string, path: string): void {
  if (/(?<![\w$])eval\s*\(/.test(source)) fail(`Web game script ${path} uses eval()`)
  if (/\bnew\s+Function\s*\(/.test(source)) fail(`Web game script ${path} uses new Function()`)
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
    }
  }
}
