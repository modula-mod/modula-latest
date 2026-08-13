export const MDHS_SCHEMA_VERSION = '0.1.0' as const
export const MDHS_SCHEMA_URI = 'modula://schemas/mdhs/0.1.0' as const

export type AvatarId = string
export type AvatarRevisionId = string
export type AvatarObservationId = string
export type AvatarAssetId = string
export type AvatarPersonaId = string
export type AvatarRepresentationId = string
export type AvatarPermissionId = string
export type AvatarConsentId = string
export type AvatarStateHash = `mdhs-0.1:fnv1a64:${string}`

export type AvatarStateStatus =
  | 'active'
  | 'suspended'
  | 'deletion_pending'
  | 'deleted'

export type AvatarAttributeStatus =
  | 'known'
  | 'confirmed'
  | 'estimated'
  | 'uncertain'
  | 'unknown'

export type AvatarAttributeClassification =
  | 'STABLE_IDENTITY'
  | 'TEMPORAL_PHYSICAL'
  | 'CONTEXTUAL'

export type AvatarProvenanceAuthority =
  | 'OWNER_LOCKED'
  | 'VERIFIED_MEASUREMENT'
  | 'OWNER_CONFIRMED'
  | 'MULTI_OBSERVATION_CONSENSUS'
  | 'HIGH_CONFIDENCE_OBSERVATION'
  | 'SINGLE_OBSERVATION'
  | 'AI_ESTIMATION'
  | 'UNKNOWN'

export const AVATAR_PROVENANCE_AUTHORITY_ORDER: readonly AvatarProvenanceAuthority[] = [
  'OWNER_LOCKED',
  'VERIFIED_MEASUREMENT',
  'OWNER_CONFIRMED',
  'MULTI_OBSERVATION_CONSENSUS',
  'HIGH_CONFIDENCE_OBSERVATION',
  'SINGLE_OBSERVATION',
  'AI_ESTIMATION',
  'UNKNOWN',
] as const

export interface AvatarProvenance {
  authority: AvatarProvenanceAuthority
  observationId?: AvatarObservationId
  sourceAssetId?: AvatarAssetId
  processor?: string
  processorVersion?: string
  ownerAccountId?: string
  acceptedAt?: string
}

export interface AvatarAttribute<T = unknown> {
  path: string
  value?: T
  status: AvatarAttributeStatus
  classification: AvatarAttributeClassification
  confidence?: number | null
  provenance?: AvatarProvenance
  ownerConfirmed: boolean
  ownerLocked: boolean
  firstObservedAt?: string
  lastObservedAt?: string
}

export interface AvatarAttributeDefinition {
  path: string
  classification: AvatarAttributeClassification
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
  description: string
}

export const MDHS_ATTRIBUTE_REGISTRY: readonly AvatarAttributeDefinition[] = [
  {
    path: 'physical.face.geometry.structure',
    classification: 'STABLE_IDENTITY',
    valueType: 'object',
    description: 'Stable structural face geometry descriptor, never a cross-user face-search key.',
  },
  {
    path: 'physical.face.eyes.left.iris.colour',
    classification: 'STABLE_IDENTITY',
    valueType: 'string',
    description: 'Left apparent iris colour.',
  },
  {
    path: 'physical.face.eyes.right.iris.colour',
    classification: 'STABLE_IDENTITY',
    valueType: 'string',
    description: 'Right apparent iris colour.',
  },
  {
    path: 'physical.face.eyebrows.left.shape',
    classification: 'TEMPORAL_PHYSICAL',
    valueType: 'string',
    description: 'Left eyebrow visible shape.',
  },
  {
    path: 'physical.face.eyebrows.right.shape',
    classification: 'TEMPORAL_PHYSICAL',
    valueType: 'string',
    description: 'Right eyebrow visible shape.',
  },
  {
    path: 'physical.face.ears.left.shape',
    classification: 'STABLE_IDENTITY',
    valueType: 'string',
    description: 'Left ear shape descriptor.',
  },
  {
    path: 'physical.face.ears.right.shape',
    classification: 'STABLE_IDENTITY',
    valueType: 'string',
    description: 'Right ear shape descriptor.',
  },
  {
    path: 'physical.hair.colour.current',
    classification: 'TEMPORAL_PHYSICAL',
    valueType: 'string',
    description: 'Current visible hair colour.',
  },
  {
    path: 'physical.hair.length.approxMm',
    classification: 'TEMPORAL_PHYSICAL',
    valueType: 'number',
    description: 'Approximate current hair length in millimetres.',
  },
  {
    path: 'physical.facialHair.presence',
    classification: 'TEMPORAL_PHYSICAL',
    valueType: 'boolean',
    description: 'Current visible facial-hair presence.',
  },
  {
    path: 'timeline.chronologicalAge',
    classification: 'STABLE_IDENTITY',
    valueType: 'number',
    description: 'Chronological age derived from owner-controlled date context.',
  },
  {
    path: 'appearance.canonicalAppearanceAge',
    classification: 'TEMPORAL_PHYSICAL',
    valueType: 'number',
    description: 'Current canonical appearance age estimate, separate from chronological age.',
  },
  {
    path: 'representations.presentationAge',
    classification: 'CONTEXTUAL',
    valueType: 'number',
    description: 'Persona/render presentation age override; never mutates canonical physical state.',
  },
] as const

