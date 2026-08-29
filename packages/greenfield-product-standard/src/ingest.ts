import {adaptLegacyToMpsShape, detectManifestFormat, type DetectedManifestFormat} from './adapters.js'
import {FORBIDDEN_SECRET_KEYS, ingestError, type IngestDiagnostic} from './diagnostics.js'
import {greenfieldBackendModeFromMps, isMpsProductKind, registryKindFromDeclared, type MpsProductKind} from './kinds.js'

const PRODUCT_ID_PATTERN = /^(?=.{3,128}$)[a-z][a-z0-9]*(\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/
const PROTOCOL_PATTERN = /^greenfield\.v[1-9][0-9]*$/
const FRONTEND_MODES = new Set(['none', 'declarative', 'host-contribution'])
const BACKEND_MODES = new Set(['none', 'greenfield-records', 'service', 'engine-backed'])
const SECRET_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){1,8}$/
const ENTITLEMENT_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/

export type NormalizedMpsProduct = {
  format: DetectedManifestFormat
  productId: string
  kind: MpsProductKind
  version: string
  displayName: string
  publisherId: string
  familyId: string | null
  familyRole: 'root' | 'member' | null
  aliases: string[]
  relationships: Array<{type: string; productId: string; versionRange?: string}>
  frontendMode: 'none' | 'declarative' | 'host-contribution'
  backendMode: 'none' | 'greenfield-records' | 'service' | 'engine-backed'
  greenfieldBackendMode: 'frontend-only' | 'greenfield-managed' | 'module-managed'
  storageMode: string | null
  capabilities: {provides: string[]; requires: string[]; requests: string[]; providerRoles: string[]}
  permissions: Array<{id: string; reason: string}>
  presentationAssets: Array<{
    role: string
    path: string
    mediaType: string
    sha256?: string
    width?: number
    height?: number
    developmentAsset?: boolean
  }>
  privacy: Record<string, unknown> | null
  marketplace: Record<string, unknown> | null
  events: Array<{direction: string; type: string; schemaVersion: string}>
  jobs: Array<{id: string}>
  secrets: Array<{id: string; scope: string; purpose: string}>
  entitlements: Array<{id: string; reason: string}>
  compatibility: {
    productStandard?: string
    greenfieldProtocol?: string
    host?: string
    moduleProfile?: string
  }
  source: {repository: string; commit: string; manifestPath?: string}
  provenance: Record<string, unknown> | null
  testFixture: boolean
  visibility: string
  raw: Record<string, unknown>
}

export type IngestResult = {
  ok: boolean
  product?: NormalizedMpsProduct
  diagnostics: IngestDiagnostic[]
}

export function parseModulaProductJson(bytes: string | Buffer): unknown {
  return JSON.parse(typeof bytes === 'string' ? bytes : bytes.toString('utf8'))
}

export function validateModulaProduct(filename: string, bytes: string | Buffer): IngestResult {
  return ingestProductManifest({filename, bytes})
}

