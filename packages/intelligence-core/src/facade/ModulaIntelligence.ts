import {IntelligenceError, isIntelligenceError} from '../contracts/errors.js'
import {isIntelligenceCapability} from '../contracts/capability.js'
import {isIntelligencePrivacy} from '../contracts/privacy.js'
import type {IntelligenceExecuteInput, IntelligenceRequest} from '../contracts/request.js'
import type {IntelligenceResponse} from '../contracts/response.js'
import type {
  IntelligenceDiagnosticEvent,
  IntelligenceExecutionContext,
  IntelligenceProvider,
} from '../contracts/provider.js'
import type {IntelligenceAvailability} from '../contracts/availability.js'
import {IntelligenceProviderRegistry} from '../providers/ProviderRegistry.js'
import {IntelligenceToolRegistry} from '../tools/ToolRegistry.js'
import {
  IntelligenceRouter,
  routingFailureToError,
} from '../router/IntelligenceRouter.js'
import {
  IntelligenceDiagnostics,
  runLocalOnlyPrivacyProbe,
  type IntelligenceDiagnosticsSnapshot,
} from '../diagnostics/diagnostics.js'

export type ModulaIntelligenceOptions = {
  providers?: IntelligenceProviderRegistry
  tools?: IntelligenceToolRegistry
  /** Default from Modula settings; callers may override per execute(). */
  remoteIntelligencePermitted?: boolean
  /** Inject request IDs in tests; default is an offline-safe UUID-like string. */
  createRequestId?: () => string
  onDiagnostic?: (event: IntelligenceDiagnosticEvent) => void
}

export type ModulaIntelligenceExecuteOptions = {
  remoteIntelligencePermitted?: boolean
  signal?: AbortSignal
  grantedPermissions?: readonly string[]
}

/**
 * Stable public facade — the `modula.ai` surface for Mission 01.
 * Modules call this API; they never instantiate providers or Apple/LLM runtimes.
 */
export class ModulaIntelligence {
  readonly providers: IntelligenceProviderRegistry
  readonly tools: IntelligenceToolRegistry
  readonly diagnostics: IntelligenceDiagnostics

  private remoteIntelligencePermitted: boolean
  private readonly createRequestId: () => string
  private readonly onDiagnostic?: (event: IntelligenceDiagnosticEvent) => void

  constructor(options: ModulaIntelligenceOptions = {}) {
    this.providers = options.providers ?? new IntelligenceProviderRegistry()
    this.tools = options.tools ?? new IntelligenceToolRegistry()
    this.diagnostics = new IntelligenceDiagnostics()
    this.remoteIntelligencePermitted = options.remoteIntelligencePermitted ?? false
    this.createRequestId = options.createRequestId ?? createOfflineRequestId
    this.onDiagnostic = options.onDiagnostic
  }

  setRemoteIntelligencePermitted(permitted: boolean): void {
    this.remoteIntelligencePermitted = permitted
  }

  isRemoteIntelligencePermitted(): boolean {
    return this.remoteIntelligencePermitted
  }

