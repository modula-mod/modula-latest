import type {FastifyInstance} from 'fastify'

import type {ModulaDb} from '../database/client.js'
import {PushDeviceService, PushPreferencesService} from '../domains/push/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

function mapDomainError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (code === 'VALIDATION_FAILED' || code === 'NOT_FOUND' || code === 'CONFLICT') {
    return reply.code(statusForError(code)).send(failureEnvelope(code, error.message ?? fallback, requestId))
  }
  return reply.code(statusForError('SERVER_ERROR')).send(failureEnvelope('SERVER_ERROR', fallback, requestId))
}

const deviceBody = {
  type: 'object',
  additionalProperties: false,
  required: ['token'],
  properties: {
    token: {type: 'string', minLength: 64, maxLength: 220},
    platform: {type: 'string', enum: ['ios']},
    environment: {type: 'string', enum: ['development', 'production']},
    bundleId: {type: 'string', maxLength: 200},
    appVersion: {type: 'string', maxLength: 40},
    deviceName: {type: 'string', maxLength: 120},
    locale: {type: 'string', maxLength: 35},
    timezone: {type: 'string', maxLength: 64},
  },
}

/**
 * APNs push: device registration and per-actor push preferences.
 *   POST   /v1/push/devices           register/refresh a device token
 *   GET    /v1/push/devices           list my active devices
 *   DELETE /v1/push/devices/:token    unregister (sign out / opt out)
 *   GET    /v1/push/preferences       push toggles + quiet hours
 *   PATCH  /v1/push/preferences       partial update (optimistic version)
 */
export async function registerPushRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  options: {bundleId: string; profileConfig: Record<string, any>; writeConfig: Record<string, any>},
): Promise<void> {
  const devices = new PushDeviceService(db, options.bundleId)
  const preferences = new PushPreferencesService(db)

  app.post('/v1/push/devices', {...options.writeConfig, schema: {body: deviceBody}}, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      const device = await devices.register(auth, (request.body ?? {}) as Record<string, unknown>)
      return reply.code(201).send(successEnvelope({device}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to register device')
    }
  })

  app.get('/v1/push/devices', options.profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope({devices: await devices.list(auth.actorId)}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to list devices')
    }
  })

  app.delete('/v1/push/devices/:token', {
    ...options.writeConfig,
    schema: {params: {type: 'object', additionalProperties: false, required: ['token'], properties: {token: {type: 'string', minLength: 64, maxLength: 220}}}},
  }, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      const {token} = request.params as {token: string}
      const removed = await devices.unregister(auth.actorId, token)
      return reply.send(successEnvelope({removed}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to unregister device')
    }
  })

  app.get('/v1/push/preferences', options.profileConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await preferences.get(auth.actorId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load push preferences')
    }
  })

  app.patch('/v1/push/preferences', options.writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    try {
      return reply.send(successEnvelope(await preferences.patch(auth.actorId, (request.body ?? {}) as Record<string, unknown>), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update push preferences')
    }
  })
}
