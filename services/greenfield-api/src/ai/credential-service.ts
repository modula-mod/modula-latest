import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {
  AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM,
  AIProviderCredentialEncryptionService,
  type AIProviderCredentialPlaintext,
} from '../security/encryption/ai-provider-credentials.js'
import {AIProviderRuntimeRepository, type AIProviderCredentialRecord} from './runtime-repository.js'

export type AIProviderCredentialScope = {
  scopeType: 'platform' | 'organisation' | 'account' | 'development'
  scopeId?: string | null
}

export type AIProviderCredentialPublicRecord = {
  credentialId: string
  providerId: string
  scopeType: AIProviderCredentialScope['scopeType']
  scopeId: string | null
  status: string
  encryptionKeyVersion: string
  createdAt: Date
  updatedAt: Date
  rotatedAt: Date | null
  lastVerifiedAt: Date | null
  lastVerificationCode: string | null
}

export class AIProviderCredentialService {
  private readonly repository: AIProviderRuntimeRepository
  private readonly encryption: AIProviderCredentialEncryptionService
  private readonly audit: AuditRepository
  private readonly events: GreenfieldEventBus

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.repository = new AIProviderRuntimeRepository(db)
    this.encryption = new AIProviderCredentialEncryptionService(config)
    this.audit = new AuditRepository(db)
    this.events = new GreenfieldEventBus(db)
  }

  async store(input: {
    providerId: string
    scopeType: AIProviderCredentialScope['scopeType']
    scopeId?: string | null
    credential: AIProviderCredentialPlaintext
    actorId?: string | null
    requestId?: string | null
    correlationId?: string | null
  }): Promise<AIProviderCredentialPublicRecord> {
    const credentialId = `ai-credential-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const context = {
      providerId: input.providerId,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      credentialId,
    }
    const envelope = this.encryption.encryptCredentials(context, input.credential)
    const stored = await this.repository.storeCredential({
      credentialId,
      providerId: input.providerId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      encryptedPayload: envelope.ciphertext,
      encryptionKeyVersion: envelope.keyVersion,
      nonce: envelope.nonce,
      authenticationTag: envelope.authTag,
      status: 'unverified',
    })
    await this.audit.append(
      'ai.provider.credential.created',
      {
        credentialId: stored.credential_id,
        providerId: input.providerId,
        scopeType: input.scopeType,
        scopeId: input.scopeId ?? null,
        keyVersion: envelope.keyVersion,
      },
      {type: 'aiProviderCredential', id: stored.credential_id, actorId: input.actorId ?? null},
      {accountId: input.scopeType === 'account' ? input.scopeId ?? null : null, requestId: input.requestId ?? null, correlationId: input.correlationId ?? input.requestId ?? null},
    )
    return toPublicCredentialRecord(stored)
  }

  async resolveCredential(input: {
    providerId: string
    scopes: AIProviderCredentialScope[]
  }): Promise<AIProviderCredentialPlaintext | undefined> {
    for (const scope of input.scopes) {
      const record = await this.repository.activeCredential(input.providerId, scope.scopeType, scope.scopeId ?? null)
      if (!record || record.status === 'revoked' || record.status === 'rotated') continue
      return this.decrypt(record)
    }
    return undefined
  }

  async markVerification(input: {
    credentialId: string
    providerId: string
    status: 'active' | 'verification_failed'
    code: string
    actorId?: string | null
    requestId?: string | null
    correlationId?: string | null
  }): Promise<void> {
    await this.repository.markCredentialVerification(input.credentialId, input.status, input.code)
    await this.audit.append(
      input.status === 'active' ? 'ai.provider.credential.verified' : 'ai.provider.credential.verification_failed',
      {
        credentialId: input.credentialId,
        providerId: input.providerId,
        code: input.code,
      },
      {type: 'aiProviderCredential', id: input.credentialId, actorId: input.actorId ?? null},
      {requestId: input.requestId ?? null, correlationId: input.correlationId ?? input.requestId ?? null},
    )
  }

  async activePublicRecord(providerId: string, scope: AIProviderCredentialScope): Promise<AIProviderCredentialPublicRecord | null> {
    const record = await this.repository.activeCredential(providerId, scope.scopeType, scope.scopeId ?? null)
    return record ? toPublicCredentialRecord(record) : null
  }

  async publishProviderEnabled(input: {providerId: string; enabled: boolean; actorId?: string | null; requestId?: string | null}): Promise<void> {
    await this.audit.append(
      input.enabled ? 'ai.provider.enabled' : 'ai.provider.disabled',
      {providerId: input.providerId},
      {type: 'aiProvider', id: input.providerId, actorId: input.actorId ?? null},
      {requestId: input.requestId ?? null, correlationId: input.requestId ?? null},
    )
    await this.events.publish({
      eventType: input.enabled ? 'ai.provider.enabled' : 'ai.provider.disabled',
      aggregateType: 'aiProvider',
      aggregateId: input.providerId,
      requestId: input.requestId ?? input.providerId,
      correlationId: input.requestId ?? input.providerId,
      idempotencyKey: `${input.providerId}:${input.enabled ? 'enabled' : 'disabled'}:${input.requestId ?? 'operator'}`,
      visibility: 'internal',
      classification: 'sensitive',
      payload: {providerId: input.providerId, enabled: input.enabled},
    })
  }

  private decrypt(record: AIProviderCredentialRecord): AIProviderCredentialPlaintext {
    if (record.encrypted_payload.includes(Buffer.from('sk-', 'utf8'))) {
      throw Object.assign(new Error('AI provider credential storage is not encrypted'), {code: 'SERVER_ERROR' as const})
    }
    return this.encryption.decryptCredentials(
      {
        providerId: record.provider_id,
        scopeType: record.scope_type,
        scopeId: record.scope_id,
        credentialId: record.credential_id,
      },
      {
        algorithm: AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM,
        keyVersion: record.encryption_key_version,
        nonce: record.nonce,
        ciphertext: record.encrypted_payload,
        authTag: record.authentication_tag,
      },
    )
  }
}

export function toPublicCredentialRecord(record: AIProviderCredentialRecord): AIProviderCredentialPublicRecord {
  return {
    credentialId: record.credential_id,
    providerId: record.provider_id,
    scopeType: record.scope_type,
    scopeId: record.scope_id,
    status: record.status,
    encryptionKeyVersion: record.encryption_key_version,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    rotatedAt: record.rotated_at,
    lastVerifiedAt: record.last_verified_at,
    lastVerificationCode: record.last_verification_code,
  }
}
