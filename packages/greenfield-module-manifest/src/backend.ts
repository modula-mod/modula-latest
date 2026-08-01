import {
  MODULA_MODULE_BACKEND_PROTOCOL_VERSION,
  type ModuleBackendDefinition,
  type ModulaBackendMode,
} from '@modula/module-standard'

export type GreenfieldModuleBackendDefinition = ModuleBackendDefinition
export type GreenfieldModuleBackendMode = ModulaBackendMode

export const GREENFIELD_MODULE_BACKEND_MODES = [
  'greenfield-managed',
  'module-managed',
  'hybrid',
  'frontend-only',
] as const

export type GreenfieldBackendValidationIssue = {
  path: string
  code: string
  message: string
}

const BACKEND_MODES = new Set<string>(GREENFIELD_MODULE_BACKEND_MODES)
const ENDPOINT_STRATEGIES = new Set(['registry', 'installation', 'self-hosted', 'user-configured'])
const DEPLOYMENT_OWNERSHIP = new Set(['publisher-hosted', 'modula-hosted', 'customer-hosted', 'local-development'])
const DATA_STORES = new Set(['greenfield', 'module-backend', 'device', 'mixed'])
const BACKUP_RESPONSIBILITY = new Set(['greenfield', 'publisher', 'customer', 'shared'])
const DATA_CLASSIFICATIONS = new Set(['public', 'internal', 'private', 'sensitive', 'restricted'])
const ACTION_SIDE_EFFECTS = new Set(['none', 'internal-write', 'external-write', 'financial', 'destructive'])
const ACTION_CONFIRMATIONS = new Set(['none', 'user', 'reauthentication', 'operator'])

export function backendModeForManifest(manifest: {backend?: GreenfieldModuleBackendDefinition}): GreenfieldModuleBackendMode {
  return manifest.backend?.mode ?? 'greenfield-managed'
}

export function backendUsesModuleRuntime(manifest: {backend?: GreenfieldModuleBackendDefinition}): boolean {
  const mode = backendModeForManifest(manifest)
  return mode === 'module-managed' || mode === 'hybrid'
}

export function validateGreenfieldModuleBackend(
  backend: unknown,
  context: {moduleId: string; publisherId?: string},
): GreenfieldBackendValidationIssue[] {
  const issues: GreenfieldBackendValidationIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({path, code, message})
  if (backend === undefined) return issues
  if (!isRecord(backend)) {
    add('$.backend', 'INVALID_BACKEND', 'backend must be an object')
    return issues
  }
  const mode = String(backend.mode)
  if (!BACKEND_MODES.has(mode)) add('$.backend.mode', 'INVALID_BACKEND_MODE', 'Unsupported backend mode')
  if (backend.protocolVersion !== undefined && backend.protocolVersion !== MODULA_MODULE_BACKEND_PROTOCOL_VERSION) {
    add('$.backend.protocolVersion', 'UNSUPPORTED_BACKEND_PROTOCOL', `backend protocolVersion must be ${MODULA_MODULE_BACKEND_PROTOCOL_VERSION}`)
  }
  const ownsBackend = mode === 'module-managed' || mode === 'hybrid'
  if (ownsBackend) {
    for (const field of ['endpoints', 'authentication', 'trust', 'data', 'deployment'] as const) {
      if (!isRecord(backend[field])) add(`$.backend.${field}`, 'MISSING_BACKEND_SECTION', `${field} is required for ${mode}`)
    }
  }
  if (mode === 'frontend-only') {
    for (const field of ['endpoints', 'authentication', 'trust', 'actions', 'clientAccess'] as const) {
      if (backend[field] !== undefined) add(`$.backend.${field}`, 'FRONTEND_ONLY_BACKEND_DECLARATION', `frontend-only modules must not declare backend.${field}`)
    }
  }
  validateEndpoints(backend.endpoints, add)
  validateAuthentication(backend.authentication, ownsBackend, add)
  validateTrust(backend.trust, context, add)
  validateData(backend.data, ownsBackend, add)
  validateDeployment(backend.deployment, add)
  validateActions(backend.actions, context.moduleId, add)
  validateClientAccess(backend.clientAccess, add)
  return issues
}

