import {createDecipheriv} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * Decrypts AT Protocol OAuth session material written by services/api
 * (see services/api/src/security/crypto.ts). Layout is
 * `iv(12) || authTag(16) || ciphertext`, AES-256-GCM via Node's
 * `createDecipheriv` — no custom cryptographic primitive. The worker only
 * ever decrypts; encryption happens on the API side at OAuth callback time.
 */
export function decryptWithKey(blob: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes for AES-256-GCM')
  }
  if (blob.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted blob is too short to contain iv + authTag')
  }
  const iv = blob.subarray(0, IV_LENGTH)
  const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = blob.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export class OAuthSessionUnavailableError extends Error {
  readonly code = 'OAUTH_SESSION_UNAVAILABLE' as const
  constructor(message: string) {
    super(message)
    this.name = 'OAuthSessionUnavailableError'
  }
}

export function decryptSessionMaterial(
  encryptionKeysByVersion: Map<number, Buffer>,
  ciphertext: Buffer,
  keyVersion: number,
): Buffer {
  const key = encryptionKeysByVersion.get(keyVersion)
  if (!key) {
    throw new OAuthSessionUnavailableError(`No encryption key available for version ${keyVersion}`)
  }
  try {
    return decryptWithKey(ciphertext, key)
  } catch (error) {
    throw new OAuthSessionUnavailableError(
      `Failed to decrypt AT Protocol OAuth session material: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function decryptJsonSessionMaterial<T>(
  encryptionKeysByVersion: Map<number, Buffer>,
  ciphertext: Buffer,
  keyVersion: number,
): T {
  const plaintext = decryptSessionMaterial(encryptionKeysByVersion, ciphertext, keyVersion)
  try {
    return JSON.parse(plaintext.toString('utf8')) as T
  } catch (error) {
    throw new OAuthSessionUnavailableError(
      `AT Protocol OAuth session material is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
