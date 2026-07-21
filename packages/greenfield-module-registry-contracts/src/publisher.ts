import {RESERVED_MODULE_NAMESPACES} from '@modula/greenfield-module-manifest'

export type GreenfieldPublisherStatus = 'pending' | 'verified' | 'suspended' | 'revoked'
export type GreenfieldPublisherTrustLevel = 'firstParty' | 'verifiedPublisher' | 'reviewedCommunity' | 'untrustedManifest'

export type GreenfieldPublisher = {
  publisherId: string
  displayName: string
  status: GreenfieldPublisherStatus
  trustLevel: GreenfieldPublisherTrustLevel
  website?: string
  createdAt: string
  verifiedAt: string | null
  suspendedAt: string | null
  revokedAt: string | null
}

export type GreenfieldPublisherNamespace = {
  namespace: string
  publisherId: string
  verificationMethod: string
  verificationEvidence: Record<string, unknown>
  verifiedAt: string | null
  revokedAt: string | null
}

export function isReservedPublisherNamespace(namespace: string): boolean {
  return RESERVED_MODULE_NAMESPACES.some(reserved => namespace === reserved || namespace.startsWith(`${reserved}.`))
}
