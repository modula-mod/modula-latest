import {
  createModulaIntelligence,
  DeterministicTestProvider,
  type ModulaIntelligence,
} from '@modula/intelligence-core'

/**
 * Greenfield host facade for shared intelligence semantics (`services.ai`).
 * Cheap to construct — does not load model runtimes on startup.
 * On-device inference belongs in modula-native; this wires contracts + test provider only.
 * The deterministic test provider is registered only in development builds.
 */
export function createModulaAi(): ModulaIntelligence {
  const ai = createModulaIntelligence({
    remoteIntelligencePermitted: false,
  })

  if (__DEV__) {
    ai.providers.register(new DeterministicTestProvider())
  }

  return ai
}

export type {ModulaIntelligence}
