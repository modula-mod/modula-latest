import {Algorithm, hash, verify} from '@node-rs/argon2'

/** Argon2id through the maintained @node-rs/argon2 implementation — no custom password hashing. */
export const PASSWORD_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
}

/**
 * Precomputed Argon2id hash using PASSWORD_OPTIONS of an unguessable random
 * secret that is not retained. Unknown-email login verifies against this so the
 * work matches a wrong-password attempt; the secret cannot be used to sign in.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$v/XLzaaRTysNFB24NUYdEw$TENhf/cKJiKv7sK8Hyjejv73dRbrUxRYhx3FABLHQmA'

export function passwordHashForVerification(storedHash: string | null | undefined): string {
  return storedHash ?? DUMMY_PASSWORD_HASH
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10 || password.length > 1024) {
    throw Object.assign(new Error('Password must be 10-1024 characters'), {code: 'VALIDATION_FAILED'})
  }
  return hash(password, PASSWORD_OPTIONS)
}
export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  return verify(encodedHash, password)
}
