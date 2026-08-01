export type GreenfieldConnectorSyncMode = 'none' | 'manual' | 'scheduled' | 'webhook-driven'

export type GreenfieldConnectorSyncSupport = {
  supported: boolean
  modes: GreenfieldConnectorSyncMode[]
  resourceKinds: string[]
}

export type GreenfieldConnectorSyncState = {
  syncStateId: string
  connectionId: string
  resourceKind: string
  cursor?: string
  lastStartedAt?: string
  lastCompletedAt?: string
  status: 'idle' | 'queued' | 'syncing' | 'succeeded' | 'failed'
  failureCode?: string
}

export type GreenfieldConnectorSyncResult = {
  status: 'succeeded' | 'partially-succeeded' | 'failed'
  resourcesRead: number
  resourcesChanged: number
  nextCursor?: string
  failureCode?: string
}
