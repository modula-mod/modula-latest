import {describe, expect, it} from 'vitest'
import {createCheckpointSigner} from '../src/checkpoints/signer.js'

describe('Greenfield checkpoint signing', () => {
  it('signs and verifies with Ed25519', () => {
    const signer = createCheckpointSigner()
    const payload = '{"revision":1,"rootHash":"abc"}'
    const signature = signer.sign(payload)
    expect(signer.verify(payload, signature)).toBe(true)
    expect(signer.verify(payload + 'x', signature)).toBe(false)
  })
})
