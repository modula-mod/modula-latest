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
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) throw moduleError('VALIDATION_FAILED', 'Module backend origin must not include path, query or fragment')
  const exactOrigin = parsed.origin
  if (explicitOrigin && backend.endpoints?.baseUrlStrategy !== 'self-hosted' && backend.endpoints?.baseUrlStrategy !== 'user-configured') {
    const allowed = new Set(backend.trust?.allowedOrigins ?? [])
    if (!allowed.has(exactOrigin)) throw moduleError('FORBIDDEN', 'Explicit module backend origin is not allowed by the manifest')
  }
  for (const host of backend.endpoints?.allowedHosts ?? []) {
    if (host === parsed.hostname) {
      return endpoint(exactOrigin)
    }
  }
  if ((backend.endpoints?.allowedHosts?.length ?? 0) > 0 && !backend.endpoints!.allowedHosts!.includes(parsed.hostname)) {
    throw moduleError('FORBIDDEN', 'Resolved module backend host is not allowlisted')
  }
  return endpoint(exactOrigin)
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
