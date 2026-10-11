export type GreenfieldModulePermissionRisk = 'low' | 'medium' | 'high' | 'restricted'

export type GreenfieldModulePermission = {
  permission: string
  reason: string
  risk?: GreenfieldModulePermissionRisk
}

export const RESERVED_DIMON_PERMISSIONS = [
  'dimon:account:read',
  'dimon:account:link',
  'dimon:transaction:request',
  'dimon:transaction:approve',
  'dimon:ledger:audit',
] as const

export const RESTRICTED_SYSTEM_PERMISSIONS = [
  'schemas:register',
  'settings:register',
  'routes:register',
  'profile-tabs:register',
  'board-surfaces:register',
  'tools:register',
  'functions:register',
  'widgets:register',
  'plugins:register',
  'connectors:register',
] as const

const STATIC_PERMISSIONS = new Set([
  ...RESTRICTED_SYSTEM_PERMISSIONS,
  'settings:read',
  'settings:write',
  'jobs:create',
  'events:subscribe',
  'notifications:create',
  'search:index',
  'files:temporary:read',
  'files:temporary:write',
  'ai.request',
  'ai.stream',
  'ai.structured-output',
  'ai.context.public',
  'ai.context.private',
  'ai.context.sensitive',
])

const RECORD_PERMISSION_PATTERN =
  /^records:module\.[a-z0-9-]+(\.[a-z0-9-]+)+\.[a-z0-9-]+:(read|write|delete)$/
const FUNCTION_INVOKE_PATTERN = /^functions:[a-z0-9-]+(\.[a-z0-9-]+)+\.function\.[a-z0-9-]+:invoke$/
const NETWORK_REQUEST_PATTERN = /^network:[a-z0-9.-]+:request$/
const PRODUCT_CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.(read|create|update|delete|search|manage|export|contribute|subscribe|invoke|execute|record|transcribe|request|capture|playback)$/

export function isSupportedModulePermission(permission: string): boolean {
  return (
    STATIC_PERMISSIONS.has(permission) ||
    RESERVED_DIMON_PERMISSIONS.includes(permission as (typeof RESERVED_DIMON_PERMISSIONS)[number]) ||
    RECORD_PERMISSION_PATTERN.test(permission) ||
    FUNCTION_INVOKE_PATTERN.test(permission) ||
    NETWORK_REQUEST_PATTERN.test(permission) ||
    PRODUCT_CAPABILITY_PATTERN.test(permission)
  )
}

export function isDimonPermission(permission: string): boolean {
  return permission === 'dimon:*' || permission.startsWith('dimon:')
}

export function classifyPermissionRisk(permission: string): GreenfieldModulePermissionRisk {
  if (isDimonPermission(permission) || permission === 'plugins:register' || permission.startsWith('network:')) {
    return 'restricted'
  }
  if (permission.endsWith(':delete') || permission === 'functions:register' || permission === 'jobs:create') return 'high'
  if (permission.endsWith('.delete') || permission.endsWith('.export')) return 'high'
  if (permission.endsWith('.create') || permission.endsWith('.update') || permission.endsWith('.manage')) return 'medium'
  if (permission.endsWith(':write') || permission.includes(':register')) return 'medium'
  return 'low'
}

export function validatePermissionRequest(
  request: GreenfieldModulePermission,
  options: {firstParty: boolean; community: boolean} = {firstParty: false, community: true},
): string[] {
  const errors: string[] = []
  if (!request || typeof request.permission !== 'string') {
    return ['Permission request must include a permission string']
  }
  if (!isSupportedModulePermission(request.permission)) {
    errors.push(`Unknown module permission: ${request.permission}`)
  }
  if (!request.reason || request.reason.trim().length < 4 || request.reason.length > 300) {
    errors.push(`Permission ${request.permission} must include a human-readable reason`)
  }
  if (!options.firstParty && isDimonPermission(request.permission)) {
    errors.push(`Third-party modules cannot request reserved DIMON permission ${request.permission}`)
  }
  if (options.community && RESTRICTED_SYSTEM_PERMISSIONS.includes(request.permission as any)) {
    errors.push(`Community modules cannot request restricted system permission ${request.permission}`)
  }
  return errors
}
