export const MDHS_SCHEMA_VERSION = '0.1.0';
export const MDHS_SCHEMA_URI = 'modula://schemas/mdhs/0.1.0';
export const AVATAR_PROVENANCE_AUTHORITY_ORDER = [
    'OWNER_LOCKED',
    'VERIFIED_MEASUREMENT',
    'OWNER_CONFIRMED',
    'MULTI_OBSERVATION_CONSENSUS',
    'HIGH_CONFIDENCE_OBSERVATION',
    'SINGLE_OBSERVATION',
    'AI_ESTIMATION',
    'UNKNOWN',
];
export const MDHS_ATTRIBUTE_REGISTRY = [
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
];
const registeredAttributePaths = new Set(MDHS_ATTRIBUTE_REGISTRY.map(item => item.path));
const extensionPathPattern = /^extensions\.[a-z0-9][a-z0-9.-]*\.[a-z0-9][a-z0-9._-]*$/i;
export function isRegisteredAvatarAttributePath(path) {
    return registeredAttributePaths.has(path) || extensionPathPattern.test(path);
}
export function assertAvatarAttributePath(path) {
    if (!isRegisteredAvatarAttributePath(path)) {
        throw new Error(`Unregistered MDHS attribute path: ${path}`);
    }
    return path;
}
export function isValidAvatarConfidence(confidence) {
    return confidence == null || (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1);
}
export function assertAvatarConfidence(confidence) {
    if (!isValidAvatarConfidence(confidence)) {
        throw new Error('Avatar confidence must be between 0 and 1 when present');
    }
    return confidence;
}
export function createUnknownAvatarAttribute(path, classification) {
    return {
        path: assertAvatarAttributePath(path),
        status: 'unknown',
        classification,
        confidence: null,
        ownerConfirmed: false,
        ownerLocked: false,
    };
}
export function formatAvatarUri(avatarId, selector = { kind: 'latest' }) {
    const suffix = selector.kind === 'latest'
        ? 'latest'
        : selector.kind === 'revision'
            ? selector.revisionId
            : selector.kind === 'revision_number'
                ? `revision_${selector.revisionNumber}`
                : selector.timestamp;
    return `modula://avatar/${avatarId}@${suffix}`;
}
export function parseAvatarUri(uri) {
    const match = /^modula:\/\/avatar\/([^@]+)(?:@(.+))?$/.exec(uri);
    if (!match) {
        throw new Error(`Invalid avatar URI: ${uri}`);
    }
    const selector = match[2] ?? 'latest';
    if (selector === 'latest') {
        return { avatarId: match[1], selector: { kind: 'latest' } };
    }
    const revisionNumber = /^revision_(\d+)$/.exec(selector);
    if (revisionNumber) {
        return { avatarId: match[1], selector: { kind: 'revision_number', revisionNumber: Number(revisionNumber[1]) } };
    }
    if (/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(selector)) {
        return { avatarId: match[1], selector: { kind: 'timestamp', timestamp: selector } };
    }
    return { avatarId: match[1], selector: { kind: 'revision', revisionId: selector } };
}
export const MDHS_PRIVILEGED_CAPABILITIES = [
    'avatar.read.preciseGeometry',
    'avatar.read.identityEmbedding',
    'avatar.read.rawBiometrics',
    'avatar.export',
    'avatar.replace.identity',
];
export function isPrivilegedAvatarCapability(capability) {
    return MDHS_PRIVILEGED_CAPABILITIES.includes(capability);
}
export function avatarCapabilityAllowsRawData(capability) {
    return capability === 'avatar.read.rawBiometrics' || capability === 'avatar.read.identityEmbedding';
}
export function renderCapabilityAllowsRawData(capability) {
    return capability.startsWith('avatar.render.') ? false : avatarCapabilityAllowsRawData(capability);
}
export function canObservationChangeMutateAttribute(current, change) {
    assertAvatarAttributePath(change.attributePath);
    assertAvatarConfidence(change.confidence);
    if (current?.ownerLocked && change.resolutionStatus === 'auto_accepted') {
        return false;
    }
    return change.resolutionStatus === 'accepted' || change.resolutionStatus === 'auto_accepted';
}
export function createEmptyMdhsProjection(input) {
    return {
        $schema: MDHS_SCHEMA_URI,
        avatar: {
            id: input.avatarId,
            ownerAccountId: input.ownerAccountId,
            revisionId: input.revisionId,
        },
        modelStatus: { schemaVersion: MDHS_SCHEMA_VERSION, status: 'unknown' },
        timeline: { createdAt: input.createdAt },
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
    };
}
export function canonicalizeMdhsValue(value) {
    return JSON.stringify(sortForCanonicalHash(value));
}
function sortForCanonicalHash(value) {
    if (Array.isArray(value)) {
        return value.map(sortForCanonicalHash);
    }
    if (value && typeof value === 'object') {
        const record = value;
        return Object.keys(record)
            .filter(key => record[key] !== undefined)
            .sort()
            .reduce((acc, key) => {
            acc[key] = sortForCanonicalHash(record[key]);
            return acc;
        }, {});
    }
    return value;
}
export function createMdhsStateHash(value) {
    const canonical = canonicalizeMdhsValue(value);
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    for (let index = 0; index < canonical.length; index += 1) {
        hash ^= BigInt(canonical.charCodeAt(index));
        hash = BigInt.asUintN(64, hash * prime);
    }
    return `mdhs-0.1:fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
const completenessDomains = {
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
};
export function computeAvatarCompleteness(attributes) {
    const byPath = new Map(attributes.map(attribute => [attribute.path, attribute]));
    const scores = Object.entries(completenessDomains).map(([domain, paths]) => {
        const known = paths.filter(path => {
            const attribute = byPath.get(path);
            return attribute && attribute.status !== 'unknown';
        }).length;
        const total = paths.length;
        const score = total === 0 ? 1 : known / total;
        return {
            domain: domain,
            score,
            known,
            total,
            recommendations: recommendationForDomain(domain, score),
        };
    });
    const weighted = scores.filter(score => score.total > 0);
    const overall = weighted.length
        ? weighted.reduce((sum, score) => sum + score.score, 0) / weighted.length
        : 0;
    return [{ domain: 'overall', score: overall, known: weighted.reduce((sum, score) => sum + score.known, 0), total: weighted.reduce((sum, score) => sum + score.total, 0), recommendations: [] }, ...scores];
}
function recommendationForDomain(domain, score) {
    if (score >= 1)
        return [];
    if (domain === 'face')
        return ['Add a left-profile and right-profile image to improve ear and jaw coverage.'];
    if (domain === 'hair')
        return ['Confirm current hair colour and approximate length.'];
    return [];
}
