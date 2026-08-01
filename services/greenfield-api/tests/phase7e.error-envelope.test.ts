import {describe, expect, it} from 'vitest'
import {failureEnvelope, statusForError} from '../src/transport/envelope.js'

describe('Phase 7E standard error envelope', () => {
  it('includes request correlation and sanitized details on the error body', () => {
    const envelope = failureEnvelope('RATE_LIMITED', 'Too many requests', 'req-phase7e', {
      retryable: true,
      details: {rateLimitClass: 'standard-write'},
    })

    expect(envelope.ok).toBe(false)
    if (envelope.ok) throw new Error('expected failure envelope')
    expect(envelope.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      requestId: 'req-phase7e',
      retryable: true,
      fieldErrors: undefined,
      details: {rateLimitClass: 'standard-write'},
    })
    expect(envelope.meta.requestId).toBe('req-phase7e')
    expect(statusForError('RATE_LIMITED')).toBe(429)
  })
})