function validateEndpoints(value: unknown, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.backend.endpoints', 'INVALID_BACKEND_ENDPOINTS', 'backend.endpoints must be an object')
    return
  }
  const allowed = new Set(['baseUrlStrategy', 'apiVersion', 'discoveryPath', 'healthPath', 'capabilitiesPath', 'actionsPath', 'eventsPath', 'webhooksPath', 'allowedHosts'])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(`$.backend.endpoints.${key}`, 'UNKNOWN_BACKEND_ENDPOINT_PROPERTY', `Unknown backend endpoint property ${key}`)
    if (/url$/i.test(key)) add(`$.backend.endpoints.${key}`, 'ARBITRARY_BACKEND_URL', 'Declare one backend origin resolved at installation, not arbitrary endpoint URLs')
  }
  if (!ENDPOINT_STRATEGIES.has(String(value.baseUrlStrategy))) add('$.backend.endpoints.baseUrlStrategy', 'INVALID_BACKEND_ENDPOINT_STRATEGY', 'Unsupported baseUrlStrategy')
  if (typeof value.apiVersion !== 'string' || value.apiVersion.length < 1) add('$.backend.endpoints.apiVersion', 'INVALID_BACKEND_API_VERSION', 'apiVersion is required')
  for (const field of ['discoveryPath', 'healthPath', 'capabilitiesPath', 'actionsPath', 'eventsPath', 'webhooksPath'] as const) {
    const required = field === 'healthPath'
    validatePath(value[field], `$.backend.endpoints.${field}`, required, add)
  }
  if (value.allowedHosts !== undefined) {
    if (!Array.isArray(value.allowedHosts) || value.allowedHosts.length > 40) add('$.backend.endpoints.allowedHosts', 'INVALID_ALLOWED_HOSTS', 'allowedHosts must be a bounded array')
    else value.allowedHosts.forEach((host, index) => validateHost(host, `$.backend.endpoints.allowedHosts[${index}]`, add))
  }
}

function validateAuthentication(value: unknown, ownsBackend: boolean, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.backend.authentication', 'INVALID_BACKEND_AUTHENTICATION', 'backend.authentication must be an object')
    return
  }
  if (value.tokenExchangeRequired !== true && ownsBackend) add('$.backend.authentication.tokenExchangeRequired', 'TOKEN_EXCHANGE_REQUIRED', 'module-managed and hybrid backends require token exchange')
  validatePath(value.sessionExchangePath, '$.backend.authentication.sessionExchangePath', false, add)
}

function validateTrust(value: unknown, context: {publisherId?: string}, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.backend.trust', 'INVALID_BACKEND_TRUST', 'backend.trust must be an object')
    return
  }
  if (typeof value.publisherId !== 'string' || value.publisherId.length < 1) add('$.backend.trust.publisherId', 'INVALID_PUBLISHER_ID', 'backend trust publisherId is required')
  if (context.publisherId && value.publisherId !== context.publisherId) add('$.backend.trust.publisherId', 'BACKEND_PUBLISHER_MISMATCH', 'backend trust publisherId must match manifest publisher')
  if (!Array.isArray(value.allowedOrigins) || value.allowedOrigins.length < 1 || value.allowedOrigins.length > 40) {
    add('$.backend.trust.allowedOrigins', 'INVALID_ALLOWED_ORIGINS', 'backend trust allowedOrigins must be a bounded array')
  } else {
    value.allowedOrigins.forEach((origin, index) => validateOrigin(origin, `$.backend.trust.allowedOrigins[${index}]`, add))
  }
}

function validateData(value: unknown, ownsBackend: boolean, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.backend.data', 'INVALID_BACKEND_DATA', 'backend.data must be an object')
    return
  }
  if (!DATA_STORES.has(String(value.primaryStore))) add('$.backend.data.primaryStore', 'INVALID_BACKEND_DATA_STORE', 'Unsupported data primaryStore')
  if (ownsBackend && !['module-backend', 'mixed'].includes(String(value.primaryStore))) {
    add('$.backend.data.primaryStore', 'BACKEND_DATA_STORE_MISMATCH', 'module-managed and hybrid backends must use module-backend or mixed primaryStore')
  }
  if (!Array.isArray(value.categories) || value.categories.length < (ownsBackend ? 1 : 0) || value.categories.length > 80) add('$.backend.data.categories', 'INVALID_DATA_CATEGORIES', 'backend data categories must be a bounded array')
  else {
    value.categories.forEach((category, index) => {
      if (!isRecord(category)) {
        add(`$.backend.data.categories[${index}]`, 'INVALID_DATA_CATEGORY', 'data category must be an object')
        return
      }
      if (!['greenfield', 'module-backend', 'device'].includes(String(category.location))) add(`$.backend.data.categories[${index}].location`, 'INVALID_DATA_LOCATION', 'Unsupported data category location')
      if (!DATA_CLASSIFICATIONS.has(String(category.classification))) add(`$.backend.data.categories[${index}].classification`, 'INVALID_DATA_CLASSIFICATION', 'Unsupported data classification')
    })
  }
  if (!BACKUP_RESPONSIBILITY.has(String(value.backupResponsibility))) add('$.backend.data.backupResponsibility', 'INVALID_BACKUP_RESPONSIBILITY', 'Unsupported backup responsibility')
}

