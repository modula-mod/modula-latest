/**
 * Semantic intelligence capabilities for Mission 01.
 * Future capabilities (vision, speech, embeddings, RAG, agents) may be added
 * without breaking this contract — callers request capabilities by name.
 */
export const INTELLIGENCE_CAPABILITIES = [
  'generate',
  'rewrite',
  'summarize',
  'classify',
  'extract',
  'intent',
  'tool-call',
] as const

export type IntelligenceCapability = (typeof INTELLIGENCE_CAPABILITIES)[number]

const CAPABILITY_SET = new Set<string>(INTELLIGENCE_CAPABILITIES)

export function isIntelligenceCapability(value: unknown): value is IntelligenceCapability {
  return typeof value === 'string' && CAPABILITY_SET.has(value)
}
