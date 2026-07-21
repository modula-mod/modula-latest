/**
 * Deterministic JSON for hashing: sorted object keys, no insignificant whitespace.
 * Arrays preserve order. Does not invent a custom binary format.
 */

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  const record = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortValue(record[key])
  }
  return sorted
}
