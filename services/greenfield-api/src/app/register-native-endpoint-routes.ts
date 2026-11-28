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
 *   Sources, in order: a DB-published release (stripped to the v1 shape; see
 *   nodus-model-releases.ts), then the MODULA_NODUS_RELEASE_IOS_JSON operator
 *   setting. No network calls are made and no descriptor is ever synthesised:
 *   unset, invalid, or a non-ios platform answers 404.
 *
 * GET /v1/reels/:id
 *   Native: ios/Modula/Features/Reels/ReelModels.swift ReelBackendCapabilities.Paths.reel,
 *   decoded by ReelPayloadDecoder.reel from the standard Greenfield envelope. Disabled
 *   unless MODULA_REELS_BY_ID_ENABLED=true. Requires an authenticated session and
 *   returns the same ReelItemDto shape as GET /v1/reels, under the same visibility rules.
 */

import type {NodusModelReleaseStore} from './nodus-model-releases.js'
import {
  nodusReleaseDescriptorProblem,
  parseNodusReleaseDescriptor,
  stripNodusReleaseDescriptorV2ToV1,
} from './nodus-release-descriptor.js'

export {nodusReleaseDescriptorProblem, parseNodusReleaseDescriptor} from './nodus-release-descriptor.js'
export type {NodusReleaseDescriptor, NodusReleaseFile} from './nodus-release-descriptor.js'

export type NativeEndpointOptions = {
  /** Raw JSON descriptor for the iOS Nodus release channel. Unset = no release (404). */
  nodusReleaseIosJson?: string
  /** GET /v1/reels/:id is 404 unless true. */
  reelsByIdEnabled?: boolean
  /**
   * Registry-backed release source. When set, /latest serves the published DB
   * release (stripped to the v1 shape) before falling back to the env
   * descriptor, so today's native client keeps working with zero change.
   */
  nodusReleaseStore?: Pick<NodusModelReleaseStore, 'findPublished'>
}

export function nativeEndpointOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): NativeEndpointOptions {
  return {
    nodusReleaseIosJson: env.MODULA_NODUS_RELEASE_IOS_JSON,
    reelsByIdEnabled: env.MODULA_REELS_BY_ID_ENABLED === 'true',
  }
}

const REEL_ID = /^[A-Za-z0-9._:-]{1,160}$/

export async function registerNativeEndpointRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  publicApiUrl: string,
  routeConfig: {feedConfig: Record<string, any>},
  options: NativeEndpointOptions = nativeEndpointOptionsFromEnv(),
) {
  const iosRelease = parseNodusReleaseDescriptor(options.nodusReleaseIosJson)
  if (options.nodusReleaseIosJson?.trim() && !iosRelease) {
    // Never log the descriptor itself; only the reason it was rejected.
    app.log.warn(
      {problem: nodusReleaseDescriptorProblem(options.nodusReleaseIosJson)},
      'MODULA_NODUS_RELEASE_IOS_JSON is set but invalid; Nodus release endpoint stays 404',
    )
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
    if (platform !== 'ios') return notFound(reply, 'No Nodus release is available', request.id)
    // DB-published release first (stripped to the v1 shape today's client
    // decodes), then the env descriptor, then 404. Never synthesise one.
    if (options.nodusReleaseStore) {
      const dbRelease = await options.nodusReleaseStore.findPublished('ios')
      if (dbRelease) return reply.send(stripNodusReleaseDescriptorV2ToV1(dbRelease))
    }
    if (!iosRelease) return notFound(reply, 'No Nodus release is available', request.id)
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
