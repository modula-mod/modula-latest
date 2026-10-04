import {createHash} from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type {ModulaDb} from '../../database/client.js'
import {isBlockedAddress, safeLookup} from './ssrf.js'

export type LinkPreview = {
  url: string
  canonicalUrl: string
  domain: string
  title: string | null
  description: string | null
  imageUrl: string | null
  siteName: string | null
}

const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 5000
const MAX_REDIRECTS = 3
const OK_TTL_MS = 24 * 60 * 60 * 1000
const FAIL_TTL_MS = 30 * 60 * 1000
const invalid = (message: string) => Object.assign(new Error(message), {code: 'VALIDATION_FAILED'})

export function normaliseUrl(raw: unknown): URL {
  if (typeof raw !== 'string' || raw.length > 2048) throw invalid('Valid URL required')
  let url: URL
  try { url = new URL(raw.trim()) } catch { throw invalid('Valid URL required') }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw invalid('Only http and https links can be previewed')
  if (url.username || url.password) throw invalid('Credentials in URLs are not allowed')
  if (url.port && !['80', '443'].includes(url.port)) throw invalid('Non-standard ports are not previewed')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && isBlockedAddress(host)) throw invalid('Address not allowed')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) {
    throw invalid('Address not allowed')
  }
  url.hash = ''
  return url
}

function fetchOnce(url: URL): Promise<{status: number; location?: string; contentType: string; body: string}> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    const request = client.request(url, {
      method: 'GET',
      lookup: safeLookup,
      timeout: TIMEOUT_MS,
      headers: {
        'user-agent': 'ModulaLinkPreview/1.0 (+https://modula.digital)',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'accept-language': 'en',
      },
    }, response => {
      const status = response.statusCode ?? 0
      const contentType = String(response.headers['content-type'] ?? '')
      if (status >= 300 && status < 400) {
        response.resume()
        return resolve({status, location: response.headers.location, contentType, body: ''})
      }
      if (!/text\/html|application\/xhtml/i.test(contentType)) {
        response.destroy()
        return resolve({status, contentType, body: ''})
      }
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BYTES) { response.destroy(); return }
        chunks.push(chunk)
        // Metadata lives in <head>; stop early once it closes.
        if (/<\/head>/i.test(chunk.toString('latin1'))) response.destroy()
      })
      const finish = () => resolve({status, contentType, body: Buffer.concat(chunks).toString('utf8')})
      response.on('end', finish)
      response.on('close', finish)
      response.on('error', finish)
    })
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timed out'), {code: 'ETIMEDOUT'})))
    request.on('error', reject)
    request.end()
  })
}

const decode = (value: string) => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) % 0x110000))
  .replace(/\s+/g, ' ').trim()

function meta(html: string, keys: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    if (!key || !keys.includes(key)) continue
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (content) return decode(content)
  }
  return null
}

export function parsePreview(html: string, finalUrl: URL, requested: URL): LinkPreview {
  const title = meta(html, ['og:title', 'twitter:title']) ?? (/<title[^>]*>([^<]{1,500})<\/title>/i.exec(html)?.[1] ? decode(/<title[^>]*>([^<]{1,500})<\/title>/i.exec(html)![1]!) : null)
  const description = meta(html, ['og:description', 'twitter:description', 'description'])
  let imageUrl: string | null = null
  const rawImage = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'])
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, finalUrl)
      if (resolved.protocol === 'https:') imageUrl = resolved.toString()
    } catch { imageUrl = null }
  }
  const clip = (value: string | null, max: number) => value ? value.slice(0, max) : null
  return {
    url: requested.toString(),
    canonicalUrl: finalUrl.toString(),
    domain: finalUrl.hostname.replace(/^www\./, ''),
    title: clip(title, 300),
    description: clip(description, 500),
    imageUrl,
    siteName: clip(meta(html, ['og:site_name', 'application-name']), 120),
  }
}

export class LinkPreviewService {
  constructor(private readonly db: ModulaDb) {}

  async preview(raw: unknown): Promise<LinkPreview | null> {
    const requested = normaliseUrl(raw)
    const key = createHash('sha256').update(requested.toString()).digest('hex')
    const cached = await this.db.selectFrom('greenfield_link_previews').selectAll().where('url_hash', '=', key).executeTakeFirst()
    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime()
      if (cached.status === 'ok' && age < OK_TTL_MS) return cached.preview as LinkPreview
      if (cached.status === 'failed' && age < FAIL_TTL_MS) return null
    }
    let preview: LinkPreview | null = null
    try {
      let current = requested
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        const result = await fetchOnce(current)
        if (result.location && hop < MAX_REDIRECTS) { current = normaliseUrl(new URL(result.location, current).toString()); continue }
        if (result.status >= 200 && result.status < 300 && result.body) preview = parsePreview(result.body, current, requested)
        break
      }
    } catch {
      preview = null
    }
    if (preview && !preview.title && !preview.imageUrl) preview = null
    const row = {url_hash: key, url: requested.toString(), status: (preview ? 'ok' : 'failed') as 'ok' | 'failed', preview: JSON.stringify(preview ?? {}), fetched_at: new Date()}
    await this.db.insertInto('greenfield_link_previews').values(row as any)
      .onConflict(oc => oc.column('url_hash').doUpdateSet({status: row.status, preview: row.preview, fetched_at: row.fetched_at} as any))
      .execute()
    return preview
  }
}
