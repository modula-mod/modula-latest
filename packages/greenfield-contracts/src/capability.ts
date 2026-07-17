/** Capability identifiers are stable namespaced strings, e.g. `greenfield:records:write`. */
export type GreenfieldCapability = string

export type GreenfieldCapabilityGrant = {
  capability: GreenfieldCapability
  accountId: string
  extensionId?: string
  grantedAt: string
  revokedAt: string | null
}
