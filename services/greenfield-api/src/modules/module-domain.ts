import type {GreenfieldExtensionProductKind} from '@modula/greenfield-contracts'
import type {GreenfieldModuleManifest, GreenfieldModulePermission} from '@modula/greenfield-module-manifest'
import {
  GREENFIELD_MODULE_INSTALLATION_TRANSITIONS,
  type GreenfieldModuleInstallationStatus,
} from '@modula/greenfield-module-registry-contracts'

export const GREENFIELD_VERSION = '0.1.0'
export const MODULA_HOST_VERSION = '0.1.0'
export const GREENFIELD_PROTOCOL_VERSION = 'greenfield.v1'

export const GREENFIELD_MODULE_JOB_TYPES = [
  'module.registry.sync',
  'module.release.verify',
  'module.release.publish',
  'module.install',
  'module.enable',
  'module.disable',
  'module.update',
  'module.uninstall',
  'module.schemas.register',
  'module.schemas.unregister',
  'module.settings.migrate',
  'module.contributions.register',
  'module.contributions.unregister',
  'module.plugin.install',
  'module.plugin.enable',
  'module.plugin.disable',
  'module.plugin.uninstall',
  'module.github.syncRepository',
  'module.github.fetchManifest',
  'module.github.fetchLicenseEvidence',
  'module.github.fetchReleaseMetadata',
  'module.github.verifyCommit',
  'module.github.verifyReleaseIntegrity',
] as const

export const GREENFIELD_MODULE_EVENTS = [
  'module.discovered',
  'module.release.imported',
  'module.release.verified',
  'module.release.published',
  'module.release.quarantined',
  'module.release.revoked',
  'module.install.requested',
  'module.installed',
  'module.enable.requested',
  'module.enabled',
  'module.disable.requested',
  'module.disabled',
  'module.update.requested',
  'module.updated',
  'module.uninstall.requested',
  'module.uninstalled',
  'module.failed',
] as const

export type GreenfieldModuleJobType = (typeof GREENFIELD_MODULE_JOB_TYPES)[number]
export type GreenfieldModuleEventType = (typeof GREENFIELD_MODULE_EVENTS)[number]

export type GreenfieldModuleReleaseRecord = {
  releaseId: string
  extensionId: string
  extensionVersionId: string
  moduleId: string
  version: string
  publisherId: string
  releaseState: string
  manifest: GreenfieldModuleManifest
  manifestSha256: string
  releaseSha256: string | null
  signatureKeyId: string | null
  signature: string | null
  sourceRepository: string
  sourceCommit: string
  manifestPath: string
  licenseStatus: string
  trustLevel: string
  publishedAt: Date | null
}

export type GreenfieldModuleInstallationRow = {
  installationId: string
  accountId: string
  status: GreenfieldModuleInstallationStatus
  moduleId: string
  version: string
  extensionVersionId: string
  grantedPermissions?: string[]
  productKind?: GreenfieldExtensionProductKind
  lifecycleState?: string
}

export const INSTALLED_MODULE_STATES: GreenfieldModuleInstallationStatus[] = [
  'installedDisabled',
  'enabling',
  'enabled',
  'disabling',
  'disabled',
  'updating',
  'failed',
  'quarantined',
]

export function transitionMapForVerifier(): Record<GreenfieldModuleInstallationStatus, GreenfieldModuleInstallationStatus[]> {
  return GREENFIELD_MODULE_INSTALLATION_TRANSITIONS
}

export function moduleRecordCollection(moduleId: string, collection: string): string {
  return `module.${moduleId}.${collection}`
}

export function assertModuleRecordIsolation(moduleId: string, collection: string, permissions: GreenfieldModulePermission[]): void {
  const qualified = moduleRecordCollection(moduleId, collection)
  const allowed = permissions.some(permission => permission.permission.startsWith(`records:${qualified}:`))
  if (!allowed) {
    throw Object.assign(new Error(`Module ${moduleId} lacks permission for ${qualified}`), {code: 'PERMISSION_RESTRICTED'})
  }
}

export type GreenfieldModuleSecretReference = {
  secretRef: string
  provider: string
  scope: 'account' | 'installation' | 'team'
  createdAt: string
  rotatedAt: string | null
}

export function redactModuleSecrets(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactModuleSecrets)
  const redacted: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
      redacted[key] = {configured: Boolean(entry), secretRef: typeof entry === 'string' ? entry : 'configured', updatedAt: new Date().toISOString()}
    } else {
      redacted[key] = redactModuleSecrets(entry)
    }
  }
  return redacted
}

export type GreenfieldRemoteHttpFunctionPolicy = {
  url: string
  allowedHosts: string[]
  timeoutMs: number
  responseSizeLimitBytes: number
  responseSchemaRef: string
}

export function validateRemoteHttpFunctionPolicy(policy: GreenfieldRemoteHttpFunctionPolicy): string[] {
  const errors: string[] = []
  let parsed: URL | null = null
  try {
    parsed = new URL(policy.url)
  } catch {
    errors.push('REMOTE_HTTP_URL_INVALID')
  }
  if (parsed?.protocol !== 'https:') errors.push('REMOTE_HTTP_HTTPS_REQUIRED')
  if (parsed && !policy.allowedHosts.includes(parsed.hostname)) errors.push('REMOTE_HTTP_HOST_NOT_ALLOWLISTED')
  if (parsed && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(parsed.hostname)) {
    errors.push('REMOTE_HTTP_PRIVATE_ADDRESS_DENIED')
  }
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 100 || policy.timeoutMs > 10_000) errors.push('REMOTE_HTTP_TIMEOUT_INVALID')
  if (!Number.isInteger(policy.responseSizeLimitBytes) || policy.responseSizeLimitBytes < 1 || policy.responseSizeLimitBytes > 1_000_000) {
    errors.push('REMOTE_HTTP_RESPONSE_SIZE_INVALID')
  }
  if (!policy.responseSchemaRef) errors.push('REMOTE_HTTP_RESPONSE_SCHEMA_REQUIRED')
  return errors
}
