import type {GreenfieldRecordEvent, GreenfieldRecordOperation} from '@modula/greenfield-contracts'

import {hashCanonicalJson} from './hashing.js'

export type GreenfieldEventEnvelope = GreenfieldRecordEvent

/** Fields included in the event hash — excludes sensitive record bodies. */
export type GreenfieldEventHashPayload = {
  eventId: string
  repositoryId: string
  accountId: string
  recordId: string
  collection: string
  operation: GreenfieldRecordOperation
  revision: number
  occurredAt: string
  previousEventHash: string | null
}

export async function computeEventHash(payload: GreenfieldEventHashPayload): Promise<string> {
  return hashCanonicalJson(payload)
}

export async function createEventEnvelope(
  input: Omit<GreenfieldRecordEvent, 'eventHash'> & {eventHash?: string},
): Promise<GreenfieldEventEnvelope> {
  const hashPayload: GreenfieldEventHashPayload = {
    eventId: input.eventId,
    repositoryId: input.repositoryId,
    accountId: input.accountId,
    recordId: input.recordId,
    collection: input.collection,
    operation: input.operation,
    revision: input.revision,
    occurredAt: input.occurredAt,
    previousEventHash: input.previousEventHash,
  }
  const eventHash = input.eventHash ?? (await computeEventHash(hashPayload))
  return {...input, eventHash}
}
