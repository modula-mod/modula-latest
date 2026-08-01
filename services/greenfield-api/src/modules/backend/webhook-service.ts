import {createHmac} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {moduleError} from '../module-errors.js'
import {GreenfieldModuleRuntimeAccessService} from '../runtime-access.js'
import {ModuleBackendRepository} from './repository.js'
import {ModuleBackendTokenService} from './token-service.js'

export class ModuleBackendWebhookService {
  private readonly tokens: ModuleBackendTokenService
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly repository: ModuleBackendRepository

  constructor(db: ModulaDb, config: AppConfig) {
    this.tokens = new ModuleBackendTokenService(db, config)
    this.access = new GreenfieldModuleRuntimeAccessService(db)
    this.repository = new ModuleBackendRepository(db)
  }

  async receive(moduleId: string, body: unknown, rawToken: string, signature: string | undefined) {
    const token = await this.tokens.resolve(rawToken)
    if (!token || token.moduleId !== moduleId) throw moduleError('UNAUTHENTICATED', 'Valid module backend token is required')
    const webhook = parseWebhook(body, moduleId)
    const context = await this.access.resolve(token.accountId, moduleId, {requireEnabled: true})
    if (context.installationId !== token.installationId) throw moduleError('FORBIDDEN', 'Module backend token installation scope mismatch')
    const valid = verifySignature(rawToken, body, signature)
    if (await this.repository.hasWebhookDelivery(context.installationId, webhook.webhookId, webhook.idempotencyKey)) {
      await this.repository.recordWebhookDelivery({context, webhookId: webhook.webhookId, eventType: webhook.eventType, direction: 'incoming', status: 'duplicate', payload: body, idempotencyKey: webhook.idempotencyKey, signatureValid: valid})
      return {accepted: false, duplicate: true}
    }
    if (!valid) {
      await this.repository.recordWebhookDelivery({context, webhookId: webhook.webhookId, eventType: webhook.eventType, direction: 'incoming', status: 'rejected', payload: body, idempotencyKey: webhook.idempotencyKey, signatureValid: false, failureCode: 'INVALID_SIGNATURE'})
      throw moduleError('FORBIDDEN', 'Invalid module backend webhook signature')
    }
    await this.repository.recordWebhookDelivery({context, webhookId: webhook.webhookId, eventType: webhook.eventType, direction: 'incoming', status: 'accepted', payload: body, idempotencyKey: webhook.idempotencyKey, signatureValid: true})
    return {accepted: true, duplicate: false}
  }
}

function parseWebhook(body: unknown, moduleId: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw moduleError('VALIDATION_FAILED', 'Webhook body must be an object')
  const webhook = body as Record<string, unknown>
  const webhookId = stringField(webhook.webhookId)
  const eventType = stringField(webhook.eventType)
  const idempotencyKey = stringField(webhook.idempotencyKey) ?? webhookId
  if (!webhookId || !eventType || !idempotencyKey) throw moduleError('VALIDATION_FAILED', 'webhookId, eventType and idempotencyKey are required')
  if (!eventType.startsWith(`module.${moduleId}.`)) throw moduleError('FORBIDDEN', 'Module backend webhook event type is outside the module namespace')
  return {webhookId, eventType, idempotencyKey}
}

function verifySignature(token: string, body: unknown, signature: string | undefined): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', token).update(canonicalJsonStringify(body)).digest('hex')
  return signature === expected
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
