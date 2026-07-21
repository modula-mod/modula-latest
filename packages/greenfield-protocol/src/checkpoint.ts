import type {GreenfieldCheckpoint} from '@modula/greenfield-contracts'

export type {GreenfieldCheckpoint}

export type GreenfieldCheckpointCreateInput = Omit<GreenfieldCheckpoint, 'signatureAlgorithm'> & {
  signatureAlgorithm?: 'Ed25519'
}

export function createCheckpointEnvelope(input: GreenfieldCheckpointCreateInput): GreenfieldCheckpoint {
  return {
    ...input,
    signatureAlgorithm: 'Ed25519',
  }
}
