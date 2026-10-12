export const HOST_CAPABILITY_STATUSES = ['available', 'unavailable', 'degraded'] as const
export const HOST_CAPABILITY_PROVENANCE = ['native', 'fallback', 'emulated', 'unavailable'] as const
export const HOST_CAPABILITY_DISCOVERY_VERSION = '1.0.0' as const

export type HostCapabilityStatus = (typeof HOST_CAPABILITY_STATUSES)[number]
export type HostCapabilityProvenance = (typeof HOST_CAPABILITY_PROVENANCE)[number]

export const MODULA_HOST_CAPABILITY_IDS = [
  'ui.button',
  'ui.search',
  'ui.menu',
  'ui.toolbar',
  'ui.sheet',
  'ui.form',
  'ui.list',
  'ui.graph',
  'ui.document-editor',
  'ui.editor-toolbar',
  'ui.property-editor',
  'ui.reference-picker',
  'ui.attachment-gallery',
  'ui.revision-browser',
  'ui.record-table',
  'ui.record-board',
  'ui.command-menu',
  'media.attachment-picker',
  'share',
  'intelligence.local',
  'biometrics',
  'background-sync',
  'secure-storage',
] as const

export type ModulaHostCapabilityId = (typeof MODULA_HOST_CAPABILITY_IDS)[number]

export type HostCapabilityReference = {
  id: string
  version: string
}

export type HostCapabilityRequirement = HostCapabilityReference & {
  /** Used only for optional requirements. Required capabilities never fall back. */
  fallback?: HostCapabilityReference
}

export type HostCapabilityConstraintValue = string | number | boolean | null | readonly string[]

export type HostCapabilityDescriptor = HostCapabilityReference & {
  status: HostCapabilityStatus
  /** How this capability is actually supplied. Never infer native from renderer presence. */
  provenance: HostCapabilityProvenance
  renderer?: string
  provider?: string
  /** A truthful host hint. It is never selected unless the module also declares it. */
  fallback?: HostCapabilityReference
  constraints?: Record<string, HostCapabilityConstraintValue>
}

export type HostCapabilityDiscovery = {
  schemaVersion: typeof HOST_CAPABILITY_DISCOVERY_VERSION
  capabilities: readonly HostCapabilityDescriptor[]
}

export type HostCapabilityResolution = {
  requirement: HostCapabilityRequirement
  descriptor?: HostCapabilityDescriptor
  selected?: HostCapabilityDescriptor
  usedFallback: boolean
  status: HostCapabilityStatus | 'missing'
}

export type HostCapabilityNegotiation = {
  ok: boolean
  required: HostCapabilityResolution[]
  optional: HostCapabilityResolution[]
  error?: {
    code: 'CAPABILITY_UNAVAILABLE'
    capability: HostCapabilityReference
    message: string
  }
}

export type HostCapabilityValidationIssue = {
  path: string
  code: string
  message: string
}

export type HostCapabilityValidationResult<T> = {
  valid: boolean
  value?: T
  issues: HostCapabilityValidationIssue[]
}

const CAPABILITY_ID_PATTERN = /^[a-z][A-Za-z0-9]*(?:[.-][a-z][A-Za-z0-9]*)*$/
const CAPABILITY_VERSION_PATTERN = /^(?:[1-9][0-9]*|[1-9][0-9]*\.[0-9]+\.[0-9]+)$/
const RENDERER_PATTERN = /^[a-z][A-Za-z0-9]*(?:[.-][a-z][A-Za-z0-9]*)*$/
const CONSTRAINT_KEY_PATTERN = /^[a-z][A-Za-z0-9]*(?:[.-][a-z][A-Za-z0-9]*)*$/