const registeredAttributePaths = new Set(MDHS_ATTRIBUTE_REGISTRY.map(item => item.path))
const extensionPathPattern = /^extensions\.[a-z0-9][a-z0-9.-]*\.[a-z0-9][a-z0-9._-]*$/i

export function isRegisteredAvatarAttributePath(path: string): boolean {
  return registeredAttributePaths.has(path) || extensionPathPattern.test(path)
}

export function assertAvatarAttributePath(path: string): string {
  if (!isRegisteredAvatarAttributePath(path)) {
    throw new Error(`Unregistered MDHS attribute path: ${path}`)
  }
  return path
}

export function isValidAvatarConfidence(confidence: number | null | undefined): boolean {
  return confidence == null || (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1)
}

export function assertAvatarConfidence(confidence: number | null | undefined): number | null | undefined {
  if (!isValidAvatarConfidence(confidence)) {
    throw new Error('Avatar confidence must be between 0 and 1 when present')
  }
  return confidence
}

export function createUnknownAvatarAttribute(path: string, classification: AvatarAttributeClassification): AvatarAttribute {
  return {
    path: assertAvatarAttributePath(path),
    status: 'unknown',
    classification,
    confidence: null,
    ownerConfirmed: false,
    ownerLocked: false,
  }
}

export type AvatarRevisionSelector =
  | {kind: 'latest'}
  | {kind: 'revision'; revisionId: AvatarRevisionId}
  | {kind: 'revision_number'; revisionNumber: number}
  | {kind: 'timestamp'; timestamp: string}

export function formatAvatarUri(avatarId: AvatarId, selector: AvatarRevisionSelector = {kind: 'latest'}): string {
  const suffix =
    selector.kind === 'latest'
      ? 'latest'
      : selector.kind === 'revision'
        ? selector.revisionId
        : selector.kind === 'revision_number'
          ? `revision_${selector.revisionNumber}`
          : selector.timestamp
  return `modula://avatar/${avatarId}@${suffix}`
}

export function parseAvatarUri(uri: string): {avatarId: AvatarId; selector: AvatarRevisionSelector} {
  const match = /^modula:\/\/avatar\/([^@]+)(?:@(.+))?$/.exec(uri)
  if (!match) {
    throw new Error(`Invalid avatar URI: ${uri}`)
  }
  const selector = match[2] ?? 'latest'
  if (selector === 'latest') {
    return {avatarId: match[1], selector: {kind: 'latest'}}
  }
  const revisionNumber = /^revision_(\d+)$/.exec(selector)
  if (revisionNumber) {
    return {avatarId: match[1], selector: {kind: 'revision_number', revisionNumber: Number(revisionNumber[1])}}
  }
  if (/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(selector)) {
    return {avatarId: match[1], selector: {kind: 'timestamp', timestamp: selector}}
  }
  return {avatarId: match[1], selector: {kind: 'revision', revisionId: selector}}
}