function validateDeployment(value: unknown, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.backend.deployment', 'INVALID_BACKEND_DEPLOYMENT', 'backend.deployment must be an object')
    return
  }
  if (!DEPLOYMENT_OWNERSHIP.has(String(value.ownership))) add('$.backend.deployment.ownership', 'INVALID_BACKEND_DEPLOYMENT_OWNERSHIP', 'Unsupported backend deployment ownership')
  if (typeof value.multiTenant !== 'boolean') add('$.backend.deployment.multiTenant', 'INVALID_BOOLEAN', 'multiTenant must be boolean')
  if (typeof value.selfHostingSupported !== 'boolean') add('$.backend.deployment.selfHostingSupported', 'INVALID_BOOLEAN', 'selfHostingSupported must be boolean')
}

function validateActions(value: unknown, moduleId: string, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 120) {
    add('$.backend.actions', 'INVALID_BACKEND_ACTIONS', 'backend.actions must be a bounded array')
    return
  }
  value.forEach((action, index) => {
    if (!isRecord(action)) {
      add(`$.backend.actions[${index}]`, 'INVALID_BACKEND_ACTION', 'backend action must be an object')
      return
    }
    if (typeof action.actionId !== 'string' || !action.actionId.startsWith(`${moduleId}.`)) add(`$.backend.actions[${index}].actionId`, 'BACKEND_ACTION_OUTSIDE_NAMESPACE', 'backend actionId must be in the module namespace')
    if (action.method !== 'POST') add(`$.backend.actions[${index}].method`, 'INVALID_BACKEND_ACTION_METHOD', 'backend actions must use POST')
    validatePath(action.path, `$.backend.actions[${index}].path`, true, add)
    if (!ACTION_SIDE_EFFECTS.has(String(action.sideEffects))) add(`$.backend.actions[${index}].sideEffects`, 'INVALID_BACKEND_ACTION_SIDE_EFFECTS', 'Unsupported backend action sideEffects')
    if (!ACTION_CONFIRMATIONS.has(String(action.confirmation))) add(`$.backend.actions[${index}].confirmation`, 'INVALID_BACKEND_ACTION_CONFIRMATION', 'Unsupported backend action confirmation')
  })
}

function validateClientAccess(value: unknown, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) return
  if (!isRecord(value)) {
    add('$.backend.clientAccess', 'INVALID_CLIENT_ACCESS', 'backend.clientAccess must be an object')
    return
  }
  if (value.tokenExchangeRequired !== true) add('$.backend.clientAccess.tokenExchangeRequired', 'TOKEN_EXCHANGE_REQUIRED', 'direct client backend access requires token exchange')
  if (!Array.isArray(value.allowedOrigins) || value.allowedOrigins.length < 1 || value.allowedOrigins.length > 40) add('$.backend.clientAccess.allowedOrigins', 'INVALID_ALLOWED_ORIGINS', 'clientAccess allowedOrigins must be a bounded array')
  else value.allowedOrigins.forEach((origin, index) => validateOrigin(origin, `$.backend.clientAccess.allowedOrigins[${index}]`, add))
  if (typeof value.maxSessionSeconds !== 'number' || value.maxSessionSeconds < 30 || value.maxSessionSeconds > 900) add('$.backend.clientAccess.maxSessionSeconds', 'INVALID_CLIENT_SESSION_TTL', 'clientAccess maxSessionSeconds must be 30..900')
}

function validatePath(value: unknown, path: string, required: boolean, add: (path: string, code: string, message: string) => void) {
  if (value === undefined) {
    if (required) add(path, 'MISSING_BACKEND_PATH', `${path} is required`)
    return
  }
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('://') || value.includes('..') || value.includes('\\')) {
    add(path, 'INVALID_BACKEND_PATH', 'Backend paths must be safe absolute paths under the resolved backend origin')
  }
}

function validateHost(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (typeof value !== 'string' || value.includes('*') || value.includes('/') || value.includes(':') || isUnsafeHost(value)) {
    add(path, 'UNSAFE_BACKEND_HOST', 'backend hosts must be exact public hostnames')
  }
}

function validateOrigin(value: unknown, path: string, add: (path: string, code: string, message: string) => void) {
  if (typeof value !== 'string') {
    add(path, 'INVALID_BACKEND_ORIGIN', 'backend origin must be an https origin')
    return
  }
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash || isUnsafeHost(url.hostname)) {
      add(path, 'UNSAFE_BACKEND_ORIGIN', 'backend origin must be an https public origin without path, query, credentials, or fragment')
    }
  } catch {
    add(path, 'INVALID_BACKEND_ORIGIN', 'backend origin must be a valid https origin')
  }
}

function isUnsafeHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === 'metadata.google.internal' || normalized === '169.254.169.254') return true
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized)
  if (!ipv4) return normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')
  const octets = ipv4.slice(1).map(Number)
  const a = octets[0] ?? 0
  const b = octets[1] ?? 0
  return a === 127 || a === 0 || a === 10 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
