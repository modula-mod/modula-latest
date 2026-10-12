export const MODULE_INTELLIGENCE_TASKS = [
  'summarize', 'rewrite', 'classify', 'extract', 'semantic-related', 'question-answer',
] as const

export const MODULE_INTELLIGENCE_POLICIES = ['localOnly', 'preferLocal', 'allowRemote'] as const
export const MODULE_INTELLIGENCE_PROVIDER_DISCOVERY_VERSION = '1.0.0' as const

export type ModuleIntelligenceTask = (typeof MODULE_INTELLIGENCE_TASKS)[number]
export type ModuleIntelligencePolicy = (typeof MODULE_INTELLIGENCE_POLICIES)[number]
export type ModuleIntelligenceProviderClass = 'local' | 'remote'

export type ModuleIntelligenceProvider = {
  providerId: string
  providerClass: ModuleIntelligenceProviderClass
  version: string
  supportedTasks: readonly ModuleIntelligenceTask[]
  maximumInput: number
  streaming: boolean
  privacyClasses: readonly string[]
  available: boolean
}

export type ModuleIntelligenceProviderDiscovery = {
  schemaVersion: typeof MODULE_INTELLIGENCE_PROVIDER_DISCOVERY_VERSION
  providers: readonly ModuleIntelligenceProvider[]
}

export type ModuleIntelligenceRequest = {
  task: ModuleIntelligenceTask
  policy: ModuleIntelligencePolicy
  input: string
  outputSchema?: Record<string, unknown>
  stream?: boolean
  privacyClass: string
}

export type ModuleIntelligenceAuthorization = {
  trustedRelease: boolean
  reviewCompleted: boolean
  capabilityGranted: boolean
  remoteAllowed: boolean
  classificationAllowed: boolean
  providerAllowed: boolean
}

export type ModuleIntelligenceExecution = {
  provider: ModuleIntelligenceProvider
  transport: 'host-capability' | 'greenfield-remote'
  execute(request: ModuleIntelligenceRequest): Promise<unknown>
}

export type ModuleIntelligenceResult = {
  route: ModuleIntelligenceProviderClass
  transport: ModuleIntelligenceExecution['transport']
  providerId: string
  output: unknown
}

export class ModuleIntelligenceError extends Error {
  constructor(public readonly code: 'CAPABILITY_UNAVAILABLE' | 'MODULE_PERMISSION_DENIED' | 'PERMISSION_REVIEW_REQUIRED' | 'UNTRUSTED_RELEASE' | 'REMOTE_POLICY_DENIED' | 'VALIDATION_FAILED', message: string) {
    super(message)
    this.name = 'ModuleIntelligenceError'
  }
}

/** Host-side broker. The localOnly branch never reads or calls a remote executor. */
export function createModuleIntelligenceBroker(input: {
  local?: ModuleIntelligenceExecution
  remote?: ModuleIntelligenceExecution
  authorization: ModuleIntelligenceAuthorization
}) {
  validateExecutionBoundary(input.local, 'local', 'host-capability')
  validateExecutionBoundary(input.remote, 'remote', 'greenfield-remote')
  return {
    providers(): ModuleIntelligenceProvider[] {
      return [input.local?.provider, input.remote?.provider].filter((provider): provider is ModuleIntelligenceProvider => Boolean(provider))
    },

    discovery(): ModuleIntelligenceProviderDiscovery {
      return {schemaVersion: MODULE_INTELLIGENCE_PROVIDER_DISCOVERY_VERSION, providers: this.providers()}
    },

    async request(request: ModuleIntelligenceRequest): Promise<ModuleIntelligenceResult> {
      validateRequest(request)
      enforceBaseAuthorization(input.authorization)

      if (request.policy === 'localOnly') {
        const local = eligible(input.local, request)
        if (!local) throw new ModuleIntelligenceError('CAPABILITY_UNAVAILABLE', 'A compatible local host intelligence provider is unavailable')
        return executeAndValidate(local, request, 'local')
      }

      if (request.policy === 'preferLocal') {
        const local = eligible(input.local, request)
        if (local) return executeAndValidate(local, request, 'local')
      }

      enforceRemoteAuthorization(input.authorization)
      const remote = eligible(input.remote, request)
      if (!remote) throw new ModuleIntelligenceError('CAPABILITY_UNAVAILABLE', 'A compatible authorized remote intelligence provider is unavailable')
      return executeAndValidate(remote, request, 'remote')
    },
  }
}

async function executeAndValidate(
  execution: ModuleIntelligenceExecution,
  request: ModuleIntelligenceRequest,
  route: ModuleIntelligenceProviderClass,
): Promise<ModuleIntelligenceResult> {
  const output = await execution.execute(request)
  if (request.outputSchema && !matchesJsonSchema(request.outputSchema, output)) {
    throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Intelligence provider output does not match the requested schema')
  }
  return {route, transport: execution.transport, providerId: execution.provider.providerId, output}
}

