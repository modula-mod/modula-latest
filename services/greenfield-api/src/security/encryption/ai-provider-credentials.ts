import {createCipheriv, createDecipheriv, randomBytes, type CipherGCM, type DecipherGCM} from 'node:crypto'
import type {AppConfig} from '../../config/index.js'

export const AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM = 'AES-256-GCM' as const

const NONCE_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export type AIProviderCredentialPlaintext = {
  apiKey?: string
  baseUrl?: string
  organisationId?: string
  projectId?: string
  headers?: Record<string, string>
  auxiliary?: Record<string, unknown>
}

export type AIProviderCredentialEncryptionContext = {
  providerId: string
  scopeType: 'platform' | 'organisation' | 'account' | 'development'
  scopeId?: string | null
  credentialId: string
}

export type AIProviderCredentialEnvelope = {
  algorithm: typeof AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM
  keyVersion: string
  nonce: Buffer
  ciphertext: Buffer
  authTag: Buffer
}

type AIProviderCredentialKeyConfig = Pick<
  AppConfig,
  'aiProviderCredentialEncryptionKey' | 'aiProviderCredentialEncryptionKeysByVersion'
>

export class AIProviderCredentialEncryptionService {
  constructor(private readonly config: AIProviderCredentialKeyConfig) {}

  encryptCredentials(
    context: AIProviderCredentialEncryptionContext,
    plaintext: AIProviderCredentialPlaintext,
  ): AIProviderCredentialEnvelope {
    if (!plaintext.apiKey && !plaintext.baseUrl && !plaintext.auxiliary) {
      throw credentialEncryptionError('AI provider credential payload is empty')
    }
    return this.encryptBuffer(context, Buffer.from(JSON.stringify(normalizeCredentialPayload(plaintext)), 'utf8'))
  }

  decryptCredentials(
    context: AIProviderCredentialEncryptionContext,
    envelope: AIProviderCredentialEnvelope,
  ): AIProviderCredentialPlaintext {
    const parsed = JSON.parse(this.decryptBuffer(context, envelope).toString('utf8')) as AIProviderCredentialPlaintext
    return normalizeCredentialPayload(parsed)
  }

  private encryptBuffer(
    context: AIProviderCredentialEncryptionContext,
    plaintext: Buffer,
  ): AIProviderCredentialEnvelope {
    const keyVersion = String(this.config.aiProviderCredentialEncryptionKey.version)
    const key = this.config.aiProviderCredentialEncryptionKey.key
    assertKey(key)
    const nonce = randomBytes(NONCE_LENGTH)
    const cipher = createCipheriv(AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM, key, nonce) as CipherGCM
    cipher.setAAD(associatedData(context, keyVersion))
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    return {
      algorithm: AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM,
      keyVersion,
      nonce,
      ciphertext,
      authTag: cipher.getAuthTag(),
    }
  }

  private decryptBuffer(context: AIProviderCredentialEncryptionContext, envelope: AIProviderCredentialEnvelope): Buffer {
    if (envelope.algorithm !== AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM) {
      throw credentialEncryptionError('Unsupported AI provider credential envelope algorithm')
    }
    if (envelope.nonce.length !== NONCE_LENGTH || envelope.authTag.length !== AUTH_TAG_LENGTH) {
      throw credentialEncryptionError('Invalid AI provider credential envelope')
    }
    const keyVersion = Number(envelope.keyVersion)
    const key = this.config.aiProviderCredentialEncryptionKeysByVersion.get(keyVersion)
    if (!key) throw credentialEncryptionError('AI provider credential key version is not available')
    assertKey(key)
    try {
      const decipher = createDecipheriv(AI_PROVIDER_CREDENTIAL_ENCRYPTION_ALGORITHM, key, envelope.nonce) as DecipherGCM
      decipher.setAAD(associatedData(context, envelope.keyVersion))
      decipher.setAuthTag(envelope.authTag)
      return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()])
    } catch {
      throw credentialEncryptionError('AI provider credential envelope authentication failed')
    }
  }
}

function associatedData(context: AIProviderCredentialEncryptionContext, keyVersion: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      purpose: 'ai-provider-credentials',
      providerId: context.providerId,
      scopeType: context.scopeType,
      scopeId: context.scopeId ?? null,
      credentialId: context.credentialId,
      keyVersion,
    }),
    'utf8',
  )
}

function normalizeCredentialPayload(value: AIProviderCredentialPlaintext): AIProviderCredentialPlaintext {
  return {
    apiKey: stringOrUndefined(value.apiKey),
    baseUrl: stringOrUndefined(value.baseUrl),
    organisationId: stringOrUndefined(value.organisationId),
    projectId: stringOrUndefined(value.projectId),
    headers: stringRecordOrUndefined(value.headers),
    auxiliary: objectOrUndefined(value.auxiliary),
  }
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) {
    throw credentialEncryptionError('AI provider credential key must be 32 bytes')
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stringRecordOrUndefined(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return entries.length ? Object.fromEntries(entries) : undefined
}

function objectOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function credentialEncryptionError(message: string): Error {
  return Object.assign(new Error(message), {code: 'SERVER_ERROR' as const})
}
