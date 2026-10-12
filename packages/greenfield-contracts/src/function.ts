export type GreenfieldGovernedFunctionExecutionMode = 'host' | 'server' | 'remote' | 'community'

export type GreenfieldJsonSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
  properties?: Record<string, GreenfieldJsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: GreenfieldJsonSchema
  enum?: unknown[]
  const?: unknown
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
}

export type GreenfieldGovernedFunctionDeclaration = {
  moduleId: string
  /** Exact trusted release that declared and is executing this function. */
  releaseIdentity: string
  functionId: string
  version: string
  inputSchema: GreenfieldJsonSchema
  outputSchema: GreenfieldJsonSchema
  requiredCapabilities: string[]
  executionMode: GreenfieldGovernedFunctionExecutionMode
  mutating: boolean
  timeoutMs: number
}

export type GreenfieldGovernedFunctionFailure = {
  ok: false
  code:
    | 'FUNCTION_NOT_AVAILABLE'
    | 'FUNCTION_EXECUTION_UNSUPPORTED'
    | 'CAPABILITY_UNAVAILABLE'
    | 'MODULE_PERMISSION_DENIED'
    | 'PERMISSION_REVIEW_REQUIRED'
    | 'VALIDATION_FAILED'
  message: string
  executionMode: GreenfieldGovernedFunctionExecutionMode
  fallbackAttempted: false
}

export type GreenfieldHostFunctionRequestState =
  | 'created'
  | 'dispatched'
  | 'completed'
  | 'cancelled'
  | 'timed_out'
  | 'host_unavailable'
  | 'module_unloaded'

export type GreenfieldHostFunctionCapability = {
  functionId: string
  version: string
  available: boolean
  contractVersion: string
  provider?: string
  timeoutMs?: number
}

export type GreenfieldInterModuleActionIdentity = {
  targetModuleId: string
  actionId: string
  version: string
}

/** Canonical reviewed capability a source module must request for a target action. */
export function interModuleRequestCapability(targetModuleId: string, actionId: string, version: string): string {
  return `module.action:request:${targetModuleId}:${actionId}:${version}`
}

/** Canonical reviewed capability required to invoke a declared module function. */
export function governedFunctionInvokeCapability(moduleId: string, functionId: string): string {
  return `functions:${moduleId}.function.${functionId}:invoke`
}

export type GreenfieldFunctionExecutionMode =
  | 'synchronous'
  | 'backgroundJob'
  | 'remoteHttp'

/**
 * Function manifests declare typed I/O and execution mode.
 * Arbitrary JavaScript source is not permitted inside a manifest.
 */
export type GreenfieldFunctionManifest = {
  functionId: string
  name: string
  description?: string

  inputSchemaId: string
  outputSchemaId: string

  executionMode: GreenfieldFunctionExecutionMode

  requiredCapabilities: string[]
  timeoutMs: number
  idempotent: boolean
}