  /**
   * Primary entry: route + execute. Selection never silently violates privacy.
   */
  async execute<TInput = unknown, TOutput = unknown>(
    input: IntelligenceExecuteInput<TInput>,
    options: ModulaIntelligenceExecuteOptions = {},
  ): Promise<IntelligenceResponse<TOutput>> {
    const request = this.normalizeRequest(input)
    const remotePermitted =
      options.remoteIntelligencePermitted ?? this.remoteIntelligencePermitted

    if (options.signal?.aborted) {
      const error = new IntelligenceError(
        'REQUEST_CANCELLED',
        'Intelligence request was cancelled',
        {requestId: request.id},
      )
      this.emitDiagnostic({
        requestId: request.id,
        capability: request.capability,
        status: 'cancelled',
        errorCode: error.code,
      })
      throw error
    }

    const router = new IntelligenceRouter({
      providers: this.providers,
      remoteIntelligencePermitted: remotePermitted,
    })

    const routing = await router.select(request.capability, request.privacy)
    if (!routing.ok) {
      const error = routingFailureToError(routing)
      this.emitDiagnostic({
        requestId: request.id,
        capability: request.capability,
        status: 'failure',
        errorCode: error.code,
      })
      throw error
    }

    this.emitDiagnostic({
      requestId: request.id,
      capability: request.capability,
      providerId: routing.provider.id,
      execution: routing.provider.execution,
      status: 'routed',
    })

    // Hard guard: local-only must never invoke a remote provider.execute().
    if (request.privacy === 'local-only' && routing.provider.execution === 'remote') {
      const error = new IntelligenceError(
        'REMOTE_EXECUTION_FORBIDDEN',
        'local-only privacy forbids remote provider execution',
        {providerId: routing.provider.id, requestId: request.id},
      )
      this.emitDiagnostic({
        requestId: request.id,
        capability: request.capability,
        providerId: routing.provider.id,
        execution: 'remote',
        status: 'failure',
        errorCode: error.code,
      })
      throw error
    }

    const context: IntelligenceExecutionContext = {
      remoteIntelligencePermitted: remotePermitted,
      signal: options.signal,
      grantedPermissions: options.grantedPermissions,
      tools: this.tools,
      onDiagnostic: event => this.emitDiagnostic(event),
    }

    const started = Date.now()
    try {
      const response = await routing.provider.execute(request, context)
      const durationMs = response.durationMs ?? Date.now() - started
      this.emitDiagnostic({
        requestId: request.id,
        capability: request.capability,
        providerId: response.providerId,
        execution: response.execution,
        durationMs,
        status: 'success',
      })
      return response as IntelligenceResponse<TOutput>
    } catch (error) {
      if (isIntelligenceError(error)) {
        this.emitDiagnostic({
          requestId: request.id,
          capability: request.capability,
          providerId: routing.provider.id,
          execution: routing.provider.execution,
          durationMs: Date.now() - started,
          status: error.code === 'REQUEST_CANCELLED' ? 'cancelled' : 'failure',
          errorCode: error.code,
        })
        throw error
      }
      const wrapped = new IntelligenceError(
        'PROVIDER_FAILURE',
        error instanceof Error ? error.message : 'Provider execution failed',
        {providerId: routing.provider.id, requestId: request.id},
      )
      this.emitDiagnostic({
        requestId: request.id,
        capability: request.capability,
        providerId: routing.provider.id,
        execution: routing.provider.execution,
        durationMs: Date.now() - started,
        status: 'failure',
        errorCode: wrapped.code,
      })
      throw wrapped
    }
  }

  async listProviders(): Promise<readonly IntelligenceProvider[]> {
    return this.providers.list()
  }

  async availability(
    providerId?: string,
  ): Promise<IntelligenceAvailability | Array<{id: string; availability: IntelligenceAvailability}>> {
    if (providerId) {
      const provider = this.providers.get(providerId)
      if (!provider) {
        throw new IntelligenceError('PROVIDER_NOT_FOUND', `Provider not found: ${providerId}`, {
          providerId,
        })
      }
      return provider.availability()
    }
    const results = []
    for (const provider of this.providers.list()) {
      results.push({id: provider.id, availability: await provider.availability()})
    }
    return results
  }

  async getDiagnostics(): Promise<IntelligenceDiagnosticsSnapshot> {
    return this.diagnostics.snapshot(this.providers)
  }

  async privacyProbe(): Promise<{pass: boolean; detail: string}> {
    return runLocalOnlyPrivacyProbe(this.providers)
  }

  private normalizeRequest<TInput>(
    input: IntelligenceExecuteInput<TInput>,
  ): IntelligenceRequest<TInput> {
    if (!isIntelligenceCapability(input.capability)) {
      throw new IntelligenceError('INVALID_REQUEST', 'Invalid intelligence capability')
    }
    if (!isIntelligencePrivacy(input.privacy)) {
      throw new IntelligenceError('INVALID_REQUEST', 'Invalid intelligence privacy policy')
    }
    return {
      id: input.id ?? this.createRequestId(),
      capability: input.capability,
      input: input.input,
      privacy: input.privacy,
      tools: input.tools,
      metadata: input.metadata,
    }
  }

  private emitDiagnostic(event: IntelligenceDiagnosticEvent): void {
    this.diagnostics.record(event)
    this.onDiagnostic?.(event)
  }
}

export function createModulaIntelligence(
  options?: ModulaIntelligenceOptions,
): ModulaIntelligence {
  return new ModulaIntelligence(options)
}

/** Offline-safe ID — no crypto / network dependency. */
function createOfflineRequestId(): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `intel_${time}_${rand}`
}
