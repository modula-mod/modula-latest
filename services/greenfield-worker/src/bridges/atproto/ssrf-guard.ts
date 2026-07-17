import {lookup} from 'node:dns/promises'
import {isIP} from 'node:net'

/**
 * SSRF protection for outbound calls the worker makes to PDS/AT Protocol
 * hosts. `pds_url` and DID-resolved service endpoints are actor-controlled
 * strings coming out of the database, so every outbound fetch must go
 * through this guard before touching the network — mirrors the policy in
 * services/api/src/security/ssrf.ts (kept as a separate, self-contained
 * copy here because the worker is an independently deployable process).
 */
const BLOCKED_IPV4_PREFIXES = [
  '0.',
  '10.',
  '127.',
  '169.254.',
  '192.168.',
  '192.0.0.',
  '192.0.2.',
  '198.51.100.',
  '203.0.113.',
  '224.',
  '240.',
]

function isPrivateIpv4(ip: string): boolean {
  if (BLOCKED_IPV4_PREFIXES.some(prefix => ip.startsWith(prefix))) return true
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) return true
  if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true
  if (parts[0] === 100 && parts[1]! >= 64 && parts[1]! <= 127) return true
  if (ip === '255.255.255.255') return true
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  )
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIpv4(ip)
  if (version === 6) return isPrivateIpv6(ip)
  return true
}

export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED' as const
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

export async function assertSafePdsUrl(rawUrl: string, options: {allowPrivateNetworks?: boolean} = {}): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SsrfBlockedError('Invalid PDS URL')
  }
  if (url.protocol !== 'https:') {
    throw new SsrfBlockedError('Only HTTPS PDS URLs are allowed')
  }
  if (url.username || url.password) {
    throw new SsrfBlockedError('PDS URL must not contain credentials')
  }
  if (options.allowPrivateNetworks) return url

  const hostname = url.hostname
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SsrfBlockedError('Blocked hostname')
  }
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new SsrfBlockedError('Blocked IP address')
    return url
  }
  const records = await lookup(hostname, {all: true, verbatim: true})
  if (!records.length) throw new SsrfBlockedError('DNS resolution failed')
  for (const record of records) {
    if (isBlockedIp(record.address)) throw new SsrfBlockedError('DNS resolved to a blocked address')
  }
  return url
}

export type SafeFetchOptions = {
  allowPrivateNetworks?: boolean
  timeoutMs?: number
  maxBytes?: number
}

/**
 * A `fetch`-compatible function bound to SSRF checks, suitable for passing
 * into `@atproto/api`'s `AtpAgent` fetch handler / `AtpBaseClient` transport.
 */
export function createSafeFetch(options: SafeFetchOptions = {}): typeof fetch {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxBytes = options.maxBytes ?? 5_242_880
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    await assertSafePdsUrl(rawUrl, {allowPrivateNetworks: options.allowPrivateNetworks})
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(rawUrl, {...init, signal: controller.signal, redirect: 'error'})
      const contentLength = response.headers.get('content-length')
      if (contentLength && Number(contentLength) > maxBytes) {
        throw new SsrfBlockedError('Response too large')
      }
      return response
    } finally {
      clearTimeout(timer)
    }
  }
}
