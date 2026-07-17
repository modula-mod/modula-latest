import type {GreenfieldRecord, GreenfieldRecordVisibility} from '@modula/greenfield-contracts'

import {GREENFIELD_PROTOCOL_VERSION} from './version.js'

export type GreenfieldRecordEnvelope<T = unknown> = GreenfieldRecord<T>

export function createRecordEnvelope<T>(input: {
  recordId: string
  repositoryId: string
  accountId: string
  collection: string
  schemaVersion: number
  visibility: GreenfieldRecordVisibility
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  data: T
}): GreenfieldRecordEnvelope<T> {
  return {
    protocolVersion: GREENFIELD_PROTOCOL_VERSION,
    recordId: input.recordId,
    repositoryId: input.repositoryId,
    accountId: input.accountId,
    collection: input.collection,
    schemaVersion: input.schemaVersion,
    visibility: input.visibility,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    deletedAt: input.deletedAt ?? null,
    data: input.data,
  }
}
