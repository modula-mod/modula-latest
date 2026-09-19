/**
 * Privacy travels with every request through the entire execution pipeline.
 *
 * - local-only: never leave the device; fail closed if no local provider.
 * - prefer-local: local when available; remote only when local cannot satisfy
 *   and Modula settings permit remote intelligence.
 * - allow-remote: remote permitted; routing may still pick local when sufficient.
 */
export const INTELLIGENCE_PRIVACY_POLICIES = [
  'local-only',
  'prefer-local',
  'allow-remote',
] as const

export type IntelligencePrivacy = (typeof INTELLIGENCE_PRIVACY_POLICIES)[number]

const PRIVACY_SET = new Set<string>(INTELLIGENCE_PRIVACY_POLICIES)

export function isIntelligencePrivacy(value: unknown): value is IntelligencePrivacy {
  return typeof value === 'string' && PRIVACY_SET.has(value)
}
