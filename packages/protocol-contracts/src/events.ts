export type ProtocolEventType =
  | 'publication.created'
  | 'publication.deleted'
  | 'follow.created'
  | 'follow.deleted'

export type ProtocolEvent = {
  id: string
  type: ProtocolEventType
  aggregateType: string
  aggregateId: string
  occurredAt: string
  payload: Record<string, unknown>
}
