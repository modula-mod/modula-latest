import {createCipheriv, createDecipheriv, randomBytes, type CipherGCM, type DecipherGCM} from 'node:crypto'
import type {AppConfig} from '../../config/index.js'

export const CONNECTOR_CREDENTIAL_ENCRYPTION_ALGORITHM = 'AES-256-GCM' as const

const NONCE_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export type ConnectorCredentialPlaintext = {
  accessToken?: string
  refreshToken?: string
  tokenType?: string
  expiresAt?: string
  auxiliary?: Record<string, unknown>
}

export type ConnectorCredentialEncryptionContext = {
  accountId: string
  providerId: string
  connectionId: string
  purpose?: 'connector-credentials' | 'oauth-pkce-verifier'
}

export type ConnectorCredentialEnvelope = {
  algorithm: typeof CONNECTOR_CREDENTIAL_ENCRYPTION_ALGORITHM
  keyVersion: string
  nonce: Buffer
  ciphertext: Buffer
  authTag: Buffer
}

type ConnectorCredentialKeyConfig = Pick<
  AppConfig,
  'connectorCredentialEncryptionKey' | 'connectorCredentialEncryptionKeysByVersion'
>

export class ConnectorCredentialEncryptionService {
  constructor(private readonly config: ConnectorCredentialKeyConfig) {}

  encryptCredentials(
    context: ConnectorCredentialEncryptionContext,
    plaintext: ConnectorCredentialPlaintext,
  ): ConnectorCredentialEnvelope {
    if (!plaintext.accessToken && !plaintext.refreshToken && !plaintext.auxiliary) {
      throw credentialEncryptionError('Credential payload is empty')
    }
    return this.encryptBuffer(context, Buffer.from(JSON.stringify(plaintext), 'utf8'))
  }

  decryptCredentials(
    context: ConnectorCredentialEncryptionContext,
    envelope: ConnectorCredentialEnvelope,
  ): ConnectorCredentialPlaintext {
    const decrypted = this.decryptBuffer(context, envelope)
    const parsed = JSON.parse(decrypted.toString('utf8')) as ConnectorCredentialPlaintext
    return {
      accessToken: stringOrUndefined(parsed.accessToken),
      refreshToken: stringOrUndefined(parsed.refreshToken),
      tokenType: stringOrUndefined(parsed.tokenType),
      expiresAt: stringOrUndefined(parsed.expiresAt),
      auxiliary: objectOrUndefined(parsed.auxiliary),
    }
  }

  encryptString(context: ConnectorCredentialEncryptionContext, value: string): ConnectorCredentialEnvelope {
    if (!value) throw credentialEncryptionError('Secret payload is empty')
    return this.encryptBuffer(context, Buffer.from(value, 'utf8'))
  }

  decryptString(context: ConnectorCredentialEncryptionContext, envelope: ConnectorCredentialEnvelope): string {
    return this.decryptBuffer(context, envelope).toString('utf8')
  }

  private encryptBuffer(
    context: ConnectorCredentialEncryptionContext,
    plaintext: Buffer,
  ): ConnectorCredentialEnvelope {
    const keyVersion = String(this.config.connectorCredentialEncryptionKey.version)
    const key = this.config.connectorCredentialEncryptionKey.key
    assertKey(key)
    const nonce = randomBytes(NONCE_LENGTH)
    const cipher = createCipheriv(CONNECTOR_CREDENTIAL_ENCRYPTION_ALGORITHM, key, nonce) as CipherGCM
    cipher.setAAD(associatedData(context, keyVersion))
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    return {
      algorithm: CONNECTOR_CREDENTIAL_ENCRYPTION_ALGORITHM,
      keyVersion,
      nonce,
      ciphertext,
      authTag: cipher.getAuthTag(),
    }
  }

  private decryptBuffer(context: ConnectorCredentialEncryptionContext, envelope: ConnectorCredentialEnvelope): Buffer {
    if (envelope.algorithm !== CONNECTOR_CREDENTIAL_ENCRYPTION_ALGORITHM) {
      throw credentialEncryptionError('Unsupported credential envelope algorithm')
    }
    if (envelope.nonce.length !== NONCE_LENGTH || envelope.authTag.length !== AUTH_TAG_LENGTH) {
      throw credentialEncryptionError('Invalid credential envelope')
    }
    const keyVersion = Number(envelope.keyVersion)
    const key = this.config.connectorCredentialEncryptionKeysByVersion.get(keyVersion)
    if (!key) throw credentialEncryptionError('Credential key version is not available')
    assertKey(key)
    try {
      const decipher = createDecipheriv(CONNECTOR_CREDENTIAL_ENCRYPTION_ALGORITHM, key, envelope.nonce) as DecipherGCM
      decipher.setAAD(associatedData(context, envelope.keyVersion))
      decipher.setAuthTag(envelope.authTag)
      return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()])
    } catch {
      throw credentialEncryptionError('Credential envelope authentication failed')
    }
  }
}

function associatedData(context: ConnectorCredentialEncryptionContext, keyVersion: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      purpose: context.purpose ?? 'connector-credentials',
      accountId: context.accountId,
      providerId: context.providerId,
      connectionId: context.connectionId,
      keyVersion,
    }),
    'utf8',
  )
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) {
    throw credentialEncryptionError('Credential key must be 32 bytes')
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function objectOrUndefined(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function credentialEncryptionError(message: string): Error {
  return Object.assign(new Error(message), {code: 'SERVER_ERROR' as const})
}
