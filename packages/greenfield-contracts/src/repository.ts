export type GreenfieldRepositoryStatus = 'active' | 'archived' | 'deleted'

export type GreenfieldRepository = {
  repositoryId: string
  accountId: string
  status: GreenfieldRepositoryStatus
  currentRevision: number
  currentEventHash: string | null
  createdAt: string
  updatedAt: string
}
