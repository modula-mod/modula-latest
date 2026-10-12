import {createHash} from 'node:crypto'
import {canonicalMutationJsonStringify} from '@modula/greenfield-protocol'
import {describe, expect, it} from 'vitest'

const digest = (value: unknown) => createHash('sha256').update(canonicalMutationJsonStringify(value), 'utf8').digest('hex')

describe('MP02B canonical mutation payloads', () => {
  it('normalizes key order, Unicode, timestamps, and negative zero deterministically', () => {
    const left = {
      operation: 'update',
      record: {recordId: 'record-1', recordType: 'note', moduleId: 'audit.module.alpha'},
      payload: {title: 'Cafe\u0301', order: -0, at: new Date('2026-10-12T13:14:15.123Z')},
      expectedRevision: 2,
    }
    const right = {
      expectedRevision: 2,
      payload: {at: new Date('2026-10-12T15:14:15.123+02:00'), order: 0, title: 'Caf\u00e9'},
      record: {moduleId: 'audit.module.alpha', recordType: 'note', recordId: 'record-1'},
      operation: 'update',
    }
    expect(canonicalMutationJsonStringify(left)).toBe(canonicalMutationJsonStringify(right))
    expect(digest(left)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('preserves array order and rejects values JSON would silently coerce', () => {
    expect(digest({values: [1, 2]})).not.toBe(digest({values: [2, 1]}))
    const sparse = Array(1)
    for (const invalid of [undefined, {value: undefined}, [undefined], sparse, NaN, Infinity, 9_007_199_254_740_992]) {
      expect(() => canonicalMutationJsonStringify(invalid)).toThrow()
    }
  })

  it('rejects object keys that collide after NFC normalization', () => {
    expect(() => canonicalMutationJsonStringify({'e\u0301': 1, '\u00e9': 2})).toThrow(/collide/)
  })
})
