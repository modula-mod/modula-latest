import {createHash} from 'node:crypto'

export type GreenfieldModuleIntegrity = {
  manifestSha256: string
  releaseSha256?: string
  signatureKeyId?: string
  signature?: string
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/i

export function isSha256(value: string): boolean {
  return SHA256_PATTERN.test(value)
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(item => stableJson(item)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(',')}}`
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function manifestChecksum(manifest: unknown): string {
  return sha256Hex(stableJson(manifest))
}
