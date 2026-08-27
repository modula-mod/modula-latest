export type GreenfieldRecordOperation = 'create' | 'update' | 'delete'

export type EventVisibility = 'public' | 'account' | 'actor' | 'internal' | 'restricted'
export type EventDataClassification = 'public' | 'internal' | 'private' | 'sensitive' | 'restricted'
export type EventProducerKind = 'platform' | 'product' | 'service' | 'connector' | 'user'

export interface GreenfieldDomainEvent<TPayload = unknown> {
  eventId: string
  eventType: string
  eventVersion: string
  aggregateType: string
  aggregateId: string
  aggregateVersion?: number
  accountId?: string
  actorId?: string
  producerKind: EventProducerKind
  producerId: string
  productId?: string
  installationId?: string
  releaseId?: string
  traceId: string
  requestId: string
  correlationId: string
  causationId?: string
  occurredAt: string
  recordedAt: string
  visibility: EventVisibility
  classification: EventDataClassification
  payload: TPayload
  metadata: Record<string, unknown>
}

export type GreenfieldRecordEvent = {
  eventId: string
  repositoryId: string
  accountId: string
  recordId: string
  collection: string

  operation: GreenfieldRecordOperation
  revision: number
  occurredAt: string

  previousEventHash: string | null
  eventHash: string
}
