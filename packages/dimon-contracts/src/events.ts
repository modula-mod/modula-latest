/**
 * Reserved DIMON event type names for a future ledger service.
 * Phase 6R does not emit or persist these events.
 */
import type {DimonAssetId, DimonCollectionId} from './identifiers.js'

export type DimonEventType =
  | 'dimon.account.linked'
  | 'dimon.transaction.requested'
  | 'dimon.transaction.approved'
  | 'dimon.ledger.audited'
  | 'dimon.asset.mint.requested'
  | 'dimon.asset.transfer.requested'
  | 'dimon.asset.entitlement.reserved'
  | 'dimon.asset.metadata.reserved'

export type DimonEventEnvelope = {
  eventType: DimonEventType
  dimonAccountId: string
  occurredAt: string
}

export type DimonAssetEventEnvelope = DimonEventEnvelope & {
  assetId: DimonAssetId
  collectionId?: DimonCollectionId
  status: 'reserved'
}
