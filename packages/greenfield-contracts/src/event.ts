export type GreenfieldRecordOperation = 'create' | 'update' | 'delete'

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
