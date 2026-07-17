import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'
import type {AppConfig} from '../config/index.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export type EncryptedBlob = {
  ciphertext: Buffer
  keyVersion: number
}

/**
 * Encrypts `plaintext` with AES-256-GCM using Node's `createCipheriv` — no
 * custom cryptographic algorithm is implemented here. Output layout is
 * `iv(12) || authTag(16) || ciphertext`. The key version is tracked
 * alongside the blob (callers persist it in a separate column) so keys can
 * rotate without breaking previously encrypted rows.
 */
export function encryptWithKey(plaintext: string | Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes for AES-256-GCM')
  }
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

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

/** Encrypts using the current (highest version) configured key. */
export function encryptSessionMaterial(config: AppConfig, plaintext: string | Buffer): EncryptedBlob {
  const {version, key} = config.atprotoOAuthEncryptionKey
  return {ciphertext: encryptWithKey(plaintext, key), keyVersion: version}
}

/** Decrypts using whichever configured key matches the stored version (supports rotation). */
export function decryptSessionMaterial(config: AppConfig, ciphertext: Buffer, keyVersion: number): Buffer {
  const key = config.atprotoOAuthEncryptionKeysByVersion.get(keyVersion)
  if (!key) {
    throw Object.assign(new Error(`No encryption key available for version ${keyVersion}`), {
      code: 'SERVER_ERROR' as const,
    })
  }
  return decryptWithKey(ciphertext, key)
}

export function encryptJson(config: AppConfig, value: unknown): EncryptedBlob {
  return encryptSessionMaterial(config, JSON.stringify(value))
}

export function decryptJson<T>(config: AppConfig, ciphertext: Buffer, keyVersion: number): T {
  return JSON.parse(decryptSessionMaterial(config, ciphertext, keyVersion).toString('utf8')) as T
}
