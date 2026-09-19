import type {IntelligenceAvailability} from './availability.js'
import type {IntelligenceCapability} from './capability.js'
import type {IntelligenceRequest} from './request.js'
import type {IntelligenceExecutionLocation, IntelligenceResponse} from './response.js'
import type {IntelligenceToolRegistry} from '../tools/ToolRegistry.js'

/**
 * Execution context carries attribution, cancellation, and settings flags.
 * Modules never instantiate providers; the core supplies this context.
 */
export type IntelligenceExecutionContext = {
  /** Whether Modula settings currently permit remote intelligence. */
  remoteIntelligencePermitted: boolean
  signal?: AbortSignal
  /** Granted permission IDs for tool authorization checks. */
  grantedPermissions?: readonly string[]
  /** Optional tool registry for tool-call capability requests. */
  tools?: IntelligenceToolRegistry
  /** Structural diagnostics sink — never receives personal content. */
  onDiagnostic?: (event: IntelligenceDiagnosticEvent) => void
}

export type IntelligenceDiagnosticEvent = {
  requestId: string
  capability: IntelligenceCapability
  providerId?: string
  execution?: IntelligenceExecutionLocation
  durationMs?: number
  status: 'routed' | 'success' | 'failure' | 'cancelled'
  errorCode?: string
}

/**
 * Platform-neutral provider adapter contract.
 * No Apple, llama.cpp, HTTP, OpenAI, or other vendor types surface here.
 */
export interface IntelligenceProvider {
  readonly id: string
  readonly execution: IntelligenceExecutionLocation
  readonly capabilities: readonly IntelligenceCapability[]
  availability(): Promise<IntelligenceAvailability>
  execute(
    request: IntelligenceRequest,
    context: IntelligenceExecutionContext,
  ): Promise<IntelligenceResponse>
}
