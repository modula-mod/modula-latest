import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'

export function safeModuleId(value: unknown): string {
  if (typeof value !== 'string') return ''
  const canonical = resolveCanonicalModuleId(value)
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(canonical) ? canonical : ''
}

export function safeModulePath(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && /^[a-z0-9._-]+$/.test(item))
  if (typeof value === 'string' && value.length > 0 && /^[a-z0-9._-]+$/.test(value)) return [value]
  return []
}
