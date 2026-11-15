/**
 * A small, dependency-free HTML tokenizer for ingestion-time policy checks.
 *
 * It follows the WHATWG tokenizer states that matter for finding markup the
 * way a browser does (data, tag open, end tag open, tag name, attribute name,
 * unquoted / single-quoted / double-quoted attribute values, markup
 * declaration, comment, bogus comment, RCDATA, RAWTEXT and script data), so a
 * comment never starts inside an attribute value or raw text, `<!-->` and
 * `<!--->` are empty comments, `--!>` closes a comment, `<?…` and malformed
 * `<!…` run to the first `>`, and raw text ends only at a case-insensitive
 * `</name` followed by whitespace, `/` or `>`.
 *
 * It is deliberately stricter than a browser: wherever the specification
 * records a parse error that would make the browser recover in a way the
 * policy cannot reason about (a stray quote, `<` or `=` in an attribute name
 * or unquoted value, missing whitespace between attributes, an unterminated
 * tag, a malformed end tag, CDATA in HTML, NUL characters, script-data
 * escape sequences), it throws instead of guessing. Callers must treat a
 * throw as a refusal.
 */

export class HtmlTokenizeError extends Error {}

export type HtmlAttribute = {name: string, value: string}

export type HtmlToken =
  | {type: 'startTag', name: string, attributes: HtmlAttribute[], selfClosing: boolean, start: number, end: number}
  | {type: 'endTag', name: string, start: number, end: number}
  | {type: 'comment', bogus: boolean, data: string, start: number, end: number}
  | {type: 'doctype', data: string, start: number, end: number}
  | {type: 'text', data: string, start: number, end: number}
  /** Content of an RCDATA / RAWTEXT / script element, owned by `element`. */
  | {type: 'rawText', element: string, data: string, start: number, end: number}

