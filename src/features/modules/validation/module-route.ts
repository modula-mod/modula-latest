export function safeModuleId(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value) ? value : ''
}

export function safeModulePath(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && /^[a-z0-9._-]+$/.test(item))
  if (typeof value === 'string' && value.length > 0 && /^[a-z0-9._-]+$/.test(value)) return [value]
  return []
}