export function ingestProductManifest(input: {
  filename: string
  bytes: string | Buffer
}): IngestResult {
  const diagnostics: IngestDiagnostic[] = []
  const format = detectManifestFormat(input.filename)
  if (!format) {
    return {
      ok: false,
      diagnostics: [ingestError('MPS-IDENTITY-001', '', `Unsupported manifest filename: ${input.filename}`)],
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(typeof input.bytes === 'string' ? input.bytes : input.bytes.toString('utf8'))
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        ingestError('MPS-IDENTITY-002', '', `Manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`),
      ],
    }
  }
  if (!isRecord(raw)) {
    return {ok: false, diagnostics: [ingestError('MPS-IDENTITY-002', '', 'Manifest root must be an object')]}
  }

  walkForbiddenKeys(raw, '', diagnostics)

  const adapted = adaptLegacyToMpsShape(raw, format)
  diagnostics.push(...adapted.diagnostics)
  const manifest = adapted.manifest
  const identity = isRecord(manifest.identity) ? manifest.identity : {}
  const publisher = isRecord(manifest.publisher) ? manifest.publisher : {}
  const source = isRecord(manifest.source) ? manifest.source : {}
  const family = isRecord(manifest.family) ? manifest.family : null
  const frontend = isRecord(manifest.frontend) ? manifest.frontend : {mode: 'none'}
  const backend = isRecord(manifest.backend) ? manifest.backend : {mode: 'none'}
  const storage = isRecord(manifest.storage) ? manifest.storage : {}
  const capabilities = isRecord(manifest.capabilities) ? manifest.capabilities : {}
  const compatibility = isRecord(manifest.compatibility) ? manifest.compatibility : {}
  const presentation = isRecord(manifest.presentation) ? manifest.presentation : {}
  const release = isRecord(manifest.release) ? manifest.release : {}

  const productId = String(identity.id ?? '')
  const kindRaw = String(identity.kind ?? '')
  if (!PRODUCT_ID_PATTERN.test(productId)) {
    diagnostics.push(ingestError('MPS-IDENTITY-003', 'identity.id', 'Product ID does not match the MPS grammar.'))
  }
  if (!isMpsProductKind(kindRaw)) {
    diagnostics.push(ingestError('MPS-PROFILE-002', 'identity.kind', `Unsupported product kind "${kindRaw}".`))
  }
  const frontendMode = String(frontend.mode ?? 'none')
  if (!FRONTEND_MODES.has(frontendMode)) {
    diagnostics.push(ingestError('MPS-FRONTEND-001', 'frontend.mode', `Unsupported frontend mode "${frontendMode}".`))
  }
  const backendMode = String(backend.mode ?? 'none')
  if (!BACKEND_MODES.has(backendMode)) {
    diagnostics.push(ingestError('MPS-BACKEND-001', 'backend.mode', `Unsupported backend mode "${backendMode}".`))
  }
  if (backendMode === 'none') {
    if (isRecord(backend.service) || Array.isArray(manifest.services) && (manifest.services as unknown[]).length > 0) {
      diagnostics.push(ingestError('MPS-BACKEND-010', 'backend', 'backend.mode none must not declare services.'))
    }
    if (storage.mode) {
      diagnostics.push(ingestError('MPS-STORAGE-010', 'storage', 'backend.mode none must not declare storage.'))
    }
  }

  const protocol = compatibility.greenfieldProtocol
  if (typeof protocol === 'string' && !PROTOCOL_PATTERN.test(protocol)) {
    diagnostics.push(
      ingestError('MPS-COMPAT-001', 'compatibility.greenfieldProtocol', 'Greenfield protocol must be greenfield.vN, not a semver range.'),
    )
  }

  const secrets = Array.isArray(manifest.secrets) ? manifest.secrets : []
  for (const [index, secret] of secrets.entries()) {
    if (!isRecord(secret)) continue
    const id = String(secret.id ?? '')
    if (id.startsWith('secret://') || !SECRET_ID_PATTERN.test(id)) {
      diagnostics.push(ingestError('MPS-SECRETS-003', `secrets/${index}/id`, 'Secret requirement IDs must not be handles or values.'))
    }
  }
  const entitlements = Array.isArray(manifest.entitlements) ? manifest.entitlements : []
  for (const [index, entitlement] of entitlements.entries()) {
    if (!isRecord(entitlement)) continue
    if (!ENTITLEMENT_ID_PATTERN.test(String(entitlement.id ?? ''))) {
      diagnostics.push(ingestError('MPS-ENTITLEMENT-001', `entitlements/${index}/id`, 'Entitlement IDs are capability strings, not UUIDs.'))
    }
  }

  const arbitraryUrl = JSON.stringify(manifest).match(/https?:\/\/(?!modula\.digital|github\.com)[^\s"]+/i)
  if (backendMode !== 'none' && arbitraryUrl && JSON.stringify(manifest).includes('"url"')) {
    diagnostics.push(ingestError('MPS-NETWORK-010', 'backend', 'Product manifests must not inject arbitrary backend URLs.'))
  }

  const errors = diagnostics.filter(item => item.severity === 'error')
  if (errors.length > 0 || !isMpsProductKind(kindRaw) || !productId) {
    return {ok: false, diagnostics}
  }

  const kind = registryKindFromDeclared(kindRaw)
  const product: NormalizedMpsProduct = {
    format,
    productId,
    kind,
    version: String(identity.version ?? '0.0.0'),
    displayName: localized(identity.displayName) || productId,
    publisherId: String(publisher.id ?? ''),
    familyId: family ? String(family.id ?? '') : null,
    familyRole: family?.role === 'root' || family?.role === 'member' ? family.role : null,
    aliases: Array.isArray(identity.aliases) ? identity.aliases.map(String) : [],
    relationships: Array.isArray(manifest.relationships)
      ? (manifest.relationships as unknown[]).filter(isRecord).map(rel => ({
          type: String(rel.type ?? ''),
          productId: String(rel.productId ?? ''),
          versionRange: rel.versionRange ? String(rel.versionRange) : undefined,
        }))
      : [],
    frontendMode: frontendMode as NormalizedMpsProduct['frontendMode'],
    backendMode: backendMode as NormalizedMpsProduct['backendMode'],
    greenfieldBackendMode: greenfieldBackendModeFromMps(backendMode as NormalizedMpsProduct['backendMode']),
    storageMode: storage.mode ? String(storage.mode) : backendMode === 'greenfield-records' ? 'greenfield-records' : null,
    capabilities: {
      provides: stringArray(capabilities.provides),
      requires: stringArray(capabilities.requires),
      requests: stringArray(capabilities.requests),
      providerRoles: stringArray(capabilities.providerRoles),
    },
    permissions: Array.isArray(manifest.permissions)
      ? (manifest.permissions as unknown[]).filter(isRecord).map(permission => ({
          id: String(permission.id ?? ''),
          reason: localized(permission.reason),
        }))
      : [],
    presentationAssets: collectAssets(presentation),
    privacy: isRecord(manifest.privacy) ? manifest.privacy : null,
    marketplace: isRecord(manifest.marketplace) ? manifest.marketplace : null,
    events: Array.isArray(manifest.events)
      ? (manifest.events as unknown[]).filter(isRecord).map(event => ({
          direction: String(event.direction ?? 'produces'),
          type: String(event.type ?? ''),
          schemaVersion: String(event.schemaVersion ?? '1.0.0'),
        }))
      : [],
    jobs: Array.isArray(manifest.jobs)
      ? (manifest.jobs as unknown[]).filter(isRecord).map(job => ({id: String(job.id ?? '')}))
      : [],
    secrets: secrets.filter(isRecord).map(secret => ({
      id: String(secret.id ?? ''),
      scope: String(secret.scope ?? 'backend'),
      purpose: String(secret.purpose ?? ''),
    })),
    entitlements: entitlements.filter(isRecord).map(entitlement => ({
      id: String(entitlement.id ?? ''),
      reason: String(entitlement.reason ?? ''),
    })),
    compatibility: {
      productStandard: compatibility.productStandard ? String(compatibility.productStandard) : undefined,
      greenfieldProtocol: compatibility.greenfieldProtocol ? String(compatibility.greenfieldProtocol) : undefined,
      host: compatibility.host ? String(compatibility.host) : undefined,
      moduleProfile: compatibility.moduleProfile ? String(compatibility.moduleProfile) : undefined,
    },
    source: {
      repository: String(source.repository ?? ''),
      commit: String(source.commit ?? ''),
      manifestPath: source.manifestPath ? String(source.manifestPath) : undefined,
    },
    provenance: isRecord(release.provenance) ? release.provenance : null,
    testFixture: identity.testFixture === true,
    visibility: String(identity.visibility ?? 'private'),
    raw: manifest,
  }

  return {ok: errors.length === 0, product, diagnostics}
}

function collectAssets(presentation: Record<string, unknown>) {
  const list = [
    ...(Array.isArray(presentation.assets) ? presentation.assets : []),
    ...(Array.isArray(presentation.screenshots) ? presentation.screenshots : []),
    presentation.icon,
    presentation.logo,
    presentation.wordmark,
    presentation.cover,
    presentation.hero,
    presentation.background,
    presentation.badge,
  ]
  return list.filter(isRecord).map(asset => ({
    role: String(asset.role ?? ''),
    path: String(asset.path ?? ''),
    mediaType: String(asset.mediaType ?? ''),
    sha256: asset.sha256 ? String(asset.sha256) : undefined,
    width: typeof asset.width === 'number' ? asset.width : undefined,
    height: typeof asset.height === 'number' ? asset.height : undefined,
    developmentAsset: asset.developmentAsset === true,
  }))
}

function walkForbiddenKeys(value: unknown, path: string, out: IngestDiagnostic[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbiddenKeys(item, `${path}/${index}`, out))
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}/${key}`
    if ((FORBIDDEN_SECRET_KEYS as readonly string[]).includes(key)) {
      out.push(ingestError('MPS-SECRETS-001', next, `Forbidden secret-bearing field "${key}" is not allowed in product manifests.`))
    }
    walkForbiddenKeys(child, next, out)
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function localized(value: unknown): string {
  if (typeof value === 'string') return value
  if (isRecord(value) && typeof value.default === 'string') return value.default
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
