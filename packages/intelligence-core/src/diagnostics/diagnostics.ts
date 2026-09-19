import type {IntelligenceProviderRegistry} from '../providers/ProviderRegistry.js'
import type {IntelligenceAvailability} from '../contracts/availability.js'
import {isProviderAvailable} from '../contracts/availability.js'
import type {IntelligenceDiagnosticEvent} from '../contracts/provider.js'

export type IntelligenceDiagnosticsSnapshot = {
  core: 'ready'
  providers: number
  localProviders: number
  remoteProviders: number
  providerStatuses: Array<{
    id: string
    execution: 'local' | 'remote'
    availability: IntelligenceAvailability
  }>
  networkRequired: false
  lastEvent?: IntelligenceDiagnosticEvent
}

/**
 * Structural diagnostics only — never logs request input, output, or tool args.
 */
export class IntelligenceDiagnostics {
  private lastEvent: IntelligenceDiagnosticEvent | undefined

  record(event: IntelligenceDiagnosticEvent): void {
    this.lastEvent = {
      requestId: event.requestId,
      capability: event.capability,
      providerId: event.providerId,
      execution: event.execution,
      durationMs: event.durationMs,
      status: event.status,
      errorCode: event.errorCode,
    }
  }

  async snapshot(providers: IntelligenceProviderRegistry): Promise<IntelligenceDiagnosticsSnapshot> {
    const list = providers.list()
    const providerStatuses = []
    for (const provider of list) {
      const availability = await provider.availability()
      providerStatuses.push({
        id: provider.id,
        execution: provider.execution,
        availability,
      })
    }

    return {
      core: 'ready',
      providers: list.length,
      localProviders: list.filter(p => p.execution === 'local').length,
      remoteProviders: list.filter(p => p.execution === 'remote').length,
      providerStatuses,
      networkRequired: false,
      lastEvent: this.lastEvent,
    }
  }
}

export async function runLocalOnlyPrivacyProbe(
  providers: IntelligenceProviderRegistry,
): Promise<{pass: boolean; detail: string}> {
  const local = providers.listByExecution('local')
  for (const provider of local) {
    const availability = await provider.availability()
    if (isProviderAvailable(availability)) {
      return {pass: true, detail: `LOCAL ONLY PASS via ${provider.id}`}
    }
  }
  return {pass: false, detail: 'LOCAL ONLY FAIL — no available local provider'}
}
