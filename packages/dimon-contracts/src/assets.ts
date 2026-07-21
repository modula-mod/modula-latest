import type {DimonAccountId, DimonAssetId, DimonCollectionId} from './identifiers.js'

export type DimonAssetKind =
  | 'module-entitlement'
  | 'creator-edition'
  | 'profile-collectible'
  | 'team-credential'

export type DimonAssetStatus = 'reserved' | 'inactive'

/**
 * Reserved NFT / digital ownership shape only.
 * DIMON is not active yet, so this is not a mint record, balance, or chain row.
 */
export type DimonAssetReservation = {
  assetId: DimonAssetId
  collectionId: DimonCollectionId
  ownerAccountId?: DimonAccountId
  kind: DimonAssetKind
  name: string
  status: DimonAssetStatus
  note: 'DIMON is not active yet'
}
