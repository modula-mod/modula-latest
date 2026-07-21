/**
 * Signed repository checkpoints use reviewed standard signatures (Ed25519).
 * They provide export/audit integrity — not a blockchain.
 */
export type GreenfieldCheckpoint = {
  checkpointId: string
  repositoryId: string
  accountId: string

  firstRevision: number
  lastRevision: number
  rootHash: string

  keyId: string
  signatureAlgorithm: 'Ed25519'
  signature: string

  createdAt: string
}