export type AvatarSensitivityClass =
  | 'PUBLIC_AVATAR'
  | 'PRIVATE_APPEARANCE'
  | 'SENSITIVE_MEASUREMENT'
  | 'PRECISE_GEOMETRY'
  | 'RAW_BIOMETRIC'
  | 'VOICE_IDENTITY'
  | 'MOTION_SIGNATURE'
  | 'SOURCE_MEDIA'

export interface AvatarAssetReference {
  id: AvatarAssetId
  avatarId: AvatarId
  revisionId?: AvatarRevisionId
  assetType: 'source_image' | 'display_image' | 'geometry' | 'texture' | 'voice' | 'motion' | 'expression' | 'export'
  storageKey: string
  mimeType: string
  sizeBytes: number
  sensitivityClass: AvatarSensitivityClass
  contentHash: string
  encryptionKeyVersion?: string
  createdAt: string
}

export type AvatarCapability =
  | 'avatar.read.basic'
  | 'avatar.read.appearance'
  | 'avatar.read.measurements'
  | 'avatar.render.image'
  | 'avatar.render.video'
  | 'avatar.render.3d'
  | 'avatar.render.game'
  | 'avatar.submit.observation'
  | 'avatar.use.voice'
  | 'avatar.use.motion'
  | 'avatar.manage.personas'
  | 'avatar.read.preciseGeometry'
  | 'avatar.read.identityEmbedding'
  | 'avatar.read.rawBiometrics'
  | 'avatar.export'
  | 'avatar.replace.identity'

export const MDHS_PRIVILEGED_CAPABILITIES: readonly AvatarCapability[] = [
  'avatar.read.preciseGeometry',
  'avatar.read.identityEmbedding',
  'avatar.read.rawBiometrics',
  'avatar.export',
  'avatar.replace.identity',
] as const

export function isPrivilegedAvatarCapability(capability: AvatarCapability): boolean {
  return MDHS_PRIVILEGED_CAPABILITIES.includes(capability)
}

export function avatarCapabilityAllowsRawData(capability: AvatarCapability): boolean {
  return capability === 'avatar.read.rawBiometrics' || capability === 'avatar.read.identityEmbedding'
}

export function renderCapabilityAllowsRawData(capability: AvatarCapability): boolean {
  return capability.startsWith('avatar.render.') ? false : avatarCapabilityAllowsRawData(capability)
}

export interface AvatarPermissionGrant {
  id: AvatarPermissionId
  avatarId: AvatarId
  granteeAccountId?: string
  moduleId?: string
  capability: AvatarCapability
  scope: 'avatar' | 'revision' | 'asset' | 'render_request'
  revisionId?: AvatarRevisionId
  grantedAt: string
  expiresAt?: string
  revokedAt?: string
}

export interface AvatarConsent {
  id: AvatarConsentId
  avatarId: AvatarId
  ownerAccountId: string
  consumer: 'owner' | 'module' | 'platform' | 'external'
  consumerId?: string
  capability: AvatarCapability
  scope: string
  revisionId?: AvatarRevisionId
  grantedAt: string
  expiresAt?: string
  revokedAt?: string
}

export type AvatarObservationStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'needs_review'
  | 'resolved'
  | 'rejected'
  | 'failed'

export type AvatarObservationChangeResolution =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'auto_accepted'
  | 'superseded'

export interface AvatarObservation {
  id: AvatarObservationId
  avatarId: AvatarId
  sourceType: 'owner_upload' | 'verified_measurement' | 'owner_statement' | 'module_submission'
  sourceAssetId?: AvatarAssetId
  observedAt: string
  processor?: string
  processorVersion?: string
  qualityScore?: number | null
  status: AvatarObservationStatus
  createdAt: string
}

export interface AvatarObservationChange<T = unknown> {
  id: string
  observationId: AvatarObservationId
  attributePath: string
  previousValue?: T
  observedValue?: T
  confidence?: number | null
  resolutionStatus: AvatarObservationChangeResolution
  resolvedBy?: string
  resolvedAt?: string
}