function eligible(execution: ModuleIntelligenceExecution | undefined, request: ModuleIntelligenceRequest): ModuleIntelligenceExecution | undefined {
  if (!execution?.provider.available) return undefined
  if (!execution.provider.supportedTasks.includes(request.task)) return undefined
  if (!execution.provider.privacyClasses.includes(request.privacyClass)) return undefined
  if (request.input.length > execution.provider.maximumInput) return undefined
  if (request.stream && !execution.provider.streaming) return undefined
  return execution
}

function enforceBaseAuthorization(authorization: ModuleIntelligenceAuthorization): void {
  if (!authorization.trustedRelease) throw new ModuleIntelligenceError('UNTRUSTED_RELEASE', 'The module release is not trusted')
  if (!authorization.reviewCompleted) throw new ModuleIntelligenceError('PERMISSION_REVIEW_REQUIRED', 'The exact release requires permission review')
  if (!authorization.capabilityGranted) throw new ModuleIntelligenceError('MODULE_PERMISSION_DENIED', 'The module intelligence capability is denied')
}

function enforceRemoteAuthorization(authorization: ModuleIntelligenceAuthorization): void {
  if (!authorization.remoteAllowed || !authorization.classificationAllowed || !authorization.providerAllowed) {
    throw new ModuleIntelligenceError('REMOTE_POLICY_DENIED', 'Remote intelligence is not permitted by module, data classification, and provider policy')
  }
}

function validateExecutionBoundary(
  execution: ModuleIntelligenceExecution | undefined,
  providerClass: ModuleIntelligenceProviderClass,
  transport: ModuleIntelligenceExecution['transport'],
): void {
  if (!execution) return
  if (execution.provider.providerClass !== providerClass || execution.transport !== transport) {
    throw new ModuleIntelligenceError('VALIDATION_FAILED', `${providerClass} intelligence must use the ${transport} boundary`)
  }
}

function validateRequest(request: ModuleIntelligenceRequest): void {
  if (!MODULE_INTELLIGENCE_TASKS.includes(request.task) || !MODULE_INTELLIGENCE_POLICIES.includes(request.policy)) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Unsupported intelligence task or policy')
  if (typeof request.input !== 'string' || request.input.length < 1) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Intelligence input is required')
  if (request.input.length > 500_000) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Intelligence input exceeds the broker maximum')
  if (!request.privacyClass || request.privacyClass.length > 80) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'A bounded privacy class is required')
  if (request.outputSchema !== undefined) {
    if (!isRecord(request.outputSchema) || JSON.stringify(request.outputSchema).length > 100_000) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'A bounded JSON output schema is required')
    assertSupportedSchema(request.outputSchema)
  }
}

function assertSupportedSchema(schema: Record<string, unknown>): void {
  const type = schema.type
  if (type !== undefined && !['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(String(type))) {
    throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Unsupported output schema type')
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || !schema.required.every(item => typeof item === 'string'))) {
    throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Output schema required must be a string list')
  }
  if (schema.properties !== undefined) {
    if (!isRecord(schema.properties)) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Output schema properties must be an object')
    for (const child of Object.values(schema.properties)) {
      if (!isRecord(child)) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Output schema property must be an object')
      assertSupportedSchema(child)
    }
  }
  if (schema.items !== undefined) {
    if (!isRecord(schema.items)) throw new ModuleIntelligenceError('VALIDATION_FAILED', 'Output schema items must be an object')
    assertSupportedSchema(schema.items)
  }
}

function matchesJsonSchema(schema: Record<string, unknown>, value: unknown): boolean {
  if (Array.isArray(schema.enum) && !schema.enum.some(item => Object.is(item, value))) return false
  const type = schema.type
  if (type === 'null') return value === null
  if (type === 'string' && typeof value !== 'string') return false
  if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return false
  if (type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) return false
  if (type === 'boolean' && typeof value !== 'boolean') return false
  if (type === 'array') {
    if (!Array.isArray(value)) return false
    return !isRecord(schema.items) || value.every(item => matchesJsonSchema(schema.items as Record<string, unknown>, item))
  }
  if (type === 'object') {
    if (!isRecord(value)) return false
    const properties = isRecord(schema.properties) ? schema.properties : {}
    const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === 'string') : []
    if (required.some(key => !(key in value))) return false
    if (schema.additionalProperties === false && Object.keys(value).some(key => !(key in properties))) return false
    return Object.entries(properties).every(([key, child]) => !(key in value) || !isRecord(child) || matchesJsonSchema(child, value[key]))
  }
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
