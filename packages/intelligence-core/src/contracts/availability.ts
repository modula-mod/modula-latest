/**
 * Provider availability vocabulary for routing.
 * Model download / install flows are deferred; this vocabulary enables them.
 */
export const INTELLIGENCE_AVAILABILITY_STATES = [
  'available',
  'unavailable',
  'unsupported-device',
  'model-not-installed',
  'model-downloading',
  'disabled',
  'permission-denied',
  'offline',
  'temporarily-unavailable',
] as const

export type IntelligenceAvailabilityState = (typeof INTELLIGENCE_AVAILABILITY_STATES)[number]

export type IntelligenceAvailability = {
  state: IntelligenceAvailabilityState
  /** Structural reason code for diagnostics — never personal content. */
  reasonCode?: string
  /** Optional human-readable structural message (no user content). */
  message?: string
}

export function isProviderAvailable(availability: IntelligenceAvailability): boolean {
  return availability.state === 'available'
}
