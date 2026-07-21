export type GreenfieldModuleQuarantineScope = 'release'
export type GreenfieldModuleRevocationScope = 'release' | 'module' | 'publisher' | 'signingKey'

export type GreenfieldModuleQuarantine = {
  quarantineId: string
  releaseId: string
  reason: string
  policyAction: 'warn' | 'disableExecutableContributions' | 'block'
  createdAt: string
  liftedAt: string | null
}

export type GreenfieldModuleRevocation = {
  revocationId: string
  scope: GreenfieldModuleRevocationScope
  targetId: string
  reason: string
  createdAt: string
}