export function canObservationChangeMutateAttribute(
  current: AvatarAttribute | undefined,
  change: AvatarObservationChange,
): boolean {
  assertAvatarAttributePath(change.attributePath)
  assertAvatarConfidence(change.confidence)
  if (current?.ownerLocked && change.resolutionStatus === 'auto_accepted') {
    return false
  }
  return change.resolutionStatus === 'accepted' || change.resolutionStatus === 'auto_accepted'
}

export interface AvatarRevision {
  id: AvatarRevisionId
  avatarId: AvatarId
  revisionNumber: number
  parentRevisionId?: AvatarRevisionId
  reason: string
  createdBy: string
  createdAt: string
  stateHash: AvatarStateHash
}

export interface AvatarPersona {
  id: AvatarPersonaId
  avatarId: AvatarId
  key: 'real-me' | 'cinema' | 'professional' | 'fantasy' | 'gubic' | 'virtual-world' | string
  displayName: string
  preferredRepresentationId?: AvatarRepresentationId
  presentationAge?: number
  wardrobeDefaults?: Record<string, unknown>
  style?: Record<string, unknown>
  renderPreferences?: Record<string, unknown>
}

export interface AvatarRepresentation {
  id: AvatarRepresentationId
  avatarId: AvatarId
  kind: 'photoreal' | 'anime' | 'voxel' | 'game-3d' | 'vr' | 'robot' | 'fantasy' | string
  displayName: string
  constraints?: Record<string, unknown>
}

export interface MdhsProjection {
  $schema: typeof MDHS_SCHEMA_URI
  avatar: Record<string, unknown>
  modelStatus: Record<string, unknown>
  timeline: Record<string, unknown>
  physical: {
    head: Record<string, unknown>
    face: Record<string, unknown>
    skin: Record<string, unknown>
    eyes: Record<string, unknown>
    hair: Record<string, unknown>
    facialHair: Record<string, unknown>
    ears: Record<string, unknown>
    mouth: Record<string, unknown>
    teeth: Record<string, unknown>
    neck: Record<string, unknown>
    body: Record<string, unknown>
    arms: Record<string, unknown>
    hands: Record<string, unknown>
    legs: Record<string, unknown>
    feet: Record<string, unknown>
  }
  geometry: Record<string, unknown>
  materials: Record<string, unknown>
  rig: Record<string, unknown>
  expressions: Record<string, unknown>
  motion: Record<string, unknown>
  voice: Record<string, unknown>
  appearance: Record<string, unknown>
  wardrobe: Record<string, unknown>
  personas: AvatarPersona[]
  representations: AvatarRepresentation[]
  observations: AvatarObservation[]
  history: Record<string, unknown>
  generationProfile: Record<string, unknown>
  permissions: Record<string, unknown>
  privacy: Record<string, unknown>
  provenance: Record<string, unknown>
  integrity: Record<string, unknown>
  extensions: Record<string, unknown>
}

export function createEmptyMdhsProjection(input: {
  avatarId: AvatarId
  ownerAccountId: string
  revisionId?: AvatarRevisionId
  createdAt: string
}): MdhsProjection {
  return {
    $schema: MDHS_SCHEMA_URI,
    avatar: {
      id: input.avatarId,
      ownerAccountId: input.ownerAccountId,
      revisionId: input.revisionId,
    },
    modelStatus: {schemaVersion: MDHS_SCHEMA_VERSION, status: 'unknown'},
    timeline: {createdAt: input.createdAt},
    physical: {
      head: {},
      face: {},
      skin: {},
      eyes: {},
      hair: {},
      facialHair: {},
      ears: {},
      mouth: {},
      teeth: {},
      neck: {},
      body: {},
      arms: {},
      hands: {},
      legs: {},
      feet: {},
    },
    geometry: {},
    materials: {},
    rig: {},
    expressions: {},
    motion: {},
    voice: {},
    appearance: {},
    wardrobe: {},
    personas: [],
    representations: [],
    observations: [],
    history: {},
    generationProfile: {},
    permissions: {},
    privacy: {},
    provenance: {},
    integrity: {},
    extensions: {},
  }
}

