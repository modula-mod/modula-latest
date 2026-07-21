import {Algorithm, hash, verify} from '@node-rs/argon2'

/** Argon2id through the maintained @node-rs/argon2 implementation — no custom password hashing. */
export const PASSWORD_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
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
