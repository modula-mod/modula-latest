export type DeveloperProgrammeState = 'NOT_ENROLLED' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'TERMINATED'
export type DeveloperProductKind = 'module' | 'addon' | 'plugin' | 'function' | 'tool' | 'widget' | 'connector' | 'backend-service' | 'backend-engine' | 'game-module' | 'service' | 'engine' | 'game' | 'integration' | 'theme'
export type DeveloperProductVisibility = 'PRIVATE' | 'INTERNAL' | 'UNLISTED' | 'BETA' | 'PUBLIC'
export type DeveloperReleaseChannel = 'DEVELOPMENT' | 'INTERNAL' | 'ALPHA' | 'BETA' | 'RC' | 'STABLE'
export type DeveloperReviewState = 'DRAFT' | 'SUBMITTED' | 'AUTOMATED_REVIEW' | 'MANUAL_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'SUSPENDED' | 'REMOVED'

export type DeveloperProfileDto = {
  accountId: string
  displayName: string
  biography: string
  website: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
  createdAt: string
  updatedAt: string
}

export type DeveloperOrganisationDto = {
  organisationId: string
  slug: string
  displayName: string
  role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'RELEASE_MANAGER' | 'VIEWER'
  state: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED'
}

export type DeveloperProductDto = {
  productId: string
  publisherId: string
  ownerAccountId: string | null
  ownerOrganisationId: string | null
  kind: DeveloperProductKind
  displayName: string
  description: string
  visibility: DeveloperProductVisibility
  state: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

export type DeveloperBoardDto = {
  profile: DeveloperProfileDto | null
  organisations: DeveloperOrganisationDto[]
  programme: {state: DeveloperProgrammeState; stateReason: string | null} | null
  products: DeveloperProductDto[]
  counts: {products: number; builds: number; releases: number; testers: number; pendingReviews: number}
}
