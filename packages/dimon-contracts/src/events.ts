/**
 * Reserved DIMON event type names for a future ledger service.
 * Phase 6R does not emit or persist these events.
 */
export type DimonEventType =
  | 'dimon.account.linked'
  | 'dimon.transaction.requested'
  | 'dimon.transaction.approved'
  | 'dimon.ledger.audited'

export type DimonEventEnvelope = {
  eventType: DimonEventType
  dimonAccountId: string
  occurredAt: string
}
