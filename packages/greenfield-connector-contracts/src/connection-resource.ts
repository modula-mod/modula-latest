export type GreenfieldConnectorResourceKind =
  | 'profile'
  | 'message'
  | 'event'
  | 'contact'
  | 'file'
  | 'document'
  | 'channel'
  | 'repository'
  | 'issue'
  | 'webhook-event'
  | 'rest-resource'

export type GreenfieldConnectorResource = {
  resourceId: string
  kind: GreenfieldConnectorResourceKind
  displayName: string
  externalId?: string
  parentResourceId?: string
  metadata?: Record<string, string | number | boolean | null>
  updatedAt?: string
}

export type GreenfieldConnectorResourcePage = {
  items: GreenfieldConnectorResource[]
  nextCursor?: string
}
