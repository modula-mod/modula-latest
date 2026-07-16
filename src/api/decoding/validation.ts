import {ModulaApiError} from '@/api/contracts/ApiError'

export function failInvalidResponse(message: string): never {
  throw new ModulaApiError({
    message,
    code: 'INVALID_RESPONSE',
    status: 0,
    retryable: false,
  })
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failInvalidResponse(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

export function asString(value: unknown, label: string): string {
  if (typeof value !== 'string') failInvalidResponse(`${label} must be a string.`)
  return value
}

export function asOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return asString(value, label)
}

export function asNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    failInvalidResponse(`${label} must be a finite number.`)
  }
  return value
}

export function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') failInvalidResponse(`${label} must be a boolean.`)
  return value
}

export function asArray<T>(
  value: unknown,
  label: string,
  decode: (item: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(value)) failInvalidResponse(`${label} must be an array.`)
  return value.map(decode)
}

export function asIsoDate(value: unknown, label: string): string {
  const next = asString(value, label)
  const timestamp = Date.parse(next)
  if (!Number.isFinite(timestamp)) failInvalidResponse(`${label} must be a valid date.`)
  return next
}

export function optional<T>(
  value: unknown,
  decode: (item: unknown) => T,
): T | undefined {
  if (value === undefined || value === null) return undefined
  return decode(value)
}
