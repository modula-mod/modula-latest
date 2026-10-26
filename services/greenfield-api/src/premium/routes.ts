import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {requireAuth, requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {PremiumService} from './service.js'
import {VerificationService} from './verification-service.js'

const KNOWN = new Set(['VALIDATION_FAILED', 'FORBIDDEN', 'CONFLICT', 'NOT_FOUND', 'CAPABILITY_UNAVAILABLE'])

function fail(reply: any, error: any, requestId: string, fallback: string) {
  const code = KNOWN.has(error?.code) ? error.code : 'SERVER_ERROR'
  return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? fallback : error.message, requestId))
}

export async function registerPremiumRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>},
) {
  const premium = new PremiumService(db, config.environment !== 'production')
  const verification = new VerificationService(db)

  if (config.premium.enabled) {
    app.get('/v1/premium/tiers', routeConfig.profileConfig, async (request, reply) => {
      if (!requireAuth(request, reply)) return
      try { return reply.send(successEnvelope(await premium.catalogue(), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to load membership tiers') }
    })

    app.get('/v1/me/membership', routeConfig.profileConfig, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try { return reply.send(successEnvelope(await premium.membership(auth.accountId, auth.actorId), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to load membership') }
    })

    app.get('/v1/me/entitlements', routeConfig.profileConfig, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try { return reply.send(successEnvelope(await premium.effectiveEntitlements(auth.accountId, auth.actorId), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to evaluate entitlements') }
    })

    app.get('/v1/me/entitlements/:capabilityId', {
      ...routeConfig.profileConfig,
      schema: {params: {type: 'object', additionalProperties: false, required: ['capabilityId'], properties: {capabilityId: {type: 'string', pattern: '^[a-z][a-z0-9_]{2,79}$'}}}},
    }, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try { return reply.send(successEnvelope(await premium.feature(auth.accountId, auth.actorId, (request.params as {capabilityId: string}).capabilityId), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to evaluate feature') }
    })

    app.patch('/v1/me/membership/badge-visibility', routeConfig.writeConfig, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try {
        const visible = (request.body as {visible?: unknown} | undefined)?.visible
        if (typeof visible !== 'boolean') throw Object.assign(new Error('visible must be boolean'), {code: 'VALIDATION_FAILED'})
        return reply.send(successEnvelope(await premium.setBadgeVisibility(auth.accountId, auth.actorId, visible), request.id))
      } catch (error) { return fail(reply, error, request.id, 'Unable to update badge visibility') }
    })

    if (config.premium.qaAssignmentsEnabled) {
      app.put('/v1/admin/qa/premium/:handle', {
        ...routeConfig.writeConfig,
        schema: {params: {type: 'object', additionalProperties: false, required: ['handle'], properties: {handle: {type: 'string', minLength: 1, maxLength: 80}}}},
      }, async (request, reply) => {
        const auth = requireCapability(request, reply, 'admin:ops'); if (!auth) return
        const header = request.headers['idempotency-key']
        if (typeof header !== 'string' || header.trim().length < 8) return reply.code(400).send(failureEnvelope('VALIDATION_FAILED', 'Idempotency-Key of at least 8 characters is required', request.id))
        try { return reply.send(successEnvelope(await premium.assignQaFixture(auth.actorId, (request.params as {handle: string}).handle, (request.body ?? {}) as Record<string, unknown>, header.trim()), request.id)) }
        catch (error) { return fail(reply, error, request.id, 'Unable to assign QA membership') }
      })
    }
  }

  if (config.premium.verificationEnabled) {
    app.get('/v1/me/verification', routeConfig.profileConfig, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try { return reply.send(successEnvelope(await verification.me(auth.accountId), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to load verification') }
    })

    app.post('/v1/me/verification/applications', routeConfig.writeConfig, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try { return reply.code(201).send(successEnvelope(await verification.createApplication(auth.accountId, auth.actorId, (request.body ?? {}) as Record<string, unknown>), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to create verification application') }
    })

    app.post('/v1/me/verification/applications/:applicationId/appeals', {
      ...routeConfig.writeConfig,
      schema: {params: {type: 'object', additionalProperties: false, required: ['applicationId'], properties: {applicationId: {type: 'string', minLength: 10, maxLength: 80}}}},
    }, async (request, reply) => {
      const auth = requireAuth(request, reply); if (!auth) return
      try { return reply.code(201).send(successEnvelope(await verification.createAppeal(auth.accountId, auth.actorId, (request.params as {applicationId: string}).applicationId, (request.body ?? {}) as Record<string, unknown>), request.id)) }
      catch (error) { return fail(reply, error, request.id, 'Unable to create verification appeal') }
    })

    if (config.premium.verificationQaReviewEnabled) {
      app.get('/v1/admin/qa/verification/applications', routeConfig.profileConfig, async (request, reply) => {
        if (!requireCapability(request, reply, 'admin:moderation')) return
        try { return reply.send(successEnvelope(await verification.listApplications((request.query as {state?: string}).state), request.id)) }
        catch (error) { return fail(reply, error, request.id, 'Unable to list verification applications') }
      })

      app.post('/v1/admin/qa/verification/applications/:applicationId/transitions', {
        ...routeConfig.writeConfig,
        schema: {params: {type: 'object', additionalProperties: false, required: ['applicationId'], properties: {applicationId: {type: 'string', minLength: 10, maxLength: 80}}}},
      }, async (request, reply) => {
        const auth = requireCapability(request, reply, 'admin:moderation'); if (!auth) return
        try { return reply.send(successEnvelope(await verification.transition(auth.actorId, (request.params as {applicationId: string}).applicationId, (request.body ?? {}) as Record<string, unknown>), request.id)) }
        catch (error) { return fail(reply, error, request.id, 'Unable to review verification application') }
      })

      app.post('/v1/admin/qa/verification/appeals/:appealId/transitions', {
        ...routeConfig.writeConfig,
        schema: {params: {type: 'object', additionalProperties: false, required: ['appealId'], properties: {appealId: {type: 'string', minLength: 10, maxLength: 80}}}},
      }, async (request, reply) => {
        const auth = requireCapability(request, reply, 'admin:moderation'); if (!auth) return
        try { return reply.send(successEnvelope(await verification.transitionAppeal(auth.actorId, (request.params as {appealId: string}).appealId, (request.body ?? {}) as Record<string, unknown>), request.id)) }
        catch (error) { return fail(reply, error, request.id, 'Unable to review verification appeal') }
      })
    }
  }
}
