import {randomBytes} from 'node:crypto'
import * as dns from 'node:dns'
import type {IncomingHttpHeaders} from 'node:http'
import * as https from 'node:https'
import type {LookupAddress} from 'node:dns'

/**
 * SSRF-hardened outbound fetch used for anything that talks to a
 * user-controlled or third-party host (AT Protocol handle resolution, PDS /
 * authorization-server metadata, OAuth token endpoints, etc.).
 *
 * Guarantees:
 * - HTTPS only (no http:, no other schemes)
 * - Resolves the hostname ourselves and rejects private / loopback /
 *   link-local / cloud-metadata addresses BEFORE connecting, using the same
 *   resolved address for the actual TCP connection (no DNS-rebinding gap
 *   between the check and the connect)
 * - Manually revalidates every redirect hop (no automatic follow)
 * - Enforces a response size cap and a request timeout
 * - Optionally enforces an allowed content-type list
 */

export type SafeFetchOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  timeoutMs?: number
  maxRedirects?: number
  maxResponseBytes?: number
  allowedContentTypes?: string[]
  signal?: AbortSignal
}

export type SafeFetchResult = {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: Buffer
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_REDIRECTS = 3
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

function ipv4ToInt(parts: number[]): number {
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
}

function parseIpv4(address: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address)
  if (!match) return null
  const parts = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
  if (parts.some(p => p > 255)) return null
  return parts
}

function isBlockedIpv4(address: string): boolean {
  const parts = parseIpv4(address)
  if (!parts) return false
  const value = ipv4ToInt(parts)
  const inRange = (base: string, prefix: number) => {
    const baseParts = parseIpv4(base)
    if (!baseParts) return false
    const baseValue = ipv4ToInt(baseParts)
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return (value & mask) === (baseValue & mask)
  }
  return (
    inRange('0.0.0.0', 8) || // "this network"
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // shared/CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (includes 169.254.169.254 cloud metadata)
    inRange('172.16.0.0', 12) || // private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // documentation (TEST-NET-1)
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // documentation (TEST-NET-2)
    inRange('203.0.113.0', 24) || // documentation (TEST-NET-3)
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved
  )
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  // IPv4-mapped / IPv4-compatible addresses — validate the embedded IPv4.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized)
  if (mapped) return isBlockedIpv4(mapped[1]!)
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9')) return true // link-local
  if (normalized.startsWith('fea') || normalized.startsWith('feb')) return true // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local
  if (normalized.startsWith('ff')) return true // multicast
  return false
}

export function isBlockedIp(address: string, family?: number): boolean {
  const resolvedFamily = family ?? (address.includes(':') ? 6 : 4)
  return resolvedFamily === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address)
}

export async function assertSafeHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw Object.assign(new SsrfBlockedError('Invalid URL'), {code: 'VALIDATION_FAILED'})
  }
  assertHttps(url)
  if (url.username || url.password) {
    throw Object.assign(new SsrfBlockedError('URL credentials are not allowed'), {code: 'FORBIDDEN'})
  }
  if (parseIpv4(url.hostname) || url.hostname.includes(':')) {
    if (isBlockedIp(url.hostname)) {
      throw Object.assign(new SsrfBlockedError('Blocked IP address'), {code: 'FORBIDDEN'})
    }
    return url
  }
  await new Promise<void>((resolve, reject) => {
    safeLookup(url.hostname, {}, err => {
      if (err) {
        reject(Object.assign(err instanceof Error ? err : new Error(String(err)), {code: 'FORBIDDEN'}))
        return
      }
      resolve()
    })
  })
  return url
}

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): void {
  dns.lookup(hostname, {...options, all: true, verbatim: true}, (err, addresses) => {
    if (err) {
      callback(err, '', 4)
      return
    }
    const list = addresses as LookupAddress[]
    if (list.length === 0) {
      callback(new Error(`No addresses resolved for ${hostname}`), '', 4)
      return
    }
    for (const candidate of list) {
      if (isBlockedIp(candidate.address, candidate.family)) {
        callback(
          new SsrfBlockedError(`Blocked outbound request to disallowed address ${candidate.address} for host ${hostname}`),
          '',
          4,
        )
        return
      }
    }
    const chosen = list[0]!
    callback(null, chosen.address, chosen.family)
  })
}

function assertHttps(url: URL): void {
  if (url.protocol !== 'https:') {
    throw new SsrfBlockedError(`Only https:// URLs are allowed, got ${url.protocol}`)
  }
}

async function performRequest(url: URL, options: SafeFetchOptions): Promise<{
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}> {
  assertHttps(url)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: options.method ?? 'GET',
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        headers: options.headers,
        lookup: safeLookup as unknown as typeof dns.lookup,
        timeout: timeoutMs,
      },
      res => {
        const contentType = res.headers['content-type']
        if (options.allowedContentTypes && options.allowedContentTypes.length > 0) {
          const matches = options.allowedContentTypes.some(allowed => (contentType ?? '').includes(allowed))
          if (!matches) {
            res.destroy()
            reject(new SsrfBlockedError(`Disallowed response content-type: ${contentType ?? 'unknown'}`))
            return
          }
        }
        const chunks: Buffer[] = []
        let received = 0
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (received > maxBytes) {
            res.destroy()
            reject(new SsrfBlockedError(`Response exceeded maximum allowed size of ${maxBytes} bytes`))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks)})
        })
        res.on('error', reject)
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(`Request to ${url.hostname} timed out after ${timeoutMs}ms`))
    })
    req.on('error', reject)
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy(new Error('Request aborted'))
      } else {
        options.signal.addEventListener('abort', () => req.destroy(new Error('Request aborted')), {once: true})
      }
    }
    if (options.body) req.write(options.body)
    req.end()
  })
}

/**
 * SSRF-safe fetch. Follows redirects manually (revalidating scheme + DNS on
 * every hop) up to `maxRedirects`.
 */
export async function safeFetch(url: string | URL, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  let current = typeof url === 'string' ? new URL(url) : url
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await performRequest(current, options)
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      if (hop === maxRedirects) {
        throw new SsrfBlockedError(`Exceeded maximum redirect count (${maxRedirects})`)
      }
      const next = new URL(response.headers.location, current)
      assertHttps(next)
      current = next
      continue
    }
    return {
      status: response.status,
      headers: response.headers as Record<string, string | string[] | undefined>,
      body: response.body,
    }
  }
  throw new SsrfBlockedError('Exceeded maximum redirect count')
}

/** Fetch-compatible adapter for libraries (e.g. @atproto/oauth-client-node) that accept a `fetch` override. */
export function createSafeFetchAdapter(defaults: SafeFetchOptions = {}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const entries = init.headers instanceof Headers ? Array.from(init.headers.entries()) : Object.entries(init.headers)
      for (const [key, value] of entries) headers[key] = String(value)
    }
    const bodyText = typeof init?.body === 'string' ? init.body : undefined
    const result = await safeFetch(url, {
      ...defaults,
      method: init?.method ?? 'GET',
      headers,
      body: bodyText,
      signal: init?.signal ?? undefined,
    })
    const responseHeaders = new Headers()
    for (const [key, value] of Object.entries(result.headers)) {
      if (value === undefined) continue
      responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value))
    }
    return new Response(new Uint8Array(result.body), {status: result.status, headers: responseHeaders})
  }) as typeof fetch
}

/** Utility for tests: generates a random opaque value (used for state/nonce fixtures). */
export function randomOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url')
}