/** Elements whose content the tokenizer switches to RCDATA. */
export const RCDATA_ELEMENTS = new Set(['title', 'textarea'])
/** Elements whose content is RAWTEXT (noscript: scripting is enabled in the player). */
export const RAWTEXT_ELEMENTS = new Set(['style', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'])

const isWhitespace = (c: string | undefined) => c === '\t' || c === '\n' || c === '\f' || c === ' '
const isAsciiAlpha = (c: string | undefined) => c !== undefined && /^[A-Za-z]$/.test(c)
/** Tag names the policy understands; anything else (quotes, `<`, `=`, controls…) is refused. */
const SAFE_TAG_NAME = /^[a-z][a-z0-9._-]*$/
/** Attribute names the policy understands (allows `xlink:href`, `data-x`, `aria-x`, `@click`-free). */
const SAFE_ATTRIBUTE_NAME = /^[a-z_:][a-z0-9_.:-]*$/

/**
 * Tokenizes `input` (already decoded text). CR and CRLF are normalised to LF
 * first, as in the input stream preprocessor; offsets refer to that text.
 */
export function tokenizeHtml(source: string): HtmlToken[] {
  if (source.includes('\0')) throw new HtmlTokenizeError('contains a NUL character')
  const input = source.replace(/\r\n?/g, '\n')
  const tokens: HtmlToken[] = []
  let pos = 0
  let textStart = 0
  const flushText = (end: number) => {
    if (end > textStart) tokens.push({type: 'text', data: input.slice(textStart, end), start: textStart, end})
  }
  const where = (at: number) => {
    const line = input.slice(0, at).split('\n').length
    return `line ${line}`
  }

  while (pos < input.length) {
    const lt = input.indexOf('<', pos)
    if (lt < 0) break
    const next = input[lt + 1]
    // Data state "<" followed by something that cannot open a tag is literal text.
    if (next === undefined) break
    if (next === '!') {
      flushText(lt)
      pos = markupDeclaration(lt)
      textStart = pos
      continue
    }
    if (next === '?') {
      // Bogus comment: runs to the first ">".
      flushText(lt)
      pos = bogusComment(lt, lt + 2)
      textStart = pos
      continue
    }
    if (next === '/') {
      flushText(lt)
      const end = endTag(lt)
      pos = end
      textStart = pos
      continue
    }
    if (isAsciiAlpha(next)) {
      flushText(lt)
      const tag = startTag(lt)
      tokens.push(tag)
      pos = tag.end
      textStart = pos
      if (tag.name === 'plaintext') throw new HtmlTokenizeError(`uses <plaintext> (${where(lt)})`)
      // HTML ignores a self-closing flag on these elements: their content still follows.
      if (tag.name === 'script' || RAWTEXT_ELEMENTS.has(tag.name) || RCDATA_ELEMENTS.has(tag.name)) {
        pos = rawText(tag.name, pos)
        textStart = pos
      }
      continue
    }
    // "<" + anything else (space, digit, "=") is a literal "<" in the data state.
    pos = lt + 1
  }
  flushText(input.length)
  return tokens

  function markupDeclaration(lt: number): number {
    const after = lt + 2
    if (input.startsWith('--', after)) return comment(lt, after + 2)
    if (input.slice(after, after + 7).toLowerCase() === 'doctype') {
      const close = input.indexOf('>', after)
      if (close < 0) throw new HtmlTokenizeError(`has an unterminated DOCTYPE (${where(lt)})`)
      tokens.push({type: 'doctype', data: input.slice(after + 7, close), start: lt, end: close + 1})
      return close + 1
    }
    if (input.startsWith('[CDATA[', after)) throw new HtmlTokenizeError(`uses a CDATA section outside foreign content (${where(lt)})`)
    return bogusComment(lt, after)
  }

  function bogusComment(lt: number, from: number): number {
    const close = input.indexOf('>', from)
    const end = close < 0 ? input.length : close + 1
    tokens.push({type: 'comment', bogus: true, data: input.slice(from, close < 0 ? input.length : close), start: lt, end})
    return end
  }

  /** Comment start / start dash / comment / end dash / end / end bang states. */
  function comment(lt: number, from: number): number {
    // <!--> and <!---> are complete (empty) comments.
    if (input[from] === '>') { tokens.push({type: 'comment', bogus: false, data: '', start: lt, end: from + 1}); return from + 1 }
    if (input[from] === '-' && input[from + 1] === '>') { tokens.push({type: 'comment', bogus: false, data: '', start: lt, end: from + 2}); return from + 2 }
    // From the comment state, "-->" and "--!>" are the only ways out ("--" then ">" or "!>").
    let i = from
    while (i < input.length) {
      const dash = input.indexOf('--', i)
      if (dash < 0) break
      let j = dash + 2
      while (input[j] === '-') j++ // comment end state: extra dashes stay in it
      if (input[j] === '>') { tokens.push({type: 'comment', bogus: false, data: input.slice(from, dash), start: lt, end: j + 1}); return j + 1 }
      if (input[j] === '!' && input[j + 1] === '>') { tokens.push({type: 'comment', bogus: false, data: input.slice(from, dash), start: lt, end: j + 2}); return j + 2 }
      i = dash + 1
    }
    // EOF in comment: the rest of the document is the comment, as in a browser.
    tokens.push({type: 'comment', bogus: false, data: input.slice(from), start: lt, end: input.length})
    return input.length
  }

  function endTag(lt: number): number {
    const first = input[lt + 2]
    if (first === undefined) throw new HtmlTokenizeError(`ends with "</" (${where(lt)})`)
    if (!isAsciiAlpha(first)) throw new HtmlTokenizeError(`has a malformed end tag "</${first}" (${where(lt)})`)
    let i = lt + 2
    while (i < input.length && !isWhitespace(input[i]) && input[i] !== '/' && input[i] !== '>') i++
    const name = input.slice(lt + 2, i).toLowerCase()
    if (!SAFE_TAG_NAME.test(name)) throw new HtmlTokenizeError(`has an unparseable end tag name "${name}" (${where(lt)})`)
    while (isWhitespace(input[i])) i++
    if (input[i] !== '>') throw new HtmlTokenizeError(`has an end tag with attributes or junk </${name} (${where(lt)})`)
    tokens.push({type: 'endTag', name, start: lt, end: i + 1})
    return i + 1
  }

  /** Tag open → tag name → (before/after) attribute name → attribute value states. */
  function startTag(lt: number): Extract<HtmlToken, {type: 'startTag'}> {
    let i = lt + 1
    while (i < input.length && !isWhitespace(input[i]) && input[i] !== '/' && input[i] !== '>') i++
    const name = input.slice(lt + 1, i).toLowerCase()
    const bad = (why: string): never => { throw new HtmlTokenizeError(`has an unparseable <${name.slice(0, 40)}> tag: ${why} (${where(lt)})`) }
    if (!SAFE_TAG_NAME.test(name)) bad('invalid characters in the tag name')
    const attributes: HtmlAttribute[] = []
    const seen = new Set<string>()
    let selfClosing = false
    for (;;) {
      // before attribute name
      const hadSpace = isWhitespace(input[i])
      while (isWhitespace(input[i])) i++
      const c = input[i]
      if (c === undefined) bad('unterminated tag')
      if (c === '>') return {type: 'startTag', name, attributes, selfClosing, start: lt, end: i + 1}
      if (c === '/') {
        // self-closing start tag state: only "/>" is well-formed
        if (input[i + 1] === '>') { selfClosing = true; return {type: 'startTag', name, attributes, selfClosing, start: lt, end: i + 2} }
        bad('stray "/" inside the tag')
      }
      if (attributes.length && !hadSpace) bad('missing whitespace between attributes')
      if (c === '=') bad('attribute name starts with "="')
      // attribute name
      const nameStart = i
      while (i < input.length && !isWhitespace(input[i]) && input[i] !== '/' && input[i] !== '>' && input[i] !== '=') {
        if (input[i] === '"' || input[i] === "'" || input[i] === '<') bad(`unexpected ${input[i]} in an attribute name`)
        i++
      }
      const attributeName = input.slice(nameStart, i).toLowerCase()
      if (!SAFE_ATTRIBUTE_NAME.test(attributeName)) bad(`unsupported attribute name "${attributeName.slice(0, 40)}"`)
      if (seen.has(attributeName)) bad(`duplicate attribute ${attributeName}`)
      seen.add(attributeName)
      // after attribute name
      let j = i
      while (isWhitespace(input[j])) j++
      if (input[j] !== '=') {
        attributes.push({name: attributeName, value: ''})
        continue
      }
      // before attribute value
      i = j + 1
      while (isWhitespace(input[i])) i++
      const quote = input[i]
      if (quote === '"' || quote === "'") {
        const close = input.indexOf(quote, i + 1)
        if (close < 0) bad('unterminated quoted attribute value')
        attributes.push({name: attributeName, value: input.slice(i + 1, close)})
        i = close + 1
        // after attribute value (quoted): whitespace, "/" or ">" must follow
        if (input[i] !== undefined && !isWhitespace(input[i]) && input[i] !== '/' && input[i] !== '>') bad('missing whitespace after a quoted attribute value')
        continue
      }
      if (quote === '>' || quote === undefined) bad(`attribute ${attributeName} has "=" but no value`)
      const valueStart = i
      while (i < input.length && !isWhitespace(input[i]) && input[i] !== '>') {
        if ('"\'<=`'.includes(input[i]!)) bad(`unexpected ${input[i]} in the unquoted value of ${attributeName}`)
        i++
      }
      attributes.push({name: attributeName, value: input.slice(valueStart, i)})
    }
  }

  /**
   * RCDATA / RAWTEXT / script data: content runs to the first case-insensitive
   * `</name` followed by whitespace, `/` or `>`. Script data escape states are
   * not modelled, so `<!--` inside an inline script is refused instead.
   */
  function rawText(element: string, from: number): number {
    // Element names are [a-z0-9._-]; escape the dot. ASCII case-insensitive, as in HTML.
    const pattern = new RegExp(`</${element.replace(/\./g, '\\.')}`, 'gi')
    pattern.lastIndex = from
    for (;;) {
      const found = pattern.exec(input)
      if (!found) throw new HtmlTokenizeError(`has an unterminated <${element}> element`)
      const close = found.index
      const after = input[close + 2 + element.length]
      if (after === undefined || isWhitespace(after) || after === '/' || after === '>') {
        const data = input.slice(from, close)
        if (element === 'script' && data.includes('<!--')) {
          throw new HtmlTokenizeError(`has "<!--" inside an inline <script> (script-data escape states are not supported)`)
        }
        tokens.push({type: 'rawText', element, data, start: from, end: close})
        // The appropriate end tag: refuse attributes or a stray "/" on it.
        let j = close + 2 + element.length
        while (isWhitespace(input[j])) j++
        if (input[j] !== '>') throw new HtmlTokenizeError(`has a malformed </${element}> end tag`)
        tokens.push({type: 'endTag', name: element, start: close, end: j + 1})
        return j + 1
      }
      pattern.lastIndex = close + 2
    }
  }
}
