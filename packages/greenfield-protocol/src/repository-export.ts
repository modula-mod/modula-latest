import type {GreenfieldCheckpoint, GreenfieldRecord, GreenfieldRecordEvent} from '@modula/greenfield-contracts'

import {GREENFIELD_PROTOCOL_VERSION} from './version.js'

export type GreenfieldRepositoryExport = {
  protocolVersion: typeof GREENFIELD_PROTOCOL_VERSION
  repositoryId: string
  accountId: string
  exportedAt: string
  records: GreenfieldRecord[]
  events: GreenfieldRecordEvent[]
  checkpoints: GreenfieldCheckpoint[]
}

export function createRepositoryExport(
  input: Omit<GreenfieldRepositoryExport, 'protocolVersion'>,
): GreenfieldRepositoryExport {
  return {
    protocolVersion: GREENFIELD_PROTOCOL_VERSION,
    ...input,
  }
}
