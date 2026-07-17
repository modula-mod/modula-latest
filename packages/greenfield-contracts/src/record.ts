export type GreenfieldRecordVisibility =
  | 'public'
  | 'followers'
  | 'teams'
  | 'private'
  | 'system'

export type GreenfieldRecord<T = unknown> = {
  protocolVersion: '0.1'

  recordId: string
  repositoryId: string
  accountId: string

  collection: string
  schemaVersion: number
  visibility: GreenfieldRecordVisibility

  revision: number

  createdAt: string
  updatedAt: string
  deletedAt: string | null

  data: T
}
