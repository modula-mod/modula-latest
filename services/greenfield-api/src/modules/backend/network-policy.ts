import type {ModuleBackendDefinition} from '@modula/greenfield-module-manifest'
import {assertSafeHttpsUrl, safeFetch} from '../../security/ssrf.js'
import {moduleError} from '../module-errors.js'

export type ResolvedBackendEndpoint = {
  origin: string
  urlFor(path: string): string
}

export async function resolveBackendEndpoint(backend: ModuleBackendDefinition, explicitOrigin?: string): Promise<ResolvedBackendEndpoint> {
  const origin = explicitOrigin ?? backend.trust?.allowedOrigins?.[0]
  if (!origin) throw moduleError('VALIDATION_FAILED', 'Module backend origin is not declared')
  const parsed = await assertSafeHttpsUrl(origin)
  assertBackendTargetPolicy(backend, parsed, explicitOrigin !== undefined)
  return endpoint(parsed.origin)
}

export function assertBackendTargetPolicy(backend: ModuleBackendDefinition, parsed: URL, explicitOrigin: boolean): void {
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) throw moduleError('VALIDATION_FAILED', 'Module backend origin must not include path, query or fragment')
  const exactOrigin = parsed.origin
  const allowedOrigins = new Set((backend.trust?.allowedOrigins ?? []).map(normalizeOrigin))
  const allowedHosts = new Set((backend.endpoints?.allowedHosts ?? []).map((host) => host.toLowerCase()))
  const strategy = backend.endpoints?.baseUrlStrategy
  const userSelectedStrategy = strategy === 'self-hosted' || strategy === 'user-configured'
  const exactOriginAllowed = allowedOrigins.has(exactOrigin)
  const hostnameAllowed = allowedHosts.has(parsed.hostname.toLowerCase())
  if (explicitOrigin && !userSelectedStrategy && !exactOriginAllowed) {
    throw moduleError('FORBIDDEN', 'Explicit module backend origin is not allowed by the manifest')
  }
  if (!exactOriginAllowed && !hostnameAllowed) {
    throw moduleError('FORBIDDEN', 'Resolved module backend origin is not registered by the manifest')
  }
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 443
  const allowedPorts = backend.network?.allowedPorts ?? [443]
  if (!Number.isSafeInteger(port) || !allowedPorts.includes(port)) {
    throw moduleError('FORBIDDEN', 'Resolved module backend port is not allowlisted')
  }
}

export async function fetchBackendJson(url: string, options: {method?: string; body?: unknown; token?: string; idempotencyKey?: string; timeoutMs?: number; maxResponseBytes?: number} = {}) {
  const headers: Record<string, string> = {
    accept: 'application/json',
  }
  let body: string | undefined
  if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers['content-type'] = 'application/json'
  }
  if (options.token) headers.authorization = `Bearer ${options.token}`
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey
  const response = await safeFetch(url, {
    method: options.method ?? (body ? 'POST' : 'GET'),
    body,
    headers,
    timeoutMs: options.timeoutMs ?? 5000,
    maxRedirects: 0,
    maxResponseBytes: options.maxResponseBytes ?? 1_000_000,
    allowedContentTypes: ['application/json'],
  })
  const text = response.body.toString('utf8')
  const json = text ? JSON.parse(text) : {}
  return {status: response.status, json, bytes: response.body.length}
}

function endpoint(origin: string): ResolvedBackendEndpoint {
  return {
    origin,
    urlFor(path: string) {
      if (!path.startsWith('/') || path.includes('://') || path.includes('..') || path.includes('\\')) throw moduleError('VALIDATION_FAILED', 'Unsafe backend path')
      return new URL(path, origin).toString()
    },
  }
}

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin
  } catch {
    return origin
  }
}
