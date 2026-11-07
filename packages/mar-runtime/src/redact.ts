const SECRET_KEY = /secret|password|credential|token|api[-_]?key|authorization|cookie/i
const SECRET_VALUE = /^(bearer\s+\S+|sk-|ghp_|akia)/i

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]'
  if (Array.isArray(value)) return value.map(item => redact(item, depth + 1))
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && SECRET_VALUE.test(value) ? '[redacted]' : value
  }
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    output[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(item, depth + 1)
  }
  return output
}

export function redactRecord(value: Record<string, unknown>): Record<string, unknown> {
  const redacted = redact(value)
  return redacted && typeof redacted === 'object' && !Array.isArray(redacted) ? redacted as Record<string, unknown> : {}
}
