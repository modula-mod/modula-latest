import {ingestError, type IngestDiagnostic} from './diagnostics.js'
import {registryKindFromDeclared} from './kinds.js'

export const LEGACY_MANIFEST_FILENAMES = [
  'modula.product.json',
  'modula.module.json',
  'module.manifest.json',
  'manifest.json',
  'module.json',
] as const

export type DetectedManifestFormat =
  | 'modula.product.json'
  | 'modula.module.json@2.1'
  | 'module.manifest.json@greenfield-v1'
  | 'manifest.json@legacy-marketplace'
  | 'module.json@legacy-runtime'

export function detectManifestFormat(filename: string): DetectedManifestFormat | null {
  if (filename.endsWith('modula.product.json')) return 'modula.product.json'
  if (filename.endsWith('modula.module.json')) return 'modula.module.json@2.1'
  if (filename.endsWith('module.manifest.json')) return 'module.manifest.json@greenfield-v1'
  if (filename === 'manifest.json' || filename.endsWith('/manifest.json')) return 'manifest.json@legacy-marketplace'
  if (filename === 'module.json' || filename.endsWith('/module.json')) return 'module.json@legacy-runtime'
  return null
}

export function adaptLegacyProductDocument(
  raw: Record<string, unknown>,
  format: DetectedManifestFormat,
): {manifest: Record<string, unknown>; diagnostics: IngestDiagnostic[]} {
  return adaptLegacyToMpsShape(raw, format)
}

export function adaptLegacyToMpsShape(
  raw: Record<string, unknown>,
  format: DetectedManifestFormat,
): {manifest: Record<string, unknown>; diagnostics: IngestDiagnostic[]} {
  if (format === 'modula.product.json') {
    return {manifest: raw, diagnostics: []}
  }

  const diagnostics: IngestDiagnostic[] = []
  if (format === 'manifest.json@legacy-marketplace' || format === 'module.json@legacy-runtime') {
    diagnostics.push(
      ingestError(
        'MPS-LEGACY-DEPRECATED',
        '',
        `${format} is deprecated. Adapter output still normalizes into MPS, but new products must ship modula.product.json.`,
      ),
    )
  }

  const identityBlock = isRecord(raw.identity) ? raw.identity : {}
  const publisherBlock = isRecord(raw.publisher) ? raw.publisher : {}
  const sourceBlock = isRecord(raw.source) ? raw.source : {}
  const extensionProduct = isRecord(raw.extensionProduct) ? raw.extensionProduct : {}
  const kind = String(
    extensionProduct.kind ?? identityBlock.kind ?? raw.kind ?? raw.type ?? raw.package_kind ?? 'module',
  )
  const productId = String(
    identityBlock.id ?? raw.moduleId ?? raw.id ?? raw.productId ?? '',
  )
  const version = String(identityBlock.version ?? raw.version ?? '0.0.0')
  const displayName = String(
    identityBlock.displayName ?? raw.name ?? raw.title ?? productId,
  )

  let registryKind = 'module'
  try {
    registryKind = registryKindFromDeclared(kind)
  } catch {
    diagnostics.push(ingestError('MPS-PROFILE-002', 'identity.kind', `Unsupported product kind "${kind}".`))
  }

  const adapted = {
    schema: 'modula.product.1.0',
    productStandard: '1.0-RC',
    identity: {
      id: productId,
      kind: registryKind,
      version,
      displayName,
      visibility: 'private',
      status: 'development',
    },
    publisher: {
      id: String(publisherBlock.publisherId ?? publisherBlock.id ?? raw.publisherId ?? 'unknown'),
      displayName: String(publisherBlock.displayName ?? 'Unknown'),
    },
    source: {
      repository: String(sourceBlock.repository ?? 'unknown/unknown'),
      commit: String(sourceBlock.commit ?? '0'.repeat(40)),
      manifestPath: String(sourceBlock.manifestPath ?? 'module.manifest.json'),
      provider: 'github',
    },
    licence: {
      spdx: String((isRecord(raw.license) ? raw.license.spdx : undefined) ?? 'UNLICENSED'),
      evidence: ['LICENSE'],
    },
    release: {channel: 'development'},
    security: {
      baseline: 'mps-1.0',
      rawUserBearerForwarding: 'forbidden',
      crossProductDatabaseAccess: 'forbidden',
      arbitraryRemoteCode: 'forbidden-by-default',
    },
    presentation: isRecord(raw.presentation) ? raw.presentation : {},
    frontend: inferFrontend(raw),
    backend: inferBackend(raw),
    capabilities: isRecord(raw.capabilities) ? raw.capabilities : undefined,
    permissions: Array.isArray(raw.permissions) ? raw.permissions : undefined,
    events: Array.isArray(raw.events) ? adaptEvents(raw.events, productId) : undefined,
  }

  if (!productId) {
    diagnostics.push(ingestError('MPS-IDENTITY-001', 'identity.id', 'Legacy manifest is missing a product id.'))
  }
  return {manifest: adapted, diagnostics}
}

function inferFrontend(raw: Record<string, unknown>): {mode: 'none' | 'declarative' | 'host-contribution'} {
  if (isRecord(raw.frontend) && typeof raw.frontend.mode === 'string') {
    const mode = raw.frontend.mode
    if (mode === 'none' || mode === 'declarative' || mode === 'host-contribution') return {mode}
  }
  if (isRecord(raw.contributions) || isRecord(raw.extensionProduct)) return {mode: 'host-contribution'}
  return {mode: 'none'}
}

function inferBackend(raw: Record<string, unknown>): {mode: 'none' | 'greenfield-records' | 'service' | 'engine-backed'} {
  if (isRecord(raw.backend) && typeof raw.backend.mode === 'string') {
    const mode = raw.backend.mode
    if (mode === 'none' || mode === 'greenfield-records' || mode === 'service' || mode === 'engine-backed') {
      return {mode}
    }
    if (mode === 'frontend-only') return {mode: 'none'}
    if (mode === 'greenfield-managed') return {mode: 'greenfield-records'}
    if (mode === 'module-managed' || mode === 'hybrid') return {mode: 'service'}
  }
  return {mode: 'none'}
}

function adaptEvents(events: unknown[], productId: string): Array<Record<string, unknown>> {
  return events.map(event => {
    if (!isRecord(event)) return {direction: 'produces', type: String(event), schemaVersion: '1.0.0'}
    const type = String(event.type ?? event.eventType ?? '')
    const adaptedType = type.includes('.v') ? type : toMpsEventType(productId, type)
    return {
      direction: event.direction === 'subscribes' ? 'subscribes' : 'produces',
      type: adaptedType,
      schemaVersion: String(event.schemaVersion ?? event.eventVersion ?? '1.0.0'),
    }
  })
}

export function toMpsEventType(productId: string, rawType: string): string {
  if (/\.v[1-9][0-9]*$/.test(rawType) && rawType.startsWith(productId)) return rawType
  const parts = rawType.split('.').filter(Boolean)
  const entity = parts.at(-2) ?? 'resource'
  const verb = parts.at(-1) ?? 'changed'
  return `${productId}.${entity}.${verb}.v1`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
