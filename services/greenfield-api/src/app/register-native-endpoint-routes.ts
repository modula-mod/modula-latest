import type {FastifyInstance} from 'fastify'
import type {ModulaDb} from '../database/client.js'
import {DiscoveryRepository} from '../domains/discovery/repository.js'
import {requireAuth} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

/**
 * GF native endpoints (forge/native-endpoints-01): two read-only routes that the
 * Modula Native iOS client already calls. Both are additive and answer 404 unless
 * an operator has explicitly configured them.
 *
 * GET /v1/intelligence/nodus/releases/latest?platform=ios&hostVersion=…
 *   Native: ios/Modula/Core/Intelligence/Nodus/NodusRelease.swift (NodusModelEndpoint,
 *   NodusModelRelease, NodusModelDownloader.fetchRelease). The client sends no
 *   Authorization header and decodes the body directly as NodusModelRelease (no
 *   envelope); any non-2xx is shown as "Nodus isn’t available to download yet."
 *   The only source is the MODULA_NODUS_RELEASE_IOS_JSON operator setting. No
 *   network calls are made and no descriptor is ever synthesised: unset, invalid,
 *   or a non-ios platform answers 404.
 *
 * GET /v1/reels/:id
 *   Native: ios/Modula/Features/Reels/ReelModels.swift ReelBackendCapabilities.Paths.reel,
 *   decoded by ReelPayloadDecoder.reel from the standard Greenfield envelope. Disabled
 *   unless MODULA_REELS_BY_ID_ENABLED=true. Requires an authenticated session and
 *   returns the same ReelItemDto shape as GET /v1/reels, under the same visibility rules.
 */

export type NodusReleaseFile = {path: string; url: string; sha256: string; bytes: number}
export type NodusReleaseDescriptor = {
  schemaVersion: 1
  nodusVersion: string
  artifactHash: string
  manifestURL: string
  manifestSHA256: string
  files: NodusReleaseFile[]
}

export type NativeEndpointOptions = {
  /** Raw JSON descriptor for the iOS Nodus release channel. Unset = no release (404). */
  nodusReleaseIosJson?: string
  /** GET /v1/reels/:id is 404 unless true. */
  reelsByIdEnabled?: boolean
}

export function nativeEndpointOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): NativeEndpointOptions {
  return {
    nodusReleaseIosJson: env.MODULA_NODUS_RELEASE_IOS_JSON,
    reelsByIdEnabled: env.MODULA_REELS_BY_ID_ENABLED === 'true',
  }
}

const HEX64 = /^[0-9a-f]{64}$/
const REEL_ID = /^[A-Za-z0-9._:-]{1,160}$/
const MAX_FILES = 512

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return value
  } catch {
    return null
  }
}

function safeRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 512) return false
  if (value.startsWith('/') || value.includes('\\')) return false
  return !value.split('/').some(part => part === '' || part === '.' || part === '..')
}

/**
 * Mirrors NodusModelRelease.validate() in Native so the server never serves a
 * descriptor the client would reject. Returns null for anything invalid.
 */
export function parseNodusReleaseDescriptor(raw: string | undefined | null): NodusReleaseDescriptor | null {
  if (!raw || !raw.trim()) return null
  let value: any
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.schemaVersion !== 1) return null
  if (typeof value.nodusVersion !== 'string' || !value.nodusVersion.trim() || value.nodusVersion.length > 64) return null
  if (typeof value.artifactHash !== 'string' || !value.artifactHash.startsWith('sha256:') || !HEX64.test(value.artifactHash.slice(7))) return null
  const manifestURL = httpsUrl(value.manifestURL)
  if (!manifestURL) return null
  if (typeof value.manifestSHA256 !== 'string' || !HEX64.test(value.manifestSHA256)) return null
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > MAX_FILES) return null
  const seen = new Set<string>()
  const files: NodusReleaseFile[] = []
  for (const file of value.files) {
    if (!file || typeof file !== 'object') return null
    if (!safeRelativePath(file.path) || file.path === 'nodus-manifest.json' || seen.has(file.path)) return null
    seen.add(file.path)
    const url = httpsUrl(file.url)
    if (!url) return null
    if (typeof file.sha256 !== 'string' || !HEX64.test(file.sha256)) return null
    if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0) return null
    files.push({path: file.path, url, sha256: file.sha256, bytes: file.bytes})
  }
  return {
    schemaVersion: 1,
    nodusVersion: value.nodusVersion,
    artifactHash: value.artifactHash,
    manifestURL,
    manifestSHA256: value.manifestSHA256,
    files,
  }
}

export async function registerNativeEndpointRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  publicApiUrl: string,
  routeConfig: {feedConfig: Record<string, any>},
  options: NativeEndpointOptions = nativeEndpointOptionsFromEnv(),
) {
  const iosRelease = parseNodusReleaseDescriptor(options.nodusReleaseIosJson)
  if (options.nodusReleaseIosJson?.trim() && !iosRelease) {
    // Never log the descriptor itself; only that it was rejected.
    app.log.warn('MODULA_NODUS_RELEASE_IOS_JSON is set but invalid; Nodus release endpoint stays 404')
  }
  const reelsByIdEnabled = options.reelsByIdEnabled === true
  const discovery = new DiscoveryRepository(db, publicApiUrl)
  const notFound = (reply: any, message: string, requestId: string) =>
    reply.code(statusForError('NOT_FOUND')).send(failureEnvelope('NOT_FOUND', message, requestId))

  app.get('/v1/intelligence/nodus/releases/latest', {
    ...routeConfig.feedConfig,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          platform: {type: 'string', minLength: 1, maxLength: 32},
          hostVersion: {type: 'string', minLength: 1, maxLength: 64},
        },
      },
    },
  }, async (request, reply) => {
    const {platform = 'ios'} = (request.query ?? {}) as {platform?: string}
    reply.header('cache-control', 'no-store')
    if (platform !== 'ios' || !iosRelease) return notFound(reply, 'No Nodus release is available', request.id)
    // Native decodes NodusModelRelease from the raw body, so this is intentionally not enveloped.
    return reply.send(iosRelease)
  })

  app.get('/v1/reels/:id', routeConfig.feedConfig, async (request, reply) => {
    if (!reelsByIdEnabled) return notFound(reply, 'Reel not found', request.id)
    const auth = requireAuth(request, reply)
    if (!auth) return
    const {id} = (request.params ?? {}) as {id?: string}
    if (typeof id !== 'string' || !REEL_ID.test(id) || id === '.' || id === '..') {
      return reply.code(statusForError('VALIDATION_FAILED')).send(
        failureEnvelope('VALIDATION_FAILED', 'Invalid reel id', request.id, {fieldErrors: {id: 'invalid'}}),
      )
    }
    const reel = await discovery.getReel(id, auth.actorId)
    if (!reel) return notFound(reply, 'Reel not found', request.id)
    return reply.send(successEnvelope(reel, request.id))
  })
}
