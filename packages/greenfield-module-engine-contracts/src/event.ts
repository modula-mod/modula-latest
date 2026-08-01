import type {GreenfieldRuntimeCapability} from './capability.js'

export type GreenfieldRuntimeEventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export type GreenfieldEngineEvent = {
  id: string
  type: string
  occurredAt: string
  accountId?: string
  moduleId?: string
  providerId?: string
  sessionId?: string
  capability?: GreenfieldRuntimeCapability
  severity: GreenfieldRuntimeEventSeverity
  data?: Record<string, string | number | boolean | null>
}
