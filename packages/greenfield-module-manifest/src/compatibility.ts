export const GREENFIELD_PROTOCOL_VERSION = 'greenfield.v1' as const

export type GreenfieldModulePlatform = 'ios' | 'android' | 'web' | 'desktop' | 'server'

export type GreenfieldModuleCompatibility = {
  minimumGreenfieldVersion: string
  maximumGreenfieldVersion?: string
  minimumModulaHostVersion: string
  maximumModulaHostVersion?: string
  protocolVersions: string[]
  platforms: GreenfieldModulePlatform[]
}

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const SEMVER_RANGE_PATTERN =
  /^(\*|latest|(?:[\^~])?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\s+(?:>=|<=|>|<|=)?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?)*|(?:>=|<=|>|<|=)(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?)$/

export function isSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value)
}

export function isSemverRange(value: string): boolean {
  return SEMVER_RANGE_PATTERN.test(value)
}

export function parseSemver(value: string): [number, number, number] | null {
  const match = SEMVER_PATTERN.exec(value)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (!left || !right) throw new Error('Invalid semantic version')
  for (let index = 0; index < 3; index += 1) {
    const delta = left[index]! - right[index]!
    if (delta !== 0) return delta
  }
  return 0
}

export function satisfiesSemverRange(version: string, range: string): boolean {
  if (!isSemver(version) || !isSemverRange(range)) return false
  if (range === '*' || range === 'latest') return true
  const trimmed = range.trim()
  if (trimmed.startsWith('^')) {
    const base = trimmed.slice(1)
    const v = parseSemver(version)!
    const b = parseSemver(base)!
    return v[0] === b[0] && compareSemver(version, base) >= 0
  }
  if (trimmed.startsWith('~')) {
    const base = trimmed.slice(1)
    const v = parseSemver(version)!
    const b = parseSemver(base)!
    return v[0] === b[0] && v[1] === b[1] && compareSemver(version, base) >= 0
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return parts.every(part => satisfiesComparator(version, part))
  }
  return satisfiesComparator(version, trimmed)
}

function satisfiesComparator(version: string, comparator: string): boolean {
  const match = /^(>=|<=|>|<|=)?(.+)$/.exec(comparator)
  if (!match) return false
  const operator = match[1] ?? '='
  const target = match[2]!
  if (!isSemver(target)) return false
  const compared = compareSemver(version, target)
  if (operator === '>=') return compared >= 0
  if (operator === '<=') return compared <= 0
  if (operator === '>') return compared > 0
  if (operator === '<') return compared < 0
  return compared === 0
}
