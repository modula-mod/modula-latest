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
  /^(\*|latest|(?:[\^~])?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?|(?:(?:>=|<=|>|<|=)?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?)(?:\s+(?:>=|<=|>|<|=)?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?)*)$/

export function isSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value)
}

export function isSemverRange(value: string): boolean {
  return SEMVER_RANGE_PATTERN.test(value)
}

export type ParsedSemver = {
  core: [number, number, number]
  prerelease: Array<string | number>
}

export function parseSemver(value: string): ParsedSemver | null {
  const match = SEMVER_PATTERN.exec(value)
  if (!match) return null
  const withoutBuild = value.split('+', 1)[0]!
  const prereleaseText = withoutBuild.includes('-') ? withoutBuild.slice(withoutBuild.indexOf('-') + 1) : ''
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: prereleaseText
      ? prereleaseText.split('.').map(identifier => /^\d+$/.test(identifier) ? Number(identifier) : identifier)
      : [],
  }
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (!left || !right) throw new Error('Invalid semantic version')
  for (let index = 0; index < 3; index += 1) {
    const delta = left.core[index]! - right.core[index]!
    if (delta !== 0) return delta
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0
  if (!left.prerelease.length) return 1
  if (!right.prerelease.length) return -1
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const a = left.prerelease[index]
    const b = right.prerelease[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1
    if (typeof a === 'number') return -1
    if (typeof b === 'number') return 1
    return a < b ? -1 : 1
  }
  return 0
}

export function satisfiesSemverRange(version: string, range: string): boolean {
  if (!isSemver(version) || !isSemverRange(range)) return false
  if (range === '*' || range === 'latest') return true
  const trimmed = range.trim()
  if (trimmed.startsWith('^')) {
    const base = trimmed.slice(1)
    const b = parseSemver(base)!
    const upper = b.core[0] > 0
      ? `${b.core[0] + 1}.0.0`
      : b.core[1] > 0
        ? `0.${b.core[1] + 1}.0`
        : `0.0.${b.core[2] + 1}`
    return compareSemver(version, base) >= 0 && compareSemver(version, upper) < 0
  }
  if (trimmed.startsWith('~')) {
    const base = trimmed.slice(1)
    const v = parseSemver(version)!
    const b = parseSemver(base)!
    return v.core[0] === b.core[0] && v.core[1] === b.core[1] && compareSemver(version, base) >= 0
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
