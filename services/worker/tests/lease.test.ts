import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'

describe('lease exclusivity', () => {
  it('uses SKIP LOCKED claim SQL', () => {
    const src = readFileSync(new URL('../src/jobs/claim.ts', import.meta.url), 'utf8')
    expect(src).toContain('FOR UPDATE SKIP LOCKED')
    expect(src).toContain("status = 'leased'")
  })
})
