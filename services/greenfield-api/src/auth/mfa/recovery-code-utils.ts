import {createHash, randomBytes} from 'node:crypto'

export function hashRecoveryCode(code: string, pepper?: string): string {
  return createHash('sha256')
    .update(`${pepper ?? ''}:recovery-code:${normalizeRecoveryCode(code)}`)
    .digest('hex')
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function generateHumanRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const raw = Array.from(randomBytes(20), byte => alphabet[byte % alphabet.length]).join('')
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`
}
