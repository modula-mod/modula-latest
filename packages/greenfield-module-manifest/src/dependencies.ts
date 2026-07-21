export type GreenfieldModuleDependency = {
  moduleId: string
  versionRange: string
  optional: boolean
  reason?: string
}

export type GreenfieldDependencyRelease = {
  moduleId: string
  version: string
  status: 'published' | 'verified' | 'draft' | 'pendingReview' | 'quarantined' | 'revoked' | 'superseded'
  compatible: boolean
}

export type GreenfieldResolvedDependency = {
  moduleId: string
  requestedRange: string
  resolvedVersion: string | null
  installed: boolean
  optional: boolean
}

export type GreenfieldDependencyResolutionPlan = {
  dependencies: GreenfieldResolvedDependency[]
  installable: boolean
  errors: string[]
}
