import {describe, expect, it} from 'vitest'
import {compareSemver, satisfiesSemverRange} from '../src/index.js'

describe('semantic version precedence', () => {
  it('orders prereleases according to SemVer rather than lexicographically', () => {
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ]
    for (let index = 1; index < ordered.length; index += 1) {
      expect(compareSemver(ordered[index - 1]!, ordered[index]!)).toBeLessThan(0)
    }
    expect(compareSemver('2.0.0-rc.1', '1.8.0')).toBeGreaterThan(0)
    expect(compareSemver('2.0.0+build.2', '2.0.0+build.1')).toBe(0)
  })

  it('uses correct caret bounds for zero-major releases', () => {
    expect(satisfiesSemverRange('1.9.0', '^1.8.0')).toBe(true)
    expect(satisfiesSemverRange('2.0.0', '^1.8.0')).toBe(false)
    expect(satisfiesSemverRange('0.2.9', '^0.2.3')).toBe(true)
    expect(satisfiesSemverRange('0.3.0', '^0.2.3')).toBe(false)
    expect(satisfiesSemverRange('0.0.4', '^0.0.3')).toBe(false)
  })
})
