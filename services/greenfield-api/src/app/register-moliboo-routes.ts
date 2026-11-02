import type {FastifyInstance, FastifyReply} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {MolibooService} from '../domains/moliboos/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

const packId = {type: 'string', pattern: '^moliboo\\.character\\.[0-9]{1,4}$', maxLength: 80}
const semver = {type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?$', maxLength: 80}
const packParams = {
  schema: {
    params: {type: 'object', additionalProperties: false, required: ['packId'], properties: {packId}},
  },
}
const versionQuery = {
  type: 'object', additionalProperties: false,
  properties: {version: semver},
}

function mapError(reply: FastifyReply, error: unknown, requestId: string, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'SERVER_ERROR'
  const allowed = new Set([
    'VALIDATION_FAILED', 'INVALID_CURSOR', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'REVISION_CONFLICT',
    'UNTRUSTED_RELEASE', 'RELEASE_REVOKED', 'SIGNER_REVOKED', 'ARTIFACT_DIGEST_MISMATCH',
  ])
  const publicCode = allowed.has(code) ? code : 'SERVER_ERROR'
  return reply.code(statusForError(publicCode as any)).send(failureEnvelope(publicCode as any,
    publicCode === 'SERVER_ERROR' ? fallback : error instanceof Error ? error.message : fallback, requestId))
}

/** Signed content-only Moliboo delivery plus server-authoritative ownership/outfit state. */
export async function registerMolibooRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  routeConfig: {feedConfig: Record<string, any>; writeConfig: Record<string, any>},
) {
  const moliboos = new MolibooService(db, config.publicApiUrl)
  const read = (schema?: Record<string, unknown>) => ({...routeConfig.feedConfig, ...(schema ? {schema} : {})})
  const write = (schema?: Record<string, unknown>) => ({...routeConfig.writeConfig, ...(schema ? {schema} : {})})

  app.get('/v1/moliboos/packs', read({
    querystring: {
      type: 'object', additionalProperties: false,
      properties: {
        cursor: {type: 'string', maxLength: 256},
        limit: {type: 'integer', minimum: 1, maximum: 50, default: 20},
        familyId: {type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,63}$'},
        series: {type: 'integer', minimum: 1, maximum: 99},
        availability: {type: 'string', enum: ['approved'], default: 'approved'},
      },
    },
  }), async (request, reply) => {
    try {
      return reply.send(successEnvelope(await moliboos.listPacks(request.query as any), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load Moliboo packs')
    }
  })

  // Direct compatibility surface for the existing native PackageManager. It is
  // a projection of the same approved release rows returned by /packs.
  app.get('/v1/moliboos/packs/catalog.json', read(), async (request, reply) => {
    try {
      return reply.header('Cache-Control', 'no-cache').send(await moliboos.catalog())
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load Moliboo catalogue')
    }
  })

  app.get('/v1/moliboos/packs/:packId/manifest', read({
    ...packParams.schema,
    querystring: versionQuery,
  }), async (request, reply) => {
    try {
      const {packId: requested} = request.params as {packId: string}
      const {version} = request.query as {version?: string}
      return reply.send(successEnvelope({manifest: await moliboos.manifest(requested, version)}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load Moliboo pack manifest')
    }
  })

  app.get('/v1/moliboos/packs/:packId/download', read({
    ...packParams.schema,
    querystring: versionQuery,
  }), async (request, reply) => {
    try {
      const {packId: requested} = request.params as {packId: string}
      const {version} = request.query as {version?: string}
      const artifact = await moliboos.download(requested, version)
      return reply
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('ETag', `"sha256-${artifact.sha256}"`)
        .header('X-Content-Type-Options', 'nosniff')
        .header('X-Modula-Artifact-Sha256', artifact.sha256)
        .header('Content-Length', String(artifact.byteSize))
        .type(artifact.mediaType)
        .send(artifact.bytes)
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to download Moliboo pack')
    }
  })

  app.get('/v1/me/moliboos/ownership', read({
    querystring: {
      type: 'object', additionalProperties: false,
      properties: {cursor: {type: 'string', maxLength: 512}, limit: {type: 'integer', minimum: 1, maximum: 50, default: 20}},
    },
  }), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await moliboos.ownership(auth.accountId, request.query as any), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load Moliboo ownership')
    }
  })

  app.get('/v1/me/moliboos/outfit', read(), async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await moliboos.outfit(auth.accountId), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load Moliboo outfit')
    }
  })

  app.put('/v1/me/moliboos/outfit', write({
    body: {
      type: 'object', additionalProperties: false, required: ['items'],
      properties: {
        expectedRevision: {type: 'integer', minimum: 0},
        items: {
          type: 'array', maxItems: 16,
          items: {
            type: 'object', additionalProperties: false, required: ['slot', 'itemId'],
            properties: {
              slot: {type: 'string', pattern: '^[a-z][a-z0-9-]{1,31}$'},
              itemId: {type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$'},
            },
          },
        },
      },
    },
  }), async (request, reply) => {
    const auth = requireCapability(request, reply, 'profile:customize')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await moliboos.setOutfit(auth.accountId, auth.actorId, request.body), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to update Moliboo outfit')
    }
  })

  if (config.environment !== 'production') {
    const availabilitySchema = {
      ...packParams.schema,
      body: {
        type: 'object', additionalProperties: false,
        properties: {version: semver, reason: {type: 'string', minLength: 1, maxLength: 500}},
      },
    }
    app.post('/v1/admin/qa/moliboos/packs/:packId/withdraw', write(availabilitySchema), async (request, reply) => {
      const auth = requireCapability(request, reply, 'admin:ops')
      if (!auth) return
      try {
        return reply.send(successEnvelope(await moliboos.setAvailability(auth.accountId,
          (request.params as {packId: string}).packId, request.body, 'withdrawn'), request.id))
      } catch (error) {
        return mapError(reply, error, request.id, 'Unable to withdraw Moliboo pack')
      }
    })
    app.post('/v1/admin/qa/moliboos/packs/:packId/restore', write(availabilitySchema), async (request, reply) => {
      const auth = requireCapability(request, reply, 'admin:ops')
      if (!auth) return
      try {
        return reply.send(successEnvelope(await moliboos.setAvailability(auth.accountId,
          (request.params as {packId: string}).packId, request.body, 'approved'), request.id))
      } catch (error) {
        return mapError(reply, error, request.id, 'Unable to restore Moliboo pack')
      }
    })
  }
}
