export declare const MDHS_SCHEMA_VERSION: "0.1.0";
export declare const MDHS_SCHEMA_URI: "modula://schemas/mdhs/0.1.0";
export type AvatarId = string;
export type AvatarRevisionId = string;
export type AvatarObservationId = string;
export type AvatarAssetId = string;
export type AvatarPersonaId = string;
export type AvatarRepresentationId = string;
export type AvatarPermissionId = string;
export type AvatarConsentId = string;
export type AvatarStateHash = `mdhs-0.1:fnv1a64:${string}`;
export type AvatarStateStatus = 'active' | 'suspended' | 'deletion_pending' | 'deleted';
export type AvatarAttributeStatus = 'known' | 'confirmed' | 'estimated' | 'uncertain' | 'unknown';
export type AvatarAttributeClassification = 'STABLE_IDENTITY' | 'TEMPORAL_PHYSICAL' | 'CONTEXTUAL';
export type AvatarProvenanceAuthority = 'OWNER_LOCKED' | 'VERIFIED_MEASUREMENT' | 'OWNER_CONFIRMED' | 'MULTI_OBSERVATION_CONSENSUS' | 'HIGH_CONFIDENCE_OBSERVATION' | 'SINGLE_OBSERVATION' | 'AI_ESTIMATION' | 'UNKNOWN';
export declare const AVATAR_PROVENANCE_AUTHORITY_ORDER: readonly AvatarProvenanceAuthority[];
export interface AvatarProvenance {
    authority: AvatarProvenanceAuthority;
    observationId?: AvatarObservationId;
    sourceAssetId?: AvatarAssetId;
    processor?: string;
    processorVersion?: string;
    ownerAccountId?: string;
    acceptedAt?: string;
}
export interface AvatarAttribute<T = unknown> {
    path: string;
    value?: T;
    status: AvatarAttributeStatus;
    classification: AvatarAttributeClassification;
    confidence?: number | null;
    provenance?: AvatarProvenance;
    ownerConfirmed: boolean;
    ownerLocked: boolean;
    firstObservedAt?: string;
    lastObservedAt?: string;
}
export interface AvatarAttributeDefinition {
    path: string;
    classification: AvatarAttributeClassification;
    valueType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
    description: string;
}
export declare const MDHS_ATTRIBUTE_REGISTRY: readonly AvatarAttributeDefinition[];
export declare function isRegisteredAvatarAttributePath(path: string): boolean;
export declare function assertAvatarAttributePath(path: string): string;
export declare function isValidAvatarConfidence(confidence: number | null | undefined): boolean;
export declare function assertAvatarConfidence(confidence: number | null | undefined): number | null | undefined;
export declare function createUnknownAvatarAttribute(path: string, classification: AvatarAttributeClassification): AvatarAttribute;
export type AvatarRevisionSelector = {
    kind: 'latest';
} | {
    kind: 'revision';
    revisionId: AvatarRevisionId;
} | {
    kind: 'revision_number';
    revisionNumber: number;
} | {
    kind: 'timestamp';
    timestamp: string;
};
export declare function formatAvatarUri(avatarId: AvatarId, selector?: AvatarRevisionSelector): string;
export declare function parseAvatarUri(uri: string): {
    avatarId: AvatarId;
    selector: AvatarRevisionSelector;
};
export type AvatarSensitivityClass = 'PUBLIC_AVATAR' | 'PRIVATE_APPEARANCE' | 'SENSITIVE_MEASUREMENT' | 'PRECISE_GEOMETRY' | 'RAW_BIOMETRIC' | 'VOICE_IDENTITY' | 'MOTION_SIGNATURE' | 'SOURCE_MEDIA';
export interface AvatarAssetReference {
    id: AvatarAssetId;
    avatarId: AvatarId;
    revisionId?: AvatarRevisionId;
    assetType: 'source_image' | 'display_image' | 'geometry' | 'texture' | 'voice' | 'motion' | 'expression' | 'export';
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    sensitivityClass: AvatarSensitivityClass;
    contentHash: string;
    encryptionKeyVersion?: string;
    createdAt: string;
}
export type AvatarCapability = 'avatar.read.basic' | 'avatar.read.appearance' | 'avatar.read.measurements' | 'avatar.render.image' | 'avatar.render.video' | 'avatar.render.3d' | 'avatar.render.game' | 'avatar.submit.observation' | 'avatar.use.voice' | 'avatar.use.motion' | 'avatar.manage.personas' | 'avatar.read.preciseGeometry' | 'avatar.read.identityEmbedding' | 'avatar.read.rawBiometrics' | 'avatar.export' | 'avatar.replace.identity';
export declare const MDHS_PRIVILEGED_CAPABILITIES: readonly AvatarCapability[];
export declare function isPrivilegedAvatarCapability(capability: AvatarCapability): boolean;
export declare function avatarCapabilityAllowsRawData(capability: AvatarCapability): boolean;
export declare function renderCapabilityAllowsRawData(capability: AvatarCapability): boolean;
export interface AvatarPermissionGrant {
    id: AvatarPermissionId;
    avatarId: AvatarId;
    granteeAccountId?: string;
    moduleId?: string;
    capability: AvatarCapability;
    scope: 'avatar' | 'revision' | 'asset' | 'render_request';
    revisionId?: AvatarRevisionId;
    grantedAt: string;
    expiresAt?: string;
    revokedAt?: string;
}
export interface AvatarConsent {
    id: AvatarConsentId;
    avatarId: AvatarId;
    ownerAccountId: string;
    consumer: 'owner' | 'module' | 'platform' | 'external';
    consumerId?: string;
    capability: AvatarCapability;
    scope: string;
    revisionId?: AvatarRevisionId;
    grantedAt: string;
    expiresAt?: string;
    revokedAt?: string;
}
export type AvatarObservationStatus = 'pending' | 'processing' | 'processed' | 'needs_review' | 'resolved' | 'rejected' | 'failed';
export type AvatarObservationChangeResolution = 'pending' | 'accepted' | 'rejected' | 'auto_accepted' | 'superseded';
export interface AvatarObservation {
    id: AvatarObservationId;
    avatarId: AvatarId;
    sourceType: 'owner_upload' | 'verified_measurement' | 'owner_statement' | 'module_submission';
    sourceAssetId?: AvatarAssetId;
    observedAt: string;
    processor?: string;
    processorVersion?: string;
    qualityScore?: number | null;
    status: AvatarObservationStatus;
    createdAt: string;
}
export interface AvatarObservationChange<T = unknown> {
    id: string;
    observationId: AvatarObservationId;
    attributePath: string;
    previousValue?: T;
    observedValue?: T;
    confidence?: number | null;
    resolutionStatus: AvatarObservationChangeResolution;
    resolvedBy?: string;
    resolvedAt?: string;
}
export declare function canObservationChangeMutateAttribute(current: AvatarAttribute | undefined, change: AvatarObservationChange): boolean;
export interface AvatarRevision {
    id: AvatarRevisionId;
    avatarId: AvatarId;
    revisionNumber: number;
    parentRevisionId?: AvatarRevisionId;
    reason: string;
    createdBy: string;
    createdAt: string;
    stateHash: AvatarStateHash;
}
export interface AvatarPersona {
    id: AvatarPersonaId;
    avatarId: AvatarId;
    key: 'real-me' | 'cinema' | 'professional' | 'fantasy' | 'gubic' | 'virtual-world' | string;
    displayName: string;
    preferredRepresentationId?: AvatarRepresentationId;
    presentationAge?: number;
    wardrobeDefaults?: Record<string, unknown>;
    style?: Record<string, unknown>;
    renderPreferences?: Record<string, unknown>;
}
export interface AvatarRepresentation {
    id: AvatarRepresentationId;
    avatarId: AvatarId;
    kind: 'photoreal' | 'anime' | 'voxel' | 'game-3d' | 'vr' | 'robot' | 'fantasy' | string;
    displayName: string;
    constraints?: Record<string, unknown>;
}
export interface MdhsProjection {
    $schema: typeof MDHS_SCHEMA_URI;
    avatar: Record<string, unknown>;
    modelStatus: Record<string, unknown>;
    timeline: Record<string, unknown>;
    physical: {
        head: Record<string, unknown>;
        face: Record<string, unknown>;
        skin: Record<string, unknown>;
        eyes: Record<string, unknown>;
        hair: Record<string, unknown>;
        facialHair: Record<string, unknown>;
        ears: Record<string, unknown>;
        mouth: Record<string, unknown>;
        teeth: Record<string, unknown>;
        neck: Record<string, unknown>;
        body: Record<string, unknown>;
        arms: Record<string, unknown>;
        hands: Record<string, unknown>;
        legs: Record<string, unknown>;
        feet: Record<string, unknown>;
    };
    geometry: Record<string, unknown>;
    materials: Record<string, unknown>;
    rig: Record<string, unknown>;
    expressions: Record<string, unknown>;
    motion: Record<string, unknown>;
    voice: Record<string, unknown>;
    appearance: Record<string, unknown>;
    wardrobe: Record<string, unknown>;
    personas: AvatarPersona[];
    representations: AvatarRepresentation[];
    observations: AvatarObservation[];
    history: Record<string, unknown>;
    generationProfile: Record<string, unknown>;
    permissions: Record<string, unknown>;
    privacy: Record<string, unknown>;
    provenance: Record<string, unknown>;
    integrity: Record<string, unknown>;
    extensions: Record<string, unknown>;
}
export declare function createEmptyMdhsProjection(input: {
    avatarId: AvatarId;
    ownerAccountId: string;
    revisionId?: AvatarRevisionId;
    createdAt: string;
}): MdhsProjection;
export declare function canonicalizeMdhsValue(value: unknown): string;
export declare function createMdhsStateHash(value: unknown): AvatarStateHash;
export interface AvatarGenerationRequest {
    actor: {
        avatar: string;
        persona?: string;
        identityStrength: number;
    };
    appearanceOverrides?: {
        presentationAge?: number;
        [key: string]: unknown;
    };
    scene: {
        description: string;
        [key: string]: unknown;
    };
    camera?: {
        shot?: string;
        lens?: string;
        [key: string]: unknown;
    };
    output: 'image' | 'video' | '3d' | 'game';
}
export interface AvatarObserverResult {
    observation: AvatarObservation;
    changes: AvatarObservationChange[];
    warnings: string[];
}
export interface AvatarObserver {
    id: string;
    version: string;
    observe(input: {
        avatarId: AvatarId;
        sourceAsset: AvatarAssetReference;
        requestedAttributePaths?: string[];
    }): Promise<AvatarObserverResult>;
}
export interface AvatarCompiler {
    id: string;
    version: string;
    compile(input: {
        projection: MdhsProjection;
        persona?: AvatarPersona;
        representation?: AvatarRepresentation;
        request: AvatarGenerationRequest;
    }): Promise<{
        providerNeutralConditioning: Record<string, unknown>;
        requiredCapabilities: AvatarCapability[];
        allowedAssetReferences: AvatarAssetReference[];
    }>;
}
export type AvatarCompletenessDomain = 'overall' | 'face' | 'hair' | 'skin' | 'body' | 'hands' | 'teeth' | 'expressions' | 'motion' | 'voice';
export interface AvatarCompletenessDomainScore {
    domain: AvatarCompletenessDomain;
    score: number;
    known: number;
    total: number;
    recommendations: string[];
}
export declare function computeAvatarCompleteness(attributes: readonly AvatarAttribute[]): AvatarCompletenessDomainScore[];