export function parseHostCapabilityReference(input: string | HostCapabilityRequirement): HostCapabilityRequirement | undefined {
  if (typeof input === 'string') {
    const split = input.lastIndexOf('@')
    if (split <= 0) return undefined
    const reference = {id: input.slice(0, split), version: input.slice(split + 1)}
    return isCapabilityReference(reference) ? reference : undefined
  }
  if (!isCapabilityReference(input)) return undefined
  if (input.fallback !== undefined && !isCapabilityReference(input.fallback)) return undefined
  return {
    id: input.id,
    version: input.version,
    fallback: input.fallback ? {...input.fallback} : undefined,
  }
}

export function formatHostCapabilityReference(reference: HostCapabilityReference): string {
  return `${reference.id}@${reference.version}`
}

export function createHostCapabilityDiscovery(capabilities: readonly HostCapabilityDescriptor[]): HostCapabilityDiscovery {
  const seen = new Set<string>()
  for (const descriptor of capabilities) {
    const validation = validateHostCapabilityDescriptor(descriptor)
    if (!validation.valid) throw new Error(validation.issues.map(issue => `${issue.path} ${issue.code}: ${issue.message}`).join('; '))
    const key = formatHostCapabilityReference(descriptor)
    if (seen.has(key)) throw new Error(`Duplicate host capability ${key}`)
    seen.add(key)
  }
  return {schemaVersion: HOST_CAPABILITY_DISCOVERY_VERSION, capabilities: [...capabilities]}
}

export function validateHostCapabilityDescriptor(input: unknown): HostCapabilityValidationResult<HostCapabilityDescriptor> {
  const issues: HostCapabilityValidationIssue[] = []
  if (!isRecord(input)) return {valid: false, issues: [{path: '$', code: 'CAPABILITY_NOT_OBJECT', message: 'Host capability descriptor must be an object'}]}
  const descriptor = input as Partial<HostCapabilityDescriptor> & Record<string, unknown>
  const allowed = new Set(['id', 'version', 'status', 'provenance', 'renderer', 'provider', 'fallback', 'constraints'])
  for (const key of Object.keys(input)) if (!allowed.has(key)) issues.push({path: `$.${key}`, code: 'UNKNOWN_PROPERTY', message: `${key} is not part of the host capability contract`})
  if (!isCapabilityReference(input)) issues.push({path: '$', code: 'INVALID_CAPABILITY_REFERENCE', message: 'Capability ID and version must be bounded semantic identifiers'})
  if (!HOST_CAPABILITY_STATUSES.includes(descriptor.status as HostCapabilityStatus)) issues.push({path: '$.status', code: 'INVALID_CAPABILITY_STATUS', message: 'Capability status must be available, unavailable, or degraded'})
  if (!HOST_CAPABILITY_PROVENANCE.includes(descriptor.provenance as HostCapabilityProvenance)) issues.push({path: '$.provenance', code: 'INVALID_CAPABILITY_PROVENANCE', message: 'Capability provenance must be native, fallback, emulated, or unavailable'})
  if (descriptor.status === 'unavailable' && descriptor.provenance !== 'unavailable') issues.push({path: '$.provenance', code: 'UNAVAILABLE_PROVENANCE_REQUIRED', message: 'Unavailable capabilities must declare unavailable provenance'})
  if (descriptor.status !== 'unavailable' && descriptor.provenance === 'unavailable') issues.push({path: '$.provenance', code: 'AVAILABLE_PROVENANCE_REQUIRED', message: 'Available or degraded capabilities must declare their real implementation provenance'})
  if (descriptor.renderer !== undefined && (typeof descriptor.renderer !== 'string' || !RENDERER_PATTERN.test(descriptor.renderer))) issues.push({path: '$.renderer', code: 'INVALID_RENDERER', message: 'Renderer must be a semantic identifier'})
  if (descriptor.provider !== undefined && (typeof descriptor.provider !== 'string' || !RENDERER_PATTERN.test(descriptor.provider))) issues.push({path: '$.provider', code: 'INVALID_PROVIDER', message: 'Provider must be a semantic identifier'})
  if (descriptor.fallback !== undefined) {
    if (!isCapabilityReference(descriptor.fallback)) issues.push({path: '$.fallback', code: 'INVALID_CAPABILITY_FALLBACK', message: 'Fallback must be a versioned capability reference'})
    else if (descriptor.fallback.id === descriptor.id && versionsCompatible(String(descriptor.version), descriptor.fallback.version)) issues.push({path: '$.fallback', code: 'SELF_CAPABILITY_FALLBACK', message: 'Capability fallback cannot select itself'})
  }
  if (descriptor.constraints !== undefined) {
    if (!isRecord(descriptor.constraints) || Object.keys(descriptor.constraints).length > 32) issues.push({path: '$.constraints', code: 'INVALID_CAPABILITY_CONSTRAINTS', message: 'Capability constraints must be a bounded object'})
    else for (const [key, value] of Object.entries(descriptor.constraints)) {
      if (!CONSTRAINT_KEY_PATTERN.test(key) || !isConstraintValue(value)) {
        issues.push({path: `$.constraints.${key}`, code: 'INVALID_CAPABILITY_CONSTRAINT', message: 'Capability constraints use semantic keys and bounded scalar or string-list JSON values'})
      }
    }
  }
  return {valid: issues.length === 0, value: issues.length === 0 ? input as HostCapabilityDescriptor : undefined, issues}
}

