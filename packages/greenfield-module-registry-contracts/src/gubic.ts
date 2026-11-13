export type GubicGameOrigin =
  | 'modula-developed'
  | 'external-open-source'
  | 'independent-publisher'
  | 'commercial-publisher'

/**
 * The single GUBIC engine definition. Signed web-game ingestion
 * (`gameRuntime.engine`), the developer submission manifest
 * (`gubic.game.json` `runtime.engine`) and the catalogue
 * (`runtime_category`) all derive their accepted values from here.
 *
 * Every engine is packaged web content: plain HTML5 canvas/DOM, or an engine
 * bundled as JavaScript. WebAssembly and native code stay forbidden by the
 * archive validators, so no engine here can ship CanvasKit, Skia or a native
 * binary. A host-provided runtime needs its own reviewed provider contract.
 */
export const GUBIC_ENGINES = ['html5', 'phaser', 'playcanvas'] as const
export type GubicEngine = typeof GUBIC_ENGINES[number]

/** Engines that are planned but never accepted yet, so they get a clearer error. */
export const GUBIC_LATER_ENGINES = ['mmorpg-client', 'retro-emulation'] as const

export type GubicGraphics = 'none' | 'webgl2'

export const GUBIC_ENGINE_DEFINITIONS = {
  html5: {catalogueRuntimeCategory: 'html5-javascript', graphics: ['none', 'webgl2']},
  phaser: {catalogueRuntimeCategory: 'phaser', graphics: ['none', 'webgl2']},
  playcanvas: {catalogueRuntimeCategory: 'playcanvas', graphics: ['webgl2']},
} as const satisfies Record<GubicEngine, {catalogueRuntimeCategory: string; graphics: readonly GubicGraphics[]}>

/** Catalogue runtime categories that are not a packaged engine (no signed web-game ingestion). */
export const GUBIC_NON_ENGINE_RUNTIME_CATEGORIES = ['browser-runtime', 'streamed'] as const

export type GubicRuntimeCategory =
  | (typeof GUBIC_ENGINE_DEFINITIONS)[GubicEngine]['catalogueRuntimeCategory']
  | typeof GUBIC_NON_ENGINE_RUNTIME_CATEGORIES[number]

/** Every catalogue runtime category, in the order of migration 078's CHECK constraint. */
export const GUBIC_RUNTIME_CATEGORIES: readonly GubicRuntimeCategory[] = [
  ...GUBIC_ENGINES.map(engine => GUBIC_ENGINE_DEFINITIONS[engine].catalogueRuntimeCategory),
  ...GUBIC_NON_ENGINE_RUNTIME_CATEGORIES,
]

export function isGubicEngine(value: unknown): value is GubicEngine {
  return typeof value === 'string' && (GUBIC_ENGINES as readonly string[]).includes(value)
}

export function isGubicLaterEngine(value: unknown): boolean {
  return typeof value === 'string' && (GUBIC_LATER_ENGINES as readonly string[]).includes(value)
}

export function isGubicRuntimeCategory(value: unknown): value is GubicRuntimeCategory {
  return typeof value === 'string' && (GUBIC_RUNTIME_CATEGORIES as readonly string[]).includes(value)
}

/** True when `graphics` is a mode this engine may declare (PlayCanvas needs WebGL2). */
export function gubicEngineAllowsGraphics(engine: GubicEngine, graphics: unknown): graphics is GubicGraphics {
  return typeof graphics === 'string' && (GUBIC_ENGINE_DEFINITIONS[engine].graphics as readonly string[]).includes(graphics)
}

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
