import {createHmac} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {GreenfieldEventBus} from '../../events/index.js'
import {moduleError} from '../module-errors.js'
import {GreenfieldModuleRuntimeAccessService} from '../runtime-access.js'
import {ModuleBackendRepository} from './repository.js'
import {ModuleBackendTokenService} from './token-service.js'

export class ModuleBackendEventService {
  private readonly tokens: ModuleBackendTokenService
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly repository: ModuleBackendRepository

  constructor(
    private readonly db: ModulaDb,
    config: AppConfig,
  ) {
    this.tokens = new ModuleBackendTokenService(db, config)
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
    this.repository = new ModuleBackendRepository(db)
  }

  async ingest(moduleId: string, body: unknown, rawToken: string, signature: string | undefined) {
    const token = await this.tokens.resolve(rawToken)
    if (!token || token.moduleId !== moduleId) throw moduleError('UNAUTHENTICATED', 'Valid module backend token is required')
    if (!verifySignature(rawToken, body, signature)) throw moduleError('FORBIDDEN', 'Invalid module backend event signature')
    const event = parseEvent(body, moduleId)
    const context = await this.access.resolve(token.accountId, moduleId, {requireEnabled: true})
    if (context.installationId !== token.installationId) throw moduleError('FORBIDDEN', 'Module backend token installation scope mismatch')
    if (await this.repository.hasEventDelivery(context.installationId, event.eventId, 'backend-to-greenfield')) {
      await this.repository.recordEventDelivery({context, eventId: event.eventId, eventType: event.eventType, direction: 'backend-to-greenfield', status: 'duplicate', payload: body, idempotencyKey: event.eventId})
      return {accepted: false, duplicate: true}
    }
    await this.repository.recordEventDelivery({context, eventId: event.eventId, eventType: event.eventType, direction: 'backend-to-greenfield', status: 'accepted', payload: body, idempotencyKey: event.eventId})
    await new GreenfieldEventBus(this.db).publish({
      eventType: event.eventType,
      aggregateType: 'moduleBackendEvent',
      aggregateId: event.eventId,
      aggregateVersion: 1,
      accountId: context.accountId,
      actorId: token.actorId ?? null,
      requestId: event.requestId ?? event.eventId,
      correlationId: event.correlationId ?? event.eventId,
      visibility: 'internal',
      classification: 'internal',
      payload: {moduleId, installationId: context.installationId, externalEventId: event.eventId},
      metadata: {source: 'module-backend', payloadHashOnly: true},
      occurredAt: new Date(event.occurredAt ?? Date.now()),
    })
    return {accepted: true, duplicate: false}
  }
}

function parseEvent(body: unknown, moduleId: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw moduleError('VALIDATION_FAILED', 'Event body must be an object')
  const event = body as Record<string, unknown>
  const eventId = stringField(event.eventId)
  const eventType = stringField(event.eventType)
  if (!eventId || !eventType) throw moduleError('VALIDATION_FAILED', 'eventId and eventType are required')
  if (!eventType.startsWith(`module.${moduleId}.`)) throw moduleError('FORBIDDEN', 'Module backend event type is outside the module namespace')
  return {
    eventId,
    eventType,
    occurredAt: stringField(event.occurredAt),
    requestId: stringField(event.requestId),
    correlationId: stringField(event.correlationId),
  }
}

function verifySignature(token: string, body: unknown, signature: string | undefined): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', token).update(canonicalJsonStringify(body)).digest('hex')
  return signature === expected
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