function isConstraintValue(value: unknown): value is HostCapabilityConstraintValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  return Array.isArray(value) && value.length <= 64 && value.every(item => typeof item === 'string' && item.length <= 160)
}

export function negotiateHostCapabilities(input: {
  host: readonly HostCapabilityDescriptor[]
  required?: readonly (string | HostCapabilityRequirement)[]
  optional?: readonly (string | HostCapabilityRequirement)[]
}): HostCapabilityNegotiation {
  const host = input.host.filter(descriptor => validateHostCapabilityDescriptor(descriptor).valid)
  const required = (input.required ?? []).map(requirement => resolveRequirement(requirement, host, false))
  const optional = (input.optional ?? []).map(requirement => resolveRequirement(requirement, host, true))
  const unavailable = required.find(resolution => !resolution.selected || resolution.status === 'unavailable' || resolution.status === 'missing')
  if (unavailable) {
    const capability = unavailable.requirement
    return {
      ok: false,
      required,
      optional,
      error: {
        code: 'CAPABILITY_UNAVAILABLE',
        capability: {id: capability.id, version: capability.version},
        message: `Required host capability ${formatHostCapabilityReference(capability)} is unavailable`,
      },
    }
  }
  return {ok: true, required, optional}
}

function resolveRequirement(
  input: string | HostCapabilityRequirement,
  host: readonly HostCapabilityDescriptor[],
  allowFallback: boolean,
): HostCapabilityResolution {
  const requirement = parseHostCapabilityReference(input) ?? {id: String(input), version: ''}
  const descriptor = host.find(candidate => candidate.id === requirement.id && versionsCompatible(candidate.version, requirement.version))
  if (descriptor && descriptor.status !== 'unavailable') {
    return {requirement, descriptor, selected: descriptor, usedFallback: false, status: descriptor.status}
  }
  if (allowFallback && requirement.fallback) {
    const selected = host.find(candidate => candidate.id === requirement.fallback!.id
      && versionsCompatible(candidate.version, requirement.fallback!.version)
      && candidate.status !== 'unavailable')
    if (selected) return {requirement, descriptor, selected, usedFallback: true, status: selected.status}
  }
  return {requirement, descriptor, usedFallback: false, status: descriptor?.status ?? 'missing'}
}

function versionsCompatible(provided: string, requested: string): boolean {
  if (!CAPABILITY_VERSION_PATTERN.test(provided) || !CAPABILITY_VERSION_PATTERN.test(requested)) return false
  if (!requested.includes('.')) return provided.split('.')[0] === requested
  return provided === requested
}

function isCapabilityReference(value: unknown): value is HostCapabilityReference {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length <= 160 && CAPABILITY_ID_PATTERN.test(value.id)
    && typeof value.version === 'string' && CAPABILITY_VERSION_PATTERN.test(value.version)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
