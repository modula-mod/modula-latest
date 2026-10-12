/**
 * Deterministic JSON for hashing: sorted object keys, no insignificant whitespace.
 * Arrays preserve order. Does not invent a custom binary format.
 */

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

/**
 * Strict MP02 mutation canonicalisation. This is intentionally separate from
 * the historical signing canonicaliser above so existing signed artifacts do
 * not silently change representation.
 */
export function canonicalMutationJsonStringify(value: unknown): string {
  return JSON.stringify(normalizeMutationValue(value, new WeakSet<object>()))
}

function normalizeMutationValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.normalize('NFC')
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical mutation numbers must be finite')
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new TypeError('Canonical mutation integers must be safe integers')
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value === 'undefined') throw new TypeError('Canonical mutation values cannot contain undefined')
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError(`Canonical mutation values cannot contain ${typeof value}`)
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError('Canonical mutation timestamps must be valid')
    return value.toISOString()
  }
  if (typeof value !== 'object') throw new TypeError('Unsupported canonical mutation value')
  if (ancestors.has(value)) throw new TypeError('Canonical mutation values cannot be cyclic')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const normalized: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new TypeError('Canonical mutation arrays cannot contain holes')
        normalized.push(normalizeMutationValue(value[index], ancestors))
      }
      return normalized
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Canonical mutation objects must be plain objects')
    const normalizedEntries = Object.keys(value as Record<string, unknown>).map(key => ({
      key: key.normalize('NFC'),
      value: normalizeMutationValue((value as Record<string, unknown>)[key], ancestors),
    }))
    const uniqueKeys = new Set(normalizedEntries.map(entry => entry.key))
    if (uniqueKeys.size !== normalizedEntries.length) throw new TypeError('Canonical mutation object keys collide after Unicode normalization')
    normalizedEntries.sort((left, right) => compareCodePoints(left.key, right.key))
    return Object.fromEntries(normalizedEntries.map(entry => [entry.key, entry.value]))
  } finally {
    ancestors.delete(value)
  }
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, character => character.codePointAt(0)!)
  const rightPoints = Array.from(right, character => character.codePointAt(0)!)
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index]! - rightPoints[index]!
  }
  return leftPoints.length - rightPoints.length
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
