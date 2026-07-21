import type {GreenfieldAccountStatus} from '@modula/greenfield-contracts'

import type {AccountId} from '@/api/contracts/identifiers'

export type ModulaAccount = {
  id: AccountId
  email: string
  displayName: string
  createdAt: string
  /** Permanent Greenfield account ID (same value as id for Greenfield-backed sessions). */
  accountId: string
  primaryHandle: string
  status: GreenfieldAccountStatus
  updatedAt: string
}
