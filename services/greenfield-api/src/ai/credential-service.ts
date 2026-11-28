import {isIP} from 'node:net'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/index.js'
import {moduleError} from '../modules/module-errors.js'
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
    if (input.scopeType === 'account') validateAccountCredentialEndpoint(input.credential)
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

  /**
   * Revoke the active credential for a scope. The ciphertext row stays in
   * the table with status `revoked` (auditable, never usable again) — the
   * key material is not deleted, because the audit trail must be able to
   * show which credential was revoked and when. Storing a replacement
   * credential rotates the old one instead.
   */
  async revoke(input: {
    providerId: string
    scopeType: AIProviderCredentialScope['scopeType']
    scopeId?: string | null
    actorId?: string | null
    requestId?: string | null
    correlationId?: string | null
  }): Promise<{revoked: boolean}> {
    const record = await this.repository.activeCredential(input.providerId, input.scopeType, input.scopeId ?? null)
    if (!record) return {revoked: false}
    const revoked = await this.repository.revokeCredential(record.credential_id)
    if (revoked) {
      await this.audit.append(
        'ai.provider.credential.revoked',
        {credentialId: record.credential_id, providerId: input.providerId, scopeType: input.scopeType, scopeId: input.scopeId ?? null},
        {type: 'aiProviderCredential', id: record.credential_id, actorId: input.actorId ?? null},
        {accountId: input.scopeType === 'account' ? input.scopeId ?? null : null, requestId: input.requestId ?? null, correlationId: input.correlationId ?? input.requestId ?? null},
      )
      this.events.publish({
        eventType: 'ai.provider.credential.revoked',
        aggregateType: 'aiProviderCredential',
        aggregateId: record.credential_id,
        accountId: input.scopeType === 'account' ? input.scopeId ?? null : null,
        actorId: input.actorId ?? null,
        requestId: input.requestId ?? null,
        correlationId: input.correlationId ?? input.requestId ?? null,
        idempotencyKey: `ai-provider-credential-revoked:${record.credential_id}:${Date.now()}`,
        visibility: 'internal',
        classification: 'sensitive',
        payload: {providerId: input.providerId, scopeType: input.scopeType, scopeId: input.scopeId ?? null},
      }).catch(() => undefined)
    }
    return {revoked}
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

/**
 * Account-scoped credentials are stored by any authenticated account, so a
 * custom baseUrl is an SSRF surface: the server would issue requests to a
 * user-chosen URL with user-chosen headers and return the response as model
 * output. Custom endpoints stay supported (self-hosted LM Studio etc.), but
 * for account scope the endpoint must be a public HTTPS host — no plain
 * HTTP, no loopback, no private/link-local address, no host that can only
 * resolve locally. Admin/platform credentials are unaffected.
 */
function validateAccountCredentialEndpoint(credential: AIProviderCredentialPlaintext): void {
  const baseUrl = credential.baseUrl
  if (!baseUrl) return
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw moduleError('VALIDATION_FAILED', 'AI provider credential baseUrl must be a valid URL')
  }
  if (url.protocol !== 'https:') {
    throw moduleError('VALIDATION_FAILED', 'AI provider credential baseUrl must use https')
  }
  if (isPrivateOrLoopbackHost(url.hostname)) {
    throw moduleError('VALIDATION_FAILED', 'AI provider credential baseUrl must point at a public host')
  }
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'host.docker.internal') return true
  const ipVersion = isIP(host)
  if (ipVersion === 4) return isPrivateIPv4(host)
  if (ipVersion === 6) {
    if (host === '::1' || host === '::') return true
    const first = Number.parseInt(host.split(':')[0] || '0', 16)
    // fe80::/10 link-local, fc00::/7 unique-local.
    if ((first >= 0xfe80 && first <= 0xfebf) || (first >= 0xfc00 && first <= 0xfdff)) return true
    // IPv4-mapped IPv6 (e.g. ::ffff:192.168.0.1) carries a private v4 address.
    const embedded = host.split(':').at(-1) ?? ''
    if (/^\d+\.\d+\.\d+\.\d+$/.test(embedded)) return isPrivateIPv4(embedded)
    return false
  }
  // Single-label hostnames only resolve via local search domains / mDNS.
  if (!host.includes('.')) return true
  return false
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  const a = parts[0] ?? 0
  const b = parts[1] ?? 0
  if (a === 127 || a === 0) return true
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  return false
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
