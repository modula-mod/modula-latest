import type {AccountId} from '@/api/contracts/identifiers'

export type ModulaAccount = {
  id: AccountId
  email: string
  displayName: string
  createdAt: string
}