export function canonicalizeMdhsValue(value: unknown): string {
  return JSON.stringify(sortForCanonicalHash(value))
}

function sortForCanonicalHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalHash)
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortForCanonicalHash(record[key])
        return acc
      }, {})
  }
  return value
}

export function createMdhsStateHash(value: unknown): AvatarStateHash {
  const canonical = canonicalizeMdhsValue(value)
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * prime)
  }
  return `mdhs-0.1:fnv1a64:${hash.toString(16).padStart(16, '0')}`
}

export interface AvatarGenerationRequest {
  actor: {
    avatar: string
    persona?: string
    identityStrength: number
  }
  appearanceOverrides?: {
    presentationAge?: number
    [key: string]: unknown
  }
  scene: {
    description: string
    [key: string]: unknown
  }
  camera?: {
    shot?: string
    lens?: string
    [key: string]: unknown
  }
  output: 'image' | 'video' | '3d' | 'game'
}

export interface AvatarObserverResult {
  observation: AvatarObservation
  changes: AvatarObservationChange[]
  warnings: string[]
}

export interface AvatarObserver {
  id: string
  version: string
  observe(input: {
    avatarId: AvatarId
    sourceAsset: AvatarAssetReference
    requestedAttributePaths?: string[]
  }): Promise<AvatarObserverResult>
}

export interface AvatarCompiler {
  id: string
  version: string
  compile(input: {
    projection: MdhsProjection
    persona?: AvatarPersona
    representation?: AvatarRepresentation
    request: AvatarGenerationRequest
  }): Promise<{
    providerNeutralConditioning: Record<string, unknown>
    requiredCapabilities: AvatarCapability[]
    allowedAssetReferences: AvatarAssetReference[]
  }>
}

export type AvatarCompletenessDomain =
  | 'overall'
  | 'face'
  | 'hair'
  | 'skin'
  | 'body'
  | 'hands'
  | 'teeth'
  | 'expressions'
  | 'motion'
  | 'voice'

export interface AvatarCompletenessDomainScore {
  domain: AvatarCompletenessDomain
  score: number
  known: number
  total: number
  recommendations: string[]
}

const completenessDomains: Record<Exclude<AvatarCompletenessDomain, 'overall'>, readonly string[]> = {
  face: [
    'physical.face.geometry.structure',
    'physical.face.eyes.left.iris.colour',
    'physical.face.eyes.right.iris.colour',
    'physical.face.ears.left.shape',
    'physical.face.ears.right.shape',
  ],
  hair: ['physical.hair.colour.current', 'physical.hair.length.approxMm'],
  skin: [],
  body: [],
  hands: [],
  teeth: [],
  expressions: [],
  motion: [],
  voice: [],
}

export function computeAvatarCompleteness(attributes: readonly AvatarAttribute[]): AvatarCompletenessDomainScore[] {
  const byPath = new Map(attributes.map(attribute => [attribute.path, attribute]))
  const scores = Object.entries(completenessDomains).map(([domain, paths]) => {
    const known = paths.filter(path => {
      const attribute = byPath.get(path)
      return attribute && attribute.status !== 'unknown'
    }).length
    const total = paths.length
    const score = total === 0 ? 1 : known / total
    return {
      domain: domain as Exclude<AvatarCompletenessDomain, 'overall'>,
      score,
      known,
      total,
      recommendations: recommendationForDomain(domain as AvatarCompletenessDomain, score),
    }
  })
  const weighted = scores.filter(score => score.total > 0)
  const overall = weighted.length
    ? weighted.reduce((sum, score) => sum + score.score, 0) / weighted.length
    : 0
  return [{domain: 'overall', score: overall, known: weighted.reduce((sum, score) => sum + score.known, 0), total: weighted.reduce((sum, score) => sum + score.total, 0), recommendations: []}, ...scores]
}

function recommendationForDomain(domain: AvatarCompletenessDomain, score: number): string[] {
  if (score >= 1) return []
  if (domain === 'face') return ['Add a left-profile and right-profile image to improve ear and jaw coverage.']
  if (domain === 'hair') return ['Confirm current hair colour and approximate length.']
  return []
}
