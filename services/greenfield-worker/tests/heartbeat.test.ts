import {describe, expect, it} from 'vitest'
import {heartbeatDue, recordHeartbeat} from '../src/heartbeat/heartbeat.js'

describe('worker heartbeat', () => {
  it('is due once per interval', () => {
    expect(heartbeatDue(0, 15_000)).toBe(true)
    expect(heartbeatDue(10_000, 20_000)).toBe(false)
    expect(heartbeatDue(10_000, 25_000)).toBe(true)
  })

  it('never throws when the database rejects the write', async () => {
    const failing = {insertInto: () => { throw new Error('relation does not exist') }} as any
    await expect(recordHeartbeat(failing, {workerId: 'w1', releaseSha: null, startedAt: new Date()})).resolves.toBe(false)
  })
})
