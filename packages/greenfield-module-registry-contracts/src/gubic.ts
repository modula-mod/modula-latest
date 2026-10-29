export type GubicGameOrigin =
  | 'modula-developed'
  | 'external-open-source'
  | 'independent-publisher'
  | 'commercial-publisher'

export type GubicRuntimeCategory =
  | 'html5-javascript'
  | 'phaser'
  | 'playcanvas'
  | 'browser-runtime'
  | 'streamed'

export type GubicPublicationStatus = 'draft' | 'in-review' | 'published' | 'rejected' | 'retired'
export type GubicAvailability = 'available' | 'coming-soon' | 'unavailable' | 'region-restricted'

export type GubicCatalogueEntryInput = {
  publisherId: string
  origin: GubicGameOrigin
  genre: string
  categories: string[]
  runtimeCategory: GubicRuntimeCategory
  ageClassification: Record<string, unknown>
  availability?: GubicAvailability
}

export type GubicGameSummary = {
  gameId: string
  title: string
  description: string
  publisher: {publisherId: string; displayName: string; verified: boolean}
  origin: GubicGameOrigin
  genre: string
  categories: string[]
  runtime: {
    category: GubicRuntimeCategory
    engine: string | null
    engineVersion: string | null
    runtimePackageId: string | null
    streamed: boolean
  }
  release: {releaseId: string; version: string; channel: string; publishedAt: string | null}
  compatibility: Record<string, unknown>
  sizes: {downloadBytes: number | null; installedSizeEstimateBytes: number | null; nativeCacheBytes: null}
  ageClassification: Record<string, unknown>
  availability: GubicAvailability
  publicationStatus: 'published'
  featured: boolean
  featuredRank: number | null
  presentation: unknown
  trust: unknown
}

export type GubicEligibility = {
  gameId: string
  eligible: boolean
  reasonCode: string
  reason: string
  entitlement: {required: boolean; owned: boolean; entitlementId: string | null; state: string | null}
  packagePlan: unknown | null
}
